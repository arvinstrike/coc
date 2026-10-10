// POST the leaderboard to the Google Apps Script web app (see apps-script/Code.gs).
// No-ops if SHEETS_WEBHOOK_URL is unset so `sync` works before the sheet is wired.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leaderboardToSheets, type Leaderboard } from "../lib/sheet";

const url = process.env.SHEETS_WEBHOOK_URL;
if (!url) {
  console.log("export: SHEETS_WEBHOOK_URL not set — skipping");
  process.exit(0);
}

const dataDir = process.env.DATA_DIR ?? "data";
const lb = JSON.parse(readFileSync(join(dataDir, "leaderboard.json"), "utf8")) as Leaderboard;
const sheets = leaderboardToSheets(lb);

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ secret: process.env.SHEETS_SECRET ?? "", sheets }),
});
const text = await res.text();
if (!res.ok || text.includes("forbidden")) {
  console.error(`export failed (${res.status}): ${text.slice(0, 120)}`);
  process.exit(1);
}
console.log(`export ok: ${sheets.map((s) => `${s.name}(${s.rows.length})`).join(", ")}`);
