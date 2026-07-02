# Generation Eval Summary

- Status: pass
- Project: 纸鸢旧约
- Case: wind-return
- Chapter: chapter-010
- Repeats: 3
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=908adb3039fbe38ceca18e7486478117dea24ac6, dataset=f80d159d425ceda8, config=c497b5be0c443810
- Archive: .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/delayed-payoff-benchmark-wind-return

## Gate

- OK: true
- Reasons: none

## Arms

- baseline: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- recent-fill: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- four-layer: runs 3, errors 0, score 3.67±0.58, callbacks 0.67±0.58, setting violations 0±0, future leaks 0

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

- wind-return-chapter-010-repeat-1 baseline futureLeak: PASS No future-only entities or events appeared.
- wind-return-chapter-010-repeat-1 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- wind-return-chapter-010-repeat-1 baseline entityHallucination: PASS No unknown prominent entities detected.
- wind-return-chapter-010-repeat-1 recent-fill futureLeak: PASS No future-only entities or events appeared.
- wind-return-chapter-010-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- wind-return-chapter-010-repeat-1 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 闸门
- wind-return-chapter-010-repeat-1 four-layer futureLeak: PASS No future-only entities or events appeared.
- wind-return-chapter-010-repeat-1 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- wind-return-chapter-010-repeat-1 four-layer entityHallucination: PASS No unknown prominent entities detected.
- wind-return-chapter-010-repeat-2 baseline futureLeak: PASS No future-only entities or events appeared.
- wind-return-chapter-010-repeat-2 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- wind-return-chapter-010-repeat-2 baseline entityHallucination: PASS No unknown prominent entities detected.
- wind-return-chapter-010-repeat-2 recent-fill futureLeak: PASS No future-only entities or events appeared.
- wind-return-chapter-010-repeat-2 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- wind-return-chapter-010-repeat-2 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 闸门
- wind-return-chapter-010-repeat-2 four-layer futureLeak: PASS No future-only entities or events appeared.
- wind-return-chapter-010-repeat-2 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- wind-return-chapter-010-repeat-2 four-layer entityHallucination: PASS No unknown prominent entities detected.
- wind-return-chapter-010-repeat-3 baseline futureLeak: PASS No future-only entities or events appeared.
- wind-return-chapter-010-repeat-3 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- wind-return-chapter-010-repeat-3 baseline entityHallucination: FAIL Unknown prominent entities detected: 闸门
- wind-return-chapter-010-repeat-3 recent-fill futureLeak: PASS No future-only entities or events appeared.
- wind-return-chapter-010-repeat-3 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- wind-return-chapter-010-repeat-3 recent-fill entityHallucination: PASS No unknown prominent entities detected.
- wind-return-chapter-010-repeat-3 four-layer futureLeak: PASS No future-only entities or events appeared.
- wind-return-chapter-010-repeat-3 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- wind-return-chapter-010-repeat-3 four-layer entityHallucination: PASS No unknown prominent entities detected.

## Comparisons

- four-layer vs baseline: callback win rate 67%, callback mean diff 0.67, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: callback win rate 67%, callback mean diff 0.67, setting violation diff 0, future leak diff 0

## Judge Review

- four-layer vs baseline: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0
- four-layer vs recent-fill: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
