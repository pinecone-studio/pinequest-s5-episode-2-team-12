import { expect, test } from 'bun:test';
import { act, fireEvent, render, screen } from '@/test/render';
import { FloatingTools } from './FloatingTools';

const settled = () => act(async () => {});

test('Desmos sits above Суу AI; each window opens, moves with arrow keys and keeps its state when hidden', () => {
  render(<FloatingTools />);
  const [desmosButton, suuButton] = [
    screen.getByRole('button', { name: 'Desmos-ийг хажууд нээх' }),
    screen.getByRole('button', { name: 'Суу AI-тай ярилцах' }),
  ];
  expect(desmosButton.compareDocumentPosition(suuButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole('region')).toBeNull();

  fireEvent.click(desmosButton);
  const desmos = screen.getByRole('region', { name: 'Desmos тооцоолуур' });
  const before = Number.parseFloat(desmos.style.top);
  fireEvent.keyDown(screen.getByRole('button', { name: /Зөөх.*Desmos/ }), { key: 'ArrowDown' });
  expect(Number.parseFloat(desmos.style.top)).toBe(before + 24);
  fireEvent.click(screen.getAllByRole('button', { name: 'Desmos-ийг хаах' })[1]);
  expect(desmos.hidden).toBe(true);
  expect(desmos.isConnected).toBe(true);

  fireEvent.click(suuButton);
  const suu = screen.getByRole('region', { name: 'Суу AI' });
  expect(suu.hidden).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Суу AI цонхыг хаах' }));
  expect(suu.hidden).toBe(true);
});

test('the Суу window chats through the tutor API and retries a failed reply', async () => {
  const sent: unknown[] = [];
  let fail = true;
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    if (fail) return new Response('nope', { status: 500 });
    return Response.json({ text: 'x = 5 гэж гарна.', model: 'gemini' });
  }) as unknown as typeof fetch;
  render(<FloatingTools fetchImpl={fetchImpl} />);
  fireEvent.click(screen.getByRole('button', { name: 'Суу AI-тай ярилцах' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Суу-д асуух' }), { target: { value: '2x = 10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Илгээх' }));
  await settled();
  expect(sent[0]).toMatchObject({ mode: 'explain', message: '2x = 10', raw: true });
  expect(screen.getByText('2x = 10')).toBeTruthy();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Дахин оролдох' }));
  await settled();
  expect(screen.getByText('x = 5 гэж гарна.')).toBeTruthy();
  expect(sent).toHaveLength(2);
});
