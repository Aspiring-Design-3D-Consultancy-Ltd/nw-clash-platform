# Navisworks Clash Intelligence Platform — Working Rules

**This file is read automatically by Claude Code at the start of every session. Treat its contents as binding.**

---

## Governance framework

This repository follows a role-based governance framework recorded in `docs/governance/` (decisions `DEC-001`–`DEC-012`, `WORKFLOW_ROUTING.md`, `WORKFLOW_TEMPLATES.md`, `GOVERNANCE_ORCHESTRATOR.md`, `RELEASE_SNAPSHOTS.md`) and `.cline/bootstrap.md` / `.cline/roles/*`. Investigation before implementation, evidence before conclusions, minimal-change principle. When work resembles a defect investigation rather than a direct instruction, follow that workflow instead of editing directly.

**Released:** INV-008 (IndexedDB Reset Reliability) has been implemented, QA-verified, and released — `openIDB()` now de-duplicates concurrent callers via a cached in-flight promise (Option A) and its `onversionchange` handler closes over its own connection rather than the shared `_idb` variable (Option B), per `WORKFLOW_ROUTING.md` Workflow A. QA Retest passed (`selective-reset-idb-reliability.spec.js`, `wipe-verify.spec.js`, and the full suite — see `docs/governance/INVESTIGATION_LOG.md` and `docs/governance/CURRENT_STATUS.md`). Committed and pushed to `main` (commit `6995a0e`). Investigation closed.

---

## Prompt Library

Reusable governance workflow prompts are maintained in:

`prompts/`

For prompt selection guidance, workflow coverage, and usage information review:

`prompts/README.md`

Use the prompt library when performing:

- Repository context establishment
- Issue assessment
- Investigation scoping
- Project analysis
- Architecture reviews
- QA investigations
- Developer assessments
- Developer implementation planning
- Implementation reviews
- QA retest reviews
- Investigation closure reviews
- Environment stewardship reviews
- Repository stewardship activities
- Governance audits
- Enhancement assessments
- Release reviews
- Release snapshot generation

The prompt library provides structured workflows aligned with repository governance and should be preferred over ad-hoc review processes where an appropriate prompt exists.

---

## Project at a glance

- **Owner:** Shane (BIM Space Planning Manager, Exyte Ireland) — ESMC project, Muratec AMHS scope, Dresden.
- **What it is:** Single-file HTML/CSS/JS app (`working.html`, currently ~12,600 lines) that parses Navisworks Clash Detective XML exports, manages clash review workflow, produces PPTX / PDF / BCF / CSV outputs.
- **Deployment:** Copied to SharePoint, opened locally in Chrome/Edge by users.
- **Hard constraints:** Single file. Chart.js and JSZip are inlined (lines 13 and 34). PptxGenJS is loaded from CDN with jsdelivr/unpkg fallbacks (line 351). This is a known deviation from the 'no external dependencies' preference — accepted because inlining PptxGenJS would add ~700 KB to a rarely-used export path. If deploying to a site with restricted egress, verify the CDN or fallbacks are reachable before shipping. Inlining PptxGenJS is a separate future task.

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
- **Dual-parser discipline:** XML parser 1 is around line 6571, parser 2 around line 6859. Any parsing change must be evaluated against BOTH. Missing this caused the image-matching regression in chat `acfc68f6`.
- **Minified library blobs:** Chart.js on line 13, JSZip on line 34. Exclude from grep with `awk 'NR!=13 && NR!=34'`. Don't run `node --check` against the raw file — extract app scripts first.
- The app uses `localStorage` (`nw:*` keys) + IndexedDB (`NWClashImages` DB: `images` + `plans` stores). Don't introduce new persistence layers.

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
- `WEEKLY-SNAP-PER-CLASH-BUCKET` — each clash buckets to its own ISO week
- `MATURITY-BAR-EMPTY-STATE` — layout-identical empty states
- `CHART-DEFAULT-W14` — chart period floors at W14
- `FILE-MTIME-AS-DATE`, `FILE-MTIME-AS-DATE-USE` — file mtime overrides XML `<createddate>`
- `PAIR-ID-MERGE` — match on element-pair IDs (order-insensitive, same testName)
- `PAIR-ID-RESOLVED-COUNT` — count clashes that disappeared between imports (detection only, no auto-flip)
- `DUP-FILES-FIX` — per-file import event logging
- `STATUS-HIST` — statusHistory append on status change
- `IMG-REF-REFRESH`, `IMG-POS` — image reference refresh + positional fallback
- `OWNER-MAP-FIX` — sourceA/sourceB persistence
- `XTEST-DUP-IMPORT`, `WEEKLY-SNAP-CONDITIONAL-*` — cross-test dedup + historical-anchor snapshots

---

## Pending / on the horizon

- **Phase 2 of PAIR-ID-RESOLVED-COUNT:** auto-flip status to Resolved with confirmation toast + undo. Detection logic is shipped; the status-mutation part is deferred pending Playwright validation against real Muratec XMLs.
- Building filter additions to Lifecycle and Severity charts
- Layer A `eA`/`eB` flattening fix (storage flattens parsed nested objects, dropping `baseLevel`/`gridHead`)
- `clashBuilding()` reverse-lookup refactor
- CUB→CUP IndexedDB key rewrite (`_migrateCUBtoCUP()` exists but key rewrite is separate)
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
- Run with `npx playwright test`. CI optional via GitHub Actions later.

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
