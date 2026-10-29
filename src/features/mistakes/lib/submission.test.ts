import { expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mapOfficialRow } from '@/features/practice/lib/official';
import { QUESTIONS } from '@/mocks/questions';
import { readDemoNotebook, saveDemoSubmission } from './demo-notebook';
import { noteKey } from './identity';
import { buildNotebook } from './notebook';
import {
  gradeRetryQuestion,
  persistSubmission,
  processSubmission,
  type RetryQuestion,
  type SubmissionDependencies,
} from './submission';

const practice: RetryQuestion = {
  questionSource: 'practice',
  question: QUESTIONS.find((q) => q.id === 'a1')!,
};
const official: RetryQuestion = {
  questionSource: 'official',
  question: mapOfficialRow({
    id: 'ac472881',
    domain: 'Algebra',
    skill: 'Linear equations in one variable',
    difficulty: 'Hard',
    question_type: 'student_response',
    question_html: '<p>What is the value of s?</p>',
    choices: [],
    correct_answer: '403',
    accepted_answers: ['403'],
    explanation_html: '<p>The correct answer is 403.</p>',
  }),
};

function database() {
  const rows = new Map<string, Record<string, unknown>>();
  let fail = false;
  const key = (row: Record<string, unknown>) => `${row.user_id}:${row.question_source}:${row.question_id}`;
  const client = {
    from: (table: string) => {
      expect(table).toBe('mistakes');
      return {
        upsert: async (row: Record<string, unknown>, options: { onConflict: string }) => {
          expect(options.onConflict).toBe('user_id,question_id,question_source');
          if (fail) return { error: new Error('write failed') };
          rows.set(key(row), row);
          return { error: null };
        },
        update: (changes: Record<string, unknown>) => ({
          match: async (identity: Record<string, unknown>) => {
            if (fail) return { error: new Error('write failed') };
            const row = rows.get(key(identity));
            if (row) rows.set(key(identity), { ...row, ...changes });
            return { error: null };
          },
        }),
      };
    },
  } as unknown as SupabaseClient;
  return {
    client,
    rows,
    fail: () => {
      fail = true;
    },
  };
}

test('server grades authoritative MCQ and equivalent student responses', () => {
  const mcq = QUESTIONS.find((q) => q.choices && typeof q.answer === 'number')!;
  expect(gradeRetryQuestion({ questionSource: 'practice', question: mcq }, String(mcq.answer))).toBe(true);
  expect(gradeRetryQuestion({ questionSource: 'practice', question: mcq }, '9')).toBe(false);
  expect(gradeRetryQuestion(practice, '5')).toBe(true);
  expect(gradeRetryQuestion(practice, '4')).toBe(false);
  expect(gradeRetryQuestion(official, '403.0')).toBe(true);
  expect(gradeRetryQuestion(official, '404')).toBe(false);
});

test('authenticated submission, deduplication, source/user isolation, resolution, and reopening share one table', async () => {
  const db = database();
  const deps: SubmissionDependencies = {
    session: async () => ({ kind: 'user', userId: 'student-1', anonymous: false, email: null }),
    load: async () => official,
    persist: (...args) => persistSubmission(db.client, ...args),
  };
  const wrong = {
    qid: official.question.id,
    questionSource: 'official',
    answer: '404',
    correct: true,
    userId: 'forged-user',
  };
  expect(await processSubmission(wrong, deps)).toMatchObject({ ok: true, correct: false });
  await processSubmission(wrong, deps);
  expect(db.rows.size).toBe(1);
  const row = [...db.rows.values()][0];
  expect(row.user_id).toBe('student-1');
  expect(row.question_id).toBe(official.question.id);
  expect(row.resolved).toBe(false);
  await persistSubmission(
    db.client,
    'student-2',
    { qid: official.question.id, questionSource: 'official' },
    '404',
    false,
  );
  await persistSubmission(
    db.client,
    'student-1',
    { qid: official.question.id, questionSource: 'practice' },
    '404',
    false,
  );
  expect(db.rows.size).toBe(3);
  expect(await processSubmission({ ...wrong, answer: '403' }, deps)).toMatchObject({
    ok: true,
    correct: true,
  });
  expect([...db.rows.values()].filter((r) => r.resolved)).toHaveLength(1);
  await processSubmission(wrong, deps);
  expect([...db.rows.values()].filter((r) => r.resolved)).toHaveLength(0);
  db.fail();
  expect(await processSubmission({ ...wrong, answer: '403' }, deps)).toMatchObject({ ok: false });
  expect([...db.rows.values()].filter((r) => r.resolved)).toHaveLength(0);
});

test('authentication and validation failures do not write; demo grading never calls database persistence', async () => {
  let writes = 0;
  const deps: SubmissionDependencies = {
    session: async () => null,
    load: async () => practice,
    persist: async () => {
      writes++;
    },
  };
  expect(await processSubmission({ qid: 'a1', answer: '5' }, deps)).toMatchObject({ ok: false });
  expect(await processSubmission({ qid: '', answer: '5' }, deps)).toMatchObject({ ok: false });
  expect(
    await processSubmission({ qid: 'a1', answer: '5' }, { ...deps, session: async () => ({ kind: 'demo' }) }),
  ).toEqual({ ok: true, correct: true, storage: 'demo' });
  expect(writes).toBe(0);
});

test('session-scoped demo notebook deduplicates, separates sources, resolves, and reopens', () => {
  sessionStorage.clear();
  saveDemoSubmission({ qid: 'a1' }, '4', false);
  saveDemoSubmission({ qid: 'a1' }, '3', false);
  saveDemoSubmission({ qid: 'a1', questionSource: 'official' }, 'B', false);
  let data = readDemoNotebook();
  expect(data.entries).toHaveLength(2);
  expect(buildNotebook(data.entries, data.states).filter((note) => !note.state.resolved)).toHaveLength(2);
  saveDemoSubmission({ qid: 'a1' }, '5', true);
  data = readDemoNotebook();
  expect(
    buildNotebook(data.entries, data.states)
      .filter((note) => !note.state.resolved)
      .map(noteKey),
  ).toEqual(['official:a1']);
  saveDemoSubmission({ qid: 'a1' }, '4', false);
  data = readDemoNotebook();
  expect(buildNotebook(data.entries, data.states).filter((note) => !note.state.resolved)).toHaveLength(2);
  sessionStorage.clear();
});
