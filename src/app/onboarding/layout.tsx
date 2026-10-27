import type { ReactNode } from 'react';
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <main className="shell-bg min-h-dvh gutter py-8 sm:py-12">{children}</main>;
}
