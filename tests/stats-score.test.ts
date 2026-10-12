import { describe, expect, it } from "vitest";
import type { PlayerStats } from "../lib/stats/player";
import { scorePlayers } from "../lib/stats/score";

const mk = (o: Partial<PlayerStats>): PlayerStats => ({
  tag: "#?", name: "", townHallLevel: 15, wars: 5,
  attacksUsed: 0, attacksAvailable: 0, attackUsage: 1,
  stars: 0, expectedStars: 0, starsVsExpected: 0,
  mirrorAttacks: 0, mirror3Stars: 0, mirror3StarRate: 0,
  cleanupStars: 0, avgDestruction: 0,
  defenses: 0, defenseStarsAllowed: 0, avgDefenseStars: 0,
  ...o,
});

describe("scorePlayers", () => {
  const ace = mk({ name: "ace", mirror3StarRate: 1, starsVsExpected: 2, avgDestruction: 100, attackUsage: 1 });
  const good = mk({ name: "good", mirror3StarRate: 0.5, starsVsExpected: 1, avgDestruction: 80, attackUsage: 1 });
  const mid = mk({ name: "mid", mirror3StarRate: 0.5, starsVsExpected: 0, avgDestruction: 60, attackUsage: 1 });
  // identical metrics to ace but only shows up half the time
  const flaky = mk({ name: "flaky", mirror3StarRate: 1, starsVsExpected: 2, avgDestruction: 100, attackUsage: 0.5 });
  const out = scorePlayers([mid, flaky, ace, good]);
  const by = (n: string) => out.find((p) => p.name === n)!;

  it("sorts by score descending and tops with the ace", () => {
    expect(out.map((p) => p.name)[0]).toBe("ace");
    expect(out.map((p) => p.score)).toEqual([...out.map((p) => p.score)].sort((a, b) => b - a));
  });

  it("applies usage as a reliability multiplier (not a filter)", () => {
    // flaky has identical raw metrics to ace -> same base, half the usage
    expect(by("flaky").score).toBeCloseTo(by("ace").score / 2, 1);
  });

  it("assigns A/B/C tiers by rank percentile", () => {
    expect(by("ace").tier).toBe("A");
    expect(out.map((p) => p.tier)).toContain("C");
  });

  it("treats never-defended players as neutral, not elite", () => {
    // all have defenses:0; defense term must be the same 0.5 for everyone,
    // so ordering is driven purely by offense here.
    expect(by("mid").tier).not.toBe("A");
  });
});
