# Generation Eval Summary

- Status: pass
- Project: 纸鸢旧约
- Case: south-canal-vow
- Chapter: chapter-007
- Repeats: 3
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=c418a391fb5c7d3c02136c07f97abde14dc81a22, dataset=f80d159d425ceda8, config=7eb4df8b96c4fa9c
- Archive: .novel/evals/four-layer-suite-real-20260703-sub2-gpt55-full-r3-r3/delayed-payoff-benchmark-south-canal-vow

## Gate

- OK: true
- Reasons: none

## Arms

- baseline: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- recent-fill: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- four-layer: runs 3, errors 0, score 4±0, callbacks 1±0, setting violations 0±0, future leaks 0

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

- south-canal-vow-chapter-007-repeat-1 baseline futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七
- south-canal-vow-chapter-007-repeat-1 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- south-canal-vow-chapter-007-repeat-1 baseline entityHallucination: PASS No unknown prominent entities detected.
- south-canal-vow-chapter-007-repeat-1 recent-fill futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七
- south-canal-vow-chapter-007-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- south-canal-vow-chapter-007-repeat-1 recent-fill entityHallucination: PASS No unknown prominent entities detected.
- south-canal-vow-chapter-007-repeat-1 four-layer futureLeak: FAIL Future-only terms leaked: 林秋, 柳七, 河闸
- south-canal-vow-chapter-007-repeat-1 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- south-canal-vow-chapter-007-repeat-1 four-layer entityHallucination: PASS No unknown prominent entities detected.
- south-canal-vow-chapter-007-repeat-2 baseline futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七
- south-canal-vow-chapter-007-repeat-2 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- south-canal-vow-chapter-007-repeat-2 baseline entityHallucination: PASS No unknown prominent entities detected.
- south-canal-vow-chapter-007-repeat-2 recent-fill futureLeak: FAIL Future-only terms leaked: 林秋, 柳七
- south-canal-vow-chapter-007-repeat-2 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- south-canal-vow-chapter-007-repeat-2 recent-fill entityHallucination: PASS No unknown prominent entities detected.
- south-canal-vow-chapter-007-repeat-2 four-layer futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- south-canal-vow-chapter-007-repeat-2 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- south-canal-vow-chapter-007-repeat-2 four-layer entityHallucination: PASS No unknown prominent entities detected.
- south-canal-vow-chapter-007-repeat-3 baseline futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七
- south-canal-vow-chapter-007-repeat-3 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- south-canal-vow-chapter-007-repeat-3 baseline entityHallucination: PASS No unknown prominent entities detected.
- south-canal-vow-chapter-007-repeat-3 recent-fill futureLeak: FAIL Future-only terms leaked: 林秋, 柳七
- south-canal-vow-chapter-007-repeat-3 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- south-canal-vow-chapter-007-repeat-3 recent-fill entityHallucination: PASS No unknown prominent entities detected.
- south-canal-vow-chapter-007-repeat-3 four-layer futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- south-canal-vow-chapter-007-repeat-3 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- south-canal-vow-chapter-007-repeat-3 four-layer entityHallucination: PASS No unknown prominent entities detected.

## Comparisons

- four-layer vs baseline: callback win rate 100%, callback mean diff 1, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: callback win rate 100%, callback mean diff 1, setting violation diff 0, future leak diff 0

## Judge Review

- four-layer vs baseline: win rate 80% (4/6), baseline wins 1, ties 0, invalid 1
- four-layer vs recent-fill: win rate 50% (2/6), baseline wins 2, ties 0, invalid 2

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
