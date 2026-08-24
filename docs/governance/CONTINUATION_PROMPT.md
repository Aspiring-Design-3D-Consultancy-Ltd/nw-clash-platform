# Continuation Prompt — Session Handoff

Purpose:

A self-contained briefing that lets a new AI session (any tool, any account,
any machine) resume work on this repository without relying on chat history.

Consistent with DEC-002 and DEC-004: the repository, not the conversation,
is the authoritative source of project knowledge. Chat history is disposable;
this file is not.

Captured:

2026-08-24

Captured At:

Branch `claude/continuation-prompt-template-1nlln5`, HEAD `1d92cca`
(identical tree to `origin/main` `1d92cca` at capture time).

How to use:

Paste "Part 1 — Continuation Prompt" below into a new session verbatim, or
tell the session to read this file. Part 2 records the verification evidence
behind Part 1's claims. Part 3 is the blank template for producing the next
handoff.

---

# Part 1 — Continuation Prompt (paste this)

You are continuing work on the **Navisworks Clash Intelligence Platform**
(`Aspiring-Design-3D-Consultancy-Ltd/nw-clash-platform`).

## 1. What the product is

- Single-file HTML/CSS/JS application: `working.html` at the repository root.
- Parses Navisworks Clash Detective XML exports, manages the clash review
  workflow, and produces PPTX / PDF / BCF / CSV outputs.
- Deployed by copying `working.html` into a SharePoint-synced folder
  (`deploy.bat` is referenced by CLAUDE.md for this; see the drift note in
  §9 — it is not currently present in the repository). Users open it locally
  in Chrome/Edge, from `file://`. There is no backend and no build step.
- Persistence is client-side only: `localStorage` (`nw:*` keys) plus
  IndexedDB (`NWClashImages` database, `images` and `plans` object stores).
- Owner: Shane (BIM Space Planning Manager, Exyte Ireland). ESMC project,
  Muratec AMHS scope, Dresden.

## 2. Non-negotiable constraints

- **Single file.** Do not split `working.html` into modules or add a build
  pipeline.
- **`DATA_VERSION = 'v4-correct-dates-jan25'` must never be bumped.** Bumping
  it triggers an auto-reset of every user's stored data on next load.
- **Dual-parser discipline.** There are two XML parsing paths. Any parsing
  change must be evaluated against BOTH. Missing this previously caused an
  image-matching regression.
- **Minified library blobs live on lines 13/19 (Chart.js) and 34 (JSZip).**
  Exclude them from greps and never run `node --check` against the raw file —
  extract the app script blocks first.
- **PptxGenJS is loaded from CDN** (cdnjs, with jsdelivr and unpkg fallbacks)
  on line 361. This is a known, accepted deviation from the "no external
  dependencies" preference, because inlining it would add ~700 KB to a
  rarely-used export path. If a deployment target has restricted egress,
  verify CDN reachability before shipping. Inlining it is a separate future
  task, not in scope for incidental work.
- **No new persistence layers.** `localStorage` + IndexedDB only.
- **Building taxonomy is FAB, BSGS, CUP — and nothing else.** The Central
  Utility building is **CUP**, never CUB. Older partner exports arrive with
  `CUB_*` prefixes; group those under CUP as the canonical display label.
  `_migrateCUBtoCUP()` exists; the IndexedDB key rewrite is still pending.

## 3. Edit discipline

Every meaningful code change is wrapped in a named marker pair:

```js
/* MARKER-NAME start: brief explanation of what and why */
// ...code...
/* MARKER-NAME end */
```

After every edit, run a marker balance check and confirm each marker is N/N:

```bash
python3 - <<'PY'
import re, collections
src = open('working.html', encoding='utf-8', errors='replace').read()
starts = collections.Counter(re.findall(r'(?:/\*|<!--)\s*([A-Z0-9][A-Z0-9-]{2,})\s+start', src))
ends   = collections.Counter(re.findall(r'(?:/\*|<!--)\s*([A-Z0-9][A-Z0-9-]{2,})\s+end',   src))
bad = {n: (starts[n], ends[n]) for n in set(starts) | set(ends) if starts[n] != ends[n]}
print('imbalanced:', bad or 'none')
PY
```

Baseline as of this handoff: **192 marker names, 0 imbalanced.** Any
imbalance you see is therefore yours — stop and fix it before continuing.

