import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Kişisel kullanım için ama gizli değil: taramaya açık.
 *
 * `/season` kullanıcının kendi takımının geçmişi; veri zaten repoda ve
 * sayfa herkese açık, o yüzden ayrıca engellenmiyor — engellemek onu gizli
 * sanmaya yol açardı.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
