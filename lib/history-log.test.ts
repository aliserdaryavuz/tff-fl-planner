import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendSnapshot,
  HistoryRefusal,
  observedDay,
  seasonStartOf,
} from "../scripts/lib/history-log.mjs";

/**
 * Günlük fiyat kaydı, başarısız çekimden ve eski tarih yazımından korunuyor.
 *
 * Bu uç durumların çoğu UCL tarafında hatadan sonra eklenmişti; buraya
 * yeniden keşfedilmek yerine taşındı. Saf mantık doğrudan sınanıyor, betik ise
 * geçici klasörde (`--data`) — gerçek geçmiş dosyasına dokunmadan.
 */

type Row = [number, unknown];
type History = {
  meta: { source: string; days: string[]; mds: (number | null)[]; ids: Record<string, string>; players: number };
  players: Record<string, Record<string, Row[]>>;
};

const player = (over: Record<string, unknown> = {}) => ({
  gameId: 1,
  team: "Galatasaray",
  name: "Arda",
  pos: "MID",
  price: 6,
  sel: 10,
  status: null,
  pts: 0,
  mins: 0,
  ...over,
});

const fantasy = (players: ReturnType<typeof player>[], fetched = "2026-09-12", gameweek = 5) => ({
  meta: { fetched, gameweek },
  players,
});

const D = ["2026-09-10", "2026-09-11", "2026-09-12"];
const KEY = "Galatasaray|Arda";

const history = (): History => ({
  meta: { source: "x", days: [...D], mds: [5, 5, 5], ids: { 1: KEY }, players: 1 },
  players: {
    [KEY]: {
      price: [[0, 6], [1, 6.5], [2, 7]],
      sel: [[0, 10]],
      pts: [[0, 0], [2, 5]],
      mins: [[0, 0], [2, 90]],
      status: [[0, null]],
    },
  },
});

const refusal = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(HistoryRefusal);
    return (e as { code: string }).code;
  }
  throw new Error("reddedilmedi");
};

describe("gözlem günü", () => {
  it("oyuncu dosyasının tarihinden okunuyor; bozuk tarih null", () => {
    expect(observedDay({ fetched: "2026-09-13" })).toBe("2026-09-13");
    expect(observedDay({ fetched: "13.09.2026" })).toBe("2026-09-13");
    expect(observedDay({ fetched: "2026-09-13T05:00:00Z" })).toBe("2026-09-13");
    // Takvimde olmayan gün: sessizce kabul edilirse kayıt uydurma güne düşer.
    expect(observedDay({ fetched: "31.02.2026" })).toBeNull();
    expect(observedDay({})).toBeNull();
    expect(seasonStartOf("2026/27")).toBe("2026-07-01");
    expect(seasonStartOf(undefined)).toBeNull();
  });
});

describe("gün sırası", () => {
  it("geçmiş güne yazma reddediliyor; sonraki günler silinmiyor, girdi değişmiyor", () => {
    const prev = history();
    const before = JSON.stringify(prev);
    expect(refusal(() => appendSnapshot(prev, fantasy([player({ price: 9 })]), { day: "2026-09-10" }))).toBe("past-day");
    expect(JSON.stringify(prev)).toBe(before);
  });

  it("listede olmayan daha eski gün sona eklenmiyor", () => {
    expect(refusal(() => appendSnapshot(history(), fantasy([player()]), { day: "2026-09-01" }))).toBe("past-day");
  });

  it("son gün yeniden yazılabiliyor; önceki günlerin satırları aynı kalıyor", () => {
    const r = appendSnapshot(history(), fantasy([player({ price: 7.5 })]), { day: "2026-09-12" });
    expect(r.sameDay).toBe(true);
    expect(r.out.meta.days).toEqual(D);
    expect(r.out.players[KEY].price).toEqual([[0, 6], [1, 6.5], [2, 7.5]]);
  });

  it("sonraki gün ekleniyor", () => {
    const r = appendSnapshot(history(), fantasy([player({ price: 8 })], "2026-09-13"), { day: "2026-09-13" });
    expect(r.sameDay).toBe(false);
    expect(r.out.meta.days).toEqual([...D, "2026-09-13"]);
    expect(r.out.players[KEY].price).toEqual([[0, 6], [1, 6.5], [2, 7], [3, 8]]);
  });

  it("gün sırası bozuk geçmiş dosyasına yazılmıyor", () => {
    const bad = history();
    bad.meta.days = ["2026-09-10", "2026-09-12", "2026-09-11"];
    expect(refusal(() => appendSnapshot(bad, fantasy([player()]), { day: "2026-09-13" }))).toBe("corrupt");
    const dup = history();
    dup.meta.days = ["2026-09-10", "2026-09-10", "2026-09-12"];
    expect(refusal(() => appendSnapshot(dup, fantasy([player()]), { day: "2026-09-13" }))).toBe("corrupt");
  });

  it("geçersiz gün reddediliyor", () => {
    expect(refusal(() => appendSnapshot(history(), fantasy([player()]), { day: "2026-02-31" }))).toBe("bad-day");
  });
});

describe("başarısız çekim yeni gözlem yaratmıyor", () => {
  it("oyuncu dosyası eski kalınca saat ilerlese de yeni gün eklenmiyor", () => {
    const stale = fantasy([player({ price: 7, pts: 5, mins: 90 })], "2026-09-12");
    const r = appendSnapshot(history(), stale, { day: observedDay(stale.meta)! });
    expect(r.sameDay).toBe(true);
    expect(r.out.meta.days).toEqual(D);
  });
});

