/**
 * Adres parçası üretir. Türkçe ve aksanlı harfler sadeleşir.
 *
 * Küçük harfe çevirme ve Türkçe katlama **önce** yapılıyor: NFD büyük `İ` ve
 * `Ø`'yu ayrıştırmıyor, yani sonra yapılsa o harfler düşerdi. Aynı tuzak
 * `scripts/lib/names.mjs` içinde de var.
 *
 * Ayrı ve **veri içermeyen** dosyada: hem takım (`lib/data.ts`) hem oyuncu
 * (`lib/player-key.ts`) kullanıyor ve adres hesaplamak isteyen bir bağlantı
 * bileşeninin 226 KB'lık oyuncu dosyasını pakete sokmaması gerekiyor.
 *
 * Köken: `../ucl-fantasy-planner/lib/slug.ts`.
 */
export function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ø/g, "o")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
