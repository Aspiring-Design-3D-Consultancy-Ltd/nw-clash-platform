# Decision Log

## Purpose

This document records significant project decisions.

The objective is to preserve the reasoning behind major governance, architectural, testing, and process decisions so that future contributors and AI assistants understand not only what was decided, but why.

---

# Decision Status Types

- Proposed
- Approved
- Superseded
- Retired

---

# DEC-001

Title:

Role-Based Workflow (Option A)

Status:

Approved

Date:

2026

Decision:

Adopt a role-based engineering workflow rather than autonomous AI agents.

Roles:

- Project Analyst
- Architect
- QA Investigator
- Developer
- Environment Steward
- Repository Steward
- Implementation Manager
- Release Manager

Reasoning:

- Improves separation of responsibilities.
- Reduces speculative fixes.
- Encourages evidence-driven investigations.
- Creates repeatable governance processes.
- Easier to validate and refine than autonomous-agent workflows.

Impact:

All development activities follow the defined role sequence.

---

# DEC-002

Title:

Repository as Primary Source of Project Memory

Status:

Approved

Date:

2026

Decision:

Store project knowledge within the repository rather than relying on AI conversation history.

Primary locations:

- .cline/
- docs/governance/

Reasoning:

- Supports multiple laptops.
- Supports multiple AI accounts.
- Supports multiple AI tools.
- Preserves project knowledge over time.
- Reduces dependence on chat history.

Impact:

Important project information should be documented in repository files.

---

# DEC-003

Title:

Governance Validation Before Major Development

Status:

Approved

Date:

2026

Decision:

Validate the governance framework before commencing significant bug-fix or enhancement work.

Reasoning:

- Confirms role boundaries.
- Verifies investigation workflow.
- Identifies governance gaps early.
- Establishes repeatable development practices.

Impact:

Role validation is performed before broader implementation work.

---

# DEC-004

Title:

Repository-First AI Bootstrapping

Status:

Approved

Date:

2026

Decision:

AI sessions should begin by loading governance documentation from the repository.

Primary sources:

