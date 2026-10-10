# Clan Leader Tool

Tracking performa war & CWL Clash of Clans untuk klan **The Last Of Us** (`#2RV22C9L9`).
Pipeline file-based, jalan lokal + GitHub Actions, output ke Google Sheet.

```
poll ──cocproxy──► CoC API
  └─► data/wars/*.json ──► report ──► data/leaderboard.json ──► Google Sheet
```

## Setup

```sh
bun install
cp .env.example .env   # isi COC_API_TOKEN + (opsional) SHEETS_*
```

Token dibuat di developer.clashofclans.com, IP di-whitelist ke `45.79.218.79` (IP proxy).

## Perintah

| Perintah | Fungsi |
|---|---|
| `bun run poll` | ambil currentwar tiap klan → `data/wars/*.json` |
| `bun run report` | recompute `data/leaderboard.json` dari semua war `warEnded` |
| `bun run export` | kirim leaderboard ke Google Sheet (no-op kalau `SHEETS_*` kosong) |
| `bun run sync` | poll → report → export |
| `bun run test` | unit test |
| `bun run typecheck` | `tsc --noEmit` |

## Kenapa harus sering poll

Data per-serangan hilang dari API begitu war berikutnya mulai; `warlog` cuma simpan
ringkasan. Jadi butuh ≥1 poll di jendela antara war berakhir dan war baru mulai —
makanya ada cron GitHub Actions (`.github/workflows/poll.yml`, tiap 30 menit).

## Google Sheet

Lihat `apps-script/Code.gs` untuk setup webhook (sekali).

## Struktur

- `lib/coc/` — client API (via cocproxy)
- `lib/normalize/` — raw war → bentuk internal (pure)
- `lib/stats/` — metrik & skor performa (pure)
- `lib/store.ts`, `lib/sheet.ts` — I/O file & format sheet
- `scripts/` — poll, report, export
- `fixtures/` — respons API nyata buat test

## Belum dikerjakan

- F2 ingest CWL (sebelum CWL November)
- exclude friendly war (`data/excludes.json`) saat dibutuhkan
