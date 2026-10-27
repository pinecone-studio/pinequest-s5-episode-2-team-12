import { useId } from 'react';
import type { CatTail } from './cat-tails';

/**
 * Separate display layers let the tail sway while the body and clothing stay still. The tail is drawn
 * first, behind the body, and reaches under it near the base, so the joint never opens while it swings.
 */
export function AnimatedCatImage({
  href,
  width,
  height,
  bounds,
  tail,
}: {
  href: string;
  width: number;
  height: number;
  bounds: readonly [number, number, number, number];
  /** Without a traced tail the cat is shown still. */
  tail?: CatTail;
}) {
  const id = useId().replace(/:/g, '');
  if (!tail) return <image href={href} width={width} height={height} />;
  // fill-box is the image's own box (clipping does not change it), so a percentage origin is the same
  // point in every browser
  const origin = `${(tail.pivot[0] / width) * 100}% ${(tail.pivot[1] / height) * 100}%`;
  return (
    <>
      <defs>
        <mask
          id={`${id}-body`}
          maskUnits="userSpaceOnUse"
          x={bounds[0]}
          y={bounds[1]}
          width={bounds[2]}
          height={bounds[3]}
        >
          <rect x={bounds[0]} y={bounds[1]} width={bounds[2]} height={bounds[3]} fill="white" />
          <path d={tail.hole} fill="black" />
        </mask>
        <clipPath id={`${id}-tail`}>
          <path d={tail.under} />
        </clipPath>
      </defs>
      <g className="roadmap-cat-tail" style={{ transformOrigin: origin }}>
        <image href={href} width={width} height={height} clipPath={`url(#${id}-tail)`} />
      </g>
      <image href={href} width={width} height={height} mask={`url(#${id}-body)`} />
    </>
  );
}
