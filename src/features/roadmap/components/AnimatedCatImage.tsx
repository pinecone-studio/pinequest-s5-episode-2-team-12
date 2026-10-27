import { useId } from 'react';

/** Separate display layers let the tail sway while the body and clothing stay still. */
export function AnimatedCatImage({
  href,
  width,
  height,
  bounds,
  tail,
  pivot,
}: {
  href: string;
  width: number;
  height: number;
  bounds: readonly [number, number, number, number];
  tail: string;
  pivot: readonly [number, number];
}) {
  const id = useId().replace(/:/g, '');
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
          <path d={tail} fill="black" />
        </mask>
        <clipPath id={`${id}-tail`}>
          <path d={tail} />
        </clipPath>
      </defs>
      <image href={href} width={width} height={height} mask={`url(#${id}-body)`} />
      <g
        className="roadmap-cat-tail"
        style={{ transformOrigin: `${pivot[0] - bounds[0]}px ${pivot[1] - bounds[1]}px` }}
      >
        <image href={href} width={width} height={height} clipPath={`url(#${id}-tail)`} />
      </g>
    </>
  );
}
