# Generation Eval Summary

- Status: underpowered
- Project: 纸鸢旧约
- Case: rivergate-answer
- Chapter: chapter-006
- Repeats: 1
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=57df0529711ebce9293b17abbcd8f698c2586545-dirty, dataset=3f393b88a5a9b34f, config=4cb223e4acd407f2
- Archive: .novel/evals/a0-causal-real-run/delayed-payoff-benchmark-rivergate-answer

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

- rivergate-answer-chapter-006-repeat-1 baseline futureLeak: FAIL Future-only terms leaked: 柳七, 河闸
- rivergate-answer-chapter-006-repeat-1 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- rivergate-answer-chapter-006-repeat-1 baseline entityHallucination: PASS No unknown prominent entities detected.
- rivergate-answer-chapter-006-repeat-1 recent-fill futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- rivergate-answer-chapter-006-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- rivergate-answer-chapter-006-repeat-1 recent-fill entityHallucination: PASS No unknown prominent entities detected.
- rivergate-answer-chapter-006-repeat-1 four-layer futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- rivergate-answer-chapter-006-repeat-1 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- rivergate-answer-chapter-006-repeat-1 four-layer entityHallucination: PASS No unknown prominent entities detected.

## Comparisons

- four-layer vs baseline: callback win rate 100%, callback mean diff 1, setting violation diff -1, future leak diff 0
- four-layer vs recent-fill: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Judge Review

- not run

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
