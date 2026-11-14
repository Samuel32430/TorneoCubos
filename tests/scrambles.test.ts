import { describe, expect, it } from "vitest";
import {
  generate333Scramble,
  generate222Scramble,
  generatePyraminxScramble,
  generate10Scrambles,
} from "../src/lib/scrambles";

describe("WCA Scrambles Generator", () => {
  it("generates valid 3x3x3 scrambles of specified length", () => {
    const scramble = generate333Scramble(21);
    const moves = scramble.split(" ");
    expect(moves).toHaveLength(21);

    // No consecutive moves on the same face
    for (let i = 1; i < moves.length; i++) {
      const prevFace = moves[i - 1][0];
      const curFace = moves[i][0];
      expect(curFace).not.toBe(prevFace);
    }
  });

  it("generates valid 2x2x2 scrambles using only R, U, F", () => {
    const scramble = generate222Scramble(10);
    const moves = scramble.split(" ");
    expect(moves).toHaveLength(10);

    for (const move of moves) {
      expect(["R", "U", "F"]).toContain(move[0]);
    }
  });

  it("generates valid Pyraminx scramble", () => {
    const scramble = generatePyraminxScramble();
    expect(scramble.length).toBeGreaterThan(10);
    const moves = scramble.split(" ");
    expect(moves.length).toBeGreaterThanOrEqual(11);
  });

  it("generates a complete set of 10 scrambles partitioned into Group A and Group B", () => {
    const scrambles = generate10Scrambles("333");
    expect(scrambles).toHaveLength(10);

    const groupA = scrambles.filter((s) => s.group === "A");
    const groupB = scrambles.filter((s) => s.group === "B");

    expect(groupA).toHaveLength(5);
    expect(groupB).toHaveLength(5);

    expect(groupA.map((s) => s.attempt)).toEqual([1, 2, 3, 4, 5]);
    expect(groupB.map((s) => s.attempt)).toEqual([1, 2, 3, 4, 5]);

    // Each scramble sequence should be non-empty string
    for (const item of scrambles) {
      expect(item.sequence.trim().length).toBeGreaterThan(15);
    }
  });
});
