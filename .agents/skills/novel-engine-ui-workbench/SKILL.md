---
name: novel-engine-ui-workbench
description: Use when improving the Novel Engine editor UI, inspector panels, shadcn/ui composition, four-layer memory visibility, Skill catalog, publisher adapter catalog, or local-first writing workbench flows.
---

# Novel Engine UI Workbench

Use this skill together with the global `shadcn`, `modern-ui-interaction-harness`, and `playwright` skills when they are available.

## Product Shape

- Build a dense local-first writing workbench, not a landing page.
- Preserve the three-pane structure: project navigation, prose editor, right inspector.
- Keep the editor visually central. Side panels should support scanning, not compete with the manuscript.
- Use shadcn/ui source components, semantic tokens, and lucide icons before adding custom UI.
- Avoid new UI libraries unless a requested feature cannot reasonably be built with the existing stack.

## Core Differentiators

- Make four-layer memory inspectable: show source, layer, budget usage, truncation, and dropped entries.
- Make Skills and publisher adapters feel like catalogs: manifest metadata, status badges, required inputs, capabilities, config paths, and a reviewable run action.
- Keep high-risk AI actions human-in-the-loop: rewrite patches, memory state updates, and publisher runs need preview, diff, dry-run, or confirmation.
- Keep local-first data boundaries visible: Markdown/YAML are durable assets; SQLite/runtime data are rebuildable cache.

## UI Rules

- Root workspace should fill `100dvh` and hide body scrolling.
- Each pane owns scrolling. Inspector tab content should use `ScrollArea`, `min-h-0`, and right padding so content never sits under the scrollbar.
- Sidebar width should stay near 260-300px; inspector near 340-380px; editor column uses `minmax(0, 1fr)`.
- Hide the inspector on tablet/mobile instead of squeezing the editor below readable width.
- Use cards only for repeated records such as memories, versions, Skill audits, proposals, and publish reports.
- Use `Accordion` for registries/catalogs, `Badge` for status/source, `Alert` for errors, `Empty` for empty states, `Field` for provider settings, and `Tabs` for inspector sections.

## Extension Rules

- Prefer registry/catalog modules over hard-coded UI lists for Skills, providers, and publishers.
- Community extension points should be manifest-driven first: YAML Skills, model adapters, publisher adapters, and upload adapters.
- Publisher/upload modules must remain independently runnable with `.env` configuration while also being embeddable in the editor.
- Do not let a Skill or adapter directly mutate manuscript text. Route changes through a typed result, diff, proposal, or dry-run report.

## Validation

- Before finishing substantial UI changes, run `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run test -- --reporter=dot`, and `npm run build` when practical.
- Also run `npm run project:check` and `npm run skills:check` when changing project loading, Skills, memory, or publisher surfaces.
- Verify with Playwright screenshots on desktop and mobile. Check for double scrollbars, hidden inspector content, clipped text, broken tab/accordion keyboard structure, and console errors.
