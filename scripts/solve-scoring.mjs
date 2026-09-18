// TFF Fantezi Lig puan tablosunu oyunun kendi verisinden çözer.
//
//   node scripts/solve-scoring.mjs [--pos DEF] [--csv]
//
// Neden: `lib/scoring.mjs` tablosu TFF'nin kural sayfasından **elle** yazıldı.
// Kural metni her kalemi yazmıyor olabilir ve yazdığını bizim okuduğumuz gibi
// uygulamıyor olabilir. Oyunun beslemesi her oyuncunun sezon dökümünü (gol,
// asist, gol yememe, kurtarış, kart, bonus) ve `totalPoints`'ini veriyor; yani
// katsayılar en küçük karelerle **geri çıkarılabilir**.
//
// Yöntem: oyuncu başına bir denklem, mevki başına ayrı çözüm.
//
//   pts = Σ katsayı_k × sayım_k
//
// Sayımların bir kısmı maç bazlı eşik taşıyor (süre puanı, yenilen gol, kurtarış)
// ve sezon toplamından türetilemez; onlar `data/lineups.json`'daki maç maç
// kayıttan toplanıyor. Gol, asist, gol yememe, kart ve bonus oyunun resmî sezon
// toplamlarından: kaynak orası olduğu için en güvenilir sayım o.
//
// Çözülemeyen kalem uydurulmaz: sütunu boşsa ya da neredeyse boşsa "belirlenemedi"
// yazılır. 18.09.2026 örnekleminde kaleci golü hiç yok, kendi kalesine gol 6,
// penaltı kurtarma 3, penaltı kaçırma 4 — bunlar gürültüden ayrışmıyor.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ONLY = opt("pos");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { SCORING } = await import(pathToFileURL(resolve(root, "lib/scoring.mjs")).href);

// `lib/lineups.ts` TypeScript; aynı kural burada da geçerli olsun diye kopyası.
// Değişirse ikisi birden değişmeli (lib/scoring-solve.test.ts bağlıyor).
const UNSCORED = /champions|europa|conference|friendl|cup|kupa/i;
const scored = (m) => !UNSCORED.test(m.competition);

const players = JSON.parse(readFileSync(resolve(root, "data/fantasy-players.json"), "utf8")).players;
const lineups = JSON.parse(readFileSync(resolve(root, "data/lineups.json"), "utf8")).players;

/**
 * Çözülecek kalemler. `from` sayımın nereden geldiğini söylüyor:
 * "game" oyunun sezon toplamı, "match" maç maç kayıttan türetilen eşik.
 * `expected` elle yazılmış tablodaki karşılığı; çözüm onunla karşılaştırılıyor.
 */
const TERMS = [
  { key: "apps", label: "sahaya çıkma", from: "match", expected: () => SCORING.appearance.upTo60 },
  { key: "over60", label: "60 dk üstü (ek)", from: "match", expected: () => SCORING.appearance.over60 - SCORING.appearance.upTo60 },
  { key: "goals", label: "gol", from: "game", expected: (pos) => SCORING.goal[pos] },
  { key: "assists", label: "asist", from: "game", expected: () => SCORING.assist },
  { key: "cleanSheets", label: "gol yememe", from: "game", expected: (pos) => SCORING.cleanSheet[pos] },
  { key: "concededSteps", label: "yenilen gol (her 2)", from: "match", expected: (pos) => (pos === "GK" || pos === "DEF" ? SCORING.concededPenalty : 0) },
  { key: "saveSteps", label: "kurtarış (her 3)", from: "match", expected: (pos) => (pos === "GK" ? 1 : 0) },
  { key: "yellow", label: "sarı kart", from: "game", expected: () => SCORING.yellow },
  { key: "red", label: "kırmızı kart", from: "game", expected: () => SCORING.red },
  { key: "ownGoals", label: "kendi kalesine", from: "match", expected: () => SCORING.ownGoal },
  { key: "penMissed", label: "penaltı kaçırma", from: "match", expected: () => SCORING.penaltyMiss },
  { key: "penSaved", label: "penaltı kurtarma", from: "match", expected: () => SCORING.penaltySave },
  { key: "bonus", label: "bonus", from: "game", expected: () => 1 },
];

/** Bir oyuncunun sayım vektörü; veri tutarsızsa null. */
function featuresOf(p) {
  const info = lineups[`${p.team}|${p.name}`];
  if (!info || !p.mins) return null;
  const lig = info.recent.filter(scored);
  const mins = lig.reduce((s, m) => s + m.minutes, 0);
  // Oyunun dakikası ile maç kaydı tutmuyorsa denklem yanlış kurulur.
  if (Math.abs(mins - p.mins) > 20) return null;

  let apps = 0;
  let over60 = 0;
  let concededSteps = 0;
  let saveSteps = 0;
  let ownGoals = 0;
  let penMissed = 0;
  let penSaved = 0;
  for (const m of lig) {
    if (m.minutes <= 0) continue;
    apps++;
    if (m.minutes > 60) over60++;
    // Ceza yalnız oyuncu sahadayken yenilen gole işliyor (18.09 ölçümü);
    // `concededOn` yoksa eski davranışa, maç toplamına düşülür.
    concededSteps += Math.floor((m.concededOn ?? m.conceded ?? 0) / SCORING.concededPer);
    // Kurtarış da MAÇ BAŞINA üçer üçer puanlanıyor. Sezon toplamını 3'e bölmek
    // yanlış: 5 maçta ikişer kurtarış yapan kaleci maç başına 0 puan alır,
    // sezon toplamıyla (10/3) 3 puan yazılırdı. Kalecinin 5/21'de takılmasının
    // sebebi buydu (PLAN.md 1.1); maç bazlı veri 1.3 ile geldi.
    saveSteps += Math.floor((m.saves ?? 0) / SCORING.savesPerPoint);
    ownGoals += m.ownGoals ?? 0;
    penMissed += m.penMissed ?? 0;
    penSaved += m.penSaved ?? 0;
  }
  return {
    apps,
    over60,
    goals: p.goals ?? 0,
    assists: p.assists ?? 0,
    cleanSheets: p.cleanSheets ?? 0,
    concededSteps,
    saveSteps,
    yellow: p.yellow ?? 0,
    red: p.red ?? 0,
    ownGoals,
    penMissed,
    penSaved,
    bonus: p.bonus ?? 0,
    target: p.pts ?? 0,
  };
}

