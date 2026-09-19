import { describe, expect, it } from "vitest";
import { cardGains } from "@/lib/cards";
import { bankOf, currentSquad, improveSquad } from "@/lib/improve";
import { computeAll, windowMask } from "@/lib/models";
import { rankPicks, weekDecayWeights } from "@/lib/picks";
import { MAX_PER_CLUB, SQUAD_SIZE } from "@/lib/squad";
import { DEFAULT_STATE } from "@/lib/url-state";

/**
 * Gerçek veriyle akıl sağlığı sınaması.
 *
 * `improve.test.ts` ve `cards.test.ts` kısıtları sentetik veriyle sınıyor.
 * Burada sınanan başka bir şey: **hattın ucu gerçek dosyalara bağlı mı.**
 * `currentSquad()` oyunun kadro kaydını oyuncu dosyasına `gameId` ile
 * bağlıyor; o eşleme bozulursa her şey derlemeden geçer, testler geçer ve
 * sayfa sessizce boş kadroyla çalışır.
 *
 * İddialar bilerek **yapısal**: veri her hafta değişiyor, bugünkü sayıları
 * teste gömmek onu takvimle kırılan bir teste çevirirdi.
 */

const state = DEFAULT_STATE;
const { results, strength } = computeAll({
  model: state.model,
  params: state.params,
  weeks: windowMask(state.gw, state.horizon),
});

const rows = rankPicks({
  results,
  ctx: { strength, homeAdvantage: state.params[state.model].ha },
  weekWeights: weekDecayWeights(state.gw, state.horizon, state.weekDecay),
  weights: state.picks,
  minutesImpact: state.minutesImpact,
  selInvert: state.selInvert,
});

describe("gerçek veriyle iyileştirme", () => {
  it("oyunun kadrosu okunuyor ve oyuncu dosyasıyla tam eşleşiyor", () => {
    const { players, missing } = currentSquad();
    expect(players).toHaveLength(SQUAD_SIZE);
    expect(missing).toHaveLength(0);
  });

  it("öneriler bütçeyi ve kulüp sınırını çiğnemiyor", () => {
    const { players } = currentSquad();
    const plan = improveSquad(players, rows, { bank: bankOf(), benchWeight: state.benchWeight });

    expect(plan.squad).toHaveLength(SQUAD_SIZE);
    expect(plan.bank).toBeGreaterThanOrEqual(0);
    for (const club of new Set(plan.squad.map((p) => p.team))) {
      expect(plan.squad.filter((p) => p.team === club).length).toBeLessThanOrEqual(MAX_PER_CLUB);
    }
  });

  it("kısıt gevşetmek kadroyu kötüleştirmez", () => {
    const { players } = currentSquad();
    const opts = { benchWeight: state.benchWeight };
    const base = improveSquad(players, rows, { ...opts, bank: bankOf() });
    const sinirsiz = improveSquad(players, rows, { ...opts, bank: Number.POSITIVE_INFINITY });

    // Sinirsiz butce bir GEVSETME: ayni takaslar hep ulasilabilir durumda
    // kaliyor, dolayisiyla sonuc tabanin altina dusmemeli. Dustugu gun
    // aramada sira bagimli bir hata var demektir.
    expect(sinirsiz.final.value).toBeGreaterThanOrEqual(base.final.value - 1e-9);
  });

  it("kart kazançları negatif değil ve büyükten küçüğe sıralı", () => {
    const { players } = currentSquad();
    const gains = cardGains(players, rows, { bank: bankOf(), benchWeight: state.benchWeight });

    for (const g of gains) expect(g.gain).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i - 1].gain).toBeGreaterThanOrEqual(gains[i].gain);
    }
  });

  it("kaptan çarpanı kartları birbiriyle tutarlı: Dört Dörtlük = 2 × Tripleks", () => {
    const { players } = currentSquad();
    const gains = cardGains(players, rows, { bank: bankOf(), benchWeight: state.benchWeight });
    const triple = gains.find((g) => g.key === "triple")!;
    const quad = gains.find((g) => g.key === "quad")!;

    expect(quad.gain).toBeCloseTo(2 * triple.gain, 6);
  });
});
