import { type Lang, LOCALE, STRINGS } from "@/lib/i18n";

/** 2,7 (tr) · 2.7 (en) */
export function fmt1(x: number, lang: Lang): string {
  return x.toLocaleString(LOCALE[lang], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** 2,80 · 2.80 */
export function fmt2(x: number, lang: Lang): string {
  return x.toLocaleString(LOCALE[lang], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtNumber(x: number, lang: Lang, maxFractionDigits = 2): string {
  return x.toLocaleString(LOCALE[lang], {
    maximumFractionDigits: maxFractionDigits,
  });
}

/** %12 (tr) · 12% (en) — yüzde işareti dile göre yer değiştirir. */
export function fmtPct(x: number, lang: Lang, maxFractionDigits = 0): string {
  const n = fmtNumber(x, lang, maxFractionDigits);
  return lang === "tr" ? `%${n}` : `${n}%`;
}

/** 11,5 M TL (tr) · 11.5M TL (en) — fantasy fiyatı, milyon TL. */
export function fmtMoney(x: number, lang: Lang, maxFractionDigits = 1): string {
  const n = fmtNumber(x, lang, maxFractionDigits);
  return lang === "tr" ? `${n} M TL` : `${n}M TL`;
}

/** 411,6 M€ · €411.6m — kadro değeri. */
export function fmtEuro(x: number, lang: Lang, maxFractionDigits = 1): string {
  const n = fmtNumber(x, lang, maxFractionDigits);
  return lang === "tr" ? `${n} M€` : `€${n}m`;
}

const DAYS: Record<Lang, string[]> = {
  tr: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const MONTHS: Record<Lang, string[]> = {
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/**
 * "2026-09-08" -> "Sal 8 Eyl" / "Tue 8 Sep". Intl yerine sabit tablo: sunucu
 * ve tarayıcıda aynı çıktı, hydration farkı olmaz.
 */
export function fmtDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAYS[lang][d.getUTCDay()]} ${d.getUTCDate()} ${
    MONTHS[lang][d.getUTCMonth()]
  }`;
}

/** "8 Eyl" / "8 Sep" — gün adı olmadan. */
export function fmtShortDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[lang][d.getUTCMonth()]}`;
}

/** 0 -> "aynı anda", 135 -> "2 sa 15 dk", 2880 -> "2 gün". */
export function fmtGap(minutes: number, lang: Lang): string {
  const t = STRINGS[lang];
  if (minutes <= 0) return lang === "tr" ? "aynı anda" : "at the same time";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.round(minutes % 60);
  const day = (n: number) => (lang === "tr" ? `${n} gün` : `${n}d`);
  const hour = (n: number) => (lang === "tr" ? `${n} sa` : `${n}h`);
  const minute = (n: number) => (lang === "tr" ? `${n} dk` : `${n}m`);
  void t;
  if (days) {
    return [day(days), hours ? hour(hours) : null].filter(Boolean).join(" ");
  }
  return [hours ? hour(hours) : null, mins ? minute(mins) : null]
    .filter(Boolean)
    .join(" ");
}
