# Generation Eval Summary

- Status: not-run
- Project: 纸鸢旧约
- Chapter: chapter-006
- Repeats: 3
- Provider: dry-run
- Fingerprint: git=b03a84b0dac48b4c287907909fac32cfd0a2d0d2-dirty, dataset=ee9a6b190cd7dba3, config=b676a560a0080fbc
- Archive: .novel/evals/four-layer-g3-readiness-20260701/delayed-payoff-benchmark

## Gate

- OK: true
- Reasons: none

## Arms

- baseline: runs 0, errors 0, score 0±0, callbacks 0±0, setting violations 0±0, future leaks 0
- recent-fill: runs 0, errors 0, score 0±0, callbacks 0±0, setting violations 0±0, future leaks 0
- four-layer: runs 0, errors 0, score 0±0, callbacks 0±0, setting violations 0±0, future leaks 0

## Structure Metrics

- baseline setting_recall: 100% (1/1)
- baseline foreshadow_coverage: 0% (0/1)
- baseline future_guard_coverage: 0% (0/0)
- recent-fill setting_recall: 100% (1/1)
- recent-fill foreshadow_coverage: 100% (1/1)
- recent-fill future_guard_coverage: 0% (0/0)
- four-layer setting_recall: 100% (1/1)
- four-layer foreshadow_coverage: 100% (1/1)
- four-layer future_guard_coverage: 0% (0/0)

## Guards

- none

## Comparisons

- four-layer vs baseline: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Judge Review

- not run

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
