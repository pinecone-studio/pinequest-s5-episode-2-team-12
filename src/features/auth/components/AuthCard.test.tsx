import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { MotionGlobalConfig } from 'framer-motion';
import { render, screen, userEvent, waitFor } from '@/test/render';
import { createDemoAuth, DEMO_TRIGGERS } from '../lib/demo-auth';
import { AuthCard } from './AuthCard';

// happy-dom's Web Animations reject when cancelled. Skip animations and keep Framer Motion
// off the native (element.animate) path for this file; tests only care about end states.
MotionGlobalConfig.skipAnimations = true;
const nativeAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
beforeAll(() => {
  // biome-ignore lint/performance/noDelete: the property must be absent, not undefined, for Framer's check
  delete (Element.prototype as { animate?: unknown }).animate;
});
afterAll(() => {
  if (nativeAnimate) Object.defineProperty(Element.prototype, 'animate', nativeAnimate);
});

const fast = createDemoAuth({ latencyMs: 0 });

function setup(props: Parameters<typeof AuthCard>[0] = {}) {
  localStorage.clear();
  const user = userEvent.setup();
  const view = render(<AuthCard service={fast} {...props} />);
  return { user, ...view };
}

describe('AuthCard', () => {
  test('opens on sign-in, in Mongolian', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Эргээд тавтай морил' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Нэвтрэх' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Имэйл хаяг')).toBeInTheDocument();
    expect(screen.getByLabelText('Нууц үг')).toHaveAttribute('type', 'password');
  });

  test('empty submit shows required errors and focuses the first field', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Нэвтрэх' }));
    expect(await screen.findByText('Имэйл хаягаа оруулна уу.')).toBeInTheDocument();
    expect(screen.getByText('Нууц үгээ оруулна уу.')).toBeInTheDocument();
    expect(screen.getByLabelText('Имэйл хаяг')).toHaveFocus();
  });

  test('the eye button reveals the password', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Нууц үгийг харуулах' }));
    expect(screen.getByLabelText('Нууц үг')).toHaveAttribute('type', 'text');
  });

  test('a wrong password shows the service error on the password field', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Имэйл хаяг'), 'bat@school.mn');
    await user.type(screen.getByLabelText('Нууц үг'), DEMO_TRIGGERS.wrongPassword);
    await user.click(screen.getByRole('button', { name: 'Нэвтрэх' }));
    expect(await screen.findByText('Имэйл эсвэл нууц үг буруу байна.')).toBeInTheDocument();
  });

  test('a successful sign-in greets the user and redirects to the dashboard', async () => {
    const onRedirect = mock((_href: string) => {});
    const { user } = setup({ onRedirect });
    await user.type(screen.getByLabelText('Имэйл хаяг'), 'bat.erdene@school.mn');
    await user.type(screen.getByLabelText('Нууц үг'), 'anything');
    await user.click(screen.getByRole('button', { name: 'Нэвтрэх' }));
    expect(await screen.findByText('Эргээд тавтай морил, Bat')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Одоо очих/ }));
    expect(onRedirect).toHaveBeenCalledWith('/dashboard');
  });

  test('remember me saves the email after signing in', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Имэйл хаяг'), 'saraa@school.mn');
    await user.type(screen.getByLabelText('Нууц үг'), 'x');
    await user.click(screen.getByRole('button', { name: 'Нэвтрэх' }));
    await screen.findByText(/Эргээд тавтай морил, Saraa/);
    expect(localStorage.getItem('suprep-remembered-email')).toBe('saraa@school.mn');
  });

  test('sign-up asks for a name, rates the password and requires the terms', async () => {
    const { user } = setup({ defaultView: 'signup' });
    expect(screen.getByRole('heading', { level: 1, name: 'Бүртгэл үүсгэх' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Нэр'), 'Бат');
    await user.type(screen.getByLabelText('Имэйл хаяг'), 'bat@school.mn');
    await user.type(screen.getByLabelText('Нууц үг'), 'Abcdef1!');
    expect(await screen.findByText('Хүчтэй')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Бүртгэл үүсгэх' }));
    expect(await screen.findByText('Үргэлжлүүлэхийн тулд нөхцөлийг зөвшөөрнө үү.')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Үйлчилгээний нөхцөл/));
    await user.click(screen.getByRole('button', { name: 'Бүртгэл үүсгэх' }));
    expect(await screen.findByText('Тавтай морил, Бат')).toBeInTheDocument();
  });

  test('a taken email is flagged on sign-up', async () => {
    const { user } = setup({ defaultView: 'signup' });
    await user.type(screen.getByLabelText('Нэр'), 'Бат');
    await user.type(screen.getByLabelText('Имэйл хаяг'), DEMO_TRIGGERS.takenEmail);
    await user.type(screen.getByLabelText('Нууц үг'), 'Abcdef1!');
    await user.click(screen.getByLabelText(/Үйлчилгээний нөхцөл/));
    await user.click(screen.getByRole('button', { name: 'Бүртгэл үүсгэх' }));
    expect(await screen.findByText('Энэ имэйлээр бүртгэл аль хэдийн үүссэн байна.')).toBeInTheDocument();
  });

  test('forgot password sends a reset link', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Нууц үгээ мартсан?' }));
    expect(await screen.findByRole('heading', { name: 'Нууц үгээ сэргээх' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Имэйл хаяг'), 'bat@school.mn');
    await user.click(screen.getByRole('button', { name: 'Холбоос илгээх' }));
    expect(await screen.findByText('Имэйлээ шалгана уу')).toBeInTheDocument();
  });

  test('social sign-in succeeds', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'GitHub ашиглан үргэлжлүүлэх' }));
    await waitFor(() => expect(screen.getByText('Эргээд тавтай морил, Demo')).toBeInTheDocument());
  });

  test('renders in English', () => {
    render(<AuthCard service={fast} />, { locale: 'en' });
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
  });
});
