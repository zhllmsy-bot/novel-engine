# Four-Layer Suite Real Run

Recorded at: 2026-07-01

## Scope

This is a real non-dry-run suite on the three existing benchmark projects. It verifies that G3b can produce paired generation data after the dry-run readiness gate fix.

This is **not** the final full validation matrix because the repository still lacks the planned fourth task, the two additional long-memory task types, N >= 5 entry points per task, and human-review kappa calibration.

## Fingerprint

- Git commit: `061efb0dd9f8d64a139a1b484fdb8441a659ffd7`
- Provider model: `gpt-5.5`
- Wire API: `responses`
- Reasoning effort: `xhigh`
- Repeats: `3`
- Projects: `3`
- Dirty status before run: clean
- Dirty status after run: clean

## Result

- Readiness: PASS, `3/3 loaded`, `3/3 prompt-ready`, `0 errors`
- Total paired runs: `9`
- Arm generation errors: `0`
- Future leak diff: `0`
- Setting violation mean diff: `0`

## Aggregate Comparisons

| Comparison | Paired runs | Callback win mean | Callback mean diff | Setting violation diff | Future leak diff |
|---|---:|---:|---:|---:|---:|
| four-layer vs baseline | 9 | 33% | 0.33 | 0 | 0 |
| four-layer vs recent-fill | 9 | 0% | 0 | 0 | 0 |

## Project Notes

- `纸鸢旧约`: four-layer beats baseline on callback, ties recent-fill.
- `霜桥逆火`: all arms miss the callback criterion.
- `青灯镜湖`: all arms satisfy callback and setting criteria.

## Interim Interpretation

The G3 blocker is resolved: real generation now produces paired data. The current three-project deterministic signal still does not show four-layer outperforming recent-fill. Treat this as an interim weak/negative signal only, not the final conclusion, because the planned full matrix and kappa-calibrated human review have not been run.
