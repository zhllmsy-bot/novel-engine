# Novel Engine

Open AI-native novel engineering workspace.

This repository is the first executable skeleton for the product direction captured in `outputs/`:

- open Markdown/YAML project format
- local-first desktop editor
- four-layer narrative memory runtime
- safe AI rewrite via Diff and snapshots
- YAML Skill packs before code plugins
- provider adapter manifests before hard-coded model integrations
- standalone publisher core before editor integration

## Current Scope

This is not a full product yet. The first skeleton includes:

- Vite + React + TypeScript frontend
- CodeMirror 6 Markdown editor surface
- Tauri 2 configuration and Rust command skeleton
- SQLite cache schema for early chapter, summary, version, memory job, and Skill manifest tables
- example novel project format loaded from Markdown/YAML into the editor
- example Skill YAML
- Tauri commands for scanning, reading, and writing chapter files
- desktop project opening through the Tauri dialog plugin
- runtime four-layer memory builder with budgeted context assembly
- deterministic L1 gradient compression: recent summaries stay detailed while
  distant summaries are grouped into compact volume-level signals
- L1 volume summary contract for distant plot memory, with current-chapter
  time-slicing to avoid leaking future reveals
- memory budget audit showing included, truncated, and dropped context entries
- confirmed character-state proposals become L0 dynamic facts in the memory stack
- chapter summary store for the Phase 0 L1 write/read loop, with desktop cache persistence
- chapter snapshots for manual saves and AI rewrite acceptance, with desktop cache persistence
- version timeline restore: restoring a snapshot first saves the current draft as a safety snapshot
- confirmed character-state logs for memory proposals, with desktop cache persistence
- in-memory chapter draft state for dirty/saved editor workflow
- project persistence adapter: browser demo no-op, Tauri writes chapter Markdown
- publisher `.env.example` for a standalone Fanqie adapter flow
- Skill runtime boundary: Skill context -> model provider -> constrained result
- safe rewrite patch validation: original text must still match before applying
- mock provider used only for local UI/runtime verification
- OpenAI-compatible provider for existing gateways at `/v1/chat/completions`
- provider config audit: the model panel shows ready/missing status for each
  adapter-declared field before a Skill run spends tokens
- zod validation for structured Skill results before they reach the editor
- Skill catalog loading that merges built-in Skills with YAML manifests and lets YAML override matching built-in ids
- Tauri Skill scanner for project-local `skills/**/*.skill.yaml` manifests
- Tauri publisher adapter scanner for project-local
  `publisher/adapters/**/publisher.adapter.json` manifests
- Skill run audit panel for prompt, retrieval, model, provider, and context visibility
- Skill context preview: inspect required inputs, filtered memories, and sources
  before calling any model provider
- editor-side publisher panel that reuses the same dry-run adapter contract as
  the standalone CLI
- standalone Skill manifest checker for community Skill contributions
- standalone provider adapter manifest checker for model adapter contributions
- standalone publisher adapter manifest checker for upload adapter contributions
- aggregate extension checker that validates Skills, provider adapters, publisher
  adapters, and contribution templates in one command
- project scaffold command for creating a Markdown-first novel folder that
  passes `project:check`
- workspace health checker that runs project, memory, and extension gates in one
  contributor-friendly command

## Stack

```text
Tauri 2
+ React / TypeScript
+ CodeMirror 6
+ Rust commands
+ SQLite / FTS5
+ Markdown + YAML frontmatter
```

## Run Frontend

```bash
npm install
npm run workspace:check
npm run verify
npm run dev
```

## CI

Pull requests run the same lightweight gates in GitHub Actions:

```bash
npm ci
npm run verify
```

The CI intentionally checks the TypeScript/editor workspace and manifest-driven
extension contracts first. Tauri/Rust packaging remains a separate verification
step until the desktop build pipeline is fully wired.

For contribution paths, review checklist, and focused extension commands, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Run Desktop

