// The supplied Suu mascot, with an optional shop outfit and avatar frame.
import { itemById } from '@/features/shop/catalog';
import { avatarById } from './avatars';
import { MascotArt } from './MascotArt';

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
  const clothing = outfit ? itemById(outfit) : undefined;
  const hat = clothing?.look;
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
      <MascotArt art={clothing?.art} size={Math.round(size * 0.9)} />
    </span>
  );
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
      title={name}
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
