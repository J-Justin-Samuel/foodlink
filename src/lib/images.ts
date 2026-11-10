/**
 * Every photo on the public pages comes from this one list, so swapping a photo
 * means changing one line. They are Unsplash photos (free to use). Each one has a
 * fallback tile, so a dead link never leaves a hole in the layout. To use your own
 * photos, put them in /public/images and point these at "/images/<name>.jpg".
 */
const u = (id: string, w = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

export const IMG = {
  bowl: {
    src: u("1546069901-ba9599a7e63c", 1100),
    alt: "A colourful salad bowl",
    emoji: "🥗",
  },
  plate: {
    src: u("1504674900247-0877df9cc836"),
    alt: "A plated meal with vegetables",
    emoji: "🍽️",
  },
  veg: {
    src: u("1540189549336-e6e99c3679fe"),
    alt: "Fresh vegetables on a table",
    emoji: "🥬",
  },
  bread: {
    src: u("1509440159596-0249088772ff"),
    alt: "Loaves of fresh bread",
    emoji: "🍞",
  },
  healthy: {
    src: u("1512621776951-a57141f2eefd"),
    alt: "A healthy grain bowl",
    emoji: "🥙",
  },
  market: {
    src: u("1488459716781-31db52582fe9"),
    alt: "Fresh produce at a market",
    emoji: "🍅",
  },
  pancakes: {
    src: u("1567620905732-2d1ec7ab7445"),
    alt: "A stack of pancakes with fruit",
    emoji: "🥞",
  },
  grill: {
    src: u("1555939594-58d7cb561ad1"),
    alt: "Grilled skewers",
    emoji: "🍢",
  },
} as const;

export type ImageKey = keyof typeof IMG;
