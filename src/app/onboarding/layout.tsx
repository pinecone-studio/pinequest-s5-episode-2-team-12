import type { ReactNode } from 'react';
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="emerald-workspace onboarding-workspace min-h-dvh gutter py-8 sm:py-12">{children}</main>
  );
}