/** Normal denklemler + kısmi pivotlu Gauss eliminasyonu. Boyut küçük (≤13). */
function leastSquares(rows, keys) {
  const n = keys.length;
  const ata = Array.from({ length: n }, () => new Array(n).fill(0));
  const atb = new Array(n).fill(0);
  for (const r of rows) {
    for (let i = 0; i < n; i++) {
      const vi = r[keys[i]];
      if (vi === 0) continue;
      atb[i] += vi * r.target;
      for (let j = 0; j < n; j++) ata[i][j] += vi * r[keys[j]];
    }
  }
  // Küçük sırt terimi: neredeyse eşdoğrusal sütunlar çözümü patlatmasın.
  for (let i = 0; i < n; i++) ata[i][i] += 1e-8;

  const m = ata.map((row, i) => [...row, atb[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    if (Math.abs(m[piv][col]) < 1e-12) return null;
    [m[col], m[piv]] = [m[piv], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  // Gauss-Jordan sonrası köşegen dışı sıfır: katsayı = sağ taraf / pivot.
  return m.map((row, i) => row[n] / row[i]);
}

const POSITIONS = ONLY ? [ONLY] : ["GK", "DEF", "MID", "FWD"];
/** Bir kalemin çözülebilmesi için gereken en az gözlem. */
const MIN_EVENTS = 10;

for (const pos of POSITIONS) {
  const rows = players.filter((p) => p.pos === pos).map(featuresOf).filter(Boolean);
  console.log(`\n=== ${pos} — ${rows.length} oyuncu ===`);
  if (rows.length < 20) {
    console.log("  çok az gözlem, çözüm anlamsız");
    continue;
  }

  // Sütun toplamı küçük olan kalem çözülemez; sabit tutulup hedeften düşülüyor.
  const total = (key) => rows.reduce((s, r) => s + Math.abs(r[key]), 0);
  const solvable = TERMS.filter((t) => total(t.key) >= MIN_EVENTS);
  const fixed = TERMS.filter((t) => total(t.key) < MIN_EVENTS);

  const adjusted = rows.map((r) => ({
    ...r,
    target: r.target - fixed.reduce((s, t) => s + r[t.key] * t.expected(pos), 0),
  }));

  const keys = solvable.map((t) => t.key);
  const coef = leastSquares(adjusted, keys);
  if (!coef) {
    console.log("  çözülemedi (tekil matris)");
    continue;
  }

  console.log("  kalem                  çözülen   tablo   fark");
  solvable.forEach((t, i) => {
    const got = coef[i];
    const want = t.expected(pos);
    const flag = Math.abs(got - want) > 0.25 ? "  <-- SAPMA" : "";
    console.log(
      `  ${t.label.padEnd(20)} ${got.toFixed(2).padStart(7)} ${String(want).padStart(7)} ${(got - want).toFixed(2).padStart(6)}${flag}`,
    );
  });
  for (const t of fixed) {
    console.log(`  ${t.label.padEnd(20)} ${"belirlenemedi".padStart(7)}  (gözlem ${total(t.key)}, tablodaki ${t.expected(pos)} kullanıldı)`);
  }

  // Çözülen katsayılarla ve tablodaki katsayılarla yeniden kurma başarısı.
  const rebuild = (useSolved) =>
    rows.filter((r) => {
      let pred = fixed.reduce((s, t) => s + r[t.key] * t.expected(pos), 0);
      solvable.forEach((t, i) => {
        pred += r[t.key] * (useSolved ? coef[i] : t.expected(pos));
      });
      return Math.abs(pred - r.target) < 0.5;
    }).length;
  const rmse = (useSolved) => {
    let s = 0;
    for (const r of rows) {
      let pred = fixed.reduce((acc, t) => acc + r[t.key] * t.expected(pos), 0);
      solvable.forEach((t, i) => {
        pred += r[t.key] * (useSolved ? coef[i] : t.expected(pos));
      });
      s += (pred - r.target) ** 2;
    }
    return Math.sqrt(s / rows.length);
  };
  console.log(
    `  birebir: tablo ${rebuild(false)}/${rows.length} · çözüm ${rebuild(true)}/${rows.length}` +
      ` | RMSE: tablo ${rmse(false).toFixed(2)} · çözüm ${rmse(true).toFixed(2)}`,
  );
}
