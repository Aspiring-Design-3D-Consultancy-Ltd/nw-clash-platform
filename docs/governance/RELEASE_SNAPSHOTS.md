# Release Snapshots

Status:

Approved

Related Decisions:

- DEC-007
- DEC-009
- DEC-010
- DEC-011
- DEC-012

Related Documents:

- GOVERNANCE_ORCHESTRATOR.md
- WORKFLOW_ROUTING.md
- WORKFLOW_TEMPLATES.md
- CURRENT_STATUS.md
- KNOWN_ISSUES.md
- INVESTIGATION_LOG.md
- CHANGE_LOG.md

---

# Purpose

A Release Snapshot is a dated, immutable, point-in-time record of:

- Repository state (branch, release commit, HEAD at capture time)
- Governance state (active investigations, closed/released investigations,
  monitoring items)
- Investigation state (closure/release status per INVESTIGATION_LOG.md)
- Test baseline (total/passed/failed counts and named known failures)
- Release status (what shipped, at what commit, under what approval)

Unlike CURRENT_STATUS.md, KNOWN_ISSUES.md, and INVESTIGATION_LOG.md — which
are living documents that continue to change after a release — a Release
Snapshot entry is never edited once recorded. It answers "what was true at
release X?" permanently.

See DEC-012 for the governing decision.

---

# File Location

`docs/governance/RELEASE_SNAPSHOTS.md` (this file).

Rationale: a single ledger file, appended to over time, consistent with the
existing pattern already used by `DECISION_LOG.md`, `INVESTIGATION_LOG.md`,
and `CHANGE_LOG.md`. This avoids creating one new file per release and
keeps the governance folder from sprawling.

---

# Naming Convention

Sequential IDs, in the same style as `INV-XXX` / `KI-XXX` / `MI-XXX` /
`DEC-XXX`:

```text
RS-001
RS-002
RS-003
```

Each entry is titled `# RS-XXX: <release / investigation name>` and dated
with the capture date (not necessarily the release date, though they are
usually the same day).

---

# Generation Process

1. **Confirm the release is actually closed.** The related investigation(s)
   must already be in the `Closed` workflow state (DEC-010) with a release
   commit recorded in CURRENT_STATUS.md / INVESTIGATION_LOG.md. Do not
   snapshot a release that is still at the `Release Approved` /
   `Commit / Push Required` decision gate.
2. **Capture repository state.** Run
   `node scripts/generate-release-snapshot.mjs` from the repository root.
   This mechanically fills in:
   - current branch
   - current HEAD commit (full + short SHA, commit date)
   - working tree clean/dirty status
   - whether HEAD matches `origin/<branch>` (ahead/behind/in-sync)
3. **Source governance state from authoritative documents.** Copy/confirm,
   as of capture time, from CURRENT_STATUS.md and KNOWN_ISSUES.md:
   - Active investigations (should normally be "None")
   - Closed/Released investigations (with their release commits)
   - Monitoring items (MI-XXX) and their status
4. **Source test baseline from the most recent QA Retest / Release Manager
   evidence** recorded in INVESTIGATION_LOG.md or CURRENT_STATUS.md (total
   tests, passed, failed, and any named known-failing spec files with their
   root-cause classification).
5. **Fill the template below** and append it to this file as the next
   `RS-XXX` entry. Do not edit prior entries (Rule 2, DEC-012).
6. **Cross-check** that the recorded release commit appears in `git log`
   on the recorded branch, and that CURRENT_STATUS.md / KNOWN_ISSUES.md /
   INVESTIGATION_LOG.md agree with the snapshot at the time of capture.
