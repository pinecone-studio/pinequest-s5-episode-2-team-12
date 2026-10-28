import { itemById } from '@/features/shop/catalog';
import { AnimatedCatImage } from './AnimatedCatImage';
import { OUTFIT_TAILS, SITTING_TAIL } from './cat-tails';

/** Uses the same equipped shop artwork as the user's avatar. */
export function MapCat({ outfit }: { outfit?: string }) {
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
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
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
      </svg>
    );
  }
  return (
    <svg
      viewBox="130 20 970 1220"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <AnimatedCatImage
        href="/brand/suu-sitting.webp"
        width={1254}
        height={1254}
        bounds={[130, 20, 970, 1220]}
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
      {clothing?.look && (
        <text x="760" y="210" fontSize="230" textAnchor="middle">
          {clothing.look}
        </text>
      )}
    </svg>
  );
}
