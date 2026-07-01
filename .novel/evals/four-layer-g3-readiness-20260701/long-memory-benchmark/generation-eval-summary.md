# Generation Eval Summary

- Status: not-run
- Project: 青灯镜湖
- Chapter: chapter-006
- Repeats: 3
- Provider: dry-run
- Fingerprint: git=b03a84b0dac48b4c287907909fac32cfd0a2d0d2-dirty, dataset=305d5b8303492974, config=bd5b42b86dce182d
- Archive: .novel/evals/four-layer-g3-readiness-20260701/long-memory-benchmark

## Gate

- OK: true
- Reasons: none

## Arms

- baseline: runs 0, errors 0, score 0±0, callbacks 0±0, setting violations 0±0, future leaks 0
- recent-fill: runs 0, errors 0, score 0±0, callbacks 0±0, setting violations 0±0, future leaks 0
- four-layer: runs 0, errors 0, score 0±0, callbacks 0±0, setting violations 0±0, future leaks 0

## Structure Metrics

- baseline setting_recall: 100% (2/2)
- baseline foreshadow_coverage: 100% (1/1)
- baseline future_guard_coverage: 0% (0/0)
- recent-fill setting_recall: 100% (2/2)
- recent-fill foreshadow_coverage: 100% (1/1)
- recent-fill future_guard_coverage: 0% (0/0)
- four-layer setting_recall: 100% (2/2)
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
