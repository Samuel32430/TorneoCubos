import { describe, expect, it } from "vitest";
import {
  buildLeaderboard,
  calculateAo5,
  effectiveCentiseconds,
  formatCentiseconds,
  formatSolveSlot,
  normalizeSolves,
  parseTimeInput,
} from "@/lib/wca";
import { emptySolves, type Competitor, type RoundResultRow, type SolveSlot } from "@/types/tournament";

function solve(rawCs: number | null, penalty: SolveSlot["penalty"] = "NONE"): SolveSlot {
  return { rawCs, penalty };
}

function makeCompetitor(id: string, bib: number, fullName: string): Competitor {
  return {
    id,
    tournament_id: "t-1",
    bib_number: bib,
    full_name: fullName,
    wca_id: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function makeResult(competitorId: string, solves: SolveSlot[]): RoundResultRow {
  const summary = calculateAo5(solves);
  return {
    id: `res-${competitorId}`,
    round_id: "r-1",
    competitor_id: competitorId,
    solves,
    best_cs: summary.bestCs,
    average_cs: summary.averageCs,
    completed_count: summary.completedCount,
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("normalizeSolves and effectiveCentiseconds", () => {
  it("normalizes missing or shorter arrays to 5 SolveSlots", () => {
    expect(normalizeSolves(null)).toHaveLength(5);
    expect(normalizeSolves([solve(1000)])).toEqual([
      solve(1000),
      solve(null),
      solve(null),
      solve(null),
      solve(null),
    ]);
  });

  it("computes effective centiseconds for NONE, +2, DNF, DNS, and empty", () => {
    expect(effectiveCentiseconds(solve(null))).toBeNull();
    expect(effectiveCentiseconds(solve(1000, "NONE"))).toBe(1000);
    expect(effectiveCentiseconds(solve(1000, "+2"))).toBe(1200);
    expect(effectiveCentiseconds(solve(1000, "DNF"))).toBe(-1);
    expect(effectiveCentiseconds(solve(null, "DNS"))).toBe(-1);
  });
});

describe("parseTimeInput", () => {
  it("parses empty strings, dnf, and dns", () => {
    expect(parseTimeInput("")).toEqual({ rawCs: null, penalty: "NONE" });
    expect(parseTimeInput("   ")).toEqual({ rawCs: null, penalty: "NONE" });
    expect(parseTimeInput("dnf")).toEqual({ rawCs: null, penalty: "DNF" });
    expect(parseTimeInput("DNF")).toEqual({ rawCs: null, penalty: "DNF" });
    expect(parseTimeInput("dns")).toEqual({ rawCs: null, penalty: "DNS" });
    expect(parseTimeInput("  Dns ")).toEqual({ rawCs: null, penalty: "DNS" });
  });

  it("parses WCA digit strings, decimal strings, minute strings, and +2 suffix", () => {
    expect(parseTimeInput("1245")).toEqual({ rawCs: 1245, penalty: "NONE" });
    expect(parseTimeInput("845")).toEqual({ rawCs: 845, penalty: "NONE" });
    expect(parseTimeInput("10532")).toEqual({ rawCs: 6532, penalty: "NONE" });
    expect(parseTimeInput("12.45")).toEqual({ rawCs: 1245, penalty: "NONE" });
    expect(parseTimeInput("12,45")).toEqual({ rawCs: 1245, penalty: "NONE" });
    expect(parseTimeInput("12.4")).toEqual({ rawCs: 1240, penalty: "NONE" });
    expect(parseTimeInput("12.")).toEqual({ rawCs: 1200, penalty: "NONE" });
    expect(parseTimeInput("1:05.32")).toEqual({ rawCs: 6532, penalty: "NONE" });
    expect(parseTimeInput("12.45+")).toEqual({ rawCs: 1245, penalty: "+2" });
    expect(parseTimeInput("1245+")).toEqual({ rawCs: 1245, penalty: "+2" });
    expect(parseTimeInput("1:05.32+")).toEqual({ rawCs: 6532, penalty: "+2" });
  });

  it("rejects invalid formats, zero times, and seconds >= 60 in mmsscc or m:ss", () => {
    expect(parseTimeInput("16532")).toBeNull();
    expect(parseTimeInput("1:65.32")).toBeNull();
    expect(parseTimeInput("0")).toBeNull();
    expect(parseTimeInput("0.00")).toBeNull();
    expect(parseTimeInput("abc")).toBeNull();
    expect(parseTimeInput("+")).toBeNull();
    expect(parseTimeInput("dnf+")).toBeNull();
    expect(parseTimeInput("12.345")).toBeNull();
    expect(parseTimeInput("-5.00")).toBeNull();
  });
});

describe("formatCentiseconds and formatSolveSlot", () => {
  it("formats centiseconds, minutes, penalties, and dropped slots", () => {
    expect(formatCentiseconds(null)).toBe("-");
    expect(formatCentiseconds(-1)).toBe("DNF");
    expect(formatCentiseconds(null, "DNS")).toBe("DNS");
    expect(formatCentiseconds(845)).toBe("8.45");
    expect(formatCentiseconds(6508)).toBe("1:05.08");
    expect(formatCentiseconds(1245, "+2")).toBe("12.45+");
    expect(formatSolveSlot(solve(1000, "+2"), true)).toBe("(12.00+)");
    expect(formatSolveSlot(solve(null, "DNF"), true)).toBe("(DNF)");
    expect(formatSolveSlot(solve(null, "DNS"), true)).toBe("(DNS)");
    expect(formatSolveSlot(solve(null, "NONE"), true)).toBe("-");
  });
});

describe("calculateAo5", () => {
  it("calculates normal Ao5 with rounding", () => {
    const down = calculateAo5([
      solve(984),
      solve(1012),
      solve(945),
      solve(1103),
      solve(1020),
    ]);
    expect(down).toEqual({
      bestCs: 945,
      averageCs: 1005,
      completedCount: 5,
      droppedMinIndex: 2,
      droppedMaxIndex: 3,
      bpaCs: null,
      wpaCs: null,
    });

    const up = calculateAo5([
      solve(1000),
      solve(1001),
      solve(1001),
      solve(1000),
      solve(1200),
    ]);
    expect(up.averageCs).toBe(1001);
  });

  it("handles +2 penalty changing which solve is dropped as worst", () => {
    const summary = calculateAo5([
      solve(1000),
      solve(1200),
      solve(1100),
      solve(1050, "+2"),
      solve(1150),
    ]);
    expect(summary).toEqual({
      bestCs: 1000,
      averageCs: 1150,
      completedCount: 5,
      droppedMinIndex: 0,
      droppedMaxIndex: 3,
      bpaCs: null,
      wpaCs: null,
    });
  });

  it("discards 1 DNF and returns valid Ao5", () => {
    const summary = calculateAo5([
      solve(1000),
      solve(null, "DNF"),
      solve(1100),
      solve(1200),
      solve(1300),
    ]);
    expect(summary).toEqual({
      bestCs: 1000,
      averageCs: 1200,
      completedCount: 5,
      droppedMinIndex: 0,
      droppedMaxIndex: 1,
      bpaCs: null,
      wpaCs: null,
    });
  });

  it("returns DNF Ao5 when 2 or more solves are DNF", () => {
    const summary = calculateAo5([
      solve(1000),
      solve(null, "DNF"),
      solve(1100),
      solve(null, "DNF"),
      solve(1200),
    ]);
    expect(summary).toEqual({
      bestCs: 1000,
      averageCs: -1,
      completedCount: 5,
      droppedMinIndex: 0,
      droppedMaxIndex: 3,
      bpaCs: null,
      wpaCs: null,
    });
  });

  it("handles DNS identically to DNF for Ao5 and bestCs", () => {
    const oneDns = calculateAo5([
      solve(1000),
      solve(null, "DNS"),
      solve(1100),
      solve(1200),
      solve(1300),
    ]);
    expect(oneDns.bestCs).toBe(1000);
    expect(oneDns.averageCs).toBe(1200);
    expect(oneDns.droppedMaxIndex).toBe(1);

    const dnsAndDnf = calculateAo5([
      solve(1000),
      solve(null, "DNS"),
      solve(1100),
      solve(null, "DNF"),
      solve(1200),
    ]);
    expect(dnsAndDnf.averageCs).toBe(-1);

    const allDns = calculateAo5([
      solve(null, "DNS"),
      solve(null, "DNS"),
      solve(null, "DNS"),
      solve(null, "DNS"),
      solve(null, "DNS"),
    ]);
    expect(allDns.bestCs).toBe(-1);
    expect(allDns.averageCs).toBe(-1);
  });

  it("calculates BPA and WPA with 4 attempts (0, 1, and 2 DNFs)", () => {
    const zeroDnf = calculateAo5([
      solve(1000),
      solve(1100),
      solve(1200),
      solve(1300),
      solve(null),
    ]);
    expect(zeroDnf).toEqual({
      bestCs: 1000,
      averageCs: null,
      completedCount: 4,
      droppedMinIndex: null,
      droppedMaxIndex: null,
      bpaCs: 1100,
      wpaCs: 1200,
    });

    const oneDnf = calculateAo5([
      solve(1000),
      solve(null, "DNF"),
      solve(1200),
      solve(1100),
      solve(null),
    ]);
    expect(oneDnf).toEqual({
      bestCs: 1000,
      averageCs: null,
      completedCount: 4,
      droppedMinIndex: null,
      droppedMaxIndex: null,
      bpaCs: 1100,
      wpaCs: -1,
    });

    const twoDnf = calculateAo5([
      solve(1000),
      solve(null, "DNF"),
      solve(null, "DNF"),
      solve(1100),
      solve(null),
    ]);
    expect(twoDnf).toEqual({
      bestCs: 1000,
      averageCs: null,
      completedCount: 4,
      droppedMinIndex: null,
      droppedMaxIndex: null,
      bpaCs: -1,
      wpaCs: -1,
    });
  });
});

describe("buildLeaderboard", () => {
  it("sorts and ranks by WCA Ao5, bestCs tie-breakers, DNF Ao5, in-progress, and unstarted", () => {
    const c1 = makeCompetitor("c1", 10, "Ana");
    const c2 = makeCompetitor("c2", 2, "Bruno");
    const c3 = makeCompetitor("c3", 3, "Carla");
    const c4 = makeCompetitor("c4", 4, "Diego");
    const c5 = makeCompetitor("c5", 5, "Elena");
    const c6 = makeCompetitor("c6", 6, "Fabi");
    const c7 = makeCompetitor("c7", 7, "Gael");
    const c8 = makeCompetitor("c8", 8, "Hugo");
    const c9 = makeCompetitor("c9", 1, "Ivan");

    const results: RoundResultRow[] = [
      // c1 and c2 tie exactly on avg=1000, best=950 -> both rank 1
      makeResult("c1", [solve(950), solve(1000), solve(1000), solve(1000), solve(1100)]),
      makeResult("c2", [solve(950), solve(1000), solve(1000), solve(1000), solve(1150)]),
      // c3 has same avg=1000, worse best=970 -> rank 3
      makeResult("c3", [solve(970), solve(1000), solve(1000), solve(1000), solve(1100)]),
      // c4 DNF Ao5 with valid best=920 -> rank 4
      makeResult("c4", [solve(920), solve(null, "DNF"), solve(null, "DNF"), solve(1050), solve(1080)]),
      // c5 DNF Ao5 with all DNF (best=-1) -> rank 5
      makeResult("c5", [
        solve(null, "DNF"),
        solve(null, "DNF"),
        solve(null, "DNS"),
        solve(null, "DNF"),
        solve(null, "DNF"),
      ]),
      // c6 in progress (4 solves, best=1050) -> rank 6 (includes BPA/WPA)
      makeResult("c6", [solve(1050), solve(1100), solve(1150), solve(1200), solve(null)]),
      // c7 in progress (2 solves, best=890) -> rank 7 (after c6 due to fewer solves)
      makeResult("c7", [solve(890), solve(930), solve(null), solve(null), solve(null)]),
      // c8 result row with 0 solves -> rank null
      makeResult("c8", emptySolves()),
    ];

    const leaderboard = buildLeaderboard([c8, c5, c1, c9, c7, c4, c3, c2, c6], results);

    expect(leaderboard.map((row) => [row.competitor.id, row.rank])).toEqual([
      ["c2", 1], // bib 2 before bib 10 on exact tie
      ["c1", 1],
      ["c3", 3],
      ["c4", 4],
      ["c5", 5],
      ["c6", 6],
      ["c7", 7],
      ["c9", null], // bib 1 before bib 8 among 0 solves
      ["c8", null],
    ]);

    const c6Row = leaderboard.find((row) => row.competitor.id === "c6");
    expect(c6Row?.bpaCs).toBe(1100);
    expect(c6Row?.wpaCs).toBe(1150);

    const c1Row = leaderboard.find((row) => row.competitor.id === "c1");
    expect(c1Row?.droppedMinIndex).toBe(0);
    expect(c1Row?.droppedMaxIndex).toBe(4);
  });
});
