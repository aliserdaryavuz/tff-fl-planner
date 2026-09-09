import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
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
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
