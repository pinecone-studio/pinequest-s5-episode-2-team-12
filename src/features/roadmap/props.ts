// Decorative props on the map (trees, gers). Coordinates WGS84; `bun run roadmap:map` projects them.
export const PROPS = {
  /** Tree clusters on the forested northern mountains. */
  trees: [
    { lat: 50.75, lng: 99.9 }, // Хөвсгөл
    { lat: 49.9, lng: 101.6 },
    { lat: 48.25, lng: 100.4 }, // Хангай, Архангай
    { lat: 47.75, lng: 102.0 },
    { lat: 49.4, lng: 107.3 }, // Сэлэнгэ
    { lat: 48.6, lng: 108.9 }, // Хэнтий
    { lat: 48.2, lng: 110.3 },
  ],
  /** Gers near Ulaanbaatar and Kharkhorin. */
  gers: [
    { lat: 47.3, lng: 106.3 },
    { lat: 47.45, lng: 102.55 },
  ],
} as const;
