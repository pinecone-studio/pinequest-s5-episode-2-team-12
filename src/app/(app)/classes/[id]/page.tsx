import { notFound } from 'next/navigation';
import { ClassReport } from '@/features/classes/components/ClassReport';
import { classReport } from '@/features/classes/queries';

export default async function ClassReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await classReport(id);
  if (!res.ok) notFound();
  return <ClassReport cls={res.data.cls} rows={res.data.rows} />;
}