## 4. Governance framework — this is binding

The repository runs a role-based governance framework. Read before acting:

- `.cline/bootstrap.md` and `.cline/roles/*` (8 role definitions)
- `docs/governance/GOVERNANCE_ORCHESTRATOR.md` — entry point, classification,
  automatic role progression, stop-at-decision-gates rule
- `docs/governance/WORKFLOW_ROUTING.md` — Workflows A–H and their stages
- `docs/governance/WORKFLOW_TEMPLATES.md` — per-role output templates
- `docs/governance/CURRENT_STATUS.md`, `KNOWN_ISSUES.md`,
  `INVESTIGATION_LOG.md` — authoritative live state
- `docs/governance/DECISION_LOG.md` (DEC-001…DEC-008) plus the standalone
  files `DEC-009-GOVERNANCE-AUTOMATION.md`,
  `DEC-010-WORKFLOW-STATE-AUTOMATION.md`,
  `DEC-011-CONFIRMED-DEFECT-REMEDIATION.md`,
  `DEC-012-RELEASE-SNAPSHOT.md`
- `docs/governance/RELEASE_SNAPSHOTS.md` (RS-001 recorded), `TESTING_STRATEGY.md`,
  `WORKING_AGREEMENTS.md`, `AI_STARTUP_CHECKLIST.md`, `PROJECT_CONTEXT.md`,
  `ARCHITECTURE_OVERVIEW.md`, `CHANGE_LOG.md`

Roles, in workflow order: Project Analyst → Architect → QA Investigator →
Environment Steward (when required) → Developer → QA Retest →
Implementation Manager → Repository Steward → Release Manager.

Rules that bite in practice:

- **Investigation before implementation** (DEC-005). Do not fix what has not
  been reproduced and root-caused.
- **Role boundaries** — the Project Analyst does not propose fixes, the
  Architect does not write code, the QA Investigator does not design
  solutions, the Developer does not speculate on root causes.
- **Human decision gates.** Workflow A/B/G stop at "Implementation Required"
  before any code is written, and again at "Commit / Push Required" before
  anything is pushed. Do not walk through a gate on your own authority.
- **DEC-011:** once a defect is reproducible, root-caused, and has a feasible
  remediation path, "Do Nothing" / "Monitor Only" / "Accept the Risk" are
  **not** acceptable primary recommendations. Produce a preferred corrective
  action, viable alternatives with trade-offs, and a recommended path.
- **DEC-007:** record workflow state in the governance documents *before* the
  next stage relies on it. Repository documentation is the workflow state.
- **DEC-012:** after an investigation closes with a release commit, generate a
  Release Snapshot (`node scripts/generate-release-snapshot.mjs` for the
  repository facts, governance/test fields copied — never invented — from the
  living documents). It is a documentation step, not a release gate. Never
  edit a prior RS entry.
- **Scope control:** a new defect discovered mid-investigation opens a *new*
  investigation. Do not widen the current one.

## 5. Where the project actually stands

**No active investigations. No confirmed outstanding defects.** All six
investigations opened to date are Closed / Released:

| ID | Title | Release commit |
|---|---|---|
| INV-002 | `closeApp()` whitelist drift (allow-list → `DEFUNCT_KEYS` removal-list) | `680cfd5` |
| R1 | Data resurrection after reset (in-memory `S.*` sync on `clearAll()` / `_executeSelectiveReset()`) | `a0526bf` |
| INV-005 | Migration gate / persistence write divergence — review-queue migrations | `3f37f72` |
| INV-006 | Same defect class in `dedupInitialScan` + `reviewQueueDeltaAnalysisMigrated` (Option C: throwing write scoped to the two one-shot wrappers only) | `136c397` |
| INV-007 | Test timing sensitivity — test-harness synchronization gap, test-file-only fix across 28 specs | `b471e5c` |
| INV-008 | IndexedDB reset reliability — `openIDB()` check-then-act race + wrong-connection `onversionchange` | `6995a0e` |

Resolved known issues: KI-001…KI-006. Monitoring items: **MI-001** (migration
complexity — all five one-shot migration flags now verified defect-free) and
**MI-002** (test timing sensitivity — root cause remediated under INV-007/KI-005;
the residual IndexedDB subset remediated under INV-008/KI-006).

