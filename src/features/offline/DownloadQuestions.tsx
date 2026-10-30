'use client';
import { useState } from 'react';
import type { OfficialQuestion } from '@/features/practice/lib/official';
import { useT } from '@/lib/i18n-client';
import { currentOwner, installOfflineWorker, updateOffline } from './storage';

async function embedImages(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const img of doc.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    const response = await fetch(new URL(src, location.href));
    if (!response.ok) throw new Error('image');
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    img.setAttribute('src', data);
    img.removeAttribute('srcset');
    img.removeAttribute('loading');
  }
  return doc.body.innerHTML;
}

export function DownloadQuestions({ questions }: { questions: OfficialQuestion[] }) {
  const t = useT('practice');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    setStatus(t('offline.downloading'));
    try {
      await installOfflineWorker();
      const owner = await currentOwner();
      const saved: OfficialQuestion[] = [];
      for (const q of questions)
        saved.push({
          ...q,
          promptHtml: await embedImages(q.promptHtml),
          explanationHtml: await embedImages(q.explanationHtml),
          choices: await Promise.all(q.choices.map(async (c) => ({ ...c, html: await embedImages(c.html) }))),
        });
      await updateOffline((data) => ({
        ...data,
        owner,
        questions: [
          ...data.questions.filter((item) => !saved.some((q) => q.id === item.question.id)),
          ...saved.map(
            (question) => data.questions.find((item) => item.question.id === question.id) ?? { question },
          ),
        ],
      }));
      setStatus(t('offline.downloaded', { n: saved.length }));
    } catch {
      setStatus(t('offline.downloadError'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section-panel flex flex-wrap items-center gap-4 p-5">
      <button
        type="button"
        className="rounded-xl bg-leaf px-4 py-3 font-bold text-white"
        disabled={busy}
        onClick={download}
      >
        {t('offline.download')}
      </button>
      <a href="/offline" className="font-bold underline">
        {t('offline.open')}
      </a>
      <p role="status" className="text-sm">
        {status || t('offline.downloadHint')}
      </p>
    </section>
  );
}
