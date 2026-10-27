import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand';
import { routes } from '@/lib/routes';
export function AuthPanel({ children }: { children: ReactNode }) {
  return (
    <main className="emerald-workspace auth-workspace min-h-dvh gutter grid content-center py-10">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <Link href={routes.home} aria-label="SuPrep" className="justify-self-center">
          <Logo />
        </Link>
        <section className="soft-card p-6 sm:p-8">{children}</section>
      </div>
    </main>
  );
}
