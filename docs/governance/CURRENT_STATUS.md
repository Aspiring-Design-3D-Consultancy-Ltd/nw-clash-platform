# Current Status

## Governance Framework

Status:

Validated

Validated Roles:

- Repository Steward ✅
- Environment Steward ✅
- Project Analyst ✅
- Architect ✅
- QA Investigator ✅
- Developer ✅
- Implementation Manager ✅
- Release Manager ✅

Governance Framework Version:

v1

Notes:

The governance framework has been validated through execution of real-world investigation and remediation workflows using INV-002 (closeApp() Whitelist Drift) and R1 (Data Resurrection After Reset).

---

## Repository Status

Last Updated:

2026-09-03

Current Branch:

main (`dd87585`, 2026-09-02). Governance catch-up prepared on `claude/app-progress-issues-04app5`.

Repository Health:

- Repository healthy
- `working.html` at 19,297 lines
- Governance ledger brought current on 2026-09-03 after a gap from 2026-08-15 to 2026-09-02 during which eight feature/fix PRs (#59–#66) merged without status, known-issue, or investigation records (see INV-009 "Governance Observation")
- Protected blocks `REVIEW-QUEUE-DETECT` (`54db97511c97f7ad`) and `APPROVE-TERMINAL-STATUS-FILTER` (`c1173153c15dba7b`) verified `UNCHANGED` against `origin/main` on 2026-09-03
- `DATA_VERSION` = `v4-correct-dates-jan25`, unchanged

Releases Since INV-008 (all merged to `main` by the repository owner after PR diff review):

| Date | Commit | PR | Marker | Summary |
| --- | --- | --- | --- | --- |
| 2026-08-24 | `7c91beb` | #59 | IMG-BATCH-BACKPRESSURE | Bounded image-load concurrency in folder batch import |
| 2026-08-24 | `9117ae2` | #60 | STORAGE-WRITE-GUARD | Surface localStorage write failures instead of swallowing them |
| 2026-08-26 | `161894f` | #61 | IMG-DHASH-PHASE1 | dHash fingerprint stored on every clash image (compute + store; nothing reads it yet) |
| 2026-08-26 | `2860f51` | #62 | DEC-013 | Protected-region invariant gate with corrected fingerprints (docs) |
| 2026-08-26 | `ef3d620` | #63 | IDB-RECORDS-MIGRATION | `nw:clashes` + `nw:weekly` moved from localStorage to an IndexedDB `records` store |
| 2026-08-26 | `9a0007e` | #64 | IDB-RECORDS-VERIFY-RACE | Stop ORPHAN-IDB-SWEEP deleting the DB under the in-flight migration (INV-009) |
| 2026-08-26 | `d996b8d` | #65 | IDB-RECORDS-GATE-QUOTA | Delete verified originals before writing the migration gate (INV-009) |
| 2026-09-02 | `43705e0` | #66 | IMG-REATTACH-ARCHIVE | Re-attach images from an archive folder (INV-009 recovery tool) |

Current Working Tree:

INV-002 (680cfd5), R1 (a0526bf), INV-005 (3f37f72), INV-006 (136c397), INV-007 (b471e5c), INV-008 (6995a0e), and INV-009 (9a0007e / d996b8d / 43705e0) remediations are committed and pushed to main.

---

## Active Investigation Status

### INV-002

Title:

closeApp() Whitelist Drift

Status:

Closed - Released

Summary:

The application previously used a hardcoded validKeys allow-list during closeApp() processing.

Investigation confirmed that 18 actively-used persisted keys were missing from that allow-list and were being deleted during normal application closure.

The approved remediation replaced the allow-list model with an explicit removal-list model that preserves active persisted keys by default while removing only confirmed legacy/orphaned keys.

Implementation Status:

✅ Completed

QA Retest:

✅ Passed

Repository Steward Review:

✅ Approved With Observations

Release Approval:

✅ Approved

Regression Protection:

✅ Added

Files Affected:

- working.html
- tests/close-app-scope-fix.spec.js

Release Commit:

680cfd5146272473b1887ed0cf96d984731164f9 — Committed and pushed.

---

### R1

Title:

Data Resurrection After Reset

Status:

Closed - Released

Summary:

`clearAll()` and `_executeSelectiveReset()` previously removed persisted `nw:*` keys from localStorage without updating the corresponding in-memory `S.*` fields.

Investigation confirmed that subsequent code paths that re-persisted `S.*` state could write stale data back into storage, causing previously cleared data to reappear.

The approved remediation synchronizes in-memory state with persisted-state removal during both `clearAll()` and `_executeSelectiveReset()`, ensuring deleted data cannot be resurrected by later persistence operations.

Implementation Status:

✅ Completed

QA Retest:

✅ Passed

Repository Steward Review:

✅ Approved With Observations

Release Approval:

✅ Approved (DEC-007 documentation-commit condition satisfied)

Regression Protection:

✅ Added

Files Affected:

- working.html
- tests/r1-data-resurrection.spec.js

Release Commit:

a0526bfaaf47d0256219f9727279ef190c321925 — Committed and pushed.

---

### INV-005

Title:

Migration Gate / Persistence Write Divergence Remediation

Status:

Closed - Released

Summary:

The `REVIEW-QUEUE-MIGRATE-SCOPE-FIX` and `REVIEW-QUEUE-MIGRATE-DATE-GUARD-FIX` one-shot migrations inside `initAuth()` previously persisted migrated data via `sv()`, which swallows write errors internally. A failed persistence write could therefore leave storage unchanged while the one-shot gate flag was still set unconditionally, permanently and silently diverging the gate from the underlying data — the same failure mode previously remediated under INV-003.

The approved remediation replaced the `sv()` calls with direct, throwing `localStorage.setItem` calls inside the same try block as the gate write, mirroring the INV-003 pattern, so a failed write prevents the gate from ever being set and the migration safely retries on the next load.

Implementation Status:

✅ Completed

QA Retest:

✅ Passed

Repository Steward Review:

✅ Approved With Observations

Release Approval:

✅ Approved

Regression Protection:

✅ Added

Files Affected:

- working.html
- tests/inv005-asym.spec.js

Release Commit:

3f37f724891f42de14571cd198a0fd9c195cbbad — Committed and pushed.

---

### INV-006

Title:

Residual Migration Gate / Persistence Divergence Risk Assessment

Status:

Closed - Released

Summary:

Opened from MI-001 to determine whether `dedupInitialScan` and `reviewQueueDeltaAnalysisMigrated` — the two remaining one-shot migration flags not yet individually verified — contain the same gate/persistence-write divergence defect remediated under INV-003 and INV-005.

Findings:

Both locations were confirmed to contain the identical defect class. `dedupInitialScan`'s wrapper and `reviewQueueDeltaAnalysisMigrated`'s `_rqdaMigrate()` both persist underlying data via `sv()` (which swallows write errors) before unconditionally setting their one-shot gate flags. Unlike INV-003/INV-005, the vulnerable writes live inside shared functions (`scanForDedupCandidates()`, `_rqdaReclassifyAll()`) also used in non-gate contexts, so remediation required a scope-safe approach rather than a literal copy of the INV-003/INV-005 pattern.

Human Decision:

Option C selected — dedicated, throwing persistence step scoped only to the two one-shot wrapper functions, leaving shared helpers (`sv()`, `scanForDedupCandidates()`, `_rqdaReclassifyAll()`) untouched.

The approved remediation added a direct, throwing `localStorage.setItem` write of the wrapper's own result (`nw:dedupQueue` / `nw:clashes`) inside the same try block as each gate write, so a failed write prevents the gate from ever being set and each one-shot operation safely retries on the next load.

Tracked as:

KI-004 (Known Issues)

Implementation Status:

✅ Completed

QA Retest:

✅ Passed (4/4 new; 69/69 combined targeted validation)

Repository Steward Review:

✅ Approved With Observations

Release Manager Review:

✅ Approved

Regression Protection:

✅ Added

Files Affected:

- working.html
- tests/inv006-asym.spec.js (new)

Release Commit:

136c397 — Fix INV-006 migration gate persistence divergence

Status:

Committed and pushed.

---

### INV-007

Title:

MI-002 Test Timing Sensitivity Assessment

Status:

Closed - Released

Summary:

Opened from MI-002 to determine the root cause of recurring, pre-existing intermittent Playwright test failures (`approve-action-*`, `dedup-queue.spec.js`, `img-count-check.spec.js`, `selective-reset-idb-reliability.spec.js`, and others) and whether remediation is required.

Findings:

Confirmed a test-harness synchronization gap, not an application defect. Test bootstrap helpers wait only for `working.html`'s earliest observable ready signal (`S.clashes` + `S.projName`), not for the full `window.onload` initialization chain (inline `initAuth()` migrations plus three further `setTimeout(1500/1600)`-deferred migrations). Deferred migrations fire within a typical test body's runtime and race/overwrite test-seeded state, producing the intermittent failures.

Empirically validated fix (adding a single explicit wait on the terminal migration gate) eliminated the flakiness across 44/44 test executions on two independent spec files during pre-implementation validation, with zero application-code changes required. Implementation has since been completed across all 28 affected spec files and re-verified via full-suite QA Retest.

Tracked as:

KI-005 (Known Issues)

Implementation Status:

✅ Implemented — `await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');` added immediately after the existing early-signal wait in every affected bootstrap helper across 28 `tests/*.spec.js` files. Two bootstraps (`batch-import-folder.spec.js`, `weekly-incremental-import.spec.js`) plus `weekly-summary-screenshot.spec.js` also received a small additional in-memory `S.clashes = []` / `S.weekly = []` reset (mirroring the existing `img-count-check.spec.js` pattern) — the deterministic wait exposed that these bootstraps had been relying on lucky race timing to observe an empty register before the demo dataset finished seeding.

QA Investigation / Architect Review:

✅ Completed — root cause confirmed, remediation approach approved (test-file-only).

QA Retest:

✅ Completed — full-suite run (`--workers=1`): 278/284 passed. The remaining 6 failures (`frozen-week-and-chart-year.spec.js` ×2, `selective-reset-idb-reliability.spec.js` ×3, `wipe-verify.spec.js` ×1) were confirmed via `git stash` baseline comparison to be pre-existing, unrelated IndexedDB/chart-range timing flakiness present on the unmodified codebase too — out of scope for this remediation. Baseline (unmodified) comparison run showed 21 pre-existing intermittent failures; post-fix only the 6 confirmed-unrelated ones remain.

Files Affected:

- 28 files under `tests/*.spec.js` sharing the affected bootstrap idiom (enumerated and modified; see KI-005 for the full list of the three files requiring the additional in-memory reset)

Release Commit:

b471e5c — Fix INV-007 test timing sensitivity

Status:

Committed and pushed.

---

## Known Issues

### Confirmed

None. KI-008 resolved 2026-09-03 under DEC-015 (projection everywhere).

### Under Investigation

None. INV-010 (test-harness isolation gap, KI-009) and INV-011 (orphan image records, KI-010) both opened, closed and released 2026-09-03.

### Monitoring

#### MI-001

Migration Complexity

Status:

Monitoring — scope widened 2026-09-03

Description:

Six one-time migration flags now exist. The original five (`reviewQueueScopeFixed`, `reviewQueueDateGuardFixed`, `dedupInitialScan`, `reviewQueueDeltaAnalysisMigrated`, `dedupRetroCleanup:v1`) were verified defect-free under INV-003/INV-005/INV-006. The sixth, `idbRecordsMigrated` (IDB-RECORDS-MIGRATION, 2026-08-26), uses verify-then-gate with delete-before-gate ordering and was hardened under INV-009. Separately, the routed write path (`sv()` for `nw:clashes`/`nw:weekly` → in-memory cache → debounced IndexedDB flush) is a new ordering-risk class: any path that writes a routed key and then reloads or compares storage must flush first. See KNOWN_ISSUES.md MI-001 for the checklist.

---

#### MI-002

Test Timing Sensitivity

Status:

Resolved under INV-007 / KI-005. The IndexedDB-timing subset was resolved under INV-008 / KI-006.

---

#### MI-003

Orphaned IndexedDB Image Records

Status:

Monitoring — read-only audit required before any action

Description:

The live profile's `images` store held approximately 63,178 records against roughly 3,670 restorable at the time of PR #63; re-running the archive re-attach tool (PR #66) leaves superseded records behind. Origin breakdown unknown. Closed 2026-09-03. Audit found 76,682 orphaned records (2.87 GB); INV-011 / KI-010 shipped the cleanup and the root-cause fix; live-profile cleanup verified: 4,769 keys, 0 orphaned.

---

## Testing Status

Framework:

Playwright

Recent Validation:

### INV-002 Regression Coverage

Test:

- tests/close-app-scope-fix.spec.js

Results:

- close-app-scope-fix.spec.js → 3/3 Passed
- Combined persistence validation suite → 12/12 Passed

Outcome:

PASS

---

### R1 Regression Coverage

Test:

- tests/r1-data-resurrection.spec.js

Coverage:

- clearAll() in-memory synchronization
- clearAll() resurrection-vector prevention
- Selective reset memory synchronization
- Selective reset resurrection-vector prevention
- Category symmetry validation

Results:

- r1-data-resurrection.spec.js → 10/10 Passed
- Combined persistence validation suite → 22/22 Passed

Outcome:

PASS

---

### INV-005 Regression Coverage

Test:

- tests/inv005-asym.spec.js

Coverage:

- reviewQueueScopeFixed gate/persistence asymmetric-failure path
- reviewQueueScopeFixed gate/persistence success path
- reviewQueueDateGuardFixed gate/persistence asymmetric-failure path
- reviewQueueDateGuardFixed gate/persistence success path

Results:

- inv005-asym.spec.js → 4/4 Passed
- Combined persistence validation suite → 26/26 Passed

Outcome:

PASS

---

### INV-006 Regression Coverage

Test:

- tests/inv006-asym.spec.js

Coverage:

- dedupInitialScan gate/persistence asymmetric-failure path
- dedupInitialScan gate/persistence success path
- reviewQueueDeltaAnalysisMigrated gate/persistence asymmetric-failure path
- reviewQueueDeltaAnalysisMigrated gate/persistence success path

Results:

- inv006-asym.spec.js → 4/4 Passed
- Combined targeted validation suite (inv006-asym, inv003-asym, inv005-asym, dedup-scope-and-signature, dedup-audit-log, review-queue-bulk-delta-approve-source, review-queue-date-guard-fix, review-queue-scope, weekly-incremental-import) → 69/69 Passed

Outcome:

PASS

Note: a full repository-wide suite run surfaced 22 pre-existing intermittent failures unrelated to this change (`approve-action-*`, `img-count-check`, `selective-reset-idb-reliability`, `frozen-week-and-chart-year`, etc.). These were independently reproduced on the unmodified pre-INV-006 baseline via `git stash`, confirming pre-existing MI-002 (Test Timing Sensitivity) flakiness rather than a regression from this change.

---

## Current Priority

Ranked backlog as of 2026-09-03 (in execution order):

1. **Governance ledger catch-up** — this update (INV-009 retrospective record, INV-010 opened, KI-007, KI-008, MI-003, CHANGE_LOG for #59–#66, RS-002). Complete on commit of this document set.
2. **MI-003 / INV-011 orphan records** — done. Audit, cleanup tool, root-cause fix (PR #68, `main` `92246f5`), and the live-profile cleanup: 76,682 deleted, 4,768 kept, verification passed, store now 4,769 keys. MI-003 closed.
3. **PIXEL-DEDUP Phase 2** — ruling made and read side shipped 2026-09-03 (DEC-014, IMG-DHASH-INDEX): record stays authoritative, referenced-slot index rides on the metadata record, `findSimilarImages(maxDistance)` is the query API. Remaining: the consumer half (what a near-duplicate image means for two clashes, threshold, where it surfaces) needs a brief from Shane before it is built.
4. **INV-010** — done 2026-09-03. Test-harness isolation gap (the demo register stayed in memory and `rDash()` regenerated weekly buckets from it); test-only fix, KI-009. Application logic verified correct. The suite has no known failures left.
5. **KI-008** — resolved 2026-09-03. Shane ruled option 1 (DEC-015): every weekly snapshot counts each clash once at its end-of-week status; `FROZEN-WEEK-TERMINAL-REFRESH` retired; four new tests replace the two old ones.
6. **Delta Analysis Settings UI (Step 3)** — already shipped. The Settings tab renders "Designed condition patterns & republish tolerance" (tolerance input, per-pattern enable/edit/remove, add pattern; `SETTINGS-DESIGNED-CONDITION-PATTERNS` region 2, ~line 15867). The "deferred to Step 3" comments in the storage region were stale and have been corrected. No test covers the section directly; noted as a coverage gap, not a defect.
7. **CLAUDE.md horizon list** — PAIR-ID-RESOLVED-COUNT Phase 2 (auto-flip with undo), CUB→CUP IndexedDB key rewrite, `eA`/`eB` flattening, `clashBuilding()` refactor, building filters on Lifecycle/Severity charts, level normalisation at parse time, multi-project capability. Each needs a brief; the client-deployment question (external client users using the app, not receiving reports) now has a design paper at `docs/design/CLIENT_DEPLOYMENT_DESIGN.md` (Options A/B/C, recommendation matrix; design decisions ruled as DEC-017 on 2026-09-04, build not authorised pending the client-shape answer; KI-011 plaintext API key raised from it, KI-011-FIX queued); PAIR-ID Phase 2 and parse-time normalisation additionally need real Muratec XMLs for Playwright validation (dual-parser discipline). Not started.

All confirmed defects identified through INV-002, R1, INV-005, INV-006, INV-007, INV-008, and INV-009 have been remediated, verified, committed, pushed, and released.

---

### INV-009 (Closed - Released — retrospective record)

Title:

ORPHAN-IDB-SWEEP Deletes the Image Database Under the In-Flight Register Migration

Status:

Closed - Released. Remediated 2026-08-26 (`9a0007e`, `d996b8d`) with recovery tooling merged 2026-09-02 (`43705e0`). The investigation record was written on 2026-09-03, after release; see INVESTIGATION_LOG.md INV-009 for the reconstructed evidence, the root cause (await-ordering regression from IDB-RECORDS-MIGRATION making the sweep's "register is empty" precondition ambiguous), both remediations, and the governance observation.

Tracked as:

KI-007 (Resolved), MI-003 (residual orphan records)

Regression Protection:

- tests/idb-records-migration.spec.js (+8 across #64/#65)
- tests/img-reattach-archive.spec.js (8)

Release Snapshot:

RS-002

---

### IMG-WEEK-KEYING (DEC-016, enhancement — released on merge)

Image sets keyed by (test, week) so a clash last observed in an earlier week resolves that week's image (INV-011 ruling 3, Option A). Week-scoped lookups with latest-set fallback for legacy/untagged clashes; same-week supersede, cross-week accumulate; archive re-attach loads into the picked week and refuses non-week picks; additive metadata (`sets`, `latest`), `byTest` kept as the derived view. Migration is manual from the console with verify-then-gate. Tests: `img-week-keying.spec.js` (11), `img-reattach-archive.spec.js` (+3).

---

### INV-011 (Closed - Released on merge)

Title:

Orphaned IndexedDB Image Records — Mechanism, Cleanup and Root Cause

Status:

Closed and released 2026-09-03 (PR #68, `main` `92246f5`); live-profile cleanup verified the same day. Live-profile audit: 81,451 keys, 4,768 referenced, 76,682 orphaned in 4 runs (2.87 GB). Mechanism confirmed from source: `loadNwImages` never deleted a superseded range, and every weekly import re-loads all 13 test names. Remediation `IMG-ORPHAN-CLEANUP`: shared classifier, console cleanup tool (dry run default, verified delete), superseded-slot deletion at re-load time. Also answers why the metadata shows 13 tests and why W33/W34 clashes lose their images (see INVESTIGATION_LOG.md INV-011). Tracked as KI-010. Live cleanup: 76,682 deleted, 4,768 kept, verification passed.

---

### INV-010 (Closed - Released, test-only)

Title:

Persistent CHART-PERIOD-YEAR-AWARE Failures in frozen-week-and-chart-year.spec.js

Status:

Closed 2026-09-03. Reproduced deterministically; root cause is the spec leaving the demo register in memory while `rDash()` regenerates weekly buckets from it (see INVESTIGATION_LOG.md INV-010). Test-file-only remediation (`S.clashes = []; S.weekly = []` in `beforeEach`), 15/15 under `--repeat-each=3`. No `working.html` change. Tracked as KI-009.

---

### INV-008 (Closed - Released)

Title:

IndexedDB Reset Reliability Investigation

Status:

Released / Closed. Human authorization was granted to proceed to Developer Assessment and Developer Implementation for the combined Option A + Option B remediation. QA Retest passed (see "INV-008 Regression Coverage" below). Repository Steward Review and Release Manager Review both approved. Human authorization to commit and push was subsequently granted; the remediation branch (`repo-hygiene-remove-zz-repro`, commits `f444cfa`/`326a93d`/`ec6af50`) was merged into `main` via `6995a0e` and pushed to `origin/main` (fast-forward-verified, no conflicts). Full-suite QA Retest re-run post-merge on `main`: 286/288 Passed, identical residual failures to the pre-merge QA Retest (see "Final Release Verification" below). Investigation closed.

Summary:

Opened following completion of INV-002/R1/INV-005/INV-006/INV-007 and the Repository Hygiene review, to root-cause the residual `selective-reset-idb-reliability.spec.js` / `wipe-verify.spec.js` "deleteDatabase blocked by another connection" failures left unexplained under MI-002/KI-005. Confirmed two independent findings: (1) the reported `test.describe()` error is an environment/invocation issue (two `@playwright/test` module instances loaded when Playwright is run from the repository root instead of `tests/`) — no code defect; (2) a real, confirmed application defect in `openIDB()`'s connection-singleton management in `working.html` — a check-then-act race on the module-level `_idb` variable (triggered every page load by `window.onload`'s concurrent `initNwImages()`/`initPlans()` calls) that can create an orphaned, unreferenced `IDBDatabase` connection, compounded by an `onversionchange` handler that closes over the shared `_idb` variable instead of its own connection and therefore fails to close the orphan when a peer requests a version change. Full findings, evidence, and remediation options in `INVESTIGATION_LOG.md` (INV-008).

Implemented Remediation:

- Option A: `openIDB()` now caches the in-flight `indexedDB.open()` promise in a new module-level `_idbOpenPromise` variable. Concurrent callers arriving before the first `openIDB()` call resolves now share that single in-flight promise instead of each issuing their own `indexedDB.open()` request, eliminating the source of orphaned duplicate connections. The cached promise is cleared on open success, open failure, and everywhere `_idb` is already nulled (`onversionchange` handler, `_closeSharedIdb()`).
- Option B: the `onversionchange` handler installed in `openIDB()`'s `req.onsuccess` now captures its own connection (`const db=e.target.result`) and calls `db.close()` directly, only nulling the shared `_idb` if `_idb===db` at the time the handler fires — so a connection superseded by a later `openIDB()` call still self-closes correctly instead of silently leaving the true orphan open.
- `_closeSharedIdb()` also clears `_idbOpenPromise`, so a caller racing a close can never be handed a resolved reference to the connection just closed.

Files Modified:

- working.html (`openIDB()`, `_closeSharedIdb()`)
- tests/selective-reset-idb-reliability.spec.js (4 new regression tests)

Next Action:

None. Released. No further code changes should be made to `openIDB()`/`_closeSharedIdb()` under this investigation without opening a new investigation.

Release:

Commit: 6995a0e4b37c7cd499ae042e7d7e71640e3bf8ff (merge of `repo-hygiene-remove-zz-repro`, containing `f444cfa`/`326a93d`/`ec6af50`)

Commit Message: "Merge branch 'repo-hygiene-remove-zz-repro' into main (INV-008 release)"

Branch: main

Status: Committed and pushed.

---

### INV-008 Regression Coverage

Test:

- tests/selective-reset-idb-reliability.spec.js (new tests added within the existing `SELECTIVE-RESET-IDB-CLOSE` describe block)

Coverage:

- Concurrent `openIDB()` callers de-duplicate into a single `indexedDB.open()` call and resolve to the same connection (Option A)
- An orphaned connection's own `onversionchange` handler closes only itself, leaving a different, currently-active `_idb` untouched (Option B)
- `openIDB()` clears the cached in-flight promise when the open request errors, so a subsequent retry succeeds instead of hanging on a stale rejected promise
- `_closeSharedIdb()` clears the cached in-flight promise in addition to `_idb`

Results:

- selective-reset-idb-reliability.spec.js → 21/21 Passed (single run); 105/105 Passed under `--repeat-each=5` (the exact regime that previously showed 16/85 intermittent failures under INV-008's own investigation run — now fully eliminated)
- wipe-verify.spec.js → 4/4 Passed
- Full repository-wide suite (`--workers=1`) → 286/288 Passed. The 2 residual failures (`frozen-week-and-chart-year.spec.js`, `CHART-PERIOD-YEAR-AWARE` ×2) were independently reproduced on the unmodified baseline via `git stash`, confirming pre-existing, date-boundary-dependent chart-range flakiness unrelated to this change.

Outcome:

PASS

---

### INV-008 Final Release Verification

Date:

2026-08-15

Repository State vs. Governance Records:

- `main` fast-forwarded from `3a69a1b`/`origin/main` `42730ee` to include the INV-008 branch via merge commit `6995a0e`, then fast-forwarded again to `4f86e0b` (automated `chore: stamp build 6995a0e` from `.github/workflows/stamp-build.yml`).
- Merge was clean (`git merge --no-ff repo-hygiene-remove-zz-repro`) — no conflict markers, no manual conflict resolution required.
- `working.html` confirmed post-merge to contain the Option A (`_idbOpenPromise`) and Option B (self-closing `onversionchange`) remediation intact.
- `git status` confirms working tree clean and `main` up to date with `origin/main` after push.

QA Retest (post-merge, on `main`):

- `selective-reset-idb-reliability.spec.js` + `wipe-verify.spec.js` (`--workers=1`): 25/25 Passed.
- Full repository-wide suite (`--workers=1`, 288 tests): 286/288 Passed. The 2 residual failures (`frozen-week-and-chart-year.spec.js`, `CHART-PERIOD-YEAR-AWARE` ×2) are the same pre-existing, independently-confirmed date-boundary chart-range failures already documented under the pre-merge QA Retest — no new failures introduced by the merge.

Outcome:

PASS. Repository state matches governance records. Release verified.

---

INV-008 remediation committed, pushed, and released on `main` (commit `6995a0e`). Superseded as the most recent release by INV-009 (see above).

---

## Test Baseline — 2026-09-03

Command:

`cd tests; PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --workers=1`

Results:

- Total: 340
- Passed: 338
- Failed: 2 — `tests/frozen-week-and-chart-year.spec.js` `CHART-PERIOD-YEAR-AWARE` ×2 (INV-010, Under Investigation)

Matches the counts recorded at the PR #66 merge (338 passed, 2 failed). No regression between `f6a9332` and this baseline.

## Test Baseline — 2026-09-03 (post-INV-010, branch `claude/app-progress-issues-04app5`)

Command: `cd tests; PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --workers=1`, run against the branch at `4df8d59` minus the final comment-only edit.

- Total: 356 (340 at `dd87585` + 8 `img-store-audit` + 8 `img-dhash-index`)
- Passed: 356
- Failed: 0

First full-suite run with no known failures since the suite began being recorded in this ledger.

Post-KI-008 (`7f7c9c8`): 358 total (the two retired `FROZEN-WEEK-TERMINAL-REFRESH` tests replaced by four `KI-008` tests), 358 passed, 0 failed.

Post-INV-011 (branch, on top of `main` `33e6f20`): 367 total (+9 `img-orphan-cleanup`), 367 passed, 0 failed.

Post-IMG-WEEK-KEYING (branch, on top of `main` `0089c71`): 381 total (+11 `img-week-keying`, +3 `img-reattach-archive`). Full run 379 passed, 2 failed — both in `dedup-queue.spec.js`, which seeded the derived `_nwImgByTest` view directly; seeding moved to `_nwImgSets`, spec re-run 13/13. Effective 381 / 381. No `working.html` change between the two runs.

---

## Next Planned Activity

Work the ranked backlog under "Current Priority" in order. No investigation is open and no monitoring item has a pending action. IMG-WEEK-KEYING (DEC-016) is released on `main` `b77f66b`; its one-shot live migration ran 2026-09-03 (13 sets retagged to their week, read-back verified, gate set — see the INV-011 follow-up). Next design item: a "prune image weeks older than N" tool, now that weeks accumulate by design (~171 MB per weekly import on the live profile).

Future investigations should originate from:

- Real-world usage feedback
- Newly discovered defects — including defects found during feature work, which must open an investigation record at the time, not after release (INV-009 lesson)
- Enhancement requests
- Monitoring-item escalation if new evidence emerges

### Repository Hygiene

Date: 2026-08-15

Repository Steward review identified an undocumented test artifact
(`tests/zz-repro.spec.js`) introduced in commit `00b7086`.

Findings:
- Not referenced in governance records.
- Duplicated coverage already provided by `tests/dedup-queue.spec.js`.
- Used deprecated fixed-delay synchronization (`waitForTimeout(2500)`).
- Contained investigation-era debug instrumentation.

Resolution:
- File removed.
- No application defect identified.
- No investigation reopened.

---

### Release Snapshot Capability (DEC-012)

Date: 2026-08-15

The Release Snapshot capability was designed and implemented per DEC-012.

Summary:
- New ledger file `docs/governance/RELEASE_SNAPSHOTS.md` records dated, immutable, point-in-time snapshots of repository state, governance state, investigation state, and test baseline at release closure.
- New automation script `scripts/generate-release-snapshot.mjs` mechanically captures repository-state facts (branch, HEAD, working-tree/sync state) for each new snapshot.
- `RS-001` was generated using the already-released INV-008 as the first reference implementation (release commit `6995a0e`, HEAD `5720adf` at capture time).

This is a documentation/tooling capability only. No `working.html` changes were made and no investigation was reopened.
