'use client';

import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };

const MARGIN = 8;
const STEP = 24;

/** Keep the window's title bar on screen so it can always be dragged back. */
function clamp(point: Point, el: HTMLElement | null): Point {
  const width = el?.offsetWidth ?? 0;
  const maxX = Math.max(MARGIN, window.innerWidth - width - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - 48);
  return {
    x: Math.min(Math.max(point.x, MARGIN), maxX),
    y: Math.min(Math.max(point.y, MARGIN), maxY),
  };
}

/**
 * A draggable, resizable window: drag by its title bar (or arrow keys on the grip), resize from the corner.
 * Hidden rather than unmounted when closed, so its contents keep their state.
 */
export function FloatingWindow({
  label,
  title,
  closeLabel,
  open,
  onClose,
  onFocus,
  z,
  offsetY = 0,
  children,
}: {
  label: string;
  title: ReactNode;
  closeLabel: string;
  open: boolean;
  onClose: () => void;
  /** Bring this window above the others. */
  onFocus: () => void;
  z: number;
  /** Cascade from the default top-right spot so two windows don't open exactly on top of each other. */
  offsetY?: number;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<Point | null>(null);
  const win = useRef<HTMLElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (!open || pos) return;
    const width = win.current?.offsetWidth ?? 420;
    setPos(clamp({ x: window.innerWidth - width - 24, y: 96 + offsetY }, win.current));
  }, [open, pos, offsetY]);

  useEffect(() => {
    const keepInView = () => setPos((p) => (p ? clamp(p, win.current) : p));
    window.addEventListener('resize', keepInView);
    return () => window.removeEventListener('resize', keepInView);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]') || !pos) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }, win.current));
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const move = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[
      e.key
    ];
    if (!move || !pos) return;
    e.preventDefault();
    setPos(clamp({ x: pos.x + move[0], y: pos.y + move[1] }, win.current));
  };

  return (
    <section
      ref={win}
      aria-label={label}
      hidden={!open}
      onPointerDownCapture={onFocus}
      onFocusCapture={onFocus}
      className="fixed flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl"
      style={{
        zIndex: z,
        left: pos?.x ?? 0,
        top: pos?.y ?? 0,
        visibility: pos ? undefined : 'hidden',
        width: 'min(440px, calc(100vw - 16px))',
        height: 'min(520px, calc(100dvh - 120px))',
        minWidth: 280,
        minHeight: 260,
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: 'calc(100dvh - 16px)',
        resize: 'both',
      }}
    >
      {/* Title bar is the pointer drag handle; the grip button moves the window with arrow keys. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex cursor-grab touch-none items-center justify-between gap-2 border-b border-line bg-paper-2 px-2 py-2 select-none active:cursor-grabbing"
      >
        <button
          type="button"
          onKeyDown={onKeyDown}
          aria-label={`Зөөх (чирэх эсвэл сумаар): ${label}`}
          className="flex cursor-grab items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold text-ink"
        >
          <span aria-hidden="true">⠿</span> {title}
        </button>
        <button
          type="button"
          data-no-drag
          onClick={onClose}
          aria-label={closeLabel}
          className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-sage hover:text-ink"
        >
          ✕
        </button>
      </div>
      {children}
    </section>
  );
}
