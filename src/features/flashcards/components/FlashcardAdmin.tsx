'use client';
import { useState } from 'react';
import { Tex } from '@/components/math';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { useT } from '@/lib/i18n-client';
import { reviewFlashcard } from '../actions';
import { FLASHCARDS } from '../lib/decks';

export function FlashcardAdmin({ canEdit, reviewed }: { canEdit: boolean; reviewed: string[] }) {
  const t = useT('flashcards');
  const [ok, setOk] = useState(() => new Set(reviewed));
  const toggle = async (key: string) => {
    const next = !ok.has(key);
    const r = await reviewFlashcard(key, next);
    if (!r.ok) return toast(r.reason ?? 'error');
    setOk((s) => {
      const n = new Set(s);
      if (next) n.add(key);
      else n.delete(key);
      return n;
    });
  };
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">{t('admin.title')}</h1>
        <p className="text-[14px] text-ink-2">{t('admin.lead')}</p>
        {!canEdit && (
          <p className="mt-2 rounded-2xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">
            {t('admin.readOnly')}
          </p>
        )}
      </header>
      <ul className="grid gap-2">
        {FLASHCARDS.map((c) => {
          const done = c.reviewed || ok.has(c.key);
          return (
            <li key={c.key} className="soft-card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">
                  {c.front} <span className="font-normal text-ink-2">— {c.back}</span>
                </p>
                <p className="text-[12px] text-ink-3">
                  {c.key} · {c.group}
                  {c.topicIds.length > 0 && ` · #${c.topicIds.join(', #')}`}
                </p>
                {c.tex && <Tex tex={c.tex} />}
              </div>
              {done ? <Pill tone="leaf">{t('admin.reviewed')}</Pill> : <Pill tone="amber">{t('draft')}</Pill>}
              {canEdit && (
                <Button size="sm" variant={done ? 'ghost' : 'primary'} onClick={() => toggle(c.key)}>
                  {done ? t('admin.unapprove') : t('admin.approve')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
