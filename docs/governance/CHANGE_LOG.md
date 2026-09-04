# Change Log

## Purpose

Record major project milestones, releases, and significant changes.

This document is not intended to replace Git history.

Only high-level changes should be recorded here.

---

## Future Entries

Format:

### YYYY-MM-DD

Summary:

Changes:

Notes:

---

### 2026-08-15

Summary:

Release Snapshot capability designed and implemented (DEC-012). First snapshot (RS-001) generated using the already-released INV-008 as the reference implementation.

Changes:

- Added: `docs/governance/DEC-012-RELEASE-SNAPSHOT.md`
- Added: `docs/governance/RELEASE_SNAPSHOTS.md` (includes RS-001)
- Added: `scripts/generate-release-snapshot.mjs`
- Updated: `GOVERNANCE_ORCHESTRATOR.md`, `WORKFLOW_ROUTING.md`, `WORKFLOW_TEMPLATES.md`, `CURRENT_STATUS.md` (cross-references and closure record)

Notes:

Documentation/tooling capability only. No `working.html` changes. No investigation reopened.

---

### 2026-08-24

Summary:

Two hardening releases on the folder batch-import path.

Changes:

- `7c91beb` — IMG-BATCH-BACKPRESSURE (#59): image-load concurrency in folder batch import bounded by `_IMG_READ_CONCURRENCY`; `loadNwImages` becomes awaitable and batch import does not resolve until every image is stored. Tests: `tests/img-batch-backpressure.spec.js` (5).
- `9117ae2` — STORAGE-WRITE-GUARD (#60): `sv()` returns a boolean and raises a dismissible banner on a rejected localStorage write; folder batch import no longer reports success when writes were rejected. Tests: `tests/storage-write-guard.spec.js` (5).

Notes:

`working.html` changes. `DATA_VERSION` untouched.

---

### 2026-08-26

Summary:

Protected-region invariant gate corrected and recorded in the repository
(DEC-013). The fingerprints previously carried in briefs did not reproduce under
any stated algorithm, leaving the gate unrunnable.

Changes:

- Added: `docs/governance/PROTECTED_REGIONS.md` (gate procedure, algorithm,
  corrected fingerprints, failure handling)
- Updated: `docs/governance/DECISION_LOG.md` (DEC-013)
- Updated: `docs/governance/WORKING_AGREEMENTS.md` (cross-reference under
  Repository Standards)

Notes:

Documentation only. No `working.html` changes. Both protected blocks were
verified unchanged at `161894f` before the fingerprints were recorded.

---

### 2026-08-26

Summary:

Storage-layer release day: dHash fingerprints on stored images, the register moved out of localStorage into IndexedDB, and two same-day fixes for a data-loss defect introduced by that move (see INV-009 / KI-007).

Changes:

- `161894f` — IMG-DHASH-PHASE1 (#61): `computeDHash()` and a 16-hex-char dHash stored on every clash image record (`{b64, dhash}`, legacy bare-string records still readable via `_dhashUnwrap()`); resumable, gated, delayed backfill on launch. Nothing reads the hash yet. Tests: `tests/img-dhash-phase1.spec.js` (11).
- `ef3d620` — IDB-RECORDS-MIGRATION (#63): `nw:clashes` and `nw:weekly` move to a `records` store in `NWClashImages` (DB version 2→3). `sv()`/`lv()` contracts preserved through an in-memory cache and a debounced flush; verify-then-gate migration; flush on `visibilitychange`/`pagehide`, before import summary, and before every reload in `clearAll`/`factoryReset`/selective reset. Tests: `tests/idb-records-migration.spec.js` (15) plus nine existing specs updated.
- `9a0007e` — IDB-RECORDS-VERIFY-RACE (#64): register-hydration signal; `ORPHAN-IDB-SWEEP` requires it before deleting the database. Root cause of the live-profile image loss. Tests: +4.
- `d996b8d` — IDB-RECORDS-GATE-QUOTA (#65): verified originals deleted before the gate is written so migration completes on a full profile; gate-write failure non-fatal. Tests: +4.

Notes:

`working.html` changes. `DATA_VERSION` untouched. Protected blocks verified `UNCHANGED` on every PR. The #64/#65 defect and remediation were not recorded in the governance ledger at the time; recorded retrospectively on 2026-09-03 as INV-009 / KI-007.

---

### 2026-09-02

Summary:

Image recovery tool released.

Changes:

- `43705e0` (merged via `f6a9332`) — IMG-REATTACH-ARCHIVE (#66): Data Manager "Re-attach images from archive folder"; images-only by construction; report/`_files` matcher factored into three helpers shared with `importFolderPick`. Tests: `tests/img-reattach-archive.spec.js` (8). Full suite at merge: 338 passed, 2 pre-existing failures.

Notes:

`working.html` changes. Recovery path for images lost under KI-007. Superseded image records left behind by re-runs are tracked as MI-003.

---

### 2026-09-03

Summary:

Governance ledger catch-up covering everything released since INV-008 (PRs #59–#66).

Changes:

- INVESTIGATION_LOG.md: INV-009 (retrospective record of the ORPHAN-IDB-SWEEP data-loss defect and its three remediation PRs), INV-010 opened (persistent `CHART-PERIOD-YEAR-AWARE` test failures).
- KNOWN_ISSUES.md: KI-007 (resolved), KI-008 (confirmed, deferred — frozen-week double-count), MI-003 (orphaned IndexedDB image records), MI-001 updated for the `idbRecordsMigrated` gate and the routed write path.
- CURRENT_STATUS.md: rewritten status, release table for #59–#66, ranked backlog.
- CHANGE_LOG.md: entries for 2026-08-24, 2026-08-26 (code), 2026-09-02.
- RELEASE_SNAPSHOTS.md: RS-002.
- CLAUDE.md: line count, storage-layer invariants, pending list refreshed.

Notes:

Documentation only. No `working.html` changes.

---

### 2026-09-03 (code)

Summary:

Read-only IndexedDB image-store audit for MI-003.

Changes:

- `working.html` — IMG-STORE-AUDIT: `_auditNwImageStore(opts)` and `_auditSampleNwImages(keys)`; console-callable, performs no put/delete/metadata write. Classifies every key against the metadata `byTest` slot ranges and estimates payload size from a bounded sample.
- `tests/img-store-audit.spec.js` — 8 tests; all fail on the unmodified file (function undefined), all pass with the change; adjacent specs (`img-dhash-phase1`, `img-reattach-archive`, `selective-reset-idb-reliability`) re-run green.

Notes:

No UI change. `DATA_VERSION` untouched. Protected blocks `UNCHANGED`. Marker `IMG-STORE-AUDIT` 1/1.

---

### 2026-09-03 (code, PIXEL-DEDUP Phase 2 read side)

Summary:

Referenced-slot dHash index on the image metadata record, and the read API the Phase 2 consumer will call. Decision recorded as DEC-014.

Changes:

- `working.html` — IMG-DHASH-INDEX: `_dhashIndex` (in-memory `idx -> dhash` for referenced slots), serialised into the key-0 metadata record as `dhashByIdx` by `loadNwImages` and, once per pass and only when something was indexed, by `_dhashBackfill`. The backfill skips payload reads for indexed slots and still hashes every numeric key (Phase 1 contract). Restored by `initNwImages`; cleared with the other in-memory image caches. Read API: `_dhashIndexGet(idx)`, `_dhashHamming(a,b)`, `findSimilarImages(maxDistance)` (union-find groups with test and filename per member, cross-test flag). No Dedup Queue, threshold, or UI change.
- `tests/img-dhash-index.spec.js` — 8 tests with real canvas PNGs through `loadNwImages`.
- `docs/governance/DECISION_LOG.md` — DEC-014.

Notes:

No new keys in the images store, no DB version bump, `DATA_VERSION` untouched, protected blocks `UNCHANGED`. Image-layer and IDB specs re-run green (89 tests across 12 spec files including the new one).

---

### 2026-09-03 (tests, INV-010)

Summary:

The two `CHART-PERIOD-YEAR-AWARE` failures present on every full-suite run since 2026-08-15 root-caused and fixed. Test-harness isolation gap; application logic verified correct.

Changes:

- `tests/frozen-week-and-chart-year.spec.js` — `beforeEach` now resets `S.clashes` and `S.weekly` in memory (the demo register was surviving the `nw:*` clear and `rDash()` regenerated four January-2025 weeks from it). 15/15 under `--repeat-each=3`.
- INVESTIGATION_LOG.md INV-010 closed; KNOWN_ISSUES.md KI-009; CURRENT_STATUS.md and CLAUDE.md updated.

Notes:

No `working.html` change. The suite now has no known failures; the "pre-existing flakiness" classification must not be reused.

---

### 2026-09-03 (backlog review, items 5–7)

Summary:

KI-008 analysed to a decision point; Delta Analysis Settings UI found already shipped; horizon list assessed.

Changes:

- KNOWN_ISSUES.md KI-008: raw-reader inventory, the conflict with the tested TERMINAL-REFRESH contract, three options and a recommendation. No code change.
- `working.html`: stale "deferred to Step 3" / "will be added by a follow-up" comments in the `SETTINGS-DESIGNED-CONDITION-PATTERNS` storage region corrected to point at the shipped Settings UI. Comment-only.
- CURRENT_STATUS.md, CLAUDE.md: backlog items 5–7 updated.

Notes:

No behavioural change to `working.html`.

---

### 2026-09-03 (code, KI-008 / DEC-015)

Summary:

Weekly snapshot counters become an end-of-week projection; the frozen-week double count is gone.

Changes:

- `working.html` — `KI-008-WEEKLY-PROJECTION` inside `regenWeeklyFromRegister`: each clash in a bucket counted once at `clashStatusAt(c, wk, yr)` (fallback first recorded status, then `c.status`); frozen rows keep archived fields, counters derived; `FROZEN-WEEK-TERMINAL-REFRESH` block removed. Marker 1/1.
- `tests/frozen-week-and-chart-year.spec.js` — four `KI-008` tests replace the two `FROZEN-WEEK-TERMINAL-REFRESH` tests; describe title updated.
- DECISION_LOG.md DEC-015; KNOWN_ISSUES.md KI-008 resolved; CURRENT_STATUS.md and CLAUDE.md updated.

Notes:

`DATA_VERSION` untouched. Protected blocks `UNCHANGED`. Behavioural change to stored `S.weekly` counters, ruled by Shane (option 1).

---

### 2026-09-03 (code, INV-011 / KI-010)

Summary:

Orphaned image records: mechanism confirmed, cleanup tool, root cause fixed at re-load time.

Changes:

- `working.html` — IMG-ORPHAN-CLEANUP (3 regions): `_classifyNwImageKeys` shared with the audit; `idbDeleteKeys`; `_cleanupNwImageOrphans` (dry run default, verified delete, refuses under pending wipe / backfill / no metadata); `loadNwImages` deletes superseded slots after the metadata write and reports `superseded`; `_dhashBackfill` yields to a running cleanup. Audit output unchanged.
- `tests/img-orphan-cleanup.spec.js` — 9 tests.
- INVESTIGATION_LOG.md INV-011 (mechanism with confidence tags, audit output, ruling 3 answer); KNOWN_ISSUES.md KI-010, MI-003 escalated; CURRENT_STATUS.md, CLAUDE.md.

Notes:

`DATA_VERSION` untouched. Protected blocks `UNCHANGED`. No UI change; console tool only.

---

### 2026-09-03 (release record, INV-011)

Summary:

PR #68 merged (`5f339ff`, `main` `92246f5`). Live-profile cleanup run and verified: 76,682 orphaned image records deleted, 4,768 referenced retained, follow-up audit 4,769 keys / 0 orphaned. MI-003 closed.

Changes:

- INVESTIGATION_LOG.md INV-011: live-run output, per-test ranges after cleanup, two observations (backfill "failed" count, `AHMS`/`AMHS` test-name split).
- KNOWN_ISSUES.md MI-003 closed, KI-010 outcome; CURRENT_STATUS.md; CLAUDE.md pending list.

Notes:

Documentation only.

---

### 2026-09-03 (code, IMG-WEEK-KEYING / DEC-016)

Summary:

Image sets keyed by test **and** week; archive re-attach loads into the picked week; manual additive migration for the existing store.

Changes:

- `working.html` — `IMG-WEEK-KEYING` (3 regions): `_nwImgSets` / `_nwImgLatest` model with `_nwImgByTest` as the derived latest view; week-scoped lookups in `getNwImageB64`, `getNwImageB64Sync`, `hasNwImage` and the clash-detail label; `loadNwImages(files, testName, weekTag)` supersedes only the same (test, week) set and allocates after every set; metadata gains `sets` + `latest` (shape unchanged); classifier, dHash index and superseded-slot deletion treat every set as referenced; `_imgWeekKeyingMigrate()` (dry run default, verify-then-gate). `IMG-REATTACH-ARCHIVE` region 2: week derived from the pick, non-week picks refused. Both `importFolderPick` call sites pass the week.
- `tests/img-week-keying.spec.js` (11 new); `tests/img-reattach-archive.spec.js` (+3, console line now carries the week); `img-dhash-index`, `pr-a11`, `pr-a12` specs seed sets instead of the derived view.
- DECISION_LOG.md DEC-016; CURRENT_STATUS.md; CLAUDE.md.

Notes:

`DATA_VERSION` untouched. Protected blocks `UNCHANGED`. Zero XML-parser lines. No DB version bump, no new keys. Live-profile migration pending (console, dry run first).

---

### 2026-09-03 (release record, IMG-WEEK-KEYING)

Summary:

PR #70 merged (`1924719`, `main` `b77f66b`). One-shot live migration run and verified: 13 image sets retagged to their week (11 → `week-260831`, `99_ESMC` → `week-260824`, `12_GMS_v_14_CCD` → `week-260804`), read-back verified, gate set.

Changes:

- INVESTIGATION_LOG.md INV-011 follow-up: migration output, assignment table, observations.
- CURRENT_STATUS.md, CLAUDE.md: next design item is a prune tool for accumulated weekly image sets.

Notes:

Documentation only.

---

### 2026-09-04 (DEC-017 + INV-012 probe)

Summary:

PIXEL-DEDUP auto-merge closed on live evidence (DEC-017). Read-only DEDUP-SCAN-YIELD probe shipped for INV-012.

Changes:

- `working.html` — `DEDUP-SCAN-YIELD`: `_dedupScanYieldProbe()`, read-only; comment on `PIXEL-DEDUP-AUTOMERGE` updated to reference DEC-017. No behaviour change.
- `tests/dedup-scan-yield.spec.js` (5).
- DECISION_LOG.md DEC-017; INVESTIGATION_LOG.md INV-012 opened; KNOWN_ISSUES.md MI-004; CURRENT_STATUS.md; CLAUDE.md.

Notes:

`DATA_VERSION` untouched. Protected blocks `UNCHANGED`. Zero parser lines. No change to `scanForDedupCandidates`.

---

### 2026-09-04 (code, DEC-018 / INV-012)

Summary:

Dedup scan excludes pairs proven to come from one export. INV-012 closed.

Changes:

- `working.html` — `DEDUP-SAME-EXPORT-FILTER` (2 regions): `_dedupFirstImportWeekMap`, `_dedupSameExport`, read-only `_dedupSameExportReplay`; per-scan map and pair filter in `scanForDedupCandidates` (optional third argument `newUids`); `importToRegister` tracks `_batchNewUids`; INV-012 probe reuses the shared map. Band unchanged at 500 mm. Pairs already queued are untouched.
- `tests/dedup-same-export-filter.spec.js` (6).
- DECISION_LOG.md DEC-018; INVESTIGATION_LOG.md INV-012 findings and closure; KNOWN_ISSUES.md, CURRENT_STATUS.md, CLAUDE.md.

Notes:

`DATA_VERSION` untouched. Protected blocks `UNCHANGED`. Zero parser lines.

