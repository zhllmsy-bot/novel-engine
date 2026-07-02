# Four-Layer Clean Validation Result

## Fingerprint

- Code commit: `908adb3039fbe38ceca18e7486478117dea24ac6`
- Worktree: isolated clean worktree at `/tmp/novel-engine-clean-eval-908adb3`
- Dirty fingerprints: `0/20`
- Model: `gpt-5.5`
- Judge/review model: `gpt-5.5`
- Wire API: `responses`
- Reasoning effort: `xhigh`
- Repeat count: `3`
- Projects/cases: `20/20`
- Readiness: PASS, loaded `20/20`, prompt-ready `20/20`, errors `0`
- Cohen's kappa: unavailable; no real human labels were filled, so judge rates are recorded but not human-calibrated.

## Metrics

| Metric | baseline | recent-fill | four-layer |
|---|---:|---:|---:|
| Completed runs | 60 | 59 | 58 |
| Provider/arm errors | 0 | 1 | 2 |
| Mean score | 2.88 | 3.10 | 3.17 |
| Mean callback hits | 0.00 | 0.12 | 0.24 |
| Setting violations | 7 | 1 | 4 |
| Future leaks | 0 | 0 | 0 |
| setting_recall | 20/20 | 20/20 | 20/20 |
| foreshadow_coverage | 0/20 | 6/20 | 20/20 |

Suite comparisons:

| Comparison | pairedRuns | callback win | callback diff | setting violation diff | future leak diff |
|---|---:|---:|---:|---:|---:|
| four-layer vs baseline | 58 | 24% | +0.24 | -0.05 | 0 |
| four-layer vs recent-fill | 57 | 19% | +0.12 | +0.05 | 0 |

Judge/review results:

| Comparison | pairedReviews | four-layer wins | baseline/recent wins | ties | invalid | four-layer win rate |
|---|---:|---:|---:|---:|---:|---:|
| four-layer vs baseline | 116 | 42 | 68 | 1 | 5 | 37.8% |
| four-layer vs recent-fill | 114 | 52 | 59 | 2 | 1 | 46.0% |

Gate counts: `3 pass`, `15 fail`, `2 underpowered`.

## Conclusion

Selected conclusion: **WEAK / NEGATIVE SIGNAL, not strong validation**.

The clean run proves the four-layer context builder carries long-range memory better at the prompt-structure layer: foreshadow coverage is `20/20` for four-layer versus `6/20` for recent-fill and `0/20` for baseline. However, this did not translate into a reliable generation or judge advantage. Against recent-fill, four-layer had only `19%` callback win rate and `46.0%` uncalibrated judge win rate, with slightly more setting violations.

This is **not a structural falsification** of the memory engine because the structural recall layer clearly leads. It is also **not a strong confirmation** because four-layer does not beat the same-budget recent-fill control in the outcome metrics.

Next-round single action: improve prompting/model instruction so the generator actually uses the supplied four-layer memory; do not change memory-engine logic based on this run alone.
