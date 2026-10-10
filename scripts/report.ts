// Recompute the leaderboard from all stored wars. Pure recompute every run, so
// it is safe to run any time and always consistent with the war files on disk.
import { isWarFinal } from "../lib/normalize/war";
import { loadWars } from "../lib/store";
import { aggregatePlayers, type PlayerStats } from "../lib/stats/player";
import { writeJson } from "../lib/store";

const wars = loadWars().filter((w) => isWarFinal(w));
// ponytail: no exclude-list yet (friendly/test wars). Add data/excludes.json +
// a filter here when the first friendly war needs dropping (F8).

const rank = (map: Map<string, PlayerStats>) =>
  [...map.values()].sort((a, b) => b.starsVsExpected - a.starsVsExpected);

const regular = rank(aggregatePlayers(wars.filter((w) => w.type === "regular")));
const cwl = rank(aggregatePlayers(wars.filter((w) => w.type === "cwl")));

const path = writeJson("leaderboard.json", {
  generatedAt: new Date().toISOString(),
  warsCounted: wars.length,
  regular,
  cwl,
});

console.log(`ranked ${regular.length} (regular) + ${cwl.length} (cwl) from ${wars.length} wars -> ${path}`);