Rust is required for Tauri:

```bash
npm run tauri:dev
```

The current workspace environment used to create this skeleton did not have `rustc`/`cargo` available, so Rust compilation still needs to be verified after installing the Rust toolchain.

## Run Publisher Dry-Run

The publisher core is a standalone module. It can be called by the editor later,
but it already has a dry-run CLI that reads Markdown chapters, filters chapters
recorded in progress JSON, and prints the upload payload/results without touching
any platform account. The progress file keeps the legacy `published_chapters`
array and a per-chapter `chapters` detail map with status, message, remote id,
source path, word count, and update time.

```bash
npm run publisher:dry-run -- --count 1
npm run publisher:dry-run -- --all --record
```

Config lives in `publisher/adapters/fanqie/.env.example`. Copy it to
`publisher/adapters/fanqie/.env` for local use. Relative chapter/progress paths in
that file resolve from the env file location, so the publisher can be used
outside the editor as a small independent tool.

Current publisher scope:

- `publisher/core/chapterParser.ts`: Markdown chapter -> publish payload
- `publisher/core/progress.ts`: progress JSON to avoid duplicate uploads
- `publisher/core/runPublishPlan.ts`: adapter-agnostic publish orchestration
- `publisher/core/adapters/dryRunAdapter.ts`: safe standalone verification
- `publisher/core/fanqie.ts`: Fanqie config/book-id parsing boundary
- `publisher/adapters/*/publisher.adapter.json`: adapter metadata shown in the
  editor and checked by CI-friendly tooling, including the `runtime.editor_dry_run`
  capability flag used by the editor preview action

The real Fanqie browser automation is deliberately kept out of the first
skeleton. The adapter boundary is ready for a later Playwright/sidecar adapter
without coupling platform automation to the novel editor.

Inside the editor, the right inspector has a publisher panel that converts the
current project/draft state into the same publish payload contract and runs the
dry-run adapter. This proves the module can stay independently usable while also
being embedded in the writing workflow.

## Check Extensions

Community extension points should stay manifest-first and easy to review. Before
sharing or merging a Skill pack, model provider adapter, or publisher/upload
adapter, run the aggregate checker:

```bash
npm run extensions:check
npm run extensions:check -- --json
```

This validates bundled examples, contribution templates, provider adapters, and
publisher adapters together. Use the narrower commands below when iterating on
one extension type locally. The checkers also reject duplicate manifest ids
inside the checked set, so a shared Skill pack or adapter pack cannot silently
shadow one file with another.

For the full local/CI smoke gate across the demo project, memory runtime, and
extension manifests, use:

```bash
npm run workspace:check
npm run workspace:check -- --project /path/to/MyNovel
```

To scaffold a manifest-first adapter without copying JSON by hand:

```bash
npm run adapters:new -- --type provider --id community-gateway --name "Community Gateway"
npm run adapters:new -- --type publisher --id royalroad --name "Royal Road"
npm run adapters:new -- --type provider --project /path/to/MyNovel --id local-qwen --name "Local Qwen" --provider-kind local
```

The scaffolded manifest intentionally starts with `status: "planned"` and does
not grant runtime permissions. It gives contributors a reviewable metadata PR
before any streaming, browser automation, credential storage, or upload code is
merged.

## Check Publisher Adapters

Publisher/upload adapters expose a small manifest before they expose automation
code. Use `schemas/publisher-adapter.schema.json` for editor completion and
static validation hints:

```bash
npm run publisher:check
npm run publisher:check -- publisher/adapters
npm run publisher:check -- --json /path/to/adapters
```

The checker recursively scans `publisher.adapter.json` files and validates the
same metadata contract used by the editor adapter catalog. This gives community
upload adapters a safe first contribution path before any browser automation is
merged.

