import type { MetadataRoute } from "next";
import { teamIds, teamSlug } from "@/lib/data";
import { playersBySlug } from "@/lib/fantasy";
import { SITE, STATIC_ROUTES } from "@/lib/site";
import { sourceMeta } from "@/lib/source-meta";

/**
 * Bölümler + her kulüp + her oyuncu sayfası.
 *
 * Oyuncu ve kulüp sayfaları 3.4'te açıldı; site haritasına girmezlerse
 * yalnız gezinme üzerinden bulunabilir kalırlar.
 *
 * `lastModified` veri çekim tarihinden: her derlemede bugünü yazmak, hiçbir
 * şey değişmediği hâlde "güncellendi" demek olurdu.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(sourceMeta.players.fetched ?? Date.now());

  return [
    ...STATIC_ROUTES.map((path) => ({
      url: `${SITE}${path}`,
      lastModified: updated,
      // Ana sayfa ve haftalık değişen bölümler öne.
      priority: path === "/" ? 1 : 0.8,
    })),
    ...teamIds.map((id) => ({
      url: `${SITE}/teams/${teamSlug(id)}`,
      lastModified: updated,
      priority: 0.6,
    })),
    ...Object.keys(playersBySlug).map((slug) => ({
      url: `${SITE}/players/${slug}`,
      lastModified: updated,
      priority: 0.4,
    })),
  ];
}
