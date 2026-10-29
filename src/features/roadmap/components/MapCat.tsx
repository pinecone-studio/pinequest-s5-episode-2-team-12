import { ACCESSORY_ASSETS } from '@/features/shop/accessories';
import type { AccessorySlot } from '@/features/shop/catalog';
import { itemById } from '@/features/shop/catalog';
import { AnimatedCatImage } from './AnimatedCatImage';
import { OUTFIT_TAILS, SITTING_TAIL } from './cat-tails';

const DEFAULT_BOUNDS = [130, 20, 970, 1220] as const;

function AccessoryLayers({
  accessories,
  bounds,
  sitting = false,
}: {
  accessories: Partial<Record<AccessorySlot, string>>;
  bounds: readonly [number, number, number, number];
  sitting?: boolean;
}) {
  const [x, y, width, height] = bounds;
  return Object.entries(accessories).map(([slot, itemId]) => {
    const layer = itemId ? ACCESSORY_ASSETS[itemId] : undefined;
    if (!layer || layer.slot !== slot) return null;
    const layerHeight = sitting ? undefined : height * ((layer.height * 3.9) / 350);
    const layerWidth = sitting
      ? width * (layer.previewWidth / 52) * 0.62 * (layer.slot === 'eyes' ? 0.88 : 1)
      : (layerHeight ?? 0) * layer.aspect * (layer.slot === 'eyes' ? 0.96 : 1);
    const top = sitting
      ? layer.slot === 'head'
        ? 0.02
        : layer.slot === 'eyes'
          ? 0.32
          : 0.53
      : (layer.top * 3.9) / 350 - (layer.slot === 'eyes' ? 0.01 : layer.slot === 'neck' ? 0.05 : 0);
    const renderedHeight = layerHeight ?? layerHeightForAsset(layer, layerWidth);
    const layerY = y + height * top;
    const leftShift = width * (sitting ? 0.16 : 0.04);
    return (
      <image
        key={itemId}
        data-accessory={itemId}
        href={layer.src}
        x={x + (width - layerWidth) / 2 - leftShift}
        y={layerY}
        width={layerWidth}
        height={renderedHeight}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  });
}

function layerHeightForAsset(layer: (typeof ACCESSORY_ASSETS)[string], width: number) {
  return width / layer.aspect;
}

/** Uses the same equipped shop artwork as the user's avatar. */
export function MapCat({
  outfit,
  accessories = {},
}: {
  outfit?: string;
  accessories?: Partial<Record<AccessorySlot, string>>;
}) {
  const item = outfit ? itemById(outfit) : undefined;
  const clothing = item?.kind === 'outfit' ? item : undefined;
  if (clothing?.art) {
    const [x, y, width, height] = clothing.art;
    const trimGap = y > 0 && !(x === 585 && y === 592);
    return (
      <svg
        viewBox={clothing.art.join(' ')}
        aria-hidden="true"
        focusable="false"
        data-outfit={clothing.id}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      >
        <g
          style={{
            clipPath: trimGap
              ? 'polygon(0 0, 32% 0, 32% 3%, 66% 3%, 66% 0, 100% 0, 100% 100%, 0 100%)'
              : undefined,
          }}
        >
          <AnimatedCatImage
            href="/brand/suu-outfits.webp"
            width={1402}
            height={1122}
            bounds={clothing.art}
            tail={OUTFIT_TAILS[clothing.id]}
          />
          <g className="roadmap-cat-eyelids" fill="#191716">
            <ellipse cx={x + width * 0.3} cy={y + height * 0.37} rx={width * 0.085} ry={height * 0.082} />
            <ellipse cx={x + width * 0.66} cy={y + height * 0.37} rx={width * 0.085} ry={height * 0.082} />
          </g>
        </g>
        <AccessoryLayers accessories={accessories} bounds={clothing.art} />
      </svg>
    );
  }
  return (
    <svg
      viewBox={DEFAULT_BOUNDS.join(' ')}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <AnimatedCatImage
        href="/brand/suu-sitting.webp"
        width={1254}
        height={1254}
        bounds={DEFAULT_BOUNDS}
        tail={SITTING_TAIL}
      />
      <g className="roadmap-cat-eyelids" fill="#171616">
        <ellipse cx="465" cy="520" rx="100" ry="110" />
        <ellipse cx="800" cy="536" rx="98" ry="108" />
        <path
          d="M402 531q65 40 126-2 M739 548q61 38 122-2"
          stroke="#080908"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <AccessoryLayers accessories={accessories} bounds={DEFAULT_BOUNDS} sitting />
    </svg>
  );
}
