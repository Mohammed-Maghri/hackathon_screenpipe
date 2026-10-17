# Ghost / Blue implementation

2026-10-17: User approved `design-proposals/ghost-blue` and explicitly requested implementation across the app, plus migration of the workflow canvas to React Flow. This supersedes the Screenpipe/lime presentation. The proposal is the visual authority; real application behavior remains the functional authority.

Use the existing React/Tailwind stack, bundled Inter, Lucide icons, reference blue #3478F7 and accessible action blue #2D6DE0. Retain Light/Dark/System, Ghost identity, native full-width 56px titlebar and traffic-light reservation. Implement Home/library/editor/teaching/settings/onboarding layouts, not the proposal's sample data or review-only controls.

React Flow is a presentation/interaction adapter. Existing EditorNode x/y, node IDs/configuration, connection pairs and backend graph IDs remain the persistence format. Do not migrate or replace saved workflow records. Keep branch graphs, validation, browser learning/recording, processing, run logs, outputs, contracts, template draft autosave/recovery, and Clear results semantics. Avoid saving selection/measurement/viewport state as workflow data.

Forward: token aliases and primitives → shared shell → real page layouts → typed React Flow adapter → inspector → validation. Rollback: revert the branch's presentation/dependency changes; saved workflows remain readable by the previous version because their schema is unchanged. No destructive data migration is required.

Validation: baseline core/type checks passed before edits. Require build/type/core, existing draft persistence and native recording/browser checks, focused React Flow graph interaction/persistence checks, and screenshots at desktop/compact sizes in both themes. UI selector tests may follow the new inspector/navigation structure while preserving their assertions about real behavior.

Completed: real layouts, shared tokens/navigation/search, React Flow adapter and side inspector implemented. Build/type/core,88 backend tests,30 theme/layout combinations, draft recovery, native browser/Settings/compact bounds, processing outputs, schedules, activity selection, and native chrome passed. Clear results retains the graph. Validation and the separately reproduced baseline macOS native-dropdown smoke failure are recorded in `docs/BLUE_REACT_FLOW_VALIDATION.md`. Dev Electron/Vite is running on5173 with the existing backend on3001.
