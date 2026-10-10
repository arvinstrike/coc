// Google Apps Script for the clan leaderboard Sheet.
//
// Setup (once):
//  1. Open your Google Sheet → Extensions → Apps Script.
//  2. Paste this file in, replace SECRET below with a random string.
//  3. Deploy → New deployment → type "Web app".
//       - Execute as: Me
//       - Who has access: Anyone
//     Copy the Web app URL.
//  4. In .env set:
//       SHEETS_WEBHOOK_URL="<that url>"
//       SHEETS_SECRET="<same string as SECRET>"
//  5. `bun run export` (or `bun run sync`).
//
// Re-deploy (Manage deployments → edit → new version) whenever you change this.

const SECRET = 'CHANGE_ME';

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  if (body.secret !== SECRET) {
    return ContentService.createTextOutput('forbidden');
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  (body.sheets || []).forEach(function (blk) {
    var sh = ss.getSheetByName(blk.name) || ss.insertSheet(blk.name);
    sh.clearContents();
    var data = [blk.headers].concat(blk.rows);
    if (data.length && blk.headers.length) {
      sh.getRange(1, 1, data.length, blk.headers.length).setValues(data);
      sh.getRange(1, 1, 1, blk.headers.length).setFontWeight('bold');
    }
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
