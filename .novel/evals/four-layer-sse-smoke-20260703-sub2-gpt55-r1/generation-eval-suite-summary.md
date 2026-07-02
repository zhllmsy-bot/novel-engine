# Generation Eval Suite Summary

- Status: fail
- Dry run: false
- Projects: 1
- Readiness: pass (1/1 loaded, 1/1 prompt-ready, 0 errors)
- Paired-run gate: checked from generated paired runs
- Archive: .novel/evals/four-layer-sse-smoke-20260703-sub2-gpt55-r1

## Comparisons

- four-layer vs baseline: projects 1, paired runs 1, callback win rate 100%, callback mean diff 1, setting violation diff -1, future leak diff 0
- four-layer vs recent-fill: projects 1, paired runs 1, callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Projects

- 纸鸢旧约 (rivergate-answer): underpowered, repeats 1, archive .novel/evals/four-layer-sse-smoke-20260703-sub2-gpt55-r1/delayed-payoff-benchmark-rivergate-answer

## Judge Review

- 纸鸢旧约 (rivergate-answer) four-layer vs baseline: win rate 0% (0/2), baseline wins 2, ties 0, invalid 0
- 纸鸢旧约 (rivergate-answer) four-layer vs recent-fill: win rate 50% (1/2), baseline wins 0, ties 1, invalid 0

## Human Review

Use the top-level `human-review.csv` to review all archived samples together. Deterministic scores remain hard-failure triage, not the final prose-quality judgment.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
