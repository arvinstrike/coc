import { describe, expect, it } from "vitest";
import { expectedStars } from "../lib/stats/expected";
import { aggregatePlayers, recencyWeights } from "../lib/stats/player";
import { normalizeWar, type NormWar, type RawWar } from "../lib/normalize/war";

describe("expectedStars", () => {
  it("is higher when hitting down, lower when hitting up, and clamps", () => {
    expect(expectedStars(0)).toBe(2.3);
    expect(expectedStars(-1)).toBe(1.4);
    expect(expectedStars(5)).toBe(expectedStars(2)); // clamp high
    expect(expectedStars(-9)).toBe(expectedStars(-3)); // clamp low
    expect(expectedStars(2)).toBeGreaterThan(expectedStars(-2));
  });
});

// W1: X (TH15 pos1) 3★ mirror on D1 + 2★ on D2(TH16); Y (TH14 pos2) cleans D1.
// W2: X is in the war but never attacks.
function war1(): RawWar {
  return {
    state: "warEnded", result: "win", teamSize: 2, attacksPerMember: 2,
    preparationStartTime: "P1", startTime: "s", endTime: "e",
    clan: {
      tag: "#US", name: "Us",
      members: [
        {
          tag: "#X", name: "X", townhallLevel: 15, mapPosition: 1,
          attacks: [
            { attackerTag: "#X", defenderTag: "#D1", stars: 3, destructionPercentage: 100, order: 1, duration: 90 },
            { attackerTag: "#X", defenderTag: "#D2", stars: 2, destructionPercentage: 60, order: 2, duration: 90 },
          ],
          bestOpponentAttack: { attackerTag: "#D1", defenderTag: "#X", stars: 2, destructionPercentage: 70, order: 4, duration: 90 },
        },
        {
          tag: "#Y", name: "Y", townhallLevel: 14, mapPosition: 2,
          attacks: [
            { attackerTag: "#Y", defenderTag: "#D1", stars: 1, destructionPercentage: 30, order: 3, duration: 90 },
          ],
        },
      ],
    },
    opponent: {
      tag: "#OPP", name: "Opp",
      members: [
        { tag: "#D1", name: "D1", townhallLevel: 15, mapPosition: 1 },
        { tag: "#D2", name: "D2", townhallLevel: 16, mapPosition: 2 },
      ],
    },
  };
}

function war2(): RawWar {
  return {
    state: "warEnded", result: "lose", teamSize: 2, attacksPerMember: 2,
    preparationStartTime: "P2", startTime: "s", endTime: "e",
    clan: {
      tag: "#US", name: "Us",
      members: [{ tag: "#X", name: "X", townhallLevel: 15, mapPosition: 1 }], // no attacks
    },
    opponent: { tag: "#OPP2", name: "Opp2", members: [{ tag: "#Z", name: "Z", townhallLevel: 15, mapPosition: 1 }] },
  };
}

describe("aggregatePlayers", () => {
  const wars = [war1(), war2()].map((w) => normalizeWar(w, "#US"));
  const stats = aggregatePlayers(wars);

  it("accumulates availability even when a member never attacks", () => {
    const x = stats.get("#X")!;
    expect(x.wars).toBe(2);
    expect(x.attacksAvailable).toBe(4); // 2 per war, both wars
    expect(x.attacksUsed).toBe(2); // only attacked in W1
    expect(x.attackUsage).toBe(0.5);
  });

  it("computes stars vs expected using the TH-delta table", () => {
    const x = stats.get("#X")!;
    // exp(15-15)=2.3 + exp(15-16)=1.4 => 3.7 expected, 5 actual
    expect(x.stars).toBe(5);
    expect(x.expectedStars).toBeCloseTo(3.7, 5);
    expect(x.starsVsExpected).toBeCloseTo(1.3, 5);
  });

  it("computes mirror 3-star rate and avg destruction over used attacks", () => {
    const x = stats.get("#X")!;
    expect(x.mirrorAttacks).toBe(1); // only D1 is a mirror (pos1 vs pos1)
    expect(x.mirror3Stars).toBe(1);
    expect(x.mirror3StarRate).toBe(1);
    expect(x.avgDestruction).toBe(80); // (100+60)/2
  });

  it("counts cleanup stars and defenses", () => {
    const y = stats.get("#Y")!;
    expect(y.cleanupStars).toBe(1); // Y's hit on D1 was not the first hit
    const x = stats.get("#X")!;
    expect(x.defenses).toBe(1);
    expect(x.avgDefenseStars).toBe(2);
    expect(y.defenses).toBe(0);
    expect(y.avgDefenseStars).toBe(0);
  });
});

// Minimal NormWar stubs: recencyWeights only reads startTime + warId.
const stubWar = (id: string, start: string): NormWar =>
  ({ warId: id, startTime: start, members: [], type: "regular" }) as unknown as NormWar;

describe("recencyWeights", () => {
  it("is empty for no wars and averages to 1", () => {
    expect(recencyWeights([]).size).toBe(0);
    // ~30 days apart with a 30-day half-life: older war ~0.5x the newer one
    const ws = [stubWar("old", "20260801T000000.000Z"), stubWar("new", "20260831T000000.000Z")];
    const w = recencyWeights(ws, 30);
    const mean = [...w.values()].reduce((a, b) => a + b, 0) / w.size;
    expect(mean).toBeCloseTo(1, 6); // normalized to mean 1
    expect(w.get("new")!).toBeGreaterThan(w.get("old")!); // recent counts more
    expect(w.get("old")! / w.get("new")!).toBeCloseTo(0.5, 2); // one half-life
  });

  it("leaves aggregation unchanged when every weight is 1 (default)", () => {
    const wars = [war1(), war2()].map((w) => normalizeWar(w, "#US"));
    const def = aggregatePlayers(wars).get("#X")!;
    const unit = aggregatePlayers(wars, () => 1).get("#X")!;
    expect(unit.stars).toBe(def.stars);
    expect(unit.starsVsExpected).toBeCloseTo(def.starsVsExpected, 9);
  });
});
