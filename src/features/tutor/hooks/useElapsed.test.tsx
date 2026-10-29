import { expect, test } from 'bun:test';
import { render, screen, waitFor } from '@/test/render';
import { useElapsed, waitLabel } from './useElapsed';

function Probe({ on }: { on: boolean }) {
  return <span data-testid="s">{useElapsed(on)}</span>;
}

test('counts seconds while active, back to 0 when not', async () => {
  const { rerender } = render(<Probe on />);
  await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('1'), { timeout: 2500 });
  rerender(<Probe on={false} />);
  await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('0'));
});

test('waitLabel shows only waits worth noticing', () => {
  expect(waitLabel(2, 'сек')).toBe('');
  expect(waitLabel(12, 'сек')).toBe(' 12 сек');
});
