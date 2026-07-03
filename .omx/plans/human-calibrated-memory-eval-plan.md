# Human-Calibrated Memory Eval Development Plan

## Requirements Summary

The immediate goal is not to build a full human correction product. The goal is to turn the current Phase 0 generation harness into a trustworthy, human-calibrated decision loop for the four-layer memory claim.

The key design constraint from the latest research input is:

- Nobody judges from memory.
- L0 codex facts are the shared authority for generation, model judging, human audit, and later correction.
- Human labels are not automatically ground truth; they are weighted by gold checks, duplicate checks, elapsed time, and fatigue.
- A0 happens before judge calibration, so A0 branching decisions cannot depend on judge win rate.
- Oracle causal fixtures are diagnostic upper bounds, not proof that generated L1 summaries will deliver the same gain.
- System B correction is important but must remain a roadmap item until System A and the L1 diagnosis are resolved.

## Current Evidence

- The project already defines the four-layer memory contract and explicitly treats L0 as durable facts and L1 as rebuildable plot memory in [docs/memory-architecture.md](/Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine/docs/memory-architecture.md:14).
- The Phase 0 plan already scopes A/B/C generation evaluation, archive artifacts, human review, and position-swapped judge prompts in [docs/phase0-generation-eval-plan.md](/Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine/docs/phase0-generation-eval-plan.md:12).
- `generation-eval` already loads project chapters and codex, builds local L1 summaries, then creates `baseline`, `recent-fill`, and `four-layer` arms in [tools/generation-eval.ts](/Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine/tools/generation-eval.ts:541).
- `recent-fill` is already implemented as same-budget recent prose, while baseline is near-chapter L2 prose in [tools/generation-eval.ts](/Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine/tools/generation-eval.ts:1714).
- `generation-eval` already archives `human-review.csv`, `human-pairwise-review.csv`, `judge-review-prompts.jsonl`, `judge-results.json`, and traces in [tools/generation-eval.ts](/Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine/tools/generation-eval.ts:2098).
- Current pairwise judge prompts are blind, but they do not pin L0 facts or require evidence/location output in [src/eval/judgeReview.ts](/Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine/src/eval/judgeReview.ts:9).
- `judge-kappa` computes Cohen's kappa against human pairwise labels, but only uses `human_choice` and judge choice; it does not measure human self-consistency yet in [tools/judge-kappa.ts](/Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine/tools/judge-kappa.ts:58).
- L1 summaries are currently built by `generateLocalChapterSummary`, which compresses selected sentences into a compact structured summary in [src/memory/chapterSummaryStore.ts](/Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine/src/memory/chapterSummaryStore.ts:95).
- Benchmark coverage is now broader than the older doc states: `examples/lost-in-middle-benchmark`, `examples/state-drift-benchmark`, `examples/delayed-payoff-benchmark`, and `examples/cross-volume-consistency-benchmark` all provide multi-case generation configs.

## Decision

Build this in three serial phases:

1. A0 L1 ablation gate.
2. System A judge calibration with L0-pinned audit packets and human reliability metrics.
3. System B correction roadmap only, no product implementation yet.

This order minimizes wasted human labeling. A0 may justify an L1-first branch only when a pre-registered deterministic primary metric clears its threshold with uncertainty accounted for. Judge-model win rate before calibration is archived as exploratory evidence only and must not drive the A0 branch.

## Acceptance Criteria

