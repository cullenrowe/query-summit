# Query Summit

A game that teaches SQL from beginner to advanced, with a Snowflake flavor. It runs real SQL in the
browser with DuckDB-WASM. Phase 1 ships every core system and World 1 (8 levels and a boss).
Worlds 2 to 10 show on the map as locked camps.

## Run it

- **No build step:** serve this folder with any static server and open `index.html`. It loads the files in `src/` directly.
- **Single file:** `node build.js` writes `dist/query-summit.html`, one self-contained page you can open or host anywhere.

The SQL engine downloads from cdn.jsdelivr.net on first visit (about 7 MB). If that is blocked, the game
looks for a self-hosted copy in `./duckdb/` next to the page (`node build.js` creates one in `dist/duckdb/`).

## Layout

```
index.html            no-build page (script tags in load order)
build.js              stitches src/ into dist/query-summit.html
src/styles.css        every color and size as a CSS variable, light and dark
src/core.js           the QS namespace
src/content/          plain data: datasets, worlds, levels, hints, story, drills, skills, ranks, badges
src/engine/           DuckDB setup, query runner, result comparison, error translation, SQL text tools
src/state/            save and load (versioned), XP, stars, skill tree, spaced repetition
src/ui/               screens and components
tools/gen-data.js     regenerates src/content/datasets.js (seeded, with checks the levels rely on)
tools/make-styles.py  regenerates src/styles.css (keeps the dark palette in one place)
test/                 Playwright checks (see below)
```

## Add a world

1. Add tables to a dataset (edit `tools/gen-data.js`, or add a new dataset file shaped like `src/content/datasets.js`).
2. Create `src/content/world2.js` shaped like `world1.js`. The schema is documented at the top of `world1.js`.
3. Remove that world's placeholder from `src/content/worlds-ahead.js`.
4. Add the new file to the script list in `index.html` and to `ORDER` in `build.js`.
5. Give its skills a `blurb` and `example` in `src/content/meta.js`, and add drills to `src/content/drills.js`.
6. Run `node test/validate.js`. It runs every solution through the judge.

No engine or UI code changes. Answers are judged by comparing result tables, never by matching text.
Data-changing levels (World 9) use `check: { mode: 'state', probe: 'SELECT ...' }`. Snowflake-only
lessons (World 10) use `predict` and `choose` steps.

## Tests

```
npm install                      # duckdb-wasm and esbuild, used by tests and the self-hosted engine copy
node build.js
node test/validate.js            # every solution passes; wrong answers fail with a useful message
node test/playthrough.js mobile light     # plays World 1 and every screen at 375px (also: desktop dark)
node test/flow1.js               # tutorial by taps, then reload: progress survives
node test/extras.js              # hints, replay, practice, settings, keyboard
node test/local-engine.js        # engine fallback, load failure screen, Retry
```

The tests need Playwright with Chromium. They serve local copies of the engine at the jsDelivr URLs, so they run offline.

## Phase 2 checklist

**File split and repo**
- [ ] Create the repo and push this folder as is. `index.html` plus `src/` is already the split version.
- [ ] Turn on GitHub Pages (Settings, Pages, deploy from branch, root). The game is live at `https://<user>.github.io/<repo>/`.
- [ ] Add a GitHub Action that runs `node build.js` and `node test/validate.js` on every push.

**Remaining worlds (content only)**
- [ ] World 2 Sharper Filters. Needs NULLs in the data (for example trial end dates, cancel reasons).
- [ ] World 3 Summing It Up. Add an `invoices` table so sums have something to disagree about.
- [ ] World 4 Joining Forces. Add orphan invoices and a self-referencing column (parent account).
- [ ] World 5 Queries in Queries. Add `discounts`.
- [ ] World 6 Window Watch. Add `plan_changes` with dates for LAG and running totals.
- [ ] World 7 Shape Shifting. Timestamps with time zones, messy strings.
- [ ] World 8 Semi-Structured. Usage events as JSON. DuckDB-WASM fetches its JSON extension from extensions.duckdb.org on first use, so test this early and self-host the extension if needed.
- [ ] World 9 Building the Warehouse. Uses `check.mode: 'state'` (already built and tested).
- [ ] World 10 Snowflake Lab. Predict and choose only.
- [ ] Snowflake Corner cards for each world. Have every claim checked against current Snowflake docs.

**PWA (installable, offline)**
- [ ] Add `manifest.webmanifest` and icons.
- [ ] Add a service worker that caches `index.html`, `src/`, and the fonts.
- [ ] Self-host the engine for offline play: copy `dist/duckdb/` to the repo. GitHub accepts files up to 100 MB, so the `.wasm` can be one file (set `LOCAL.wasmParts` in `src/engine/db.js` to a single entry).
- [ ] Self-host the three font families so the first offline load has them.

**Nice to have**
- [ ] Cross-device sync (today: Export and Import codes).
- [ ] Music and more sound.
- [ ] A content linter that checks every level has hints, skills, and a goal with no order ties.
