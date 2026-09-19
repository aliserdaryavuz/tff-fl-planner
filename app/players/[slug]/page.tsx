import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerPage } from "@/components/PlayerPage";
import { byId } from "@/lib/data";
import { players, playersBySlug } from "@/lib/fantasy";
import { playerSlug } from "@/lib/player-key";

// 528 oyuncunun hepsi derleme anında statik: çalışma anında iş yapılmıyor ve
// her oyuncu arama motorlarında ayrı bir sayfa oluyor.
export function generateStaticParams() {
  return players.map((p) => ({ slug: playerSlug(p) }));
}

export async function generateMetadata({
  params,
}: PageProps<"/players/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const player = playersBySlug[slug];
  if (!player) return {};
  const team = byId[player.team]?.name ?? player.team;
  return {
    title: `${player.name} (${team}) — TFF FL Planner 2026/27`,
    description: `${player.name}, ${team}: TFF Fantezi Lig fiyatı ve seçilme oranı, başlama olasılığı, son maçlar ve hafta hafta beklenen puan dökümü.`,
  };
}

export default async function Page({ params }: PageProps<"/players/[slug]">) {
  const { slug } = await params;
  const player = playersBySlug[slug];
  if (!player) notFound();
  return <PlayerPage player={player} />;
}