- A0 can run the same benchmark cases with the same A/B/C arms while substituting only the L1 summary source for `four-layer`; baseline and `recent-fill` remain unchanged.
- A0 archives enough metadata to prove that only L1 changed: summary mode, summary source hash, prompt fingerprint, case id, repeat count, provider config hash, and pre-registered metric version.
- A0 reports a pre-registered deterministic primary metric with a confidence interval; auxiliary metrics are reported as supporting evidence only.
- System A judge prompts output structured `choice`, `claim`, `evidence`, `location`, `needleStatus`, and `reason`; invalid responses are counted separately.
- Human audit packets include L0 pinned facts, first-established chapter or best available provenance, relevant criteria, left/right samples, judge claim/evidence/location, and the original pair metadata.
- Human audit packets report needle mapping coverage and explicitly mark unmapped criteria rather than dropping them.
- Review queues can inject gold rows and duplicate rows without polluting the canonical pairwise result counts.
- Human reliability reports include labeled rows, usable rows, gold accuracy, duplicate consistency, elapsed/fatigue metadata coverage, kappa with confidence interval, audit pass rate, annotator-count semantics, and a single `okToTrustJudge` boolean.
- The trust function fails closed when human self-consistency is below threshold, when usable labels are below the minimum, when judge invalid rate is high, when elapsed metadata is missing for a certification run, or when the kappa confidence interval lower bound is below threshold.
- All new behavior has focused Vitest coverage, and existing `npm run generation:eval -- --dry-run ...`, `npm run generation:kappa`, `npm run test -- tools/generation-eval.test.ts tools/judge-kappa.test.ts`, and `npm run typecheck` remain green.

## Phase 1: A0 L1 Ablation Gate

### Why

The current weak signal may be caused by L1 compressing away causal transition chains. The code already creates evaluation summaries at generation time in [tools/generation-eval.ts](/Users/admin/Documents/Codex/2026-06-25/git-git-git-commit-branch-merge/work/novel-engine/tools/generation-eval.ts:587), so this is the cheapest place to test the hypothesis without touching editor runtime.

### Implementation Steps

1. Add an explicit L1 eval mode to `tools/generation-eval.ts`.
   - CLI: `--l1-mode local|causal-fixture`.
   - Type: include `l1Mode` in `GenerationEvalReport.provider` or a new `evalConfig` metadata object.
   - Default remains `local` to preserve current behavior.

2. Add fixture-backed causal summaries.
   - New optional file per benchmark: `meta/l1-ablation-summaries.json`.
   - Shape: `{ "summaries": [{ "chapter_id": "...", "summary": "...", "key_events": [], "characters_involved": [] }] }`.
   - Keep this outside `schemas/generation-eval.schema.json` at first so it is clearly experimental and does not widen the public eval config prematurely.
   - Treat these summaries as oracle upper-bound fixtures. They can show whether a better L1 could matter, but they do not prove that an automatic model-generated L1 will realize the same gain.

3. Change only the `four-layer` plan when `--l1-mode causal-fixture`.
   - `baselinePlan` and `recentFillPlan` remain exactly as they are.
   - `fourLayerPlan` receives fixture summaries instead of `buildEvaluationSummaries`.
   - Archive both the raw fixture summaries and their hash.

4. Add an A0 summary comparator.
   - Command: `npm run generation:a0 -- --local-archive <archive-a> --fixture-archive <archive-b>`.
   - Minimal first version reads two `generation-eval-report.json` or `generation-eval-suite.json` archives and reports deltas for four-layer vs recent-fill callback win rate, setting violation diff, and future leak diff.
   - If judge results exist, show them in a separate `uncalibratedJudgeExploratory` block that is never used by the A0 branch decision.
   - Include Wilson intervals for the primary callback structural win rate and for any binary auxiliary rate.

5. Pre-register A0 decision metrics in code and archives.
   - Primary metric: four-layer vs `recent-fill` callback structural win rate on the targeted weak families.
   - Primary threshold: callback structural win-rate delta against local L1 must be >= +15 percentage points and the Wilson lower bound for the fixture condition must clear 50%.
   - Auxiliary metrics: setting violation mean diff improves by >= 0.25 and future leak diff does not worsen.
   - Branch rule: L1-first requires the primary metric to pass and no auxiliary safety regression. Auxiliary metrics alone cannot trigger L1-first.
   - If the primary point estimate passes but the confidence interval is too wide, mark A0 `underpowered` and expand cases/repeats before branching.

6. Add tests.
   - `tools/generation-eval.test.ts`: parses `--l1-mode causal-fixture`.
   - Dry run with fixture proves four-layer prompt includes fixture causal summary while baseline/recent-fill prompts do not.
   - Archive contains L1 mode and fixture hash.
   - Comparator output keeps uncalibrated judge metrics out of the A0 branch decision.

### A0 Acceptance Line

Proceed to L1 implementation before judge calibration only if the pre-registered deterministic primary metric passes:

