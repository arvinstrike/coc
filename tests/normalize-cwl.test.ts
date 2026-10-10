import { describe, expect, it } from "vitest";
import { isOurWar, normalizeCwlWar } from "../lib/normalize/cwl";
import type { RawWar } from "../lib/normalize/war";

// A CWL war: 1 attack per member, our clan may be `clan` or `opponent`.
function cwlWar(): RawWar {
  return {
    state: "warEnded", result: "win", teamSize: 1, attacksPerMember: 1,
    preparationStartTime: "P", startTime: "s", endTime: "e",
    clan: {
      tag: "#US", name: "Us",
      members: [{
        tag: "#A", name: "A", townhallLevel: 15, mapPosition: 1,
        attacks: [{ attackerTag: "#A", defenderTag: "#D", stars: 3, destructionPercentage: 100, order: 1, duration: 90 }],
      }],
    },
    opponent: {
      tag: "#OPP", name: "Opp",
      members: [{ tag: "#D", name: "D", townhallLevel: 15, mapPosition: 1 }],
    },
  };
}

describe("isOurWar", () => {
  it("matches when our tag is on either side, not otherwise", () => {
    expect(isOurWar(cwlWar(), "#US")).toBe(true);
    expect(isOurWar(cwlWar(), "#OPP")).toBe(true);
    expect(isOurWar(cwlWar(), "#OTHER")).toBe(false);
  });
});

describe("normalizeCwlWar", () => {
  it("keys the war by warTag and stamps season/round, 1 attack/member", () => {
    const w = normalizeCwlWar(cwlWar(), "#US", "#WARTAG1", "2026-11", 3);
    expect(w.warId).toBe("#WARTAG1");
    expect(w.type).toBe("cwl");
    expect(w.season).toBe("2026-11");
    expect(w.round).toBe(3);
    expect(w.attacksPerMember).toBe(1);
    expect(w.ourClanTag).toBe("#US");
    expect(w.members[0].attacks[0].stars).toBe(3);
  });

  it("works when we are the opponent side", () => {
    const w = normalizeCwlWar(cwlWar(), "#OPP", "#WARTAG1", "2026-11", 1);
    expect(w.ourClanTag).toBe("#OPP");
    expect(w.opponentClanTag).toBe("#US");
    expect(w.members.map((m) => m.tag)).toEqual(["#D"]); // opponent side members
  });
});
