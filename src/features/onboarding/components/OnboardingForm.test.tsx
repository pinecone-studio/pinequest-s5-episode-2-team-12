import { expect, mock, test } from 'bun:test';

const replace = mock(() => {});
const save = mock(async () => ({ ok: true, demo: true }));
// Bun keeps module mocks across test files, so mock everything other files' components import from here too.
mock.module('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: () => {}, push: () => {}, back: () => {} }),
  usePathname: () => '/onboarding',
}));
mock.module('../actions', () => ({ completeOnboarding: save }));
const { render, screen, fireEvent, waitFor } = await import('@/test/render');
const { OnboardingForm } = await import('./OnboardingForm');

test('a new member can review, go back, and finish the four-step setup', async () => {
  localStorage.clear();
  render(<OnboardingForm demo today="2026-10-26" next="/profile" />);
  fireEvent.click(screen.getByRole('button', { name: 'Үргэлжлүүлэх' }));
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: 'Таныг хэн гэж дуудах вэ?' }), {
    target: { value: 'Saraa' },
  });
  fireEvent.click(screen.getByRole('radio', { name: 'Албан ёсны Digital SAT өгсөн' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /Өмнөх SAT Math оноо/ }), {
    target: { value: '650' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Үргэлжлүүлэх' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: /зорилтот оноо/ }), { target: { value: '750' } });
  fireEvent.click(screen.getByRole('button', { name: 'Үргэлжлүүлэх' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Бага зэрэг мэднэ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Буцах' }));
  expect((screen.getByRole('spinbutton', { name: /зорилтот оноо/ }) as HTMLInputElement).value).toBe('750');
  fireEvent.click(screen.getByRole('button', { name: 'Үргэлжлүүлэх' }));
  fireEvent.click(screen.getByRole('button', { name: 'Үргэлжлүүлэх' }));
  expect(screen.getByText('Saraa')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Хадгалаад аяллаа эхлүүлэх' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile'));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Saraa', target: 750, lastMathScore: 650, satExp: 'taken' }),
  );
  expect(JSON.parse(localStorage.getItem('suprep:onboarding:v1') ?? '{}').onboarded).toBe(true);
});
