export type SolvePenalty = "NONE" | "+2" | "DNF" | "DNS";

export interface SolveSlot {
  rawCs: number | null;
  penalty: SolvePenalty;
}

export type TournamentStatus = "draft" | "active" | "finished";
export type RoundStatus = "upcoming" | "active" | "finished";

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  event_date: string;
  status: TournamentStatus;
  created_at: string;
}

export interface Round {
  id: string;
  tournament_id: string;
  event_code: string;
  event_name: string;
  round_number: number;
  name: string;
  status: RoundStatus;
  sort_order: number;
  created_at: string;
}

export interface Competitor {
  id: string;
  tournament_id: string;
  bib_number: number;
  full_name: string;
  wca_id: string | null;
  created_at: string;
}

export interface RoundResultRow {
  id: string;
  round_id: string;
  competitor_id: string;
  solves: SolveSlot[];
  best_cs: number | null;
  average_cs: number | null;
  completed_count: number;
  updated_at: string;
}

export interface Ao5Summary {
  bestCs: number | null;
  averageCs: number | null;
  completedCount: number;
  droppedMinIndex: number | null;
  droppedMaxIndex: number | null;
  bpaCs: number | null;
  wpaCs: number | null;
}

export interface LeaderboardRow {
  competitor: Competitor;
  result: RoundResultRow | null;
  rank: number | null;
  droppedMinIndex: number | null;
  droppedMaxIndex: number | null;
  bpaCs: number | null;
  wpaCs: number | null;
}

export const WCA_EVENTS = [
  { code: "333", name: "3x3x3 Cube" },
  { code: "222", name: "2x2x2 Cube" },
  { code: "444", name: "4x4x4 Cube" },
  { code: "555", name: "5x5x5 Cube" },
  { code: "333oh", name: "3x3x3 One-Handed" },
  { code: "pyram", name: "Pyraminx" },
  { code: "skewb", name: "Skewb" },
  { code: "clock", name: "Clock" },
  { code: "sq1", name: "Square-1" },
  { code: "minx", name: "Megaminx" },
] as const;

export function emptySolves(): SolveSlot[] {
  return Array.from({ length: 5 }, () => ({ rawCs: null, penalty: "NONE" as const }));
}
