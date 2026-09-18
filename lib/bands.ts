/**
 * Zorluk renk bantları. Tek gerçek kaynak burasıdır: tablo, şerit ve lejant
 * hep buradan beslenir, renk kodu bileşenlere dağılmaz.
 */
import type { ThemeKey } from "@/lib/theme";

/** Bant adları arayüz dilinde: lib/i18n.ts `bands` altında. */
export type BandKey = "vEasy" | "easy" | "mid" | "hard" | "vHard";

export type Band = {
  key: BandKey;
  /** Bandın üst sınırı (dahil). */
  upTo: number;
  fill: string;
  /** Renkli zemin üstünde okunacak metin rengi. */
  ink: string;
  /**
   * Açık temanın karşılıkları. Pastel skala aynı kalıyor; açık zeminde dolgu
   * tek başına 3:1'i tutturamadığı için hücre kendi dolgusunun koyu tonunda
   * ince çerçeve alıyor.
   *
   * Değerler `../ucl-fantasy-planner`'da ölçülerek seçildi ve oradan
   * devralındı — burada yeniden ölçülmedi. İki projenin bant skalası birebir
   * aynı olduğu için devralma geçerli; farklılaşırlarsa yeniden ölçülmeli.
   */
  light: { fill: string; ink: string; border: string };
};

export const BANDS: Band[] = [
  { key: "vEasy", upTo: 1.8, fill: "#27AE60", ink: "#04200D",
    light: { fill: "#1F7A46", ink: "#FFFFFF", border: "#12492A" } },
  { key: "easy", upTo: 2.6, fill: "#A9DFBF", ink: "#0B2A15",
    light: { fill: "#8FD3AB", ink: "#0B2A15", border: "#3F8A60" } },
  { key: "mid", upTo: 3.4, fill: "#F9E79F", ink: "#3A2E00",
    light: { fill: "#F2D98B", ink: "#3A2E00", border: "#94781F" } },
  { key: "hard", upTo: 4.2, fill: "#F5B041", ink: "#3A1E00",
    light: { fill: "#E08A2E", ink: "#2B1600", border: "#8A4F11" } },
  { key: "vHard", upTo: 5, fill: "#C0392B", ink: "#FFFFFF",
    light: { fill: "#B3261E", ink: "#FFFFFF", border: "#7A1A14" } },
];

/** Bandın o temadaki renkleri; çizen yerler rengi buradan alır, kod dağılmaz. */
export function bandColors(band: Band, theme: ThemeKey): {
  fill: string;
  ink: string;
  border: string | null;
} {
  return theme === "light"
    ? { fill: band.light.fill, ink: band.light.ink, border: band.light.border }
    : { fill: band.fill, ink: band.ink, border: null };
}

/** Bant hücresinin satır içi stili: açık temada çerçeve de var, koyuda yok. */
export function bandStyle(
  theme: ThemeKey,
  band: Band,
): { background: string; color: string; border?: string } {
  const c = bandColors(band, theme);
  return c.border
    ? { background: c.fill, color: c.ink, border: `1px solid ${c.border}` }
    : { background: c.fill, color: c.ink };
}

export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 5;

export function bandOf(value: number): Band {
  return BANDS.find((b) => value <= b.upTo + 1e-9) ?? BANDS[BANDS.length - 1];
}

/** Lejant için bandın alt sınırı. */
export function bandFloor(index: number): number {
  return index === 0 ? DIFFICULTY_MIN : BANDS[index - 1].upTo;
}

/**
 * Kadro sahasındaki rol renkleri: kaptan, yardımcı, ilk 11, yedek.
 *
 * `xi` ve `bench` koyu zemine göre seçilmişti (koyu gri dolgu, açık mürekkep);
 * açık temada aynı değerler sayfanın geri kalanıyla çakışıyor, o yüzden tema
 * başına ayrı tablo var. Kaptan sarısı ve yardımcı yeşili iki temada da
 * okunuyor, onlar aynı kalıyor.
 */
export type RoleKey = "captain" | "vice" | "xi" | "bench";

type RoleStyle = { fill: string; ink: string };

const ROLE_STYLES: Record<ThemeKey, Record<RoleKey, RoleStyle>> = {
  dark: {
    captain: { fill: "#F5C542", ink: "#2A1F00" },
    vice: { fill: "#A9DFBF", ink: "#0B2A15" },
    xi: { fill: "#212127", ink: "#F4F4F5" },
    bench: { fill: "#6b6b76", ink: "#0b0b0d" },
  },
  light: {
    captain: { fill: "#F5C542", ink: "#2A1F00" },
    vice: { fill: "#A9DFBF", ink: "#0B2A15" },
    xi: { fill: "#FFFFFF", ink: "#12151C" },
    bench: { fill: "#E4E7EE", ink: "#333949" },
  },
};

/** Rol renkleri seçili temaya göre. */
export function roleStyle(theme: ThemeKey): Record<RoleKey, RoleStyle> {
  return ROLE_STYLES[theme];
}
