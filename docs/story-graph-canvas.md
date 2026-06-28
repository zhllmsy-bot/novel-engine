# Story Graph Canvas Notes

## Why This Exists

`basketikun/infinite-canvas` is useful as a product reference because it treats
AI work as a visual workbench: nodes, upstream context, generated outputs,
assistant actions, import/export, and a local Agent/MCP bridge all live in one
operable surface.

Novel Engine should not become a canvas-first writing app. The prose editor
remains the center. The canvas idea is useful as a secondary view for narrative
engineering: memory provenance, plot threads, character state, Skill runs, and
publish tasks.

## Reference Boundary

Use the project as interaction inspiration only.

- Do not copy source code. The reference project is AGPL-3.0.
- Do not migrate the editor to Next.js. Novel Engine is a local-first Tauri
  desktop application.
- Do not add Ant Design. Keep the current VS Code-style dark workbench and
  shadcn/ui source components.
- Do not make a free-form canvas the primary writing surface. Long prose editing
  needs a stable manuscript editor.

## Reference Snapshot

Checked on 2026-06-28.

`basketikun/infinite-canvas` is currently a fast-moving AI image creation
workbench. Its public repository positions the product around infinite canvas
composition, image generation, reference-image editing, video generation,
assistant workflows, prompt libraries, asset management, local Agent support,
and Codex app plugin integration.

Observed stack:

- Frontend/runtime: Next.js, React, TypeScript, Tailwind CSS.
- UI/data libraries: Ant Design, Zustand, TanStack Query, CodeMirror, motion,
  local browser storage.
- Deployment shape: Vercel or Docker web app.
- License: AGPL-3.0.

Product implication for Novel Engine: this is a strong reference for AI
workflow orchestration, but not a suitable framework base. Its web-first,
image-first, Ant Design-heavy shape conflicts with the Novel Engine direction:
Tauri desktop, local-first project folders, manuscript-centered editing,
shadcn/ui source components, and VS Code-style density.

## Borrowing Decision Matrix

| Area | Borrow? | Novel Engine translation |
| --- | --- | --- |
| Framework | No | Keep Tauri + React + shadcn/ui + CodeMirror. Do not migrate to Next.js. |
| Ant Design UI | No | Avoid a second component system. Keep shadcn/ui and project CSS tokens. |
| Visual infinite canvas | Later, selectively | Use as a secondary story graph/provenance view, not the writing surface. |
| Node/edge workflow model | Yes | Represent chapters, memories, entities, plot threads, Skill runs, and publish jobs as graph nodes. |
| Upstream context inspection | Yes | Show which L0/L1/L2/L3 entries fed an AI rewrite or continuation. |
| Import/export graph state | Yes | Persist only view state in `.novel/graph.json`; rebuild facts from Markdown/YAML/SQLite cache. |
| Local Agent / Codex plugin idea | Yes | Future MCP/Codex bridge can expose project memory and Skill execution tools. |
| Prompt library idea | Yes | Translate into community YAML Skill packs, genre presets, and review workflows. |

## Borrowing Priority

1. Memory provenance graph: answer why a chapter continuation saw a specific
   context bundle.
2. Skill run graph: show inputs, model, prompt template, output diff, and user
   accept/reject decision.
3. Publish/upload pipeline graph: show platform adapter, draft state, dry-run
   result, upload result, and retryable failures.
4. Full pan/zoom canvas: only after the graph data contract proves useful inside
   the inspector.

The first three items directly reinforce Novel Engine's moat: four-layer
memory, pluginized Skills, and upload workflows. A general-purpose canvas does
not.

## What To Borrow

| Infinite canvas idea | Novel Engine translation |
| --- | --- |
| Canvas nodes and edges | Story graph nodes and narrative/memory edges |
| Selected node context | Selected chapter/entity/plot thread drives inspector context |
| Upstream references | Memory provenance: which L0/L1/L2/L3 entries fed a Skill |
| Import/export JSON | `.novel/graph.json` as rebuildable view state, not manuscript truth |
| Local Agent / MCP | Future Codex plugin tools for reading project memory and running Skills |
| Prompt library | Community YAML Skill packs and genre-specific workflows |

## First Useful View

The MVP graph should be read-only and derived from existing data:

- Chapter nodes from `project.chapters`.
- Codex/entity nodes from `project.codexEntries`.
- Memory nodes from `runtimeMemoryPlan.memories`.
- Plot-thread nodes from confirmed `plotThreads`.
- Edges from source provenance:
  - chapter -> L2 recent prose
  - codex entry -> L0 fact
  - chapter summary -> L1/L3 recall
  - plot thread -> L1/L3 recall
  - runtime memory -> active chapter

This view should answer one question:

> Why did the AI see this context for the current chapter?

