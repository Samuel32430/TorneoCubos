import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Competitor,
  Round,
  RoundResultRow,
  Tournament,
} from "@/types/tournament";

export interface TournamentSnapshot {
  configured: boolean;
  tournament: Tournament | null;
  rounds: Round[];
  activeRound: Round | null;
  competitors: Competitor[];
  results: RoundResultRow[];
}

export async function fetchTournamentSnapshot(
  selectedRoundId?: string
): Promise<TournamentSnapshot> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return {
      configured: false,
      tournament: null,
      rounds: [],
      activeRound: null,
      competitors: [],
      results: [],
    };
  }

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  const tournament = (tournaments?.[0] as Tournament | undefined) ?? null;
  if (!tournament) {
    return {
      configured: true,
      tournament: null,
      rounds: [],
      activeRound: null,
      competitors: [],
      results: [],
    };
  }

  const [{ data: roundsData }, { data: competitorsData }] = await Promise.all([
    supabase
      .from("rounds")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("competitors")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("bib_number", { ascending: true }),
  ]);

  const rounds = (roundsData as Round[] | null) ?? [];
  const competitors = (competitorsData as Competitor[] | null) ?? [];

  const activeRound =
    rounds.find((r) => r.id === selectedRoundId) ??
    rounds.find((r) => r.status === "active") ??
    rounds[0] ??
    null;

  if (!activeRound) {
    return {
      configured: true,
      tournament,
      rounds,
      activeRound: null,
      competitors,
      results: [],
    };
  }

  const { data: resultsData } = await supabase
    .from("round_results")
    .select("*")
    .eq("round_id", activeRound.id);

  return {
    configured: true,
    tournament,
    rounds,
    activeRound,
    competitors,
    results: (resultsData as RoundResultRow[] | null) ?? [],
  };
}
