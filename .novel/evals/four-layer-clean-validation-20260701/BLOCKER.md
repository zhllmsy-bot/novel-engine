# Four-Layer Clean Validation Blocker

Recorded at: 2026-07-01 21:43 CST

## Status

This validation stopped at the preflight stage. No engine code was changed.

Conclusion for this run: **blocked before generation**.

Reason: **G3 suite paired-data gate failed twice on the frozen clean version**. The current dry-run suite can archive prompts and structure metrics, but it does not create generation runs, so `pairedRuns` remains `0`.

## Frozen Fingerprint

- Repository: `/Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine`
- Git commit: `5fa8f9e87c513f17025b10533a71e767a1cdf476`
- Git status at start: clean
- Git status at end: clean
- Node: `v22.22.1`
- npm: `10.9.4`

Evidence:

- `00-freeze.txt`
- `99-final-clean-status.txt`

## Gate Results

| Gate | Result | Evidence |
|---|---:|---|
| G1 version freeze | PASS | `00-freeze.txt` shows clean status, no diff, non-dirty commit fingerprint |
| G2 entity guard | PASS | `01-g2-domain-guards.txt` shows `1 passed / 4 passed`; manual samples returned no unknown entity matches |
| G3 suite paired data | FAIL | `02-g3-suite-dry-run/paired-runs-summary.json.txt` shows suite `errors: []` but both comparisons `pairedRuns: 0` |
| G3 second attempt | FAIL | `03-g4-prompts/prompt-diff-summary.json` again shows both comparisons `pairedRuns: 0` |
| G4 arm prompt difference | PASS | `03-g4-prompts/prompt-diff-summary.json` shows baseline memoryCount `1`, four-layer memoryCount `8/8/10` |

## Why G3 Failed

Current implementation only populates `runs` when `dryRun === false`; preflight dry-run keeps `runs: []`. The suite comparison then computes `pairedRuns` from generated run pairs, so dry-run preflight cannot satisfy `pairedRuns > 0`.

Relevant read-only evidence:

- `tools/generation-eval.ts:589` only enters generation loop when `!dryRun && errors.length === 0`
- `tools/generation-eval.ts:1519` computes `pairedRuns` as `pairs.length`
- Archived suite records show `runs: 0` for all three current benchmark projects

## Additional Readiness Findings

The full planned clean experiment is not ready in the frozen repo without adding test assets or tooling:

- Only 3 benchmark projects exist: `delayed-payoff-benchmark`, `state-drift-benchmark`, `long-memory-benchmark`.
- The planned fixed set requires 4 long-memory tasks, including cross-volume consistency and lost-in-the-middle.
- No Cohen's kappa implementation was found; `src/eval/judgeReview.ts` only builds pairwise judge prompts.
- Generated human-review CSV files exist as review templates, but no filled review rows or kappa value exist for this run.

## Required Next Action

Per the validation plan, this run must stop here. The next action is not to run generation on an unpassed preflight; it is to decide whether to unfreeze for a minimal experiment-tooling/data pass that can:

- make the preflight suite produce paired data or revise G3 to a feasible non-generation readiness check;
- add the two missing fixed benchmark tasks;
- add or provide the kappa calculation path and at least 10 human labels.

No such changes were made in this run.
