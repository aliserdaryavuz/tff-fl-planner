import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, decodeState, encodeState, type PlannerState } from "@/lib/url-state";

const decode = (query: string, base?: PlannerState) => decodeState(new URLSearchParams(query), base);

describe("encodeState", () => {
  it("dil, dilim, takım, model, parametreler, hafta, ufuk, azalma, yedek ağırlığı", () => {
    const q = new URLSearchParams(encodeState(DEFAULT_STATE));
    expect(q.get("lang")).toBe("tr");
    expect(q.get("tz")).toBe("Europe/Istanbul");
    expect(q.get("t")).toBe("Galatasaray");
    expect(q.get("m")).toBe("abs");
    expect(q.get("ha")).toBe("6");
    expect(q.get("gamma")).toBe("1");
    expect(q.get("w")).toBe("opta:100,value:100,last:50,table:50");
    expect(q.get("gw")).toBe(String(DEFAULT_STATE.gw));
    expect(q.get("h")).toBe("1");
    expect(q.get("wd")).toBe("0.5");
    expect(q.get("bw")).toBe("0.1");
  });
});

describe("decodeState", () => {
  it("gidiş-dönüş", () => {
    const state: PlannerState = {
      lang: "en",
      tz: "Asia/Tokyo",
      team: "Besiktas",
      model: "rel",
      params: { ...DEFAULT_STATE.params, rel: { ha: 9.5, gamma: 1.35, weights: { opta: 30, table: 70 } } },
      gw: 12,
      horizon: 4,
      weekDecay: 0.65,
      benchWeight: 0.25,
      picks: { model: 100, sel: 40, points: 25 },
      minutesImpact: 0.6,
      selInvert: true,
    };
    expect(decode(encodeState(state))).toEqual(state);
  });

  it("boş query varsayılanı verir; tanınmayan takım ve model yok sayılır", () => {
    expect(decode("")).toEqual(DEFAULT_STATE);
    const s = decode("t=Antalyaspor&m=torba");
    expect(s.team).toBe(DEFAULT_STATE.team);
    expect(s.model).toBe(DEFAULT_STATE.model);
  });

  it("hafta, ufuk ve ağırlıklar aralığına kırpılır", () => {
    expect(decode("gw=99").gw).toBe(34);
    expect(decode("gw=0").gw).toBe(1);
    expect(decode("h=20").horizon).toBe(8);
    expect(decode("wd=7").weekDecay).toBe(1);
    expect(decode("bw=-1").benchWeight).toBe(0);
    expect(decode("gw=abc").gw).toBe(DEFAULT_STATE.gw);
  });

  it("ağırlıklar okunur, bilinmeyen kaynak ve aralık dışı değer elenir", () => {
    const w = decode("m=abs&w=opta:80,last:20,xg:50,value:900").params.abs.weights;
    expect(w).toEqual({ opta: 80, last: 20, value: 100 });
  });

  it("seçili model diğer modelin parametrelerini bozmaz", () => {
    const s = decode("m=rel&gamma=1.5");
    expect(s.params.rel.gamma).toBe(1.5);
    expect(s.params.abs).toEqual(DEFAULT_STATE.params.abs);
  });

  it("oyuncu ağırlıkları okunur; bilinmeyen ad ve aralık dışı değer elenir", () => {
    expect(decode("pw=model:100,points:40").picks).toEqual({
      model: 100,
      sel: 0,
      points: 40,
    });
    expect(decode("pw=model:900,bilinmeyen:50").picks.model).toBe(100);
    // Tanınır çift yoksa varsayılan korunur.
    expect(decode("pw=abc").picks).toEqual(DEFAULT_STATE.picks);
    expect(decode("si=1").selInvert).toBe(true);
    expect(decode("").selInvert).toBe(false);
  });
});
