# Generation Eval Suite Summary

- Status: pass
- Dry run: true
- Projects: 15
- Readiness: pass (15/15 loaded, 15/15 prompt-ready, 0 errors)
- Paired-run gate: deferred until non-dry-run generation
- Archive: .novel/evals/a0-causal-dry-run

## Comparisons

- four-layer vs baseline: projects 15, paired runs 0, callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0
- four-layer vs recent-fill: projects 15, paired runs 0, callback win rate 0%, callback mean diff 0, setting violation diff 0, future leak diff 0

## Projects

- 霜桥逆火 (frostbridge-stand): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/state-drift-benchmark-frostbridge-stand
- 霜桥逆火 (snow-inn-name): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/state-drift-benchmark-snow-inn-name
- 霜桥逆火 (charcoal-alley-proof): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/state-drift-benchmark-charcoal-alley-proof
- 霜桥逆火 (north-gate-warrant): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/state-drift-benchmark-north-gate-warrant
- 霜桥逆火 (old-bridge-fire): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/state-drift-benchmark-old-bridge-fire
- 纸鸢旧约 (rivergate-answer): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/delayed-payoff-benchmark-rivergate-answer
- 纸鸢旧约 (south-canal-vow): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/delayed-payoff-benchmark-south-canal-vow
- 纸鸢旧约 (ledger-token): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/delayed-payoff-benchmark-ledger-token
- 纸鸢旧约 (flood-marker): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/delayed-payoff-benchmark-flood-marker
- 纸鸢旧约 (wind-return): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/delayed-payoff-benchmark-wind-return
- 回环墓中段 (iron-wall-needle): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/lost-in-middle-benchmark-iron-wall-needle
- 回环墓中段 (blind-corridor-echo): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/lost-in-middle-benchmark-blind-corridor-echo
- 回环墓中段 (stone-room-turn): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/lost-in-middle-benchmark-stone-room-turn
- 回环墓中段 (black-step-gate): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/lost-in-middle-benchmark-black-step-gate
- 回环墓中段 (tail-light-exit): not-run, repeats 3, archive .novel/evals/a0-causal-dry-run/lost-in-middle-benchmark-tail-light-exit

## Judge Review

- not run

## Human Review

Use the top-level `human-review.csv` to review all archived samples together. Deterministic scores remain hard-failure triage, not the final prose-quality judgment.
Use `judge-review-prompts.jsonl` for position-swapped judge-model or human pairwise review.
