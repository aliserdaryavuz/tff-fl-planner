/**
 * Görsel dışa aktarımında kullanılan küçük dosyaların (armalar, site logosu)
 * veri URL'si önbelleği. html-to-image, görselleri yakalama sırasında kendisi
 * indirmeye çalışır; Safari'de bu ilk denemede sık sık boş kalır ve
 * next/image'ın srcset'li çıktısı da yanlış boyut seçebilir. Dosyaları önceden
 * indirip veri URL'si olarak gömünce görselde ne eksik ne yanlış arma kalır.
 */
const cache = new Map<string, string>();

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Verilen adresleri (aynı kaynaktan) indirip önbelleğe alır; olanları atlar. */
export async function preloadAssets(urls: string[]): Promise<void> {
  await Promise.all(
    urls
      .filter((url) => !cache.has(url))
      .map(async (url) => {
        try {
          const res = await fetch(url, { cache: "force-cache" });
          if (!res.ok) return;
          cache.set(url, await toDataUrl(await res.blob()));
        } catch {
          // İndirilemeyen dosya normal adresiyle kalır; yakalama yine dener.
        }
      }),
  );
}

export function cachedAsset(url: string): string {
  return cache.get(url) ?? url;
}
