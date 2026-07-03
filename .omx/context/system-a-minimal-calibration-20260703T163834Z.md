# System A Minimal Calibration Context

## Task Statement

Continue from the existing A0 result and finish the smallest System A judge-calibration loop. Follow a concrete todo list until the bounded loop is complete.

## Desired Outcome

The repository can:

- archive L0-pinned audit packets from generation eval runs;
- build human audit/review data from those packets without UI;
- let judge prompts and human auditors share the same L0-pinned facts;
- compute judge trust from human labels, judge audit acceptance, and duplicate consistency;
- fail closed when required human audit data is missing or inconsistent.

## Known Facts And Evidence

- A0 L1 oracle fixture ablation already failed the pre-registered primary metric, so do not take an L1-first branch.
- System A is now the active path; System B remains roadmap-only.
- `tools/generation-eval.ts` writes `audit-packets.jsonl`.
- `src/eval/judgeReview.ts` builds L0-pinned audit packets.
- `tools/judge-kappa.ts` computes Cohen kappa and can build/read `human-audit.tsv`.
- Existing plan says next System A items are audit-pinned judge prompts, review queue duplicate injection, and richer trust reporting.

## Constraints

- No UI/dashboard/editor work.
- No System B correction workflow.
- No L1 implementation.
- No broad refactor or open-source packaging work.
- No secret storage.
- Preserve dirty/untracked A0 artifacts unless explicitly asked to clean them.
- Use deterministic CLI/data outputs and focused tests.

## Unknowns / Open Questions

- Gold rows require curated fixtures and are out of this bounded pass unless already available.
- `CodexEntry` does not currently expose reliable first-established chapter provenance; keep `establishedChapterId: "unknown"` unless that becomes available.
- Full certification still needs real human labels; this pass only completes the machinery and fail-closed scoring.

## Likely Touchpoints

- `src/eval/judgeReview.ts`
- `src/eval/judgeReview.test.ts`
- `tools/generation-eval.ts`
- `tools/generation-eval.test.ts`
- `tools/judge-kappa.ts`
- `tools/judge-kappa.test.ts`
- `.omx/plans/human-calibrated-memory-eval-plan.md`

## Current Completion State

- L0-pinned audit packet archive is implemented.
- Audit-pinned judge prompts and structured judge output parsing are implemented.
- `generation:kappa -- --build-human-audit` builds a spreadsheet-friendly `human-audit.tsv`.
- `generation:kappa -- --build-review-queue` builds a deterministic `review-queue.tsv` with canonical and duplicate rows.
- `generation:kappa -- --human-audit <review-queue.tsv>` scores only canonical rows for kappa and reports duplicate consistency separately.
- Trust now fails closed on blank canonical audit acceptance, low audit pass rate, blank duplicate responses, or duplicate consistency below `0.9`.

Still intentionally out of scope:

- Gold review rows until curated gold fixtures exist.
- Multi-annotator overlap, elapsed/fatigue certification, bootstrap confidence intervals, and full certification semantics.
- UI, System B correction, and L1 implementation.
