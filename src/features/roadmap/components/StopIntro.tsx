'use client';
// 2–4 short screens before a stop's problems: key idea, worked example, Desmos tip.
import { useId, useState } from 'react';
import { Rich } from '@/components/math';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import type { IntroScreen } from '../content/schema';

export function StopIntro({ screens, onDone }: { screens: IntroScreen[]; onDone: () => void }) {
  const t = useT('roadmap');
  const [i, setI] = useState(0);
  const uid = useId();
  const s = screens[i];
  const last = i === screens.length - 1;
  return (
    <section className="soft-card flex flex-col gap-5 p-5 sm:p-7" aria-labelledby={`${uid}-title`}>
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{t('stop.intro')}</p>
        <ol className="flex gap-1.5" aria-label={`${i + 1} / ${screens.length}`}>
          {screens.map((_, j) => (
            <li
              key={j}
              className={cn('h-2 w-6 rounded-full', j <= i ? 'bg-leaf' : 'bg-line')}
              aria-current={j === i ? 'step' : undefined}
            />
          ))}
        </ol>
      </div>
      <div>
        <h2 id={`${uid}-title`} className="font-display text-2xl font-bold text-ink">
          {s.title}
        </h2>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-2">
          <Rich text={s.body} />
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t('stop.introSkip')}
        </Button>
        <Button variant="lime" onClick={() => (last ? onDone() : setI(i + 1))}>
          {last ? t('stop.introSkip') : t('stop.introNext')}
        </Button>
      </div>
    </section>
  );
}
