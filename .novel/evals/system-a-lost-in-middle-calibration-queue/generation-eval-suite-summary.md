# Generation Eval Suite Summary

- Status: fail
- Dry run: false
- Projects: 20
- Readiness: pass (20/20 loaded, 20/20 prompt-ready, 0 errors)
- Paired-run gate: checked from generated paired runs
- Archive: .novel/evals/system-a-lost-in-middle-calibration-queue

## Comparisons

- four-layer vs baseline: projects 20, paired runs 58, callback win rate 24%, callback mean diff 0.24, setting violation diff -0.05, future leak diff 0
- four-layer vs recent-fill: projects 20, paired runs 57, callback win rate 19%, callback mean diff 0.12, setting violation diff 0.05, future leak diff 0

## Projects

- 回环墓中段 (iron-wall-needle): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-iron-wall-needle
- 回环墓中段 (blind-corridor-echo): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-blind-corridor-echo
- 回环墓中段 (stone-room-turn): underpowered, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-stone-room-turn
- 回环墓中段 (black-step-gate): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-black-step-gate
- 回环墓中段 (tail-light-exit): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-tail-light-exit

## Judge Review

- 回环墓中段 (iron-wall-needle) four-layer vs baseline: win rate 67% (4/6), baseline wins 2, ties 0, invalid 0
- 回环墓中段 (iron-wall-needle) four-layer vs recent-fill: win rate 50% (3/6), baseline wins 3, ties 0, invalid 0
- 回环墓中段 (blind-corridor-echo) four-layer vs baseline: win rate 50% (3/6), baseline wins 3, ties 0, invalid 0
- 回环墓中段 (blind-corridor-echo) four-layer vs recent-fill: win rate 100% (6/6), baseline wins 0, ties 0, invalid 0
- 回环墓中段 (stone-room-turn) four-layer vs baseline: win rate 25% (1/4), baseline wins 3, ties 0, invalid 0
- 回环墓中段 (stone-room-turn) four-layer vs recent-fill: win rate 0% (0/2), baseline wins 2, ties 0, invalid 0
- 回环墓中段 (black-step-gate) four-layer vs baseline: win rate 75% (3/6), baseline wins 1, ties 0, invalid 2
- 回环墓中段 (black-step-gate) four-layer vs recent-fill: win rate 83% (5/6), baseline wins 1, ties 0, invalid 0
- 回环墓中段 (tail-light-exit) four-layer vs baseline: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0
- 回环墓中段 (tail-light-exit) four-layer vs recent-fill: win rate 67% (4/6), baseline wins 2, ties 0, invalid 0

## Human Review

Use the top-level `human-review.csv` to review all archived samples together. Deterministic scores remain hard-failure triage, not the final prose-quality judgment.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