Start from
`npm run adapters:new -- --type publisher --id <adapter-id> --name "<Display Name>"`
or copy `examples/adapters/publisher-adapter-template/publisher.adapter.json`
into `publisher/adapters/<adapter-id>/publisher.adapter.json`, then run
`npm run publisher:check`.

Desktop projects can also carry their own publisher metadata at
`MyNovel/publisher/adapters/<adapter-id>/publisher.adapter.json`. When a project
is opened in Tauri, those project-local manifests are merged into the editor
publisher catalog after the bundled adapters, so a local manifest can override
bundled metadata while staying portable with the novel folder.

Adapter manifests may include:

```json
{
  "runtime": {
    "editor_dry_run": true
  }
}
```

`editor_dry_run` is a manifest claim, not executable permission. The editor only
enables preview when both the manifest declares dry-run support and the editor
has a matching runtime implementation. Planned or project-local upload adapters
can still appear in the catalog with their manifest path, `.env` path, and
capabilities while remaining disabled until their safe preview/runtime boundary
is implemented.

Inside the editor, each publisher adapter also gets a readiness audit. The audit
shows whether the adapter has an editor dry-run runtime, whether the current
project has a pending chapter, and which `.env` config path the adapter declares.
Only the dry-run runtime and pending chapter checks block the preview action; the
config path remains informational so standalone `.env`-driven adapters can be
listed before they are wired into the editor.

## Check Provider Adapters

Model providers expose metadata before deeper runtime code:

Use `schemas/provider-adapter.schema.json` for editor completion and static
validation hints:

```bash
npm run providers:check
npm run providers:check -- providers
npm run providers:check -- --json /path/to/providers
```

The checker recursively scans `provider.adapter.json` files and validates the
same metadata contract used by the editor provider catalog. This keeps new model
integrations inspectable and gives contributors a small first PR surface before
they touch streaming, retry, credentials, or model-specific behavior.

Start from
`npm run adapters:new -- --type provider --id <adapter-id> --name "<Display Name>"`
or copy `examples/adapters/provider-adapter-template/provider.adapter.json` into
`providers/<adapter-id>/provider.adapter.json`, then run
`npm run providers:check`.

## Check Skill Manifests

Community Skill packs should be checked before they are shared or copied into a
novel project:

```bash
npm run skills:new -- --project examples/demo-novel --id demo.dialogue_polish --name "本书对白润色"
npm run skills:new -- --project examples/demo-novel --id demo.foreshadowing --name "本书伏笔体检" --mode memory_update_proposal --schema plot_thread_proposal --category memory
npm run project:check -- examples/demo-novel
npm run skills:check
npm run skills:check -- examples/skills
npm run skills:check -- --json /path/to/MyNovel/skills
```

The checker recursively scans `.skill.yaml` and `.skill.yml` files and reuses the
same manifest parser as the editor runtime. Invalid manifests fail with a
non-zero exit code, so this command can become a CI gate for shared Skill packs.
The parser enforces the public JSON schema's core constraints, including Skill
id format, supported input names, non-negative recent-chapter counts, and model
temperature range. The checker also fails duplicate Skill ids across the scanned
files.
`skills:new` generates a validated starting manifest and selects initial
`retrieval.source_families` from the output mode: rewrite Skills start with
manuscript/codex/summary/recall evidence, memory proposal Skills add plot-thread
or character-state evidence, report Skills start broad, and export Skills focus
on manuscript/project/summary evidence.

## Check A Project

Novel folders can also be checked as a whole:

```bash
npm run project:check
npm run project:check -- examples/demo-novel
npm run project:check -- --json /path/to/MyNovel
```

