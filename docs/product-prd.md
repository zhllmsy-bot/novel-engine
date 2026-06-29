# AI Long-Form Novel Editor PRD

## Product Thesis

Novel Engine is an open-source, local-first, BYO-key desktop editor for long-form fiction. Its job is to make AI useful across a whole book by keeping narrative context traceable, reviewable, and portable.

The core bet is not "generate a novel in one click." The core bet is that professional and semi-professional authors need AI that remembers prior setup, respects character state, and never locks their manuscript into a proprietary black box.

## Target Users

| Priority | User | Need |
| --- | --- | --- |
| P0 | Technical authors | BYO-key, local files, Git-friendly workflows, hackable extension points |
| P0 | Career or semi-career web novel authors | Long-book consistency, faster revision, safer AI assistance |
| P1 | Hobby and fan-fiction writers | Lower-friction AI help after the core workflow is proven |

## Goals

- Prove that a four-layer memory engine improves long-form continuity over a recent-chapters-only baseline.
- Keep user assets portable: manuscript, codex cards, outline, and project metadata live in Markdown/YAML/JSON project files.
- Make AI edits reviewable through in-place diff, proposals, and dry-runs rather than direct mutation.
- Make community contribution easy through YAML Skills, model adapters, and publisher/upload adapters.

## Non-Goals

- Do not build a cloud SaaS backend into the core editor.
- Do not optimize for one-click mass content generation.
- Do not clone code-editor features that do not help fiction writing.
- Do not fully automate high-risk character state updates in MVP.

## Differentiators

| Capability | Why It Matters |
| --- | --- |
| Four-layer memory engine | The main moat: context assembly across a long book, not just a chat window |
| Safe in-place AI diff | Keeps authors in control of prose changes |
| Open project format | Avoids data lock-in and makes Git/backups/imports natural |
| Manifest-driven Skills and adapters | Lets the community contribute genre workflows, model metadata, and upload metadata before changing core code |
| Standalone publisher adapters | Lets upload automation work outside the editor and inside the editor |

## Memory Runtime

The prompt builder should assemble context from four layers:

- L0 facts: relevant character, item, `scene_def` location, and worldbuilding cards.
- L1 plot summaries: chapter or volume summaries for broader continuity.
- L2 recent prose: current draft plus recent chapters, preserved with minimal compression for style continuity.
- L3 recall: keyword and later semantic retrieval of related facts, summaries, and early callbacks.

YAML Skills can declare their own retrieval policy, including whether to keep L2 recent prose, L0 codex cards, worldbuilding cards, concrete L3 recall items, and stable source families such as `manuscript`, `codex`, `chapter_summary`, `plot_thread`, or `recall`. This keeps community Skills configurable without granting them direct code execution or forcing authors to rely on brittle path filters.

Budget priority:

1. User instruction and current chapter intent.
2. L2 recent prose.
3. L0 relevant facts.
4. L3 recalled material.
5. L1 summaries, compressed first when over budget.

MVP should not require a vector database. SQLite plus FTS5/keyword matching is enough for the first recall loop; vector search can be added later if keyword recall is measurably insufficient.

Project metadata must keep two timelines separate: chapter `order` is the
writing/reading sequence, while optional `story_time` is the in-world timeline
hook for later flashback and contradiction checks. Chapters may also declare
`scene_def_ids` that point to codex cards with `type: scene_def`, so reusable
location/scene facts enter L0 without confusing them with manuscript scene
prose.

## Data Ownership

Durable files:

```text
MyNovel/
├─ manuscript/
├─ codex/
├─ meta/
├─ skills/
├─ publisher/adapters/
└─ .novel/
```

- `manuscript/`, `codex/`, `meta/`, `skills/`, and project-local
  `publisher/adapters/` manifests are durable user assets.
- Project-local `skills/*.skill.yaml` are loaded after bundled Skills and can
  specialize genre workflows for one book while staying schema-checked.
- `.novel/` is derived runtime cache and should be rebuildable.
- SQLite may cache summaries, indexes, versions, and state logs, but Markdown/YAML remains the truth source for manuscript and codex content.

## AI Safety Rules

- Low-risk tasks, such as generated summaries, may run automatically.
- Medium-risk tasks, such as plot-thread extraction, should be proposed and confirmed.
- High-risk tasks, such as character state changes or manuscript rewrites, must be human-in-the-loop.
- AI rewrite output must pass through a typed patch and original-text validation before it can be applied.
- Publishing/uploading must support dry-run before touching a platform account.

## Phase 0 Validation

Before broad product expansion, run a proof experiment:

- Baseline A: prompt with recent 3 chapters only.
- Candidate B: prompt with four-layer memory context.
- Test corpus: 30k-50k words with controlled callbacks, character state changes, and delayed reveals.
- Metrics: callback hit rate, setting violation count, recall precision, and author-rated usability.
- Deterministic smoke gate: `memory:eval` must show Candidate B is not worse than baseline and meets the configured `minimum_gain`.
- Deterministic gate metrics: `phase0Metrics` reports non-L2 callback hits, L0 setting violations, and future-leak sentinel failures before any model is called.
- Real-generation gate: `generation:eval` builds the same A/B prompts and can call an OpenAI-compatible model, then triages generated text for callback hits, setting violations, and future leaks before human review.
- Community test corpora define recall expectations in `meta/memory-eval.json`, backed by `schemas/memory-eval.schema.json` and checked by `project:check`.
- Repository benchmark: `examples/long-memory-benchmark` places the active test chapter beyond the recent-prose baseline window, requiring L0/L1/L3 recall to recover chapter-one oath context.
- Continue only if the memory engine gives a clear improvement over the baseline.

## Roadmap

### Phase 0: Prove the Memory Loop

- Chapter summary cache.
- L1 + L2 prompt assembly.
- Simple budget audit.
- Controlled evaluation scripts.

### Phase 1: MVP Editor

- Tauri desktop shell.
- Markdown chapter editor.
- Project open/save.
- OpenAI-compatible provider.
- Provider config audit for BYO-key/token gateway readiness.
- YAML Skill catalog.
- Safe rewrite diff.
- Dry-run publisher panel with adapter readiness audit and project-local
  publisher manifest discovery.

### Phase 2: Build the Moat

- Full L0/L1/L2/L3 memory runtime.
- Token budget manager.
- Character state proposal and confirmed state log.
- Plot-thread proposal, confirmed open/resolved state, and time-sliced recall.
- Multi-provider routing.
- Provider and publisher/upload adapter registries.
- Adapter readiness and contribution diagnostics.

### Phase 3: Open-Source Ecosystem

- Community Skill packs.
- Adapter contribution checks.
- Consistency review workflows.
- Version timeline and branch-like story experiments.

## Success Metrics

- Phase 0: four-layer memory beats recent-chapter baseline on controlled continuity tests.
- MVP: seed users can write, run a Skill, inspect context, accept/reject AI changes, and dry-run publishing without manual file surgery.
- Ecosystem: GitHub stars, working external Skills/adapters, and repeat contributors.
