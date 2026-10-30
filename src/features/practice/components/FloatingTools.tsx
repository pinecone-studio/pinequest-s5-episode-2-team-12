'use client';

import { useState } from 'react';
import { DesmosCatButton } from '@/features/tutor/components/DesmosSidePanel';
import { cn } from '@/lib/cn';
import { DesmosCalculator } from './DesmosCalculator';
import { FloatingWindow } from './FloatingWindow';
import { SuuMiniChat } from './SuuMiniChat';

type Tool = 'desmos' | 'suu';

/** Bottom-right stack: Desmos, then Суу AI. Each opens its own draggable window. */
export function FloatingTools({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const [open, setOpen] = useState<Record<Tool, boolean>>({ desmos: false, suu: false });
  // Mount a window on first open, then keep it (the graph, the chat) while hidden.
  const [mounted, setMounted] = useState<Record<Tool, boolean>>({ desmos: false, suu: false });
  // Last-used window on top.
  const [front, setFront] = useState<Tool>('desmos');

  const toggle = (tool: Tool) => {
    setMounted((m) => ({ ...m, [tool]: true }));
    setOpen((o) => ({ ...o, [tool]: !o[tool] }));
    setFront(tool);
  };
  const close = (tool: Tool) => setOpen((o) => ({ ...o, [tool]: false }));
  const z = (tool: Tool) => (front === tool ? 51 : 50);

  return (
    <>
      <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
        <DesmosCatButton open={open.desmos} onClick={() => toggle('desmos')} className="shadow-lg" />
        <button
          type="button"
          onClick={() => toggle('suu')}
          aria-pressed={open.suu}
          aria-label={open.suu ? 'Суу AI-г хаах' : 'Суу AI-тай ярилцах'}
          className={cn(
            'inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-bold shadow-lg transition',
            open.suu
              ? 'border-leaf bg-sage text-leaf-2'
              : 'border-line bg-paper-2 text-ink hover:border-leaf hover:text-leaf-2',
          )}
        >
          <span
            className="grid size-7 place-items-center overflow-hidden rounded-[30%] bg-sage"
            aria-hidden="true"
          >
            {/* biome-ignore lint/performance/noImgElement: static transparent image */}
            <img src="/brand/suu-logo-head.webp" alt="" width={28} height={28} className="h-auto w-[88%]" />
          </span>
          Суу AI
        </button>
      </div>
      {mounted.desmos && (
        <FloatingWindow
          label="Desmos тооцоолуур"
          title="Desmos"
          closeLabel="Desmos-ийг хаах"
          open={open.desmos}
          onClose={() => close('desmos')}
          onFocus={() => setFront('desmos')}
          z={z('desmos')}
        >
          <DesmosCalculator />
        </FloatingWindow>
      )}
      {mounted.suu && (
        <FloatingWindow
          label="Суу AI"
          title="Суу AI"
          closeLabel="Суу AI цонхыг хаах"
          open={open.suu}
          onClose={() => close('suu')}
          onFocus={() => setFront('suu')}
          z={z('suu')}
          offsetY={48}
        >
          <SuuMiniChat fetchImpl={fetchImpl} />
        </FloatingWindow>
      )}
    </>
  );
}
