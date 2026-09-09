"use client";

import { createContext, useContext, useMemo } from "react";
import {
  fmt1,
  fmt2,
  fmtDate,
  fmtEuro,
  fmtGap,
  fmtMoney,
  fmtNumber,
  fmtPct,
  fmtShortDate,
} from "@/lib/format";
import { type Lang, STRINGS, type Strings } from "@/lib/i18n";
import { kickoffInstant, localKickoff, type TimeZone } from "@/lib/time";

type I18n = {
  lang: Lang;
  tz: TimeZone;
  t: Strings;
  /** Seçili dile ve saat dilimine bağlanmış biçimlendiriciler. */
  f: {
    n1: (x: number) => string;
    n2: (x: number) => string;
    num: (x: number, digits?: number) => string;
    pct: (x: number, digits?: number) => string;
    money: (x: number, digits?: number) => string;
    euro: (x: number, digits?: number) => string;
    date: (iso: string) => string;
    shortDate: (iso: string) => string;
    gap: (minutes: number) => string;
    /** Veri dosyasındaki (tarih, tsi) çiftini seçili dilimde gösterir. */
    kickoff: (date: string, tsi: string | null) => { date: string; time: string | null };
  };
};

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({
  lang,
  tz,
  children,
}: {
  lang: Lang;
  tz: TimeZone;
  children: React.ReactNode;
}) {
  const value = useMemo<I18n>(
    () => ({
      lang,
      tz,
      t: STRINGS[lang],
      f: {
        n1: (x) => fmt1(x, lang),
        n2: (x) => fmt2(x, lang),
        num: (x, digits = 2) => fmtNumber(x, lang, digits),
        pct: (x, digits = 0) => fmtPct(x, lang, digits),
        money: (x, digits = 1) => fmtMoney(x, lang, digits),
        euro: (x, digits = 1) => fmtEuro(x, lang, digits),
        date: (iso) => fmtDate(iso, lang),
        shortDate: (iso) => fmtShortDate(iso, lang),
        gap: (minutes) => fmtGap(minutes, lang),
        kickoff: (date, tsi) => {
          if (!tsi) return { date: fmtDate(date, lang), time: null };
          const local = localKickoff(kickoffInstant(date, tsi), tz);
          return { date: fmtDate(local.date, lang), time: local.time };
        },
      },
    }),
    [lang, tz],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider gerekli");
  return value;
}
