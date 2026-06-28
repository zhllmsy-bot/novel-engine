# Novel Engine Agent Guide

## UI Skill Workflow

- For editor UI work, load these Codex skills before changing code: `novel-editor-ui-system`, `shadcn`, `modern-ui-interaction-harness`, and `playwright`.
- Use `skill-installer` only when installing or listing external Codex skills. Prefer a small stable skill set over stacking overlapping UI advice.
- Treat the product as a dense writing workbench: three panes, pane-owned scrolling, readable prose center, compact inspector panels.
- Use shadcn/ui source components and semantic tokens first. Do not introduce another UI library for routine controls.
- For UI changes, verify with typecheck/lint/tests/build when practical and capture desktop plus mobile Playwright screenshots.

## Extension Architecture

- Keep community extension points manifest-driven before code-driven: YAML Skills, model adapters, publisher adapters, and future upload adapters should expose clear metadata.
- UI panels should read from registries/catalogs instead of hard-coding one platform or one Skill.
- High-risk AI output must stay reviewable: rewrite patches, memory state changes, and publishing actions should present a preview or dry-run before mutation.

## Local-First Product Rules

- Durable user assets stay in Markdown/YAML project files. Runtime caches and derived data stay rebuildable.
- Preserve the four-layer memory runtime as the core differentiator. UI polish should make memory inclusion, truncation, and source provenance inspectable.
- The publisher module must remain usable standalone with `.env` configuration while also being embeddable in the editor.
