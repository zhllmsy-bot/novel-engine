# Four-Layer Narrative Memory Architecture

Novel Engine's core moat is not a larger prompt. It is a repeatable way to turn a long manuscript into inspectable context that a model can use without losing author control.

The mental model is:

```text
write path: manuscript -> compressed/reviewed memory
read path: memory -> budgeted prompt context
```

The editor should feel like it is backed by an experienced human editor: it remembers the recent prose closely, knows the book-level plot, can look up entity cards, and recalls callbacks when a name or object reappears.

## Layer Contract

| Layer | Role | Stored as | Read strategy | Budget behavior |
| --- | --- | --- | --- | --- |
| L2 recent prose | Short-term working memory and style continuity | Markdown chapter text, no duplicate storage | Current draft plus recent previous chapters | Highest priority, raw prose, not voluntarily summarized |
| L0 facts | Long-term world and entity facts | Markdown/YAML codex cards plus confirmed state logs | Explicit chapter entities plus keyword matches | Keep directly relevant cards, drop unrelated cards first |
| L3 recall | Associative retrieval action | No primary storage; runtime query over L0/L1 | Keyword/alias matching in MVP, semantic recall later | Strict Top N behavior, reduce hits before spending L2 budget |
| L1 plot | Medium-term plot memory | Generated chapter/volume summaries in cache | Ordered summaries up to the current chapter | Compress or drop first when over budget |

Current runtime policy lives in `src/memory/memoryContextBuilder.ts` as `memoryBudgetPolicy`. The prompt priority is:

```text
user instruction > L2 recent prose > L0 facts > L3 recall > L1 plot summaries
```

## L2 Recent Prose

L2 is the feel of the book: rhythm, dialogue habits, current emotional temperature, and scene continuity. It should use raw prose rather than summaries. The current implementation includes the active draft and recent previous chapters according to `memoryBudgetPolicy.recentChapterCount`.

Known risks:

- Very long chapters can consume the budget.
- Cross-volume transitions may make old recent prose less relevant.

Phase 0 policy still protects L2 first because losing recent prose is the fastest way for authors to feel that AI output is detached from the manuscript.

## L1 Plot Memory

L1 is the plot spine. It is generated from chapter Markdown into
`chapter_summary` cache records and then read back in chronological order up to
the current chapter. The editor's manual summary action first uses the built-in
`core.chapter_summary_generate` Skill with the configured provider, expects
structured `{summary, keyEvents, charactersInvolved}` output, and falls back to
the local deterministic generator when the provider path fails.

Rules:

- Generated summaries are derived cache, not durable manuscript truth.
- Edited summaries must not be automatically overwritten by provider-backed or
  local generation.
- The runtime uses gradient compression: the nearest summaries stay detailed,
  while distant summaries are grouped into compact volume-level signals before
  any hard budget truncation.
- Confirmed volume summaries are first-class L1 inputs for distant plot memory.
  They are emitted as `volume_summary:*` sources in the audit, and the runtime
  ignores any volume summary whose chapter coverage reaches beyond the active
  chapter.
- Chapter summaries are also time-sliced. A summary is included only when it is
  for the active chapter or its chapter order is known and not later than the
  active chapter, so incomplete project ordering does not leak future summaries
  into earlier revisions.
- `meta/project.json` chapter identity and order are part of the memory
  contract. When chapters are listed in the manifest, `npm run project:check`
  requires each chapter to have a non-empty `path`, rejects duplicate explicit
  or path-derived `id` values and duplicate `path` values, and requires each
  `order` to be a positive integer with no duplicates.
- `schemas/project.schema.json` is the public static contract for this
  Markdown-first manifest. Cross-entry and cross-file invariants stay in
  `project:check`, where they can compare derived ids, chapter orders, and
  actual Markdown files.
- Both `chapter_summary` and `volume_summary` live in `.novel/cache.db` as
  rebuildable derived memory; Markdown chapters remain the source of truth.
- Key events and callbacks should eventually be structured separately from prose summaries so second-pass compression does not erase them.

L1 is intentionally the first layer to compress or drop under tight budget. A weaker plot spine is better than losing current prose and directly relevant facts.

## L0 Facts And State

L0 is the codex: characters, factions, locations, items, rules, and confirmed dynamic state. Static facts and dynamic state must stay conceptually separate:

```text
static: name, aliases, appearance, personality, background
dynamic: location, power level, items, status, relationships
```

