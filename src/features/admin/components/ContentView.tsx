'use client';
// /admin/content: write a new question for the official bank (/bank) or a new word card (/flashcards),
// and remove what admins added. College Board items can't be deleted from here.
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { OFFICIAL_SKILLS } from '@/features/practice/lib/official';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import type { Domain } from '@/types';
import { type AdminResult, addSatQuestion, addWordCard, deleteSatQuestion, deleteWordCard } from '../actions';
import { formatDay } from '../lib/format';
import type { AdminSatItem, AdminWordCard } from '../queries';

const field = 'w-full rounded-2xl border border-line bg-paper px-3 text-[14px] text-ink';
const label = 'grid gap-1 text-[12.5px] font-semibold text-ink-3';
const LETTERS = ['A', 'B', 'C', 'D'] as const;
const DOMAINS: Domain[] = ['alg', 'adv', 'psda', 'geo'];

function useResult() {
  const t = useT('admin');
  return (r: AdminResult, done: string) => {
    if (r.ok) return toast(done);
    if (r.reason === 'invalid_input' || r.reason === 'not_found') return toast(t(`errors.${r.reason}`));
    if (r.reason === 'not_installed' || r.reason === 'forbidden') return toast(t(`notice.${r.reason}`));
    toast(t('errors.failed'));
  };
}

