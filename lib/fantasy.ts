import raw from "@/data/fantasy-players.json";
import { byId } from "@/lib/data";

export type Position = "GK" | "DEF" | "MID" | "FWD";

/** Oyuncu durumu: sakat, şüpheli, cezalı. */
export type PlayerStatus = "I" | "D" | "S";

export type Player = {
  /** Oyunun gösterdiği kısa ad ("Salah", "Arda (2)"); arayüzde bu görünür. */
  name: string;
  /**
   * Oyunun tam adı ("Arda Okan Kurtulan"). Kısa ad takım içinde tekrar
   * edebildiği için FotMob eşlemesi bunu ve forma numarasını kullanır.
   */
  fullName?: string | null;
  shirt?: number | null;
  /** data/superlig-2026-27.json'daki takım id'si. */
  team: string;
  pos: Position;
  /** TFF Fantezi Lig fiyatı, milyon TL; oyun verisi yoksa null. */
  price: number | null;
  /** Seçilme yüzdesi; oyun vermezse null. */
  sel: number | null;
  status: PlayerStatus | null;
  /** Oyunun birikmiş puanı ve dakikası; veri yoksa 0. */
  pts: number;
  mins: number;
  /** FotMob oyuncu id'si (kadro ve maç verisi eşlemesi). */
  fotmobId?: number | null;
  gameId?: number | string | null;
  /**
   * Oyunun resmî sezon toplamları (scripts/fetch-game.mjs). Oyunun hiç
   * doldurmadığı alanlar dosyaya yazılmaz, bu yüzden hepsi isteğe bağlı.
   */
  goals?: number;
  assists?: number;
  cleanSheets?: number;
  conceded?: number;
  saves?: number;
  yellow?: number;
  red?: number;
  bonus?: number;
  /** Son maçlardaki ortalama puan (oyunun "form"u) ve maç başına puan. */
  form?: number;
  ppm?: number;
  /** Oyunun oyuncu haberi (sakatlık/durum notu). */
  news?: string | null;
  /** Kulüpten ayrılmak üzere. */
  leaving?: boolean | null;
};

export type FantasyMeta = {
  source: string;
  /**
   * Dosyanın gözlem günü (yyyy-aa-gg). Günlük fiyat kaydı bunu kullanıyor:
   * çekim başarısız olup dosya eski kalırsa, eski değerler bugünün gözlemi
   * diye kaydedilmemeli (`scripts/log-snapshot.mjs`).
   */
  fetched?: string;
  gameweek: number | null;
  players: number;
  /** "game": fiyatlar oyundan; "none": yalnız FotMob kadrosu, fiyat yok. */
  pricesFrom: "game" | "none";
  pointsCover: "prev-season" | "this-season" | "none";
  fotmobMatched?: number;
};

export const players: Player[] = raw.players as Player[];
export const fantasyMeta: FantasyMeta = raw.meta as FantasyMeta;

export const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

/** Fiyat verisi var mı: kadro kurucu ancak o zaman çalışır. */
export const hasPrices =
  fantasyMeta.pricesFrom === "game" && players.some((p) => p.price != null);

// Mevki ve durum adları arayüz dilinde: lib/i18n.ts `positions` / `status`.

/** Takım id -> oyuncular; mevki sırasına, mevki içinde fiyata/ada göre. */
export const playersByTeam: Record<string, Player[]> = (() => {
  const out: Record<string, Player[]> = {};
  for (const id of Object.keys(byId)) out[id] = [];
  for (const p of players) out[p.team]?.push(p);
  for (const id of Object.keys(out)) {
    out[id].sort(
      (a, b) =>
        POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos) ||
        (b.price ?? 0) - (a.price ?? 0) ||
        a.name.localeCompare(b.name, "tr"),
    );
  }
  return out;
})();

export function playersOf(team: string, pos: Position): Player[] {
  return playersByTeam[team]?.filter((p) => p.pos === pos) ?? [];
}

/** Oyuncuyu kilitleme/dışlama listelerinde tanımlayan anahtar. */
export function playerKey(player: { team: string; name: string }): string {
  return `${player.team}|${player.name}`;
}
