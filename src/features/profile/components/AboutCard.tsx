'use client';
// /profile «Миний мэдээлэл»: the answers from onboarding (SAT experience, scores, test date, confidence, Desmos,
// study time, where to start), shown and editable. Labels come from the onboarding messages, so the question
// reads the same here as when the student first answered it.
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import { saveSettings, type SettingsPatch } from '@/features/settings/actions';
import { writeLocalSettings } from '@/features/settings/local';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import type { Profile } from '@/types';

export type AboutMe = Pick<
  Profile,
  'satExp' | 'lastMathScore' | 'target' | 'examDate' | 'confidence' | 'desmos' | 'studyMinutes' | 'start'
>;

const SAT_EXP = ['none', 'some', 'taken'] as const;
const DESMOS = ['never', 'little', 'often'] as const;
const MINUTES = [15, 30, 45, 60] as const;
const START = ['foundations', 'english', 'desmos'] as const;

const field = 'h-11 w-full rounded-2xl border border-line bg-paper-2 px-3 text-[14px] text-ink';
const label = 'grid gap-1.5 text-[13px] font-semibold text-ink-2';

/** 200–800 in steps of 10, or null when the box is empty / not a valid score. */
function score(v: string): number | null {
  const n = Number(v);
  return v.trim() && Number.isInteger(n) && n >= 200 && n <= 800 && n % 10 === 0 ? n : null;
}

function Choices<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  text,
}: {
  legend: string;
  options: readonly T[];
  value: T | undefined;
  onChange: (v: T) => void;
  text: (v: T) => string;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={cn(
              'min-h-10 rounded-xl border px-3.5 text-[13.5px] font-semibold',
              value === o ? 'bg-sage text-leaf-2 border-sage-2' : 'border-line text-ink-2 hover:bg-paper-2',
            )}
          >
            {text(o)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AboutCard({
  about: initial,
  demo,
  onSaved,
}: {
  about: AboutMe;
  demo: boolean;
  onSaved: (a: AboutMe) => void;
}) {
  const t = useT('profile');
  const ob = useT('onboarding');
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(() => ({
    ...initial,
    last: initial.lastMathScore ? String(initial.lastMathScore) : '',
    goal: String(initial.target),
  }));
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

  const open = () => {
    setDraft({
      ...initial,
      last: initial.lastMathScore ? String(initial.lastMathScore) : '',
      goal: String(initial.target),
    });
    setEditing(true);
  };

  const save = async () => {
    const target = score(draft.goal);
    const last = draft.satExp === 'taken' ? score(draft.last) : null;
    if (target === null || (draft.satExp === 'taken' && draft.last.trim() && last === null))
      return toast(t('about.invalid'));
    const patch: SettingsPatch = {
      target,
      lastMathScore: last,
      examDate: draft.examDate ?? '',
      ...(draft.satExp && { satExp: draft.satExp }),
      ...(draft.confidence && { confidence: draft.confidence }),
      ...(draft.desmos && { desmos: draft.desmos }),
      ...(draft.studyMinutes && { studyMinutes: draft.studyMinutes }),
      ...(draft.start && { start: draft.start }),
    };
    setBusy(true);
    const r = await saveSettings(patch);
    setBusy(false);
    if (!r.ok && r.reason !== 'demo_mode')
      return toast(t(r.reason === 'invalid_input' ? 'about.invalid' : 'about.failed'));
    if (!r.ok) writeLocalSettings(patch);
    onSaved({
      satExp: draft.satExp,
      lastMathScore: last,
      target,
      examDate: draft.examDate ?? '',
      confidence: draft.confidence,
      desmos: draft.desmos,
      studyMinutes: draft.studyMinutes,
      start: draft.start,
    });
    setEditing(false);
    toast(t('about.saved'));
  };

  const none = t('about.notSet');
  const rows: [string, string][] = [
    [ob('experience'), initial.satExp ? ob(`sat.${initial.satExp}`) : none],
    ...(initial.satExp === 'taken'
      ? ([[t('about.lastScore'), initial.lastMathScore ? String(initial.lastMathScore) : none]] as [
          string,
          string,
        ][])
      : []),
    [t('about.target'), String(initial.target)],
    [t('about.examDate'), initial.examDate || ob('noDate')],
    [t('about.confidence'), initial.confidence ? t('about.outOf5', { n: initial.confidence }) : none],
    [ob('desmos'), initial.desmos ? ob(`desmosOptions.${initial.desmos}`) : none],
    [t('about.minutes'), initial.studyMinutes ? ob('minuteOption', { n: initial.studyMinutes }) : none],
    [t('about.start'), initial.start ? ob(`focusOptions.${initial.start}`) : none],
  ];

  return (
    <section className="soft-card grid content-start gap-4 p-5" aria-labelledby={`${id}-title`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="font-bold text-[17px] text-ink">
          {t('about.title')}
        </h2>
        {!editing && (
          <Button variant="secondary" size="sm" onClick={open}>
            {t('about.edit')}
          </Button>
        )}
      </div>

      {!editing ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-paper-2 px-4 py-3">
              <dt className="text-[12px] text-ink-3">{k}</dt>
              <dd className={cn('mt-0.5 font-semibold', v === none ? 'text-ink-3' : 'text-ink')}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Choices
            legend={ob('experience')}
            options={SAT_EXP}
            value={draft.satExp}
            onChange={(satExp) => set({ satExp })}
            text={(o) => ob(`sat.${o}`)}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {draft.satExp === 'taken' && (
              <label className={label} htmlFor={`${id}-last`}>
                {t('about.lastScore')}
                <input
                  id={`${id}-last`}
                  type="number"
                  inputMode="numeric"
                  min={200}
                  max={800}
                  step={10}
                  value={draft.last}
                  onChange={(e) => set({ last: e.target.value })}
                  className={field}
                />
              </label>
            )}
            <label className={label} htmlFor={`${id}-goal`}>
              {t('about.target')}
              <input
                id={`${id}-goal`}
                type="number"
                inputMode="numeric"
                required
                min={200}
                max={800}
                step={10}
                value={draft.goal}
                onChange={(e) => set({ goal: e.target.value })}
                className={field}
              />
            </label>
            <label className={label} htmlFor={`${id}-date`}>
              {t('about.examDate')}
              <input
                id={`${id}-date`}
                type="date"
                value={draft.examDate ?? ''}
                onChange={(e) => set({ examDate: e.target.value })}
                className={field}
              />
            </label>
          </div>
          <p className="-mt-2 text-[12px] text-ink-3">{ob('mathHint')}</p>
          <Choices
            legend={ob('confidence')}
            options={[1, 2, 3, 4, 5] as const}
            value={draft.confidence}
            onChange={(confidence) => set({ confidence })}
            text={(o) => String(o)}
          />
          <Choices
            legend={ob('desmos')}
            options={DESMOS}
            value={draft.desmos}
            onChange={(desmos) => set({ desmos })}
            text={(o) => ob(`desmosOptions.${o}`)}
          />
          <Choices
            legend={ob('minutes')}
            options={MINUTES}
            value={draft.studyMinutes}
            onChange={(studyMinutes) => set({ studyMinutes })}
            text={(o) => ob('minuteOption', { n: o })}
          />
          <Choices
            legend={ob('focus')}
            options={START}
            value={draft.start}
            onChange={(start) => set({ start })}
            text={(o) => ob(`focusOptions.${o}`)}
          />
          {demo && <p className="text-[12.5px] text-ink-3">{t('header.demo')}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {t('header.save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t('header.cancel')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
