import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'soft' | 'danger' | 'lime' | 'teal';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

/** [face, extruded edge, text] — all tokens, so dark/light switch automatically. */
const FACE: Record<Exclude<ButtonVariant, 'ghost'>, [string, string, string]> = {
  primary: ['var(--c-lime)', 'var(--c-lime-2)', 'var(--c-on-lime)'],
  secondary: ['var(--c-paper)', 'var(--c-line-2)', 'var(--c-ink)'],
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
  /** The roadmap stop's main call to action. */
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
          'inline-flex items-center justify-center font-bold transition-colors text-ink-2 hover:bg-paper-2 hover:text-ink disabled:opacity-40',
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
        'btn3d inline-flex items-center justify-center font-bold mb-[5px]',
        variant === 'secondary' && 'border-[1.5px] border-line-2',
        SIZE[size],
        className,
      )}
      style={{ '--face': face, '--edge': edge, color: fg, ...style } as CSSProperties}
      data-variant={variant}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
