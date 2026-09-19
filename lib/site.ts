/**
 * Sitenin genel adresi. Tek yerde: yerleşimdeki meta veriler, `robots.ts` ve
 * `sitemap.ts` aynı değeri okumalı — ikisi ayrışırsa arama motoruna kendi
 * adresini yanlış bildiren bir site çıkar.
 *
 * Veri içermeyen modül (bkz. FR-PERF-01): adres hesaplamak için ağır JSON
 * modüllerini pakete sokmasın.
 */
export const SITE = "https://tff-fl-planner.vercel.app";

/** Gezinmedeki bölümler + dipnottaki yöntem sayfası. */
export const STATIC_ROUTES = [
  "/",
  "/teams",
  "/players",
  "/squad",
  "/results",
  "/season",
  "/methodology",
] as const;