The project checker validates `meta/project.json`, scans `manuscript/**/*.md`
and `codex/**/*.md` with the same loader used by the editor, validates
`meta/memory-eval.json`, and includes project-local Skill manifest failures plus
provider and publisher adapter manifest failures in the final result.
Use `schemas/project.schema.json` for editor completion and as the static
manifest contract. `project:check` adds the dynamic checks that need the whole
folder, such as duplicate chapter ids/orders and missing Markdown files.
It also mirrors the public schema's manifest-shape checks, so unknown fields,
wrong `schema_version`, invalid `$schema`, non-relative chapter paths, and bad
chapter ids fail in CI instead of being silently ignored by the loader.
Unlike `extensions:check`, `project:check` follows the desktop runtime override
semantics: project-local provider and publisher adapter manifests are checked
for internal validity, but they may reuse a bundled adapter id to override
metadata for that one project.

To create a minimal Markdown-first project that already matches the public
manifest schema and L3 keyword rules:

```bash
npm run project:new -- --title "我的长篇小说" --out /path/to/MyNovel
npm run project:check -- /path/to/MyNovel
npm run memory:eval -- /path/to/MyNovel
```

The scaffold writes `meta/project.json`, one starter chapter with `story_time`
and `scene_def_ids`, one starter character card with `keywords`, one
`type: scene_def` location card, a local `meta/memory-eval.json` smoke test, and
project-local schemas under `.novel/schemas/` so editor completion keeps working
when the novel folder is moved outside this repository.
The starter memory eval also includes `source_contains` and `source_families`
checks so the first smoke test proves both recall text and recall provenance.

## Evaluate Narrative Memory

The Phase 0 memory loop has a deterministic smoke evaluator. It does not call a
model; it loads a project, builds the same four-layer memory plan used by the
editor, and checks whether expected L0/L1/L2/L3 recall signals are present.
Projects can define their own deterministic expectations in
`meta/memory-eval.json`; when that file is absent the tool falls back to the demo
expectations. Invalid project-local expectation entries fail loudly instead of
being ignored, so this file can be used as a reliable CI guardrail.
Use `schemas/memory-eval.schema.json` for editor completion and as the public
contract for community recall test corpora.

The same evaluator also checks the shared budget policy from
`src/memory/memoryContextBuilder.ts`: selected memories must follow
`L2 -> L0 -> L3 -> L1`, and under severe budget pressure L1 must yield before
L2 recent prose. See `docs/memory-architecture.md` for the full layer contract.
It also evaluates the same expectations against a recent-prose-only baseline
and reports `Baseline` plus `Four-layer gain`, so Phase 0 can show what the
memory engine recalls beyond a sliding window.
The report includes a `Phase 0 gate` line and a machine-readable `phase0` object
in `--json` output. The gate passes only when every recall expectation passes,
the four-layer plan is not worse than the baseline, and the configured
`minimum_gain` threshold is met.
It also prints `Phase 0 metrics` and exposes `phase0Metrics` in `--json`: long
callback expectations are counted from non-L2 checks, setting violations are
approximated from failed L0 checks, and future leaks are counted from the
time-sliced sentinel policies.
Each case also reports the memory sources that satisfied it, so a passing
expectation can be traced back to a codex card, chapter summary, or `recall:*`
entry instead of being a bare green check.
The report also includes a compact source-family summary over the selected
memory plan, making it obvious whether the context came from manuscript, codex,
project metadata, summaries, plot threads, state logs, or recall entries.
The same summary is available as `sourceSummary` in `--json` output, so CI or
future docs pages can consume provenance without parsing the text report.
The policy gate fails if the four-layer plan passes fewer expectations than the
baseline, or if non-L2 expectations exist but the four-layer plan shows no gain.
Projects can raise that bar with `minimum_gain` in `meta/memory-eval.json`.
Expectations may also declare `not_contains` to prove that future spoilers or
known-bad recall tokens did not enter the selected memory context, and
`source_contains` to require a concrete source path or prefix such as
`recall:chapter_summary:`. Use `source_families` for stable provenance families
such as `codex`, `chapter_summary`, or `recall` when the exact path should stay
flexible across projects.