Character cards can expose initial dynamic facts with YAML `current_state` or a
Markdown `## 当前状态` list. The loader normalizes those rows into structured L0
state before prompt assembly.

Dynamic state changes are high risk. The model may propose a change, but only a confirmed change becomes a `character_state_log` record and then re-enters the prompt as L0 fact. The runtime filters state logs by chapter order so future state does not leak into earlier chapters.

Known risks:

- Auto-updating state can poison every future prompt.
- Building cards for every passing character adds recall noise.
- Overlong cards consume budget without improving continuity.

Therefore MVP should keep state changes human-confirmed and codex cards compact.

Codex cards must also stay recallable. The MVP L3 path depends on explicit
`keywords` in YAML frontmatter, so `npm run project:check` treats missing
keywords as an error and duplicate keywords as a warning. Keywords should usually
include the card `name` plus aliases, item names, locations, or motifs that may
surface in prose. This is the author-visible recall contract. Desktop builds
also maintain a rebuildable SQLite FTS5 trigram index over chapter title,
content, and generated summary in `.novel/cache.db`, so Chinese names and object
motifs can be searched locally without a vector database.

## L3 Recall

L3 is not a database table. It is the runtime recall action that bridges the gap between "the outline explicitly mentioned this" and "the current prose unexpectedly brought this back."

MVP uses explainable keyword and alias matching over codex entries and summaries. The desktop host now exposes the same recall surface through SQLite FTS5 chapter search, which is the bridge from small in-memory matching to scalable local retrieval without changing the four-layer prompt contract:

```text
current draft + chapter intent
-> names, aliases, item/location keywords
-> L0 codex matches + SQLite FTS5 chapter/summary matches
-> recall audit + concrete recall items in the prompt and inspector
```

The runtime emits L3 in two forms:

- `meta/project.json`: the current intent and recall audit.
- `recall:chapter_summary:*`: concrete historical summary recalls, capped by `memoryBudgetPolicy.dynamicRecallTopN`.
- `recall:plot_thread:*`: concrete confirmed foreshadowing recalls when the active draft hits their keywords.

Vector search is optional later, preferably through SQLite-native extensions such as sqlite-vec. A separate vector database is not part of the MVP contract because it adds deployment and debugging complexity before keyword recall has been measured.

The first FTS integration point is `search_project_chapter_index` in the Tauri
host. It rebuilds from Markdown chapters plus cached summaries, uses FTS5
`trigram` tokenization for Chinese prose, and returns ranked snippets tagged as
`content` or `summary`. The current TypeScript memory builder still supports the
browser/demo in-memory path; desktop L3 can consume the search results as
`recall:chapter_summary:*` entries without making the core runtime depend on a
separate service.

## Write Path

When a chapter is saved or a high-risk AI edit is accepted:

1. Save a version snapshot before mutation.
2. Generate or refresh a chapter summary through the chapter-summary Skill, with
   local fallback, if the existing summary is not user-edited.
3. Let Skills propose plot threads or state changes.
4. Require confirmation for state changes, plot threads, and other high-risk memory mutations.
5. Store derived data in `.novel/cache.db`; keep Markdown/YAML as the durable truth.

Confirmed plot threads immediately participate in L1/L3 memory. Browser demo
runs keep them in the workspace runtime store; the desktop host loads and saves
them through `.novel/cache.db`. They remain reviewable derived memory, not
manuscript truth.

## Read Path

When a Skill or continuation request needs context:

1. Build L2 from active draft plus recent previous chapters.
2. Build L0 from matched codex cards and confirmed state logs valid at the current chapter.
3. Build L3 recall audit from keyword matches against L0/L1 and confirmed plot threads.
4. Build L1 from ordered summaries and open plot threads up to the current chapter.
5. Apply `memoryBudgetPolicy` and emit an audit showing included, truncated, and dropped entries.

The audit is a product feature, not just a debug log. Authors and Skill authors need to see why a model was or was not given a piece of context.

Chapter summaries, plot threads, and character state logs are time-sliced before
budgeting. A thread planted before the active chapter is visible; if its
resolution is after the active chapter or cannot be ordered, the runtime masks
the resolution and treats it as still open. This prevents future 回收答案 or
future summaries from leaking into earlier revisions.

If the active chapter itself cannot be ordered, dynamic state logs and plot
threads fall back to current-chapter-only recall. The runtime never treats
unknown ordering as permission to include every cross-chapter memory.

