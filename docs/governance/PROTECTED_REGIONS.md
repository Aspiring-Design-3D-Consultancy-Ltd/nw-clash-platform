# Protected Regions

## Purpose

Define the invariant gate that protects marker blocks in `working.html` which
must not change as a side effect of unrelated work.

A protected region is a marker block whose behaviour is depended upon by
multiple features, where an accidental edit would be difficult to detect by
review alone. Briefs may declare a region protected for a given change; this
document defines how that declaration is verified.

This document exists under DEC-008 (governance documentation expands only on a
genuine process gap). The gap is recorded in DEC-013: the previously recorded
fingerprints could not be reproduced by any stated algorithm, so the gate could
not actually be run.

---

## The Gate

Run from the repository root, on the branch under review, before requesting
merge.

```bash
BASE=origin/main
for m in REVIEW-QUEUE-DETECT APPROVE-TERMINAL-STATUS-FILTER; do
  block(){ awk -v M="$m" 'index($0,M" start"){f=1} f{print} index($0,M" end"){f=0}'; }
  a=$(git show "$BASE:working.html" | block)
  b=$(block < working.html)
  h=$(printf '%s\n' "$b" | sha256sum | cut -c1-16)
  [ "$a" = "$b" ] \
    && printf '  %-32s %s  UNCHANGED\n' "$m" "$h" \
    || printf '  %-32s %s  *** CHANGED ***\n' "$m" "$h"
done
```

Expected output on a compliant branch:

```
  REVIEW-QUEUE-DETECT              54db97511c97f7ad  UNCHANGED
  APPROVE-TERMINAL-STATUS-FILTER   c1173153c15dba7b  UNCHANGED
```

`git fetch origin main` first if `origin/main` may be stale.

---

## Recorded Fingerprints

| Marker block | Fingerprint | Recorded at |
| --- | --- | --- |
| `REVIEW-QUEUE-DETECT` | `54db97511c97f7ad` | `161894f` (2026-08-26) |
| `APPROVE-TERMINAL-STATUS-FILTER` | `c1173153c15dba7b` | `161894f` (2026-08-26) |

---

## Algorithm

Stated explicitly so this can never ambiguate again.

- **Block extraction** — every line from the one containing `<MARKER> start`
  through the one containing `<MARKER> end`, inclusive. Both delimiter lines are
  part of the block. Leading whitespace is preserved.
- **Digest** — `sha256`, over the extracted block with a single trailing
  newline, truncated to the **first 16 lowercase hex characters**.
- **Comparison** — the authoritative check is a direct byte comparison of the
  block on the branch against the same block on the base revision. The
  fingerprint is a human-readable summary for records and review notes; it is
  not the check itself.

A fingerprint alone cannot prove a region is unchanged relative to a moving
base. Byte comparison against `origin/main` can, which is why the gate does
both and reports the fingerprint alongside the verdict.

---

## Failure Handling

A `*** CHANGED ***` result is a stop, not a warning.

1. Confirm whether the change was intentional. Most of the time it is not — an
   insertion elsewhere in the file does not shift a block's content, so a
   changed fingerprint means the block itself was edited.
2. If unintentional: revert the edit inside the protected block and re-run the
   gate before continuing.
3. If intentional: the change requires its own review and approval, recorded in
   `DECISION_LOG.md` or `INVESTIGATION_LOG.md`. Update the fingerprint table in
   this document in the same commit, citing the commit that changed the block.

Never update the fingerprint table to make a failing gate pass. The table
follows an approved change; it does not authorise one.

---

## Adding a Protected Region

1. Add the marker name to the loop in **The Gate**.
2. Compute its fingerprint on the current `main` using the algorithm above.
3. Add a row to **Recorded Fingerprints**, citing the commit.
4. Record why the region is protected — in the brief, and in
   `DECISION_LOG.md` if the protection is intended to be long-lived.

---

## Notes

The gate is documentation, not automation. It is run by hand as part of
pre-merge review. Promoting it to `scripts/` and wiring it into CI would remove
the manual step, and is a reasonable future change — it has not been made,
because the gate has so far been needed only at review time and the project
prefers deliberate scope.
