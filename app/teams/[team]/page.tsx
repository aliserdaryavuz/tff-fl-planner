import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamPage } from "@/components/TeamPage";
import { byId, bySlug, schedule, teamIds, teamSlug } from "@/lib/data";

// 18 kulübün hepsi derleme anında statik sayfa: arama motorları her kulübü
// ayrı görür, çalışma anında iş yapılmaz.
export function generateStaticParams() {
  return teamIds.map((id) => ({ team: teamSlug(id) }));
}

export async function generateMetadata({
  params,
}: PageProps<"/teams/[team]">): Promise<Metadata> {
  const { team: slug } = await params;
  const id = bySlug[slug];
  if (!id) return {};
  const name = byId[id].name;
  const opponents = (schedule[id] ?? [])
    .slice(0, 5)
    .map((fx) => byId[fx.opp]?.name ?? fx.opp)
    .join(", ");
  return {
    title: `${name} — TFF FL Planner 2026/27`,
    description: `${name} 2026/27 Trendyol Süper Lig'de: hafta hafta fikstür zorluğu, kadronun tamamı, fiyatlar, seçilme oranları ve başlama olasılıkları. Sıradaki rakipler: ${opponents}.`,
  };
}

export default async function Page({ params }: PageProps<"/teams/[team]">) {
  const { team: slug } = await params;
  const id = bySlug[slug];
  if (!id) notFound();
  return <TeamPage teamId={id} />;
}
