// Thin wrapper over the CoC API via the RoyaleAPI CoC proxy.
// Reads COC_API_TOKEN / COC_BASE_URL from env. No caching, no retries — the
// poller runs on a schedule, so a failed poll just waits for the next tick.
import type { RawWar } from "../normalize/war";

const DEFAULT_BASE = "https://cocproxy.royaleapi.dev/v1";

export class CocHttpError extends Error {
  constructor(readonly status: number, readonly path: string, readonly body: string) {
    super(`CoC ${status} on ${path}: ${body.slice(0, 200)}`);
    this.name = "CocHttpError";
  }
}

const enc = (tag: string) => encodeURIComponent(tag); // "#2RV..." -> "%232RV..."

async function cocGet<T>(path: string): Promise<T> {
  const token = process.env.COC_API_TOKEN;
  if (!token) throw new Error("COC_API_TOKEN is not set");
  const base = process.env.COC_BASE_URL ?? DEFAULT_BASE;
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new CocHttpError(res.status, path, await res.text().catch(() => ""));
  return (await res.json()) as T;
}

// currentwar returns {state:"notInWar"} (200) between wars and during CWL.
export type CurrentWar = RawWar | { state: "notInWar" };

export const getCurrentWar = (clanTag: string) =>
  cocGet<CurrentWar>(`/clans/${enc(clanTag)}/currentwar`);

export interface LeagueGroup {
  state: string;
  season: string;
  rounds: { warTags: string[] }[];
  clans: { tag: string; name: string }[];
}
export const getLeagueGroup = (clanTag: string) =>
  cocGet<LeagueGroup>(`/clans/${enc(clanTag)}/currentwar/leaguegroup`);

export const getCwlWar = (warTag: string) =>
  cocGet<RawWar>(`/clanwarleagues/wars/${enc(warTag)}`);
