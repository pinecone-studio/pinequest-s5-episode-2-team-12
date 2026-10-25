'use client';
// /group/[id]: the lobby (start countdown, members), the shared test while the window is open, and the
// results board once it closes. Signed-in only.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/brand/Avatar';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { joinGroup, startGroupMock } from '../group-actions';
import { groupState } from '../lib/group';
import type { GroupView as View } from '../queries';

const until = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} ц ${m % 60} мин` : `${m} мин`;
};

export function GroupView({ view, meId }: { view: View; meId: string }) {
  const t = useT('social');
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(iv);
  }, []);
  const state = groupState(view, now);
  const me = view.members.find((m) => m.id === meId);

  const take = async () => {
    setBusy(true);
    const r = await startGroupMock(view.id);
    setBusy(false);
    if (!r.ok) return toast(r.reason);
    router.push(`${routes.mock}?group=${view.id}&attempt=${r.attemptId}`);
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <header className="soft-card grid gap-2 p-5">
        <h1 className="font-display text-2xl font-bold text-ink">{t('group.title')}</h1>
        <p className="text-[14px] text-ink-2">
          {t('group.starts', { at: new Date(view.startsAt).toLocaleString('mn-MN') })}
        </p>
        <p className="text-[13px] text-ink-3">{t('group.rules')}</p>
        <p className="font-semibold text-ink">
          {state === 'scheduled'
            ? t('group.scheduled', { in: until(Date.parse(view.startsAt) - now) })
            : state === 'open'
              ? t('group.open')
              : t('group.closed')}
        </p>
        <div className="flex flex-wrap gap-2">
          {me && !me.joined && state !== 'closed' && (
            <Button
              variant="secondary"
              onClick={async () => {
                await joinGroup(view.id);
                router.refresh();
              }}
            >
              {t('group.join')}
            </Button>
          )}
          {state === 'open' && (
            <Button onClick={take} disabled={busy}>
              {view.myAttemptId ? t('group.resume') : t('group.take')}
            </Button>
          )}
        </div>
      </header>

      <section className="soft-card grid gap-2 p-5" aria-label={t('group.members')}>
        <h2 className="font-bold text-ink">{t('group.members')}</h2>
        <ul className="flex flex-wrap gap-2">
          {view.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-2xl border border-line px-3 py-1.5">
              <Avatar name={m.name} avatarId={m.avatarId} size={28} />
              <span className="text-[13.5px] font-semibold text-ink">{m.name}</span>
              <Pill tone={m.joined ? 'leaf' : 'neutral'}>
                {m.joined ? t('group.joined') : t('group.invited')}
              </Pill>
            </li>
          ))}
        </ul>
      </section>

      <section className="soft-card grid gap-2 p-5" aria-label={t('group.board')}>
        <h2 className="font-bold text-ink">{t('group.board')}</h2>
        {!view.board || view.board.length === 0 ? (
          <p className="text-[14px] text-ink-3">{t('group.noBoard')}</p>
        ) : (
          <ol className="grid gap-1.5">
            {view.board.map((r) => (
              <li
                key={r.userId}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${r.me ? 'bg-sage' : 'bg-paper-2'}`}
              >
                <span className="w-6 font-bold text-ink tnum">{r.rank}</span>
                <Avatar name={r.name} avatarId={r.avatarId} size={30} />
                <span className="flex-1 font-semibold text-ink">{r.name}</span>
                <span className="font-display text-lg font-bold text-ink tnum">{r.score}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <Link href="/friends" className="text-[13px] font-bold text-ink-2">
        ← {t('friends.title')}
      </Link>
    </div>
  );
}
