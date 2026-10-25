import { describe, expect, mock, test } from 'bun:test';

mock.module('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => '/',
}));

const { fireEvent, render, screen, waitFor, within } = await import('@/test/render');
const { sampleState } = await import('../lib/sample');
const { stopViews } = await import('../lib/view');
const { StopPanel } = await import('./StopPanel');

const state = sampleState(); // stops 1–4 done, 5 current, the rest locked
const views = stopViews(state, true);
const at = (no: number) => views.find((v) => v.stop.no === no)!;

function renderPanel(no: number, extra: { onMove?: (n: number) => void; onClose?: () => void } = {}) {
  return render(
    <StopPanel
      v={at(no)}
      views={views}
      state={state}
      open
      demo
      history={[
        { qid: 'x1', topicId: 5, correct: false, hintUsed: false, timeMs: 1000, at: 1 },
        { qid: 'x2', topicId: 5, correct: false, hintUsed: false, timeMs: 1000, at: 2 },
      ]}
      onClose={extra.onClose ?? (() => {})}
      onMove={extra.onMove ?? (() => {})}
    />,
  );
}

describe('StopPanel', () => {
  test('current stop: header, place, topic, inside, for you, related, actions', async () => {
    renderPanel(5);
    const dialog = screen.getByRole('dialog', { name: '5-р зогсоол, Улиастай' });
    expect(within(dialog).getByRole('heading', { name: 'Улиастай' })).toBeTruthy();
    expect(within(dialog).getByText('Завхан')).toBeTruthy();
    expect(within(dialog).getByText('одоогийн зогсоол')).toBeTruthy();
    await waitFor(() => expect(within(dialog).getByText(/Манжийн үеийн жанжны/)).toBeTruthy());
    expect(
      within(dialog).getByText('Systems of two linear equations in two variables', { exact: false }),
    ).toBeTruthy();
    expect(within(dialog).getByText('Гол томьёо')).toBeTruthy();
    expect(within(dialog).getByText('Жишээ бодлого')).toBeTruthy();
    expect(within(dialog).getByText('Энэ сэдвээр 2 асуултад алдсан')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Үргэлжлүүлэх' }).getAttribute('href')).toBe(
      '/roadmap/stop/5',
    );
    expect(within(dialog).getByRole('link', { name: 'Товч хичээл үзэх' }).getAttribute('href')).toBe(
      '/roadmap/stop/5?intro=1',
    );
    expect(within(dialog).getByRole('link', { name: 'Суугаас асуух' }).getAttribute('href')).toBe(
      '/tutor?kind=topic&id=5',
    );
  });

  test('locked stop: what unlocks it, no start button, preview opens the content', async () => {
    renderPanel(9);
    const dialog = screen.getByRole('dialog', { name: '9-р зогсоол, Хархорин' });
    await waitFor(() => expect(within(dialog).getByText(/Их Монгол Улсын эртний нийслэл/)).toBeTruthy());
    expect(within(dialog).getByText('Эхлээд 5-р зогсоол Улиастай-ийг дуусгавал нээгдэнэ.')).toBeTruthy();
    expect(within(dialog).queryByRole('link', { name: /Эхлэх|Үргэлжлүүлэх/ })).toBeNull();
    expect(within(dialog).queryByText('Гол томьёо')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Урьдчилж харах' }));
    expect(within(dialog).getByText('Гол томьёо')).toBeTruthy();
  });

  test('← / → move between stops and Esc closes', () => {
    const moves: number[] = [];
    let closed = 0;
    renderPanel(5, { onMove: (n) => moves.push(n), onClose: () => closed++ });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(moves).toEqual([6, 4]);
    expect(closed).toBe(1);
  });
});
