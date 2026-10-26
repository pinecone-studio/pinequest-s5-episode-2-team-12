'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Avatar } from '@/components/brand/Avatar';
import { Button } from '@/components/ui/Button';
// /friends: invite (code, link, share sheet), add by code, requests, the friends list (level, streak) with
// remove / block / report, duels and group tests. Demo mode uses demo friends (bots) in localStorage.
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { TOPICS } from '@/features/roadmap/topics';
import { useT } from '@/lib/i18n-client';
import {
  addFriendByCode,
  blockUser,
  createDuel,
  removeFriend,
  reportUser,
  respondFriend,
  unblockUser,
} from '../actions';
import { createGroup } from '../group-actions';
import { BOTS, botById, isBot } from '../lib/bots';
import { duelOutcome } from '../lib/duel';
import { formatFriendCode, parseFriendCode } from '../lib/friends';
import { addLocalDuel, type LocalSocial, loadSocial, saveSocial } from '../lib/local-social';
import type { DuelSummary, PublicUser, SocialOverview } from '../queries';
import { UserMenu } from './UserMenu';

function botUser(id: string): PublicUser {
  const b = botById(id)!;
  return { id: b.id, name: b.name, avatarId: b.avatarId, level: b.level, streak: b.streak };
}

/** The demo state shaped like the server overview. */
function fromLocal(s: LocalSocial): SocialOverview {
  const now = Date.now();
  return {
    code: s.code,
    friends: s.friends.filter(isBot).map(botUser),
    incoming: s.incoming.filter(isBot).map(botUser),
    outgoing: s.outgoing.filter(isBot).map(botUser),
    blocked: s.blocked.filter(isBot).map(botUser),
    duels: s.duels
      .filter((d) => !s.blocked.includes(d.duel.opponent))
      .map((d): DuelSummary => {
        const outcome = duelOutcome(
          d.duel,
          d.mine,
          d.mine?.finishedAt ? d.theirs : { ...d.theirs, finishedAt: null },
          now,
        );
        return {
          duel: d.duel,
          opponent: botUser(d.duel.opponent),
          mine: d.mine,
          theirs: outcome.reveal ? d.theirs : null,
          outcome,
          result:
            !outcome.reveal || !outcome.winner
              ? null
              : outcome.winner === 'draw'
                ? 'draw'
                : outcome.winner === 'me'
                  ? 'won'
                  : 'lost',
        };
      }),
    groups: [],
  };
}

const section = 'soft-card grid content-start gap-3 p-5';

