'use client';
// ⋯ on every student shown elsewhere (friends, leaderboard, duels): remove, block, report with a fixed reason.
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { useT } from '@/lib/i18n-client';
import { REPORT_REASONS, type ReportReason } from '../lib/friends';

export function UserMenu({
  name,
  context,
  onRemove,
  onBlock,
  onReport,
}: {
  name: string;
  context: 'friend' | 'leaderboard' | 'duel' | 'group' | 'profile';
  onRemove?: () => void;
  onBlock: () => void;
  onReport: (reason: ReportReason) => void;
}) {
  const t = useT('social');
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) {
        setOpen(false);
        setReporting(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const item = 'block w-full rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold hover:bg-paper-2';
  return (
    <div ref={wrap} className="relative" data-context={context}>
      <button
        type="button"
        aria-label={`${t('friends.more')}: ${name}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-paper-2"
      >
        ⋯
      </button>
      {open && (
        <div id={id} role="menu" className="card absolute right-0 top-10 z-40 w-56 p-1.5 shadow-pop">
          {!reporting ? (
            <>
              {onRemove && (
                <button
                  type="button"
                  role="menuitem"
                  className={item}
                  onClick={() => {
                    setOpen(false);
                    onRemove();
                  }}
                >
                  {t('friends.remove')}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className={`${item} text-danger`}
                onClick={() => {
                  setOpen(false);
                  onBlock();
                }}
              >
                {t('friends.block')}
              </button>
              <button type="button" role="menuitem" className={item} onClick={() => setReporting(true)}>
                {t('friends.report')}
              </button>
            </>
          ) : (
            <div role="group" aria-label={t('friends.reportTitle')}>
              <p className="px-3 py-1.5 text-[12px] font-bold text-ink-3">{t('friends.reportTitle')}</p>
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="menuitem"
                  className={item}
                  onClick={() => {
                    setOpen(false);
                    setReporting(false);
                    onReport(r);
                    toast(t('friends.reported'));
                  }}
                >
                  {t(`friends.reasons.${r}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
