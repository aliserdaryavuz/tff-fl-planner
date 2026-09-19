"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { PageHead } from "@/components/PageHead";
import { SECTIONS } from "@/components/Nav";

/**
 * 404.
 *
 * Next'in varsayılan sayfası kabuğun dışında duruyor ve dilsiz: kullanıcı
 * kendi sitesinde yabancı bir ekranla karşılaşıyordu. Bu sayfa kabuğun
 * içinde, seçili dilde ve bölümlere geri dönüş veriyor.
 */
export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="grid gap-6">
      <PageHead title={t.notFound.title} lead={t.notFound.lead} />
      <nav aria-label={t.notFound.sections}>
        <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
          {SECTIONS.map(({ key, href }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex min-h-11 items-center rounded-md border border-line bg-surface px-3 text-body-sm font-semibold text-ink no-underline hover:border-line-strong"
              >
                {t.nav[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
