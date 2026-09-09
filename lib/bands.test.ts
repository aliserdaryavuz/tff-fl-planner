import { describe, expect, it } from "vitest";
import { bandFloor, BANDS, bandOf } from "@/lib/bands";

describe("renk bantları", () => {
  it("sınır değerleri alt banda düşer (PROJECT.md §5)", () => {
    expect(bandOf(1).key).toBe("vEasy");
    expect(bandOf(1.8).key).toBe("vEasy");
    expect(bandOf(1.9).key).toBe("easy");
    expect(bandOf(2.6).key).toBe("easy");
    expect(bandOf(2.7).key).toBe("mid");
    expect(bandOf(3.4).key).toBe("mid");
    expect(bandOf(3.5).key).toBe("hard");
    expect(bandOf(4.2).key).toBe("hard");
    expect(bandOf(4.3).key).toBe("vHard");
    expect(bandOf(5).key).toBe("vHard");
  });

  it("kayan nokta artığı bandı kaydırmaz", () => {
    expect(bandOf(1.7999999999999998).key).toBe("vEasy");
    expect(bandOf(2.6000000000000005).key).toBe("easy");
  });

  it("lejant aralıkları bitişik", () => {
    expect(bandFloor(0)).toBe(1);
    BANDS.forEach((b, i) => {
      if (i > 0) expect(bandFloor(i)).toBe(BANDS[i - 1].upTo);
      expect(b.upTo).toBeGreaterThan(bandFloor(i));
    });
    expect(BANDS[BANDS.length - 1].upTo).toBe(5);
  });
});
