import { beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => '/roadmap',
}));

const { fireEvent, render, screen, waitFor, within } = await import('@/test/render');
const { loadLocalRoadmap, saveLocalRoadmap } = await import('../lib/local-store');
const { skippedResult } = await import('../lib/placement');
const { sampleState } = await import('../lib/sample');
const { initialState, withPlacement } = await import('../lib/state');
const { stopViews } = await import('../lib/view');
const { RoadmapMap } = await import('./RoadmapMap');
const { StopCard } = await import('./StopCard');
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
    expect(screen.getByText('Нэг хувьсагчтай шугаман тэгшитгэл')).toBeTruthy();
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

describe('RoadmapMap', () => {
  test('every stop is a keyboard-focusable button with a descriptive label', () => {
    const views = stopViews(sampleState(), true);
    render(<RoadmapMap views={views} frontierNo={5} onOpen={() => {}} cluster={false} />);
    const map = screen.getByRole('application');
    const pins = within(map).getAllByRole('button');
    expect(pins).toHaveLength(26);
    expect(
      screen.getByRole('button', { name: '6-р зогсоол, Мөрөн, Шугаман тэнцэтгэл биш, түгжээтэй' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^1-р зогсоол, Өлгий, .*дууссан, 3 од$/ })).toBeTruthy();
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
});
