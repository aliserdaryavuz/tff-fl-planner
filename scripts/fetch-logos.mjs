// 18 kulübün armasını FotMob'dan indirip public/logos/<takım id>.png olarak yazar.
//
//   node scripts/fetch-logos.mjs
//
// Armalar kulüplerin tescilli markası; burada kişisel kullanım için, tanıtım
// amaçlı. Yeni sezonda takımlar değişince scripts/lib/fotmob.mjs'teki FOTMOB
// tablosunu güncelle ve yeniden çalıştır.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FOTMOB } from "./lib/fotmob.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, "public/logos");
mkdirSync(dir, { recursive: true });

let ok = 0;
for (const [id, [fotmobId]] of Object.entries(FOTMOB)) {
  const url = `https://images.fotmob.com/image_resources/logo/teamlogo/${fotmobId}.png`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) {
    console.error(`${id}: ${res.status} ${url}`);
    continue;
  }
  writeFileSync(resolve(dir, `${id}.png`), Buffer.from(await res.arrayBuffer()));
  ok++;
}
console.log(`${ok}/${Object.keys(FOTMOB).length} arma yazıldı: ${dir}`);
