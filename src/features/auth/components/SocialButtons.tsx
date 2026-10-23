'use client';
import { motion } from 'framer-motion';
import { LoaderCircle } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import type { SocialProvider } from '../lib/demo-auth';
import { AppleIcon, GitHubIcon, GoogleIcon } from './icons';

export const PROVIDER_NAMES: Record<SocialProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  apple: 'Apple',
};

const PROVIDERS: { id: SocialProvider; Icon: ComponentType<SVGProps<SVGSVGElement>>; glow: string }[] = [
  { id: 'google', Icon: GoogleIcon, glow: 'bg-leaf/40' },
  { id: 'github', Icon: GitHubIcon, glow: 'bg-teal/40' },
  { id: 'apple', Icon: AppleIcon, glow: 'bg-lime/40' },
];

/** Three equal social buttons that lift and glow on hover. */
export function SocialButtons({
  onSelect,
  pending,
  disabled,
}: {
  onSelect: (provider: SocialProvider) => void;
  pending?: SocialProvider | null;
  disabled?: boolean;
}) {
  const t = useT('auth');
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {PROVIDERS.map(({ id, Icon, glow }) => {
        const isPending = pending === id;
        const name = PROVIDER_NAMES[id];
        return (
          <motion.button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            disabled={disabled}
            whileHover={disabled ? undefined : { y: -2 }}
            whileTap={disabled ? undefined : { scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            aria-label={t('social.continue', { provider: name })}
            className={cn('group relative h-12 rounded-2xl', disabled && !isPending && 'opacity-50')}
          >
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute -inset-1 rounded-[20px] opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100 group-disabled:opacity-0',
                glow,
              )}
            />
            <span className="relative flex h-full items-center justify-center gap-2 rounded-2xl border border-line-2 bg-paper text-sm font-bold text-ink-2 transition-colors duration-300 group-hover:border-leaf/60 group-hover:text-ink">
              {isPending ? (
                <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin text-leaf-2" />
              ) : (
                <Icon className="size-[18px] shrink-0" />
              )}
              <span className="hidden sm:inline">{name}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** "──── or ────" with gradient hairlines. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-transparent to-line-2" />
      <span className="eyebrow !text-ink-3">{label}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-l from-transparent to-line-2" />
    </div>
  );
}
