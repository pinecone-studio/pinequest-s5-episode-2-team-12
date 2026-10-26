'use client';
import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { Switch } from '@/components/ui/Switch';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { toast } from '@/components/ui/toast';
import { signOut } from '@/features/auth/actions';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { TZ } from '@/lib/time';
import type { SettingsPatch } from '../actions';
import { type StudentSettings, useStudentSettings } from '../use-settings';

export type AccountInfo = { kind: 'demo' } | { kind: 'anonymous' } | { kind: 'user'; email: string | null };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="soft-card grid gap-4 p-5">
      <h2 className="font-bold text-[17px] text-ink">{title}</h2>
      {children}
    </section>
  );
}

const ZONES = [TZ, 'Asia/Hovd'];
const field = 'h-11 rounded-2xl border border-line bg-paper-2 px-3 text-[14px] text-ink';

export function SettingsForm({
  initial,
  demo,
  account,
}: {
  initial: StudentSettings;
  demo: boolean;
  account: AccountInfo;
}) {
  const t = useT('settings');
  const ta = useT('auth');
  const [settings, save] = useStudentSettings(initial, demo);
  const [device, setDevice] = useState<string | null>(null);
  useEffect(() => setDevice(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  const zones = [...ZONES, ...(device && !ZONES.includes(device) ? [device] : [])];
  if (!zones.includes(settings.tz)) zones.push(settings.tz);

  const update = async (patch: SettingsPatch) => {
    const r = await save(patch);
    toast(r.ok ? t('saved') : t('failed'));
  };

  return (
    <div className="grid gap-4">
      <Section title={t('appearance.title')}>
        <ThemeToggle className="w-full max-w-[420px] [&>button]:flex-1" />
      </Section>

      <Section title={t('exam.title')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
            {t('exam.date')}
            <input
              type="date"
              value={settings.examDate}
              onChange={(e) => e.target.value && update({ examDate: e.target.value })}
              className={field}
            />
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold text-ink-2">
            {t('exam.tz')}
            <select value={settings.tz} onChange={(e) => update({ tz: e.target.value })} className={field}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z === TZ || z === 'Asia/Hovd' ? t(`exam.zones.${z}`) : t('exam.zones.device', { tz: z })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-[13px] text-ink-3">{t('exam.tzHint')}</p>
      </Section>

      <Section title={t('privacy.title')}>
        <Switch
          checked={settings.hidePublic}
          onChange={(v) => update({ hidePublic: v })}
          label={t('privacy.hidePublic')}
        />
        <Switch
          checked={settings.friendsOnly}
          onChange={(v) => update({ friendsOnly: v })}
          label={t('privacy.friendsOnly')}
        />
        <p className="text-[13px] text-ink-3">{t('privacy.note')}</p>
      </Section>

      <Section title={t('language.title')}>
        <div role="radiogroup" aria-label={t('language.title')} className="flex flex-wrap gap-2">
          <button
            type="button"
            role="radio"
            aria-checked="true"
            className="h-10 px-4 rounded-xl border border-leaf bg-sage font-semibold text-leaf-2"
          >
            {t('language.mn')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked="false"
            disabled
            className="h-10 px-4 rounded-xl border border-line text-ink-3 disabled:opacity-60"
          >
            {t('language.en')}
          </button>
        </div>
      </Section>

      <Section title={t('account.title')}>
        <p className="text-[14px] text-ink-2">
          {account.kind === 'user'
            ? t('account.signedIn', { email: account.email ?? '—' })
            : account.kind === 'anonymous'
              ? t('account.anonymous')
              : t('account.demo')}
        </p>
        <div className="flex flex-wrap gap-2">
          {account.kind !== 'user' && (
            <Link
              href={routes.login()}
              className="inline-flex h-11 items-center rounded-2xl bg-leaf px-5 font-bold text-[14px] text-[var(--c-on-leaf)]"
            >
              {t('account.login')}
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-2xl border border-line px-5 font-bold text-[14px] text-ink-2 hover:border-danger hover:text-danger"
            >
              {ta('signOut')}
            </button>
          </form>
        </div>
      </Section>
    </div>
  );
}
