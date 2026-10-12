// Pure: PlayerStats[] -> win-oriented CWL tier score. "Who performs best in
// THIS clan", so every comparison metric is min-maxed over the roster. Usage is
// NOT in the weighted base — it multiplies the base afterward, so an unreliable
// attacker self-demotes without being hard-filtered (the chosen policy: score
// only, no auto-eliminate).
import type { PlayerStats } from "./player";

export type Tier = "A" | "B" | "C";

export interface ScoredPlayer extends PlayerStats {
  score: number; // 0..100
  tier: Tier;
}

const W = { mir3: 0.4, exp: 0.35, des: 0.15, def: 0.1 }; // sums to 1
const A_CUT = 0.35; // top 35% -> A, next 40% -> B, rest -> C
const B_CUT = 0.75;

// min-max to 0..1; neutral 0.5 when the roster is uniform (range 0).
function normalizer(values: number[]): (x: number) => number {
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  return (x) => (range === 0 ? 0.5 : (x - min) / range);
}

export function scorePlayers(players: PlayerStats[]): ScoredPlayer[] {
  if (players.length === 0) return [];

  const nMir3 = normalizer(players.map((p) => p.mirror3StarRate));
  const nExp = normalizer(players.map((p) => p.starsVsExpected));
  const nDes = normalizer(players.map((p) => p.avgDestruction));
  // Defense: fewer stars allowed is better, so invert. Players who never
  // defended have avgDefenseStars 0 and would look elite — treat them as
  // neutral (0.5) and build the scale from real defenders only.
  const defenders = players.filter((p) => p.defenses).map((p) => p.avgDefenseStars);
  const nDefRaw = normalizer(defenders.length ? defenders : [0]);
  const nDef = (p: PlayerStats) => (p.defenses ? 1 - nDefRaw(p.avgDefenseStars) : 0.5);

  const scored: ScoredPlayer[] = players.map((p) => {
    const base =
      W.mir3 * nMir3(p.mirror3StarRate) +
      W.exp * nExp(p.starsVsExpected) +
      W.des * nDes(p.avgDestruction) +
      W.def * nDef(p);
    return { ...p, score: Math.round(base * p.attackUsage * 1000) / 10, tier: "C" };
  });

  scored.sort((a, b) => b.score - a.score);
  const n = scored.length;
  scored.forEach((p, i) => {
    const q = i / n;
    p.tier = q < A_CUT ? "A" : q < B_CUT ? "B" : "C";
  });
  return scored;
}
