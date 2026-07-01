# Generation Eval Summary

- Status: fail
- Project: 霜桥逆火
- Chapter: chapter-006
- Repeats: 3
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=061efb0dd9f8d64a139a1b484fdb8441a659ffd7, dataset=24c11ad6d9759c35, config=b2895d9f1fbbffef
- Archive: [REDACTED-PATH]/state-drift-benchmark

## Gate

- OK: false
- Reasons: insufficient-callback-win-vs-baseline, insufficient-callback-win-vs-recent-fill

## Arms

- baseline: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- recent-fill: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- four-layer: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0

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

- chapter-006-repeat-1 baseline futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-1 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-1 baseline entityHallucination: FAIL Unknown prominent entities detected: 几名巡夜司
- chapter-006-repeat-1 recent-fill futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-1 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 敢拦巡夜司
- chapter-006-repeat-1 four-layer futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-1 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-1 four-layer entityHallucination: FAIL Unknown prominent entities detected: 截住巡夜司
- chapter-006-repeat-2 baseline futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-2 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-2 baseline entityHallucination: PASS No unknown prominent entities detected.
- chapter-006-repeat-2 recent-fill futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-2 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-2 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 连巡夜司
- chapter-006-repeat-2 four-layer futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-2 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-2 four-layer entityHallucination: FAIL Unknown prominent entities detected: 变成巡夜司
- chapter-006-repeat-3 baseline futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-3 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-3 baseline entityHallucination: PASS No unknown prominent entities detected.
- chapter-006-repeat-3 recent-fill futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-3 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-3 recent-fill entityHallucination: PASS No unknown prominent entities detected.
- chapter-006-repeat-3 four-layer futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-3 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-3 four-layer entityHallucination: PASS No unknown prominent entities detected.

## Comparisons

- four-layer vs baseline: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Judge Review

- not run

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
