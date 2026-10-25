// A student's avatar: a preset (Суу on a colored disc) or, without one, their initial on green. Shop
// cosmetics: a frame ring and an outfit (emoji accessory).
import { itemById } from '@/features/shop/catalog';
import { avatarById } from './avatars';
import { CatHead } from './Cat';

export function Avatar({
  name,
  avatarId,
  size = 42,
  frame,
  outfit,
}: {
  name: string;
  avatarId?: string | null;
  size?: number;
  /** Shop item ids. */
  frame?: string;
  outfit?: string;
}) {
  const preset = avatarById(avatarId);
  const ring = frame ? itemById(frame)?.look : undefined;
  const hat = outfit ? itemById(outfit)?.look : undefined;
  const disc = (
    <span
      className="grid place-items-center overflow-hidden rounded-full font-bold text-[var(--c-on-leaf)] shrink-0"
      style={{
        width: ring ? size - 6 : size,
        height: ring ? size - 6 : size,
        fontSize: size * 0.4,
        background: preset?.bg ?? 'linear-gradient(135deg, var(--c-leaf), var(--c-leaf-2))',
      }}
    >
      {preset ? (
        <CatHead size={Math.round(size * 0.74)} mood={preset.mood} />
      ) : (
        (name.trim()[0] ?? 'S').toUpperCase()
      )}
    </span>
  );
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {ring ? (
        <span
          className="grid place-items-center rounded-full"
          style={{ width: size, height: size, background: ring }}
        >
          {disc}
        </span>
      ) : (
        disc
      )}
      {hat && (
        <span className="absolute -top-[18%] -right-[8%] leading-none" style={{ fontSize: size * 0.42 }}>
          {hat}
        </span>
      )}
    </span>
  );
}
