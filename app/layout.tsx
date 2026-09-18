import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { Suspense } from "react";
import { Shell } from "@/components/Shell";
import { GROUND, GROUND_LIGHT } from "@/lib/theme";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const SITE = "https://tff-fl-planner.vercel.app";
const TITLE = "TFF FL Planner 2026/27";
const DESCRIPTION =
  "TFF Fantezi Lig 2026/27 planlayıcısı: her hafta için beklenen puana göre ilk 11 + yedek + kaptan, Süper Lig fikstür zorluğu ve oyuncu sıralaması. Türkçe ve İngilizce.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "TFF Fantezi Lig",
    "TFF FL",
    "Süper Lig fantasy",
    "fantasy futbol",
    "fikstür zorluğu",
    "kadro kurucu",
    "Super Lig fantasy planner",
  ],
  metadataBase: new URL(SITE),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE,
    siteName: "TFF FL Planner",
    type: "website",
    locale: "tr_TR",
    alternateLocale: ["en_GB"],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // Mobil tarayıcı çubuğu sayfa zeminiyle aynı renk. İki değer, çünkü tema
  // seçilebilir (`lib/theme.ts`); cihazın tercihine göre açık ya da koyu.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: GROUND_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: GROUND },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      // Varsayılan tema burada, sunucuda: `globals.css`'teki taban palet koyu,
      // açık tema `:root[data-theme="light"]` ile geliyor. İşaret HTML'de
      // olmasaydı sayfa önce koyu boyanıp hydration'da açığa atlardı.
      data-theme="light"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Shell yerleşimde: sayfalar arası gezinmede yeniden kurulmuyor, durum
            korunuyor. Adres çubuğundaki durumu okuduğu için Suspense içinde.
            Telefonda alt sekme çubuğu sabit; alt boşluk footer'ı örtmesin diye. */}
        <div className="mx-auto max-w-[1040px] px-3.5 pt-3.5 pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-10">
          <Suspense fallback={<p className="text-[13px] text-muted">…</p>}>
            <Shell>{children}</Shell>
          </Suspense>
        </div>
      </body>
    </html>
  );
}
