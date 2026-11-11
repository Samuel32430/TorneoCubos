import {
  emptySolves,
  type Ao5Summary,
  type Competitor,
  type LeaderboardRow,
  type RoundResultRow,
  type SolvePenalty,
  type SolveSlot,
} from "@/types/tournament";

function compareEffective(a: number, b: number): number {
  if (a === b) return 0;
  if (a === -1) return 1;
  if (b === -1) return -1;
  return a - b;
}

function compareBestCs(a: number | null, b: number | null): number {
  const aValid = a !== null && a > 0;
  const bValid = b !== null && b > 0;
  if (aValid && bValid) return a - b;
  if (aValid) return -1;
  if (bValid) return 1;
  const aDnf = a === -1;
  const bDnf = b === -1;
  if (aDnf && !bDnf) return -1;
  if (!aDnf && bDnf) return 1;
  return 0;
}

export function normalizeSolves(solves?: SolveSlot[] | null): SolveSlot[] {
  const base = emptySolves();
  if (!Array.isArray(solves)) {
    return base;
  }

  return base.map((fallback, index) => {
    const slot = solves[index];
    if (!slot || typeof slot !== "object") {
      return fallback;
    }

    const penalty: SolvePenalty =
      slot.penalty === "+2" || slot.penalty === "DNF" || slot.penalty === "DNS"
        ? slot.penalty
        : "NONE";
    const rawCs =
      typeof slot.rawCs === "number" && Number.isFinite(slot.rawCs) && slot.rawCs > 0
        ? Math.round(slot.rawCs)
        : null;

    if (penalty === "DNF" || penalty === "DNS") {
      return { rawCs, penalty };
    }
    if (rawCs === null) {
      return { rawCs: null, penalty: "NONE" };
    }
    return { rawCs, penalty };
  });
}

export function effectiveCentiseconds(slot: SolveSlot): number | null {
  if (slot.penalty === "DNF" || slot.penalty === "DNS") {
    return -1;
  }
  if (slot.rawCs === null || !Number.isFinite(slot.rawCs) || slot.rawCs <= 0) {
    return null;
  }
  return slot.penalty === "+2" ? slot.rawCs + 200 : slot.rawCs;
}

export function parseTimeInput(
  input: string
): { rawCs: number | null; penalty: SolvePenalty } | null {
  const trimmed = input.trim().replace(",", ".");
  if (trimmed === "") {
    return { rawCs: null, penalty: "NONE" };
  }

  const upper = trimmed.toUpperCase();
  if (upper === "DNF") {
    return { rawCs: null, penalty: "DNF" };
  }
  if (upper === "DNS") {
    return { rawCs: null, penalty: "DNS" };
  }

  const hasPlus = trimmed.endsWith("+");
  const penalty: SolvePenalty = hasPlus ? "+2" : "NONE";
  const body = hasPlus ? trimmed.slice(0, -1).trim() : trimmed;
  if (body === "") {
    return null;
  }

  if (body.includes(":")) {
    const parts = body.split(":");
    if (parts.length !== 2) {
      return null;
    }
    const [minStr, secPart] = parts;
    if (!/^\d+$/.test(minStr)) {
      return null;
    }
    const secMatch = secPart.match(/^(\d{1,2})(?:\.(\d{0,2}))?$/);
    if (!secMatch) {
      return null;
    }
    const mins = Number(minStr);
    const secs = Number(secMatch[1]);
    if (secs >= 60) {
      return null;
    }
    const cs = Number((secMatch[2] ?? "").padEnd(2, "0"));
    const rawCs = mins * 6000 + secs * 100 + cs;
    return rawCs > 0 ? { rawCs, penalty } : null;
  }

  if (body.includes(".")) {
    const dotMatch = body.match(/^(\d*)\.(\d{0,2})$/);
    if (!dotMatch || (dotMatch[1] === "" && dotMatch[2] === "")) {
      return null;
    }
    const secs = dotMatch[1] === "" ? 0 : Number(dotMatch[1]);
    const cs = Number(dotMatch[2].padEnd(2, "0"));
    const rawCs = secs * 100 + cs;
    return rawCs > 0 ? { rawCs, penalty } : null;
  }

  if (!/^\d+$/.test(body)) {
    return null;
  }
  const cs = Number(body.slice(-2));
  const secs = body.length > 2 ? Number(body.slice(-4, -2)) : 0;
  const mins = body.length > 4 ? Number(body.slice(0, -4)) : 0;
  if (secs >= 60) {
    return null;
  }
  const rawCs = mins * 6000 + secs * 100 + cs;
  return rawCs > 0 ? { rawCs, penalty } : null;
}

