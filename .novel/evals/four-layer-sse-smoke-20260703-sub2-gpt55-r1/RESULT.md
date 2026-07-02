# Four-Layer GPT-5.5 SSE Smoke

Recorded at: 2026-07-03

## Scope

This is a one-case non-dry-run smoke test after adding SSE parsing for the OpenAI-compatible `responses` wire API. It uses the same `gpt-5.5` model for generation and judge review, but only `repeat=1`, so it is not a validation result.

## Fingerprint

- Git commit: `0ee56028ff27f38e3e469bfbbb184c6e944d2289`
- Dirty status in archived report fingerprint: clean, no `-dirty`
- Provider model: `gpt-5.5`
- Wire API: `responses`
- Reasoning effort: `xhigh`
- Case: `delayed-payoff-benchmark / rivergate-answer`

## Result

- Generation arm errors: `0`
- Judge invalid results: `0`
- SSE parsing blocker: resolved for this smoke
- CLI suite status: failed/underpowered by design because `repeat=1`

## Signal

- Deterministic callback: four-layer beat baseline and tied recent-fill.
- Judge: four-layer lost to baseline in this single underpowered sample and split/tied against recent-fill.

This smoke only verifies provider and parser readiness. The full 20-case run remains required for an evaluable conclusion.
