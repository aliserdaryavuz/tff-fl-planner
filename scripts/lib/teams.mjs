// 18 Süper Lig kulübü: kendi id'miz, görünen ad, kaynak sitelerdeki adları
// yakalayan anahtar kelime (normalize edilmiş) ve 2025/26 sıralaması.
// `last`: geçen sezonun bitiş sırası (Wikipedia, 2025–26 Süper Lig nihai
// tablo); yükselen üç takım 1. Lig sırasına göre 16-18 (Erzurumspor şampiyon,
// Amedspor, Çorum FK).

export const TEAMS = [
  { id: "Galatasaray", name: "Galatasaray", key: "galatasaray", last: 1 },
  { id: "Fenerbahce", name: "Fenerbahçe", key: "fenerbahce", last: 2 },
  { id: "Trabzonspor", name: "Trabzonspor", key: "trabzonspor", last: 3 },
  { id: "Besiktas", name: "Beşiktaş", key: "besiktas", last: 4 },
  { id: "Basaksehir", name: "Başakşehir", key: "basaksehir", last: 5 },
  { id: "Goztepe", name: "Göztepe", key: "goztepe", last: 6 },
  { id: "Samsunspor", name: "Samsunspor", key: "samsunspor", last: 7 },
  { id: "Rizespor", name: "Rizespor", key: "rize", last: 8 },
  { id: "Konyaspor", name: "Konyaspor", key: "konyaspor", last: 9 },
  { id: "Kocaelispor", name: "Kocaelispor", key: "kocaelispor", last: 10 },
  { id: "Alanyaspor", name: "Alanyaspor", key: "alanyaspor", last: 11 },
  { id: "Gaziantep", name: "Gaziantep FK", key: "gaziantep", last: 12 },
  { id: "Kasimpasa", name: "Kasımpaşa", key: "kasimpasa", last: 13 },
  { id: "Genclerbirligi", name: "Gençlerbirliği", key: "genclerbirligi", last: 14 },
  { id: "Eyupspor", name: "Eyüpspor", key: "eyupspor", last: 15 },
  { id: "Erzurumspor", name: "Erzurumspor", key: "erzurumspor", last: 16 },
  { id: "Amedspor", name: "Amedspor", key: "amed", last: 17 },
  { id: "Corum", name: "Çorum FK", key: "corum", last: 18 },
];

/** Türkçe karakterleri ve noktalamayı atar: "ÇAYKUR RİZESPOR A.Ş." -> "caykur rizespor a s". */
export const norm = (s) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Kaynak sitedeki adı kendi id'mize çevirir; tek eşleşme yoksa null. */
export function teamIdOf(sourceName) {
  const n = ` ${norm(sourceName)} `;
  const hits = TEAMS.filter((t) => n.includes(` ${t.key}`));
  return hits.length === 1 ? hits[0].id : null;
}
