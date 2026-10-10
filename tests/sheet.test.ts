import { describe, expect, it } from "vitest";
import { leaderboardToSheets } from "../lib/sheet";
import type { PlayerStats } from "../lib/stats/player";

const p: PlayerStats = {
  tag: "#X", name: "X", townHallLevel: 15, wars: 3,
  attacksUsed: 5, attacksAvailable: 6, attackUsage: 5 / 6,
  stars: 12, expectedStars: 10.37, starsVsExpected: 1.634,
  mirrorAttacks: 4, mirror3Stars: 3, mirror3StarRate: 0.75,
  cleanupStars: 2, avgDestruction: 88.33, defenses: 2, defenseStarsAllowed: 3, avgDefenseStars: 1.5,
};

describe("leaderboardToSheets", () => {
  const [regular, cwl] = leaderboardToSheets({ regular: [p], cwl: [] });

  it("makes a Regular and a CWL block", () => {
    expect(regular.name).toBe("Regular");
    expect(cwl.name).toBe("CWL");
    expect(cwl.rows).toEqual([]);
  });

  it("rounds and ranks the row for display", () => {
    expect(regular.headers[0]).toBe("#");
    const [rank, name, th, wars, usage, stars, exp, vsExp, mir3] = regular.rows[0]!;
    expect(rank).toBe(1);
    expect(name).toBe("X");
    expect(th).toBe(15);
    expect(wars).toBe(3);
    expect(usage).toBe(83); // round(5/6*100)
    expect(stars).toBe(12);
    expect(exp).toBe(10.4); // 1 dp
    expect(vsExp).toBe(1.63); // 2 dp
    expect(mir3).toBe(75); // round(0.75*100)
  });
});
