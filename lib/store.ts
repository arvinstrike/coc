// File-based storage. One JSON per war under data/wars/, overwritten each poll
// (war id is stable, so progressing preparation->inWar->warEnded just updates
// the same file). The report recomputes from all files every run, so there is
// no incremental state to keep consistent — idempotent by construction.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { NormWar } from "./normalize/war";

const dataDir = () => process.env.DATA_DIR ?? "data";
const warsDir = () => join(dataDir(), "wars");

// "#2RV22C9L9_20251010T..." -> "2RV22C9L9_20251010T..." (drop the '#')
const fileFor = (warId: string) => `${warId.replace(/#/g, "")}.json`;

export function saveWar(war: NormWar): string {
  const dir = warsDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, fileFor(war.warId));
  writeFileSync(path, JSON.stringify(war, null, 2));
  return path;
}

export function loadWars(): NormWar[] {
  const dir = warsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as NormWar);
}

export function writeJson(name: string, data: unknown): string {
  const path = join(dataDir(), name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}
