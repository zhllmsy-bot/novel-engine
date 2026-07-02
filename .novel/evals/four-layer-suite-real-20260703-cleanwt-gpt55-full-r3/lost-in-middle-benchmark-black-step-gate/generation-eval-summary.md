# Generation Eval Summary

- Status: fail
- Project: 回环墓中段
- Case: black-step-gate
- Chapter: chapter-011
- Repeats: 3
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=908adb3039fbe38ceca18e7486478117dea24ac6, dataset=fcd41216287c8e47, config=b16190ca6623ca49
- Archive: .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-black-step-gate

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

- black-step-gate-chapter-011-repeat-1 baseline futureLeak: FAIL Future-only terms leaked: 阿照, 真北铁, 生门, 针尾, 缺口
- black-step-gate-chapter-011-repeat-1 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- black-step-gate-chapter-011-repeat-1 baseline entityHallucination: FAIL Unknown prominent entities detected: 低门
- black-step-gate-chapter-011-repeat-1 recent-fill futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 生门, 针尾, 缺口
- black-step-gate-chapter-011-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- black-step-gate-chapter-011-repeat-1 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 低门
- black-step-gate-chapter-011-repeat-1 four-layer futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 生门, 针尾, 反握, 缺口
- black-step-gate-chapter-011-repeat-1 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- black-step-gate-chapter-011-repeat-1 four-layer entityHallucination: FAIL Unknown prominent entities detected: 低门
- black-step-gate-chapter-011-repeat-2 baseline futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 针尾, 缺口
- black-step-gate-chapter-011-repeat-2 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- black-step-gate-chapter-011-repeat-2 baseline entityHallucination: FAIL Unknown prominent entities detected: 低门
- black-step-gate-chapter-011-repeat-2 recent-fill futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 生门, 针尾, 缺口
- black-step-gate-chapter-011-repeat-2 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- black-step-gate-chapter-011-repeat-2 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 低门
- black-step-gate-chapter-011-repeat-2 four-layer futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 生门, 针尾, 反握, 缺口
- black-step-gate-chapter-011-repeat-2 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- black-step-gate-chapter-011-repeat-2 four-layer entityHallucination: FAIL Unknown prominent entities detected: 低门
- black-step-gate-chapter-011-repeat-3 baseline futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 生门, 针尾
- black-step-gate-chapter-011-repeat-3 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- black-step-gate-chapter-011-repeat-3 baseline entityHallucination: FAIL Unknown prominent entities detected: 眼下门, 低门
- black-step-gate-chapter-011-repeat-3 recent-fill futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 针尾, 反握, 缺口
- black-step-gate-chapter-011-repeat-3 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- black-step-gate-chapter-011-repeat-3 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 低门, 们猜哪扇门, 罗盘移到门
- black-step-gate-chapter-011-repeat-3 four-layer futureLeak: FAIL Future-only terms leaked: 阿照, 真北铁, 针尾, 缺口
- black-step-gate-chapter-011-repeat-3 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- black-step-gate-chapter-011-repeat-3 four-layer entityHallucination: FAIL Unknown prominent entities detected: 低门

## Comparisons

- four-layer vs baseline: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Judge Review

- four-layer vs baseline: win rate 75% (3/6), baseline wins 1, ties 0, invalid 2
- four-layer vs recent-fill: win rate 83% (5/6), baseline wins 1, ties 0, invalid 0

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
