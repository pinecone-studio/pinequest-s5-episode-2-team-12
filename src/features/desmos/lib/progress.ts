'use client';
import { useEffect, useState } from 'react';

const KEY = 'suuprep:desmos:completed:v1';
function read(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
/** Browser-only completion until the shared progress mutations are integrated. */
export function useAcademyProgress() {
  const [completed, setCompleted] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setCompleted(read());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('desmos-progress', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('desmos-progress', sync);
    };
  }, []);
  const complete = (id: string) => {
    const next = [...new Set([...read(), id])];
    setCompleted(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* session only */
    }
    window.dispatchEvent(new Event('desmos-progress'));
  };
  return { completed, complete };
}
