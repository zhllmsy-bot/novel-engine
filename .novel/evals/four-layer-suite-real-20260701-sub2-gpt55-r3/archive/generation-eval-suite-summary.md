# Generation Eval Suite Summary

- Status: fail
- Dry run: false
- Projects: 3
- Readiness: pass (3/3 loaded, 3/3 prompt-ready, 0 errors)
- Paired-run gate: checked from generated paired runs
- Archive: [REDACTED-PATH]/archive

## Comparisons

- four-layer vs baseline: projects 3, paired runs 9, callback win rate 33%, callback mean diff 0.33, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: projects 3, paired runs 9, callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Projects

- 纸鸢旧约: fail, repeats 3, archive [REDACTED-PATH]/delayed-payoff-benchmark
- 霜桥逆火: fail, repeats 3, archive [REDACTED-PATH]/state-drift-benchmark
- 青灯镜湖: fail, repeats 3, archive [REDACTED-PATH]/long-memory-benchmark

## Judge Review

- not run

## Human Review

Use the top-level `human-review.csv` to review all archived samples together. Deterministic scores remain hard-failure triage, not the final prose-quality judgment.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
