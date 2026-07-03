# Generation Eval Summary

- Status: not-run
- Project: 霜桥逆火
- Case: old-bridge-fire
- Chapter: chapter-010
- Repeats: 3
- Provider: dry-run
- Fingerprint: git=57df0529711ebce9293b17abbcd8f698c2586545-dirty, dataset=7b1469c7c7051fb0, config=c86ace16b34b6782
- Archive: .novel/evals/a0-local-dry-run/state-drift-benchmark-old-bridge-fire

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
- recent-fill foreshadow_coverage: 0% (0/1)
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