export function FriendsView({
  demo,
  server,
  origin,
}: {
  demo: boolean;
  server: SocialOverview | null;
  origin: string;
}) {
  const t = useT('social');
  const router = useRouter();
  const uid = useId();
  const [local, setLocal] = useState<LocalSocial | null>(null);
  const [code, setCode] = useState('');
  const [opponent, setOpponent] = useState('');
  const [topic, setTopic] = useState('');
  const [size, setSize] = useState<5 | 10>(5);
  const [when, setWhen] = useState('');
  const [invite, setInvite] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!demo) return;
    const sync = () => setLocal(loadSocial());
    sync();
    window.addEventListener('suprep-social', sync);
    return () => window.removeEventListener('suprep-social', sync);
  }, [demo]);
  useEffect(() => {
    const d = new Date(Date.now() + 30 * 60_000);
    d.setSeconds(0, 0);
    setWhen(new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
  }, []);

  const view = useMemo(() => (demo ? (local ? fromLocal(local) : null) : server), [demo, local, server]);
  const link = view ? `${origin}/friends/add/${view.code}` : '';
  const update = (fn: (s: LocalSocial) => LocalSocial) => local && saveSocial(fn(local));
  const done = () => (demo ? undefined : router.refresh());

  if (!view) return <p className="text-ink-3">…</p>;

  const add = async () => {
    const parsed = parseFriendCode(code);
    if (!parsed) return toast(t('friends.badCode'));
    if (demo) {
      // demo: any valid code adds the next demo friend, who accepts right away
      const next = BOTS.find((b) => !local?.friends.includes(b.id) && !local?.blocked.includes(b.id));
      if (!next) return toast(t('friends.badCode'));
      update((s) => ({
        ...s,
        friends: [...s.friends, next.id],
        incoming: s.incoming.filter((x) => x !== next.id),
      }));
      setCode('');
      return toast(t('friends.added'));
    }
    const r = await addFriendByCode(parsed);
    toast(r.ok ? t('friends.added') : t('friends.badCode'));
    if (r.ok) {
      setCode('');
      done();
    }
  };

  const respond = async (id: string, accept: boolean) => {
    if (demo)
      return update((s) => ({
        ...s,
        incoming: s.incoming.filter((x) => x !== id),
        friends: accept ? [...s.friends, id] : s.friends,
      }));
    await respondFriend(id, accept);
    done();
  };
  const remove = async (id: string) => {
    if (demo) return update((s) => ({ ...s, friends: s.friends.filter((x) => x !== id) }));
    await removeFriend(id);
    done();
  };
  const block = async (id: string) => {
    if (demo)
      return update((s) => ({
        ...s,
        friends: s.friends.filter((x) => x !== id),
        incoming: s.incoming.filter((x) => x !== id),
        blocked: [...new Set([...s.blocked, id])],
      }));
    await blockUser(id);
    done();
  };
  const unblock = async (id: string) => {
    if (demo) return update((s) => ({ ...s, blocked: s.blocked.filter((x) => x !== id) }));
    await unblockUser(id);
    done();
  };

  const challenge = async () => {
    if (!opponent) return;
    setBusy(true);
    const r = await createDuel({ opponent, topicId: topic ? Number(topic) : null, size });
    setBusy(false);
    if (!r.ok) return toast(r.reason);
    if (demo && r.botRun) update((s) => addLocalDuel(s, r.duel, r.botRun!));
    toast(t('duels.created'));
    router.push(`/duel/${r.duel.id}`);
  };

  const schedule = async () => {
    setBusy(true);
    const r = await createGroup({ startsAt: new Date(when).toISOString(), invite });
    setBusy(false);
    if (!r.ok) return toast(r.reason);
    toast(t('group.created'));
    router.push(`/group/${r.id}`);
  };

  const share = async () => {
    const text = t('friends.inviteText', { code: formatFriendCode(view.code) });
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Suprep', text, url: link });
      } catch {
        // dismissed
      }
    } else {
      await navigator.clipboard?.writeText(`${text} ${link}`);
      toast(t('friends.copied'));
    }
  };

  const status = (d: DuelSummary) =>
    d.result === 'won'
      ? t('duels.youWon')
      : d.result === 'lost'
        ? t('duels.youLost')
        : d.result === 'draw'
          ? t('duels.draw')
          : d.outcome.reveal
            ? t('duels.status.expired')
            : d.mine?.finishedAt
              ? t('duels.status.waiting')
              : t('duels.status.open');

  return (
    <div className="workspace-page max-w-6xl grid-cols-[minmax(0,1fr)]">
      <PageHeader title={t('friends.title')} description={t('friends.lead')} icon="friends" />
      {demo && (
        <p className="rounded-2xl border border-line bg-paper-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          {t('friends.demo')}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className={section} aria-labelledby={`${uid}-code`}>
          <h2 id={`${uid}-code`} className="font-bold text-ink">
            {t('friends.code')}
          </h2>
          <p
            className="font-display text-3xl font-bold tracking-[0.15em] text-ink tnum"
            data-testid="friend-code"
          >
            {formatFriendCode(view.code)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={share}>
              {t('friends.share')}
            </Button>
            <a
              className="inline-flex h-9 items-center rounded-xl border border-line px-3 text-[13px] font-bold text-ink-2 hover:border-leaf"
              href={`fb-messenger://share?link=${encodeURIComponent(link)}`}
            >
              {t('friends.messenger')}
            </a>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard?.writeText(link);
                toast(t('friends.copied'));
              }}
            >
              {t('friends.copy')}
            </Button>
          </div>
          <p className="text-[12px] text-ink-3">{t('friends.safety')}</p>
        </section>

        <section className={section} aria-labelledby={`${uid}-add`}>
          <h2 id={`${uid}-add`} className="font-bold text-ink">
            {t('friends.add')}
          </h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <label className="sr-only" htmlFor={`${uid}-addinput`}>
              {t('friends.addPlaceholder')}
            </label>
            <input
              id={`${uid}-addinput`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('friends.addPlaceholder')}
              autoComplete="off"
              maxLength={12}
              className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-paper-2 px-3 font-mono uppercase tracking-wider"
            />
            <Button type="submit">{t('friends.addButton')}</Button>
          </form>
          {view.incoming.length > 0 && (
            <div className="grid gap-2">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">
                {t('friends.incoming')}
              </p>
              {view.incoming.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <Avatar name={u.name} avatarId={u.avatarId} size={36} />
                  <span className="flex-1 font-semibold text-ink">{u.name}</span>
                  <Button size="sm" onClick={() => respond(u.id, true)}>
                    {t('friends.accept')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => respond(u.id, false)}>
                    {t('friends.decline')}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {view.outgoing.length > 0 && (
            <p className="text-[13px] text-ink-3">
              {t('friends.outgoing')}: {view.outgoing.map((u) => u.name).join(', ')}
            </p>
          )}
        </section>
      </div>

      <section className={section} aria-labelledby={`${uid}-list`}>
        <h2 id={`${uid}-list`} className="font-bold text-ink">
          {t('friends.list')}
        </h2>
        {view.friends.length === 0 ? (
          <p className="text-[14px] text-ink-2">{t('friends.none')}</p>
        ) : (
          <ul className="grid gap-2">
            {view.friends.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-3 py-2"
              >
                <Avatar name={u.name} avatarId={u.avatarId} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">
                    {u.name} {isBot(u.id) && <Pill tone="teal">{t('friends.demoFriend')}</Pill>}
                  </p>
                  <p className="text-[12.5px] text-ink-3">
                    {t('friends.level', { n: u.level })} · {t('friends.streak', { n: u.streak ?? 0 })}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setOpponent(u.id)}>
                  {t('friends.challenge')}
                </Button>
                <UserMenu
                  name={u.name}
                  context="friend"
                  onRemove={() => remove(u.id)}
                  onBlock={() => block(u.id)}
                  onReport={(reason) => void reportUser({ target: u.id, context: 'friend', reason })}
                />
              </li>
            ))}
          </ul>
        )}
        {view.blocked.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
            {t('friends.blocked')}:
            {view.blocked.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => unblock(u.id)}
                className="rounded-xl border border-line px-2 py-1 hover:border-leaf"
              >
                {u.name} · {t('friends.unblock')}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={section} aria-labelledby={`${uid}-duels`}>
        <h2 id={`${uid}-duels`} className="font-bold text-ink">
          {t('duels.title')}
        </h2>
        <form
          className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void challenge();
          }}
        >
          <label className="grid min-w-0 gap-1 text-[12.5px] font-semibold text-ink-2">
            {t('duels.opponent')}
            <select
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              required
              className="h-11 w-full min-w-0 rounded-2xl border border-line bg-paper-2 px-3 text-[14px] text-ink"
            >
              <option value="">—</option>
              {view.friends.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-[12.5px] font-semibold text-ink-2">
            {t('duels.topic')}
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-11 w-full min-w-0 rounded-2xl border border-line bg-paper-2 px-3 text-[14px] text-ink"
            >
              <option value="">{t('duels.mixed')}</option>
              {TOPICS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id}. {x.title}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="grid gap-1 text-[12.5px] font-semibold text-ink-2">
            <legend>{t('duels.size')}</legend>
            <div className="flex gap-1">
              {([5, 10] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={size === n}
                  onClick={() => setSize(n)}
                  className={`h-11 w-12 rounded-2xl border text-[14px] font-bold ${size === n ? 'border-leaf bg-sage text-leaf-2' : 'border-line text-ink-2'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <Button type="submit" disabled={!opponent || busy}>
            {t('duels.create')}
          </Button>
        </form>
        {view.duels.length === 0 ? (
          <p className="text-[14px] text-ink-2">{t('duels.none')}</p>
        ) : (
          <ul className="grid gap-2">
            {view.duels.map((d) => (
              <li key={d.duel.id}>
                <Link
                  href={`/duel/${d.duel.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper px-3 py-2 hover:border-leaf"
                >
                  <Avatar name={d.opponent.name} avatarId={d.opponent.avatarId} size={34} />
                  <span className="font-semibold text-ink">{d.opponent.name}</span>
                  <span className="text-[12.5px] text-ink-3">
                    {d.duel.topicId ? TOPICS.find((x) => x.id === d.duel.topicId)?.title : t('duels.mixed')} ·{' '}
                    {d.duel.size}
                  </span>
                  <span className="ml-auto text-[13px] font-bold text-ink-2">{status(d)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={section} aria-labelledby={`${uid}-group`}>
        <h2 id={`${uid}-group`} className="font-bold text-ink">
          {t('group.title')}
        </h2>
        <p className="text-[13px] text-ink-3">{t('group.rules')}</p>
        {demo ? (
          <p className="rounded-2xl bg-paper-2 px-4 py-3 text-[13.5px] text-ink-2">{t('group.demo')}</p>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void schedule();
            }}
          >
            <label className="grid min-w-0 gap-1 text-[12.5px] font-semibold text-ink-2">
              {t('group.when')}
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                required
                className="h-11 max-w-xs rounded-2xl border border-line bg-paper-2 px-3 text-[14px]"
              />
            </label>
            <fieldset className="grid gap-1">
              <legend className="text-[12.5px] font-semibold text-ink-2">{t('group.invite')}</legend>
              <div className="flex flex-wrap gap-2">
                {view.friends.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-[13.5px]"
                  >
                    <input
                      type="checkbox"
                      checked={invite.includes(u.id)}
                      onChange={(e) =>
                        setInvite((v) => (e.target.checked ? [...v, u.id] : v.filter((x) => x !== u.id)))
                      }
                      className="accent-[var(--c-leaf)]"
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" disabled={busy}>
              {t('group.create')}
            </Button>
          </form>
        )}
        {view.groups.length > 0 && (
          <ul className="grid gap-2">
            {view.groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/group/${g.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-3 py-2 hover:border-leaf"
                >
                  <span className="font-semibold text-ink">
                    {t('group.starts', { at: new Date(g.startsAt).toLocaleString('mn-MN') })}
                  </span>
                  <span className="ml-auto text-[12.5px] text-ink-3">
                    {g.members.length} · {t('group.members')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
