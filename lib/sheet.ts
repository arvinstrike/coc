// Pure: turn the leaderboard into sheet blocks (one per war type). The Apps
// Script side stays dumb — it just writes [headers, ...rows] to a tab, so all
// formatting/rounding lives here and is unit-testable.
import type { ScoredPlayer } from "./stats/score";

export interface SheetBlock {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface Leaderboard {
  generatedAt?: string;
  warsCounted?: number;
  regular: ScoredPlayer[];
  cwl: ScoredPlayer[];
}

const pct = (x: number) => Math.round(x * 100);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

const HEADERS = [
  "#", "Name", "Tier", "Score", "TH", "Wars", "Usage%", "Stars", "Exp", "+/-Exp",
  "Mir3%", "Cleanup", "Des%", "DefAvg",
];

export function playersToSheet(name: string, players: ScoredPlayer[]): SheetBlock {
  const rows = players.map((p, i) => [
    i + 1, p.name, p.tier, p.score, p.townHallLevel, p.wars,
    pct(p.attackUsage), r1(p.stars), r1(p.expectedStars), r2(p.starsVsExpected),
    pct(p.mirror3StarRate), r1(p.cleanupStars), r1(p.avgDestruction), r1(p.avgDefenseStars),
  ]);
  return { name, headers: HEADERS, rows };
}

// CWL is 1 attack/round, so the stakes are participation (no-show kills you) and
// bonus-medal allocation — hence its own columns instead of the regular block.
const CWL_HEADERS = [
  "#", "Name", "Tier", "Score", "TH", "Rounds", "Used", "Miss", "Stars",
  "Triple%", "+/-Exp", "NetStars", "Def★", "Bonus",
];

export function cwlToSheet(name: string, players: ScoredPlayer[]): SheetBlock {
  // Bonus medals go to the biggest raw contributors: total stars, then destruction.
  // Within one CWL season (~7 days) recency weighting is ~flat, so p.stars is fine.
  const bonusOrder = [...players].sort(
    (a, b) => b.stars - a.stars || b.avgDestruction - a.avgDestruction,
  );
  const bonusRank = new Map(bonusOrder.map((p, i) => [p.tag, i + 1]));
  const rows = players.map((p, i) => [
    i + 1, p.name, p.tier, p.score, p.townHallLevel, p.wars,
    r1(p.attacksUsed), p.missedAttacks, r1(p.stars), pct(p.tripleRate),
    r2(p.starsVsExpected), r1(p.stars - p.defenseStarsAllowed), r1(p.avgDefenseStars),
    bonusRank.get(p.tag) ?? 0,
  ]);
  return { name, headers: CWL_HEADERS, rows };
}

export function leaderboardToSheets(lb: Leaderboard): SheetBlock[] {
  return [playersToSheet("Regular", lb.regular), cwlToSheet("CWL", lb.cwl)];
}
