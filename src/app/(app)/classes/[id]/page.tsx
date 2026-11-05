import { notFound } from 'next/navigation';
import { ClassReport } from '@/features/classes/components/ClassReport';
import { errorText } from '@/features/classes/lib/errors';
import { classReport } from '@/features/classes/queries';

export default async function ClassReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await classReport(id);
  if (res.ok) return <ClassReport cls={res.data.cls} rows={res.data.rows} />;
  // not this teacher's class (or no such class): 404; a database problem is said out loud instead of a 404
  if (res.reason === 'forbidden') notFound();
  return <p className="card mx-auto max-w-xl p-6 text-center text-sm text-danger">{errorText(res.reason)}</p>;
}
