# Generation Eval Suite Summary

- Status: pass
- Dry run: true
- Projects: 3
- Readiness: pass (3/3 loaded, 3/3 prompt-ready, 0 errors)
- Paired-run gate: deferred until non-dry-run generation
- Archive: .novel/evals/four-layer-g3-readiness-20260701

## Comparisons

- four-layer vs baseline: projects 3, paired runs 0, callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: projects 3, paired runs 0, callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Projects

- 纸鸢旧约: not-run, repeats 3, archive .novel/evals/four-layer-g3-readiness-20260701/delayed-payoff-benchmark
- 霜桥逆火: not-run, repeats 3, archive .novel/evals/four-layer-g3-readiness-20260701/state-drift-benchmark
- 青灯镜湖: not-run, repeats 3, archive .novel/evals/four-layer-g3-readiness-20260701/long-memory-benchmark

## Judge Review

- not run

## Human Review

Use the top-level `human-review.csv` to review all archived samples together. Deterministic scores remain hard-failure triage, not the final prose-quality judgment.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
