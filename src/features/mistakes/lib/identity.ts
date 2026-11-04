export type QuestionSource = 'practice' | 'official';
export type QuestionRef = { qid: string; questionSource?: QuestionSource };
export function noteKey(ref: QuestionRef): string {
  return ref.questionSource === 'official' ? `official:${ref.qid}` : ref.qid;
}
