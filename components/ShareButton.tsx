"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

/** Adres çubuğundaki durum bağlantısını panoya kopyalar (§8). */
export function ShareButton() {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const show = (text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 6000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      show(t.share.copied);
    } catch {
      show(t.share.manual);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="min-h-11 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium hover:bg-surface-2"
      >
        {t.share.copy}
      </button>
      <span aria-live="polite" className="text-[13px] text-muted">
        {message}
      </span>
    </>
  );
}
