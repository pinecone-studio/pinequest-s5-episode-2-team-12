import { beforeEach, describe, expect, mock, test } from 'bun:test';

const pushed: string[] = [];
mock.module('next/navigation', () => ({
  useRouter: () => ({
    push: (url: string) => pushed.push(url),
    refresh: () => {},
    replace: () => {},
    back: () => {},
  }),
  usePathname: () => '/roadmap',
}));

const { fireEvent, render, screen, waitFor, within } = await import('@/test/render');
const { loadLocalRoadmap, saveLocalRoadmap } = await import('../lib/local-store');
const { skippedResult } = await import('../lib/placement');
const { sampleState } = await import('../lib/sample');
const { initialState, withPlacement } = await import('../lib/state');
const { stopViews } = await import('../lib/view');
const { RoadmapMap } = await import('./RoadmapMap');
const { RoadmapView } = await import('./RoadmapView');
const { StopCard } = await import('./StopCard');
const { StopIntro } = await import('./StopIntro');
const { INTROS } = await import('../content/bank');
const { StopPlayer } = await import('./StopPlayer');

import type { Question } from '@/types';

// happy-dom has no layout: report a fixed box so the map lays out
class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    this.cb([{ contentRect: { width: 1000, height: 600 } } as ResizeObserverEntry], this as never);
  }
  disconnect() {}
  unobserve() {}
}
globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;

describe('StopCard', () => {
  const views = stopViews(sampleState(), true);
  const at = (no: number) => views.find((v) => v.stop.no === no)!;

  test('completed: place, aimag, step number, topic and stars', () => {
    render(<StopCard v={at(1)} />);
    expect(screen.getByText('Өлгий')).toBeTruthy();
    expect(screen.getByText('Баян-Өлгий')).toBeTruthy();
    expect(screen.getByText('1-р зогсоол')).toBeTruthy();
    expect(screen.getByText('Зэрэг ба язгуур')).toBeTruthy();
  });

  test('tested-out shows the chip', () => {
    render(<StopCard v={at(3)} />);
    expect(screen.getByText('Шалгалтаар давсан')).toBeTruthy();
  });

  test('current shows a progress ring against the pass mark', () => {
    render(<StopCard v={at(5)} />);
    // weak mastery → 10 problems, best 50% → 5 of the 8 needed
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByText('5/8')).toBeTruthy();
  });
});

