import { type PickInput, type PickRow, rankPicks } from "@/lib/picks";
import { buildSquad, type SquadResult } from "@/lib/squad";

/**
 * Ana iş parçacığını dolduran hesap: kadro kurma (gerçek havuzda ~0,3 s).
 * Kaydırak oynatılınca ekran donuyordu. Arayüz bunu bir Web Worker'a
 * gönderiyor; burada yalnız saf iş tanımı ve hesap var, hem worker hem ana iş
 * parçacığı aynı `runJob`'u çağırıyor.
 *
 * İş, sıralama **satırlarını** değil sıralamanın **girdisini** taşıyor:
 * satırlar worker'da kendi oyuncu havuzundan yeniden kuruluyor. Böylece 500+
 * oyuncunun nesnesi sınırdan geçmiyor ve sonuç ana iş parçacığındaki hesapla
 * birebir aynı kalıyor.
 *
 * Şimdilik tek iş türü var. Joker ve transfer hesapları Faz 4'e ait; olmayan
 * özellik için iş türü açılmıyor.
 */

/** Sıralamanın girdisi; `usePickRows`'un kullandığı alanlar. */
export type PickArgs = Pick<
  PickInput,
  "results" | "ctx" | "weekWeights" | "weights" | "minutesImpact" | "selInvert"
>;

export type SquadJob = {
  kind: "squad";
  picks: PickArgs;
  benchWeight: number;
  /** Kilitli ve dışlanan oyuncu anahtarları (`takım|ad`). */
  locked: string[];
  excluded: string[];
};

export type Job = SquadJob;

/** Anahtar sırası sabit JSON: aynı değerler her yerde aynı metni versin. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** 53 bitlik özet (cyrb53); anahtar kısa kalsın. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + text.length.toString(36);
}

/**
 * İşin kimliği. Kilit ve dışlama listeleri sıralanıyor: aynı küme farklı sırada
 * geldiğinde ayrı anahtar üretip aynı hesabı iki kez yaptırmasın.
 */
export function jobKey(job: Job): string {
  return hash(
    stable({ ...job, locked: [...job.locked].sort(), excluded: [...job.excluded].sort() }),
  );
}

// Aynı sıralama girdisi art arda gelirse satırlar yeniden hesaplanmasın.
// Tek girişlik önbellek yeterli.
let lastRows: { key: string; rows: PickRow[] } | null = null;

/** Sıralama satırları; girdi bir öncekiyle aynıysa önbellekten. */
export function rowsFor(picks: PickArgs): PickRow[] {
  const key = hash(stable(picks));
  if (lastRows?.key !== key) lastRows = { key, rows: rankPicks(picks) };
  return lastRows.rows;
}

export function runJob(job: Job): SquadResult {
  const rows = rowsFor(job.picks);
  return buildSquad(rows, {
    benchWeight: job.benchWeight,
    locked: job.locked,
    excluded: job.excluded,
  });
}
