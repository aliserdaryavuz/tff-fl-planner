import { describe, expect, it } from "vitest";
import raw from "@/data/source-meta.json";
import { buildSourceMeta } from "../scripts/build-source-meta.mjs";

/**
 * `data/source-meta.json` türetilmiş bir dosya: veri dosyalarının meta
 * bloklarından üretiliyor. Kaynaklar güncellenip özet yenilenmezse dipnot
 * sessizce eski tarihleri gösterir — kullanıcıya "veri taze" diye yalan söyler.
 * Bu test o kapıyı tutuyor.
 */
describe("source-meta", () => {
  it("kaynak dosyalardan sapmamış", () => {
    expect(raw.sources).toEqual(buildSourceMeta().sources);
  });

  it("her grubun kaynağı ve tarihi var", () => {
    for (const [key, group] of Object.entries(raw.sources)) {
      const g = group as Record<string, unknown>;
      expect(typeof g.source, key).toBe("string");
      const day = (g.fetched ?? g.lastDay) as string | null;
      expect(day, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("özet küçük kalıyor", () => {
    // Amacı buydu: dipnot her rotada çiziliyor, ağır dosyalar pakete girmesin.
    expect(JSON.stringify(raw).length).toBeLessThan(4096);
  });
});
