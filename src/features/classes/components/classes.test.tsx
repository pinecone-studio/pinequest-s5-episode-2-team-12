import { expect, test } from 'bun:test';
import { act, fireEvent, render, screen, within } from '@/test/render';
import { demoRows } from '../lib/report';
import { DEMO_CLASS } from '../queries';
import { ClassesView } from './ClassesView';
import { ClassReport } from './ClassReport';

const settled = () => act(async () => {});

test('teacher creates a class and sees its code; bad codes are explained before any call', async () => {
  const calls: string[] = [];
  const actions = {
    createClass: async (name: string) => {
      calls.push(`create:${name}`);
      return { ok: true as const, id: 'c1', code: 'ABC234' };
    },
    joinClass: async (code: string) => {
      calls.push(`join:${code}`);
      return { ok: false as const, reason: 'not_found' };
    },
  };
  render(<ClassesView classes={[DEMO_CLASS]} actions={actions} />);
  expect(screen.getByRole('link', { name: DEMO_CLASS.name })).toBeTruthy();
  expect(screen.getByText('SUU7QK')).toBeTruthy();

  const create = screen.getByRole('form', { name: 'Анги үүсгэх' });
  fireEvent.change(within(create).getByRole('textbox'), { target: { value: '11а' } });
  fireEvent.click(within(create).getByRole('button', { name: 'Үүсгэх' }));
  await settled();
  expect(calls).toEqual(['create:11а']);
  expect(screen.getByRole('status').textContent).toContain('ABC234');

  const join = screen.getByRole('form', { name: 'Ангид нэгдэх' });
  fireEvent.change(within(join).getByRole('textbox'), { target: { value: 'zzzzzz' } });
  fireEvent.click(within(join).getByRole('button', { name: 'Нэгдэх' }));
  await settled();
  expect(screen.getByRole('status').textContent).toBe('Ийм кодтой анги олдсонгүй.');
});

test('report: summary cards, struggling student first, weak topics named', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  render(<ClassReport cls={DEMO_CLASS} rows={demoRows(now)} now={now} />);
  const stats = screen.getByRole('region', { name: 'Ангийн дүн' });
  expect(stats.textContent).toContain('Тусламж хэрэгтэй2');
  const rows = screen.getAllByRole('row').slice(1);
  expect(within(rows[0] as HTMLElement).getByRole('rowheader').textContent).toContain('Сараа');
  expect(rows[0]?.textContent).toContain('Тусламж хэрэгтэй');
  expect(screen.getByText(/Ангиараа сул сэдэв/).parentElement?.textContent).toContain(
    'Тэнцэтгэл биш (3 сурагч)',
  );
});

test('report: an empty class tells the teacher to share the code', () => {
  render(<ClassReport cls={DEMO_CLASS} rows={[]} />);
  expect(screen.getByText(/Кодоо сурагчдадаа өгөөрэй/)).toBeTruthy();
});
