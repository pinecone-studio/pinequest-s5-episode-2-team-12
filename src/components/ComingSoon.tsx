import Link from 'next/link';
import { CatSleeping } from '@/components/brand';
import { Pill } from '@/components/ui/Pill';
import { getT } from '@/lib/i18n';
import { routes } from '@/lib/routes';

export const PROTOTYPE_URL = 'https://claude.ai/artifact/Qa2ruJcMEp3fZ38jzed8AP';

/** Placeholder every page starts with. The section owner replaces it with the real screen. */
export function ComingSoon({
  section,
  title,
  tasks,
  detail,
}: {
  section: string;
  title: string;
  tasks: string;
  detail?: string;
}) {
  const t = getT('common');
  return (
    <section className="grid gap-6">
      <header>
        <div className="eyebrow mb-2">{t('placeholder.section', { section })}</div>
        <h1 className="font-display font-extrabold text-[26px] md:text-[34px] leading-tight text-ink">
          {title}
        </h1>
        {detail && <p className="mt-1 font-mono text-[13px] text-ink-3">{detail}</p>}
      </header>
      <div className="card p-8 md:p-10 grid justify-items-center gap-4 text-center">
        <CatSleeping size={170} />
        <p className="font-display font-bold text-ink">{t('placeholder.title')}</p>
        <Pill tone="leaf">{t('placeholder.tasks', { tasks })}</Pill>
        <div className="flex flex-wrap justify-center gap-4 text-[14px] font-bold">
          <a className="text-leaf-2 underline" href={PROTOTYPE_URL} target="_blank" rel="noreferrer">
            {t('placeholder.prototype')}
          </a>
          <Link className="text-ink-2 underline" href={routes.home}>
            {t('placeholder.back')}
          </Link>
        </div>
      </div>
    </section>
  );
}
