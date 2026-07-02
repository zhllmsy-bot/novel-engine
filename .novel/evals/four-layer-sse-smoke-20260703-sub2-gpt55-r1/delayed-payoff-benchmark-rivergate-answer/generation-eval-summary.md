# Generation Eval Summary

- Status: underpowered
- Project: 纸鸢旧约
- Case: rivergate-answer
- Chapter: chapter-006
- Repeats: 1
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=0ee56028ff27f38e3e469bfbbb184c6e944d2289, dataset=f80d159d425ceda8, config=a106f07bbd760b5d
- Archive: .novel/evals/four-layer-sse-smoke-20260703-sub2-gpt55-r1/delayed-payoff-benchmark-rivergate-answer

## Gate

- OK: false
- Reasons: underpowered-vs-baseline, insufficient-callback-win-vs-recent-fill, underpowered-vs-recent-fill

## Arms

- baseline: runs 1, errors 0, score 2±0, callbacks 0±0, setting violations 1±0, future leaks 0
- recent-fill: runs 1, errors 0, score 4±0, callbacks 1±0, setting violations 0±0, future leaks 0
- four-layer: runs 1, errors 0, score 4±0, callbacks 1±0, setting violations 0±0, future leaks 0

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

- rivergate-answer-chapter-006-repeat-1 baseline futureLeak: FAIL Future-only terms leaked: 柳七
- rivergate-answer-chapter-006-repeat-1 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- rivergate-answer-chapter-006-repeat-1 baseline entityHallucination: PASS No unknown prominent entities detected.
- rivergate-answer-chapter-006-repeat-1 recent-fill futureLeak: FAIL Future-only terms leaked: 林秋, 河闸
- rivergate-answer-chapter-006-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- rivergate-answer-chapter-006-repeat-1 recent-fill entityHallucination: PASS No unknown prominent entities detected.
- rivergate-answer-chapter-006-repeat-1 four-layer futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 河闸
- rivergate-answer-chapter-006-repeat-1 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- rivergate-answer-chapter-006-repeat-1 four-layer entityHallucination: FAIL Unknown prominent entities detected: 闸门

## Comparisons

- four-layer vs baseline: callback win rate 100%, callback mean diff 1, setting violation diff -1, future leak diff 0
- four-layer vs recent-fill: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Judge Review

- four-layer vs baseline: win rate 0% (0/2), baseline wins 2, ties 0, invalid 0
- four-layer vs recent-fill: win rate 50% (1/2), baseline wins 0, ties 1, invalid 0

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
