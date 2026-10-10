import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Smoke test: confirms vitest runs and that the real API fixtures match the
// shape M1's normalizer will rely on. If the CoC API changes these fields,
// this fails before the normalizer does.
const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "..", "fixtures", `${name}.json`), "utf8"));

describe("currentwar fixture", () => {
  const war = fixture("currentwar");

  it("has war-level fields the war doc id and finalization depend on", () => {
    expect(war.state).toBe("preparation");
    expect(typeof war.preparationStartTime).toBe("string"); // part of wars/{tag}_{prepStart}
    expect(war.teamSize).toBe(35);
    expect(war.clan.tag).toBe("#2RV22C9L9");
  });

  it("has per-member fields keyed to player tag", () => {
    const m = war.clan.members[0];
    expect(m.tag).toMatch(/^#/);
    expect(typeof m.townhallLevel).toBe("number");
    expect(typeof m.mapPosition).toBe("number");
  });
});