function SatForm() {
  const t = useT('admin');
  const router = useRouter();
  const report = useResult();
  const id = useId();
  const [domain, setDomain] = useState<Domain>('alg');
  const [skill, setSkill] = useState(OFFICIAL_SKILLS.alg[0]);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [format, setFormat] = useState<'mcq' | 'spr'>('mcq');
  const [prompt, setPrompt] = useState('');
  const [choices, setChoices] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState('A');
  const [accepted, setAccepted] = useState('');
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await addSatQuestion({
      domain,
      skill,
      difficulty,
      format,
      prompt,
      choices: format === 'mcq' ? choices : undefined,
      answer: format === 'mcq' ? answer : accepted,
      explanation,
    });
    setBusy(false);
    report(r, t('content.sat.added'));
    if (!r.ok) return;
    setPrompt('');
    setChoices(['', '', '', '']);
    setAccepted('');
    setExplanation('');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="soft-card grid content-start gap-4 p-5">
      <div>
        <h2 className="font-bold text-[17px] text-ink">{t('content.sat.title')}</h2>
        <p className="mt-1 text-[13px] text-ink-3">{t('content.sat.lead')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label} htmlFor={`${id}-domain`}>
          {t('content.sat.domain')}
          <select
            id={`${id}-domain`}
            value={domain}
            onChange={(e) => {
              const d = e.target.value as Domain;
              setDomain(d);
              setSkill(OFFICIAL_SKILLS[d][0]);
            }}
            className={cn(field, 'h-11')}
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {t(`content.domains.${d}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={cn(label, 'sm:col-span-2')} htmlFor={`${id}-skill`}>
          {t('content.sat.skill')}
          <select
            id={`${id}-skill`}
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className={cn(field, 'h-11')}
          >
            {OFFICIAL_SKILLS[domain].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className={label}>
          <legend className="mb-1">{t('content.sat.difficulty')}</legend>
          <div className="flex gap-1.5">
            {([1, 2, 3] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={difficulty === d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  'h-10 flex-1 rounded-xl border text-[13.5px] font-semibold',
                  difficulty === d
                    ? 'bg-sage text-leaf-2 border-sage-2'
                    : 'border-line text-ink-2 hover:bg-paper-2',
                )}
              >
                {t(`content.sat.level.${d}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={label}>
          <legend className="mb-1">{t('content.sat.format')}</legend>
          <div className="flex gap-1.5">
            {(['mcq', 'spr'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={format === f}
                onClick={() => setFormat(f)}
                className={cn(
                  'h-10 flex-1 rounded-xl border text-[13.5px] font-semibold',
                  format === f
                    ? 'bg-sage text-leaf-2 border-sage-2'
                    : 'border-line text-ink-2 hover:bg-paper-2',
                )}
              >
                {t(`content.sat.${f}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <label className={label} htmlFor={`${id}-prompt`}>
        {t('content.sat.prompt')}
        <textarea
          id={`${id}-prompt`}
          required
          rows={3}
          maxLength={2000}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={cn(field, 'py-2')}
        />
      </label>
      {format === 'mcq' ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[12.5px] font-semibold text-ink-3">{t('content.sat.choices')}</legend>
          {LETTERS.map((letter, i) => (
            <div key={letter} className="flex items-center gap-2">
              <label className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-ink-2">
                <input
                  type="radio"
                  name={`${id}-answer`}
                  checked={answer === letter}
                  onChange={() => setAnswer(letter)}
                  aria-label={t('content.sat.correct', { letter })}
                />
                {letter}
              </label>
              <input
                required
                maxLength={300}
                value={choices[i]}
                onChange={(e) => setChoices((c) => c.map((v, j) => (j === i ? e.target.value : v)))}
                aria-label={t('content.sat.choice', { letter })}
                className={cn(field, 'h-10')}
              />
            </div>
          ))}
          <p className="text-[12px] text-ink-3">{t('content.sat.pickCorrect')}</p>
        </fieldset>
      ) : (
        <label className={label} htmlFor={`${id}-accepted`}>
          {t('content.sat.accepted')}
          <input
            id={`${id}-accepted`}
            required
            maxLength={200}
            value={accepted}
            onChange={(e) => setAccepted(e.target.value)}
            placeholder="3/4|.75"
            className={cn(field, 'h-11')}
          />
        </label>
      )}
      <label className={label} htmlFor={`${id}-explain`}>
        {t('content.sat.explanation')}
        <textarea
          id={`${id}-explain`}
          rows={2}
          maxLength={3000}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          className={cn(field, 'py-2')}
        />
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {t('content.sat.submit')}
        </Button>
      </div>
    </form>
  );
}

function CardForm() {
  const t = useT('admin');
  const router = useRouter();
  const report = useResult();
  const id = useId();
  const [card, setCard] = useState({ front: '', back: '', ex: '', hook: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof card) => (e: { target: { value: string } }) =>
    setCard((c) => ({ ...c, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await addWordCard(card);
    setBusy(false);
    report(r, t('content.card.added'));
    if (!r.ok) return;
    setCard({ front: '', back: '', ex: '', hook: '' });
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="soft-card grid content-start gap-4 p-5">
      <div>
        <h2 className="font-bold text-[17px] text-ink">{t('content.card.title')}</h2>
        <p className="mt-1 text-[13px] text-ink-3">{t('content.card.lead')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label} htmlFor={`${id}-front`}>
          {t('content.card.front')}
          <input
            id={`${id}-front`}
            required
            maxLength={80}
            value={card.front}
            onChange={set('front')}
            placeholder="slope"
            className={cn(field, 'h-11')}
          />
        </label>
        <label className={label} htmlFor={`${id}-back`}>
          {t('content.card.back')}
          <input
            id={`${id}-back`}
            required
            maxLength={120}
            value={card.back}
            onChange={set('back')}
            placeholder="налалт"
            className={cn(field, 'h-11')}
          />
        </label>
      </div>
      <label className={label} htmlFor={`${id}-ex`}>
        {t('content.card.ex')}
        <input
          id={`${id}-ex`}
          maxLength={300}
          value={card.ex}
          onChange={set('ex')}
          placeholder="the **slope** of $y = 2x + 1$ is $2$"
          className={cn(field, 'h-11')}
        />
      </label>
      <label className={label} htmlFor={`${id}-hook`}>
        {t('content.card.hook')}
        <input
          id={`${id}-hook`}
          maxLength={300}
          value={card.hook}
          onChange={set('hook')}
          className={cn(field, 'h-11')}
        />
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {t('content.card.submit')}
        </Button>
      </div>
    </form>
  );
}

function Remove({ onRemove, name }: { onRemove: () => Promise<AdminResult>; name: string }) {
  const t = useT('admin');
  const router = useRouter();
  const report = useResult();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(t('content.confirmDelete', { name }))) return;
        setBusy(true);
        const r = await onRemove();
        setBusy(false);
        report(r, t('content.deleted'));
        if (r.ok) router.refresh();
      }}
    >
      {t('content.delete')}
    </Button>
  );
}

export function ContentView({ sat, cards }: { sat: AdminSatItem[]; cards: AdminWordCard[] }) {
  const t = useT('admin');
  return (
    <>
      <PageHeader title={t('content.title')} description={t('content.lead')} icon="practicePlayer" />
      <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <SatForm />
        <CardForm />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="soft-card grid content-start gap-3 p-5">
          <h2 className="font-bold text-[17px] text-ink">{t('content.sat.list', { n: sat.length })}</h2>
          {sat.length === 0 ? (
            <p className="text-sm text-ink-2">{t('content.empty')}</p>
          ) : (
            <ul className="grid gap-2">
              {sat.map((q) => (
                <li key={q.id} className="flex items-start gap-3 rounded-xl bg-paper-2 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill>{q.difficulty}</Pill>
                      <Pill>{q.question_type === 'multiple_choice' ? 'MCQ' : 'Grid-in'}</Pill>
                      <span className="text-[12px] text-ink-3">
                        {q.skill} · {formatDay(q.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[14px] text-ink">{q.question_text}</p>
                  </div>
                  <Remove name={q.question_text.slice(0, 40)} onRemove={() => deleteSatQuestion(q.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="soft-card grid content-start gap-3 p-5">
          <h2 className="font-bold text-[17px] text-ink">{t('content.card.list', { n: cards.length })}</h2>
          {cards.length === 0 ? (
            <p className="text-sm text-ink-2">{t('content.empty')}</p>
          ) : (
            <ul className="grid gap-2">
              {cards.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-paper-2 px-3.5 py-3">
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    <b className="text-ink">{c.front}</b> <span className="text-ink-2">— {c.back}</span>
                  </span>
                  <Remove name={c.front} onRemove={() => deleteWordCard(c.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
