#!/usr/bin/env node
/**
 * Release Snapshot generator — DEC-012 / docs/governance/RELEASE_SNAPSHOTS.md
 *
 * Mechanically captures repository-state facts (branch, HEAD, working-tree
 * cleanliness, sync state vs. origin) for a new Release Snapshot entry.
 *
 * Per DEC-012 Rule 3, this script deliberately does NOT populate:
 *   - Governance state (active investigations, monitoring items)
 *   - Investigation state (closure status)
 *   - Test baseline (pass/fail counts, known failures)
 *   - Release status / approval reference
 *
 * Those fields require sourcing from CURRENT_STATUS.md, KNOWN_ISSUES.md,
 * and INVESTIGATION_LOG.md by a human/AI operator — not automation
 * guesswork — and are left as `<FILL: ...>` placeholders below.
 *
 * Usage:
 *   node scripts/generate-release-snapshot.mjs [RS-ID]
 *
 * Example:
 *   node scripts/generate-release-snapshot.mjs RS-002
 *
 * Output: a Markdown snapshot block printed to stdout, ready to be
 * completed and appended to docs/governance/RELEASE_SNAPSHOTS.md.
 */
import { execFileSync } from 'node:child_process';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (e) {
    return `<ERROR: ${e.message.split('\n')[0]}>`;
  }
}

const rsId = process.argv[2] || 'RS-XXX';

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const headFull = git(['rev-parse', 'HEAD']);
const headShort = git(['rev-parse', '--short=7', 'HEAD']);
const headSubject = git(['log', '-1', '--format=%s']);
const headDate = git(['log', '-1', '--format=%cs']);
const status = git(['status', '--porcelain']);
const isClean = status.length === 0;

let syncState = '<FILL: no upstream configured>';
const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
if (!upstream.startsWith('<ERROR')) {
  const counts = git(['rev-list', '--left-right', '--count', `HEAD...${upstream}`]);
  const [ahead, behind] = counts.split(/\s+/).map(Number);
  if (ahead === 0 && behind === 0) syncState = `In sync with ${upstream}`;
  else syncState = `Diverged from ${upstream} — ahead ${ahead}, behind ${behind}`;
}

const today = new Date().toISOString().slice(0, 10);

const out = `# ${rsId}: <FILL: Release / Investigation Name>

Date Captured:

${today}

## Repository State

Branch:

${branch}

Release Commit:

<FILL: release commit SHA + subject — usually not the same as current HEAD>

Current HEAD (at capture time):

\`${headShort}\` (\`${headFull}\`) — ${headSubject} (${headDate})

Working Tree:

${isClean ? 'Clean' : 'Dirty:\n' + status}

Sync State:

${syncState}

## Governance State

Active Investigations:

<FILL: from CURRENT_STATUS.md "Active Investigation Status">

Closed - Released Investigations:

<FILL: from CURRENT_STATUS.md / INVESTIGATION_LOG.md>

Monitoring Items:

<FILL: from KNOWN_ISSUES.md "Monitoring Items">

## Investigation State

<FILL: summary of investigation closure status per INVESTIGATION_LOG.md>

## Test Baseline

Total Tests:

<FILL>

Passed:

<FILL>

Known Failures:

<FILL: named spec files + root-cause classification>

## Release Status

Released Commit:

<FILL>

Release Approval Reference:

<FILL>

Status:

Closed / Released

## Notes

<FILL>
`;

console.log(out);