```bash
npm run memory:eval
npm run memory:eval -- examples/demo-novel
npm run memory:eval:long
npm run memory:eval -- examples/long-memory-benchmark
npm run memory:eval -- --chapter chapter-001 --budget 900
npm run memory:eval -- --json /path/to/MyNovel
```

Use this as a fast guardrail when changing recall, budget, summary, or codex
matching logic. It is not the full Phase 0 model-quality experiment; it proves
that the deterministic memory assembly path still recalls the controlled facts
before any model is involved, and that the core prompt-budget discipline has not
drifted. The `Phase 0 metrics` line is therefore a context-assembly decision
signal, not a claim that a model will generate the right answer. A useful result
should show L2 passing in both baseline and four-layer plans, with L0/L1/L3
gains coming from the full memory engine.
`examples/long-memory-benchmark` is the stronger smoke corpus: chapter 6 asks
for chapter-1 oath context outside the recent-prose baseline window, so it should
show a low baseline score and a passing `Phase 0 gate` through L0/L1/L3 recall.
That benchmark is also covered by the Vitest suite. `workspace:check` keeps the
faster default demo project in the main aggregate report, and
`npm run workspace:check:long` or `npm run workspace:check -- --benchmark`
adds the long-memory benchmark when a PR touches recall, budget, or summary
behavior.

Example `meta/memory-eval.json`:

```json
{
  "$schema": "../../schemas/memory-eval.schema.json",
  "chapter_id": "chapter-001",
  "budget_chars": 900,
  "minimum_gain": 1,
  "expectations": [
    {
      "id": "l0-codex-fact",
      "description": "L0 recalls the character card.",
      "layer": "L0 事实",
      "contains": ["李长老", "金丹期"],
      "not_contains": ["未来答案"],
      "source_contains": ["codex/characters/"],
      "source_families": ["codex"]
    }
  ]
}
```

## Project Format

```text
MyNovel/
├─ manuscript/
│  └─ volume-001/
│     └─ chapter-001.md
├─ codex/
│  └─ characters/
├─ meta/
│  └─ project.json
├─ skills/
└─ .novel/
   └─ cache.db
```

`manuscript/`, `codex/`, and `meta/` are the durable user assets. `.novel/` is runtime cache and should be rebuildable.

Codex cards are Markdown files with YAML frontmatter. `keywords` is the L3
recall index, so every card that should be retrieved by the memory engine needs
at least one explicit trigger:

```markdown
---
id: char-li-zhanglao
name: 李长老
type: character
aliases: [李长老, 李玄衡]
keywords: [李长老, 戒律堂, 玄铁剑]
current_state:
  location: 戒律堂
  power_level: 金丹期
---

玄天宗戒律堂长老，性格孤傲，重规矩。
```

For character cards, `current_state` is optional but recommended for structured
dynamic facts. The loader also understands a Markdown `## 当前状态` section with
`- 字段: 值` rows, so authors can keep cards readable while the memory engine
still receives structured L0 state.

`npm run project:check` fails codex cards without keywords, warns on duplicate
keywords, and warns when keywords omit the card name. This keeps L0 facts and L3
recall explainable before vector search or heavier indexing exists.

The desktop host can open a project folder with the official Tauri dialog
plugin. Loading a real project reads `meta/project.json`, scans
`manuscript/**/*.md` and `codex/**/*.md`, keeps project-relative paths for UI and
memory sources, and keeps absolute file paths only for save operations.

Chapter manifest entries can also declare optional `story_time` and
`scene_def_ids`. `order` remains the writing/order-of-reading timeline, while
`story_time` is the in-world timeline hook for later flashback and consistency
checks. `scene_def_ids` points to codex cards with `type: scene_def`; those
location/scene-definition cards are injected as L0 facts even when the current
prose does not repeat their keywords.

## Memory Runtime

The current memory loop includes a Phase 0 chapter-summary path:

```text
chapter Markdown
-> built-in chapter_summary Skill + configured provider
-> local chapter summary fallback
-> chapter_summary store
-> L1 plot memory in the runtime context
```

