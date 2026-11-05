'use client';

// /classes: a teacher makes a class and shares its code; a student joins with the code.
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { routes } from '@/lib/routes';
import type { ClassFailure, ClassItem } from '../queries';

type Actions = {
  createClass: (
    name: string,
  ) => Promise<{ ok: true; id: string; code: string } | { ok: false; reason: string }>;
  joinClass: (
    code: string,
  ) => Promise<{ ok: true; id: string; name: string } | { ok: false; reason: string }>;
};

const ERRORS: Record<string, string> = {
  bad_name: 'Ангийн нэр 1–60 тэмдэгт байна.',
  bad_code: 'Код 6 үсэг/тоо байна (жишээ: SUU7QK).',
  not_found: 'Ийм кодтой анги олдсонгүй.',
  own_class: 'Энэ бол таны өөрийн анги.',
  class_full: 'Анги дүүрсэн байна (200 сурагч).',
  too_many_classes: 'Нэг багш 20 хүртэл анги үүсгэнэ.',
  demo_mode: 'Анги үүсгэх, нэгдэхийн тулд нэвтэрнэ үү.',
  not_installed: 'Ангийн хэсэг одоогоор идэвхжээгүй байна (migration 0022).',
};
export const errorText = (reason: string) => ERRORS[reason] ?? 'Алдаа гарлаа. Дахин оролдоно уу.';

const input = 'w-full rounded-xl border border-line bg-paper-2 px-3 py-2 text-sm';
const btn = 'rounded-2xl bg-leaf px-4 py-2 text-sm font-bold text-white disabled:opacity-50';

export function ClassesView({
  classes,
  failure,
  actions,
}: {
  classes: ClassItem[];
  failure?: ClassFailure;
  actions: Actions;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, start] = useTransition();
  const nameId = useId();
  const codeId = useId();
  const teaching = classes.filter((c) => c.teacher);
  const joined = classes.filter((c) => !c.teacher);

  const run = (f: () => Promise<void>) => start(() => void f());

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">Анги</h1>
        <p className="text-sm text-ink-3">Багш анги үүсгээд кодоо сурагчдад өгнө. Сурагч кодоор нэгдэнэ.</p>
      </header>

      {failure && failure !== 'demo_mode' && (
        <p className="card p-4 text-sm text-danger">{errorText(failure)}</p>
      )}
      {msg && (
        <p
          role="status"
          className={msg.tone === 'ok' ? 'text-sm font-bold text-leaf-2' : 'text-sm font-bold text-danger'}
        >
          {msg.text}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <form
          aria-label="Анги үүсгэх"
          className="card space-y-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await actions.createClass(name);
              setMsg(
                r.ok
                  ? { tone: 'ok', text: `Анги үүслээ. Код: ${r.code}` }
                  : { tone: 'error', text: errorText(r.reason) },
              );
              if (r.ok) setName('');
            });
          }}
        >
          <label htmlFor={nameId} className="text-sm font-bold">
            Би багш — анги үүсгэх
          </label>
          <input
            id={nameId}
            className={input}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="12б анги"
          />
          <button type="submit" className={btn} disabled={busy || !name.trim()}>
            Үүсгэх
          </button>
        </form>

        <form
          aria-label="Ангид нэгдэх"
          className="card space-y-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await actions.joinClass(code);
              setMsg(
                r.ok
                  ? { tone: 'ok', text: `«${r.name}» ангид нэгдлээ.` }
                  : { tone: 'error', text: errorText(r.reason) },
              );
              if (r.ok) setCode('');
            });
          }}
        >
          <label htmlFor={codeId} className="text-sm font-bold">
            Би сурагч — кодоор нэгдэх
          </label>
          <input
            id={codeId}
            className={`${input} uppercase tracking-widest`}
            value={code}
            maxLength={8}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SUU7QK"
          />
          <button type="submit" className={btn} disabled={busy || !code.trim()}>
            Нэгдэх
          </button>
        </form>
      </div>

      <section aria-label="Миний заадаг ангиуд" className="space-y-2">
        <h2 className="font-bold">Миний заадаг ангиуд</h2>
        {teaching.length === 0 && <p className="text-sm text-ink-3">Одоогоор анги алга.</p>}
        <ul className="space-y-2">
          {teaching.map((c) => (
            <li key={c.id} className="card flex flex-wrap items-center gap-3 p-3">
              <Link href={routes.classReport(c.id)} className="mr-auto font-bold hover:underline">
                {c.name}
              </Link>
              <span className="text-xs text-ink-3">{c.members} сурагч</span>
              {c.join_code && (
                <code
                  title={`${c.name} код`}
                  className="rounded-lg bg-paper-2 px-2 py-1 font-bold tracking-widest"
                >
                  {c.join_code}
                </code>
              )}
            </li>
          ))}
        </ul>
      </section>

      {joined.length > 0 && (
        <section aria-label="Миний ангиуд" className="space-y-2">
          <h2 className="font-bold">Миний ангиуд</h2>
          <ul className="space-y-2">
            {joined.map((c) => (
              <li key={c.id} className="card p-3 text-sm">
                {c.name} · {c.members} сурагч
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
