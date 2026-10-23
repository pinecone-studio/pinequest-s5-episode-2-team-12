'use client';
import { motion } from 'framer-motion';
import { Calculator, Map as MapIcon, MessageCircle } from 'lucide-react';
import { CatHead } from '@/components/brand/Cat';
import { Logo } from '@/components/brand/Decor';
import { useT } from '@/lib/i18n-client';

const FEATURES = [
  { key: 'journey', Icon: MapIcon },
  { key: 'desmos', Icon: Calculator },
  { key: 'tutor', Icon: MessageCircle },
] as const;

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } };
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

/** Left column on desktop: logo, headline, the three sections, and Суу saying hi. */
export function BrandPanel() {
  const t = useT('auth');
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="relative hidden flex-col lg:flex"
    >
      <motion.div variants={item}>
        <Logo />
      </motion.div>

      <motion.div variants={item} className="mt-14">
        <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-leaf/30 bg-sage px-3 py-1">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-leaf" />
          </span>
          {t('brand.eyebrow')}
        </span>
      </motion.div>

      <motion.p
        variants={item}
        className="mt-5 max-w-lg font-display text-[2.6rem] font-bold leading-[1.08] tracking-[-0.03em] text-ink xl:text-5xl"
      >
        {t('brand.titleTop')}
        <br />
        <span className="auth-text-accent">{t('brand.titleAccent')}</span>
      </motion.p>

      <motion.p variants={item} className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">
        {t('brand.body')}
      </motion.p>

      <motion.ul variants={container} className="mt-10 space-y-5">
        {FEATURES.map(({ key, Icon }) => (
          <motion.li key={key} variants={item} className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-paper shadow-[var(--soft-shadow)]">
              <Icon aria-hidden="true" className="size-[18px] text-leaf-2" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">{t(`brand.features.${key}.title`)}</p>
              <p className="mt-0.5 text-sm text-ink-3">{t(`brand.features.${key}.body`)}</p>
            </div>
          </motion.li>
        ))}
      </motion.ul>

      <motion.div variants={item} className="mt-12">
        <div className="anim-floaty auth-glass inline-flex items-center gap-4 rounded-3xl p-3 pr-6">
          <CatHead size={64} mood="happy" />
          <p className="max-w-[15rem] text-sm font-medium text-ink">{t('brand.bubble')}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
