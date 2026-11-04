import { expect, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@/test/render';
import { TutorGraph } from './TutorGraph';

test('the adjacent graph loads, plots examples, clears, and destroys its calculator on unmount', async () => {
  const original = window.Desmos;
  const expressions: Record<string, unknown>[] = [];
  let cleared = 0;
  let destroyed = 0;
  window.Desmos = {
    GraphingCalculator: () => ({
      setBlank() {
        cleared++;
      },
      setExpression(expression) {
        expressions.push(expression);
      },
      setMathBounds() {},
      destroy() {
        destroyed++;
      },
    }),
  };
  try {
    const { unmount } = render(<TutorGraph />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'y = 2x + 1' }).hasAttribute('disabled')).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'y = 2x + 1' }));
    expect(expressions[0]).toMatchObject({ latex: 'y=2x+1' });
    fireEvent.click(screen.getByRole('button', { name: 'y = x²' }));
    expect(expressions[1]).toMatchObject({ latex: 'y=x^2' });
    expect(expressions[1].color).not.toBe(expressions[0].color);
    fireEvent.click(screen.getByRole('button', { name: 'Цэвэрлэх' }));
    expect(cleared).toBe(1);
    unmount();
    expect(destroyed).toBe(1);
  } finally {
    window.Desmos = original;
  }
});
