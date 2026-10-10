import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadWars, saveWar } from "../lib/store";
import type { NormWar } from "../lib/normalize/war";

const war = (warId: string, state: string): NormWar => ({
  warId, type: "regular", state, result: null, teamSize: 1, attacksPerMember: 2,
  preparationStartTime: "P", startTime: "s", endTime: "e",
  ourClanTag: "#US", opponentClanTag: "#OPP", members: [],
});

describe("store", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "coc-store-"));
    process.env.DATA_DIR = dir;
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("round-trips a war and strips '#' from the filename", () => {
    const p = saveWar(war("#US_P1", "warEnded"));
    expect(p).toContain("US_P1.json");
    expect(p).not.toContain("#");
    expect(loadWars().map((w) => w.warId)).toEqual(["#US_P1"]);
  });

  it("overwrites the same war id instead of duplicating (idempotent poll)", () => {
    saveWar(war("#US_P1", "preparation"));
    saveWar(war("#US_P1", "warEnded"));
    const wars = loadWars();
    expect(wars).toHaveLength(1);
    expect(wars[0].state).toBe("warEnded");
  });

  it("returns [] when no data dir exists yet", () => {
    process.env.DATA_DIR = join(dir, "nope");
    expect(loadWars()).toEqual([]);
  });
});
