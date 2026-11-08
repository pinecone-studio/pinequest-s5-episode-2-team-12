import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'soft' | 'danger' | 'lime' | 'teal';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

/** [face, extruded edge, text] — all tokens, optimized for both light & dark modes. */
const FACE: Record<Exclude<ButtonVariant, 'ghost'>, [string, string, string]> = {
  // Primary: cleaner, greener — uses leaf/forest palette for both light & dark modes
  primary: ['var(--c-leaf)', 'var(--c-leaf-2)', 'var(--c-on-leaf)'],
  // Dark mode дээр --c-paper цагаан байвал хар бараан өнгөөр сольж болно
  secondary: [
    'var(--c-paper, #ffffff)',
    'var(--c-line-2, #e5e5e5)',
    'var(--c-ink, #171717)'
  ],
  dark: ['var(--c-forest-2)', 'var(--c-edge)', 'var(--c-on-forest)'],
  soft: ['var(--c-sage)', 'var(--c-sage-2)', 'var(--c-leaf-ink)'],
  danger: [
    'var(--c-danger-soft)',
    'color-mix(in srgb, var(--c-danger) 45%, var(--c-danger-soft))',
    'var(--c-danger)',
  ],
  lime: ['var(--c-lime)', 'var(--c-lime-2)', 'var(--c-on-lime)'],
  teal: ['var(--c-teal)', 'var(--c-teal-2)', 'var(--c-on-leaf)'],
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[13px] rounded-xl gap-1.5',
  md: 'h-11 px-5 text-[14px] rounded-2xl gap-2',
  lg: 'h-[52px] px-7 text-[15px] rounded-2xl gap-2.5',
  xl: 'h-14 px-8 text-[16px] rounded-2xl gap-3',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

/** 3D press button: an extruded edge that sinks 4px on :active. */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  icon,
  style,
  type = 'button',
  ...rest
}: ButtonProps) {
  if (variant === 'ghost') {
    return (
      <button
        type={type}
        className={cn(
          'inline-flex items-center justify-center font-bold transition-colors',
          'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
          'dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
          'disabled:opacity-40',
          SIZE[size],
          className,
        )}
        style={style}
        data-variant={variant}
        {...rest}
      >
        {icon}
        {children}
      </button>
    );
  }

  const [face, edge, fg] = FACE[variant];

  return (
    <button
      type={type}
      className={cn(
        'btn3d inline-flex items-center justify-center font-bold mb-[5px] transition-all',
        // Secondary: paper surface with subtle border — uses theme tokens for both light & dark
        variant === 'secondary' && 'border-[1.5px] border-line bg-paper text-ink hover:bg-paper-2',
        SIZE[size],
        className,
      )}
      style={
        {
          '--face': face,
          '--edge': edge,
          color: fg,
          ...style,
        } as CSSProperties
      }
      data-variant={variant}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}