The recurring defect class across INV-003/005/006 is worth internalising:
`sv()` swallows `localStorage` write errors, so a one-shot migration could set
its gate flag even when the underlying data write failed — permanently
diverging gate from data. The fix pattern is a direct, *throwing*
`localStorage.setItem` inside the same `try` block as the gate write, so a
failed write leaves the gate unset and the migration retries next load.

INV-008's fix, for context when touching image/plan storage: `openIDB()` caches
its in-flight `indexedDB.open()` promise in `_idbOpenPromise` so concurrent
callers share one connection, and the `onversionchange` handler now closes over
its own `db` and only nulls `_idb` when `_idb === db`. `_closeSharedIdb()`
clears the cached promise too. **Do not modify `openIDB()` / `_closeSharedIdb()`
without opening a new investigation.**

## 6. Unfinished work (nothing here is authorized — each needs its own workflow)

Application backlog, carried from CLAUDE.md:

1. **PAIR-ID-RESOLVED-COUNT Phase 2** — auto-flip status to Resolved with a
   confirmation toast and undo. Detection logic is shipped; the status-mutation
   half is deliberately deferred pending Playwright validation against real
   Muratec XMLs.
2. **Building filter** additions to the Lifecycle and Severity charts.
3. **Layer A `eA`/`eB` flattening fix** — storage flattens parsed nested
   objects and drops `baseLevel` / `gridHead`.
4. **`clashBuilding()` reverse-lookup refactor.**
5. **CUB→CUP IndexedDB key rewrite** (`_migrateCUBtoCUP()` exists; the key
   rewrite does not).
6. **Inline PptxGenJS** to remove the last CDN dependency (~700 KB cost).
7. **Multi-project / multi-user capability** — client interest noted; three
   candidate paths were outlined in chat history and were never written down.
   If this is picked up, treat it as Workflow H and re-derive the options.

Governance backlog:

8. **Monitor MI-001 and MI-002** during any future persistence or test work.
9. **Documentation drift in `CLAUDE.md`** — see §9. Needs a human decision
   (Workflow E) before anyone edits it.

## 7. Running the tests — get this right or you will chase a ghost

```bash
cd tests && npm install && npx playwright test --workers=1
```

**Always run from `tests/`, never from the repository root.** There is no
root `package.json`; running from the root loads two independent
`@playwright/test` module graphs and throws
`Playwright Test did not expect test.describe() to be called here`. That is an
invocation error, not a defect — INV-008 established this with evidence.

- Specs live in `tests/*.spec.js`, named `<feature-marker>.spec.js`.
- Each spec opens `file://` on the local `working.html`.
- `tests/playwright.config.js` honours `PW_CHROMIUM_PATH` for a
  system-provided Chromium (in this sandbox: `/opt/pw-browsers`).
- Bootstrap contract (INV-007): after the early ready signal, every bootstrap
  helper must also wait on the terminal migration gate —
  `await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');`
  — otherwise deferred `setTimeout(1500/1600)` migrations race and overwrite
  test-seeded state. Preserve this in any new spec.
- Auth bypass and clean-state idioms are documented in `CLAUDE.md`.
- Last recorded baseline (INV-008 / RS-001): **288 tests, 286 passed.** The two
  failures are `frozen-week-and-chart-year.spec.js` (`CHART-PERIOD-YEAR-AWARE`
  ×2) — pre-existing, date-boundary-dependent chart-range flakiness, reproduced
  on an unmodified baseline via `git stash`. Note this baseline is dated
  2026-08-15; the specs are date-sensitive, so re-establish it before treating
  any failure as a regression.

## 8. Diagnostic discipline

- **DevTools console output before theorising about UI bugs.** Static analysis
  is not sufficient for runtime behaviour.
- **Playwright reproduction before proposing a fix for any UI bug**, run
  against the real `working.html` in Chromium.
- **grep-then-view, then minimal targeted edits.** Never edit blind.
- **Stale data first, code bugs last.** A platform that worked yesterday and
  shows wrong numbers today has more likely had its data shift than its code
  break.
- Before editing `working.html`, verify the file you have is the file you
  think you have: line count against the last handoff/commit, JS parses clean
  (script blocks extracted, minified blobs excluded), and the markers the
  handoff claims are present actually are. If a check fails, **stop and ask** —
  editing the wrong base costs a full session twice over.

