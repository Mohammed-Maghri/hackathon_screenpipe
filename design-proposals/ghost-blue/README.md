# Ghost / Blue

A standalone design-system proposal based on the three supplied Noera reference images. The approved direction is now implemented in the Ghost application. This folder remains the isolated proposal with sample data; production uses the real workflows and React Flow. See [implementation validation](../../docs/BLUE_REACT_FLOW_VALIDATION.md).

## Open the preview

From the repository root:

```sh
node_modules/.bin/vite --config design-proposals/ghost-blue/vite.config.mjs
```

Open <http://127.0.0.1:4183/#system> for the design system, or <http://127.0.0.1:4183/#home> for the product preview.

The top review bar switches between product and system views. Sun, moon, and monitor controls select Light, Dark, and System. The review bar and “Sample data” label are presentation tools, not proposed application features.

## Included

- Home: prompt, source selector, examples, recent workflow cards.
- Workflows: cards/list, search, drafts, schedules, templates, import entry point.
- Editor: canvas, selection/inspector, add menu, steps, run results, activity, settings.
- Teaching: browser-first layout with adjacent guidance.
- Settings: General, Appearance, Workspace.
- Introduction: a short three-step welcome.
- Design system: palette, typography, spacing, components, states, layout links.

Navigation, theme controls, search, filtering, card actions, node selection, sample creation/deletion, and sample result clearing are interactive. Workflow execution, recording, scheduling, sharing, backend persistence, graph connections, and imports are **illustrative**. They do not access the app, Screenpipe, or any connected service.

Only theme and sidebar preference persist, under the `ghost-blue-proposal.*` keys. Example workflows and edits live in this tab; reload restores the samples. This is separate from the actual application's persistent template drafts.

## Files

- [Design specification](./DESIGN-SYSTEM.md): principles, complete layouts, component contracts, state matrix, and eventual implementation constraints.
- [Tokens](./tokens.css): primitive → semantic → component tokens, light and dark.
- [Preview](./main.tsx): self-contained React demonstration with sample data.
- [Styles](./styles.css): isolated presentation, responsive and reduced-motion rules.
- [Validation](./VALIDATION.md): review evidence and prototype boundaries.
- [Screenshots](./screenshots/): reviewed desktop and compact layouts.

The preview reuses the existing local React/Vite/Lucide installation and bundled Inter font. It adds no application dependencies, modifies no production imports/configuration, and uses a separate port from the running app.

## Check or build

```sh
node_modules/.bin/tsc -p design-proposals/ghost-blue/tsconfig.json
node_modules/.bin/vite build --config design-proposals/ghost-blue/vite.config.mjs
node design-proposals/ghost-blue/verify.mjs
```

The browser check uses the repository's `playwright-core` dependency and expects a Playwright Chromium installation. Set `PLAYWRIGHT_EXECUTABLE_PATH` to use an existing Chromium executable, or `PLAYWRIGHT_MODULE` to use another installed Playwright module. `dist/` is a self-contained static build with the font bundled; it is ignored by Git.
