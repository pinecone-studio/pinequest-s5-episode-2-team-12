/** Render one window of the supplied artwork without changing the original files. */
export function MascotArt({
  art,
  size = 96,
  className,
}: {
  art?: readonly [number, number, number, number];
  size?: number;
  className?: string;
}) {
  const bounds = art ?? [120, 150, 1020, 1020];
  // Match the viewport to the selected window so adjacent outfits cannot show in letterboxing.
  const width = (size * bounds[2]) / bounds[3];
  // Lower rows overlap the preceding row's paws between the cat's ears.
  // Hide that narrow gap while preserving the ears and the graduation cap.
  const trimGap = art && art[1] > 0 && !(art[0] === 585 && art[1] === 592);
  return (
    <svg
      viewBox={bounds.join(' ')}
      width={width}
      height={size}
      style={{
        width,
        height: size,
        clipPath: trimGap
          ? 'polygon(0 0, 32% 0, 32% 3%, 66% 3%, 66% 0, 100% 0, 100% 100%, 0 100%)'
          : undefined,
      }}
      className={className}
      aria-hidden="true"
      overflow="hidden"
    >
      <image
        href={art ? '/brand/suu-outfits.webp' : '/brand/suu-logo-head.webp'}
        width={art ? 1402 : 1254}
        height={art ? 1122 : 1254}
      />
    </svg>
  );
}
