# Generation Eval Summary

- Status: fail
- Project: 青灯镜湖
- Chapter: chapter-006
- Repeats: 3
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://[REDACTED-HOST]/ wire=responses reasoning=xhigh
- Fingerprint: git=8a3c1fb135a3f1c37d4ba2124ea845a8bfb843c1-dirty, dataset=305d5b8303492974, config=12a00c6819a1f20b
- Archive: examples/long-memory-benchmark/.novel/evals/phase0-real-001

## Gate

- OK: false
- Reasons: insufficient-callback-win-vs-baseline, insufficient-callback-win-vs-recent-fill

## Arms

- baseline: runs 3, errors 0, score 3.67±0.58, callbacks 1±0, setting violations 0.33±0.58, future leaks 0
- recent-fill: runs 3, errors 0, score 3.67±0.58, callbacks 1±0, setting violations 0.33±0.58, future leaks 0
- four-layer: runs 3, errors 0, score 3.67±0.58, callbacks 1±0, setting violations 0.33±0.58, future leaks 0

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

- chapter-006-repeat-1 baseline futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-1 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-1 baseline entityHallucination: FAIL Unknown prominent entities detected: 指节被钥, 青灯前立过的誓, 不负故人, 雾气在两人, 又被湖, 沈泊把镜湖钥, 这把钥不是黑潮司, 便是把镜湖, 来处都不肯露的人, 是因为青灯誓, 能问我这句话的人
- chapter-006-repeat-1 recent-fill futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-1 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 看着钥, 你把钥, 后来黑潮司, 说镜湖, 他把镜湖钥, 千万不能把钥, 交给黑潮司, 只是这把钥, 既然只回应青灯誓, 该落到不守灯的人
- chapter-006-repeat-1 four-layer futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-1 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-1 four-layer entityHallucination: FAIL Unknown prominent entities detected: 只将钥, 不是黑潮司, 他们来信说镜湖, 钥只回应青灯誓, 黑潮司要的不是钥, 是湖, 也是守灯人
- chapter-006-repeat-2 baseline futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-2 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-2 baseline entityHallucination: FAIL Unknown prominent entities detected: 这把钥不是黑潮司, 沈泊把钥, 可这把钥
- chapter-006-repeat-2 recent-fill futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-2 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-2 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 说它只回应青灯誓, 千万不能把钥, 交给黑潮司, 所以雾市没人, 石塔有人, 指腹轻轻压住钥, 我不知道黑潮司, 们为什么找守灯人, 这把钥, 我不能替你把誓
- chapter-006-repeat-2 four-layer futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-2 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-2 four-layer entityHallucination: FAIL Unknown prominent entities detected: 把那枚发烫的钥, 这把钥, 不是黑潮司, 他们送信来说镜湖, 风从两人, 沈泊把钥, 只回应青灯誓
- chapter-006-repeat-3 baseline futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-3 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-3 baseline entityHallucination: FAIL Unknown prominent entities detected: 看着钥, 也不是写给黑潮司, 钥只随守誓的人, 他把镜湖钥, 若这钥
- chapter-006-repeat-3 recent-fill futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-3 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-3 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 声音被湖, 也只回应那句誓, 我没把它给黑潮司, 可以找守灯人, 可这把钥
- chapter-006-repeat-3 four-layer futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-3 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-3 four-layer entityHallucination: FAIL Unknown prominent entities detected: 这把钥, 不是黑潮司, 钥只认青灯誓

## Comparisons

- four-layer vs baseline: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Judge Review

- four-layer vs baseline: win rate 50% (3/6), baseline wins 2, ties 1, invalid 0
- four-layer vs recent-fill: win rate 17% (1/6), baseline wins 5, ties 0, invalid 0

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