describe("alan durumları", () => {
  it("seçilme oranı yoksa satır eklenmiyor; durum null bir değişiklik olarak kaydediliyor", () => {
    const prev = history();
    prev.players[KEY].status = [[0, "I"]];
    const r = appendSnapshot(prev, fantasy([player({ price: 7, sel: null, status: null })], "2026-09-13"), {
      day: "2026-09-13",
    });
    expect(r.out.players[KEY].sel).toEqual([[0, 10]]);
    expect(r.out.players[KEY].status).toEqual([[0, "I"], [3, null]]);
  });

  it("değer değişmediyse satır eklenmiyor", () => {
    const r = appendSnapshot(history(), fantasy([player({ price: 7, pts: 5, mins: 90 })], "2026-09-13"), {
      day: "2026-09-13",
    });
    expect(r.out.players[KEY].price).toEqual([[0, 6], [1, 6.5], [2, 7]]);
    expect(r.changed).toBe(0);
  });

  it("gameId aynı, ad değişmiş: seri yeni anahtara taşınıyor", () => {
    const r = appendSnapshot(history(), fantasy([player({ name: "Arda Ünyay", price: 7 })], "2026-09-13"), {
      day: "2026-09-13",
    });
    expect(r.moved).toHaveLength(1);
    expect(r.out.players[KEY]).toBeUndefined();
    expect(r.out.players["Galatasaray|Arda Ünyay"].price).toEqual([[0, 6], [1, 6.5], [2, 7]]);
    expect(r.out.meta.ids).toEqual({ 1: "Galatasaray|Arda Ünyay" });
  });

  it("hedef anahtar doluysa taşınmıyor, bildiriliyor", () => {
    const prev = history();
    prev.players["Galatasaray|Kerem"] = { price: [[0, 9]], sel: [], pts: [], mins: [], status: [] };
    const r = appendSnapshot(prev, fantasy([player({ name: "Kerem", price: 7 })], "2026-09-13"), {
      day: "2026-09-13",
    });
    expect(r.blocked).toHaveLength(1);
    expect(r.moved).toHaveLength(0);
    // Üzerine yazılmadı: eski seri duruyor.
    expect(r.out.players["Galatasaray|Kerem"].price[0]).toEqual([0, 9]);
  });
});

describe("sezon penceresi", () => {
  it("sezon öncesi günler son değer taşınarak düşüyor", () => {
    const add = (base: string, n: number) =>
      new Date(Date.parse(`${base}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const days = ["2026-06-29", "2026-06-30", ...Array.from({ length: 10 }, (_, i) => add("2026-07-01", i))];
    const prev: History = {
      meta: { source: "x", days, mds: days.map(() => 1), ids: { 1: KEY }, players: 1 },
      players: { [KEY]: { price: [[0, 5], [1, 5.5]], sel: [[0, 10]], pts: [[0, 0]], mins: [[0, 0]], status: [[0, null]] } },
    };
    const next = add("2026-07-01", 10);
    const r = appendSnapshot(prev, fantasy([player({ price: 5.5 })], next), { day: next, seasonStart: "2026-07-01" });
    expect(r.dropped).toBe(2);
    expect(r.out.meta.days[0]).toBe("2026-07-01");
    // Sınırdaki değer taşındı: seri "5,5'ten başlıyor" diye okunmalı.
    expect(r.out.players[KEY].price).toEqual([[0, 5.5]]);
  });
});

describe("betik geçici klasörde", () => {
  it("gerçek geçmiş dosyasına dokunmuyor; farklı gün ve eski gözlem çıkış 2, doğru gün yazılıyor", () => {
    const real = existsSync("data/player-history.json")
      ? createHash("sha256").update(readFileSync("data/player-history.json")).digest("hex")
      : null;
    const dir = mkdtempSync(join(tmpdir(), "history-log-"));
    try {
      const put = (name: string, value: unknown) => writeFileSync(join(dir, name), JSON.stringify(value));
      const run = (...a: string[]) =>
        spawnSync(process.execPath, ["scripts/log-snapshot.mjs", ...a, "--data", dir], { encoding: "utf8" });
      put("player-history.json", history());

      put("fantasy-players.json", fantasy([player({ price: 8 })], "2026-09-13"));
      expect(run("2026-09-10").status).toBe(2);

      put("fantasy-players.json", fantasy([player({ price: 8 })], "2026-09-10"));
      const past = run();
      expect(past.status).toBe(2);
      expect(past.stderr).toMatch(/past-day/);
      expect(JSON.parse(readFileSync(join(dir, "player-history.json"), "utf8"))).toEqual(history());

      put("fantasy-players.json", fantasy([player({ price: 8 })], "2026-09-13"));
      const ok = run();
      expect(ok.status, ok.stderr).toBe(0);
      const written = JSON.parse(readFileSync(join(dir, "player-history.json"), "utf8")) as History;
      expect(written.meta.days).toEqual([...D, "2026-09-13"]);
      expect(written.players[KEY].price).toEqual([[0, 6], [1, 6.5], [2, 7], [3, 8]]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    if (real) {
      expect(createHash("sha256").update(readFileSync("data/player-history.json")).digest("hex")).toBe(real);
    }
  });
});
