import {
  byId,
  type HomeAway,
  MATCHDAYS,
  schedule,
  teamIds,
} from "@/lib/data";
import { clamp, round1 } from "@/lib/num";
import { blendedStrength, type SourceWeights } from "@/lib/strength";

/** Model parametreleri: kaynak ağırlıkları + eğri + ev avantajı. */
export type StrengthParams = {
  ha: number;
  gamma: number;
  weights: SourceWeights;
};

export type ModelParams = {
  /** Rakip bazlı: sadece rakibin gücüne bakar. */
  abs: StrengthParams;
  /** Göreli: seçili takımın kendi gücü de hesaba girer. */
  rel: StrengthParams;
};

export type ModelKey = keyof ModelParams;

export const MODEL_KEYS: ModelKey[] = ["abs", "rel"];

/** Opta ve kadro değeri tam, geçen sezon ve bu sezonun tablosu yarım ağırlıkta. */
const DEFAULT_WEIGHTS: SourceWeights = {
  opta: 100,
  value: 100,
  last: 50,
  table: 50,
};

export const DEFAULT_PARAMS: ModelParams = {
  abs: { ha: 6, gamma: 1, weights: DEFAULT_WEIGHTS },
  rel: { ha: 6, gamma: 1, weights: DEFAULT_WEIGHTS },
};

/** Etiket ve açıklamalar arayüz dilinde: lib/i18n.ts `model.params` altında. */
export type RangeSpec = {
  kind: "range";
  key: "ha" | "gamma";
  min: number;
  max: number;
  step: number;
};

export type WeightsSpec = {
  kind: "weights";
  key: "weights";
};

export type ParamSpec = RangeSpec | WeightsSpec;

/** İki model de aynı parametreleri kullanır. */
export const MODEL_PARAMS: ParamSpec[] = [
  { kind: "weights", key: "weights" },
  { kind: "range", key: "ha", min: 0, max: 15, step: 0.5 },
  { kind: "range", key: "gamma", min: 0.5, max: 2, step: 0.05 },
];

/** Deplasmanda rakibe +HA, evde -HA. */
export function withHomeAway(strength: number, ha: HomeAway, advantage: number) {
  return strength + (ha === "D" ? advantage : -advantage);
}

/** Rakip bazlı. `strength` 0-100 ölçeğinde rakip gücü. */
export function strengthDifficulty(
  oppStrength: number,
  ha: HomeAway,
  p: Pick<StrengthParams, "ha">,
): number {
  return 1 + (4 * clamp(withHomeAway(oppStrength, ha, p.ha), 0, 100)) / 100;
}

/**
 * Göreli. İki takımın 0-100 gücü arasındaki fark (-100..+100) 1-5'e
 * yayılır; eşit güç ve nötr saha tam 3,0 verir.
 */
export function strengthRelDifficulty(
  myStrength: number,
  oppStrength: number,
  ha: HomeAway,
  p: Pick<StrengthParams, "ha">,
): number {
  const d = withHomeAway(oppStrength, ha, p.ha) - myStrength;
  return 1 + 4 * clamp((d + 100) / 200, 0, 1);
}

/** Modelin ağırlıklarına göre karma 0-100 güç tablosu. */
export function strengthTable(p: StrengthParams): Record<string, number> {
  return blendedStrength(p.weights, p.gamma);
}

export type TeamResult = {
  /** 34 maçın zorluğu, hafta sırasında, 1 ondalığa yuvarlanmış. */
  diffs: number[];
  /** Seçili haftaların toplamı. */
  total: number;
  /** Seçili haftaların ortalaması. */
  avg: number;
  /** Hesaba katılan hafta sayısı. */
  n: number;
  /** 18 takım içinde sıra (1 = en kolay). */
  rank: number;
};

export type ComputeInput = {
  model: ModelKey;
  params: ModelParams;
  /** 34 elemanlı hafta maskesi; verilmezse tüm haftalar. */
  weeks?: boolean[];
};

export type ComputeResult = {
  results: Record<string, TeamResult>;
  /** Seçili ağırlıklarla üretilen 0-100 güç tablosu. */
  strength: Record<string, number>;
  /** Toplam zorluğa göre artan sıra (1 = en kolay fikstür). */
  order: string[];
};

export const ALL_WEEKS: boolean[] = Array<boolean>(MATCHDAYS).fill(true);

/** Seçili haftadan başlayan `horizon` haftalık pencere maskesi. */
export function windowMask(gw: number, horizon: number): boolean[] {
  return Array.from(
    { length: MATCHDAYS },
    (_, i) => i + 1 >= gw && i + 1 < gw + horizon,
  );
}

export function computeAll({
  model,
  params,
  weeks = ALL_WEEKS,
}: ComputeInput): ComputeResult {
  const p = params[model];
  const strength = strengthTable(p);

  const results: Record<string, TeamResult> = {};
  for (const id of teamIds) {
    const diffs = schedule[id].map((f) =>
      model === "rel"
        ? round1(strengthRelDifficulty(strength[id], strength[f.opp], f.ha, p))
        : round1(strengthDifficulty(strength[f.opp], f.ha, p)),
    );
    const on = diffs.filter((_, i) => weeks[i]);
    const total = on.reduce((a, b) => a + b, 0);
    results[id] = {
      diffs,
      total,
      avg: on.length ? total / on.length : 0,
      n: on.length,
      rank: 0,
    };
  }

  const order = [...teamIds].sort(
    (a, b) =>
      results[a].total - results[b].total ||
      byId[a].name.localeCompare(byId[b].name, "tr"),
  );
  order.forEach((id, i) => {
    results[id].rank = i + 1;
  });

  return { results, strength, order };
}
