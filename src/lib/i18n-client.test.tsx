import { expect, test } from 'bun:test';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, render, screen } from '@/test/render';
import { I18nProvider, useT } from './i18n-client';

function Label() {
  const t = useT('flashcards');
  return <p>{t('stats.due')}</p>;
}

test('translation snapshot changes update consumers without changing locale', () => {
  const { rerender } = render(
    <I18nProvider messages={{ flashcards: { stats: { due: 'Old snapshot' } } }}>
      <Label />
    </I18nProvider>,
  );
  expect(screen.getByText('Old snapshot')).toBeTruthy();
  rerender(
    <I18nProvider messages={{ flashcards: { stats: { due: 'Дахин давтах' } } }}>
      <Label />
    </I18nProvider>,
  );
  expect(screen.getByText('Дахин давтах')).toBeTruthy();
});

test('server and hydration use the supplied snapshot rather than independent bundled translations', async () => {
  const messages = { flashcards: { stats: { due: 'Server snapshot label' } } };
  const element = (
    <I18nProvider messages={messages}>
      <Label />
    </I18nProvider>
  );
  const container = document.createElement('div');
  container.innerHTML = renderToString(element);
  document.body.appendChild(container);
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, element, {
        onRecoverableError: (error) => {
          errors.push(error);
        },
      });
    });
    expect(container.textContent).toBe('Server snapshot label');
    expect(errors).toEqual([]);
  } finally {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
  }
});
