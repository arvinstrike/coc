// Pure aggregation: NormWar[] -> per-player performance metrics (F3).
// No Firestore. Pass wars of a SINGLE type (regular XOR cwl) — the caller keeps
// them separate because 1 attack/round changes what the ratios mean.
import type { NormWar } from "../normalize/war";
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

export function aggregatePlayers(wars: NormWar[]): Map<string, PlayerStats> {
  const out = new Map<string, PlayerStats>();
  const destrSum = new Map<string, number>(); // running destruction sum, averaged at the end

  for (const war of wars) {
    for (const m of war.members) {
      const s = out.get(m.tag) ?? blank(m.tag);
      s.name = m.name; // last seen
      s.townHallLevel = Math.max(s.townHallLevel, m.townhallLevel);
      s.wars += 1;
      s.attacksAvailable += war.attacksPerMember; // counted even if they never attacked
      s.attacksUsed += m.attacks.length;

      for (const a of m.attacks) {
        s.stars += a.stars;
        if (a.defenderTh !== null) s.expectedStars += expectedStars(a.attackerTh - a.defenderTh);
        destrSum.set(m.tag, (destrSum.get(m.tag) ?? 0) + a.destructionPercentage);
        if (a.isMirror) {
          s.mirrorAttacks += 1;
          if (a.stars === 3) s.mirror3Stars += 1;
        }
        // ponytail: counts full stars of a cleanup hit, not the marginal gain
        // over the base's prior best. Upgrade to per-base marginal (track max
        // stars per defenderTag by order) if roster decisions lean on this.
        if (a.isCleanup) s.cleanupStars += a.stars;
      }

      if (m.defense) {
        s.defenses += 1;
        s.defenseStarsAllowed += m.defense.stars;
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
