// Recompute the leaderboard from all stored wars. Pure recompute every run, so
// it is safe to run any time and always consistent with the war files on disk.
import { isWarFinal, type NormWar } from "../lib/normalize/war";
import { loadWars } from "../lib/store";
import { aggregatePlayers, recencyWeights } from "../lib/stats/player";
import { scorePlayers } from "../lib/stats/score";
import { writeJson } from "../lib/store";

const wars = loadWars().filter((w) => isWarFinal(w));
// ponytail: no exclude-list yet (friendly/test wars). Add data/excludes.json +
// a filter here when the first friendly war needs dropping (F8).

// Recency per war type, so a stale regular war doesn't dilute CWL weights.
const rank = (ws: NormWar[]) => {
  const weights = recencyWeights(ws);
  return scorePlayers([...aggregatePlayers(ws, (w) => weights.get(w.warId) ?? 1).values()]);
};

const regular = rank(wars.filter((w) => w.type === "regular"));
const cwl = rank(wars.filter((w) => w.type === "cwl"));

const path = writeJson("leaderboard.json", {
  generatedAt: new Date().toISOString(),
  warsCounted: wars.length,
  regular,
  cwl,
});

console.log(`ranked ${regular.length} (regular) + ${cwl.length} (cwl) from ${wars.length} wars -> ${path}`);
