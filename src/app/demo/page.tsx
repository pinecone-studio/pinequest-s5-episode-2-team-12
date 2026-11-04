import { redirect } from 'next/navigation';
import { DemoEntry } from '@/features/demo/DemoEntry';
import { tuyaSeed } from '@/features/demo/seed';
import { getSession } from '@/lib/session';

export default async function DemoPage() {
  if ((await getSession())?.kind !== 'demo') redirect('/');
  return <DemoEntry seed={tuyaSeed()} />;
}