The runtime audit has two levels:

- `audit.layerSummaries`: per-layer budget totals, target budget shares, entry counts, truncation counts, and dropped counts.
- `audit.entries`: per-source decisions with layer, source, priority, original characters, selected characters, and status.

Agent-facing memory reads add a compact source-family summary over the selected
plan. It groups evidence into manuscript, codex, project metadata,
chapter/volume summaries, plot threads, character state logs, concrete recall
entries, and other sources. This lets UI panels, tests, and future MCP tools
show not only how many memories were included, but what kind of evidence the
model would actually receive.
Agent tools should prefer `sourceFamilies` for stable filtering and reserve
`sourceContains` for exact path or prefix investigations.

This makes the memory moat inspectable. A contributor can tell whether a Skill failed because L0 facts were missing, L3 recall was noisy, or L1 summaries were dropped under budget pressure.

## Verification

The deterministic guardrail is:

```bash
npm run memory:eval
```

It checks both recall expectations and budget policy invariants:

- The same expectations are evaluated against a recent-prose-only baseline.
- The report includes a compact source-family summary over selected memory so a
  contributor can see which evidence classes entered the prompt.
- `--json` exposes the same data as `sourceSummary` plus a `phase0` gate object,
  making provenance and baseline-gain checks machine-readable for CI or
  community benchmark dashboards.
- `Phase 0 gate` passes only when all recall expectations pass, four-layer
  recall is not worse than the baseline, and `minimum_gain` is satisfied.
- The report lists `Baseline` and `Four-layer gain` so improvements are visible.
- Each expectation is labeled `GAIN`, `KEEP`, `LOSS`, or `MISS` against the baseline, making it clear which continuity checks are newly won by the four-layer engine.
- Each passing expectation includes matched memory sources, so recall evidence can be traced to specific Markdown files, summaries, state logs, or `recall:*` entries.
- Expectations can require stable `source_families` such as `codex` or
  `recall`, while `source_contains` remains available for exact path or prefix
  checks.
- Four-layer memory must not pass fewer expectations than the baseline.
- If non-L2 expectations exist, the four-layer plan must show at least one gain.
- Project-local `meta/memory-eval.json` may set `minimum_gain` to require a stronger improvement.
- L2 is selected first.
- Selected memories follow the declared layer order.
- Under severe budget pressure, L1 yields before L2.
- When earlier summaries match current keywords, L3 emits concrete recall entries.
- Unknown-order future summaries are excluded before L1/L3 selection, so their
  text cannot appear in selected memory even when the active draft contains a
  matching keyword.
- Volume summaries whose chapter coverage reaches beyond the active chapter or
  cannot be ordered are excluded before distant L1 compression.
- Future character state logs are excluded from earlier chapters.
- Future or unknown-order plot-thread resolutions are masked, so only the open
  thread remains visible before the resolution chapter is trustworthy.
- If the active chapter order cannot be compared, state and plot recall remain
  current-chapter-only.
- Project-local `meta/memory-eval.json` can add book-specific recall expectations, including `not_contains` guards for spoilers, `source_families` guards that require evidence from stable provenance families such as `codex` or `recall`, and `source_contains` guards for concrete source paths or prefixes such as `recall:chapter_summary:`.

`schemas/memory-eval.schema.json` is the public config contract for those
project-local expectations. `npm run project:check` also validates
`meta/memory-eval.json`, so community demo novels can ship their own recall
tests without bypassing the normal project health check.

`npm run project:check` also validates manifest chapter identity and order
integrity because L1, L2, state logs, and plot threads all depend on stable
chapter ids, paths, and comparable story order.
The static manifest shape is documented in `schemas/project.schema.json`; the
health check owns the dynamic rules that require comparing entries or touching
the project folder.

This does not replace the Phase 0 model-quality experiment. It keeps the assembly path honest before model behavior is evaluated.

## Open-Source Edge

The defensible open-source angle is that memory behavior is visible, testable, and extensible:

- Users can inspect which context was sent.
- Skill authors can preview the host-built context without calling a model.
- Communities can add Skills that request or emit structured memory data.
- Model and publisher adapters can evolve without changing the memory contract.
- Project files remain portable Markdown/YAML even if the runtime cache is rebuilt.

This is the part that should differentiate the editor from generic AI writing apps and from code editors repurposed for prose.
