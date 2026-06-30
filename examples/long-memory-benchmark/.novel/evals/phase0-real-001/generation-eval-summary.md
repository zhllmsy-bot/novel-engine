# Generation Eval Summary

- Status: fail
- Project: 青灯镜湖
- Chapter: chapter-006
- Repeats: 3
- Provider: openai-compatible model=gpt-5.5 baseUrl=https://sub.kedaya.xyz wire=responses reasoning=xhigh
- Fingerprint: git=cc49e606e8a369f595b19292be3a120171c57bc8-dirty, dataset=305d5b8303492974, config=12a00c6819a1f20b
- Archive: /Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine/examples/long-memory-benchmark/.novel/evals/phase0-real-001
- Run note: this real run was produced before the dirty-worktree suffix was added to the fingerprinting code; the report JSON preserves the raw tool output, and this summary marks the run as dirty for interpretation.

## Gate

- OK: false
- Reasons: insufficient-callback-win-vs-recent-fill

## Arms

- baseline: runs 3, errors 0, score 3±1, callbacks 0.33±0.58, setting violations 0.33±0.58, future leaks 0
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
- chapter-006-repeat-1 baseline entityHallucination: FAIL Unknown prominent entities detected: 沈泊的声音被湖, 它不是黑潮司, 石塔的人, 知道他们要的是钥, 还是要借这把钥, 把镜湖, 我不是不信誓, 我是不信黑潮司
- chapter-006-repeat-1 recent-fill futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-1 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-1 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 让那枚发烫的钥, 留在两人, 石塔有人, 说镜湖, 若有一天镜湖, 千万不要把钥, 像是听见了旧誓, 不是黑潮司
- chapter-006-repeat-1 four-layer futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-1 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-1 four-layer entityHallucination: FAIL Unknown prominent entities detected: 那枚钥, 这把钥, 也不是黑潮司, 它只会回应青灯誓, 万不能交给黑潮司, 我没有把誓
- chapter-006-repeat-2 baseline futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-2 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-2 baseline entityHallucination: FAIL Unknown prominent entities detected: 声音被湖, 不会因为镜湖, 是我不信黑潮司, 若这钥真该有人
- chapter-006-repeat-2 recent-fill futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-2 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-2 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 他把发烫的镜湖钥, 这把钥, 雾市里黑潮司, 找守灯人, 石塔里有人, 们又送信来说镜湖, 千万不能把钥, 交给黑潮司, 声音被湖
- chapter-006-repeat-2 four-layer futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-2 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-2 four-layer entityHallucination: FAIL Unknown prominent entities detected: 这把钥, 不是黑潮司, 都不是守灯人, 千万不要把钥, 这把钥
- chapter-006-repeat-3 baseline futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-3 baseline codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-3 baseline entityHallucination: FAIL Unknown prominent entities detected: 让那枚发烫的镜湖, 钥没有交给黑潮司, 他们说镜湖, 不说是谁要这把钥, 不是欠黑潮司, 若这钥
- chapter-006-repeat-3 recent-fill futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-3 recent-fill codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-3 recent-fill entityHallucination: FAIL Unknown prominent entities detected: 掌心里的镜湖钥, 这把钥, 不是黑潮司, 若有一天镜湖, 后来雾市里有人, 找守灯人, 石塔的人, 沈泊把钥举到两人, 声音被湖, 也记得青灯誓, 所以我带它回镜湖
- chapter-006-repeat-3 four-layer futureLeak: PASS No future-only entities or events appeared.
- chapter-006-repeat-3 four-layer codexViolation: PASS Generated text avoids configured setting contradictions.
- chapter-006-repeat-3 four-layer entityHallucination: FAIL Unknown prominent entities detected: 声音被湖, 只把钥举到两人, 也不是黑潮司, 他们想要湖, 可钥只认那句誓

## Comparisons

- four-layer vs baseline: callback win rate 67%, callback mean diff 0.67, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Judge Review

- four-layer vs baseline: win rate 17% (1/6), baseline wins 5, ties 0, invalid 0
- four-layer vs recent-fill: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0

## Human Review

Use `human-review.csv` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