7. **Stop at the human decision gate** if repository evidence cannot be
   confirmed (DEC-009 "Insufficient Evidence" / "Repository State
   Validation Required").

---

# Template

```text
# RS-XXX: <Release / Investigation Name>

Date Captured:

YYYY-MM-DD

## Repository State

Branch:

Release Commit:

Current HEAD (at capture time):

Working Tree:

Clean / Dirty

Sync State:

In sync with origin / Ahead by N / Behind by N

## Governance State

Active Investigations:

None / <list>

Closed - Released Investigations:

- INV-XXX — <title> (commit <sha>)

Monitoring Items:

- MI-XXX — <title> — <status>

## Investigation State

<Summary of investigation closure status per INVESTIGATION_LOG.md at
capture time.>

## Test Baseline

Total Tests:

Passed:

Known Failures:

- <spec file> — <root-cause classification / related MI or KI>

## Release Status

Released Commit:

Release Approval Reference:

Status:

Closed / Released

## Notes

<Anything relevant that does not fit the above sections.>
```

---

# Automation

`scripts/generate-release-snapshot.mjs` automates Step 2 of the Generation
Process only (repository-state facts). It intentionally does **not**
auto-populate governance state, investigation state, or test baseline —
per DEC-012 Rule 3, those must be sourced from the authoritative governance
documents by a human/AI operator, not inferred by a script.

Usage:

```bash
node scripts/generate-release-snapshot.mjs
```

Output: a partially-filled snapshot block (repository-state fields only,
governance/test fields left as `<FILL: ...>` placeholders) printed to
stdout, ready to be completed and appended to this file.

## Future Automation Path

Potential future enhancements (not implemented; recorded here so future
sessions do not need to re-derive them):

- Have the script read CURRENT_STATUS.md's "Active Investigation Status"
  and "Known Issues" sections directly and pre-fill the governance-state
  fields, subject to human/AI confirmation before the entry is finalized.
- Have the script parse the most recent Playwright run's JSON reporter
  output (if the project adopts one) to pre-fill the test-baseline fields
  automatically instead of requiring manual transcription from
  INVESTIGATION_LOG.md.
- Invoke the script from a Release Manager / Release Engineer governance
  stage as a standard exit-criteria step once a release reaches the
  `Closed` workflow state (DEC-010), rather than being run ad hoc.
- Add a `--append` flag that writes the completed entry directly into this
  file instead of only printing to stdout.

None of the above are required for RS-001 and are deferred consistent with
DEC-008 (avoid speculative governance-documentation expansion).

---

# Snapshot Log

## RS-001: INV-008 IndexedDB Reset Reliability Investigation

Date Captured:

2026-08-15

### Repository State

Branch:

main

Release Commit:

`6995a0e` — Merge branch 'repo-hygiene-remove-zz-repro' into main (INV-008 release)

Current HEAD (at capture time):

`5720adf` — chore: stamp build 96b0b0b [skip ci]

Note: HEAD is ahead of the release commit because two automated
post-release commits landed on `main` after `6995a0e`: `4f86e0b` (build
stamp for `6995a0e`) and `96b0b0b` (INV-008 release/closure documentation
commit), followed by `5720adf` (build stamp for `96b0b0b`). No further
functional changes occurred between the release commit and HEAD — see
INVESTIGATION_LOG.md "INV-008 Final Release Verification" for the
post-merge verification evidence.

Working Tree:

Clean

Sync State:

In sync with origin (`origin/main` = `5720adf`)

### Governance State

Active Investigations:

None

Closed - Released Investigations:

- INV-002 — closeApp() Whitelist Drift (commit `680cfd5`)
- R1 — Data Resurrection After Reset (commit `a0526bf`)
- INV-005 — Migration Gate / Persistence Write Divergence Remediation (commit `3f37f72`)
- INV-006 — Residual Migration Gate / Persistence Divergence Risk Assessment (commit `136c397`)
- INV-007 — Test Timing Sensitivity (commit `b471e5c`)
- INV-008 — IndexedDB Reset Reliability Investigation (commit `6995a0e`)

Monitoring Items:

- MI-001 — Migration Complexity — Monitoring (all five tracked one-shot
  migration flags verified defect-free via INV-003/INV-005/INV-006)
- MI-002 — Test Timing Sensitivity — Remediated (root cause resolved under
  INV-007/KI-005; the residual IndexedDB-timing subset separately tracked
  under INV-008 has since also been remediated and released, see KI-006)

### Investigation State

All investigations opened to date (INV-002, R1, INV-005, INV-006, INV-007,
INV-008) are in the `Closed` workflow state (DEC-010) with release commits
recorded in INVESTIGATION_LOG.md. No investigation remains open at any
workflow state. INV-008 is the most recently closed investigation and is
the basis for this snapshot.

### Test Baseline

Total Tests:

288

Passed:

286

Known Failures:

- `tests/frozen-week-and-chart-year.spec.js` (`CHART-PERIOD-YEAR-AWARE` ×2)
  — pre-existing, date-boundary-dependent chart-range flakiness,
  independently reproduced on the unmodified baseline via `git stash`
  (confirmed under INV-008 QA Retest; unrelated to the INV-008 fix).

### Release Status

Released Commit:

`6995a0e`

Release Approval Reference:

INVESTIGATION_LOG.md — INV-008 Repository Steward Review + Release Manager
Approval; CURRENT_STATUS.md — "INV-008 Final Release Verification" (PASS,
2026-08-15).

Status:

Closed / Released

### Notes

This is the first Release Snapshot produced under DEC-012, using the
already-completed and already-released INV-008 as the reference
implementation. No new repository or governance changes were introduced by
producing this snapshot; it is a documentation-only capture of state that
was already true.

---

## RS-002: INV-009 ORPHAN-IDB-SWEEP Data-Loss Race (Retrospective Release Record)

Date Captured:

2026-09-03

### Repository State

Branch:

main (release); snapshot captured on `claude/app-progress-issues-04app5`, which is `main` (`dd87585`) plus the governance catch-up commit `5c9f6df`. No `working.html` change exists between `dd87585` and the capture HEAD.

Release Commits:

- `9a0007e` — Stop ORPHAN-IDB-SWEEP deleting the DB under the in-flight migration (IDB-RECORDS-VERIFY-RACE) (#64), 2026-08-26
- `d996b8d` — Delete verified originals before writing the migration gate (IDB-RECORDS-GATE-QUOTA) (#65), 2026-08-26
- `43705e0` — Re-attach images from an archive folder (IMG-REATTACH-ARCHIVE) (#66), merged via `f6a9332`, 2026-09-02

Also released since RS-001 and covered by this snapshot's test baseline (not investigations; recorded in CHANGE_LOG.md): `7c91beb` (#59), `9117ae2` (#60), `161894f` (#61), `2860f51` (#62, docs), `ef3d620` (#63).

Current HEAD (at capture time):

`5c9f6df` (`5c9f6dfd324818d5c220cb0da2f6254e497e2edc`) — docs: governance ledger catch-up for PRs #59-#66 (INV-009 retrospective, INV-010 opened) (2026-09-03)

Note: HEAD is ahead of the last release commit by the automated build stamp `dd87585` (for `f6a9332`) and the documentation commit `5c9f6df`. Neither touches `working.html`.

Working Tree:

Clean

Sync State:

Branch not yet pushed at capture time (no upstream configured); `main` in sync with `origin/main` at `dd87585`.

### Governance State

Active Investigations:

- INV-010 — Persistent CHART-PERIOD-YEAR-AWARE Failures in frozen-week-and-chart-year.spec.js — Under Investigation (opened 2026-09-03)

Closed - Released Investigations:

- INV-002 — closeApp() Whitelist Drift (commit `680cfd5`)
- R1 — Data Resurrection After Reset (commit `a0526bf`)
- INV-005 — Migration Gate / Persistence Write Divergence Remediation (commit `3f37f72`)
- INV-006 — Residual Migration Gate / Persistence Divergence Risk Assessment (commit `136c397`)
- INV-007 — Test Timing Sensitivity (commit `b471e5c`)
- INV-008 — IndexedDB Reset Reliability Investigation (commit `6995a0e`)
- INV-009 — ORPHAN-IDB-SWEEP Deletes the Image Database Under the In-Flight Register Migration (commits `9a0007e`, `d996b8d`, `43705e0`; retrospective record)

Monitoring Items:

- MI-001 — Migration Complexity — Monitoring (scope widened 2026-09-03: `idbRecordsMigrated` gate and the routed `sv()` write path)
- MI-002 — Test Timing Sensitivity — Remediated (INV-007 / KI-005; IndexedDB subset INV-008 / KI-006)
- MI-003 — Orphaned IndexedDB Image Records — Monitoring, read-only audit required before any action

Confirmed Issues:

- KI-008 — Frozen-Week Terminal Refresh Double-Count — Confirmed, Deferred

### Investigation State

INV-009 is `Closed` (DEC-010) with release commits recorded, but its record was written after release rather than progressing through the workflow states at the time — see INVESTIGATION_LOG.md INV-009 "Governance Observation". INV-010 is in `Under Investigation` (State 2) with no remediation proposed yet. All earlier investigations remain `Closed`.

### Test Baseline

Command:

`cd tests; PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --workers=1` (Playwright 1.62.1, Chromium from the sandbox's system install), run against `working.html` at `dd87585` on 2026-09-03.

Total Tests:

340

Passed:

338

Known Failures:

- `tests/frozen-week-and-chart-year.spec.js` (`CHART-PERIOD-YEAR-AWARE` ×2) — INV-010, Under Investigation. Identical to the failures recorded at every release since RS-001 (286/288 at `6995a0e`; 307, 322, 326, 330, 338 passed at #61, #63, #64, #65, #66 respectively, each with these same 2 failures). No longer classified as flakiness.

New coverage since RS-001: 52 tests across `img-batch-backpressure` (5), `storage-write-guard` (5), `img-dhash-phase1` (11), `idb-records-migration` (23), `img-reattach-archive` (8).

### Release Status

Released Commits:

`9a0007e`, `d996b8d`, `43705e0` (via `f6a9332`) on `main`.

Release Approval Reference:

Pull-request diff review and merge by the repository owner (#64 2026-08-26, #65 2026-08-26, #66 2026-09-02). INVESTIGATION_LOG.md INV-009 "Final Release Status"; CURRENT_STATUS.md "INV-009 (Closed - Released — retrospective record)".

Status:

Closed / Released

### Notes

This snapshot was produced 8 days after the last release commit and 1 day after the recovery tool merged, as part of the 2026-09-03 governance catch-up, because no snapshot was taken at release time. The repository-state block was captured mechanically with `scripts/generate-release-snapshot.mjs RS-002`; governance, investigation and test-baseline fields were sourced from CURRENT_STATUS.md, KNOWN_ISSUES.md and INVESTIGATION_LOG.md as updated in `5c9f6df`, and from the full-suite run recorded there. Protected blocks `REVIEW-QUEUE-DETECT` (`54db97511c97f7ad`) and `APPROVE-TERMINAL-STATUS-FILTER` (`c1173153c15dba7b`) were verified `UNCHANGED` against `origin/main` at capture.
