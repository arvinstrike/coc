import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isWarFinal, normalizeWar, parseCocTime, type NormWar, type RawWar } from "../lib/normalize/war";

// Small hand-built war controlling positions/orders to pin down the derived
// fields. US = our clan, OPP = enemy.
function makeWar(): RawWar {
  return {
    state: "inWar",
    teamSize: 3,
    attacksPerMember: 2,
    preparationStartTime: "20251010T000000.000Z",
    startTime: "20251010T120000.000Z",
    endTime: "20251011T120000.000Z",
    clan: {
      tag: "#US",
      name: "Us",
      members: [
        {
          tag: "#A", name: "A", townhallLevel: 15, mapPosition: 1,
          attacks: [
            { attackerTag: "#A", defenderTag: "#D1", stars: 3, destructionPercentage: 100, order: 2, duration: 90 },
            { attackerTag: "#A", defenderTag: "#D2", stars: 1, destructionPercentage: 50, order: 5, duration: 60 },
          ],
          bestOpponentAttack: { attackerTag: "#E1", defenderTag: "#A", stars: 1, destructionPercentage: 40, order: 1, duration: 30 },
        },
        {
          tag: "#B", name: "B", townhallLevel: 14, mapPosition: 2,
          // cleanup on D1 (A hit it first at order 2)
          attacks: [
            { attackerTag: "#B", defenderTag: "#D1", stars: 2, destructionPercentage: 80, order: 6, duration: 70 },
          ],
        },
        { tag: "#C", name: "C", townhallLevel: 13, mapPosition: 3 }, // never attacked
      ],
    },
    opponent: {
      tag: "#OPP",
      name: "Opp",
      members: [
        { tag: "#D1", name: "D1", townhallLevel: 15, mapPosition: 1 },
        { tag: "#D2", name: "D2", townhallLevel: 16, mapPosition: 2 },
        { tag: "#E1", name: "E1", townhallLevel: 15, mapPosition: 3 },
      ],
    },
  };
}

describe("normalizeWar", () => {
  it("derives mirror / firstHit / cleanup / defenderTh correctly", () => {
    const w = normalizeWar(makeWar(), "#US");
    const a = w.members.find((m) => m.tag === "#A")!;
    const b = w.members.find((m) => m.tag === "#B")!;

    const aD1 = a.attacks[0];
    expect(aD1.isMirror).toBe(true); // A pos1 vs D1 pos1
    expect(aD1.firstHit).toBe(true); // order 2 < B's order 6
    expect(aD1.isCleanup).toBe(false);
    expect(aD1.defenderTh).toBe(15);
    expect(aD1.attackerTh).toBe(15);

    const aD2 = a.attacks[1];
    expect(aD2.isMirror).toBe(false); // A pos1 vs D2 pos2
    expect(aD2.firstHit).toBe(true); // only attack on D2
    expect(aD2.defenderTh).toBe(16);

    const bD1 = b.attacks[0];
    expect(bD1.firstHit).toBe(false);
    expect(bD1.isCleanup).toBe(true); // D1 already hit by A
    expect(bD1.isMirror).toBe(false); // B pos2 vs D1 pos1
  });

  it("keeps a member who never attacked (empty attacks, not dropped)", () => {
    const w = normalizeWar(makeWar(), "#US");
    const c = w.members.find((m) => m.tag === "#C")!;
    expect(c.attacks).toEqual([]);
    expect(c.defense).toBeNull();
  });

  it("maps defense from bestOpponentAttack with attacker TH", () => {
    const w = normalizeWar(makeWar(), "#US");
    const a = w.members.find((m) => m.tag === "#A")!;
    expect(a.defense).toEqual({ attackerTag: "#E1", attackerTh: 15, stars: 1, destructionPercentage: 40 });
  });

  it("detects our side when we are the opponent (CWL)", () => {
    const w = normalizeWar(makeWar(), "#OPP", "cwl");
    expect(w.ourClanTag).toBe("#OPP");
    expect(w.opponentClanTag).toBe("#US");
    expect(w.type).toBe("cwl");
    expect(w.members.map((m) => m.tag).sort()).toEqual(["#D1", "#D2", "#E1"]);
  });

  it("passes through tie result and builds warId from prep time", () => {
    const raw = { ...makeWar(), result: "tie", state: "warEnded" };
    const w = normalizeWar(raw, "#US");
    expect(w.result).toBe("tie");
    expect(w.warId).toBe("#US_20251010T000000.000Z");
  });

  it("tolerates an attack on an unknown base (defenderTh null, not mirror)", () => {
    const raw = makeWar();
    raw.clan.members[0].attacks![0].defenderTag = "#GHOST";
    const w = normalizeWar(raw, "#US");
    const a = w.members.find((m) => m.tag === "#A")!;
    expect(a.attacks[0].defenderTh).toBeNull();
    expect(a.attacks[0].isMirror).toBe(false);
  });

  it("parses CoC timestamps to epoch ms", () => {
    expect(parseCocTime("20261009T163003.000Z")).toBe(Date.UTC(2026, 9, 9, 16, 30, 3));
    expect(parseCocTime("garbage")).toBeNaN();
  });

  it("treats a war as final when ended, or inWar past its endTime", () => {
    const base: NormWar = {
      warId: "w", type: "regular", state: "inWar", result: null, teamSize: 1,
      attacksPerMember: 2, preparationStartTime: "p", startTime: "s",
      endTime: "20261009T120000.000Z", ourClanTag: "#US", opponentClanTag: "#OPP", members: [],
    };
    const end = Date.UTC(2026, 9, 9, 12, 0, 0);
    expect(isWarFinal({ ...base, state: "warEnded" }, end - 1)).toBe(true);
    expect(isWarFinal(base, end + 1000)).toBe(true); // inWar but endTime passed
    expect(isWarFinal(base, end - 1000)).toBe(false); // war still running
    expect(isWarFinal({ ...base, state: "preparation" }, end + 1000)).toBe(false);
  });

  it("normalizes the real inWar fixture without throwing", () => {
    const raw = JSON.parse(
      readFileSync(join(__dirname, "..", "fixtures", "currentwar_inWar.json"), "utf8"),
    ) as RawWar;
    const w = normalizeWar(raw, raw.clan.tag);
    const totalAttacks = w.members.reduce((n, m) => n + m.attacks.length, 0);
    expect(w.members.length).toBe(raw.clan.members.length);
    expect(totalAttacks).toBeGreaterThan(0);
    // every attack that resolved a defender got a numeric TH
    for (const m of w.members)
      for (const at of m.attacks)
        if (at.defenderTh !== null) expect(typeof at.defenderTh).toBe("number");
  });
});
