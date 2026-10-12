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

export function leaderboardToSheets(lb: Leaderboard): SheetBlock[] {
  return [playersToSheet("Regular", lb.regular), playersToSheet("CWL", lb.cwl)];
}
