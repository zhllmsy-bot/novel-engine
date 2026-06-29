# Novel Engine Schemas

These schemas are the public contracts for files that community contributors can
add without touching core code.

| Schema | Used by | Purpose |
| --- | --- | --- |
| `project.schema.json` | `meta/project.json` | Markdown-first project identity, source-of-truth, and chapter order metadata |
| `skill.schema.json` | `examples/skills/*.skill.yaml`, project `skills/**/*.skill.yaml` | YAML Skill manifests for genre workflows and AI actions |
| `provider-adapter.schema.json` | `providers/*/provider.adapter.json` | Model/provider metadata for OpenAI-compatible and local runtimes |
| `publisher-adapter.schema.json` | `publisher/adapters/*/publisher.adapter.json` | Upload/publishing adapter metadata and dry-run eligibility |
| `memory-eval.schema.json` | `meta/memory-eval.json` | Deterministic four-layer memory recall expectations for demo novels and test corpora |
| `generation-eval.schema.json` | `meta/generation-eval.json` | Real-model A/B continuation criteria for Phase 0 generation experiments |

Runtime checks intentionally stay lightweight and local. Use `npm run
project:check`, `npm run skills:check`, `npm run providers:check`, `npm run
publisher:check`, and `npm run memory:eval` before submitting a new community
asset.
For the repository-level smoke gate, `npm run workspace:check` aggregates the
demo project check, deterministic memory evaluation, and extension manifest
checks.

`project.schema.json` describes the static manifest shape, including optional
chapter `story_time` metadata and `scene_def_ids` references. `project:check`
handles dynamic project invariants that JSON Schema cannot reliably express,
including duplicate explicit or path-derived chapter ids, duplicate paths,
duplicate chapter orders, missing Markdown files, and whether each
`scene_def_ids` entry points at a real codex card with `type: scene_def`. The
checker also mirrors the schema's static field and path/id rules so project
manifests can be gated without requiring a JSON Schema runtime.

To scaffold provider or publisher adapter metadata:

```bash
npm run adapters:new -- --type provider --id community-gateway --name "Community Gateway"
npm run adapters:new -- --type publisher --id royalroad --name "Royal Road"
npm run adapters:new -- --type provider --project examples/demo-novel --id local-qwen --name "Local Qwen" --provider-kind local
```

Project-local adapter manifests live under `providers/` or `publisher/adapters/`
inside a novel project. The scaffold command copies the matching public schema
into `.novel/schemas/` so YAML/JSON editor hints keep working when the novel
folder is moved outside this repository.

To scaffold a new Markdown-first novel project:

```bash
npm run project:new -- --title "我的长篇小说" --out /path/to/MyNovel
npm run project:check -- /path/to/MyNovel
npm run memory:eval -- /path/to/MyNovel
```

To scaffold a new YAML Skill without copying an existing file by hand:

```bash
npm run skills:new -- --project examples/demo-novel --id demo.dialogue_polish --name "本书对白润色"
npm run skills:new -- --project examples/demo-novel --id demo.foreshadowing --name "本书伏笔体检" --mode memory_update_proposal --schema plot_thread_proposal --category memory
npm run project:check -- examples/demo-novel
```

The scaffolded manifest is mode-aware: rewrite Skills start with manuscript,
codex, chapter-summary, and recall evidence; memory proposal Skills include the
plot-thread or character-state families they are likely to inspect; report
Skills start broad; export Skills focus on manuscript, project metadata, and
summaries.
Project-local Skills live under `skills/` inside a novel project and are loaded
after bundled examples, so a project can override or specialize a community
workflow without changing core editor code. For reusable community packs outside
a novel project, use `--out examples/skills/<id>.skill.yaml` and then run
`npm run skills:check -- examples/skills`.
Skill `retrieval.source_families` narrows the host-built memory context by
stable provenance families such as `manuscript`, `codex`, `chapter_summary`,
`plot_thread`, and `recall`. Prefer it over path substring conventions when a
community Skill should read only specific kinds of evidence.
The schema and parser reject required inputs that the declared source families
make impossible, while optional inputs may still be intentionally filtered out.

Memory eval expectations can use the same stable families through
`source_families`. Keep `source_contains` for exact source paths or prefixes,
and prefer `source_families` when a community demo corpus only needs to prove
that matched evidence came from codex, recall, summaries, plot threads, or other
portable memory classes.

Generation eval criteria are intentionally narrower. `generation-eval.schema.json`
describes a manual or scripted real-model A/B run: the baseline prompt receives
recent prose only, the candidate prompt receives four-layer memory, and criteria
track callback hits, setting violations, and future-leak tokens in generated
text. This is not part of the fast default CI gate because it may call a paid
OpenAI-compatible endpoint.
