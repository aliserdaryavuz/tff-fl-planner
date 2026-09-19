"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/components/I18nProvider";
import { LangSwitch } from "@/components/LangSwitch";
import { Legend } from "@/components/Legend";
import { DataSources, StaleSourcesNote } from "@/components/DataSources";
import { BottomNav, Nav } from "@/components/Nav";
import { PlannerProvider } from "@/components/PlannerContext";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { TimeZoneSelect, timeZoneLabel } from "@/components/TimeZoneSelect";
import { meta } from "@/lib/data";
import type { Lang } from "@/lib/i18n";
import type { ThemeKey } from "@/lib/theme";
import type { TimeZone } from "@/lib/time";
import { decodeState, encodeState, type PlannerState } from "@/lib/url-state";

/**
 * Dil dahil tüm paylaşılabilir durumun sahibi.
 *
 * Yerleşimde (`app/layout.tsx`) duruyor, sayfanın içinde değil: sayfalar ayrı
 * adreslerde olduğu için Shell sayfada olsaydı her gezinmede yeniden kurulur ve
 * durum sıfırlanırdı. Sayfalar durumu `PlannerContext`ten okuyor.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();

  const [state, setState] = useState<PlannerState>(() =>
    decodeState(new URLSearchParams(searchParams.toString())),
  );

  // Adres çubuğu biraz gecikmeli eşitlenir: kaydırak sürüklerken her kareye
  // replaceState çağırmak boşuna iş; Safari çağrı sınırına da takılıyor.
  // Yalnız sorgu yazılıyor, yol korunuyor — göreli adres geçerli yola çözülür.
  useEffect(() => {
    const id = setTimeout(() => {
      window.history.replaceState(null, "", `?${encodeState(state)}`);
    }, 250);
    return () => clearTimeout(id);
  }, [state]);

  useEffect(() => {
    document.documentElement.lang = state.lang;
  }, [state.lang]);

  // Varsayılan tema sunucuda `<html data-theme="light">` ile veriliyor; burada
  // yalnız seçim değişince yeniden yazılıyor.
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  const setLang = (lang: Lang) => setState((s) => ({ ...s, lang }));
  const setTz = (tz: TimeZone) => setState((s) => ({ ...s, tz }));
  const setTheme = (theme: ThemeKey) => setState((s) => ({ ...s, theme }));

  return (
    <I18nProvider lang={state.lang} tz={state.tz}>
      <PlannerProvider state={state} onChange={setState}>
        <Body theme={state.theme} onLangChange={setLang} onTzChange={setTz} onThemeChange={setTheme}>
          {children}
        </Body>
      </PlannerProvider>
    </I18nProvider>
  );
}

function Body({
  children,
  theme,
  onLangChange,
  onTzChange,
  onThemeChange,
}: {
  children: React.ReactNode;
  theme: ThemeKey;
  onLangChange: (lang: Lang) => void;
  onTzChange: (tz: TimeZone) => void;
  onThemeChange: (theme: ThemeKey) => void;
}) {
  const { t, tz } = useI18n();

  useEffect(() => {
    document.title = t.docTitle(meta.season);
  }, [t]);

  return (
    <>
      {/* Klavyeyle gelen kullanıcı gezinme şeridini baştan geçmesin: ekran
          dışında durur, odak alınca görünür (`skip-link`, globals.css). */}
      <a href="#main" className="skip-link">
        {t.nav.skip}
      </a>

      <header className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Site adı artık h1 değil: h1'i her rotada PageHead sahipleniyor,
              böylece başlık listesi sayfanın kendi adıyla başlıyor. */}
          <Link href="/" className="flex min-w-0 items-center gap-3 no-underline">
            <Image
              src="/logo.svg"
              alt=""
              width={56}
              height={56}
              priority
              className="h-10 w-10 shrink-0 desk:h-12 desk:w-12"
            />
            <span className="m-0 min-w-0 font-cond text-display leading-[1.05] font-bold tracking-wide text-ink">
              {t.header.title} <span className="whitespace-nowrap text-accent">{meta.season}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeSwitch theme={theme} onChange={onThemeChange} />
            <LangSwitch onChange={onLangChange} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <p className="m-0 text-label text-muted">
            {t.header.tagline(meta.source_fixtures, timeZoneLabel(t.time.zones, tz))}
          </p>
          <TimeZoneSelect onChange={onTzChange} />
        </div>
      </header>

      {/* Yalnız gezinme şeridi yapışkan, başlığın tamamı değil: logo+ad,
          açıklama ve şerit birlikte ~150 px ve telefonda ekranın üçte birini
          yerdi. Asıl değer, bölüm değiştirmenin kaydırınca kaybolmaması.

          Bilerek `<header>`in DIŞINDA: yapışkanlık ögenin ebeveyni boyunca
          sürer, header ise kısa bir kutu — içinde kalsaydı şerit kaydırır
          kaydırmaz kaybolurdu (derlemeden geçen ölü davranış). Burada kolon
          div'inin doğrudan çocuğu ve o kutu sayfa boyu yüksek.

          `-mx-3.5` zemini kolonun dolgusunun dışına taşırıyor; kolon dışında
          hiçbir şey çizilmediği için kenardan içerik sızmıyor.

          `max-sm:hidden` süs değil: `Nav`ın kendisi telefonda gizli (yerini
          `BottomNav` alıyor), sarmalayıcı gizlenmezse tepeye 9 piksellik BOŞ
          bulanık bir çubuk yapışıyor — 19.09'da tarayıcıda ölçüldü. Aynı kural
          WCAG 1.4.10'u da karşılıyor: %400 yakınlaştırmada CSS genişliği 320 px
          olur ve çubuk hiç çizilmez. Eşik globals.css'teki `scroll-padding`
          kuralıyla aynı kalmalı. */}
      <div className="sticky top-0 z-[var(--z-nav)] -mx-3.5 mb-4 border-b border-line bg-ground/95 px-3.5 py-1 backdrop-blur-sm max-sm:hidden">
        <Nav />
      </div>

      <main id="main">{children}</main>

      <section className="mt-8">
        <h2 className="mb-2.5 font-cond text-title font-semibold tracking-wide">{t.bands.heading}</h2>
        <Legend />
      </section>

      <footer className="mt-10 grid gap-2.5 border-t border-line pt-4 text-label text-muted">
        <p>
          <b className="text-ink">{t.footer.how}</b> {t.footer.howText}
        </p>
        <p>
          <b className="text-ink">{t.footer.rules}</b> {t.footer.rulesText}
        </p>
        {/* Kaynaklar tek satırlık cümle değil, grup başına tarihli tablo: her
            dosya ayrı çekiliyor ve biri bayat kalabiliyor. Kapalı duruyor,
            başlıkta kaç grubun eski olduğu yazılı. */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span className="text-accent transition-transform group-open:rotate-90">▸</span>
            {t.sourcesTable.heading}
            <StaleSourcesNote />
          </summary>
          <div className="mt-2">
            <DataSources />
          </div>
        </details>
        <p className="mt-1.5 border-t border-line pt-3 text-caption">{t.footer.disclaimer}</p>
      </footer>

      <BottomNav />
    </>
  );
}
