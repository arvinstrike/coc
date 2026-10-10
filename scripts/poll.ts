// Poll each configured clan and persist normalized wars. Regular war when the
// clan is in one; during CWL season currentwar is notInWar, so fall back to the
// CWL league group and pull our war for each revealed round (F2).
// Run on a schedule (GitHub Actions).
import { CocHttpError, getCurrentWar, getCwlWar, getLeagueGroup } from "../lib/coc/client";
import { isOurWar, normalizeCwlWar } from "../lib/normalize/cwl";
import { isWarFinal, normalizeWar, type RawWar } from "../lib/normalize/war";
import { loadWars, saveWar, writeJson } from "../lib/store";

const clanTags = (process.env.COC_CLAN_TAGS ?? "#2RV22C9L9")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean)
  .map((t) => (t.startsWith("#") ? t : `#${t}`));

if (clanTags.length === 0) {
  console.error("COC_CLAN_TAGS is empty (quote the value — a bare '#' is a comment in .env)");
  process.exit(1);
}

async function pollCwl(clanTag: string): Promise<{ season: string; saved: number }> {
  const group = await getLeagueGroup(clanTag); // throws CocHttpError 404 when not in CWL
  const season = group.season;
  writeJson(`cwl/${season}.json`, group); // perishable group snapshot (clans, rounds)

  // skip rounds already captured in a final state — cuts API calls over the week
  const finalRounds = new Set(
    loadWars()
      .filter((w) => w.type === "cwl" && w.season === season && isWarFinal(w))
      .map((w) => w.round),
  );

  let saved = 0;
  for (let i = 0; i < group.rounds.length; i++) {
    const round = i + 1;
    if (finalRounds.has(round)) continue;
    for (const warTag of group.rounds[i].warTags) {
      if (warTag === "#0") continue; // round not revealed yet
      const raw = await getCwlWar(warTag);
      if (!isOurWar(raw, clanTag)) continue;
      saveWar(normalizeCwlWar(raw, clanTag, warTag, season, round));
      saved++;
      break; // our clan is in exactly one war per round
    }
  }
  return { season, saved };
}

let failed = 0;
for (const tag of clanTags) {
  try {
    const war = await getCurrentWar(tag);
    if (war.state !== "notInWar") {
      const norm = normalizeWar(war as RawWar, tag);
      console.log(`${tag}: ${norm.state} -> ${saveWar(norm)}`);
      continue;
    }
    // notInWar: might be CWL season
    try {
      const { season, saved } = await pollCwl(tag);
      console.log(`${tag}: CWL ${season} — ${saved} war(s) saved`);
    } catch (e) {
      if (e instanceof CocHttpError && e.status === 404) {
        console.log(`${tag}: notInWar`); // not in CWL either
      } else throw e;
    }
  } catch (e) {
    failed++;
    console.error(`${tag}: FAILED ${e instanceof CocHttpError ? e.message : String(e)}`);
  }
}

if (failed === clanTags.length) process.exit(1); // all clans failed -> surface to CI
