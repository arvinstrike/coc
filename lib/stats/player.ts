// Pure aggregation: NormWar[] -> per-player performance metrics (F3).
// No Firestore. Pass wars of a SINGLE type (regular XOR cwl) — the caller keeps
// them separate because 1 attack/round changes what the ratios mean.
import { parseCocTime, type NormWar } from "../normalize/war";
import { expectedStars } from "./expected";

export interface PlayerStats {
  tag: string;
  name: string;
  townHallLevel: number;
  wars: number;
  attacksUsed: number;
  attacksAvailable: number;
  attackUsage: number; // 0..1
  stars: number;
  expectedStars: number;
  starsVsExpected: number; // the fair-performance number: + is above expectation
  mirrorAttacks: number;
  mirror3Stars: number;
  mirror3StarRate: number; // 0..1, 0 when no mirror attacks
  cleanupStars: number; // see ponytail note below
  avgDestruction: number; // 0..100, 0 when no attacks used
  defenses: number;
  defenseStarsAllowed: number;
  avgDefenseStars: number; // 0 when never defended
}

function blank(tag: string): PlayerStats {
  return {
    tag, name: "", townHallLevel: 0, wars: 0,
    attacksUsed: 0, attacksAvailable: 0, attackUsage: 0,
    stars: 0, expectedStars: 0, starsVsExpected: 0,
    mirrorAttacks: 0, mirror3Stars: 0, mirror3StarRate: 0,
    cleanupStars: 0, avgDestruction: 0,
    defenses: 0, defenseStarsAllowed: 0, avgDefenseStars: 0,
  };
}

const HALF_LIFE_DAYS = 30; // a war this many days older than the newest counts half
const DAY_MS = 86_400_000;

// Recency weights per warId, exponential decay by calendar age vs the newest
// war, normalized so the mean weight is 1 (magnitudes stay natural, the tilt is
// purely relative). Decay by days, not war index, so a cluster of CWL rounds in
// one week isn't treated as 7 separate "old" wars.
export function recencyWeights(wars: NormWar[], halfLifeDays = HALF_LIFE_DAYS): Map<string, number> {
  if (wars.length === 0) return new Map();
  const newest = Math.max(...wars.map((w) => parseCocTime(w.startTime)));
  const raw = wars.map((w) => {
    const ageDays = (newest - parseCocTime(w.startTime)) / DAY_MS;
    return { id: w.warId, w: 0.5 ** (ageDays / halfLifeDays) };
  });
  const mean = raw.reduce((s, r) => s + r.w, 0) / raw.length;
  return new Map(raw.map((r) => [r.id, r.w / mean]));
}

export function aggregatePlayers(
  wars: NormWar[],
  weightFor: (war: NormWar) => number = () => 1,
): Map<string, PlayerStats> {
  const out = new Map<string, PlayerStats>();
  const destrSum = new Map<string, number>(); // running destruction sum, averaged at the end

  for (const war of wars) {
    const w = weightFor(war); // recency weight; 1 = unweighted
    for (const m of war.members) {
      const s = out.get(m.tag) ?? blank(m.tag);
      s.name = m.name; // last seen
      s.townHallLevel = Math.max(s.townHallLevel, m.townhallLevel);
      s.wars += 1; // true count, never weighted (display honesty)
      s.attacksAvailable += war.attacksPerMember * w; // counted even if they never attacked
      s.attacksUsed += m.attacks.length * w;

      for (const a of m.attacks) {
        s.stars += a.stars * w;
        if (a.defenderTh !== null) s.expectedStars += expectedStars(a.attackerTh - a.defenderTh) * w;
        destrSum.set(m.tag, (destrSum.get(m.tag) ?? 0) + a.destructionPercentage * w);
        if (a.isMirror) {
          s.mirrorAttacks += w;
          if (a.stars === 3) s.mirror3Stars += w;
        }
        // ponytail: counts full stars of a cleanup hit, not the marginal gain
        // over the base's prior best. Upgrade to per-base marginal (track max
        // stars per defenderTag by order) if roster decisions lean on this.
        if (a.isCleanup) s.cleanupStars += a.stars * w;
      }

      if (m.defense) {
        s.defenses += w;
        s.defenseStarsAllowed += m.defense.stars * w;
      }
      out.set(m.tag, s);
    }
  }

  for (const s of out.values()) {
    s.attackUsage = s.attacksAvailable ? s.attacksUsed / s.attacksAvailable : 0;
    s.starsVsExpected = s.stars - s.expectedStars;
    s.mirror3StarRate = s.mirrorAttacks ? s.mirror3Stars / s.mirrorAttacks : 0;
    s.avgDestruction = s.attacksUsed ? (destrSum.get(s.tag) ?? 0) / s.attacksUsed : 0;
    s.avgDefenseStars = s.defenses ? s.defenseStarsAllowed / s.defenses : 0;
  }
  return out;
}
