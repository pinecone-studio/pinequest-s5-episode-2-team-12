'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Question } from '@/types';
import { HARD_TOPICS, type HardTopic, hardTopicQuestions } from '../lib/bank-topics';
import { cbScope, type OfficialQuestion } from '../lib/official';
import { officialSolveIssue } from '../lib/topic-bank';
import { CbHtml, OfficialQuestionCard } from './OfficialQuestionCard';
import { PracticePlayer } from './PracticePlayer';
import { QuestionBank } from './QuestionBank';
import { TopicMascot } from './TopicMascot';
import './bank-topics.css';

const backButton =
  'rounded-xl border border-line bg-paper px-5 py-3 text-sm font-bold text-ink-2 transition hover:border-leaf hover:text-ink';

export function BankTopics({
  questions,
  officialQuestions = [],
  sourceUnavailable = false,
}: {
  questions: Question[];
  officialQuestions?: OfficialQuestion[];
  sourceUnavailable?: boolean;
}) {
  const [topic, setTopic] = useState<HardTopic | null>(null);
  const [selected, setSelected] = useState<Question | null>(null);
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialQuestion | null>(null);
  const officialVisible = topic ? hardTopicQuestions(officialQuestions, topic) : [];
  const visible = topic ? hardTopicQuestions(questions, topic) : [];
  const queue = [
    ...visible.map((question) => ({ questionSource: 'practice' as const, question })),
    ...officialVisible
      .filter((question) => !officialSolveIssue(question))
      .map((question) => ({ questionSource: 'official' as const, question })),
  ];
  const currentIndex = queue.findIndex((item) =>
    selected
      ? item.questionSource === 'practice' && item.question.id === selected.id
      : item.questionSource === 'official' && item.question.id === selectedOfficial?.id,
  );
  const backToList = () => {
    setSelected(null);
    setSelectedOfficial(null);
  };
  const nextQuestion = () => {
    const next = queue[currentIndex + 1];
    if (!next) return;
    setSelected(next.questionSource === 'practice' ? next.question : null);
    setSelectedOfficial(next.questionSource === 'official' ? next.question : null);
  };
  const label = HARD_TOPICS.find((item) => item.id === topic)?.label;

  return (
    <div className="workspace-page max-w-6xl text-ink">
      <PageHeader
        title="Асуултын сан"
        description="Сэдвээ сонгож, хүнд түвшний бодлогоор ур чадвараа сориорой."
        icon="bank"
      />
      {sourceUnavailable && (
        <p role="status" className="rounded-2xl border border-line bg-paper p-4 text-sm text-ink-2">
          Асуултын сантай холбогдох боломжгүй байна. Жишээ бодлогоор орлуулаагүй тул дараа дахин оролдоно уу.
        </p>
      )}
      {!topic ? (
        <>
          <nav aria-label="Бодлогын сэдвүүд" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {HARD_TOPICS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                onClick={() => setTopic(item.id)}
                className="section-panel bank-topic-card group space-y-5 p-6 text-left transition hover:border-leaf focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf sm:p-7"
              >
                <TopicMascot topic={item.id} />
                <span className="block font-display text-xl font-bold">{item.label}</span>
                <span className="flex items-center justify-between gap-3 text-sm text-ink-3">
                  <span>
                    {hardTopicQuestions(questions, item.id).length +
                      hardTopicQuestions(officialQuestions, item.id).length}{' '}
                    хүнд бодлого
                  </span>
                  <span
                    aria-hidden="true"
                    className="bank-topic-arrow text-leaf-2 transition group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </button>
            ))}
          </nav>
          <Link
            href="/bank?view=official"
            className="text-sm font-semibold text-leaf-2 underline underline-offset-4"
          >
            Албан ёсны асуултын сан · Бүх түвшин
          </Link>
        </>
      ) : (
        <section aria-label={`${label} бодлогууд`} className="space-y-5">
          <button
            type="button"
            onClick={() => {
              setTopic(null);
              setSelected(null);
              setSelectedOfficial(null);
            }}
            className={backButton}
          >
            ← Бүх сэдэв
          </button>
          <h2 className="font-display text-2xl font-bold">{label}</h2>
          {selected || selectedOfficial ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setSelectedOfficial(null);
                }}
                className={backButton}
              >
                ← Сэдвийн бодлогууд
              </button>
              {selected ? (
                <PracticePlayer
                  key={selected.id}
                  questions={[selected]}
                  onNext={nextQuestion}
                  onComplete={backToList}
                  lastInTopic={currentIndex === queue.length - 1}
                />
              ) : (
                selectedOfficial && (
                  <>
                    <OfficialQuestionCard
                      key={selectedOfficial.id}
                      question={selectedOfficial}
                      onNext={nextQuestion}
                      onComplete={backToList}
                      lastInTopic={currentIndex === queue.length - 1}
                      index={officialVisible.findIndex((item) => item.id === selectedOfficial.id) + 1}
                    />
                    <p className="text-sm text-ink-3">Албан ёсны эх сурвалжид тусдаа сэжүүр байхгүй.</p>
                  </>
                )
              )}
            </>
          ) : visible.length + officialVisible.length > 0 ? (
            <>
              {visible.length > 0 && (
                <QuestionBank
                  key={topic}
                  questions={visible}
                  hardOnly
                  hideFilters
                  onSelectQuestion={setSelected}
                />
              )}
              {officialVisible.map((question) => {
                const issue = officialSolveIssue(question);
                return (
                  <article key={question.id} className="section-panel space-y-4 p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <h3 className="font-bold">{question.skill}</h3>
                      <span className="rounded-full bg-sage px-3 py-1 text-xs text-leaf-2">Хүнд</span>
                      <span className="text-ink-3">
                        College Board · {question.id}
                        {question.source ? ` · ${question.source}` : ''}
                      </span>
                    </div>
                    <CbHtml
                      html={question.promptHtml}
                      scope={cbScope(question.id, 'q')}
                      className="text-[17px] leading-relaxed"
                    />
                    <button
                      type="button"
                      disabled={!!issue}
                      onClick={() => setSelectedOfficial(question)}
                      aria-label={`Бодох: ${question.skill} · ${question.id}`}
                      className="rounded-xl bg-leaf px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Бодлого бодох
                    </button>
                    {issue && <p className="text-sm text-ink-3">{issue}</p>}
                  </article>
                );
              })}
            </>
          ) : (
            <div
              role="status"
              className="rounded-3xl border border-dashed border-line-2 bg-paper p-10 text-center"
            >
              <p className="font-bold">{label} сэдэвт хүнд бодлого одоогоор алга байна.</p>
              <p className="mt-2 text-sm text-ink-3">Өөр сэдэв сонгон үргэлжлүүлээрэй.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