describe('curriculum lessons', () => {
  test('all 26 lessons teach before showing a self-check solution', () => {
    for (let no = 1; no <= 26; no++) {
      const screens = INTROS[no];
      let finished = false;
      const lesson = render(
        <StopIntro
          screens={screens}
          onDone={() => {
            finished = true;
          }}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Бодолтыг харах' })).toBeNull();
      for (let i = 0; i < screens.length - 1; i++)
        fireEvent.click(screen.getByRole('button', { name: 'Дараах' }));
      const reveal = screen.getByRole('button', { name: 'Бодолтыг харах' });
      expect(reveal.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(reveal);
      expect(screen.getByRole('button', { name: 'Бодолтыг нуух' }).getAttribute('aria-expanded')).toBe(
        'true',
      );
      fireEvent.click(screen.getAllByRole('button', { name: 'Бодлого руу' }).at(-1)!);
      expect(finished).toBe(true);
      lesson.unmount();
    }
  });
});

describe('RoadmapView', () => {
  test('returning from unfinished placement still shows the first topic without extra prompts', () => {
    localStorage.clear();
    const { container, unmount } = render(<RoadmapView demo server={null} />);
    expect(container.querySelector('.roadmap-featured-topic h2')?.textContent).toBe('Зэрэг ба язгуур');
    expect(screen.queryByRole('region', { name: 'Аялал эхлэхийн өмнө' })).toBeNull();
    unmount();
    const returned = render(<RoadmapView demo server={null} />);
    expect(returned.container.querySelector('.roadmap-featured-topic h2')?.textContent).toBe(
      'Зэрэг ба язгуур',
    );
    expect(screen.queryByRole('region', { name: 'Аялал эхлэхийн өмнө' })).toBeNull();
  });
});

describe('RoadmapView current pin', () => {
  test("the current pin goes where the card's Эхлэх goes; other pins open their card", () => {
    localStorage.clear();
    pushed.length = 0;
    const { container } = render(<RoadmapView demo server={null} />);
    const start = container.querySelector('.roadmap-stop-start a')?.getAttribute('href');
    expect(start).toBe('/roadmap/placement');
    fireEvent.click(screen.getByRole('button', { name: /^1-р зогсоол/ }));
    expect(pushed).toEqual([start as string]);
    fireEvent.click(screen.getByRole('button', { name: /^2-р зогсоол/ }));
    expect(pushed).toHaveLength(1);
    expect(container.querySelector('.roadmap-featured-topic h2')?.textContent).toBe('Алгебрын илэрхийлэл');
  });

  test('coming back from another stop, the first click shows the current card and the second starts', () => {
    localStorage.clear();
    pushed.length = 0;
    const { container } = render(<RoadmapView demo server={null} />);
    const title = () => container.querySelector('.roadmap-featured-topic h2')?.textContent;
    fireEvent.click(screen.getByRole('button', { name: /^2-р зогсоол/ }));
    expect(title()).toBe('Алгебрын илэрхийлэл');
    const current = screen.getByRole('button', { name: /^1-р зогсоол/ });
    fireEvent.click(current);
    expect(pushed).toEqual([]);
    expect(title()).toBe('Зэрэг ба язгуур');
    fireEvent.click(current);
    expect(pushed).toEqual(['/roadmap/placement']);
  });
});

describe('RoadmapMap current-stop hover card', () => {
  test('hidden while the current card is showing, shown while another stop is selected', () => {
    const views = stopViews(sampleState(), true);
    const props = { views, frontierNo: 5, onOpen: () => {}, fullBleed: true } as const;
    const { rerender } = render(<RoadmapMap {...props} selectedNo={null} />);
    const current = screen.getByRole('button', { name: /^5-р зогсоол/ });
    fireEvent.focus(current);
    expect(document.querySelector('.roadmap-float')).toBeNull();
    fireEvent.blur(current);
    rerender(<RoadmapMap {...props} selectedNo={6} />);
    fireEvent.focus(screen.getByRole('button', { name: /^5-р зогсоол/ }));
    expect(document.querySelector('.roadmap-float')?.textContent).toContain(
      views.find((v) => v.stop.no === 5)!.stop.place,
    );
  });
});

describe('RoadmapMap', () => {
  test('every stop is a keyboard-focusable button with a descriptive label', () => {
    const views = stopViews(sampleState(), true);
    render(<RoadmapMap views={views} frontierNo={5} onOpen={() => {}} cluster={false} />);
    const map = screen.getByRole('application');
    const pins = within(map).getAllByRole('button');
    expect(pins).toHaveLength(26);
    expect(
      screen.getByRole('button', { name: '6-р зогсоол, Мөрөн, Шулуун ба шугаман тэгшитгэл, түгжээтэй' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^1-р зогсоол, Өлгий, .*дууссан, 3 од$/ })).toBeTruthy();
  });

  test('home map stays fixed while pins remain clickable', () => {
    const opened: number[] = [];
    const props = {
      views: stopViews(sampleState(), true),
      frontierNo: 5,
      onOpen: (n: number) => opened.push(n),
      fullBleed: true,
    };
    const { container, rerender } = render(<RoadmapMap {...props} />);
    const stage = screen.getByRole('application');
    const layer = container.querySelector<HTMLElement>('.roadmap-layer')!;
    const transform = layer.style.transform;
    expect(screen.getAllByRole('button', { name: /^\d+-р зогсоол, / })).toHaveLength(26);
    expect(screen.queryByRole('button', { name: 'Одоогийн байрлал' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Томруулах' })).toBeNull();
    fireEvent.wheel(stage, { deltaY: -500 });
    fireEvent.keyDown(stage, { key: '+' });
    fireEvent.pointerDown(stage, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerUp(window, { pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: /^5-р зогсоол/ }));
    rerender(<RoadmapMap {...props} selectedNo={5} />);
    expect(layer.style.transform).toBe(transform);
    expect(opened).toEqual([5]);
  });

  test('home topic stays on the current stop while other pins show hover cards', () => {
    const views = stopViews(sampleState(), true);
    const { container } = render(<RoadmapMap views={views} frontierNo={5} onOpen={() => {}} fullBleed />);
    const heading = container.querySelector('.roadmap-featured-topic h2')!;
    const title = views.find((v) => v.stop.no === 5)!.topic.title;
    expect(heading.textContent).toBe(title);
    fireEvent.focus(screen.getByRole('button', { name: /^5-р зогсоол/ }));
    expect(document.querySelector('.roadmap-float')).toBeNull();
    const other = screen.getByRole('button', { name: /^6-р зогсоол/ });
    fireEvent.focus(other);
    expect(document.querySelector('.roadmap-float')?.textContent).toContain(
      views.find((v) => v.stop.no === 6)!.stop.place,
    );
    expect(heading.textContent).toBe(title);
    fireEvent.blur(other);
    expect(document.querySelector('.roadmap-float')).toBeNull();
  });

  test('only the current pin is enlarged and the emphasis follows progress', () => {
    const props = { views: stopViews(sampleState(), true), onOpen: () => {}, fullBleed: true };
    const { container, rerender } = render(<RoadmapMap {...props} frontierNo={1} />);
    const first = screen.getByRole('button', { name: /^1-р зогсоол/ });
    const second = screen.getByRole('button', { name: /^2-р зогсоол/ });
    expect(first.getAttribute('data-current')).toBe('true');
    expect(second.hasAttribute('data-current')).toBe(false);
    rerender(<RoadmapMap {...props} frontierNo={2} />);
    expect(first.hasAttribute('data-current')).toBe(false);
    expect(second.getAttribute('data-current')).toBe('true');
    expect(second.getAttribute('aria-current')).toBe('step');
    expect(container.querySelectorAll('.roadmap-coin[data-current="true"]')).toHaveLength(1);
    rerender(<RoadmapMap {...props} frontierNo={null} />);
    expect(container.querySelectorAll('.roadmap-coin[data-current="true"]')).toHaveLength(0);
  });

  test('zoomed out, crowded pins merge into clusters that zoom in on click', async () => {
    const views = stopViews(sampleState(), true);
    render(<RoadmapMap views={views} frontierNo={null} onOpen={() => {}} />);
    const clusters = screen.getAllByRole('button', { name: /зогсоол: .*Дарж томруулна\.$/ });
    expect(clusters.length).toBeGreaterThan(0);
    // every stop is either its own pin or named in exactly one cluster
    const pins = screen.getAllByRole('button', { name: /^\d+-р зогсоол, / }).length;
    const inClusters = clusters
      .map((c) => Number(/^(\d+) зогсоол/.exec(c.getAttribute('aria-label') ?? '')?.[1]))
      .reduce((a, b) => a + b, 0);
    expect(pins + inClusters).toBe(26);
    expect(clusters.some((c) => c.getAttribute('aria-label')?.includes('Улаанбаатар'))).toBe(true);
    fireEvent.click(clusters[0]);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^\d+-р зогсоол, / })).toHaveLength(26));
  });

  test('clicking a pin opens it; the controls are labelled', () => {
    const opened: number[] = [];
    render(
      <RoadmapMap views={stopViews(sampleState(), true)} frontierNo={5} onOpen={(n) => opened.push(n)} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^5-р зогсоол/ }));
    expect(opened).toEqual([5]);
    for (const name of ['Одоогийн байрлал', 'Томруулах', 'Жижигрүүлэх', 'Бүтэн газрын зураг']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });
});

