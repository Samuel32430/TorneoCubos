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

  // Consulta optimizada única con joins anidados: reduce 3 viajes de red a solo 1
  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select(`
      *,
      rounds (
        *,
        round_results (*)
      ),
      competitors (*)
    `)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !tournaments || tournaments.length === 0) {
    return {
      configured: true,
      tournament: null,
      rounds: [],
      activeRound: null,
      competitors: [],
      results: [],
    };
  }

  const rawTournament = tournaments[0];
  const { rounds: rawRounds, competitors: rawCompetitors, ...tournamentFields } = rawTournament;

  const tournament: Tournament = tournamentFields as Tournament;

  const rounds: Round[] = (
    (rawRounds as Array<Round & { round_results?: RoundResultRow[] }> | null) ?? []
  )
    .map((r) => {
      const { round_results: _ignored, ...roundData } = r;
      return roundData as Round;
    })
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

  const competitors: Competitor[] = (
    (rawCompetitors as Competitor[] | null) ?? []
  ).sort((a, b) => a.bib_number - b.bib_number);

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

  const activeRoundWithResults = (
    rawRounds as Array<Round & { round_results?: RoundResultRow[] }> | null
  )?.find((r) => r.id === activeRound.id);

  const results: RoundResultRow[] = (activeRoundWithResults?.round_results ?? []) as RoundResultRow[];

  return {
    configured: true,
    tournament,
    rounds,
    activeRound,
    competitors,
    results,
  };
}
