'use client';
// /admin/users: search every account, promote / demote admins, send or take back gems.
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { Avatar } from '@/components/brand/Avatar';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { type AdminResult, grantGems, setUserRole } from '../actions';
import { formatDateTime, formatDay } from '../lib/format';
import type { AdminUser } from '../queries';

const field = 'h-11 w-full rounded-2xl border border-line bg-paper px-3 text-[14px] text-ink';

function useFail() {
  const t = useT('admin');
  return (r: Extract<AdminResult, { ok: false }>) => {
    if (r.reason === 'self_demote') return toast(t('users.selfDemote'));
    if (r.reason === 'invalid_input' || r.reason === 'not_found') return toast(t(`errors.${r.reason}`));
    if (r.reason === 'not_installed' || r.reason === 'forbidden') return toast(t(`notice.${r.reason}`));
    toast(t('errors.failed'));
  };
}

function GemsForm({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const t = useT('admin');
  const router = useRouter();
  const fail = useFail();
  const id = useId();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isInteger(n) || n === 0 || n < -1000 || n > 1000) return toast(t('users.gems.invalid'));
    setBusy(true);
    const r = await grantGems({ userId: user.id, amount: n, note });
    setBusy(false);
    if (!r.ok) return fail(r);
    toast(t('users.gems.done', { n }));
    router.refresh();
    onDone();
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-xl border border-line bg-paper-2 p-3.5 sm:grid-cols-[150px_1fr_auto]"
    >
      <label className="grid gap-1 text-[12px] font-semibold text-ink-3" htmlFor={`${id}-n`}>
        {t('users.gems.amount')}
        <input
          id={`${id}-n`}
          type="number"
          inputMode="numeric"
          min={-1000}
          max={1000}
          step={1}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={field}
        />
      </label>
      <label className="grid gap-1 text-[12px] font-semibold text-ink-3" htmlFor={`${id}-note`}>
        {t('users.gems.note')}
        <input
          id={`${id}-note`}
          maxLength={30}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={field}
        />
      </label>
      <div className="flex items-end gap-2">
        <Button type="submit" size="md" disabled={busy}>
          {t('users.gems.give')}
        </Button>
        <Button variant="ghost" size="md" onClick={onDone}>
          {t('users.gems.cancel')}
        </Button>
      </div>
    </form>
  );
}

function UserRow({ user, me }: { user: AdminUser; me: string | null }) {
  const t = useT('admin');
  const router = useRouter();
  const fail = useFail();
  const [gems, setGems] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = user.name || user.username || user.email || t('users.guest');
  const admin = user.role === 'admin';
  const self = user.id === me;

  const toggleRole = async () => {
    const next = admin ? 'student' : 'admin';
    if (!window.confirm(t(admin ? 'users.confirmRemove' : 'users.confirmAdmin', { name }))) return;
    setBusy(true);
    const r = await setUserRole(user.id, next);
    setBusy(false);
    if (!r.ok) return fail(r);
    toast(t('users.roleSaved'));
    router.refresh();
  };

  return (
    <li className="soft-card grid gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold text-ink">{name}</span>
            {user.username && user.username !== name && (
              <span className="text-[13px] text-ink-3">@{user.username}</span>
            )}
            <Pill tone={admin ? 'dark' : 'neutral'}>{t(`users.role.${user.role}`)}</Pill>
            {self && <Pill tone="leaf">{t('users.you')}</Pill>}
            {user.anonymous && <Pill>{t('users.guest')}</Pill>}
            {!user.anonymous && !user.onboarded && <Pill tone="amber">{t('users.notOnboarded')}</Pill>}
            {user.reports > 0 && <Pill tone="danger">{t('users.reports', { n: user.reports })}</Pill>}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-ink-2">{user.email ?? '—'}</div>
          <div className="mt-0.5 text-[12px] text-ink-3">
            {t('users.joined', { date: formatDay(user.created_at) })} ·{' '}
            {t('users.lastSeen', {
              date: user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : t('users.never'),
            })}
          </div>
        </div>
        <div className="flex items-center gap-4 text-[13px] text-ink-2">
          <span className="font-semibold tnum">{user.xp.toLocaleString('en-US')} XP</span>
          <span className="font-semibold tnum">💎 {user.gems.toLocaleString('en-US')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setGems((v) => !v)} aria-expanded={gems}>
            {t('users.gems.button')}
          </Button>
          {!user.anonymous && !(admin && self) && (
            <Button variant={admin ? 'danger' : 'soft'} size="sm" disabled={busy} onClick={toggleRole}>
              {t(admin ? 'users.removeAdmin' : 'users.makeAdmin')}
            </Button>
          )}
        </div>
      </div>
      {gems && <GemsForm user={user} onDone={() => setGems(false)} />}
    </li>
  );
}

export function UsersView({ users, search, me }: { users: AdminUser[]; search: string; me: string | null }) {
  const t = useT('admin');
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(search);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    router.push(routes.adminUsers(q.trim() || undefined));
  };

  return (
    <>
      <PageHeader title={t('users.title')} description={t('users.lead')} icon="users" />
      <form onSubmit={submit} className="filter-panel flex flex-wrap items-center gap-3" role="search">
        <label className="sr-only" htmlFor={id}>
          {t('users.search')}
        </label>
        <input
          id={id}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('users.search')}
          maxLength={80}
          className={`${field} min-w-0 flex-1 basis-60`}
        />
        <Button type="submit">{t('users.searchButton')}</Button>
        <span className="text-[13px] text-ink-3">{t('users.count', { n: users.length })}</span>
      </form>
      {users.length === 0 ? (
        <p className="soft-card p-6 text-center text-ink-2">{t('users.empty')}</p>
      ) : (
        <ul className="grid gap-2.5">
          {users.map((u) => (
            <UserRow key={u.id} user={u} me={me} />
          ))}
        </ul>
      )}
    </>
  );
}
