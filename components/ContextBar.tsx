"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { usePlanner } from "@/components/PlannerContext";
import { useEdgeFade } from "@/components/useEdgeFade";
import { PICK_SIGNALS } from "@/lib/picks";
import { encodeState } from "@/lib/url-state";

/**
 * Bağlam çubuğu: sayfa başlığının altında, **bu sayfadaki sayıları belirleyen**
 * ayarlar çip olarak ve her sayfada aynı sırada.
 *
 * Eskiden her bölüm kendi ayarını kendi yerinde yazıyordu; hangi haftaya ve
 * hangi modele bakıldığı yalnız ana sayfada görünüyordu. Çipe dokununca ayar
 * açılıyor: ayar bu sayfadaysa oraya kaydırılıp odaklanıyor, başka sayfadaysa
 * `#hedef` ile oraya gidiliyor.
 *
 * Çip kümesi UCL'den kopyalanmadı, TFF'nin kendi durumundan kuruldu: orada
 * hafta seçimi boolean maske ve ev avantajı ayrı bir çip; burada hafta `gw` +
 * ufuk + azalma üçlüsü, ev avantajı ise modelin parametresi. Kadro sayfasının
 * sayısını belirleyen yedek ağırlığı da eklendi.
 */
export type ChipKey = "weeks" | "model" | "ranking" | "minutes" | "bench";

/** Ayarın yaşadığı sayfa ve öge; hepsi var olan çıpalar. */
const TARGETS: Record<ChipKey, { path: string; id: string }> = {
  weeks: { path: "/", id: "gw-heading" },
  model: { path: "/", id: "model-heading" },
  ranking: { path: "/players", id: "picks-heading" },
  minutes: { path: "/players", id: "picks-heading" },
  bench: { path: "/squad", id: "squad-heading" },
};

/** Fikstür zorluğuna dayanan sayfalar (takımlar). */
export const MODEL_CHIPS: readonly ChipKey[] = ["weeks", "model"];
/** Oyuncu sıralaması: üstüne ağırlıklar ve süre etkisi. */
export const PICK_CHIPS: readonly ChipKey[] = ["weeks", "model", "ranking", "minutes"];
/** Kadro: sıralamanın hepsi artı yedek ağırlığı. */
export const SQUAD_CHIPS: readonly ChipKey[] = ["weeks", "model", "ranking", "bench"];

/** Ayarı aç ve odakla: açılır panelse açılır, değilse ilk denetimine odaklanılır. */
function reveal(id: string): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  if (target instanceof HTMLDetailsElement) target.open = true;
  const focusable =
    target instanceof HTMLDetailsElement
      ? target.querySelector("summary")
      : target.parentElement?.querySelector<HTMLElement>("button, input, select, a[href]");
  target.scrollIntoView({ block: "start" });
  focusable?.focus({ preventScroll: true });
  return true;
}

/** Başka sayfadaki çipten gelindiyse (#hedef) ayarı aç ve odakla. */
export function revealFromHash(): void {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (Object.values(TARGETS).some((target) => target.id === id)) reveal(id);
}

export function ContextBar({ chips }: { chips: readonly ChipKey[] }) {
  const { t, f } = useI18n();
  const { state } = usePlanner();
  const query = encodeState(state);
  const { ref: listRef, style: fadeStyle } = useEdgeFade<HTMLUListElement>();

  const total = PICK_SIGNALS.reduce((sum, k) => sum + Math.max(0, state.picks[k] ?? 0), 0);
  const shares = PICK_SIGNALS.map((k) =>
    total > 0 ? (100 * Math.max(0, state.picks[k] ?? 0)) / total : 100 / PICK_SIGNALS.length,
  );

  const content: Record<ChipKey, { label: string; value: string; title?: string }> = {
    weeks: {
      label: t.ctx.matchdays,
      value:
        state.horizon > 1
          ? `${state.gw}–${Math.min(34, state.gw + state.horizon - 1)}`
          : String(state.gw),
    },
    model: { label: t.ctx.model, value: t.model[state.model].name },
    ranking: {
      // İlk pay yüzdeli, kalanlar çıplak: dördü de "%" alınca çip satırı taşıyor.
      label: t.ctx.ranking,
      value: [f.pct(shares[0], 0), ...shares.slice(1).map((s) => f.num(s, 0))].join(" · "),
      title: PICK_SIGNALS.map((k, i) => `${t.pickWeights.signals[k].label} ${f.pct(shares[i], 0)}`).join(" · "),
    },
    minutes: { label: t.ctx.minutes, value: f.num(state.minutesImpact, 2) },
    bench: { label: t.ctx.bench, value: f.num(state.benchWeight, 2) },
  };

  return (
    // Telefonda tek satır, yatay kayar ve kenarı solar: dört çip dar ekranda
    // iki satıra çıkıp ilk sonucu aşağı itiyordu.
    <ul
      ref={listRef}
      aria-label={t.ctx.label}
      style={fadeStyle}
      className="m-0 flex list-none flex-wrap gap-x-1.5 gap-y-1 p-0 max-sm:scroll-fade max-sm:snap-x max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none]"
    >
      {chips.map((key) => {
        const chip = content[key];
        const { path, id } = TARGETS[key];
        return (
          <li key={key} className="max-sm:shrink-0 max-sm:snap-start">
            {/* Hedef 44 px, görünen hap 36 px. Değiştirici tuşla tıklama yeni
                sekmede açılsın diye o durumda engellenmiyor. */}
            <Link
              href={`${path}?${query}#${id}`}
              title={chip.title ?? t.ctx.open(chip.label)}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                if (reveal(id)) event.preventDefault();
              }}
              className="group inline-flex min-h-11 items-center"
            >
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-label transition-colors group-hover:border-line-strong group-hover:bg-surface-2">
                <span className="text-muted">{chip.label}</span>
                <span className="font-semibold text-ink tabular-nums">{chip.value}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
