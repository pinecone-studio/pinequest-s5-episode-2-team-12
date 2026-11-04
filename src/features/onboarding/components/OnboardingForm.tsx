'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { writeLocalSettings } from '@/features/settings/local';
import { safeNext } from '@/lib/auth-gate';
import { cn } from '@/lib/cn';
import { useLocale, useT } from '@/lib/i18n-client';
import { SAT_DATES } from '@/mocks/meta';
import { completeOnboarding } from '../actions';
import { type OnboardingInput, OnboardingSchema } from '../lib/schema';

const STEPS = ['about', 'goals', 'study', 'review'] as const;
const field =
  'h-12 w-full rounded-2xl border border-line bg-paper-2 px-4 text-ink focus:outline-2 focus:outline-leaf';

function Choices<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 text-sm font-bold text-ink">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm transition-colors',
            value === option.value ? 'border-leaf bg-sage text-ink' : 'border-line bg-paper text-ink-2',
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="size-4 accent-(--c-leaf)"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

export function OnboardingForm({ demo, today, next = '/' }: { demo: boolean; today: string; next?: string }) {
  const t = useT('onboarding');
  const locale = useLocale();
  const upcomingDates = SAT_DATES.filter(({ d }) => d >= today);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<OnboardingInput>({
    name: '',
    satExp: 'none',
    lastMathScore: null,
    target: 700,
    examDate: '',
    confidence: 3,
    desmos: 'never',
    studyMinutes: 30,
    start: 'foundations',
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: each step change moves focus to its heading
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const patch = (input: Partial<OnboardingInput>) => {
    setData((old) => ({ ...old, ...input }));
    setError('');
  };
  const advance = () => {
    if (!OnboardingSchema.safeParse(data).success) {
      setError(t('invalid'));
      return;
    }
    setError('');
    setStep((value) => Math.min(3, value + 1));
  };
  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await completeOnboarding(data);
      if (!result.ok) {
        setError(t(result.reason));
        return;
      }
      if (result.demo) {
        localStorage.setItem('suprep:onboarding:v1', JSON.stringify({ ...data, onboarded: true }));
        writeLocalSettings({ name: data.name.trim(), examDate: data.examDate });
      }
      const destination = safeNext(next);
      router.replace(
        destination.startsWith('/onboarding') || destination.startsWith('/login') ? '/' : destination,
      );
      router.refresh();
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  };
  const options = <T extends string>(prefix: string, values: T[]) =>
    values.map((value) => ({ value, label: t(`${prefix}.${value}`) }));
  return (
    <div className="grid gap-6">
      <div className="onboarding-progress grid gap-3">
        <p className="eyebrow">{t('step', { n: step + 1, total: 4 })}</p>
        <progress
          value={step + 1}
          max={4}
          aria-label={t('step', { n: step + 1, total: 4 })}
          className="h-2 w-full overflow-hidden rounded-full accent-(--c-lime)"
        />
        <ol className="grid grid-cols-4 gap-2 text-[11px] sm:text-xs text-ink-3">
          {STEPS.map((key, index) => (
            <li
              key={key}
              aria-current={index === step ? 'step' : undefined}
              className={cn(index === step && 'font-bold text-leaf-2')}
            >
              {t(`steps.${key}`)}
            </li>
          ))}
        </ol>
      </div>
      {demo && (
        <p className="rounded-2xl bg-amber-soft p-3 text-xs leading-relaxed text-amber">{t('demo')}</p>
      )}
      <section className="soft-card grid gap-6 p-5 sm:p-8">
        <header className="grid gap-2">
          <h1 ref={heading} tabIndex={-1} className="font-display text-2xl font-bold text-ink outline-none">
            {t(`steps.${STEPS[step]}`)}
          </h1>
          <p className="text-sm leading-relaxed text-ink-2">{t(step === 3 ? 'reviewLead' : 'lead')}</p>
        </header>
        {step === 0 && (
          <>
            <label className="grid gap-2 text-sm font-bold text-ink">
              {t('name')}
              <input
                value={data.name}
                autoComplete="nickname"
                maxLength={40}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={t('namePlaceholder')}
                className={field}
              />
            </label>
            <Choices
              label={t('experience')}
              name="satExp"
              value={data.satExp}
              options={options<OnboardingInput['satExp']>('sat', ['none', 'some', 'taken'])}
              onChange={(satExp) => patch({ satExp, lastMathScore: null })}
            />
            {data.satExp === 'taken' && (
              <label className="grid gap-2 text-sm font-bold text-ink">
                {t('previous')}
                <input
                  type="number"
                  min={200}
                  max={800}
                  step={10}
                  value={data.lastMathScore ?? ''}
                  onChange={(e) => patch({ lastMathScore: e.target.value ? Number(e.target.value) : null })}
                  className={field}
                />
                <span className="text-xs font-normal text-ink-3">{t('previousHint')}</span>
              </label>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <label className="grid gap-2 text-sm font-bold text-ink">
              {t('target')}
              <input
                type="number"
                min={200}
                max={800}
                step={10}
                value={data.target}
                onChange={(e) => patch({ target: Number(e.target.value) })}
                className={field}
              />
              <span className="text-xs font-normal leading-relaxed text-ink-3">{t('mathHint')}</span>
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              {t('examDate')}
              <select
                value={data.examDate}
                onChange={(e) => patch({ examDate: e.target.value })}
                className={field}
              >
                <option value="">{t('unknownDate')}</option>
                {upcomingDates.map(({ d }) => (
                  <option key={d} value={d}>
                    {dateFormatter.format(new Date(`${d}T00:00:00Z`))}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-pressed={!data.examDate}
              onClick={() => patch({ examDate: '' })}
              className="justify-self-start text-xs font-semibold text-leaf-2 underline underline-offset-4"
            >
              {t('unknownDate')}
            </button>
            <label className="grid gap-3 text-sm font-bold text-ink">
              {t('confidence')}
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={data.confidence}
                onChange={(e) => patch({ confidence: Number(e.target.value) })}
                className="w-full accent-(--c-leaf)"
              />
              <span className="flex justify-between gap-3 text-xs font-normal text-ink-3">
                <span>{t('confidenceLow')}</span>
                <span className="font-bold text-ink">{data.confidence} / 5</span>
                <span>{t('confidenceHigh')}</span>
              </span>
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <Choices
              label={t('desmos')}
              name="desmos"
              value={data.desmos}
              options={options<OnboardingInput['desmos']>('desmosOptions', ['never', 'little', 'often'])}
              onChange={(desmos) => patch({ desmos })}
            />
            <label className="grid gap-2 text-sm font-bold text-ink">
              {t('minutes')}
              <select
                value={data.studyMinutes}
                onChange={(e) =>
                  patch({ studyMinutes: Number(e.target.value) as OnboardingInput['studyMinutes'] })
                }
                className={field}
              >
                {[15, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>
                    {t('minuteOption', { n })}
                  </option>
                ))}
              </select>
            </label>
            <Choices
              label={t('focus')}
              name="start"
              value={data.start}
              options={options<OnboardingInput['start']>('focusOptions', [
                'foundations',
                'english',
                'desmos',
              ])}
              onChange={(start) => patch({ start })}
            />
          </>
        )}
        {step === 3 && (
          <dl className="divide-y divide-line rounded-2xl border border-line bg-paper-2 px-4">
            {[
              [t('name'), data.name],
              [t('experience'), t(`sat.${data.satExp}`)],
              ...(data.lastMathScore !== null ? [[t('previous'), String(data.lastMathScore)]] : []),
              [t('target'), `${data.target} / 800`],
              [t('examDate'), data.examDate || t('noDate')],
              [t('confidence'), `${data.confidence} / 5`],
              [t('desmos'), t(`desmosOptions.${data.desmos}`)],
              [t('minutes'), t('minuteOption', { n: data.studyMinutes })],
              [t('focus'), t(`focusOptions.${data.start}`)],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
                <dt className="text-xs leading-relaxed text-ink-3">{label}</dt>
                <dd className="text-sm font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <Button
            variant="ghost"
            disabled={step === 0 || busy}
            onClick={() => {
              setError('');
              setStep((value) => Math.max(0, value - 1));
            }}
          >
            {t('back')}
          </Button>
          <Button disabled={busy} onClick={step === 3 ? finish : advance}>
            {busy ? t('saving') : t(step === 3 ? 'finish' : 'next')}
          </Button>
        </footer>
      </section>
    </div>
  );
}
