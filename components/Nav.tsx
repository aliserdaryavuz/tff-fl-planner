"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { usePlanner } from "@/components/PlannerContext";
import { encodeState } from "@/lib/url-state";

/** Sırası ekrandaki sırası; anahtar hem adres hem sözlük anahtarı. */
export const SECTIONS = [
  { key: "model", href: "/" },
  { key: "teams", href: "/teams" },
  { key: "players", href: "/players" },
  { key: "squad", href: "/squad" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

/** Kulüp/oyuncu alt sayfalarında da üst bölüm işaretli kalsın. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

/** Ayarlar adres çubuğunda taşınıyor; sekme değiştirirken kaybolmasın. */
function useQuery(): string {
  const { state } = usePlanner();
  return encodeState(state);
}

export function Nav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const query = useQuery();

  return (
    // Telefonda şeridin yerini alt çubuk alıyor; şerit sm ve üstünde.
    <nav aria-label={t.nav.label} className="-mx-2.5 max-sm:hidden">
      <ul className="m-0 flex list-none flex-wrap gap-x-0.5 p-0 whitespace-nowrap">
        {SECTIONS.map(({ key, href }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key} className="flex">
              <Link
                href={`${href}?${query}`}
                aria-current={active ? "page" : undefined}
                // Etkin sekme dolu blok değil, altı çizili: dört sekmeden biri
                // sürekli dolu renk olunca göz oraya kilitleniyor.
                className={[
                  "relative flex min-h-11 items-center px-2.5 font-cond text-[15px]",
                  "font-semibold tracking-wide transition-colors",
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full",
                  active
                    ? "text-ink after:bg-accent"
                    : "text-muted hover:text-ink after:bg-transparent hover:after:bg-line-strong",
                ].join(" ")}
              >
                {t.nav[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Telefonda alt sekme çubuğu: başparmak ekranın altında. Dört bölüm olduğu için
 * "daha fazla" listesine gerek yok, hepsi sığıyor. Klavye sırasında içerikten
 * sonra gelsin diye kabuk en alta çiziyor.
 */
export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const query = useQuery();

  return (
    <nav
      aria-label={t.nav.label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:hidden"
    >
      <ul className="m-0 grid list-none grid-cols-4 p-0">
        {SECTIONS.map(({ key, href }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key} className="min-w-0">
              <Link
                href={`${href}?${query}`}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[12px] font-semibold transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                {/* Aktif bölümün üstünde çizgi: renk tek başına taşımasın. */}
                <span
                  aria-hidden
                  className={`h-[2px] w-6 rounded-full ${active ? "bg-accent" : "bg-transparent"}`}
                />
                <span className="min-w-0 truncate">{t.nav[key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
