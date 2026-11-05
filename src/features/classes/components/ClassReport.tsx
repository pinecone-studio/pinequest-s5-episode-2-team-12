'use client';

// /classes/[id]: the teacher's view of one class — who needs help first, and with which topics.
import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { classView, type Status, type StudentRow, summary } from '../lib/report';
import type { ClassItem } from '../queries';

const STATUS: Record<Status, { label: string; className: string }> = {
  struggling: { label: 'Тусламж хэрэгтэй', className: 'bg-danger-soft text-danger' },
  inactive: { label: 'Идэвхгүй', className: 'bg-amber-soft text-amber' },
  new: { label: 'Шинэ', className: 'bg-paper-2 text-ink-3' },
  ok: { label: 'Сайн', className: 'bg-sage text-leaf-2' },
};

export function ClassReport({
  cls,
  rows,
  now = Date.now(),
}: {
  cls: ClassItem;
  rows: StudentRow[];
  now?: number;
}) {
  const views = useMemo(() => classView(rows, now), [rows, now]);
  const s = useMemo(() => summary(views), [views]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-2xl font-extrabold">{cls.name}</h1>
        {cls.join_code && (
          <p className="text-sm">
            Нэгдэх код:{' '}
            <code className="rounded-lg bg-paper-2 px-2 py-1 font-bold tracking-widest">{cls.join_code}</code>
          </p>
        )}
      </header>

      <section aria-label="Ангийн дүн" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Сурагч" value={String(s.students)} />
        <Stat label="7 хоногт идэвхтэй" value={`${s.activeWeek}/${s.students}`} />
        <Stat label="Зөв хариулт" value={s.accuracy === null ? '—' : `${s.accuracy}%`} />
        <Stat label="Тусламж хэрэгтэй" value={String(s.needHelp)} />
      </section>

      {s.commonWeak.length > 0 && (
        <p className="card p-4 text-sm">
          <span className="font-bold">Ангиараа сул сэдэв: </span>
          {s.commonWeak.map((w) => `${w.topic} (${w.students} сурагч)`).join(', ')}
        </p>
      )}

      {views.length === 0 ? (
        <p className="card p-6 text-center text-sm">Одоогоор сурагч алга. Кодоо сурагчдадаа өгөөрэй.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Сурагчдын явц</caption>
            <thead className="text-xs text-ink-3">
              <tr>
                <th className="p-2">Сурагч</th>
                <th className="p-2">Төлөв</th>
                <th className="p-2">Зөв %</th>
                <th className="p-2">Хариулт (7 хоног)</th>
                <th className="p-2">Алдааны дэвтэр</th>
                <th className="p-2">Сул сэдэв</th>
              </tr>
            </thead>
            <tbody>
              {views.map((v) => (
                <tr key={v.id} className="border-t border-line">
                  <th scope="row" className="p-2 font-bold">
                    {v.name}
                    {v.username && (
                      <span className="block text-xs font-normal text-ink-3">@{v.username}</span>
                    )}
                  </th>
                  <td className="p-2">
                    <span
                      className={cn('rounded-lg px-2 py-0.5 text-xs font-bold', STATUS[v.status].className)}
                    >
                      {STATUS[v.status].label}
                    </span>
                    {v.status === 'inactive' && v.idleDays !== null && (
                      <span className="ml-1 text-xs text-ink-3">{v.idleDays} хоног</span>
                    )}
                  </td>
                  <td className="p-2 tnum">{v.accuracy === null ? '—' : `${v.accuracy}%`}</td>
                  <td className="p-2 tnum">
                    {v.answers} ({v.week})
                  </td>
                  <td className="p-2 tnum">{v.open_mistakes}</td>
                  <td className="p-2 text-xs">{v.weakTopicNames.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-xl font-extrabold tnum">{value}</p>
    </div>
  );
}
