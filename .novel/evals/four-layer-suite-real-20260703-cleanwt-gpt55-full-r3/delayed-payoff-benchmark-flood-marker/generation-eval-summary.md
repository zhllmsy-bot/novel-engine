# Generation Eval Summary

- Status: underpowered
- Project: 纸鸢旧约
- Case: flood-marker
- Chapter: chapter-009
- Repeats: 3
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=908adb3039fbe38ceca18e7486478117dea24ac6, dataset=f80d159d425ceda8, config=c79da0850245cdf6
- Archive: .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/delayed-payoff-benchmark-flood-marker

## Gate

- OK: false
- Reasons: insufficient-callback-win-vs-baseline, underpowered-vs-baseline, insufficient-callback-win-vs-recent-fill, underpowered-vs-recent-fill

## Arms

- baseline: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- recent-fill: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- four-layer: runs 2, errors 1, score 3.50±0.71, callbacks 0.50±0.71, setting violations 0±0, future leaks 0

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

- flood-marker-chapter-009-repeat-1 baseline futureLeak: FAIL Future-only terms leaked: 林秋, 柳七, 河闸
- flood-marker-chapter-009-repeat-1 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- flood-marker-chapter-009-repeat-1 baseline entityHallucination: PASS No unknown prominent entities detected.
- flood-marker-chapter-009-repeat-1 recent-fill futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- flood-marker-chapter-009-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- flood-marker-chapter-009-repeat-1 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 闸门
- flood-marker-chapter-009-repeat-2 baseline futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- flood-marker-chapter-009-repeat-2 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- flood-marker-chapter-009-repeat-2 baseline entityHallucination: FAIL Unknown prominent entities detected: 那座闸门
- flood-marker-chapter-009-repeat-2 recent-fill futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- flood-marker-chapter-009-repeat-2 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- flood-marker-chapter-009-repeat-2 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 闸门
- flood-marker-chapter-009-repeat-2 four-layer futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- flood-marker-chapter-009-repeat-2 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- flood-marker-chapter-009-repeat-2 four-layer entityHallucination: PASS No unknown prominent entities detected.
- flood-marker-chapter-009-repeat-3 baseline futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- flood-marker-chapter-009-repeat-3 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- flood-marker-chapter-009-repeat-3 baseline entityHallucination: PASS No unknown prominent entities detected.
- flood-marker-chapter-009-repeat-3 recent-fill futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- flood-marker-chapter-009-repeat-3 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- flood-marker-chapter-009-repeat-3 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 唯有闸门
- flood-marker-chapter-009-repeat-3 four-layer futureLeak: FAIL Future-only terms leaked: 林秋, 白尾纸鸢, 柳七, 河闸
- flood-marker-chapter-009-repeat-3 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- flood-marker-chapter-009-repeat-3 four-layer entityHallucination: PASS No unknown prominent entities detected.

## Comparisons

- four-layer vs baseline: callback win rate 50%, callback mean diff 0.50, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: callback win rate 50%, callback mean diff 0.50, setting violation diff 0, future leak diff 0

## Judge Review

- four-layer vs baseline: win rate 0% (0/4), baseline wins 2, ties 1, invalid 1
- four-layer vs recent-fill: win rate 0% (0/4), baseline wins 4, ties 0, invalid 0

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
