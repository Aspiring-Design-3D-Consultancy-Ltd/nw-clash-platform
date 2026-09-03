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