Runtime context assembly now uses the available open project structure:

- L2 includes the current draft plus recent previous chapter prose.
- L1 orders available chapter summaries up to the current chapter, keeps the
  nearest summaries detailed, uses matching volume summaries for distant plot
  memory when they cover only past chapters, falls back to deterministic
  volume-level key signals, and includes confirmed open foreshadowing threads.
- L0 recalls matching codex cards by explicit names and keywords, and always
  includes any `scene_def` cards explicitly linked by the active chapter.
- Confirmed character-state proposals are added back as L0 dynamic facts, filtered
  to the current chapter timeline so future state does not leak backward.
- L3 records the current project intent plus a recall audit of matched codex cards,
  chapter summaries, confirmed foreshadowing threads, and hit keywords. Matching
  historical summaries and foreshadowing threads are also emitted as concrete
  `recall:chapter_summary:*` and `recall:plot_thread:*` L3 entries, capped by the
  shared memory budget policy.
- Desktop cache exposes `search_project_chapter_index`, a rebuildable SQLite
  FTS5 trigram search over chapter title, prose, and cached summary. This is the
  local-first path for scaling L3 recall beyond small in-memory keyword scans.
  Desktop runtime feeds those results into L3 as time-sliced `recall:index:*`
  memories while browser/demo runs keep the deterministic in-memory path.

The memory builder also exposes a budget audit alongside the final memories.
The editor shows used/budget characters, per-layer budget totals versus target
shares, and whether each candidate memory was included, truncated, or dropped,
making Skill prompt debugging inspectable instead of a hidden prompt-budget
guess.

Generated summaries are treated as derived cache data. The editor's chapter
summary action first runs the built-in `core.chapter_summary_generate` Skill,
which asks the configured provider for structured `{summary, keyEvents,
charactersInvolved}` output, then falls back to the local deterministic summary
generator if provider configuration or model output fails. The fallback scans
the full chapter for codex keyword hits, late reveals, promises, prohibitions,
state changes, and ending turns instead of only taking the opening lines. If a
summary is marked as edited, neither provider-backed nor local generation will
overwrite it.
Browser demo runs keep these summaries in memory; the desktop host loads and
saves them through `.novel/cache.db`.

Volume summaries follow the same derived-memory rule. They compact distant L1
plot context, remain sourceable as `volume_summary:*` in the memory audit, and
are ignored for earlier chapters if their chapter coverage includes future
chapters. Browser demo runs can rebuild them from chapter summaries; the desktop
host loads and saves them through `.novel/cache.db` as `volume_summary` rows.

Manual snapshots and AI rewrite acceptance snapshots follow the same boundary:
browser demo runs keep versions in memory, while the desktop host loads and saves
`chapter_versions` through `.novel/cache.db`. AI rewrite acceptance attempts to
persist the pre-rewrite snapshot before applying the proposed patch.
Restoring a version does not overwrite the Markdown file directly: it first
creates a safety snapshot for the current draft, then restores the selected
snapshot into the editor draft so the author can review and save deliberately.

Character-state proposals follow the high-risk memory rule: the model can only
propose changes, and the author must confirm them. Confirmed proposals are kept
in memory in the browser demo and persisted as `character_state_log` rows in the
desktop cache. Those confirmed logs are then reintroduced into the runtime as L0
dynamic facts. When editing an earlier chapter, later logs are excluded, and the
latest confirmed value for the same character field is used.

Plot-thread proposals follow the same reviewable-memory rule. Confirmed
foreshadowing threads can be kept open or marked resolved; browser demo runs keep
them in memory, while the desktop host persists them in `.novel/cache.db`.
Open threads are added to L1 plot memory, and keyword matches create L3
`recall:plot_thread:*` entries. If a thread is resolved in a later chapter,
earlier chapters still see it as unresolved so the model does not receive future
answers while revising old prose.

