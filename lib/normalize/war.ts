// Pure transform: raw CoC currentwar / CWL-war JSON -> internal war doc.
// No Firestore, no I/O. Enriches each attack with the derived fields the stats
// engine (F3) needs: attackerTh, defenderTh, isMirror, firstHit, isCleanup.
// Works for both regular war (we are always `clan`) and CWL (we may be `opponent`).

export type WarType = "regular" | "cwl";

export interface RawAttack {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order: number;
  duration: number;
}

export interface RawWarMember {
  tag: string;
  name: string;
  townhallLevel: number;
  mapPosition: number;
  attacks?: RawAttack[];
  bestOpponentAttack?: RawAttack;
}

export interface RawWarSide {
  tag: string;
  name: string;
  members: RawWarMember[];
}

export interface RawWar {
  state: string;
  result?: string | null;
  teamSize: number;
  attacksPerMember?: number;
  preparationStartTime: string;
  startTime: string;
  endTime: string;
  clan: RawWarSide;
  opponent: RawWarSide;
}

export interface NormAttack extends RawAttack {
  attackerTh: number;
  defenderTh: number | null; // null if the defender base isn't in the roster (shouldn't happen)
  isMirror: boolean; // attacker's map position == defender's map position
  firstHit: boolean; // lowest-order attack landed on this enemy base
  isCleanup: boolean; // any non-first hit on a base
}

export interface NormDefense {
  attackerTag: string;
  attackerTh: number | null;
  stars: number;
  destructionPercentage: number;
}

export interface NormMember {
  tag: string;
  name: string;
  townhallLevel: number;
  mapPosition: number;
  attacks: NormAttack[];
  defense: NormDefense | null; // best (worst-for-us) attack we took, or null if undefended
}

export interface NormWar {
  warId: string; // `${ourClanTag}_${preparationStartTime}` — caller overrides for CWL (uses warTag)
  type: WarType;
  state: string;
  result: string | null; // "win" | "lose" | "tie" | null (null until warEnded)
  teamSize: number;
  attacksPerMember: number;
  preparationStartTime: string;
  startTime: string;
  endTime: string;
  ourClanTag: string;
  opponentClanTag: string;
  members: NormMember[]; // our side only, enriched
  season?: string; // CWL only, e.g. "2026-11"
  round?: number; // CWL only, 1..7
}

// CoC timestamps look like "20261009T163003.000Z" (no separators). -> epoch ms.
export function parseCocTime(s: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(s);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN;
}

// A war counts for stats once it's over: either the API said warEnded, or our
// last snapshot is still "inWar" but its endTime has passed (we missed the
// warEnded poll before the next war replaced it). The latter may lack the very
// last attacks, but keeps the whole war instead of dropping it entirely.
export function isWarFinal(war: NormWar, now: number = Date.now()): boolean {
  if (war.state === "warEnded") return true;
  if (war.state === "inWar") return parseCocTime(war.endTime) <= now;
  return false;
}

export function normalizeWar(
  raw: RawWar,
  ourClanTag: string,
  type: WarType = "regular",
): NormWar {
  const weAreClan = raw.clan.tag === ourClanTag;
  const ourSide = weAreClan ? raw.clan : raw.opponent;
  const enemySide = weAreClan ? raw.opponent : raw.clan;

  const enemyByTag = new Map(enemySide.members.map((m) => [m.tag, m]));

  // first hit = lowest-order attack on each enemy base, across all our members
  const firstOrderByDefender = new Map<string, number>();
  for (const m of ourSide.members) {
    for (const a of m.attacks ?? []) {
      const cur = firstOrderByDefender.get(a.defenderTag);
      if (cur === undefined || a.order < cur) firstOrderByDefender.set(a.defenderTag, a.order);
    }
  }

  const members: NormMember[] = ourSide.members.map((m) => {
    const attacks: NormAttack[] = (m.attacks ?? []).map((a) => {
      const def = enemyByTag.get(a.defenderTag);
      const firstHit = firstOrderByDefender.get(a.defenderTag) === a.order;
      return {
        ...a,
        attackerTh: m.townhallLevel,
        defenderTh: def?.townhallLevel ?? null,
        isMirror: def ? def.mapPosition === m.mapPosition : false,
        firstHit,
        isCleanup: !firstHit,
      };
    });
    const bo = m.bestOpponentAttack;
    const defense: NormDefense | null = bo
      ? {
          attackerTag: bo.attackerTag,
          attackerTh: enemyByTag.get(bo.attackerTag)?.townhallLevel ?? null,
          stars: bo.stars,
          destructionPercentage: bo.destructionPercentage,
        }
      : null;
    return {
      tag: m.tag,
      name: m.name,
      townhallLevel: m.townhallLevel,
      mapPosition: m.mapPosition,
      attacks,
      defense,
    };
  });

  return {
    warId: `${ourClanTag}_${raw.preparationStartTime}`,
    type,
    state: raw.state,
    result: raw.result ?? null,
    teamSize: raw.teamSize,
    attacksPerMember: raw.attacksPerMember ?? 2,
    preparationStartTime: raw.preparationStartTime,
    startTime: raw.startTime,
    endTime: raw.endTime,
    ourClanTag: ourSide.tag,
    opponentClanTag: enemySide.tag,
    members,
  };
}
