# Ghost / Air — design direction 01

An isolated, interactive desktop design proposal inspired by the supplied mobile reference. **Pending visual review.** No application source, routes, backend behavior, or production styles have changed.

From the repository root:

```sh
python3 -m http.server 4177 --bind 127.0.0.1
```

Open [the preview](http://127.0.0.1:4177/design-preview/) or [the design system board](http://127.0.0.1:4177/design-preview/#system).

## Review surfaces

- **Home:** creation composer, pastel starting points, recent workflows, illustrative workspace context.
- **Workflows:** searchable sample library and status filters.
- **Editor:** selectable steps, step inspector, in-memory description changes, zoom, and review dialogs.
- **Record a routine:** three-column teaching layout with simulated capture.
- **Design system:** colors, type, spacing, radii, elevation, controls, statuses, and loading/empty/error examples.

Use the top review tabs or app navigation. Cmd/Ctrl+K opens search. Native dialogs support Escape. All data and execution are simulated; descriptions saved in the preview reset on reload. No account, external app, browser capture, generation service, or workflow execution is invoked.

## Design sources

- `tokens.css`: proposed primitive → semantic → component tokens, isolated from the app.
- `.ui-craft/brief.md`: product principles and reference adaptation.
- `.ui-craft/tokens.md`: token catalog and responsive measurements.
- `.ui-craft/surfaces/redesign.md`: preservation map, state contracts, and later implementation constraints.

Geist is bundled locally with its license. App marks reuse the repository's local artwork. UI icons are a consistent inline SVG set. No runtime package installation is required.

## Validation

Rendered and visually checked at 1440px and 1280px desktop widths, with overflow checks across all five views at 1440, 1280, 1024, 768, and 390px. Browser checks cover navigation, search, status filters, empty search, selection, local description saves, simulated recording, composer preview, modal Escape, and command search. No browser errors or missing assets were observed. These checks validate the prototype, not production behavior or a complete accessibility audit.
