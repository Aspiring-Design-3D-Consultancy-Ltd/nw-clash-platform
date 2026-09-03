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