- Primary: four-layer vs `recent-fill` callback structural win-rate delta against local L1 is >= +15 percentage points, and the fixture condition's Wilson lower bound is > 50%.
- Safety: setting violation mean diff does not worsen and future leak diff does not worsen.
- Power: if the primary point estimate passes but the interval is too wide, the result is `underpowered`, not L1-first.

Setting violation improvement is auxiliary evidence. Uncalibrated judge win rate is exploratory evidence only. If the primary metric does not pass, proceed to System A calibration first. If oracle fixtures do not move the metric, L1 is strongly deprioritized as the bottleneck. If oracle fixtures do move the metric, L1 becomes a candidate bottleneck, but this is necessary-not-sufficient evidence: the next L1 task must prove that automatic generated causal summaries can approach the oracle effect.

### A0 Real Run Result

Executed on 2026-07-03 with `gpt-5.5`, `responses`, `xhigh`, `repeat=1` over `state-drift`, `delayed-payoff`, and `lost-in-middle`.

- Local archive: `.novel/evals/a0-local-real-run`
- Causal fixture archive: `.novel/evals/a0-causal-real-run`
- Decision artifact: `.novel/evals/a0-decision.json`
- Result: `fail`
- Failed reason: `insufficient-callback-delta`
- Local callback win rate: `3/15 = 20%`
- Fixture callback win rate: `3/15 = 20%`
- Primary delta: `0`, below the pre-registered `+15pp` threshold.
- Fixture Wilson 95% interval: `7%-45%`
- Safety: setting violation regression `-0.13`, future leak regression `0`

Branch consequence: do not take the L1-first branch on this oracle fixture evidence. Proceed to System A judge calibration before investing in L1 implementation, unless a separately pre-registered A0 expansion is approved.

## Phase 2: System A Judge Calibration

### Current Minimal Implementation Status

Implemented in the bounded System A pass:

- `generation-eval` archives `audit-packets.jsonl` and `judge-review-audit-prompts.jsonl` so the judge and human reviewer can share L0-pinned facts.
- `tools/judge-kappa.ts --build-human-audit` creates `human-audit.tsv` from archived audit packets.
- `tools/judge-kappa.ts --build-review-queue` creates `review-queue.tsv` as a superset of `human-audit.tsv`, with deterministic `canonical|duplicate` rows.
- Duplicate rows preserve the canonical packet content, get their own `review_item_id`, point back through `duplicate_of`, and are excluded from canonical kappa counts.
- `judge-kappa` reports `duplicateRows`, `duplicatePairs`, `duplicateConsistent`, `duplicateBlankRows`, and `duplicateConsistency`.
- `okToTrustJudge` now fails closed when canonical audit accept/reject cells are blank, audit pass rate is below `0.9`, duplicate cells are blank, or duplicate consistency is below `0.9`.

Not implemented in this bounded pass:

- Gold rows, because they require curated obvious-case fixtures rather than heuristic generation.
- Multi-annotator overlap, elapsed/fatigue certification, kappa confidence intervals, and full certification semantics.

### 2.1 L0-Pinned Audit Packets

Add an audit packet builder in `src/eval/judgeReview.ts` or a new `src/eval/auditPacket.ts`.

Packet fields:

- `packetId`
- `project`, `caseId`, `runId`, `chapterId`, `repeatIndex`
- `pair`, `order`, `leftArm`, `rightArm`
- `needles`: array of pinned facts derived from generation criteria and matched codex entries
- `criteria`: callback, setting, and future leak criteria
- `leftSample`, `rightSample`
- `judgeClaim`, `judgeEvidence`, `judgeLocation`, `needleStatus`, when judge output is available

Needle derivation should be conservative:

- Start with criteria terms (`contains`, `contains_any`, `not_contains`) and map terms to codex entries by `name`, `keywords`, `body`, and `currentState`.
- Include codex entry `id`, `name`, `type`, `path`, `currentState`, and a short body excerpt.
- Include `establishedChapterId` only when it can be derived reliably from chapter order and term occurrence. Otherwise mark it as `unknown`, not guessed.
- For any criterion that cannot be mapped to a codex entry, emit an explicit `unmapped` needle row with the criterion id, terms, and reason.
- Compute `needleMappingCoverage = mappedCriteria / totalCriteria` and archive it at packet and run level. Low coverage means the audit packet itself may be missing the relevant fact and must be treated as weaker evidence.

