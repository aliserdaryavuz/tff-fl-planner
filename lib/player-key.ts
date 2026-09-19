import { slugify } from "@/lib/slug";

/**
 * Oyuncunun kimliği: liste anahtarı ve adres parçası.
 *
 * İkisi de `team` + `name`'den türeyen saf fonksiyonlar ama `playerKey`
 * `lib/fantasy.ts` içindeydi; o modül 226 KB'lık oyuncu dosyasını import ettiği
 * için anahtarı ya da adresi hesaplamak isteyen her yer (bağlantı bileşeni,
 * adres çözümü) bütün veriyi pakete sokuyordu. `lib/fantasy.ts` aynı adla
 * yeniden dışa aktarıyor, mevcut çağrı yerleri değişmedi.
 *
 * Parametre yapısal: `Player` tipini içeri almıyor ki bu modül hiçbir veriye
 * bağlı kalmasın. Tam bir `Player` geçmek de çalışıyor.
 */

/** Oyuncuyu kilitleme/dışlama listelerinde tanımlayan anahtar. */
export function playerKey(player: { team: string; name: string }): string {
  return `${player.team}|${player.name}`;
}

/**
 * Oyuncunun adresi: kulüp + ad.
 *
 * Ad tek başına yetmiyor — ölçüldü: 528 oyuncuda yalnız adla **44 çakışma**
 * var (yedi ayrı "Arda", üç "Enes"). Kulüple birlikte 528'in hepsi benzersiz.
 */
export function playerSlug(player: { team: string; name: string }): string {
  return `${slugify(player.team)}-${slugify(player.name)}`;
}
