"use client";

import Image from "next/image";
import { useExporting } from "@/components/ExportContext";
import { cachedAsset } from "@/lib/asset-cache";
import { byId } from "@/lib/data";

export function logoUrl(id: string): string {
  return `/logos/${id}.png`;
}

/**
 * Kulüp arması. Dosyalar public/logos/<takım id>.png (scripts/fetch-logos.mjs
 * ile UEFA'dan). Yanında ad her zaman yazılı olduğu için alt boş: ekran
 * okuyucu adı bir kez duysun. Dışa aktarma çerçevesinde next/image yerine
 * önceden indirilmiş veri URL'si kullanılır (bkz. lib/asset-cache.ts).
 */
export function TeamLogo({
  id,
  size = 20,
  className = "",
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const exporting = useExporting();
  const cls = `inline-block shrink-0 select-none ${className}`;
  const style = { width: size, height: size };

  if (exporting) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- veri URL'si, gömülü
      <img
        src={cachedAsset(logoUrl(id))}
        alt=""
        width={size}
        height={size}
        className={cls}
        style={style}
      />
    );
  }

  return (
    <Image
      src={logoUrl(id)}
      alt=""
      title={byId[id]?.name}
      width={size}
      height={size}
      className={cls}
      style={style}
    />
  );
}
