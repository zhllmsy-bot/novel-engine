# Generation Eval Summary

- Status: underpowered
- Project: 回环墓中段
- Case: stone-room-turn
- Chapter: chapter-010
- Repeats: 3
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=908adb3039fbe38ceca18e7486478117dea24ac6, dataset=fcd41216287c8e47, config=9758fcc614cee7e7
- Archive: .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-stone-room-turn

## Gate

- OK: false
- Reasons: insufficient-callback-win-vs-baseline, underpowered-vs-baseline, insufficient-callback-win-vs-recent-fill, underpowered-vs-recent-fill

## Arms

- baseline: runs 3, errors 0, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- recent-fill: runs 2, errors 1, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0
- four-layer: runs 2, errors 1, score 3±0, callbacks 0±0, setting violations 0±0, future leaks 0

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

- stone-room-turn-chapter-010-repeat-1 baseline futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 生门, 针尾, 缺口
- stone-room-turn-chapter-010-repeat-1 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- stone-room-turn-chapter-010-repeat-1 baseline entityHallucination: FAIL Unknown prominent entities detected: 指哪扇门
- stone-room-turn-chapter-010-repeat-1 recent-fill futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 生门, 针尾, 反握, 缺口
- stone-room-turn-chapter-010-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- stone-room-turn-chapter-010-repeat-1 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 右门
- stone-room-turn-chapter-010-repeat-2 baseline futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 针尾, 反握, 缺口
- stone-room-turn-chapter-010-repeat-2 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- stone-room-turn-chapter-010-repeat-2 baseline entityHallucination: FAIL Unknown prominent entities detected: 时候谁指门, 们往哪扇门
- stone-room-turn-chapter-010-repeat-2 recent-fill futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 生门, 针尾, 反握, 缺口
- stone-room-turn-chapter-010-repeat-2 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- stone-room-turn-chapter-010-repeat-2 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 尾指哪扇门, 哪扇门
- stone-room-turn-chapter-010-repeat-2 four-layer futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 生门, 针尾, 反握, 缺口
- stone-room-turn-chapter-010-repeat-2 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- stone-room-turn-chapter-010-repeat-2 four-layer entityHallucination: FAIL Unknown prominent entities detected: 直冲某扇门
- stone-room-turn-chapter-010-repeat-3 baseline futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 生门, 针尾, 缺口
- stone-room-turn-chapter-010-repeat-3 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- stone-room-turn-chapter-010-repeat-3 baseline entityHallucination: FAIL Unknown prominent entities detected: 显得像生门, 四扇门
- stone-room-turn-chapter-010-repeat-3 four-layer futureLeak: FAIL Future-only terms leaked: 阿照, 倒置罗盘, 真北铁, 生门, 针尾, 反握, 缺口
- stone-room-turn-chapter-010-repeat-3 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- stone-room-turn-chapter-010-repeat-3 four-layer entityHallucination: FAIL Unknown prominent entities detected: 挑哪一扇门, 那门, 任何一扇门, 那里门

## Comparisons

- four-layer vs baseline: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Judge Review

- four-layer vs baseline: win rate 25% (1/4), baseline wins 3, ties 0, invalid 0
- four-layer vs recent-fill: win rate 0% (0/2), baseline wins 2, ties 0, invalid 0

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