Archive additions:

- `audit-packets.jsonl`
- `human-audit.csv`, optimized for spreadsheet review but containing enough columns for script parsing
- `human-audit.md`, optional reviewer-friendly file grouped by packet

Tests:

- Packet builder includes codex entry path and current state when a criterion term maps to an L0 card.
- Packet builder marks unknown provenance as `unknown`.
- Packet builder emits unmapped criteria and coverage metrics.
- Archive writes packets for report and suite archives.

### 2.2 Structured Judge Schema

Upgrade judge prompts without breaking existing pairwise aggregation.

New output schema:

```json
{
  "choice": "A|B|tie",
  "claim": "short judgment",
  "evidence": ["short quote or paraphrase from sample"],
  "location": ["A paragraph 1", "B sentence 2"],
  "needle_status": [
    { "needle_id": "setting-key-rule", "status": "satisfied|violated|unclear", "reason": "..." }
  ],
  "reason": "one sentence"
}
```

Implementation:

- Keep `choice` and `reason` backward compatible in `GenerationEvalJudgeResult`.
- Add optional fields for `claim`, `evidence`, `location`, and `needleStatus`.
- Build judge prompts from audit packets when available, so the model sees the same L0-pinned facts as human auditors.
- Enforce a quote length cap in prompts and archived results to avoid bloating artifacts.

Tests:

- Old `{choice, reason}` still parses.
- New structured output parses.
- Invalid JSON remains `choice: invalid`.

### 2.3 Gold and Duplicate Injection

Add a deterministic review queue generator rather than hand-editing `human-pairwise-review.csv`.

Command:

```bash
npm run generation:kappa -- --archive-dir .novel/evals/run-001 --build-review-queue --out .novel/evals/run-001/review-queue.tsv
```

The first implementation folds this into `generation:kappa` as `--build-review-queue` to avoid a new script while the core experiment is still unresolved.

Queue row fields:

- canonical packet fields
- `review_item_id`
- `item_kind`: `canonical|gold|duplicate`
- `canonical_packet_id`
- `expected_choice` for gold rows only
- `duplicate_of` for duplicate rows only
- `shown_index`
- `started_at`, `submitted_at`, `elapsed_ms`
- `human_choice`, `human_accepts_judge`, `human_notes`

Gold rows:

- Start with fixture gold rows checked into `examples/*/meta/gold-review.json`.
- Gold rows should be obvious cases only: clear setting contradiction, clear callback success, clear future leak, or malformed/no-evidence judge claim.
- Avoid generating gold labels heuristically from deterministic criteria alone; that risks encoding the same blind spots.
- Status: deferred until curated fixtures exist.

Duplicate rows:

- Inject 10%-15% duplicates, minimum 2 when queue length allows.
- Preserve identical packet content but assign a new `review_item_id`.
- Space duplicate rows apart deterministically by hash seed.

Tests:

- Queue generation is stable from archive fingerprint.
- Duplicates point to canonical rows and do not create extra canonical packet ids.
- Gold rows carry expected labels and are excluded from kappa against judge unless explicitly requested.

### 2.4 Human Reliability and Trust Function

Extend or replace `tools/judge-kappa.ts` with a richer calibration report.

Report fields:

- Existing kappa fields from `judge-kappa`.
- `annotatorCount`, `overlapRows`, and `trustScope`.
- `goldRows`, `goldCorrect`, `goldAccuracy`.
- `duplicatePairs`, `duplicateConsistent`, `duplicateConsistency`.
- `medianElapsedMs`, `p95ElapsedMs`, `fatigueFlaggedRows`.
- `elapsedCoverage`, `elapsedCertificationStatus`.
- `judgeAuditRows`, `judgeAcceptedRows`, `judgeAuditPassRate`.
- `lowQualityRowIds`.
- `okToTrustJudge`.
- `failedReasonIds`.

Suggested thresholds for first implementation:

