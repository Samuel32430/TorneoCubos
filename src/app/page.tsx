import { LiveScoreboard } from "@/components/LiveScoreboard";
import { fetchTournamentSnapshot } from "@/lib/tournament-data";

export const revalidate = 5;

interface HomePageProps {
  searchParams: Promise<{ round?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { round } = await searchParams;
  const snapshot = await fetchTournamentSnapshot(round);

  return (
    <LiveScoreboard
      key={snapshot.activeRound?.id ?? "no-round"}
      snapshot={snapshot}
      tvMode={false}
    />
  );
}
