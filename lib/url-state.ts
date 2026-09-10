import { byId, MATCHDAYS, nextMatchday } from "@/lib/data";
import { isLang, type Lang } from "@/lib/i18n";
import {
  DEFAULT_PARAMS,
  MODEL_KEYS,
  MODEL_PARAMS,
  type ModelKey,
  type ModelParams,
} from "@/lib/models";
import { clamp } from "@/lib/num";
import {
  DEFAULT_HORIZON,
  DEFAULT_PICK_WEIGHTS,
  DEFAULT_WEEK_DECAY,
  MAX_HORIZON,
  PICK_SIGNALS,
  type PickSignal,
  type PickWeights,
} from "@/lib/picks";
import { DEFAULT_BENCH_WEIGHT } from "@/lib/squad";
import { SOURCES, type SourceKey, type SourceWeights } from "@/lib/strength";
import { DEFAULT_TZ, isTimeZone, type TimeZone } from "@/lib/time";

/** Paylaşılabilir bağlantıda tutulan durum. */
export type PlannerState = {
  lang: Lang;
  tz: TimeZone;
  team: string;
  model: ModelKey;
  params: ModelParams;
  /** Planlanan hafta (1-34). */
  gw: number;
  /** Kaç hafta ileriye bakılsın (1-8). */
  horizon: number;
  /** Sonraki haftaların ağırlık azalması, 0-1. */
  weekDecay: number;
  /** Yedeklerin hedefteki ağırlığı, 0-0,5. */
  benchWeight: number;
  /** Oyuncu sıralamasındaki sinyal ağırlıkları. */
  picks: PickWeights;
  /** Seçilme oranını ters çevir: az seçilenler öne. */
  selInvert: boolean;
};

export const DEFAULT_STATE: PlannerState = {
  lang: "tr",
  tz: DEFAULT_TZ,
  team: "Galatasaray",
  model: "abs",
  params: DEFAULT_PARAMS,
  gw: nextMatchday(),
  horizon: DEFAULT_HORIZON,
  weekDecay: DEFAULT_WEEK_DECAY,
  benchWeight: DEFAULT_BENCH_WEIGHT,
  picks: DEFAULT_PICK_WEIGHTS,
  selInvert: false,
};

function parseNumber(raw: string | null, def: number, lo: number, hi: number): number {
  if (raw == null || raw === "") return def;
  const n = Number(raw);
  return Number.isFinite(n) ? clamp(n, lo, hi) : def;
}

type ParamValues = Record<string, string | number | SourceWeights>;

const WEIGHT_MAX = 100;

function serializeWeights(weights: SourceWeights): string {
  return SOURCES.map((s) => s.key)
    .filter((key) => (weights[key] ?? 0) > 0)
    .map((key) => `${key}:${weights[key]}`)
    .join(",");
}

function parseWeights(raw: string): SourceWeights {
  const known = new Set(SOURCES.map((s) => s.key));
  const out: SourceWeights = {};
  for (const part of raw.split(",")) {
    const [key, value] = part.split(":");
    const n = Number(value);
    if (known.has(key as SourceKey) && Number.isFinite(n)) {
      out[key as SourceKey] = clamp(Math.round(n), 0, WEIGHT_MAX);
    }
  }
  return out;
}

/** "xp:100,form:40" -> ağırlıklar. Tanınmayan ad ve aralık dışı değer elenir. */
function parsePickWeights(raw: string | null, base: PickWeights): PickWeights {
  if (raw == null) return base;
  const known = new Set<string>(PICK_SIGNALS);
  const out = Object.fromEntries(PICK_SIGNALS.map((key) => [key, 0])) as PickWeights;
  let seen = false;
  for (const part of raw.split(",")) {
    const [key, value] = part.split(":");
    const n = Number(value);
    if (known.has(key) && Number.isFinite(n)) {
      out[key as PickSignal] = clamp(Math.round(n), 0, WEIGHT_MAX);
      seen = true;
    }
  }
  // Boş "pw=" ağırlıkların hepsini sıfırlamak demek; hiç anlaşılır çift yoksa
  // (ör. "pw=abc") varsayılana dönülür.
  return seen || raw === "" ? out : base;
}

/** Durumu query string'e çevirir. Yalnızca seçili modelin parametreleri yazılır. */
export function encodeState(state: PlannerState): string {
  const q = new URLSearchParams();
  q.set("lang", state.lang);
  q.set("tz", state.tz);
  q.set("t", state.team);
  q.set("m", state.model);

  const values = state.params[state.model] as unknown as ParamValues;
  for (const spec of MODEL_PARAMS) {
    if (spec.kind === "weights") {
      q.set("w", serializeWeights(values.weights as SourceWeights));
      continue;
    }
    q.set(spec.key, String(values[spec.key]));
  }

  q.set("gw", String(state.gw));
  q.set("h", String(state.horizon));
  q.set("wd", String(state.weekDecay));
  q.set("bw", String(state.benchWeight));
  q.set(
    "pw",
    PICK_SIGNALS.filter((key) => (state.picks[key] ?? 0) > 0)
      .map((key) => `${key}:${state.picks[key]}`)
      .join(","),
  );
  if (state.selInvert) q.set("si", "1");
  return q.toString();
}

/** Query string'i duruma çevirir; tanınmayan/aralık dışı değerler yok sayılır. */
export function decodeState(
  q: URLSearchParams,
  base: PlannerState = DEFAULT_STATE,
): PlannerState {
  const team = q.get("t");
  const model = q.get("m");
  const lang = q.get("lang");
  const tz = q.get("tz");

  const next: PlannerState = {
    lang: isLang(lang) ? lang : base.lang,
    tz: isTimeZone(tz) ? tz : base.tz,
    team: team && byId[team] ? team : base.team,
    model:
      model && (MODEL_KEYS as string[]).includes(model)
        ? (model as ModelKey)
        : base.model,
    params: base.params,
    gw: Math.round(parseNumber(q.get("gw"), base.gw, 1, MATCHDAYS)),
    horizon: Math.round(parseNumber(q.get("h"), base.horizon, 1, MAX_HORIZON)),
    weekDecay: parseNumber(q.get("wd"), base.weekDecay, 0, 1),
    benchWeight: parseNumber(q.get("bw"), base.benchWeight, 0, 0.5),
    picks: parsePickWeights(q.get("pw"), base.picks),
    selInvert: q.get("si") === "1" ? true : base.selInvert,
  };

  const values: ParamValues = {
    ...(base.params[next.model] as unknown as ParamValues),
  };
  for (const spec of MODEL_PARAMS) {
    if (spec.kind === "weights") {
      const raw = q.get("w");
      if (raw != null) values.weights = parseWeights(raw);
      continue;
    }
    const raw = q.get(spec.key);
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) values[spec.key] = clamp(n, spec.min, spec.max);
  }
  next.params = {
    ...base.params,
    [next.model]: values,
  } as unknown as ModelParams;

  return next;
}
