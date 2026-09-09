"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/components/I18nProvider";
import { LangSwitch } from "@/components/LangSwitch";
import { Legend } from "@/components/Legend";
import { Planner } from "@/components/Planner";
import { TimeZoneSelect, timeZoneLabel } from "@/components/TimeZoneSelect";
import { meta } from "@/lib/data";
import type { Lang } from "@/lib/i18n";
import type { TimeZone } from "@/lib/time";
import { decodeState, encodeState, type PlannerState } from "@/lib/url-state";

/** Dil dahil tüm paylaşılabilir durumun sahibi. */
export function Shell() {
  const searchParams = useSearchParams();

  const [state, setState] = useState<PlannerState>(() =>
    decodeState(new URLSearchParams(searchParams.toString())),
  );

  // Adres çubuğu biraz gecikmeli eşitlenir: kaydırak sürüklerken her kareye
  // replaceState çağırmak boşuna iş; Safari çağrı sınırına da takılıyor.
  useEffect(() => {
    const id = setTimeout(() => {
      window.history.replaceState(null, "", `?${encodeState(state)}`);
    }, 250);
    return () => clearTimeout(id);
  }, [state]);

  useEffect(() => {
    document.documentElement.lang = state.lang;
  }, [state.lang]);

  const setLang = (lang: Lang) => setState((s) => ({ ...s, lang }));
  const setTz = (tz: TimeZone) => setState((s) => ({ ...s, tz }));

  return (
    <I18nProvider lang={state.lang} tz={state.tz}>
      <Body state={state} onChange={setState} onLangChange={setLang} onTzChange={setTz} />
    </I18nProvider>
  );
}

function Body({
  state,
  onChange,
  onLangChange,
  onTzChange,
}: {
  state: PlannerState;
  onChange: React.Dispatch<React.SetStateAction<PlannerState>>;
  onLangChange: (lang: Lang) => void;
  onTzChange: (tz: TimeZone) => void;
}) {
  const { t, tz } = useI18n();

  useEffect(() => {
    document.title = t.docTitle(meta.season);
  }, [t]);

  return (
    <>
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.svg"
              alt=""
              width={56}
              height={56}
              priority
              className="h-11 w-11 shrink-0 desk:h-14 desk:w-14"
            />
            <h1 className="m-0 min-w-0 font-cond text-[30px] leading-[1.05] font-bold tracking-wide desk:text-[42px]">
              {t.header.title} <span className="whitespace-nowrap text-accent">{meta.season}</span>
            </h1>
          </div>
          <div className="shrink-0">
            <LangSwitch onChange={onLangChange} />
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <p className="m-0 text-[13px] text-muted">
            {t.header.tagline(meta.source_fixtures, timeZoneLabel(t.time.zones, tz))}
          </p>
          <TimeZoneSelect onChange={onTzChange} />
        </div>
      </header>

      <Planner state={state} onChange={onChange} />

      <section className="mt-8">
        <h2 className="mb-2.5 font-cond text-xl font-semibold tracking-wide">{t.bands.heading}</h2>
        <Legend />
      </section>

      <footer className="mt-10 grid gap-2.5 border-t border-line pt-4 text-[13px] text-muted">
        <p>
          <b className="text-ink">{t.footer.how}</b> {t.footer.howText}
        </p>
        <p>
          <b className="text-ink">{t.footer.rules}</b> {t.footer.rulesText}
        </p>
        <p>
          <b className="text-ink">{t.footer.sources}</b> {t.footer.sourcesText(meta.source_fixtures)}
          {meta.opta_source ? `; ${meta.opta_source}` : ""}
          {meta.value_source ? `; ${meta.value_source}` : ""}
          {meta.last_source ? `; ${meta.last_source}` : ""}.
        </p>
        <p className="mt-1.5 border-t border-line pt-3 text-xs">{t.footer.disclaimer}</p>
      </footer>
    </>
  );
}