## Development Rule

Reuse mature infrastructure wherever possible. Keep custom work focused on the differentiators:

- narrative memory runtime
- safe AI patch review
- open Skill schema
- publisher plugin interface
- Chinese long-form fiction workflows

## Runtime Boundary

Skill execution is intentionally constrained:

```text
Skill manifest
-> Skill catalog
-> host-built SkillContext
-> ModelProvider
-> SkillRunResult
-> safe Diff / report / memory proposal / chapter summary / export artifact
```

The editor must not allow a Skill or model provider to directly overwrite prose. Rewrite output is accepted only as a `rewrite_patch`, and the original text is validated before application.
`memory_update_proposal` is also review-only. It can carry character-state
proposals with `kind: character_state` or foreshadowing proposals with
`kind: plot_thread`; the editor shows each proposal for explicit confirmation
before it enters the memory runtime.

YAML Skill packs are the first community extension point. The catalog loads
example manifests from `examples/skills/*.skill.yaml`, merges them with built-in
Skills, reports invalid manifests without dropping valid entries, and lets a YAML
manifest override a built-in Skill that uses the same id.

Use `examples/skills/skill-template.yaml` as the starting point for community
Skills. It references `schemas/skill.schema.json` for YAML language server
completion and validation. To test a local Skill in the desktop host, run
`npm run skills:new -- --project /path/to/MyNovel --id mynovel.dialogue --name
"本书对白润色"` for rewrite Skills, or add `--mode memory_update_proposal
--schema plot_thread_proposal --category memory` for foreshadowing Skills. You
can also copy a manifest to `skills/**/*.skill.yaml` inside a novel project
folder.
Use `examples/skills/xuanhuan-foreshadowing-thread.skill.yaml` as the starting
point for Skills that contribute confirmed plot-thread memory.

Skill manifests can declare `prompt`, `input`, `retrieval`, and `model`
preferences. The OpenAI-compatible provider passes those declarations into the
user payload so community Skills can actually steer model behavior. The host
keeps the response contract in the system message, so a Skill prompt can guide
style or task intent but cannot bypass structured JSON output, snapshot, or
review rules.

The manifest checker enforces high-risk safety before a Skill can enter the
catalog. `rewrite_patch` Skills must declare
`safety.require_snapshot_before_apply: true`, and both `rewrite_patch` and
`memory_update_proposal` Skills must remain user-reviewed. This keeps community
Skills proposal-shaped instead of direct-write shaped.

Every Skill manifest must declare `output.schema`, and it is tied to
`output.mode`: rewrite Skills use `diff_patch`,
report Skills use `report`, chapter summary Skills use `chapter_summary`, export
Skills use `export_artifact`, and memory proposal Skills use
`character_state_proposal`, `plot_thread_proposal`, or `mixed_memory_update`.
The runtime enforces those memory proposal schemas after provider output is
parsed: a `plot_thread_proposal` Skill cannot return `character_state`
proposals, and a `character_state_proposal` Skill cannot return `plot_thread`
proposals.

`input.required` is enforced before a Skill reaches the provider. Supported
input names are `selected_text`, `nearby_text`, `chapter_summary`,
`character_cards`, `recent_style`, `plot_memory`, `recall_audit`, and
`user_instruction`. Missing required inputs are shown in the Skill audit panel
and block execution. `character_cards` is only satisfied by character codex
cards or confirmed character-state logs; worldbuilding cards do not masquerade
as character context.

`retrieval` also affects the host-built context. `include_characters: none`
removes character-card memories, `include_worldbuilding: none` removes
worldbuilding codex memories, and `include_recent_chapters: 0` removes L2 recent
style memory. `include_recall: none` removes concrete `recall:*` L3 items while
keeping the `meta/project.json` recall audit, so Skills can reduce long-range
noise without losing context provenance.
Skills can also declare `source_families` for stable provenance filtering. The
accepted families are `manuscript`, `codex`, `project`, `chapter_summary`,
`volume_summary`, `plot_thread`, `character_state_log`, `recall`, and `other`.
This lets a community Skill say "only use codex and recall evidence" without
depending on fragile source path substrings. Preview and run audits label
excluded memories as `source family disabled`.

