"use client";

import Link from "next/link";
import { useExporting } from "@/components/ExportContext";
import { usePlanner } from "@/components/PlannerContext";
import { byId, teamSlug } from "@/lib/data";
// `Player` yalnız tip: `import type` derlemede siliniyor, yani çalışma zamanı
// bağı kalmıyor. Adres parçası da veri çekmeyen modülden.
import type { Player } from "@/lib/fantasy";
import { playerSlug } from "@/lib/player-key";
import { encodeState } from "@/lib/url-state";

/**
 * Oyuncu ve kulüp adlarını kendi sayfalarına bağlar.
 *
 * Tek yerden geçiyor ki bağlantı hep aynı görünsün ve adres çubuğundaki
 * ayarlar (hafta, model, ağırlıklar) her zaman taşınsın — sekme değiştirince
 * durumun korunması gibi, sayfa değiştirince de korunmalı.
 *
 * Görsel dışa aktarma çerçevesinde düz metne düşüyor: kaydedilen resimde
 * bağlantı diye bir şey yok, altı çizili görünmesi de istenmez.
 */
function useHref(path: string): string {
  const { state } = usePlanner();
  return `${path}?${encodeState(state)}`;
}

// py-1: satır içi bağlantının dikey dolgusu satır yüksekliğini değiştirmiyor
// ama tıklama alanını büyütüyor. Yoğun tablo ve listede 44 px satır yüksekliği
// istenmedi; alan bu yolla genişliyor.
const LINK_CLASS =
  "rounded-[2px] py-1 transition-colors hover:text-accent hover:underline underline-offset-2";

export function PlayerLink({
  player,
  className = "",
  children,
}: {
  player: Player;
  className?: string;
  children?: React.ReactNode;
}) {
  const exporting = useExporting();
  const href = useHref(`/players/${playerSlug(player)}`);
  const body = children ?? player.name;
  if (exporting) return <span className={className}>{body}</span>;
  return (
    <Link href={href} className={`${LINK_CLASS} ${className}`}>
      {body}
    </Link>
  );
}

export function TeamLink({
  team,
  className = "",
  children,
}: {
  team: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const exporting = useExporting();
  const href = useHref(`/teams/${teamSlug(team)}`);
  const body = children ?? byId[team]?.name ?? team;
  if (exporting) return <span className={className}>{body}</span>;
  return (
    <Link href={href} className={`${LINK_CLASS} ${className}`}>
      {body}
    </Link>
  );
}
