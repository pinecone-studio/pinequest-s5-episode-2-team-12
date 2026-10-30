'use client';
import { useEffect, useState } from 'react';
import { initializeTuyaDemo } from './bootstrap';
import type { DemoSeed } from './seed';

export function DemoEntry({ seed }: { seed: DemoSeed }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    try {
      initializeTuyaDemo(localStorage, seed);
      window.location.replace('/');
    } catch {
      setFailed(true);
    }
  }, [seed]);
  return (
    <main className="grid min-h-dvh place-content-center gap-4 p-6 text-center text-ink">
      <h1 className="font-display text-2xl font-bold">Tuya · Демо сурагч</h1>
      <p>
        {failed
          ? 'Демо мэдээллийг хадгалах боломжгүй байна. Хөтчийн хадгалах сангийн тохиргоог шалгана уу.'
          : 'Демо сурагчийн мэдээллийг бэлтгэж байна…'}
      </p>
      {failed && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-sage px-4 py-3 text-leaf-2"
        >
          Дахин оролдох
        </button>
      )}
    </main>
  );
}
