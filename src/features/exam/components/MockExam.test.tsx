import { describe, expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@/test/render';

const startMock = mock(async (_input: { seen?: string[]; formId?: string }) => ({
  ok: false as const,
  reason: 'test',
}));
mock.module('../mock-actions', () => ({
  startMock,
  submitModule: async () => ({ ok: false, reason: 'test' }),
  beginModule2: async () => ({ ok: false, reason: 'test' }),
  viewMock: async () => ({ ok: false, reason: 'test' }),
}));
mock.module('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }));

const { MockExam } = await import('./MockExam');

describe('MockExam intro', () => {
  test('lists the practice tests with their best score and starts the chosen one', async () => {
    render(
      <MockExam
        demo={false}
        forms={[
          { id: 'pt1', no: 1 },
          { id: 'pt2', no: 2 },
        ]}
        best={{ pt1: 640 }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Practice Test 1' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Practice Test 2' })).toBeTruthy();
    expect(screen.getByText('Хамгийн өндөр: 640')).toBeTruthy();
    expect(screen.getByText('Өгөөгүй')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Эхлэх' }));
    await Promise.resolve();
    expect(startMock.mock.calls.at(-1)?.[0].formId).toBe('pt2');
  });

  test('the random mock still starts without a practice test', async () => {
    render(<MockExam demo={false} forms={[]} />);
    expect(screen.queryByText('Practice тестүүд')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mock тест эхлэх' }));
    await Promise.resolve();
    expect(startMock.mock.calls.at(-1)?.[0].formId).toBeUndefined();
  });
});
