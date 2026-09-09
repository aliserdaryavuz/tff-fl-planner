/**
 * Zorluk renk bantları. Tek gerçek kaynak burasıdır: tablo, şerit ve lejant
 * hep buradan beslenir, renk kodu bileşenlere dağılmaz.
 */
/** Bant adları arayüz dilinde: lib/i18n.ts `bands` altında. */
export type BandKey = "vEasy" | "easy" | "mid" | "hard" | "vHard";

export type Band = {
  key: BandKey;
  /** Bandın üst sınırı (dahil). */
  upTo: number;
  fill: string;
  /** Renkli zemin üstünde okunacak metin rengi. */
  ink: string;
};

export const BANDS: Band[] = [
  { key: "vEasy", upTo: 1.8, fill: "#27AE60", ink: "#04200D" },
  { key: "easy", upTo: 2.6, fill: "#A9DFBF", ink: "#0B2A15" },
  { key: "mid", upTo: 3.4, fill: "#F9E79F", ink: "#3A2E00" },
  { key: "hard", upTo: 4.2, fill: "#F5B041", ink: "#3A1E00" },
  { key: "vHard", upTo: 5, fill: "#C0392B", ink: "#FFFFFF" },
];

export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 5;

export function bandOf(value: number): Band {
  return BANDS.find((b) => value <= b.upTo + 1e-9) ?? BANDS[BANDS.length - 1];
}

/** Lejant için bandın alt sınırı. */
export function bandFloor(index: number): number {
  return index === 0 ? DIFFICULTY_MIN : BANDS[index - 1].upTo;
}

/** Kadro sahasındaki rol renkleri: kaptan, yardımcı, ilk 11, yedek. */
export const ROLE_STYLE = {
  captain: { fill: "#F5C542", ink: "#2A1F00" },
  vice: { fill: "#A9DFBF", ink: "#0B2A15" },
  xi: { fill: "#212127", ink: "#F4F4F5" },
  bench: { fill: "#6b6b76", ink: "#0b0b0d" },
} as const;

export type RoleKey = keyof typeof ROLE_STYLE;
