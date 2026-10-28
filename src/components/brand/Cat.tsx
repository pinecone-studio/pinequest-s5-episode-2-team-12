import type { CSSProperties } from 'react';
import { MascotArt } from './MascotArt';

export type CatMood = 'idle' | 'happy' | 'think' | 'wow' | 'sleep' | 'wink' | 'focus';

type CatProps = {
  size?: number;
  mood?: CatMood;
  look?: number;
  className?: string;
  style?: CSSProperties;
};

/** All legacy mascot entry points now use the current Suu logo artwork. */
export function CatHead({ size = 96, className, style }: CatProps) {
  return (
    <span
      role="img"
      aria-label="Суу муур"
      className={className}
      style={{ display: 'inline-flex', flexShrink: 0, ...style }}
    >
      <MascotArt size={size} />
    </span>
  );
}

export function CatSitting({ size = 140, ...props }: CatProps & { scarf?: boolean }) {
  return <CatHead {...props} size={size} />;
}

export function CatPeek({ size = 120, ...props }: CatProps) {
  return <CatHead {...props} size={size} />;
}

export function CatSleeping({ size = 120, ...props }: CatProps) {
  return <CatHead {...props} size={size} />;
}
