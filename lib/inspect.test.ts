import { describe, it } from "vitest";
import { byId } from "@/lib/data";
import { computeAll, DEFAULT_PARAMS } from "@/lib/models";
import { rankPicks, weekDecayWeights } from "@/lib/picks";
import { formationLabel } from "@/lib/formations";
import { buildSquad } from "@/lib/squad";

// Geçici gözlem testi: kurulan kadroyu ve ilk önerileri yazdırır.
describe.skipIf(!process.env.INSPECT)("gözlem", () => {
  it("haftanın kadrosu", () => {
    const { results, strength } = computeAll({ model: "abs", params: DEFAULT_PARAMS });
    const rows = rankPicks({
      results,
      ctx: { strength, homeAdvantage: 6 },
      weekWeights: weekDecayWeights(5, 1, 0.5),
    });
    console.log("\n--- ilk 15 öneri ---");
    for (const [i, r] of rows.slice(0, 15).entries()) {
      console.log(
        `${String(i + 1).padStart(2)} ${r.player.name.padEnd(18)} ${byId[r.player.team].name.padEnd(15)} ${r.player.pos} ${String(r.player.price).padStart(5)}M  xP ${r.score.toFixed(2)}  start ${(r.startProb * 100).toFixed(0)}%`,
      );
    }
    const squad = buildSquad(rows).best!;
    console.log(`\n--- kadro (${formationLabel(squad.formation)}) ---`);
    console.log(
      `xP ${squad.xiScore.toFixed(1)} | fiyat ${squad.price} M | ilk11 ${squad.xiPrice} M | kaptan ${squad.captain?.name}`,
    );
    for (const p of squad.xi) {
      console.log(`  XI  ${p.pos.padEnd(4)} ${p.name.padEnd(18)} ${byId[p.team].name.padEnd(15)} ${p.price}M`);
    }
    for (const p of squad.bench) {
      console.log(`  yd  ${p.pos.padEnd(4)} ${p.name.padEnd(18)} ${byId[p.team].name.padEnd(15)} ${p.price}M`);
    }
  });
});
