import { expect, mock, test } from 'bun:test';

mock.module('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => '/shop',
}));

const { fireEvent, render, screen } = await import('@/test/render');
const { ShopView } = await import('./ShopView');

test('the shop shows the gem balance and lets a shopper try on an accessory', () => {
  localStorage.clear();
  render(<ShopView demo wallet={null} name="Суу" />);

  expect(screen.getByTestId('gem-balance').textContent).toBe('0');
  const scarf = screen.getByRole('button', { name: /Ороолт хэрэгслийг Суугийн хувцастай өмсгөж үзэх/ });
  expect(scarf.getAttribute('aria-pressed')).toBe('false');

  fireEvent.click(scarf);
  expect(scarf.getAttribute('aria-pressed')).toBe('true');
});
