"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Yatay kayan şeridin kenar solması.
 *
 * Yalnız o yönde gizli öge varken soluyor, yani solma "burada devamı var"
 * demek — hep açık olsaydı bilgi taşımazdı. `scroll-fade` yardımcı sınıfıyla
 * birlikte kullanılıyor (`app/globals.css`); döndürülen `style`
 * `--fade-start` / `--fade-end` değerlerini veriyor.
 *
 * `ResizeObserver` gözlem başlarken de bir kez çağırıyor, ilk ölçüm oradan
 * geliyor. Durum yalnız gerçekten değiştiğinde yazılıyor: her kaydırma
 * olayında `setState` çağırmak listeyi durmadan yeniden çizerdi.
 *
 * Köken: `../ucl-fantasy-planner/components/useEdgeFade.ts`.
 */
export function useEdgeFade<T extends HTMLElement>(fade = "1.75rem") {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = { start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 };
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return {
    ref,
    style: {
      "--fade-start": edges.start ? fade : "0px",
      "--fade-end": edges.end ? fade : "0px",
    } as React.CSSProperties,
  };
}
