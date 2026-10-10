// CWL war normalization (F2). A CWL war is shaped like a regular currentwar but
// is fetched per warTag (GET /clanwarleagues/wars/{warTag}) and our clan may be
// on either the `clan` or `opponent` side — normalizeWar already handles that.
import { normalizeWar, type NormWar, type RawWar } from "./war";

// Each round exposes 4 warTags (8 clans); our clan is in exactly one of them.
export function isOurWar(raw: RawWar, ourClanTag: string): boolean {
  return raw.clan.tag === ourClanTag || raw.opponent.tag === ourClanTag;
}

export function normalizeCwlWar(
  raw: RawWar,
  ourClanTag: string,
  warTag: string,
  season: string,
  round: number,
): NormWar {
  const norm = normalizeWar(raw, ourClanTag, "cwl");
  // warTag is the stable, unique id for a CWL war (prep time isn't unique across
  // the 4 parallel wars in a round). CWL is always 1 attack per member.
  return { ...norm, warId: warTag, season, round, attacksPerMember: 1 };
}
