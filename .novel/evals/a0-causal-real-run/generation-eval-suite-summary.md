# Generation Eval Suite Summary

- Status: fail
- Dry run: false
- Projects: 15
- Readiness: pass (15/15 loaded, 15/15 prompt-ready, 0 errors)
- Paired-run gate: checked from generated paired runs
- Archive: .novel/evals/a0-causal-real-run

## Comparisons

- four-layer vs baseline: projects 15, paired runs 15, callback win rate 27%, callback mean diff 0.20, setting violation diff -0.13, future leak diff 0
- four-layer vs recent-fill: projects 15, paired runs 15, callback win rate 20%, callback mean diff 0.20, setting violation diff -0.07, future leak diff 0

## Projects

- 霜桥逆火 (frostbridge-stand): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/state-drift-benchmark-frostbridge-stand
- 霜桥逆火 (snow-inn-name): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/state-drift-benchmark-snow-inn-name
- 霜桥逆火 (charcoal-alley-proof): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/state-drift-benchmark-charcoal-alley-proof
- 霜桥逆火 (north-gate-warrant): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/state-drift-benchmark-north-gate-warrant
- 霜桥逆火 (old-bridge-fire): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/state-drift-benchmark-old-bridge-fire
- 纸鸢旧约 (rivergate-answer): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/delayed-payoff-benchmark-rivergate-answer
- 纸鸢旧约 (south-canal-vow): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/delayed-payoff-benchmark-south-canal-vow
- 纸鸢旧约 (ledger-token): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/delayed-payoff-benchmark-ledger-token
- 纸鸢旧约 (flood-marker): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/delayed-payoff-benchmark-flood-marker
- 纸鸢旧约 (wind-return): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/delayed-payoff-benchmark-wind-return
- 回环墓中段 (iron-wall-needle): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/lost-in-middle-benchmark-iron-wall-needle
- 回环墓中段 (blind-corridor-echo): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/lost-in-middle-benchmark-blind-corridor-echo
- 回环墓中段 (stone-room-turn): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/lost-in-middle-benchmark-stone-room-turn
- 回环墓中段 (black-step-gate): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/lost-in-middle-benchmark-black-step-gate
- 回环墓中段 (tail-light-exit): underpowered, repeats 1, archive .novel/evals/a0-causal-real-run/lost-in-middle-benchmark-tail-light-exit

## Judge Review

- not run

## Human Review

Use the top-level `human-review.csv` to review all archived samples together. Deterministic scores remain hard-failure triage, not the final prose-quality judgment.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