The checker rejects contradictory required-input declarations before a Skill
enters the catalog: `input.required: [recent_style]` cannot be paired with
`retrieval.include_recent_chapters: 0`, and `input.required:
[character_cards]` cannot be paired with `retrieval.include_characters: none`.
`source_families` participates in the same check: a required `recent_style`
needs `manuscript`, required `character_cards` needs `codex` or
`character_state_log`, required plot/chapter memory needs one of the plot
memory families, and required `recall_audit` needs `project` or `recall`
evidence. Those same retrieval reductions are still allowed for optional inputs.
Skill input arrays and adapter capability/config arrays must not contain
duplicate values, matching the public JSON schemas used for community
contributions.

Every Skill can be previewed before execution. Preview builds the same
host-owned context and audit as a real run, but it does not call the model
provider. Skill authors can inspect missing required inputs, retrieval filters,
context sizes, per-layer memory counts/chars, included sources, and dropped
memory reasons before spending tokens or touching draft state.

Every Skill run also produces the same inspectable audit in the editor sidebar:
declared prompt, input contract, retrieval policy, model preferences, provider,
context sizes, per-layer memory summaries, included memory sources, and
retrieval-filter drops, including source-family drops. This makes community Skill
packs easier to debug without exposing direct code execution.

In the desktop host, project-local manifests under `skills/**/*.skill.yaml` or
`skills/**/*.skill.yml` are scanned after bundled examples, so a user or
community pack can override a built-in Skill without changing application code.
The Rust side only reads files; manifest parsing, validation, and safety rules
stay in the TypeScript Skill runtime.

Project-local publisher manifests under
`publisher/adapters/**/publisher.adapter.json` follow the same pattern. They are
merged into the editor publisher catalog after bundled adapters and shown with
their manifest path/source in the publishing panel. The Rust side only reads the
manifest JSON; actual upload or dry-run execution still requires an editor-owned
runtime implementation.

## Model Provider

The frontend can run with the built-in mock provider or an OpenAI-compatible
provider. The OpenAI-compatible provider expects:

- `baseUrl`, for example `http://127.0.0.1:8000`
- `apiKey`
- `model`

Provider metadata lives in `providers/*/provider.adapter.json` and is loaded by
the editor provider panel through the provider catalog. Run
`npm run providers:check` before sharing or merging a new provider manifest.

Desktop projects can also carry their own provider metadata at
`MyNovel/providers/<adapter-id>/provider.adapter.json`. When a project is opened
in Tauri, those project-local manifests are merged into the editor provider
catalog after the bundled adapters, so a local gateway or model profile can
travel with the novel folder. The Novel Agent `novel_get_project_state` read
tool can include the same provider catalog summary with `includeProviders:
true`, including manifest paths and validation errors, without exposing API
keys.
The editor audits each adapter-declared config field and shows which values are
ready or missing, so OpenAI-compatible gateways can be diagnosed before a Skill
run spends tokens.
Provider responses are still validated against the declared Skill result schema.
The parser tolerates common gateway/model wrappers such as Markdown JSON fences
or a short preface around the JSON object, but malformed JSON or
schema-mismatched results fail before they can mutate editor state.

The current UI persists non-secret provider settings (`providerMode`, `baseUrl`,
and `model`) in local browser settings so the editor can survive a refresh. API
keys are intentionally excluded from that persisted payload. In the Tauri
desktop app, provider API keys are stored through the operating system credential
store via Rust `keyring`; in the browser demo they remain session-only in memory.
API keys must never be committed, written into project files, SQLite cache, or
browser local storage.
