# Generation Eval Summary

- Status: fail
- Project: 回环墓中段
- Case: tail-light-exit
- Chapter: chapter-012
- Repeats: 3
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=908adb3039fbe38ceca18e7486478117dea24ac6, dataset=fcd41216287c8e47, config=c10e637130aad7ea
- Archive: .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-tail-light-exit

## Gate

- OK: false
- Reasons: insufficient-callback-win-vs-baseline, insufficient-callback-win-vs-recent-fill

## Arms

- baseline: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- recent-fill: runs 3, errors 0, score 3.33±0.58, callbacks 0.33±0.58, setting violations 0±0, future leaks 0
- four-layer: runs 3, errors 0, score 3.33±0.58, callbacks 0.33±0.58, setting violations 0±0, future leaks 0

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

- tail-light-exit-chapter-012-repeat-1 baseline futureLeak: PASS No future-only entities or events appeared.
- tail-light-exit-chapter-012-repeat-1 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- tail-light-exit-chapter-012-repeat-1 baseline entityHallucination: FAIL Unknown prominent entities detected: 盏灯移到门, 点光甩到门
- tail-light-exit-chapter-012-repeat-1 recent-fill futureLeak: PASS No future-only entities or events appeared.
- tail-light-exit-chapter-012-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- tail-light-exit-chapter-012-repeat-1 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 位置摸进门, 有用力推门, 低门
- tail-light-exit-chapter-012-repeat-1 four-layer futureLeak: PASS No future-only entities or events appeared.
- tail-light-exit-chapter-012-repeat-1 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- tail-light-exit-chapter-012-repeat-1 four-layer entityHallucination: PASS No unknown prominent entities detected.
- tail-light-exit-chapter-012-repeat-2 baseline futureLeak: PASS No future-only entities or events appeared.
- tail-light-exit-chapter-012-repeat-2 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- tail-light-exit-chapter-012-repeat-2 baseline entityHallucination: FAIL Unknown prominent entities detected: 几乎贴住门, 低门, 指腹探进门
- tail-light-exit-chapter-012-repeat-2 recent-fill futureLeak: PASS No future-only entities or events appeared.
- tail-light-exit-chapter-012-repeat-2 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- tail-light-exit-chapter-012-repeat-2 recent-fill entityHallucination: PASS No unknown prominent entities detected.
- tail-light-exit-chapter-012-repeat-2 four-layer futureLeak: PASS No future-only entities or events appeared.
- tail-light-exit-chapter-012-repeat-2 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- tail-light-exit-chapter-012-repeat-2 four-layer entityHallucination: PASS No unknown prominent entities detected.
- tail-light-exit-chapter-012-repeat-3 baseline futureLeak: PASS No future-only entities or events appeared.
- tail-light-exit-chapter-012-repeat-3 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- tail-light-exit-chapter-012-repeat-3 baseline entityHallucination: FAIL Unknown prominent entities detected: 缺口贴进门
- tail-light-exit-chapter-012-repeat-3 recent-fill futureLeak: PASS No future-only entities or events appeared.
- tail-light-exit-chapter-012-repeat-3 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- tail-light-exit-chapter-012-repeat-3 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 罗盘移到门, 槽落到低门
- tail-light-exit-chapter-012-repeat-3 four-layer futureLeak: PASS No future-only entities or events appeared.
- tail-light-exit-chapter-012-repeat-3 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- tail-light-exit-chapter-012-repeat-3 four-layer entityHallucination: FAIL Unknown prominent entities detected: 落到门

## Comparisons

- four-layer vs baseline: callback win rate 33%, callback mean diff 0.33, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: callback win rate 33%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Judge Review

- four-layer vs baseline: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0
- four-layer vs recent-fill: win rate 67% (4/6), baseline wins 2, ties 0, invalid 0

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