## 9. Known documentation drift — confirm with the human, do not silently "fix"

`CLAUDE.md` is authoritative on preferences and constraints but has four
stale factual claims, verified against HEAD `1d92cca` on 2026-08-24:

| CLAUDE.md claim | Observed |
|---|---|
| `working.html` is ~12,600 lines | **18,401 lines** |
| Chart.js on line 13, JSZip on line 34 | JSZip is on 34; the >50 000-char minified blobs are on **19** and **34**, with Chart.js content spanning **13–19** |
| PptxGenJS CDN tag on line 351 | line **361** |
| `BCF-PANEL-B` and `SPATIAL-HEATMAP-GRID` are known orphaned markers | both are **balanced** (1/1 and 4/4); the whole file is 0-imbalance |

Also: `CLAUDE.md` and this document reference `deploy.bat` in the repository
root for SharePoint deployment; **no `deploy.bat` is committed.** Either it is
local-only on the owner's machine or the reference is stale.

None of these are code defects. Treat correcting them as Workflow E
(Documentation Issue) and get the human's confirmation of the intended values
first — particularly the line-count claim, which is the file-state
verification tripwire other sessions depend on.

## 10. Tone and working preferences (from `CLAUDE.md`, binding)

1. **No agreement preamble.** No "Great question", "You're absolutely right",
   "Absolutely", "Definitely", "There are several ways to look at this."
   Open with the most useful thing.
2. **Confidence tags on uncertain claims:** `[Certain]`, `[Likely]`,
   `[Guessing]`, inline before the claim. If most of a response is guessing,
   say so at the top.
3. **Disagree with structure:** "I disagree because [reason]. Here's what I'd
   do instead [alternative]. The risk in your approach is [specific downside]."
4. **Uncomfortable answer first** — line one, not paragraph three.
5. **Decide and deliver.** Don't barrage with clarifying questions. Pick a
   path, state the assumption, ship. Surface design decisions afterwards for
   spot-check.
6. **Hold position under pushback.** "But I really think" is not new
   information. Fold only on genuinely new information.
7. **No unsolicited UX changes or design opinions.** Implement what was asked.
   Push back only on genuine technical risk.

## 11. Git and delivery

- Default branch: `main`. Work on the branch you were assigned; create it from
  the latest `main` if it does not exist. Never push to a different branch
  without explicit permission.
- Push with `git push -u origin <branch>`; on network failure retry up to 4
  times with exponential backoff (2s, 4s, 8s, 16s).
- **Do not open a pull request unless explicitly asked.**
- `.github/workflows/stamp-build.yml` fires on every push to `main` and
  rewrites the `<!-- BUILD-STAMP -->` block in `working.html` with the commit
  SHA and date, committing `chore: stamp build <sha> [skip ci]`. Expect an
  extra automated commit after every merge to `main` — it is not drift.
- After a merge to `main`, deployment is manual: copy `working.html` to the
  SharePoint-synced folder and tell users to Ctrl+F5 once if the change touched
  the localStorage schema.

## 12. First actions in a new session

1. Read `.cline/bootstrap.md`, then `CURRENT_STATUS.md`, `KNOWN_ISSUES.md`,
   and the tail of `INVESTIGATION_LOG.md`.
2. `git status` / `git log --oneline -10` and confirm the working tree is clean
   and in sync with `origin`.
3. Verify `working.html` file state (§8) before any edit.
4. Classify the request against `WORKFLOW_ROUTING.md` and adopt the correct
   role before doing anything else.
5. If the request is a defect report: reproduce it first. If it is an
   enhancement: Workflow H, and stop at the approve/reject decision.

## 13. Do not

- Bump `DATA_VERSION`.
- Modify `openIDB()` / `_closeSharedIdb()` without a new investigation.
- Reopen a Closed/Released investigation to make a "small related tweak" —
  open a new one.
- Edit a recorded `RS-XXX` snapshot entry.
- Split `working.html`, add a bundler, or introduce a third persistence layer.
- Rename CUP to CUB, or introduce a fourth building code.
- Push, merge, or release without passing the human decision gate.
- Treat a red test as a "known flake" without reproducing it on an unmodified
  baseline — INV-007 exists because that habit masked a real defect for weeks.

