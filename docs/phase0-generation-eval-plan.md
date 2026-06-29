# Phase 0 Real-Generation Eval Plan

This plan moves Phase 0 from deterministic context-assembly proof to a real
model-generation A/B experiment. Keep this track narrow until it produces a
repeatable value judgment.

## Goal

Prove whether four-layer memory improves actual continuation quality compared
with a recent-prose-only baseline.

## Current Scope

- Baseline A: recent prose only, built from L2 current and near chapters.
- Candidate B: the same four-layer context used by the editor.
- Provider: any OpenAI-compatible `/v1/chat/completions` endpoint.
- Corpus: `examples/long-memory-benchmark` first, then more controlled corpora.
- First-pass scoring: deterministic text criteria for callback hits, setting
  violations, and future leaks.

The first-pass scoring is only a triage signal. It catches obvious wins and
obvious failures, but it does not replace human review or a stronger judge model.

## Commands

Dry-run the A/B prompts without spending tokens:

```bash
npm run generation:eval:long -- --dry-run
npm run generation:eval:long -- --dry-run --show-prompts
```

Run a real model through an OpenAI-compatible gateway:

```bash
NOVEL_ENGINE_EVAL_BASE_URL=http://127.0.0.1:8000 \
NOVEL_ENGINE_EVAL_API_KEY=... \
NOVEL_ENGINE_EVAL_MODEL=... \
npm run generation:eval:long
```

Use `--json` to archive prompt, output, and score data for manual review.

## Acceptance Line

For the long-memory benchmark, Candidate B should:

- beat Baseline A on callback hits,
- not increase setting violations,
- have zero future-leak hits,
- produce prose that a human reviewer judges as a natural continuation.

The deterministic gate can pass while prose quality is still weak. Human review
is the final Phase 0 decision.

## Todo

- [x] Add `generation:eval` dry-run prompt builder.
- [x] Add OpenAI-compatible real-generation path.
- [x] Add `meta/generation-eval.json` criteria for the long-memory benchmark.
- [x] Add deterministic first-pass scoring for generated text.
- [ ] Add result archiving under `.novel/evals/` for repeatable review.
- [ ] Add a judge prompt that compares A/B outputs without seeing arm labels.
- [ ] Add at least two more benchmark corpora with different failure modes:
      character state drift and delayed plot-thread payoff.
- [ ] Add a human review template for author-facing quality notes.

## Frozen Until Phase 0 Generates Real Evidence

- Native Claude/Gemini adapters.
- L3 FTS5 recall expansion.
- Alias normalization and stopword tuning.
- Whole-book consistency checks.
- Skill marketplace or sharing UX.