export function formatCentiseconds(
  cs: number | null,
  penalty: SolvePenalty = "NONE"
): string {
  if (penalty === "DNS") {
    return "DNS";
  }
  if (penalty === "DNF" || cs === -1) {
    return "DNF";
  }
  if (cs === null) {
    return "-";
  }
  if (cs < 0) {
    return "DNF";
  }

  const totalCs = Math.round(cs);
  const suffix = penalty === "+2" ? "+" : "";
  if (totalCs < 6000) {
    return `${(totalCs / 100).toFixed(2)}${suffix}`;
  }

  const mins = Math.floor(totalCs / 6000);
  const remCs = totalCs % 6000;
  const wholeSecs = Math.floor(remCs / 100);
  const centis = remCs % 100;
  const remSecFormatted = `${String(wholeSecs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
  return `${mins}:${remSecFormatted}${suffix}`;
}

export function formatSolveSlot(slot: SolveSlot, isDropped = false): string {
  const eff = effectiveCentiseconds(slot);
  const formatted = formatCentiseconds(eff, slot.penalty);
  if (isDropped && eff !== null) {
    return `(${formatted})`;
  }
  return formatted;
}

export function calculateAo5(solves: SolveSlot[]): Ao5Summary {
  const normalized = normalizeSolves(solves);
  const completed: Array<{ index: number; eff: number }> = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const eff = effectiveCentiseconds(normalized[index]);
    if (eff !== null) {
      completed.push({ index, eff });
    }
  }

  const completedCount = completed.length;
  if (completedCount === 0) {
    return {
      bestCs: null,
      averageCs: null,
      completedCount: 0,
      droppedMinIndex: null,
      droppedMaxIndex: null,
      bpaCs: null,
      wpaCs: null,
    };
  }

  const validTimes = completed.filter((item) => item.eff > 0).map((item) => item.eff);
  const bestCs = validTimes.length > 0 ? Math.min(...validTimes) : -1;

  const sorted = [...completed].sort(
    (a, b) => compareEffective(a.eff, b.eff) || a.index - b.index
  );
  const dnfCount = completed.filter((item) => item.eff === -1).length;

  if (completedCount === 5) {
    const droppedMinIndex = sorted[0].index;
    const droppedMaxIndex = sorted[4].index;
    const averageCs =
      dnfCount >= 2
        ? -1
        : Math.round((sorted[1].eff + sorted[2].eff + sorted[3].eff) / 3);

    return {
      bestCs,
      averageCs,
      completedCount,
      droppedMinIndex,
      droppedMaxIndex,
      bpaCs: null,
      wpaCs: null,
    };
  }

  if (completedCount === 4) {
    const bpaCs =
      dnfCount >= 2
        ? -1
        : Math.round((sorted[0].eff + sorted[1].eff + sorted[2].eff) / 3);
    const wpaCs =
      dnfCount >= 1
        ? -1
        : Math.round((sorted[1].eff + sorted[2].eff + sorted[3].eff) / 3);

    return {
      bestCs,
      averageCs: null,
      completedCount,
      droppedMinIndex: null,
      droppedMaxIndex: null,
      bpaCs,
      wpaCs,
    };
  }

  return {
    bestCs,
    averageCs: null,
    completedCount,
    droppedMinIndex: null,
    droppedMaxIndex: null,
    bpaCs: null,
    wpaCs: null,
  };
}

interface LeaderboardEntry {
  row: LeaderboardRow;
  completedCount: number;
  bestCs: number | null;
  averageCs: number | null;
}

function getLeaderboardTier(entry: LeaderboardEntry): number {
  if (entry.completedCount === 5 && entry.averageCs !== null && entry.averageCs > 0) {
    return 0;
  }
  if (entry.completedCount === 5 && entry.averageCs === -1) {
    return 1;
  }
  if (entry.completedCount > 0) {
    return 2;
  }
  return 3;
}

export function buildLeaderboard(
  competitors: Competitor[],
  results: RoundResultRow[]
): LeaderboardRow[] {
  const resultByCompetitorId = new Map<string, RoundResultRow>();
  for (const result of results) {
    resultByCompetitorId.set(result.competitor_id, result);
  }

  const entries: LeaderboardEntry[] = competitors.map((competitor) => {
    const result = resultByCompetitorId.get(competitor.id) ?? null;
    const summary = result ? calculateAo5(result.solves) : null;

    return {
      row: {
        competitor,
        result,
        rank: null,
        droppedMinIndex: summary?.droppedMinIndex ?? null,
        droppedMaxIndex: summary?.droppedMaxIndex ?? null,
        bpaCs: summary?.bpaCs ?? null,
        wpaCs: summary?.wpaCs ?? null,
      },
      completedCount: summary?.completedCount ?? 0,
      bestCs: summary?.bestCs ?? null,
      averageCs: summary?.averageCs ?? null,
    };
  });

  entries.sort((a, b) => {
    const tierA = getLeaderboardTier(a);
    const tierB = getLeaderboardTier(b);
    if (tierA !== tierB) {
      return tierA - tierB;
    }

    if (tierA === 0) {
      const avgDiff = (a.averageCs as number) - (b.averageCs as number);
      if (avgDiff !== 0) return avgDiff;
      const bestDiff = compareBestCs(a.bestCs, b.bestCs);
      if (bestDiff !== 0) return bestDiff;
    } else if (tierA === 1) {
      const bestDiff = compareBestCs(a.bestCs, b.bestCs);
      if (bestDiff !== 0) return bestDiff;
    } else if (tierA === 2) {
      const countDiff = b.completedCount - a.completedCount;
      if (countDiff !== 0) return countDiff;
      const bestDiff = compareBestCs(a.bestCs, b.bestCs);
      if (bestDiff !== 0) return bestDiff;
    }

    return a.row.competitor.bib_number - b.row.competitor.bib_number;
  });

  return entries.map((entry, index) => {
    if (entry.completedCount === 0) {
      return entry.row;
    }

    if (index > 0) {
      const prev = entries[index - 1];
      const isCompleteTie =
        prev.completedCount === 5 &&
        entry.completedCount === 5 &&
        prev.averageCs === entry.averageCs &&
        prev.bestCs === entry.bestCs;

      if (isCompleteTie) {
        entry.row.rank = prev.row.rank;
        return entry.row;
      }
    }

    entry.row.rank = index + 1;
    return entry.row;
  });
}
