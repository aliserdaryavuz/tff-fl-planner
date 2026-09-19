import type { NextConfig } from "next";

const dev = process.env.NODE_ENV === "development";

/**
 * İçerik güvenliği politikası.
 *
 * Çalışma anında dış kaynak yok ve bu ölçüldü: yazı tipleri `next/font` ile
 * derlemede kendi sunucumuza iniyor, kulüp armaları `public/logos/` altında
 * yerel (veri dosyasındaki `cdn.tfffantezilig.com` adresi yalnız çekim
 * betiğinin kaynağı, sayfada kullanılmıyor). Bu yüzden `default-src 'self'`
 * yeterli ve hiçbir dış alan adı açılmıyor.
 *
 * **`script-src 'unsafe-inline'` bilinçli bir taviz.** Next hidrasyon verisini
 * satır içi `<script>` ile gönderiyor; nonce vermek middleware gerektirirdi ve
 * bu statik site için ağır. Taviz şunu bırakıyor: satır içi betik yine
 * çalışabilir, yani XSS'e karşı tam koruma yok. Kalan kazanç yine de gerçek —
 * **dış** kaynaklı betik yüklenemiyor. Sitede kullanıcı girdisi, oturum ya da
 * ödeme olmadığı için kalan risk sınırlı.
 *
 * `data:` ve `blob:` görsellerde açık: dışa aktarma (`html-to-image`) armaları
 * veri URL'si olarak gömüyor ve çıktıyı blob olarak veriyor.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // Geliştirmede React Refresh eval kullanıyor; üretimde açılmıyor.
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  // Geliştirmede HMR WebSocket'i aynı kaynakta ama ws: şemasıyla.
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // MIME türü tahminini kapat: yanlış türle servis edilen bir dosya
          // betik gibi çalıştırılmasın.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Dış bağlantılara tam adres sızmasın; kendi içimizde tam kalsın.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Sitenin ihtiyacı olmayan cihaz izinleri kapalı.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
