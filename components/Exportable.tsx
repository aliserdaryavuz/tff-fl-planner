"use client";

import { toPng } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import { ExportContext } from "@/components/ExportContext";
import { useI18n } from "@/components/I18nProvider";
import { useTheme } from "@/components/PlannerContext";
import { logoUrl } from "@/components/TeamLogo";
import { cachedAsset, preloadAssets } from "@/lib/asset-cache";
import { meta, teamIds } from "@/lib/data";
import { groundOf } from "@/lib/theme";

const SITE = "tff-fl-planner.vercel.app";
const SITE_LOGO = "/logo.svg";

/** Görsele girebilecek her şey: 36 arma + site logosu. Bir kez iner, kalır. */
const EXPORT_ASSETS = [SITE_LOGO, ...teamIds.map(logoUrl)];

/**
 * Sarmaladığı içeriği PNG olarak kaydeder / paylaşır. Görsel, ekrandaki
 * genişlikte çizilir (aynı viewport, aynı düzen), üstüne marka başlığı altına
 * adres eklenir ve 3× çözünürlükte alınır: telefonda ~1100 px, masaüstünde
 * ~1500 px genişlik. Dokunmatik cihazda paylaşım menüsü (X'e doğrudan), aksi
 * hâlde indirme.
 */
export function Exportable({
  title,
  subtitle,
  icon,
  filename,
  children,
  exportChildren,
}: {
  title: string;
  subtitle?: string;
  /** Başlıkta adın yanında duran görsel, ör. kulüp arması. */
  icon?: React.ReactNode;
  filename: string;
  children: React.ReactNode;
  /**
   * Görselde ekrandaki yerine bu çizilir: uzun listelerin ekran oranına
   * sığan sıkı sürümü. Verilmezse ekrandaki içerik olduğu gibi alınır.
   */
  exportChildren?: React.ReactNode;
}) {
  const { t, f } = useI18n();
  const theme = useTheme();
  const liveRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Önce armalar ve logo veri URL'si olarak insin, çerçeve ondan sonra kurulsun:
  // yakalama sırasında hiçbir görsel ağdan gelmesin.
  const start = async () => {
    setError(null);
    setPreparing(true);
    try {
      await Promise.all([preloadAssets(EXPORT_ASSETS), document.fonts?.ready]);
    } finally {
      setPreparing(false);
    }
    setWidth(liveRef.current?.offsetWidth ?? 0);
  };

  // Çerçeve DOM'a girince yakala; iş bitince çerçeveyi kaldır.
  useEffect(() => {
    if (width == null) return;
    const node = frameRef.current;
    if (!node) return;
    let cancelled = false;

    (async () => {
      try {
        const options = {
          pixelRatio: 3,
          // Görselin zemini seçili temanın zemini; sabit siyah açık temada
          // sayfayla çelişiyordu (lib/theme.ts).
          backgroundColor: groundOf(theme),
          cacheBust: true,
        };
        // Safari ilk yakalamada görselleri ve yazı tiplerini sık sık boş
        // bırakır (bilinen html-to-image davranışı); düşük çözünürlüklü bir
        // ısınma turu atılır, ikinci tur teslim edilir.
        await toPng(node, { ...options, pixelRatio: 0.5 });
        if (cancelled) return;
        const dataUrl = await toPng(node, options);
        if (cancelled) return;
        await deliver(dataUrl, `${filename}.png`, title);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setWidth(null);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `theme` de bağımlılık: zemin rengi ondan geliyor, yoksa tema değişince
    // görsel eski zeminle üretilirdi.
  }, [width, filename, title, theme]);

  const busy = preparing || width != null;

  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center justify-end gap-2">
        {error ? (
          <span className="text-xs text-harder">{t.export.failed}</span>
        ) : null}
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 2v8m0 0 3-3M8 10 5 7M3 12v1.5h10V12" />
          </svg>
          {busy ? t.export.busy : t.export.button}
        </button>
      </div>

      <div ref={liveRef}>{children}</div>

      {width != null ? (
        <ExportContext.Provider value={true}>
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: -20000,
            top: 0,
            width: width || undefined,
            pointerEvents: "none",
          }}
        >
          <div
            ref={frameRef}
            className="bg-ground px-3 pt-3 pb-2.5 text-ink"
            style={{ width: width || undefined }}
          >
            <div className="mb-3 border-b border-line pb-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex shrink-0 items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- önceden indirilmiş veri URL'si */}
                  <img
                    src={cachedAsset(SITE_LOGO)}
                    alt=""
                    width={28}
                    height={28}
                  />
                  <span className="font-cond text-lg leading-none font-bold tracking-wide whitespace-nowrap">
                    TFF FL Planner{" "}
                    <span className="text-accent">{meta.season}</span>
                  </span>
                </div>
                {icon}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-cond text-[19px] leading-none font-semibold">
                  {title}
                </span>
                {subtitle ? (
                  <span className="min-w-0 text-[11px] text-muted">
                    {subtitle}
                  </span>
                ) : null}
              </div>
            </div>

            {exportChildren ?? children}

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2 text-[11px] text-muted">
              <span className="font-semibold text-ink">{SITE}</span>
              <span>{t.export.footer(f.date(today()))}</span>
            </div>
          </div>
        </div>
        </ExportContext.Provider>
      ) : null}
    </>
  );
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dokunmatik cihazda paylaşım menüsü, aksi hâlde indirme. */
async function deliver(dataUrl: string, filename: string, title: string) {
  const coarse =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
  if (coarse && typeof navigator.share === "function") {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch (e) {
        // Kullanıcı vazgeçtiyse sessizce çık; başka hata indirmeye düşsün.
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