describe('StopPlayer (demo mode)', () => {
  const pool: Question[] = Array.from({ length: 12 }, (_, i) => ({
    id: `t1-${i}`,
    domain: 'alg',
    skill: 'Linear equations in one variable',
    difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    prompt: `Problem ${i}: pick A`,
    choices: ['$1$', '$2$', '$3$', '$4$'],
    answer: 0,
    explain: 'Тайлбар',
    hint: 'Сэжүүр',
    topicId: 1,
    format: 'mcq',
    pool: 'stop',
    reviewed: true,
  }));

  beforeEach(() => {
    localStorage.clear();
  });

  test('locked until the placement test is taken or skipped', async () => {
    render(
      <StopPlayer no={1} testOut={false} pool={pool} intro={[]} demo server={null} serverHistory={[]} />,
    );
    expect(await screen.findByText('Энэ зогсоол түгжээтэй')).toBeTruthy();
  });

  test('passing stop 1 opens stop 2', async () => {
    saveLocalRoadmap({ ...loadLocalRoadmap(), state: withPlacement(initialState(), skippedResult()) });
    render(
      <StopPlayer no={1} testOut={false} pool={pool} intro={[]} demo server={null} serverHistory={[]} />,
    );

    // skipped placement → «ok» mastery → 8 problems
    for (let n = 1; n <= 8; n++) {
      await screen.findByText(`Бодлого ${n} / 8`, { selector: 'span' });
      fireEvent.click(screen.getByRole('radio', { name: /^A/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
      expect(screen.getByText('Зөв!')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: n < 8 ? 'Дараах' : 'Дүнг харах' }));
    }

    expect(await screen.findByText('Зогсоол давлаа!')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Дараагийн зогсоол: Улаангом' })).toBeTruthy();
    const saved = loadLocalRoadmap();
    expect(saved.state.stops[0]).toMatchObject({ stars: 3, attempts: 1 });
    expect(saved.state.stops[0].completedAt).not.toBeNull();
    expect(saved.xp).toBeGreaterThan(0);
  });

  test('a wrong answer explains and offers Суу with the problem and the answer', async () => {
    saveLocalRoadmap({ ...loadLocalRoadmap(), state: withPlacement(initialState(), skippedResult()) });
    render(
      <StopPlayer no={1} testOut={false} pool={pool} intro={[]} demo server={null} serverHistory={[]} />,
    );
    await screen.findByText('Бодлого 1 / 8', { selector: 'span' });
    fireEvent.click(screen.getByRole('radio', { name: /^B/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
    expect(screen.getByText('Буруу')).toBeTruthy();
    expect(screen.getByText('Тайлбар')).toBeTruthy();
    const ask = screen.getByRole('link', { name: 'Суугаас асуух' });
    await waitFor(() =>
      expect(ask.getAttribute('href')).toMatch(/^\/tutor\?kind=question&id=t1-\d+&chosen=1$/),
    );
  });

  test('«AI багш Суу» opens beside the problem; checking the answer unlocks the full explanation', async () => {
    saveLocalRoadmap({ ...loadLocalRoadmap(), state: withPlacement(initialState(), skippedResult()) });
    render(
      <StopPlayer no={1} testOut={false} pool={pool} intro={[]} demo server={null} serverHistory={[]} />,
    );
    await screen.findByText('Бодлого 1 / 8', { selector: 'span' });
    fireEvent.click(screen.getByRole('button', { name: 'AI багш Суу-г хажууд нээх' }));
    expect(screen.getByRole('complementary', { name: 'AI багш Суу' })).toBeTruthy();
    expect((screen.getByRole('button', { name: /Бүтэн тайлбар/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /^B/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
    expect((screen.getByRole('button', { name: 'Бүтэн тайлбар' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
