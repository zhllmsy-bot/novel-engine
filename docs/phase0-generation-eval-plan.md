# Phase 0 Real-Generation Eval Plan

This plan moves Phase 0 from deterministic context-assembly proof to a real
model-generation A/B experiment. Keep this track narrow until it produces a
repeatable value judgment.

## Goal

Prove whether four-layer memory improves actual continuation quality compared
with recent-prose-only baselines.

## Current Scope

- Baseline A: recent prose only, built from L2 current and near chapters.
- Control C: the same budget filled with plain recent prose.
- Candidate B: the same four-layer context used by the editor.
- Provider: any OpenAI-compatible `/v1/chat/completions` endpoint.
- Corpus: `examples/long-memory-benchmark`,
  `examples/state-drift-benchmark`, and
  `examples/delayed-payoff-benchmark` as the initial frozen suite.
- Repeats: default 3 per arm, enough to avoid single-sample comfort.
- First-pass scoring: deterministic text criteria for callback hits, setting
  violations, and future leaks.
- Eval core: reusable `src/eval` functions for L1 guards, L2 structure metrics,
  and L3 pairwise judge prompts.

The first-pass scoring is only a triage signal. It catches obvious wins and
obvious failures, but it does not replace human review or a stronger judge model.

## Commands

Dry-run the A/B prompts without spending tokens:

```bash
npm run generation:eval:long -- --dry-run
npm run generation:eval:long -- --dry-run --show-prompts
npm run generation:eval:long -- --dry-run --archive-dir .novel/evals/dry-run
```

Run a real model through an OpenAI-compatible gateway:

```bash
NOVEL_ENGINE_EVAL_BASE_URL=http://127.0.0.1:8000 \
NOVEL_ENGINE_EVAL_API_KEY=... \
NOVEL_ENGINE_EVAL_MODEL=... \
npm run generation:eval:long -- --repeat 3 --archive-dir .novel/evals/run-001
```

Run a suite across benchmark projects:

```bash
npm run generation:eval -- --dry-run \
  --benchmark-project examples/long-memory-benchmark \
  --benchmark-project examples/state-drift-benchmark \
  --benchmark-project examples/delayed-payoff-benchmark \
  --archive-dir .novel/evals/suite-dry-run
```

Use `--json` for machine-readable console output. Use `--archive-dir` for the
real deliverable: prompt, output, score, guard, structure-metric, summary,
`human-review.csv`, and `judge-review-prompts.jsonl` files that can be reviewed
and compared later.

## Acceptance Line

For real runs, Candidate B should:

- beat Baseline A and Control C with at least a 60% paired callback win rate,
- not increase setting violations,
- have zero future-leak hits,
- produce prose that a human reviewer judges as a natural continuation.

Runs with fewer than 3 scored paired samples are marked `underpowered` instead
of passed. A tie is not success; the memory engine has to earn its complexity.
The deterministic gate can pass while prose quality is still weak. Human review
is the final Phase 0 decision.

## Todo

- [x] Add `generation:eval` dry-run prompt builder.
- [x] Add OpenAI-compatible real-generation path.
- [x] Add `meta/generation-eval.json` criteria for the long-memory benchmark.
- [x] Add deterministic first-pass scoring for generated text.
- [x] Add A/B/C arms with same-budget recent-prose control.
- [x] Add repeat aggregation and underpowered gate.
- [x] Add result archiving under `.novel/evals/` for repeatable review.
- [x] Add a human review CSV template for author-facing quality notes.
- [x] Add reusable L1 redline guards for future leaks, setting contradictions,
      and prominent entity hallucinations.
- [x] Add first-pass L2 structure metrics for setting recall and foreshadow
      coverage in prompt context.
- [x] Add position-swapped judge prompts that compare outputs without seeing
      arm labels.
- [ ] Add promptfoo wrapper config around the reusable guards/metrics once the
      local harness has enough benchmark projects.
- [x] Add at least two more benchmark corpora with different failure modes:
      character state drift and delayed plot-thread payoff.

## Frozen Until Phase 0 Generates Real Evidence

- Native Claude/Gemini adapters.
- L3 FTS5 recall expansion.
- Alias normalization and stopword tuning.
- Whole-book consistency checks.
- Skill marketplace or sharing UX.
