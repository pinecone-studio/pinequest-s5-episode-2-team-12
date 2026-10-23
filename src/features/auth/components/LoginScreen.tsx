'use client';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { AnimatedBackground } from './AnimatedBackground';
import { AuthCard } from './AuthCard';
import type { AuthMode } from './AuthTabs';
import { BrandPanel } from './BrandPanel';

/** The /login screen. Owns the router so AuthCard stays testable without Next. */
export function LoginScreen({ defaultView }: { defaultView: AuthMode }) {
  const router = useRouter();
  const redirect = useCallback((href: string) => router.push(href), [router]);

  return (
    <main className="gutter relative isolate min-h-dvh overflow-x-hidden">
      <AnimatedBackground />
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl items-center gap-12 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <BrandPanel />
        <AuthCard defaultView={defaultView} onRedirect={redirect} />
      </div>
    </main>
  );
}
