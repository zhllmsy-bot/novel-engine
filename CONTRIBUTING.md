# Contributing

Novel Engine is still an executable skeleton. Contributions should make the
local-first editor, four-layer memory runtime, or manifest-driven extension
surface more reliable without locking user writing into this app.

## Start Here

```bash
npm install
npm run verify
```

`npm run verify` is the same lightweight gate used by CI. It runs the workspace
smoke check, tests, typecheck, lint, and production build.

## Good First Contribution Paths

- **Project/demo data**: create or improve Markdown-first demo projects with
  `meta/memory-eval.json` expectations.
- **Skills**: add YAML workflows with `npm run skills:new`, then run
  `npm run skills:check` or `npm run workspace:check`.
- **Provider adapters**: scaffold metadata with `npm run adapters:new -- --type provider`.
- **Publisher/upload adapters**: scaffold metadata with
  `npm run adapters:new -- --type publisher`; keep real platform automation
  behind dry-run and user confirmation.
- **Memory runtime**: update `docs/memory-architecture.md`, tests, and
  `npm run memory:eval` expectations when changing recall or budget behavior.

## Design Rules

- Durable author assets stay in Markdown/YAML/JSON project files.
- `.novel/` data is runtime cache and should be rebuildable.
- High-risk AI output must stay reviewable: prose rewrites, memory state
  changes, and publishing actions need previews, patches, proposals, or dry-runs.
- Extension points should be manifest-first before code-first.
- Unknown chapter order or untrusted project metadata must reduce recall scope,
  not expand it.

## Required Checks

Run the full gate before opening a PR:

```bash
npm run verify
```

For focused iteration:

```bash
npm run project:check -- examples/demo-novel
npm run memory:eval
npm run extensions:check
npm run skills:check
npm run providers:check
npm run publisher:check
```

Rust/Tauri packaging is not part of the default CI gate yet. If your change
touches `src-tauri/`, also run `npm run tauri:dev` or the relevant Rust command
locally and note the result in the PR.
