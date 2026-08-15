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
