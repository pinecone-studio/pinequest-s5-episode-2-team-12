'use client';

import { useRef, useState } from 'react';
import { saveDemoSubmission } from './lib/demo-notebook';
import type { QuestionRef } from './lib/identity';
import { submitQuestionAnswer } from './submission-actions';

export function useAnswerSubmission(onResolved?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const last = useRef<{ ref: QuestionRef; answer: string } | null>(null);
  async function submit(ref: QuestionRef, answer: string) {
    if (pending.current) return;
    pending.current = true;
    last.current = { ref, answer };
    setBusy(true);
    setError('');
    try {
      const result = await submitQuestionAnswer({ ...ref, answer });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.storage === 'demo') saveDemoSubmission(ref, answer, result.correct);
      if (result.correct) onResolved?.();
    } catch {
      setError('Хадгалж чадсангүй. Дахин оролдоно уу.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    submit,
    reset: () => {
      setError('');
      last.current = null;
    },
    retry: () => {
      if (last.current) void submit(last.current.ref, last.current.answer);
    },
  };
}
