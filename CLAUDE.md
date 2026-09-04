# Navisworks Clash Intelligence Platform — Working Rules

**This file is read automatically by Claude Code at the start of every session. Treat its contents as binding.**

---

## Governance framework

This repository follows a role-based governance framework recorded in `docs/governance/` (decisions `DEC-001`–`DEC-012`, `WORKFLOW_ROUTING.md`, `WORKFLOW_TEMPLATES.md`, `GOVERNANCE_ORCHESTRATOR.md`, `RELEASE_SNAPSHOTS.md`) and `.cline/bootstrap.md` / `.cline/roles/*`. Investigation before implementation, evidence before conclusions, minimal-change principle. When work resembles a defect investigation rather than a direct instruction, follow that workflow instead of editing directly.

**Released:** INV-008 (IndexedDB Reset Reliability) — `openIDB()` in-flight promise de-dup + self-closing `onversionchange` (commit `6995a0e`). INV-009 (ORPHAN-IDB-SWEEP data-loss race after the register moved to IndexedDB) — remediated by `9a0007e` / `d996b8d`, recovery tool `43705e0`; recorded retrospectively 2026-09-03. INV-011 (orphan image records regenerate on every weekly import) — `IMG-ORPHAN-CLEANUP`, 2026-09-03. See `docs/governance/CURRENT_STATUS.md` for the ranked backlog and `KNOWN_ISSUES.md` for KI-007 to KI-010.

**Test suite has no known failures.** INV-010 (2026-09-03) root-caused the two `CHART-PERIOD-YEAR-AWARE` failures that every PR since INV-008 had labelled "pre-existing flakiness": the spec left the demo register in memory and `rDash()` regenerated weekly buckets from it. Test-only fix (KI-009). A red test is a regression until proven otherwise; specs that seed `S.weekly` or read the dashboard must also reset `S.clashes`.

---

## Project at a glance

- **Owner:** Shane (BIM Space Planning Manager, Exyte Ireland) — ESMC project, Muratec AMHS scope, Dresden.
- **What it is:** Single-file HTML/CSS/JS app (`working.html`, 19,297 lines at `dd87585`, 2026-09-02) that parses Navisworks Clash Detective XML exports, manages clash review workflow, produces PPTX / PDF / BCF / CSV outputs.
- **Deployment:** Copied to SharePoint, opened locally in Chrome/Edge by users.
- **Hard constraints:** Single file. Chart.js and JSZip are inlined (lines 13 and 34). PptxGenJS is loaded from CDN with jsdelivr/unpkg fallbacks (line 361). This is a known deviation from the 'no external dependencies' preference — accepted because inlining PptxGenJS would add ~700 KB to a rarely-used export path. If deploying to a site with restricted egress, verify the CDN or fallbacks are reachable before shipping. Inlining PptxGenJS is a separate future task.

---

## Working preferences — non-negotiable

1. **No agreement preamble.** No "Great question", "You're absolutely right", "Absolutely", "Definitely". No "There are several ways to look at this." Open with the most useful thing.
2. **Confidence tags on uncertain claims:** `[Certain]`, `[Likely]`, `[Guessing]`. Tag inline before the claim. If most of a response is guessing, say so at the top.
3. **Disagree with structure.** When Shane is wrong: *"I disagree because [reason]. Here's what I'd do instead [alternative]. The risk in your approach is [specific downside]."*
4. **Uncomfortable answer first.** If there's a truth he probably doesn't want to hear, lead with it in line one — not buried in paragraph three.
5. **Decide and deliver.** Don't barrage with clarifying questions. Pick a path, state the assumption, ship. Surface design decisions made AFTER the fact for spot-check, not before.
6. **Hold position under pushback.** "But I really think" is not new information. Fold only on genuinely new information.
7. **No unsolicited UX changes or design opinions.** Implement what was asked. Push back only on genuine technical risk.

---

## Edit discipline — every change wrapped in markers

Every meaningful code change is wrapped in a named marker pair:

```js
/* MARKER-NAME start: brief explanation of what and why */
// ...code...
/* MARKER-NAME end */
```

After EVERY edit, run the marker balance check:
```bash
for m in MARKER-A MARKER-B MARKER-C; do
  s=$(grep -c "$m start" working.html)
  e=$(grep -c "$m end" working.html)
  echo "$m: $s/$e"
done
```
All pairs must be 1/1 (or N/N if multi-region). Imbalance = stop and fix before continuing.