- `minimumHumanLabels >= 20` for production trust; keep current 10 as `minimumSmokeLabels`.
- `kappa >= 0.6` and bootstrap kappa confidence interval lower bound >= 0.6 for `certified` trust. If only the point estimate clears, report `underpowered`.
- At least two annotators on an overlap subset of 8-10 canonical rows for `okToTrustJudge: true`. If only one annotator is available, set `trustScope: "judge_matches_single_annotator"` and do not claim general judge trust.
- Inter-annotator agreement on the overlap subset is reported separately from judge-vs-human kappa.
- `goldAccuracy >= 0.95`.
- `goldRows >= 10` for certification. Smaller gold sets are smoke checks only.
- `duplicateConsistency >= 0.9`.
- `judgeAuditPassRate >= 0.9`.
- `invalidJudgeRate <= 0.05`.
- `fatigueFlaggedRows / labeledRows <= 0.2`.
- `elapsedCoverage >= 0.95` for certification. Missing elapsed metadata downgrades to `uncertified` or `underpowered`; it does not silently pass.

Tie handling:

- Keep `tie` as an explicit label in raw exports.
- For primary trust, report two variants: nominal multiclass kappa including `tie`, and binary collapsed kappa where `tie` is excluded from winner agreement.
- `okToTrustJudge` requires the configured primary variant to pass; default to collapsed binary kappa for small samples and report how many ties were excluded.

Statistical power:

- Add Wilson interval for four-layer judge win rate and human audit pass rate.
- Add bootstrap confidence intervals for kappa and gold accuracy.
- Label reports as `underpowered` when CI is too wide to distinguish weak vs strong signal.
- For the known 26 lost-in-middle pairs, treat the result as calibration smoke unless the interval lower bound clears the chosen threshold.
- Gold labels should be reviewed by two humans or otherwise marked `single-curated`; disputed gold rows are removed from the gold set instead of averaged.

Tests:

- Existing kappa tests still pass.
- A low gold accuracy report fails even if kappa is high.
- Inconsistent duplicate rows fail trust.
- Missing elapsed metadata prevents certified trust unless the report is explicitly run in `--smoke` mode.
- Single-annotator reports downgrade trust scope instead of claiming general judge trust.
- Tie-heavy reports expose both nominal and collapsed kappa and fail when the configured primary variant is underpowered.

## Phase 3: System B Roadmap Only

Do not build the correction UI now.

Record these future requirements in `docs/product-prd.md` or a new roadmap section after Phase 2:

- Correction screen must show L0 pinned facts and machine-detected deviations before editable text.
- Corrections must target deviation points, not default to whole-chapter regeneration.
- Human correction versions must be stored separately from original manuscript text.
- Human edits must pass the same L0/L1/L3 consistency guards as model output.
- Correction events should become preference pairs only when human reliability metadata for the session passes threshold.

Implementation is gated on:

- System A trust report passing.
- A0/L1 decision resolved.
- A concrete list of deviation types from real failed eval packets.

## Development Sequence

1. Land A0 L1 ablation support and fixture summary loading.
2. Run dry-run A0 on `state-drift`, `delayed-payoff`, and `lost-in-middle`.
3. Run a small real A0 sample with the chosen provider.
4. Decide L1-first vs calibration-first using only the pre-registered deterministic A0 acceptance line.
5. Land L0 audit packet archive.
6. Upgrade judge schema and prompts to use audit packets.
7. Add review queue generation with duplicate rows; gold rows remain gated on curated fixtures.
8. Extend trust reporting beyond kappa with audit pass rate and duplicate consistency; full certification metrics remain future work.
9. Update docs with the System B roadmap gate.

## Verification Commands

```bash
npm run generation:eval -- --dry-run \
  --benchmark-project examples/state-drift-benchmark \
  --benchmark-project examples/delayed-payoff-benchmark \
  --benchmark-project examples/lost-in-middle-benchmark \
  --archive-dir .novel/evals/a0-local-dry-run

npm run generation:eval -- --dry-run --l1-mode causal-fixture \
  --benchmark-project examples/state-drift-benchmark \
  --benchmark-project examples/delayed-payoff-benchmark \
  --benchmark-project examples/lost-in-middle-benchmark \
  --archive-dir .novel/evals/a0-causal-dry-run

npm run generation:a0 -- \
  --local-archive .novel/evals/a0-local-real-run \
  --fixture-archive .novel/evals/a0-causal-real-run \
  --out .novel/evals/a0-decision.json

npm run test -- tools/generation-eval.test.ts tools/judge-kappa.test.ts src/eval/judgeReview.test.ts
npm run typecheck
```

