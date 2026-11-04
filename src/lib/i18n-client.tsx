'use client';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, getMessages, type Locale, type Messages, makeT, type T } from './i18n';

type TranslationContext = { locale: Locale; messages: Messages; fallback: Messages };
const LocaleContext = createContext<TranslationContext | null>(null);

export function I18nProvider({
  locale = DEFAULT_LOCALE,
  messages,
  children,
}: {
  locale?: Locale;
  /** The server's serialized snapshot keeps initial browser text identical to the HTML. */
  messages?: Messages;
  children: ReactNode;
}) {
  const snapshot = messages ?? getMessages(locale);
  const fallback = locale === DEFAULT_LOCALE ? snapshot : getMessages(DEFAULT_LOCALE);
  const value = useMemo(() => ({ locale, messages: snapshot, fallback }), [locale, snapshot, fallback]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext)?.locale ?? DEFAULT_LOCALE;
}

export function useT(ns?: string): T {
  const context = useContext(LocaleContext);
  const messages = context?.messages ?? getMessages(DEFAULT_LOCALE);
  const fallback = context?.fallback ?? getMessages(DEFAULT_LOCALE);
  return useMemo(() => makeT(messages, ns, fallback), [messages, ns, fallback]);
}
