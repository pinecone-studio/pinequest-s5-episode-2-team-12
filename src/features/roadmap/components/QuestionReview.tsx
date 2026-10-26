'use client';
// Admin review list: filter by status/topic, see the numeric answer check, approve or edit.
import { useMemo, useState } from 'react';
import { Rich } from '@/components/math';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { checkQuestion } from '../../../../scripts/roadmap/check-answers';
import { reviewQuestion } from '../admin';
import { DIFFICULTY_OF } from '../config';
import type { RoadmapQuestion } from '../content/schema';
import { correctAnswerText } from '../lib/grade';
import { TOPICS } from '../topics';

type Filter = 'all' | 'pending' | 'reviewed';
const FIELDS = ['prompt', 'mn', 'explain', 'hint'] as const;

function Item({ q, readOnly }: { q: RoadmapQuestion; readOnly: boolean }) {
  const t = useT('roadmap');
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState(q.reviewed);
  const [cur, setCur] = useState(q);
  const findings = useMemo(() => checkQuestion(cur), [cur]);
  const mismatch = findings.find((f) => f.level === 'mismatch');
  const manual = findings.find((f) => f.level === 'manual');

  const save = async (patch: Partial<RoadmapQuestion>) => {
    const r = await reviewQuestion(q.id, patch as never);
    if (!r.ok) {
      toast(`${t('admin.error')}: ${r.reason}`, { tone: 'danger' });
      return false;
    }
    toast(t('admin.saved'), { tone: 'success' });
    return true;
  };

  return (
    <li className="soft-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <code className="font-mono font-bold text-ink">{q.id}</code>
        <Pill>{DIFFICULTY_OF[q.difficulty]}</Pill>
        <Pill>{q.format}</Pill>
        {q.pool === 'placement' && <Pill tone="teal">placement</Pill>}
        <Pill tone={reviewed ? 'leaf' : 'amber'}>
          {reviewed ? t('admin.filter.reviewed') : t('admin.filter.pending')}
        </Pill>
        {mismatch ? (
          <Pill tone="danger" className="whitespace-normal">
            ✗ {mismatch.message}
          </Pill>
        ) : manual ? (
          <Pill tone="neutral">· {manual.message}</Pill>
        ) : (
          <Pill tone="leaf">✓ verify</Pill>
        )}
      </div>

      {edit ? (
        <div className="grid gap-2">
          {FIELDS.map((f) => (
            <label key={f} className="grid gap-1 text-[12px] font-semibold text-ink-3">
              {f}
              <textarea
                className="min-h-16 rounded-xl border border-line bg-paper p-2 font-mono text-[13px] text-ink"
                value={draft[f] ?? cur[f]}
                onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
              />
            </label>
          ))}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                if (await save(draft)) {
                  setCur({ ...cur, ...draft });
                  setEdit(false);
                  setDraft({});
                }
              }}
            >
              {t('admin.save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>
              {t('admin.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[15px] text-ink">
            <Rich text={cur.prompt} />
          </p>
          <p className="text-[13.5px] text-ink-2">
            <Rich text={cur.mn} />
          </p>
          {cur.choices && (
            <ol className="grid gap-1 text-[14px] sm:grid-cols-2">
              {cur.choices.map((c, i) => (
                <li
                  key={i}
                  className={cn(
                    'rounded-lg px-2 py-1',
                    cur.answer === i ? 'bg-sage font-bold' : 'bg-paper-2',
                  )}
                >
                  {'ABCD'[i]}) <Rich text={c} />
                </li>
              ))}
            </ol>
          )}
          <p className="text-[13px] text-ink-2">
            <b>→</b> <Rich text={correctAnswerText(cur as never)} /> · <Rich text={cur.explain} />
          </p>
        </>
      )}

      {!readOnly && !edit && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={reviewed ? 'secondary' : 'primary'}
            onClick={async () => {
              if (await save({ reviewed: !reviewed })) setReviewed(!reviewed);
            }}
          >
            {reviewed ? t('admin.unapprove') : t('admin.approve')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEdit(true)}>
            {t('admin.edit')}
          </Button>
        </div>
      )}
    </li>
  );
}

export function QuestionReview({ questions, readOnly }: { questions: RoadmapQuestion[]; readOnly: boolean }) {
  const t = useT('roadmap');
  const [filter, setFilter] = useState<Filter>('pending');
  const [topic, setTopic] = useState(0);
  const list = questions.filter(
    (q) =>
      (topic === 0 || q.topicId === topic) &&
      (filter === 'all' || (filter === 'reviewed' ? q.reviewed : !q.reviewed)),
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['pending', 'reviewed', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'h-11 rounded-full border px-4 text-sm font-semibold',
              filter === f ? 'border-leaf bg-sage text-leaf-2' : 'border-line text-ink-2',
            )}
          >
            {t(`admin.filter.${f}`)}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-2">
          {t('admin.topic')}
          <select
            className="h-11 rounded-xl border border-line bg-paper px-2 text-ink"
            value={topic}
            onChange={(e) => setTopic(Number(e.target.value))}
          >
            <option value={0}>{t('admin.filter.all')}</option>
            {TOPICS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id}. {x.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-ink-3">{t('admin.count', { n: list.length })}</p>
      <ul className="grid gap-3">
        {list.map((q) => (
          <Item key={q.id} q={q} readOnly={readOnly} />
        ))}
      </ul>
    </div>
  );
}