After real provider runs:

```bash
npm run generation:kappa -- --archive-dir .novel/evals/phase0-real-001 --build-review-queue
npm run generation:kappa -- --archive-dir .novel/evals/phase0-real-001 --human-audit .novel/evals/phase0-real-001/review-queue.tsv --json
```

The exact command name for the richer reliability report should be added with the implementation, preferably:

```bash
npm run generation:calibrate -- --archive-dir .novel/evals/phase0-real-001 --json
```

## Risks and Mitigations

- Risk: A0 fixtures become hand-tuned benchmark cheating.
  Mitigation: fixtures are diagnostic oracle upper bounds only, flagged by `l1Mode`, never counted as final product evidence.

- Risk: A0 uses uncalibrated judge evidence and reintroduces circular reasoning.
  Mitigation: A0 branch decisions use only deterministic structural metrics; judge metrics are archived as exploratory and labeled uncalibrated.

- Risk: A0 accepts a false positive through multiple-comparison threshold fishing.
  Mitigation: pre-register callback structural win rate as the primary metric, require interval-aware passing, and keep other metrics auxiliary.

- Risk: L0 needle derivation overclaims provenance.
  Mitigation: mark provenance as `unknown` unless derived from explicit chapter order and term occurrence; emit unmapped criteria and coverage metrics.

- Risk: gold labels encode deterministic scorer blind spots.
  Mitigation: gold rows are manually curated obvious cases, not auto-derived from criteria hits, and disputed gold rows are removed.

- Risk: 26 lost-in-middle pairs remain statistically underpowered.
  Mitigation: report Wilson intervals, bootstrap kappa intervals, and require either stronger lower-bound evidence or more cases before declaring victory.

- Risk: Phase 2 becomes a tooling detour.
  Mitigation: the Phase 2 implementation ceiling is "produce a trustworthy calibration report"; no dashboard, active learning workflow, multi-user queue, or general annotation platform until the core experiment is resolved.

- Risk: structured judge prompts reduce comparability with older runs.
  Mitigation: keep old `choice/reason` parsing and archive schema compatibility; fingerprint prompt schema version.

## ADR

Decision: Add A0 L1 ablation before full judge calibration, but constrain A0 branching to pre-registered deterministic metrics. Then build the smallest System A reliability infrastructure needed to produce a trustworthy calibration report, while deferring System B implementation.

Drivers:

- Avoid wasting human calibration on a known possibly broken L1 output distribution.
- Avoid circular reasoning from uncalibrated judge win rates.
- Avoid multiple-comparison threshold fishing in the A0 branch.
- Make L0 the shared ground truth for models and humans.
- Treat human labels as measured signals, not unquestioned truth.
- Preserve current Phase 0 discipline and avoid UI/product sprawl.

Alternatives Considered:

- Calibrate the current judge immediately: simpler, but likely wastes human effort if L1 changes the distribution.
- Fix L1 immediately: tempting, but risks optimizing without proving L1 is the active bottleneck.
- Use judge win-rate movement in A0: rejected because A0 runs before judge calibration.
- Let any of several A0 metrics trigger L1-first: rejected because OR thresholds inflate false positives on small samples.
- Build correction UI now: productively exciting, but premature because deviation categories and trust gates are not yet grounded.

Consequences:

- The next implementation is mostly CLI/data artifacts, not UI.
- A0 positive results are interpreted as oracle evidence that L1 could matter, not as proof that generated L1 is solved.
- A single annotator can support a smoke decision but cannot certify general judge trust.
- System A will produce reusable open-source eval assets earlier.
- System B waits, but its future design becomes better informed by real failures.

Follow-ups:

- If A0 strongly supports L1 as the bottleneck, create a separate L1 causal-summary implementation plan.
- If A0 does not move the metric, create a generation-prompt memory-utilization diagnostic plan.
- After calibration passes, package the eval harness as a documented standalone open-source asset.