**Known pre-existing imbalance:** `BCF-PANEL-B` and `SPATIAL-HEATMAP-GRID` are orphans from earlier sessions, documented and accepted. Don't try to "fix" them.

---

## Anti-regression invariants

- `DATA_VERSION = 'v4-correct-dates-jan25'` — **never bump.** Bumping triggers auto-reset of user data on next load.
- **Dual-parser discipline:** the clash XML is parsed in more than one place. `DOMParser().parseFromString` call sites at `dd87585`: `batchParse()` ~line 9622 (folder batch import), `bparse()` ~line 9959 (single-file import), `_bfParseXml()` ~line 17161, plus `bcfImportRead()` ~line 6909 (BCF, not clash XML). Any parsing change must be evaluated against every clash-XML site. Missing this caused the image-matching regression in chat `acfc68f6`. Re-grep before trusting these line numbers.
- **Minified library blobs:** Chart.js on line 13, JSZip on line 34. Exclude from grep with `awk 'NR!=13 && NR!=34'`. Don't run `node --check` against the raw file — extract app scripts first.
- The app uses `localStorage` (`nw:*` keys) + IndexedDB (`NWClashImages` DB, version 3: `images`, `plans`, `records` stores). Image metadata is key 0 of `images`, shape `imgfix-v1` with `byTest` (derived), `sets`, `latest`, `dhashByIdx`. Since `ef3d620` (IDB-RECORDS-MIGRATION) `nw:clashes` and `nw:weekly` are routed through `sv()`/`lv()` to the `records` store via an in-memory cache and a debounced flush; `_IDB_ROUTED_KEYS` is the whole routing contract. Any path that writes a routed key then reloads, closes, or compares storage must `await _flushPendingWrites()` first. Don't introduce new persistence layers.
- **Protected regions:** `REVIEW-QUEUE-DETECT` and `APPROVE-TERMINAL-STATUS-FILTER` must be byte-identical to `origin/main`. Run the gate in `docs/governance/PROTECTED_REGIONS.md` before requesting merge.

---

## Building taxonomy (canonical)

- **FAB**, **BSGS**, **CUP** — that's it.
- The Central Utility building is **CUP**, not CUB. Data may arrive with `CUB_*` prefix from older partner exports — group under CUP as the canonical display label.
- `_migrateCUBtoCUP()` exists. CUB→CUP IndexedDB key rewrite is a separate pending item.

---

## File-state verification — before any edit

Before editing `working.html`, confirm:
1. Line count matches what the previous session's handoff (or commit message) claims.
2. JS parses clean (extract script blocks excluding minified blobs, then `node --check`).
3. Markers the handoff claims are present actually are. `grep -c "MARKER-NAME start" working.html` must be > 0.

If any check fails, **stop and ask** — don't edit a stale or wrong-base file. The dual cost of editing the wrong base is (a) edits don't land in production, (b) re-applying later costs another full session.

---

## Diagnose-before-changing

- **DevTools console output before theorising about UI bugs.** Static analysis alone is insufficient for runtime behaviour. Required.
- **Playwright reproduction before proposing a fix for any UI bug.** Run against the real `working.html` in Chromium. Catches things grep can't see (e.g. the `_hmVisX is not defined` ReferenceError from chat `80750983`).
- **grep-then-view, then minimal targeted edits.** Never edit blind.
- **Stale data first, code bugs last.** If a platform that worked yesterday shows wrong numbers today, the data shifted more likely than the code broke.

---

## Existing major marker blocks (do not remove)

Listed for context — when working near these areas, read the comment headers before editing:

- `SELECTIVE-RESET`, `SELECTIVE-RESET-BTN`, `SELECTIVE-RESET-HELP` — granular reset feature in Settings
- `WEEKLY-SNAP-PER-CLASH-BUCKET` — each clash buckets to its own ISO week; `KI-008-WEEKLY-PROJECTION` inside it counts each clash at its end-of-week status (DEC-015). `FROZEN-WEEK-TERMINAL-REFRESH` is retired; do not reintroduce it.
- `MATURITY-BAR-EMPTY-STATE` — layout-identical empty states
- `CHART-DEFAULT-W14` — chart period floors at W14
- `FILE-MTIME-AS-DATE`, `FILE-MTIME-AS-DATE-USE` — file mtime overrides XML `<createddate>`
- `PAIR-ID-MERGE` — match on element-pair IDs (order-insensitive, same testName)
- `PAIR-ID-RESOLVED-COUNT` — count clashes that disappeared between imports (detection only, no auto-flip)
- `DUP-FILES-FIX` — per-file import event logging
- `STATUS-HIST` — statusHistory append on status change
- `IMG-REF-REFRESH`, `IMG-POS` — image reference refresh + positional fallback
- `IMG-WEEK-KEYING` — image sets keyed by (test, week); `_nwImgSets` is the source of truth and `_nwImgByTest` is a derived latest-per-test view — never write `_nwImgByTest` directly (DEC-016). `IMG-STORE-AUDIT`, `IMG-ORPHAN-CLEANUP`, `IMG-DHASH-INDEX` all define "referenced" as the union of every set.
- `OWNER-MAP-FIX` — sourceA/sourceB persistence
- `XTEST-DUP-IMPORT`, `WEEKLY-SNAP-CONDITIONAL-*` — cross-test dedup + historical-anchor snapshots

