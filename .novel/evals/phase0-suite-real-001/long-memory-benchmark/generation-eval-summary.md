# Generation Eval Summary

- Status: underpowered
- Project: 青灯镜湖
- Chapter: chapter-006
- Repeats: 3
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=102bccb1ea4c40177d0f89c98ecf6a074cf6615a, dataset=305d5b8303492974, config=12a00c6819a1f20b
- Archive: .novel/evals/phase0-suite-real-001/long-memory-benchmark

## Gate

- OK: false
- Reasons: insufficient-callback-win-vs-baseline, underpowered-vs-baseline, insufficient-callback-win-vs-recent-fill, underpowered-vs-recent-fill

## Arms

- baseline: runs 0, errors 3, score 0±0, callbacks 0±0, setting violations 0±0, future leaks 0
- recent-fill: runs 0, errors 3, score 0±0, callbacks 0±0, setting violations 0±0, future leaks 0
- four-layer: runs 0, errors 3, score 0±0, callbacks 0±0, setting violations 0±0, future leaks 0

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

- four-layer vs baseline: win rate 0% (0/0), baseline wins 0, ties 0, invalid 0
- four-layer vs recent-fill: win rate 0% (0/0), baseline wins 0, ties 0, invalid 0

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
