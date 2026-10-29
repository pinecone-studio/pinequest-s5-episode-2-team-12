'use client';
// /admin/reports: what students reported about each other (features/social), newest open ones first.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { resolveReport } from '../actions';
import { formatDateTime } from '../lib/format';
import type { AdminReport } from '../queries';

const filterLink = (on: boolean) =>
  cn(
    'h-10 px-4 grid place-items-center rounded-xl text-[14px] font-semibold border transition-colors',
    on ? 'bg-sage text-leaf-2 border-sage-2' : 'border-line text-ink-2 hover:bg-paper-2',
  );

function ReportCard({ report }: { report: AdminReport }) {
  const t = useT('admin');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    const r = await resolveReport(report.id, !report.resolved);
    setBusy(false);
    if (!r.ok) return toast(r.reason === 'not_found' ? t('errors.not_found') : t('errors.failed'));
    toast(t('reports.saved'));
    router.refresh();
  };

  return (
    <li className={cn('soft-card grid gap-3 p-5', report.resolved && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={report.reason === 'harassment' || report.reason === 'cheating' ? 'danger' : 'amber'}>
          {t(`reports.reason.${report.reason}`)}
        </Pill>
        <Pill>{t(`reports.context.${report.context}`)}</Pill>
        {report.resolved && <Pill tone="leaf">{t('reports.resolved')}</Pill>}
        <span className="ml-auto text-[12px] text-ink-3 tnum">{formatDateTime(report.created_at)}</span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-paper-2 px-3.5 py-3">
          <dt className="text-[12px] font-semibold text-ink-3">{t('reports.target')}</dt>
          <dd className="mt-0.5 font-bold text-ink">
            <Link
              href={routes.adminUsers(report.target_email ?? report.target_name)}
              className="hover:underline"
            >
              {report.target_name || t('reports.unknown')}
            </Link>
          </dd>
          {report.target_email && <dd className="text-[13px] text-ink-2">{report.target_email}</dd>}
          {report.target_open > 1 && (
            <dd className="mt-1 text-[12px] font-semibold text-danger">
              {t('reports.against', { n: report.target_open })}
            </dd>
          )}
        </div>
        <div className="rounded-xl bg-paper-2 px-3.5 py-3">
          <dt className="text-[12px] font-semibold text-ink-3">{t('reports.reporter')}</dt>
          <dd className="mt-0.5 font-bold text-ink">{report.reporter_name || t('reports.unknown')}</dd>
        </div>
      </dl>
      <div className="flex justify-end">
        <Button
          variant={report.resolved ? 'secondary' : 'primary'}
          size="sm"
          disabled={busy}
          onClick={toggle}
        >
          {t(report.resolved ? 'reports.reopen' : 'reports.resolve')}
        </Button>
      </div>
    </li>
  );
}

export function ReportsView({ reports, all }: { reports: AdminReport[]; all: boolean }) {
  const t = useT('admin');
  return (
    <>
      <PageHeader title={t('reports.title')} description={t('reports.lead')} icon="flag" />
      <nav className="flex flex-wrap gap-2" aria-label={t('reports.title')}>
        <Link
          href={routes.adminReports()}
          aria-current={!all ? 'page' : undefined}
          className={filterLink(!all)}
        >
          {t('reports.open')}
        </Link>
        <Link
          href={routes.adminReports(true)}
          aria-current={all ? 'page' : undefined}
          className={filterLink(all)}
        >
          {t('reports.all')}
        </Link>
      </nav>
      {reports.length === 0 ? (
        <p className="soft-card p-6 text-center text-ink-2">
          {t(all ? 'reports.emptyAll' : 'reports.empty')}
        </p>
      ) : (
        <ul className="grid gap-3">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </ul>
      )}
    </>
  );
}
