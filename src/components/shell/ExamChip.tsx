'use client';
// «SAT хүртэл: 40 өдөр». Tap → days/hours/minutes and the test-date picker. Counts to 00:00 of the test day in
// the student's time zone (lib/time.ts).
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { type StudentSettings, useStudentSettings } from '@/features/settings/use-settings';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { countdown, DAY_MS, dayKey, zonedMidnight } from '@/lib/time';
import { SAT_DATES } from '@/mocks/meta';
import { Icon } from './icons';

export function ExamChip({ initial, demo }: { initial: StudentSettings; demo: boolean }) {
  const t = useT('common');
  const [settings, save] = useStudentSettings(initial, demo);
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const left = now === null ? null : countdown(settings.examDate, now, settings.tz);
  const isToday = now !== null && !left && now < zonedMidnight(settings.examDate, settings.tz) + DAY_MS;
  const label =
    now === null
      ? t('shell.exam.chip', { n: '··' })
      : left
        ? t('shell.exam.chip', { n: left.d })
        : isToday
          ? t('shell.exam.chipToday')
          : t('shell.exam.chipNone');
  const today = now === null ? '' : dayKey(now);
  const upcoming = SAT_DATES.filter((d) => d.d > today);

  const pick = async (date: string) => {
    if (!date) return;
    const r = await save({ examDate: date });
    if (r.ok) {
      setCustom(false);
      toast(t('shell.exam.saved'));
    }
  };

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-10 px-3.5 rounded-full bg-paper/90 backdrop-blur border border-line text-[13.5px] font-bold text-ink shadow-[0_6px_18px_-12px_rgba(12,40,22,.5)] hover:border-leaf tnum"
      >
        <Icon name="mock" size={17} className="text-leaf-2" />
        {label}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('shell.exam.title')}
          className="absolute right-0 top-12 z-50 w-[min(320px,calc(100vw-32px))] card p-4 grid gap-4 shadow-pop sheet-in"
        >
          <div className="grid gap-2">
            <h2 className="font-bold text-ink">{t('shell.exam.title')}</h2>
            {left ? (
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    [left.d, 'days'],
                    [left.h, 'hrs'],
                    [left.m, 'min'],
                  ] as const
                ).map(([v, k]) => (
                  <div key={k} className="rounded-2xl bg-paper-2 py-2.5 grid justify-items-center">
                    <span className="font-display font-bold text-[22px] leading-none text-ink tnum">{v}</span>
                    <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
                      {t(`shell.exam.${k}`)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              !isToday && <p className="text-[13px] text-ink-2">{t('shell.exam.passed')}</p>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">
              {t('shell.exam.official')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {upcoming.map((d) => (
                <button
                  key={d.d}
                  type="button"
                  aria-pressed={settings.examDate === d.d}
                  onClick={() => pick(d.d)}
                  className={cn(
                    'h-9 px-3 rounded-xl border text-[13px] font-semibold tnum',
                    settings.examDate === d.d
                      ? 'border-leaf bg-sage text-leaf-2'
                      : 'border-line bg-paper-2 text-ink-2 hover:border-leaf',
                  )}
                >
                  {d.d.replaceAll('-', '.')}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={custom}
                onClick={() => setCustom((v) => !v)}
                className="h-9 px-3 rounded-xl border border-dashed border-line-2 text-[13px] font-semibold text-ink-2"
              >
                {t('shell.exam.custom')}
              </button>
            </div>
          </fieldset>

          {custom && (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                pick(String(new FormData(e.currentTarget).get('date') ?? ''));
              }}
            >
              <input
                name="date"
                type="date"
                min={today}
                defaultValue={settings.examDate}
                aria-label={t('shell.exam.date')}
                className="h-10 flex-1 min-w-0 px-2 rounded-xl border border-line bg-paper-2 text-[14px]"
              />
              <button
                type="submit"
                className="h-10 px-3 rounded-xl bg-leaf text-[var(--c-on-leaf)] text-[13px] font-bold"
              >
                {t('shell.exam.save')}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
