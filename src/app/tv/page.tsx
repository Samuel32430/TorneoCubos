import type { Metadata } from "next";
import { LiveScoreboard } from "@/components/LiveScoreboard";
import { fetchTournamentSnapshot } from "@/lib/tournament-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modo TV — Torneo Cubo",
  description: "Vista de pantalla completa para resultados en vivo del torneo.",
};

interface TvPageProps {
  searchParams: Promise<{ round?: string }>;
}

export default async function TvPage({ searchParams }: TvPageProps) {
  const { round } = await searchParams;
  const snapshot = await fetchTournamentSnapshot(round);

  return (
    <LiveScoreboard
      key={snapshot.activeRound?.id ?? "no-round"}
      snapshot={snapshot}
      tvMode={true}
    />
  );
}
