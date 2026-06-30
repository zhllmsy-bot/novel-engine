# Generation Eval Suite Summary

- Status: fail
- Dry run: false
- Projects: 3
- Archive: .novel/evals/phase0-suite-real-001

## Comparisons

- four-layer vs baseline: projects 3, paired runs 0, callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: projects 3, paired runs 0, callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Projects

- 青灯镜湖: underpowered, repeats 3, archive .novel/evals/phase0-suite-real-001/long-memory-benchmark
- 霜桥逆火: underpowered, repeats 3, archive .novel/evals/phase0-suite-real-001/state-drift-benchmark
- 纸鸢旧约: underpowered, repeats 3, archive .novel/evals/phase0-suite-real-001/delayed-payoff-benchmark

## Judge Review

- 青灯镜湖 four-layer vs baseline: win rate 0% (0/0), baseline wins 0, ties 0, invalid 0
- 青灯镜湖 four-layer vs recent-fill: win rate 0% (0/0), baseline wins 0, ties 0, invalid 0
- 霜桥逆火 four-layer vs baseline: win rate 0% (0/0), baseline wins 0, ties 0, invalid 0
- 霜桥逆火 four-layer vs recent-fill: win rate 0% (0/0), baseline wins 0, ties 0, invalid 0
- 纸鸢旧约 four-layer vs baseline: win rate 0% (0/0), baseline wins 0, ties 0, invalid 0
- 纸鸢旧约 four-layer vs recent-fill: win rate 0% (0/0), baseline wins 0, ties 0, invalid 0

## Human Review

Use the top-level `human-review.csv` to review all archived samples together. Deterministic scores remain hard-failure triage, not the final prose-quality judgment.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
