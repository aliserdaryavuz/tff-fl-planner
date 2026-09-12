// Oyuncu adı eşleme yardımcıları: kaynak sitelerin yazımı ile oyun
// dosyasındaki (data/fantasy-players.json) yazım birbirinden farklı.
// Her kural yalnız tek aday kaldıysa eşler; iki aday varsa null döner.

// Önce küçük harf: Ø, İ gibi büyük harfler NFD ile ayrışmaz, küçültülünce ayrışır.
export const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ø/g, "o")
    .replace(/ß/g, "ss")
    .replace(/đ/g, "d")
    .replace(/æ/g, "ae")
    .replace(/\bjr\b/g, "junior")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokens = (s) => norm(s).split(/[\s-]+/).filter(Boolean);
export const compact = (s) => tokens(s).join("");
const sameSet = (a, b) => a.length === b.length && a.every((t) => b.includes(t));
const unique = (list) => (list.length === 1 ? list[0] : null);

/**
 * Oyun dosyasındaki adı tam adlı bir havuzla (FotMob) eşle. Sırayla: tam ad;
 * boşluk/tire farkı ("Minjae Kim" / "Min-Jae Kim"); kelime kümesi ("Kim
 * Min-jae"); "K. Mbappé" biçimi (baş harf + soyad, gerekirse yalnız son
 * kelime); orta ad farkı ("İrfan Can Kahveci" / "İrfan Kahveci"); tek kelime
 * ya da soyad içerme; tersi. Havuz elemanları { name } taşır.
 */
export function matchFantasyName(fantasyName, pool) {
  const full = norm(fantasyName);
  let hit = unique(pool.filter((p) => norm(p.name) === full));
  if (hit) return hit;
  hit = unique(pool.filter((p) => compact(p.name) === compact(fantasyName)));
  if (hit) return hit;
  const ft = tokens(fantasyName);
  hit = unique(pool.filter((p) => sameSet(tokens(p.name), ft)));
  if (hit) return hit;

  const m = fantasyName.match(/^(\p{L})\.\s+(.+)$/u);
  if (m) {
    const initial = norm(m[1]);
    const rest = norm(m[2]);
    const restLast = tokens(m[2]).slice(-1)[0];
    hit = unique(
      pool.filter((p) => {
        const n = norm(p.name);
        return (n.endsWith(rest) || n.includes(` ${rest}`)) && n.startsWith(initial);
      }),
    );
    if (hit) return hit;
    hit = unique(pool.filter((p) => norm(p.name).endsWith(rest)));
    if (hit) return hit;
    hit = unique(
      pool.filter((p) => {
        const pt = tokens(p.name);
        return pt[pt.length - 1] === restLast && pt[0]?.startsWith(initial);
      }),
    );
    if (hit) return hit;
  }

  if (ft.length >= 2) {
    hit = unique(
      pool.filter((p) => {
        const pt = tokens(p.name);
        return pt.length >= 2 && pt[0] === ft[0] && pt[pt.length - 1] === ft[ft.length - 1];
      }),
    );
    if (hit) return hit;
  }

  hit = unique(
    pool.filter((p) => {
      const n = norm(p.name);
      return n.endsWith(` ${full}`) || n.startsWith(`${full} `) || n.includes(` ${full} `);
    }),
  );
  if (hit) return hit;
  hit = unique(
    pool.filter((p) => {
      const n = norm(p.name);
      return n.length >= 4 && (full.startsWith(`${n} `) || full.endsWith(` ${n}`));
    }),
  );
  if (hit) return hit;

  // Oyunun kısalttığı adlar: "Barış A." (ad + soyadın baş harfi). Yukarıdaki
  // "A. Soyad" kuralının tersi.
  if (ft.length === 2 && ft[1].length === 1) {
    hit = unique(
      pool.filter((p) => {
        const pt = tokens(p.name);
        return pt.length >= 2 && pt[0] === ft[0] && pt[pt.length - 1].startsWith(ft[1]);
      }),
    );
    if (hit) return hit;
  }

  // "Shomu" → "Eldor Shomurodov": oyun soyadı kesiyor. Yalnız tek kelimelik ve
  // yeterince uzun adlarda, tek aday kalırsa: kısa önekler ("Ali", "Can")
  // yanlış oyuncuya bağlanmasın.
  if (ft.length === 1 && full.length >= 5) {
    hit = unique(
      pool.filter((p) => tokens(p.name).some((t) => t.length > full.length && t.startsWith(full))),
    );
    if (hit) return hit;
  }

  return hit;
}

/**
 * Kısa/soyad biçimli bir adı ("Hojlund", "Di Lorenzo", "J Garcia", "Vinicius
 * Jr") oyun dosyasındaki oyuncularla eşle. Havuz elemanları { name } taşır.
 */
export function matchShortName(name, pool) {
  const full = norm(name);
  const ft = tokens(name);
  const last = ft[ft.length - 1];
  let hit = unique(pool.filter((p) => norm(p.name) === full));
  if (hit) return hit;
  hit = unique(pool.filter((p) => compact(p.name) === compact(name)));
  if (hit) return hit;
  hit = unique(pool.filter((p) => norm(p.name).endsWith(full)));
  if (hit) return hit;
  if (ft.length === 2 && ft[0].length === 1) {
    hit = unique(
      pool.filter((p) => {
        const pt = tokens(p.name);
        return pt[pt.length - 1] === last && pt[0]?.startsWith(ft[0]);
      }),
    );
    if (hit) return hit;
  }
  hit = unique(pool.filter((p) => tokens(p.name).includes(last) && tokens(p.name).length > 1));
  if (hit) return hit;
  hit = unique(pool.filter((p) => tokens(p.name).join("") === ft.join("")));
  if (hit) return hit;
  hit = unique(pool.filter((p) => tokens(p.name).join("") === [...ft].reverse().join("")));
  if (hit) return hit;
  // Tam adlı kaynak (FotMob) için: oyun dosyası "K. Mbappé" ise ters yönde dene
  return matchFantasyNameReverse(name, pool);
}

/** Havuzdaki (oyun dosyası) her ad için matchFantasyName(ad, [name]) — tekse. */
function matchFantasyNameReverse(name, pool) {
  const hits = pool.filter((p) => matchFantasyName(p.name, [{ name }]));
  return unique(hits);
}