- .cline/bootstrap.md
- .cline/roles/*
- docs/governance/*

Reasoning:

- Consistent behaviour across AI sessions.
- Portable between environments.
- Reduced reliance on AI memory.

Impact:

New AI sessions can reconstruct project understanding directly from repository documentation.

---

# DEC-005

Title:

Investigation Before Implementation

Status:

Approved

Date:

2026

Decision:

No production changes should be implemented without investigation and verification.

Required stages:

- Problem understanding
- Architectural assessment
- Evidence collection
- Validation
- Implementation review

Reasoning:

- Reduces regressions.
- Reduces speculative changes.
- Improves confidence in fixes.

Impact:

Development work should not bypass investigation stages.

---

# DEC-006

Title:

Governance Framework v1 Validation

Status:

Approved

Date:

2026

Decision:

Governance Framework v1 is considered validated after successful execution of all defined roles against a real-world investigation.

Validation investigation:

- INV-002
- closeApp() Whitelist Drift

Validated roles:

- Repository Steward
- Environment Steward
- Project Analyst
- Architect
- QA Investigator
- Developer
- Implementation Manager
- Release Manager

Reasoning:

A real defect investigation was used to exercise every governance role from discovery through release assessment.

The workflow successfully:

- Identified a defect.
- Assessed architectural risk.
- Independently verified evidence.
- Produced implementation planning.
- Applied implementation review.
- Applied release governance.

Role boundaries were respected throughout the validation process.

Additional governance gaps identified during validation were incorporated back into repository documentation.

Impact:

Governance Framework v1 becomes the approved project workflow.

Future investigations and development efforts should follow the documented governance process unless superseded by a future decision.

---

# DEC-007

Title:

Repository Documentation is Authoritative Workflow State

Status:

Approved

Date:

2026

Decision:

Governance workflow state must be reflected in repository documentation before subsequent governance stages may rely on it.

Primary documents:

- CURRENT_STATUS.md
- INVESTIGATION_LOG.md
- KNOWN_ISSUES.md

Reasoning:

Governance validation identified situations where completed workflow activities were not reflected in project records.

This created differences between:

- Actual workflow state
- Recorded workflow state

Several governance reviews correctly reported stages as incomplete because repository records had not yet been updated.

Impact:

Completion of major workflow stages should be recorded before subsequent governance reviews are performed.

Repository documentation remains the authoritative project record.

---

# DEC-008

Title:

Governance Framework Maintenance Strategy

Status:

Approved

Date:

2026

Decision:

Focus on using the governance framework rather than continuously expanding governance documentation.

Reasoning:

The project now contains:

- Governance roles
- Workflow definitions
- Project context
- Investigation history
- Architecture documentation
- Decision history
- Testing strategy
- Working agreements
- Startup procedures

Further expansion of governance documentation should occur only when a genuine process gap is discovered.

Impact:

Future effort should prioritize:

- Investigations
- Development
- Testing
- Project delivery

Governance documentation should evolve through practical use rather than speculative expansion.

---

DEC-009 through DEC-012 are recorded in dedicated files in this directory
(`DEC-009-GOVERNANCE-AUTOMATION.md`, `DEC-010-WORKFLOW-STATE-AUTOMATION.md`,
`DEC-011-CONFIRMED-DEFECT-REMEDIATION.md`, `DEC-012-RELEASE-SNAPSHOT.md`) rather
than inline here.

---

# DEC-013

Title:

Protected-Region Invariant Gate — Corrected Fingerprints and Stated Algorithm

Status:

Approved

Date:

2026-08-26

Decision:

The invariant gate protecting marker blocks in `working.html` is a direct byte
comparison of each protected block against the same block on `origin/main`.
Fingerprints are recorded alongside as human-readable summaries, computed as
sha256 over the extracted block, truncated to the first 16 hex characters.

Corrected fingerprints, recorded at commit `161894f`:

- REVIEW-QUEUE-DETECT: `54db97511c97f7ad`
- APPROVE-TERMINAL-STATUS-FILTER: `c1173153c15dba7b`

These supersede the previously circulated values `61bcb46de6148f06` and
`b968bca42c93b2be`.

Procedure, algorithm, failure handling and the process for adding a region are
recorded in `PROTECTED_REGIONS.md`.

Reasoning:

During review of PR #61 (IMG-DHASH-PHASE1) the brief required both blocks to be
byte-identical and quoted the two fingerprints above. Neither value could be
reproduced by sha256 or sha1 over either block, and no algorithm was recorded
with them. Their origin is unknown — most likely a truncated or differently
scoped digest from an earlier session.

The consequence was that the gate could not be executed as specified. Byte
comparison against `origin/main` was substituted, and both blocks were confirmed
unchanged, but an invariant gate that cannot be run is not a gate.

A fingerprint alone also cannot establish that a region is unchanged relative to
a moving base; only comparison against that base can. The corrected gate
therefore performs the comparison and reports the fingerprint, rather than
relying on the fingerprint alone.

This expansion of governance documentation is consistent with DEC-008: a genuine
process gap was discovered through practical use rather than anticipated
speculatively.

Impact:

Briefs declaring a protected region should reference `PROTECTED_REGIONS.md`
rather than quoting fingerprints inline. Fingerprints in that document are
updated only in the same commit as an approved, reviewed change to a protected
block, never to make a failing gate pass.

Related Investigations:

PR #61 — PIXEL-DEDUP Phase 1 (IMG-DHASH-PHASE1), commit `161894f`

Related Issues:

None.

---

# DEC-014

Title:

PIXEL-DEDUP Hash Storage — Record Stays Authoritative, Referenced-Slot Index Rides on the Metadata Block

Status:

Approved (decided and delivered 2026-09-03; surfaced for spot-check per Working Preference 5)

Date:

2026-09-03

Decision:

The dHash written by IMG-DHASH-PHASE1 stays on each image record (`{b64, dhash}`) as the authoritative value. A derived index of `idx -> dhash` for the slots the current `byTest` ranges reference is kept in memory (`_dhashIndex`) and serialised into the existing metadata record at key 0 as `dhashByIdx`. It is written by `loadNwImages` (which already writes that record at the end of every load) and by `_dhashBackfill` (one write per pass, only when it indexed something). Orphaned slots are never indexed. Consumers read through `_dhashIndexGet()` / `findSimilarImages()` and fall back to the record for a slot the index does not cover.

Options considered:

- A — hash-on-record only (as shipped). Every bulk read of hashes is a full read of every image payload. `_dhashBackfill` was already paying this on every launch, including for the ~60k orphaned records on the live profile (MI-003).
- B — sidecar `dh:` keys in the images store. Rejected in PR #61 and still rejected: non-numeric keys change what `idbGetAllKeys()` returns, break the key-count assertions, and would show up as `nonNumericKeys` in the IMG-STORE-AUDIT report.
- C — index on the metadata record (chosen). No new keys, no schema bump, bounded by the live image count rather than the store size, and the backfill can skip payload reads for indexed slots.
- D — a fourth object store keyed by idx (DB version 3→4). Cleanest in schema terms but touches `openIDB`'s upgrade path and every wipe/verify/clear store list — PR #63 found exactly that class of bug (pinned versions and incomplete store lists) and INV-009 was its consequence. Not worth the blast radius for a 16-byte-per-image cache.

Reasoning:

The cost that mattered was per-launch and per-consumer full-payload reads, not the size of a hash. The metadata record is already the single place `initNwImages` reads to know what images exist; carrying the hashes there means one read yields every hash the app can use, and a re-loaded test prunes its stale slots for free because the same write that replaces `byTest` replaces the index. Making the record authoritative and the index a rebuildable cache keeps Phase 1's storage shape and its regression suite intact: the "metadata untouched" guarantee still holds for a store with no `byTest` ranges, and the backfill still hashes every numeric key.

Impact:

- `working.html`: IMG-DHASH-INDEX marker (3 regions) plus one-line annotated insertions in `initNwImages`, `loadNwImages`, `clearNwImageStore`, the ORPHAN-IDB-SWEEP clear path, and `_dhashBackfill`. `_dhashBackfill` gains an `indexed` count.
- Metadata record grows by roughly 30 bytes per referenced image (~110 KB at 3,670 images).
- The Dedup Queue, thresholds and any UI are untouched. The consumer half of PIXEL-DEDUP Phase 2 (what a near-duplicate image means for two clashes, and where that is surfaced) needs its own brief before it is built; `findSimilarImages(maxDistance)` is the read API it will call.
- Regression protection: `tests/img-dhash-index.spec.js`.

Related Investigations:

None. MI-003 (orphaned records) is why orphans are excluded from the index.

Related Issues:

PR #61 — PIXEL-DEDUP Phase 1 (IMG-DHASH-PHASE1), commit `161894f`, "Two decisions worth your attention", item 1.

---

# DEC-015

Title:

Weekly Snapshot Counters Are a Projection at End of Week — FROZEN-WEEK-TERMINAL-REFRESH Retired

Status:

Approved (Shane's ruling, 2026-09-03: KI-008 option 1)

Date:

2026-09-03

Decision:

Every weekly snapshot row in `S.weekly`, frozen or not, counts each clash in its detection-week bucket exactly once, at the status the clash held at the end of that ISO week (`clashStatusAt(c, wk, yr)`; fallback to the first recorded status, then `c.status`, when the history starts after the bucket week). Priority counters and the per-test `tests[]` rows follow the same rule. `FROZEN-WEEK-TERMINAL-REFRESH` is retired. "Frozen" (`capturedAt`) now means the row's archived fields — `capturedAt`, `imports[]`, `label`, `date` and anything else stored on it — are preserved; its status and priority counters are derived from the register on every regeneration.

Options considered (KNOWN_ISSUES.md KI-008):

1. Projection everywhere — chosen.
2. Keep TERMINAL-REFRESH, recompute the Data Manager rate and the week-over-week tiles from `statusCountsAt()` — rejected: the stored fields stay internally inconsistent.
3. Accept and document — rejected.

Reasoning:

TERMINAL-REFRESH existed to make approvals of old clashes visible on the trend chart. Since PR-A-ALWAYS-RECONSTRUCT and PR-A3-EXPORT-PLATFORM-WEEKS the charts and the PDF/PPTX tables reconstruct cumulative status per week from `statusHistory` and never read the stored counters, so that symptom cannot recur through them, and today's approval of an old clash already shows on the current week's cumulative point. What remained was a stored row in which one clash sat in two columns, surfacing as an inflated maturity rate in the Data Manager table. A single projection rule removes the inconsistency at the source and makes the stored snapshot agree with everything that displays it.

Consequences accepted:

- A frozen week's counters no longer archive the register as it was at freeze time. A clash later removed from the register (per-week reset, dedup merge) drops out of that week's row, exactly as it already does on the charts.
- An unfrozen past week whose clash was approved later now shows that clash at its end-of-week status, not its current one.
- The two `FROZEN-WEEK-TERMINAL-REFRESH` tests were replaced by four `KI-008` tests in `tests/frozen-week-and-chart-year.spec.js` asserting the new contract.

Impact:

- `working.html`: `KI-008-WEEKLY-PROJECTION` (1 region) inside `regenWeeklyFromRegister`, replacing the frozen-week branch and the unfrozen rebuild with one path. Comment header of `WEEKLY-SNAP-PER-CLASH-BUCKET` updated. No other function touched.
- Full suite green after the change (see CURRENT_STATUS.md test baseline).

Related Investigations:

None.

Related Issues:

KI-008 (Resolved by this decision).

---

# DEC-016

Title:

Image Sets Keyed by Test and Week (IMG-WEEK-KEYING, Option A)

Status:

Approved (Shane, 2026-09-03: Option A; Stage 1 evidence report accepted with both surfaced decisions)

Date:

2026-09-03

Decision:

Stored clash images are keyed by `(testName, weekTag)`. Each weekly load of a test is its own slot range (a "set"); a clash resolves its image through the set for its own `weekTag` when one exists — and only that set, so a file missing from the right week renders the placeholder rather than a neighbouring week's viewport — and falls back to the test's latest set only when its week has no set (legacy and untagged clashes). Same-week re-loads supersede that week's set; different weeks accumulate by design.

Sub-decisions:

1. The latest set per test is chosen by week **date** (`_parseWeekDate` order), never by load order; an untagged set is latest only when no tagged set exists. Re-attaching an older week can never make it the fallback.
2. A load with no valid `week-YYMMDD` tag (the Load NWC Images modal, paste imports) goes into the test's current latest set, so that path keeps replacing "the test's images" exactly as before.
3. The archive re-attach tool derives the week from the picked folder with the same helper the importer and both parsers use, and refuses a pick whose top folder is not a `week-YYMMDD` wrapper rather than guessing. Same parent-folder convention as the weekly import.
4. Metadata stays `shape:'imgfix-v1'` with `sets` and `latest` added. `byTest` is kept as the derived latest-per-test view, so an older build reading the store behaves as it always did and the twelve existing readers of `_nwImgByTest` are untouched.
5. "Referenced" — for the audit, the orphan cleanup, the dHash index and the INV-011 superseded-slot deletion — means the union of every set's range. Older weeks are never orphans.
6. Migration of a pre-change store is additive and manual from the console (`_imgWeekKeyingMigrate()`, dry run by default): each set synthesised from `byTest` is retagged to the latest `weekTag` among register clashes with that raw test name, written, read back and byte-compared, then gated by `nw:imgWeekKeyingMigrated`. No slot moves and nothing is deleted.

Reasoning:

INV-011 ruling 3: `byTest` held one range per report name, so a clash last observed in W33 resolved its renumbered filename against the W36 set. Keying by week is the only shape that makes that lookup correct without re-importing history. Keeping `byTest` as a derived view and adding fields rather than bumping the shape confines the change to the image layer and preserves downgrade safety. Storage grows by one weekly set per import (about 4,768 records, 171 MB on the live profile); a "prune weeks older than N" tool is a separate future item now that the orphan cleanup respects every week.

Impact:

- `working.html`: marker `IMG-WEEK-KEYING` (3 regions: helpers and in-memory model; `loadNwImages`; migration), `IMG-REATTACH-ARCHIVE` second region (week derivation and refusal), plus single-line annotated insertions in `initNwImages`, the three lookup functions, the clash-detail label, `clearNwImageStore`, the ORPHAN-IDB-SWEEP clear path, the classifier, `_dhashIndexReferencedSlots`, `findSimilarImages` and both `importFolderPick` call sites. `loadNwImages(files, testName, weekTag)` gains an optional third argument; result gains `weekTag`.
- Tests: `tests/img-week-keying.spec.js` (11); `tests/img-reattach-archive.spec.js` +3; three specs that seeded the derived view directly now seed sets.
- Live profile: run `await _imgWeekKeyingMigrate()` then `{dryRun:false}` once after deploy; record the output in INVESTIGATION_LOG.md INV-011 follow-up.

Related Investigations:

INV-011 (ruling 3).

Related Issues:

None.

---

# DEC-017

Title:

Client Deployment Path (Option A sidecar package now; Option C Supabase as target)

Status:

Approved as design direction (Shane, 2026-09-04). **Build not authorised** — Option A implementation waits on Shane's answer on the client's shape (how many users, view-only or edit).

Date:

2026-09-04

Decision:

External client users get the app via a sidecar package (`working.html` + `ClashPlatform_Package_<week>.zip`) loaded from the auth screen, per `docs/design/CLIENT_DEPLOYMENT_DESIGN.md` Section 2. A hosted multi-user build, if ever needed, is Supabase-backed with Autodesk Platform Services as a later viewer add-on only (Section 4).

Sub-decisions:

1. Sidecar zip, not embedded HTML (paper 2.1).
2. Client role defaults to Viewer; Project Manager on request; Manager only behind a prominent, blocking "edits are local and will be overwritten" acknowledgement at sign-in (`CLIENT-PACKAGE-MANAGER-WARN`, paper 2.6).
3. Weekly package carries the full register and the latest week's images only; a full onboarding package is used for first delivery (paper 2.3).
4. The importer accumulates image sets per week (DEC-016 semantics) and offers an explicit replace-all mode (paper 2.7).
5. Supabase over APS for the hosted option; APS as a viewer add-on only (paper 4.1).
6. No merge of client edits back into the master register in the first ship (A2 deferred), subject to sub-decision 2's warning (paper 2.6).
7. Help-text corrections at lines 15777 and 15891–15895 are punch-list items for the session that owns `working.html` (paper 7a), not part of any feature PR.

Reasoning:

Every option was measured against the source at `1510f82`: the only state export is Backup JSON (register only), a second user is seeded with the demo as Administrator, and SharePoint is a file transport with per-profile browser storage. The sidecar package reuses the shipped JSON restore and archive re-attach paths, ships in days, and its format becomes the hosted option's seed importer, so it is not throwaway.

Impact:

- No code change from this decision. When a build is authorised, the paper's Section 2.8 is the implementation brief (markers `CLIENT-PACKAGE-EXPORT`, `-IMPORT`, `-AUTH`, `-MANAGER-WARN`, `-STAMP`).
- KI-011 raised from the same paper (plaintext `nw:apikey`); its fix is queued separately as KI-011-FIX.

Related Investigations:

None.

Related Issues:

KI-011.

---

# Future Decisions

Record future decisions using the following structure:

## DEC-XXX

Title:

Status:

Date:

Decision:

Reasoning:

Impact:

Related Investigations:

Related Issues: