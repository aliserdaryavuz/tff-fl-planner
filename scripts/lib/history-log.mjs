// Oyuncu geçmişine günlük kayıt ekleme — saf mantık.
// `scripts/log-snapshot.mjs` çağırıyor; `lib/history-log.test.ts` sınıyor.
// Köken: ../ucl-fantasy-planner/scripts/lib/history-log.mjs (+ identity.mjs).
//
// Korunan üç şey (üçü de UCL tarafında hatadan sonra eklendi, yeniden
// keşfetmek yerine taşınıyor):
//
// - Kaydedilen gün oyuncu dosyasının **gözlem** günü (`meta.fetched`), saatin
//   günü değil. Oyun çekimi başarısız olursa dosya eski kalıyor; eski dosya
//   bugünün gözlemi diye yeni gün olarak yazılamıyor.
// - Gün sırası: yalnız son günden sonraki gün eklenir ya da son gün yeniden
//   yazılır; daha eski gün reddedilir ve girdi hiç değiştirilmez.
// - Pencere sezon başından bugüne; sezon öncesi günler sınırdaki değer
//   taşınarak düşer.
//
// TFF farkı: oyun transfer akışı (giren/çıkan) vermiyor, o yüzden UCL'deki
// `net` serisi yok. Olmayan veriden seri üretilmiyor.

/** Tutulan seriler. Oyunun vermediği alan için seri açılmıyor. */
const SERIES = ["price", "sel", "pts", "mins", "status"];

export class HistoryRefusal extends Error {
  /** @param {"bad-day" | "past-day" | "corrupt"} code */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Takvimde gerçekten var olan `yyyy-aa-gg` mi (31.02 gibi tarihler elenir). */
function isRealDay(day) {
  if (!ISO_DAY.test(day)) return false;
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === day;
}

/** Oyuncu anahtarı; ad tek başına takımlar arası benzersiz değil. */
export const keyOf = (p) => `${p.team}|${p.name}`;

/**
 * Oyuncu dosyasının gözlem günü: `gg.aa.yyyy` ya da `yyyy-aa-gg…`; okunamazsa null.
 * TFF dosyasında alan `fetched` (UCL'de `updated`), ikisi de kabul ediliyor.
 */
export function observedDay(meta) {
  const value = meta?.fetched ?? meta?.updated;
  if (typeof value !== "string") return null;
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  const day = tr ? `${tr[3]}-${tr[2]}-${tr[1]}` : value.slice(0, 10);
  return isRealDay(day) ? day : null;
}

/** Sezon başı: "2026/27" → "2026-07-01"; okunamazsa null. */
export function seasonStartOf(season) {
  const m = /^(\d{4})\//.exec(String(season ?? ""));
  return m ? `${m[1]}-07-01` : null;
}

/**
 * Anahtarı kayan oyuncuların kaydını yeni anahtara taşır.
 *
 * Oyun hem adı ("Arda" → "Arda Ünyay") hem kulübü değiştirebiliyor. Anahtar
 * kayarsa eski kayıt öksüz kalır ve oyuncu sıfırdan başlar — fiyat geçmişinde
 * bu kalıcı kayıp, çünkü geriye dönük toplanamıyor. Oyunun kalıcı numarası
 * (`gameId`) kaymayı görünür kılıyor.
 *
 * @returns {{ids: Record<string,string>, moved: string[], blocked: string[]}}
 */
export function migrateKeys(records, prevIds, players) {
  const ids = {};
  const moved = [];
  const blocked = [];
  for (const p of players) {
    if (p.gameId == null) continue;
    const key = keyOf(p);
    ids[p.gameId] = key;
    const was = prevIds?.[p.gameId];
    if (!was || was === key || !records[was]) continue;
    if (records[key]) {
      // Hedef anahtar dolu: iki oyuncu aynı anahtara düşmüş. Üzerine yazmak
      // veri kaybı olurdu; bildirip dokunmuyoruz.
      blocked.push(`${was} -> ${key}`);
      continue;
    }
    records[key] = records[was];
    delete records[was];
    moved.push(`${was} -> ${key}`);
  }
  return { ids, moved, blocked };
}

/**
 * Geçmişe bir günün kaydını ekler ya da son günü yeniden yazar. Girdiyi
 * değiştirmez; reddederse `HistoryRefusal` fırlatır ve hiçbir şey üretmez.
 *
 * @param prev geçmiş dosyası (yoksa null)
 * @param fantasy oyuncu dosyası
 * @param {{ day: string, seasonStart?: string | null }} options
 */
export function appendSnapshot(prev, fantasy, { day, seasonStart = null }) {
  if (!isRealDay(day)) throw new HistoryRefusal("bad-day", `geçersiz gün: ${day}`);
  const oldDays = prev?.meta?.days ?? [];
  for (let i = 1; i < oldDays.length; i++) {
    if (!(oldDays[i - 1] < oldDays[i])) {
      throw new HistoryRefusal(
        "corrupt",
        `geçmiş dosyasında gün sırası bozuk: ${oldDays[i - 1]} → ${oldDays[i]}`,
      );
    }
  }
  const lastDay = oldDays[oldDays.length - 1];
  if (lastDay && day < lastDay) {
    throw new HistoryRefusal(
      "past-day",
      `${day} son kayıtlı günden (${lastDay}) eski: geçmiş gün yeniden yazılmıyor, sonraki günler korunuyor`,
    );
  }

  const week = fantasy.meta?.gameweek ?? null;
  const state = structuredClone(prev ?? { meta: { days: [] }, players: {} });
  const days = [...oldDays];
  // Gün başına hafta numarası: hafta bazlı karşılaştırma için.
  const mds = [...(state.meta.mds ?? oldDays.map(() => week))];
  const players = state.players ?? {};

  const { ids, moved, blocked } = migrateKeys(players, state.meta?.ids ?? {}, fantasy.players);

  const sameDay = day === lastDay;
  let idx;
  if (sameDay) {
    // Aynı gün iki kez çalışırsa son okunan değer geçerli; yalnız son günün
    // satırları siliniyor, önceki günler duruyor.
    idx = days.length - 1;
    mds[idx] = week;
    for (const rec of Object.values(players)) {
      for (const series of Object.values(rec)) {
        while (series.length && series[series.length - 1][0] >= idx) series.pop();
      }
    }
  } else {
    idx = days.length;
    days.push(day);
    mds.push(week);
  }

  /** Seriye yaz; önceki değerle aynıysa satır ekleme. */
  const push = (series, value) => {
    const last = series[series.length - 1];
    if (last && last[1] === value) return false;
    series.push([idx, value]);
    return true;
  };

  let changed = 0;
  let fresh = 0;
  for (const p of fantasy.players) {
    const rec = (players[keyOf(p)] ??= {});
    for (const name of SERIES) rec[name] ??= [];
    if (!rec.price.length) fresh++;
    let touched = false;
    touched = push(rec.price, p.price ?? null) || touched;
    // Seçilme oranı beslemede yoksa (null) satır eklenmiyor: bilinmeyen değer
    // bir değişiklik değil. Durumda ise null bir değer ("sakatlığı geçti").
    if (p.sel != null) touched = push(rec.sel, p.sel) || touched;
    // Birikmiş puan ve dakika: hafta sınırındaki fark o haftada alınan puan.
    touched = push(rec.pts, p.pts ?? 0) || touched;
    touched = push(rec.mins, p.mins ?? 0) || touched;
    touched = push(rec.status, p.status ?? null) || touched;
    if (touched) changed++;
  }

  // Oyundan düşen oyuncular kayıtta kalır ama büyümez; seri boşsa temizle.
  for (const [key, rec] of Object.entries(players)) {
    if (!Object.values(rec).some((series) => series.length)) delete players[key];
  }

  // Sezon öncesi günler düşüyor; sınırdaki son değer taşınıyor, bugünün günü
  // hiç düşmüyor.
  let dropped = 0;
  if (seasonStart) {
    const before = days.findIndex((d) => d >= seasonStart);
    dropped = Math.min(before < 0 ? days.length : before, idx);
  }
  if (dropped > 0) {
    days.splice(0, dropped);
    mds.splice(0, dropped);
    for (const rec of Object.values(players)) {
      for (const [name, series] of Object.entries(rec)) {
        let carry;
        const kept = [];
        for (const [i, v] of series) {
          if (i < dropped) carry = [v];
          else kept.push([i - dropped, v]);
        }
        if (carry && (!kept.length || kept[0][0] > 0)) kept.unshift([0, carry[0]]);
        rec[name] = kept;
      }
    }
    idx -= dropped;
  }

  return {
    out: {
      meta: {
        source: "TFF Fantezi Lig resmî API (tfffantezilig.com)",
        fetched: days[days.length - 1] ?? null,
        days,
        mds,
        /** Oyunun kalıcı oyuncu numarası -> bugünkü anahtar; kaymayı yakalamak için. */
        ids,
        players: Object.keys(players).length,
      },
      players,
    },
    idx,
    sameDay,
    changed,
    fresh,
    moved,
    blocked,
    dropped,
  };
}
