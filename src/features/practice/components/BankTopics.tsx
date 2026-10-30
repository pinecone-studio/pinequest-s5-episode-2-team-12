import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Domain } from '@/types';
import { BANK_TOPICS, bankTopicHref } from '../lib/bank-topics';
import { TopicMascot } from './TopicMascot';
import './bank-topics.css';

/** Four domain cards over the whole official bank; `counts` is null when Supabase is unreachable. */
export function BankTopics({ counts }: { counts: Record<Domain, number> | null }) {
  const total = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : null;

  return (
    <div className="workspace-page max-w-6xl text-ink">
      <PageHeader
        title="Асуултын сан"
        description="Сэдвээ сонгож, бодлогоор ур чадвараа сориорой."
        icon="bank"
      >
        {total !== null && (
          <div className="rounded-2xl border border-line bg-paper px-5 py-3 text-right">
            <span className="block font-display text-2xl font-bold text-leaf-2 tnum">{total}</span>
            <span className="text-xs font-semibold text-ink-3">нийт бодлого</span>
          </div>
        )}
      </PageHeader>
      {!counts && (
        <p role="status" className="rounded-2xl border border-line bg-paper p-4 text-sm text-ink-2">
          Асуултын сантай холбогдох боломжгүй байна. Дараа дахин оролдоно уу.
        </p>
      )}
      <nav aria-label="Бодлогын сэдвүүд" className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {BANK_TOPICS.map((item) => (
          <Link
            key={item.id}
            href={bankTopicHref(item.id)}
            aria-label={item.label}
            className="section-panel bank-topic-card group space-y-5 p-6 text-left transition hover:border-leaf focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf sm:p-7"
          >
            <TopicMascot topic={item.id} />
            <span className="block font-display text-xl font-bold">{item.label}</span>
            <span className="flex items-center justify-between gap-3 text-sm text-ink-3">
              <span>{counts ? `${counts[item.id]} бодлого` : '—'}</span>
              <span
                aria-hidden="true"
                className="bank-topic-arrow text-leaf-2 transition group-hover:translate-x-1"
              >
                →
              </span>
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
