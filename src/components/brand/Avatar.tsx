// The supplied Suu mascot, with an optional shop outfit and avatar frame.

import { ACCESSORY_ASSETS } from '@/features/shop/accessories';
import type { AccessorySlot } from '@/features/shop/catalog';
import { itemById } from '@/features/shop/catalog';
import { avatarById } from './avatars';
import { MascotArt } from './MascotArt';

export function Avatar({
  name,
  avatarId,
  size = 42,
  frame,
  outfit,
  accessories,
}: {
  name: string;
  avatarId?: string | null;
  size?: number;
  /** Shop item ids. */
  frame?: string;
  outfit?: string;
  accessories?: Partial<Record<AccessorySlot, string>>;
}) {
  const preset = avatarById(avatarId);
  const ring = frame ? itemById(frame)?.look : undefined;
  const clothing = outfit ? itemById(outfit) : undefined;
  const hat = clothing?.accessorySlot ? undefined : clothing?.look;
  const accessoryLayers = Object.entries(accessories ?? {}).flatMap(([slot, itemId]) => {
    const layer = itemId ? ACCESSORY_ASSETS[itemId] : undefined;
    if (!layer || layer.slot !== slot) return [];
    const avatarScale = size / 52;
    const accessoryScale = avatarScale * 0.82;
    const accessoryWidth = layer.previewWidth * accessoryScale;
    const anchorTop = (layer.previewTop - 6) * avatarScale;
    const centeredTop =
      anchorTop +
      (layer.previewWidth * avatarScale - accessoryWidth) / (2 * layer.aspect) -
      (layer.slot === 'eyes' || layer.slot === 'neck' ? 8 * avatarScale : 0);
    const zIndex = layer.slot === 'eyes' ? 30 : layer.slot === 'head' ? 20 : 10;
    return [
      // biome-ignore lint/performance/noImgElement: transparent accessory art is layered over the shared avatar
      <img
        key={itemId}
        src={layer.src}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 object-contain"
        style={{
          top: centeredTop,
          width: accessoryWidth,
          transform: 'translateX(-50%)',
          zIndex,
        }}
      />,
    ];
  });
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
      {accessoryLayers}
      {hat && (
        <span className="absolute -top-[18%] -right-[8%] leading-none" style={{ fontSize: size * 0.42 }}>
          {hat}
        </span>
      )}
    </span>
  );
}
