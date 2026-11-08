# webseq

## UI work

This repo has a `ui-audit` skill at `.claude/skills/ui-audit/SKILL.md`. Run it immediately after
any task that adds or edits a React component (`src/components/**`, `src/ui/**`) or
`src/index.css` — before considering the task done, not just when asked. It checks the change
against the project's existing style system and against mobile/touch-friendliness, and fixes
what it finds directly. It only needs user confirmation if a fix risks changing behavior rather
than just styling.

It's also runnable on demand for a manual pass — e.g. "run the UI audit" or "audit the mobile
view" — on any part of the UI, not just recent changes.

Note: the skill was written for the original UI. The interface now lives in `src/ui/` (styles in `src/ui/ui.css`, tokens and the
shared V1 panels in `src/index.css`); its rules are in `docs/rebuild/04-ui-rules.md`, and the phone layout is `@media (max-width: 768px)`
in `ui.css` (single section at a time, bottom tab bar) rather than the old `data-mobile-tab` attribute.
