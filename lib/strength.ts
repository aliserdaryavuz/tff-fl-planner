import { computeTable, teamIds, teams } from "@/lib/data";

/**
 * Güç kaynakları. Hepsi 18 takım içinde 0-100'e yayılır (en zayıf 0, en güçlü
 * 100), böylece farklı birimler (Opta puanı, milyon €, sıra, maç başına puan)
 * ağırlıklı ortalamada karşılaştırılabilir hale gelir.
 */
export type SourceKey = "opta" | "value" | "last" | "table" | "elo";

export type SourceWeights = Partial<Record<SourceKey, number>>;

/** Ad ve açıklamalar arayüz dilinde: lib/i18n.ts `sources` altında. */
export type SourceInfo = { key: SourceKey };

export const SOURCES: SourceInfo[] = [
  { key: "opta" },
  { key: "value" },
  { key: "last" },
  { key: "table" },
  { key: "elo" },
];

/** Ham değerleri 18 takım içinde 0-100'e yayar. */
function spread(raw: Record<string, number>): Record<string, number> {
  const values = Object.values(raw);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const out: Record<string, number> = {};
  for (const id of teamIds) {
    out[id] = max > min ? (100 * (raw[id] - min)) / (max - min) : 50;
  }
  return out;
}

let tableCache: Record<string, number> | null = null;

function rawValues(key: SourceKey): Record<string, number> | null {
  switch (key) {
    case "opta":
      return teams.every((t) => t.opta != null)
        ? Object.fromEntries(teams.map((t) => [t.id, t.opta as number]))
        : null;
    case "value":
      // Para logaritmik dağılır: ham euroda tek takım ölçeği eziyor.
      return teams.every((t) => (t.value ?? 0) > 0)
        ? Object.fromEntries(
            teams.map((t) => [t.id, Math.log(t.value as number)]),
          )
        : null;
    case "last":
      // 1. sıra en güçlü: 19 - sıra.
      return Object.fromEntries(teams.map((t) => [t.id, 19 - t.last]));
    case "table": {
      // Bu sezon maç başına puan; herkes en az bir maç oynamışsa.
      if (!tableCache) {
        const table = computeTable();
        tableCache = table.every((r) => r.p > 0)
          ? Object.fromEntries(table.map((r) => [r.id, r.ppg]))
          : {};
      }
      return Object.keys(tableCache).length ? tableCache : null;
    }
    case "elo":
      return teams.every((t) => t.elo != null)
        ? Object.fromEntries(teams.map((t) => [t.id, t.elo as number]))
        : null;
  }
}

/** Veri dosyasında karşılığı olan kaynaklar. */
export function availableSources(): SourceInfo[] {
  return SOURCES.filter((s) => rawValues(s.key) !== null);
}

export function isSourceAvailable(key: SourceKey): boolean {
  return rawValues(key) !== null;
}

/** Tek kaynağın 0-100 güç tablosu. Veri yoksa null. */
export function sourceStrength(key: SourceKey): Record<string, number> | null {
  const raw = rawValues(key);
  return raw ? spread(raw) : null;
}

/**
 * Ağırlıklı karma güç. Ağırlıklar toplamı 1'e normalize edilir; hepsi sıfırsa
 * (ya da hiçbiri geçerli değilse) eldeki kaynakların düz ortalaması alınır.
 * `gamma` karışımdan sonra uygulanır: güç = 100 · (g/100)^γ.
 */
export function blendedStrength(
  weights: SourceWeights,
  gamma = 1,
): Record<string, number> {
  const usable = availableSources()
    .map((s) => ({ key: s.key, weight: Math.max(0, weights[s.key] ?? 0) }))
    .filter((s) => s.weight > 0);

  const parts = usable.length
    ? usable
    : availableSources().map((s) => ({ key: s.key, weight: 1 }));

  const total = parts.reduce((sum, p) => sum + p.weight, 0);
  const tables = parts.map((p) => ({
    weight: p.weight / total,
    table: sourceStrength(p.key) as Record<string, number>,
  }));

  const out: Record<string, number> = {};
  for (const id of teamIds) {
    const g = tables.reduce((sum, t) => sum + t.weight * t.table[id], 0);
    out[id] = 100 * Math.pow(g / 100, gamma);
  }
  return out;
}

/** Ağırlıkların yüzde payı; arayüzde "bu kaynak %kaç" diye gösterilir. */
export function weightShares(weights: SourceWeights): Record<string, number> {
  const usable = availableSources().map((s) => ({
    key: s.key,
    weight: Math.max(0, weights[s.key] ?? 0),
  }));
  const total = usable.reduce((sum, p) => sum + p.weight, 0);
  const shares: Record<string, number> = {};
  for (const p of usable) {
    shares[p.key] = total > 0 ? (100 * p.weight) / total : 100 / usable.length;
  }
  return shares;
}

/** Karışımda fiilen kullanılan kaynak sayısı (0 = düz ortalamaya düşüldü). */
export function activeSourceCount(weights: SourceWeights): number {
  return availableSources().filter((s) => (weights[s.key] ?? 0) > 0).length;
}