---

# Part 2 — Verification evidence behind Part 1

Every factual claim in Part 1 was checked against the working tree at HEAD
`1d92cca` (commit date 2026-08-15) on 2026-08-24, not copied from memory or
from `CLAUDE.md`.

Repository state:

- Branch `claude/continuation-prompt-template-1nlln5` and `main` both at
  `1d92cca` (`chore: stamp build 0cec474 [skip ci]`); no diff between them at
  capture time; working tree clean.
- Recent history: `1d92cca` ← `0cec474` (DEC-012 + RS-001) ← `5720adf` ←
  `96b0b0b` (INV-008 closure record) ← `4f86e0b` ← `6995a0e` (INV-008 release
  merge).

Application file:

- `wc -l working.html` → 18 401.
- `DATA_VERSION='v4-correct-dates-jan25'` present and unbumped.
- `_idbOpenPromise` occurs 8 times — the INV-008 Option A remediation is
  present in the tree.
- Lines with >50 000 characters: 19 and 34.
- PptxGenJS `<script>` with cdnjs → jsdelivr → unpkg fallback chain: line 361.
- Marker scan: 192 distinct marker names, 0 imbalanced (`BCF-PANEL-B` 1/1,
  `SPATIAL-HEATMAP-GRID` 4/4).

Test tooling:

- `node` v22.22.2; no root `package.json`; `tests/package.json` pins
  `@playwright/test ^1.55.0` and documents `cd tests && npm install && npm test`.
- `tests/playwright.config.js`: `testDir: '.'`, `fullyParallel: false`,
  30 s timeout, `PW_CHROMIUM_PATH` override.
- `tests/node_modules` is not installed in this sandbox — `npm install` from
  `tests/` is required before any run.
- 51 `*.spec.js` files present under `tests/`.

Governance documents read in full or in relevant part: `PROJECT_CONTEXT.md`,
`AI_STARTUP_CHECKLIST.md`, `ARCHITECTURE_OVERVIEW.md`, `CHANGE_LOG.md`,
`CURRENT_STATUS.md`, `KNOWN_ISSUES.md`, `DECISION_LOG.md`, DEC-009…DEC-012,
`WORKFLOW_ROUTING.md`, `WORKING_AGREEMENTS.md`, `GOVERNANCE_ORCHESTRATOR.md`,
`TESTING_STRATEGY.md`, `RELEASE_SNAPSHOTS.md` (incl. RS-001),
`INVESTIGATION_LOG.md` (INV-008 sections), `.cline/bootstrap.md`.

Assumptions made while writing this handoff, stated explicitly:

- The multi-project / multi-user "three paths" referenced in `CLAUDE.md` were
  never written to the repository; they are treated as lost and needing
  re-derivation.
- `deploy.bat` is assumed to be a local-only file on the owner's machine
  rather than a deleted artifact — not verified either way.
- The 288/286 test baseline is assumed still broadly valid, but the two known
  failures are date-boundary dependent, so the count may differ on a
  later-dated run.

---

# Part 3 — Template for the next handoff

Regenerate this file at the end of a substantial session. Verify each field
against the working tree — do not copy the previous entry forward unchecked.

```text
Captured: YYYY-MM-DD
Captured At: branch <name>, HEAD <sha>, working tree clean/dirty, in sync / ahead N / behind N

1. Product summary — what it is, how it deploys, where it persists.
2. Constraints — invariants that must not change (DATA_VERSION, single file, taxonomy, ...).
3. Edit discipline — marker convention + current balance baseline (N names, M imbalanced).
4. Governance — documents to read, roles, active decision gates.
5. Project state — open investigations, closed/released table with commits, KI/MI status.
6. Unfinished work — application backlog, governance backlog. Mark each as unauthorized.
7. Tests — how to invoke, bootstrap contract, last baseline (total/passed, named failures).
8. Diagnostic discipline — reproduce-before-fix rules, file-state verification.
9. Documentation drift — claim vs observed table, plus what needs a human decision.
10. Tone and working preferences.
11. Git and delivery — branch, push rules, CI side effects, deployment.
12. First actions checklist.
13. Do-not list.

Part 2: evidence — the commands run and their outputs, plus every assumption
stated as an assumption.
```