## UI Placement

Do not replace the editor. Add a compact graph tab inside the right inspector or
a future secondary workbench mode.

Initial placement:

- Inspector tab: `图谱`
- Read-only mini graph with dense labels.
- Selecting a node highlights related entries and shows source details.

Future placement:

- A full `Story Graph` activity rail item.
- Larger canvas with pan/zoom, minimap, saved layout, and graph export.

## Storage Contract

The graph is derived state.

```text
durable truth:
  manuscript/*.md
  codex/**/*.md
  meta/project.json
  skills/*.yaml

rebuildable graph state:
  .novel/graph.json
  .novel/cache.db
```

`graph.json` may store positions and collapsed groups, but it must not become
the only place where story facts live.

Current code contract:

- Path constant: `.novel/graph.json`.
- Version: `1`.
- Source metadata: project title, active chapter id, active chapter title.
- Graph payload: node id/kind/label/detail/layer/position and edge
  id/from/to/label.
- View state: selected node id and collapsed node ids.

The contract is implemented in `src/inspector/storyGraphSnapshot.ts`. It is
pure TypeScript; desktop IO is intentionally kept outside graph producers.

Current persistence boundary:

- `src/project/graphSnapshotPersistence.ts` reads/writes validated snapshots in
  Tauri and no-ops in the browser demo.
- `src-tauri/src/project.rs` stores the file under `<project>/.novel/graph.json`.
- `src/App.tsx` loads the snapshot with other rebuildable project caches when a
  local project is opened.
- `src/inspector/StoryGraphPanel.tsx` restores the saved selected node only when
  it still exists for the active chapter, then reports view-state changes back
  for saving.
- Snapshot change detection ignores `generatedAt` so a stable graph does not
  rewrite the file just because React rendered again.

## Technical Direction

MVP should not add a heavy graph dependency. Start with a lightweight SVG/CSS
layout because the first goal is provenance clarity, not infinite zoom.

Acceptable MVP implementation:

- Build graph data in pure TypeScript from current project and memory plan.
- Render a compact SVG in the inspector.
- Use semantic workbench tokens.
- Keep the view read-only.

Only consider React Flow, XYFlow, or a custom pan/zoom canvas after the data
contract is proven and the graph exceeds inspector size.

## Agent Tool Contract

The most useful idea to borrow from `basketikun/infinite-canvas` is not its UI
library or framework. It is the structured Agent operation surface: tools can
read state, inspect context, propose operations, and trigger safe previews
without pretending to be a human clicking random controls.

Novel Engine now keeps that idea as a local TypeScript contract in
`src/agent-tools/novelAgentTools.ts`. The first executable wrapper lives in
`src/agent-tools/novelAgentRuntime.ts`; it takes the current editor state and
dispatches a small safe subset of tools. This is still local TypeScript, not a
networked MCP server yet.

Initial tools:

- `novel_get_project_state`
- `novel_get_current_chapter`
- `novel_get_memory_plan`
- `novel_list_story_graph_nodes`
- `novel_run_skill`
- `novel_propose_rewrite_patch`
- `novel_propose_memory_update`
- `novel_run_publisher_dry_run`

Safety policy:

- Read tools are review-free.
- Skill runs, rewrite patches, and memory updates are proposal-shaped and must
  remain human-reviewed before they mutate manuscript or memory.
- Publisher execution is dry-run only from the editor bridge until a concrete
  platform runtime earns its own readiness audit.

Runtime boundary:

- `novel_run_skill` may call the configured provider, but returns the Skill
  result and audit for review. It does not apply rewrite patches.
- `novel_get_memory_plan` returns both the selected memories and a compact
  source-family summary, so an Agent or UI can tell whether context came from
  manuscript prose, codex cards, project intent, summaries, plot threads,
  state logs, or concrete L3 recall entries.
- Agent callers can filter memory reads with stable `sourceFamilies`
  (`manuscript`, `codex`, `project`, `chapter_summary`, `volume_summary`,
  `plot_thread`, `character_state_log`, `recall`, `other`). `sourceContains`
  remains available for exact path or prefix probes.
- `novel_propose_rewrite_patch` validates whether the original text still
  matches the draft and always marks the patch as snapshot-required.
- `novel_propose_memory_update` normalizes character-state or plot-thread
  proposals but does not confirm them into stores.
- `novel_run_publisher_dry_run` reuses the editor publisher dry-run bridge and
  cannot touch a platform account.

## Open Questions

- Should graph layouts be deterministic by source order or persisted by user
  position?
- Should Skill runs become nodes immediately, or only after safe rewrite diff is
  accepted?
- Should `.novel/graph.json` be included in project exports by default?
- When should the TypeScript Agent tool contract be surfaced through a real MCP
  server or Codex plugin?