---

## Pending / on the horizon

Ranked order lives in `docs/governance/CURRENT_STATUS.md` → "Current Priority". Summary:

- **Prune tool for weekly image sets (design brief needed):** since DEC-016 image sets accumulate per (test, week), ~171 MB per weekly import on the live profile. The IMG-WEEK-KEYING live migration ran 2026-09-03 (13 sets retagged, verified, gate `nw:imgWeekKeyingMigrated` set); `_imgWeekKeyingMigrate()` is now a no-op on that profile. `_cleanupNwImageOrphans()` treats every week as referenced and will not prune.
- **PIXEL-DEDUP is closed (DEC-017):** no auto-merge, no similarity badge. Live evidence: 11% of human keep-separates are 0-4 bits apart, no computable positives. `_dedupSimilarityProbe()` and `_dedupScanYieldProbe()` are standing read-only evidence tools. Do not build a dHash consumer without new evidence (element-isolated capture is the only recorded reopener). INV-012 (scan criteria yield) is open.
- **Phase 2 of PAIR-ID-RESOLVED-COUNT:** auto-flip status to Resolved with confirmation toast + undo. Detection logic is shipped; the status-mutation part is deferred pending Playwright validation against real Muratec XMLs.
- Building filter additions to Lifecycle and Severity charts
- Layer A `eA`/`eB` flattening fix (storage flattens parsed nested objects, dropping `baseLevel`/`gridHead`)
- `clashBuilding()` reverse-lookup refactor
- CUB→CUP IndexedDB key rewrite (`_migrateCUBtoCUP()` exists but key rewrite is separate); level-name normalisation (`CUP_L30_NN` → `CUP_L30`) moved to parse time
- Multi-project / multi-user capability (client interest noted; three paths outlined in chat history)

---

## Testing — Playwright contract

`tests/` directory holds Playwright specs. Conventions:

- Test file naming: `<feature-marker>.spec.js` (e.g. `pair-id-merge.spec.js`)
- Each test opens `file://` of the local `working.html`
- Auth bypass:
  ```js
  await page.evaluate(() => {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
  ```
- Clean state per test: `await page.evaluate(() => { Object.keys(localStorage).filter(k=>k.startsWith('nw:')).forEach(k=>localStorage.removeItem(k)); });`
- Run from `tests/` (`cd tests && npm install && npx playwright test --workers=1`). Running from the repo root loads two `@playwright/test` instances and fails with a `test.describe()` error (INV-008). In the cloud sandbox set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`. CI optional via GitHub Actions later.
- New tests wait for the terminal migration gate before seeding state: `await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');` (INV-007 / KI-005).

---

## Deployment

After merge to `main`:
1. Copy `working.html` to the SharePoint-synced folder. A `deploy.bat` in repo root automates this.
2. Notify users to refresh (Ctrl+F5 once after a deploy with localStorage-schema-touching changes).

**Never bump `DATA_VERSION`.** See invariants above.

---

## Communication examples — for Claude's tone calibration

**Bad:** "Great question! There are several ways to approach this. Let me walk you through them..."

**Good:** "[Certain] The merge key is wrong. Element-pair IDs are the stable identifier. Fix: replace lookup with order-insensitive pair match within same testName. Risk: records without IDs fall through — keeping the legacy nwName lookup as fallback handles those."

**Bad:** "I think there might be a small issue with the file..."

**Good:** "[Certain] Wrong base file. 12,346 lines, no SELECTIVE-RESET markers. The handoff claims 12,497 lines with SELECTIVE-RESET present. Stop. Find the right file before editing."
