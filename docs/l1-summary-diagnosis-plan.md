# L1 Summary Diagnosis Plan

This note records the Phase 0 A0 follow-up after the local-vs-causal L1
ablation. The goal is to keep the next L1 work evidence-led and separate from
generation-engine changes.

## Current Evidence

Use the reusable diagnostic command:

```bash
npm run generation:l1-diagnose -- --out .novel/evals/l1-diagnosis.json
```

The first run on the five generation benchmark projects produced:

- 15 analyzed cases; 2 projects skipped because they do not yet have
  `meta/l1-ablation-summaries.json`.
- 30 positive callback/setting criteria.
- Local summary corpus coverage: 30/30.
- Causal fixture summary corpus coverage: 30/30.
- Local four-layer prompt coverage: 25/30.
- Causal fixture four-layer prompt coverage: 30/30.
- The 5 uncovered local prompt criteria are all
  `lost-in-middle` callback cases for the middle compass rule.

The important distinction is that the local L1 summaries are not simply empty:
the expected terms are present somewhere in the relevant local summary corpus.
The failure appears when those summaries are budgeted, compressed, and placed
into the final four-layer prompt. In the lost-in-middle cases, local summaries
let the usable causal rule fall behind less actionable context, while the
causal fixture puts the rule near the front where it survives truncation.

## Diagnosis Categories

`tools/generation-l1-diagnose.ts` compares local and causal L1 at two levels:

- summary corpus coverage: does the time-sliced L1 summary set contain the
  positive callback/setting criteria?
- prompt coverage: does the dry-run four-layer prompt contain those same
  positive criteria after budget selection?

It classifies each positive criterion as:

- `covered-by-local`: local summary and local prompt both preserve the signal.
- `local-l1-summary-gap`: causal summary covers a signal that local summary
  does not.
- `four-layer-budget-or-ranking-gap`: local summary covers a signal, but the
  local four-layer prompt loses it while the causal prompt keeps it.
- `causal-fixture-missing-coverage`: the oracle fixture itself does not cover
  the positive criterion.

The command intentionally ignores `notContains` for positive L1 recall
coverage. Negative leak and ban checks remain exact scoring constraints, not
signals the summary should try to include.

## L1 Summary Fix Hypothesis

The next engine change should improve the local chapter-summary representation,
not the generation scorer and not the provider-facing generation path.

Prioritized changes:

1. Split causal rules from general prose in the local summary output.
   `summary` can remain readable prose, but `keyEvents` should preserve
   compact, front-loaded causal rules such as object rule, reversal, promise,
   obligation, and exception.
2. Raise deterministic scoring for sentences that encode operational rules:
   "if/then", "must", "cannot", "the real path is", "opposite of visible
   cue", delayed promise, and state reversal.
3. Prefer exact rule sentences over nearby atmosphere when building the
   structured summary. The lost-in-middle failure shows that "the scene is about
   the tomb/compass" is weaker than "the tail of the needle points to the safe
   gate".
4. Put the strongest causal rule near the beginning of `summary` or in the
   first `keyEvents` slot so it survives L3 recall snippets and L1 distant
   compression.
5. Keep edited summaries authoritative. These changes apply only to generated
   local fallback summaries and provider-generated structured summaries before
   user edits.

## Success Line

Before rerunning expensive model generation, the deterministic line is:

- `npm run generation:l1-diagnose` shows local four-layer prompt coverage near
  causal fixture prompt coverage on the A0 fixture projects.
- The current lost-in-middle 5/5 `four-layer-budget-or-ranking-gap` callbacks
  move to `covered-by-local`.
- Baseline and recent-fill prompt leakage does not increase for the same
  callback criteria.
- Existing generation scorer tests, generation eval tests, and typecheck pass.

After that, run a clean real-generation A0:

```bash
npm run generation:eval -- \
  --benchmark-project examples/delayed-payoff-benchmark \
  --benchmark-project examples/lost-in-middle-benchmark \
  --benchmark-project examples/state-drift-benchmark \
  --l1-mode local \
  --repeat 3 \
  --archive-dir .novel/evals/a0-local-real-run-n3

npm run generation:eval -- \
  --benchmark-project examples/delayed-payoff-benchmark \
  --benchmark-project examples/lost-in-middle-benchmark \
  --benchmark-project examples/state-drift-benchmark \
  --l1-mode causal-fixture \
  --repeat 3 \
  --archive-dir .novel/evals/a0-causal-real-run-n3
```

Then compare the two archives with `npm run generation:a0`. Treat the causal
fixture as an upper bound, not proof that product L1 has reached that quality.
