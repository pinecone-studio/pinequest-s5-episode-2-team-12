import type { ReactNode } from 'react';

/** Tests have their own full-page workspace, separate from app navigation. */
export default function ExamLayout({ children }: { children: ReactNode }) {
  return <main className="calm min-h-dvh bg-white px-3 py-6 sm:px-6">{children}</main>;
}
