# Generation Eval Suite Summary

- Status: fail
- Dry run: false
- Projects: 20
- Readiness: pass (20/20 loaded, 20/20 prompt-ready, 0 errors)
- Paired-run gate: checked from generated paired runs
- Archive: .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3

## Comparisons

- four-layer vs baseline: projects 20, paired runs 58, callback win rate 24%, callback mean diff 0.24, setting violation diff -0.05, future leak diff 0
- four-layer vs recent-fill: projects 20, paired runs 57, callback win rate 19%, callback mean diff 0.12, setting violation diff 0.05, future leak diff 0

## Projects

- 纸鸢旧约 (rivergate-answer): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/delayed-payoff-benchmark-rivergate-answer
- 纸鸢旧约 (south-canal-vow): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/delayed-payoff-benchmark-south-canal-vow
- 纸鸢旧约 (ledger-token): pass, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/delayed-payoff-benchmark-ledger-token
- 纸鸢旧约 (flood-marker): underpowered, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/delayed-payoff-benchmark-flood-marker
- 纸鸢旧约 (wind-return): pass, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/delayed-payoff-benchmark-wind-return
- 霜桥逆火 (frostbridge-stand): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/state-drift-benchmark-frostbridge-stand
- 霜桥逆火 (snow-inn-name): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/state-drift-benchmark-snow-inn-name
- 霜桥逆火 (charcoal-alley-proof): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/state-drift-benchmark-charcoal-alley-proof
- 霜桥逆火 (north-gate-warrant): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/state-drift-benchmark-north-gate-warrant
- 霜桥逆火 (old-bridge-fire): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/state-drift-benchmark-old-bridge-fire
- 潮灯三卷 (fog-harbor-lamp): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/cross-volume-consistency-benchmark-fog-harbor-lamp
- 潮灯三卷 (stone-dike-choice): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/cross-volume-consistency-benchmark-stone-dike-choice
- 潮灯三卷 (sunken-stele-proof): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/cross-volume-consistency-benchmark-sunken-stele-proof
- 潮灯三卷 (urgent-order): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/cross-volume-consistency-benchmark-urgent-order
- 潮灯三卷 (final-tide-shadow): pass, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/cross-volume-consistency-benchmark-final-tide-shadow
- 回环墓中段 (iron-wall-needle): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-iron-wall-needle
- 回环墓中段 (blind-corridor-echo): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-blind-corridor-echo
- 回环墓中段 (stone-room-turn): underpowered, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-stone-room-turn
- 回环墓中段 (black-step-gate): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-black-step-gate
- 回环墓中段 (tail-light-exit): fail, repeats 3, archive .novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3/lost-in-middle-benchmark-tail-light-exit

## Judge Review

- 纸鸢旧约 (rivergate-answer) four-layer vs baseline: win rate 0% (0/6), baseline wins 5, ties 0, invalid 1
- 纸鸢旧约 (rivergate-answer) four-layer vs recent-fill: win rate 17% (1/6), baseline wins 5, ties 0, invalid 0
- 纸鸢旧约 (south-canal-vow) four-layer vs baseline: win rate 83% (5/6), baseline wins 1, ties 0, invalid 0
- 纸鸢旧约 (south-canal-vow) four-layer vs recent-fill: win rate 67% (4/6), baseline wins 2, ties 0, invalid 0
- 纸鸢旧约 (ledger-token) four-layer vs baseline: win rate 67% (4/6), baseline wins 2, ties 0, invalid 0
- 纸鸢旧约 (ledger-token) four-layer vs recent-fill: win rate 50% (3/6), baseline wins 2, ties 1, invalid 0
- 纸鸢旧约 (flood-marker) four-layer vs baseline: win rate 0% (0/4), baseline wins 2, ties 1, invalid 1
- 纸鸢旧约 (flood-marker) four-layer vs recent-fill: win rate 0% (0/4), baseline wins 4, ties 0, invalid 0
- 纸鸢旧约 (wind-return) four-layer vs baseline: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0
- 纸鸢旧约 (wind-return) four-layer vs recent-fill: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0
- 霜桥逆火 (frostbridge-stand) four-layer vs baseline: win rate 17% (1/6), baseline wins 5, ties 0, invalid 0
- 霜桥逆火 (frostbridge-stand) four-layer vs recent-fill: win rate 50% (3/6), baseline wins 2, ties 1, invalid 0
- 霜桥逆火 (snow-inn-name) four-layer vs baseline: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0
- 霜桥逆火 (snow-inn-name) four-layer vs recent-fill: win rate 0% (0/6), baseline wins 5, ties 0, invalid 1
- 霜桥逆火 (charcoal-alley-proof) four-layer vs baseline: win rate 67% (4/6), baseline wins 2, ties 0, invalid 0
- 霜桥逆火 (charcoal-alley-proof) four-layer vs recent-fill: win rate 83% (5/6), baseline wins 1, ties 0, invalid 0
- 霜桥逆火 (north-gate-warrant) four-layer vs baseline: win rate 0% (0/6), baseline wins 6, ties 0, invalid 0
- 霜桥逆火 (north-gate-warrant) four-layer vs recent-fill: win rate 0% (0/6), baseline wins 6, ties 0, invalid 0
- 霜桥逆火 (old-bridge-fire) four-layer vs baseline: win rate 50% (3/6), baseline wins 3, ties 0, invalid 0
- 霜桥逆火 (old-bridge-fire) four-layer vs recent-fill: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0
- 潮灯三卷 (fog-harbor-lamp) four-layer vs baseline: win rate 40% (2/6), baseline wins 3, ties 0, invalid 1
- 潮灯三卷 (fog-harbor-lamp) four-layer vs recent-fill: win rate 83% (5/6), baseline wins 1, ties 0, invalid 0
- 潮灯三卷 (stone-dike-choice) four-layer vs baseline: win rate 50% (3/6), baseline wins 3, ties 0, invalid 0
- 潮灯三卷 (stone-dike-choice) four-layer vs recent-fill: win rate 83% (5/6), baseline wins 1, ties 0, invalid 0
- 潮灯三卷 (sunken-stele-proof) four-layer vs baseline: win rate 0% (0/6), baseline wins 6, ties 0, invalid 0
- 潮灯三卷 (sunken-stele-proof) four-layer vs recent-fill: win rate 17% (1/6), baseline wins 5, ties 0, invalid 0
- 潮灯三卷 (urgent-order) four-layer vs baseline: win rate 17% (1/6), baseline wins 5, ties 0, invalid 0
- 潮灯三卷 (urgent-order) four-layer vs recent-fill: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0
- 潮灯三卷 (final-tide-shadow) four-layer vs baseline: win rate 33% (2/6), baseline wins 4, ties 0, invalid 0
- 潮灯三卷 (final-tide-shadow) four-layer vs recent-fill: win rate 17% (1/6), baseline wins 5, ties 0, invalid 0
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
