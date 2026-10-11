# Ghost

A desktop workspace for Ghost with a dashboard, interactive workflow canvas, and a native Electron teaching browser. Teaching sessions capture browser actions and semantic element information, save locally, and support reviewed replay with explicit approvals and observable outcome verification.

See the [complete platform change log](CHANGELOG.md) for implemented features, validation evidence, and current limitations.

## Run

Use Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

For a renderer-only preview, run `npm run dev:web`. For the compiled desktop app:

```sh
npm run build
npm start
```

`npm run typecheck` checks all renderer, main, preload, and configuration TypeScript. The build produces `out/`; installer packaging is not configured. Electron supports Linux, macOS, and Windows. Linux needs a graphical session and Electron's standard GTK/NSS system libraries. Keep the Chromium sandbox enabled.

### Linux sandbox setup

On Linux hosts that restrict unprivileged user namespaces, Electron may report that its SUID sandbox helper is not configured. From the project directory, run:

```sh
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
npm start
```

This is a host setup step and may need repeating after Electron is reinstalled. Do not disable the Chromium sandbox to work around it.

## Validation

- Strict TypeScript and production build pass.
- `git diff --check` passes.
- Native Electron checks pass for teaching-page routing, embedded browsing, address entry, real link clicks, Back/Forward/Reload, loading state, viewport expansion, pause/stop, remote-page isolation, URL restrictions, and cleanup on exit.

## Structure

- `src/main`: Electron lifecycle, permissions, and narrowly scoped window-control IPC.
- `src/preload`: context-isolated, allowlisted desktop bridge.
- `src/renderer/src/components`: reusable controls, branding, and modal.
- `src/renderer/src/pages/Welcome.tsx`: the welcome screen.
- `src/renderer/src/pages/Dashboard.tsx`: the dashboard with local preview interactions.
- `src/renderer/src/data/workflows.ts`: typed sample workflows and activity.
- `src/renderer/src/styles/dashboard.css`: dashboard layout, panels, and responsive styling.
- `src/renderer/src/styles/globals.css`: design tokens, layout, and responsive styling.
- `src/renderer/src/assets`: locally bundled artwork.

Hash-based React Router navigation connects `/` to `/dashboard`. Get started and Skip intro open the dashboard; See how it works explains the intended product in a native HTML dialog with focus containment and Escape dismissal. Native traffic lights are used on macOS; Linux and Windows use working custom window controls. Double-click the title bar to maximize or restore.

All fonts and artwork are bundled. Node integration is disabled, context isolation and renderer sandboxing are enabled, new windows/navigation are denied, and permission requests are rejected. The CSP allows local Vite development connections. Remote websites load only in the isolated teaching WebContentsView, without the Ghost preload bridge or Node integration.

Following the [electron-vite setup](https://electron-vite.org/guide/), Vite 7 is used because the stable electron-vite 5 release requires Vite 5–7. Dependencies are locked in `package-lock.json`.

## Dashboard preview

The dashboard follows the supplied reference with a fixed sidebar, editorial heading, discovery cards, workflow table, connection overview, and activity feed. Its content area scrolls independently; the welcome screen stays fixed to the window. At smaller widths, cards reflow and the overview moves below the workflow list.

- Search by workflow or app; Ctrl/Cmd+K focuses search.
- Filter saved workflows by All, Active, Scheduled, or Drafts.
- Review example steps and explicitly preview them without executing actions.
- Create drafts, use library templates, or import a local JSON file (up to 100 KB).
- Import accepts `name`, optional `description`, and optional `steps` (an array of strings). Files are validated locally and never uploaded or executed.
- Sidebar entries open appropriate workspace panels. Needs teaching and Start recording open the native teaching browser.

All metrics, run statuses, schedules, and activity are illustrative. Drafts live in a shared in-memory store across page navigation and reset when reloading the app. No integrations or backend were added. App marks and thumbnail illustrations are rendered locally with icons and CSS.

## Artwork

`src/renderer/src/assets/landscape.png` was generated with the built-in imagegen tool. Prompt:

> Use case: stylized-concept. Asset type: premium desktop app welcome background, landscape 1536x1024. Create a cinematic almost-black rocky mountain landscape with finely detailed obsidian ridges and restrained warm gold rim lighting. Mountain peaks on the right half around 45% down, descending foreground ridges filling bottom third. Left 45% and top third are nearly solid black empty negative space for UI text. A single exquisitely thin gold orbital circular arc rises behind the mountains on the right, crest at 13% from top, center around 78% across. Dramatic, expensive editorial 3D photographic texture, black and charcoal with tiny golden highlights, subdued ambient light. No text, no letters, no interface, no logos, no stars, no colorful sky. Inspired by a dark luxury desktop product with a large serif headline placed separately on the left. Output the artwork only.

## Standalone workflow pages

Home (`#/dashboard`), the workflow list (`#/workflows`), and each workflow editor (`#/workflows/:id`) are separate, mutually exclusive routes. The Home sidebar opens the workflow list; workflow links open the full-page editor. The editor breadcrumb returns to the list. Browser Back and Forward follow these page transitions. The dashboard does not contain the workflow list or an embedded editor.

## Teaching browser and verified replay

From a workflow, open **Needs teaching** or **Start recording**. The existing teaching page uses a sandboxed Electron `WebContentsView`, browser controls, local recording and event inspection. Stop, review the replay plan, edit saved inputs, and test with per-action approval and observable outcome verification.

See [Recording and replay reliability](docs/replay-reliability.md) for the implementation, functions, commands, test evidence, manual steps and remaining limits. The prototype review is historical; unsupported actions are now explicitly blocked and an unobserved result is not reported as success.

## Graphics recovery

Linux defaults to software rendering to avoid GPU/compositor failures on Wayland/Vulkan setups. Set `GHOST_SOFTWARE_RENDERING=0` to opt back into acceleration, or `GHOST_SOFTWARE_RENDERING=1` to force software rendering on any platform. This can reduce performance on graphics-heavy sites. The choice is applied before Electron starts its windows; fully restart Ghost after changing it.

Process exits are logged under `<Electron userData>/logs/process-errors.jsonl`, with reason, exit code, and rendering mode. An app renderer crash opens a native Reload/Close dialog. Reload resets unsaved editor state; recordings already persisted on disk remain available. Buffer-limit warnings alone do not establish a crash cause.
