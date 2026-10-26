import 'katex/dist/katex.min.css';
import '@/features/cards/cards.css';
import type { ReactNode } from 'react';

export default function CardsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cards-root px-4 md:px-6">
      <div className="cards-backdrop" aria-hidden />
      {children}
    </div>
  );
}
