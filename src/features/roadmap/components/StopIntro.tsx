'use client';
// 2–10 short screens before a stop's problems: key idea, worked example, Desmos tip.
import { useId, useState } from 'react';
import { Rich } from '@/components/math';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import type { IntroScreen } from '../content/schema';

export function StopIntro({ screens, onDone }: { screens: IntroScreen[]; onDone: () => void }) {
  const t = useT('roadmap');
  const [i, setI] = useState(0);
  const [answerVisible, setAnswerVisible] = useState(false);
  const uid = useId();
  const s = screens[i];
  const last = i === screens.length - 1;

  return (
    /* soft-card ба border-ийг арилгаж, дэлгэц рүүгээ уусам цэлгэр layout болгосон */
    <section
      className="relative flex flex-col justify-between min-h-[380px] w-full max-w-4xl mx-auto py-2 px-1 text-foreground"
      aria-labelledby={`${uid}-title`}
    >
      {/* Дээд талын Прогресс болон Илүү том Dots */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 px-3 py-1 rounded-full border border-border/30">
          {t('stop.intro')}
        </span>
        <ol className="flex gap-2" aria-label={`${i + 1} / ${screens.length}`}>
          {screens.map((_, j) => (
            <li
              key={j}
              className={cn(
                'h-2.5 rounded-full transition-all duration-300',
                j === i ? 'w-8 bg-leaf-2' : j < i ? 'w-3 bg-leaf-2/50' : 'w-3 bg-line',
              )}
              aria-current={j === i ? 'step' : undefined}
            />
          ))}
        </ol>
      </div>

      {/* Гол контент: Илүү том, уншихад маш тодорхой font */}
      <div className="flex-1 flex flex-col justify-center my-4 space-y-4">
        <h2
          id={`${uid}-title`}
          className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-ink leading-tight"
        >
          {s.title}
        </h2>
        {s.body && (
          <div className="text-lg sm:text-xl leading-relaxed text-ink-2 font-normal pt-2">
            <Rich text={s.body} />
          </div>
        )}

        {s.checkAnswer && (
          <div className="pt-4">
            <Button
              variant="ghost"
              size="md"
              className="text-base font-semibold hover:bg-muted/50"
              aria-expanded={answerVisible}
              onClick={() => setAnswerVisible(!answerVisible)}
            >
              {t(answerVisible ? 'stop.hideSolution' : 'stop.showSolution')}
              <span aria-hidden="true">{answerVisible ? ' ▲' : ' ▼'}</span>
            </Button>
            {answerVisible && (
              <div className="mt-3 p-5 rounded-2xl bg-muted/30 border border-border/40 text-lg leading-relaxed text-ink-2 animate-fade-in">
                <Rich text={s.checkAnswer} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Навигацийн товчлуур хэсэг */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-border/20 mt-auto">
        <Button
          variant="ghost"
          size="lg"
          className="text-base text-muted-foreground hover:text-foreground"
          onClick={onDone}
        >
          {t('stop.introSkip')}
        </Button>
        <Button
          variant="lime"
          size="xl"
          className="text-base px-8 py-3 rounded-2xl shadow-md transition-transform hover:scale-102"
          onClick={() => {
            setAnswerVisible(false);
            if (last) onDone();
            else setI(i + 1);
          }}
        >
          {last ? 'Бодлого руу' : t('stop.introNext')}
        </Button>
      </div>
    </section>
  );
}
