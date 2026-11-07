# 07 · Accessibility pass

Scope: ARIA, screen readers, keyboard and focus in the rebuilt UI (`?ui=2`). **No visual change**: nothing was restyled, moved or
renamed on screen; the work is attributes, keyboard handlers, focus handling and visually-hidden text. The only things that can
appear are a keyboard-only step cursor on an empty step (`:focus-visible` on the step lane) and the lane's focus ring.

## Method
1. Automated: **axe-core** (WCAG 2.0/2.1 A + AA + best-practice) run against 15 states: every drawer tab, device tab, sidebar
   section, popover, Arrange, Mixer, main menu (both sections), cheat-sheet. Plus a script that checks every button/input/select
   for an accessible name (121 controls examined; none unnamed).
2. Scripted keyboard flows in a real browser (18 checks, below), re-run after each fix.
3. Not done: a pass with a real screen reader (VoiceOver / NVDA). The announcements below are asserted from the live region's
   text, not heard.

## What was wrong, and the fix
| Problem | Fix |
|---|---|
| Tab strips (workspace nav, drawer, device, main menu, phone bar) had `role=tab` but no arrow keys, every tab was a tab stop, no panels | WAI-ARIA tabs: roving `tabindex`, ←/→ (↑/↓ in the vertical menu), Home/End, automatic activation, `aria-controls`, `role=tabpanel` + `aria-labelledby` (`kit/a11y.tsx` `tabKeyDown`, `PanelHeader` `idBase`) |
| Modals did not trap focus or return it | `useFocusTrap`: focus in on open, Tab cycles inside, focus back to the opener on close (main menu, cheat-sheet, the Start dialog). Start gate is now a labelled `role=dialog` |
| Popovers left focus on the trigger | Focus moves to the first control; Esc closes and returns focus to the trigger |
| Musical Guide did not make the app inert (V1 relied on a root ref the new shell never attached; guide was rendered inside the root) | Root is the controller's `appRef`; the guide is a sibling, so the app is `inert` behind it |
| Step lane declared `role=grid` with no rows/cells; the cursor was silent | `role=group` + `aria-roledescription="step sequencer"` + instructions (`aria-describedby`); every cursor move / toggle / delete is announced ("Track 03, Snare, step 5, 2 notes") |
| Keys pressed in the graph, roll or track buttons bubbled to the lane (ArrowDown in the graph moved the cursor to another track; Enter on a button would toggle a step) | The lane acts only on keys pressed on the lane itself |
| Graph painting was pointer-only | Focusable; ←/→ choose the next/previous step with a note, ↑/↓ change the value (Shift = ×10), pitch moves through the notes the key allows; announced |
| Piano roll could not add or choose a note from the keyboard | Alt+←/→ choose previous/next note; Enter adds a note at the cursor; announcements and a live note count |
| Pattern list rows and the saved-project list were clickable `div`s | Rows are `role=button` with Enter/Space, ↑/↓, F2 to rename; saved projects are a `listbox` (↑/↓, Enter opens, Delete removes with confirm) |
| No announcements for state changes | One polite live region (`AnnouncerProvider`): workspace, play/pause/stop, saved / save failed, selected track, selected pattern |
| Landmarks and headings | `<h1>` (visually hidden), banner, labelled `aside`/`nav`/`main`/regions; headings h1 → h2; nothing outside a landmark |
| `aria-label` on a span with no role (`aria-prohibited-attr`); the key chip's name did not contain its visible text; pattern rows' name did not contain the visible text | `role=img` on the source glyph; chip name = "C Chromatic, key and scale"; row name is computed from its content (with visually-hidden expansions) |
| Selected track header had no programmatic state | `aria-current` |

## Keyboard map (all pre-existing shortcuts unchanged)
Workspace tabs ←/→ · menu ⌘, · save ⌘S · open ⌘O · `?` cheat-sheet · `1 2 3` workspaces · `B` sidebar · `D` device · `G` graph.
**Step lane** (focus it): ←/→ step, ↑/↓ track, Enter add/remove, Delete remove, Esc clear.
**Graph:** ←/→ step with a note, ↑/↓ value. **Roll:** Alt+←/→ choose note, Enter add, arrows move, ⇧↑/↓ octave, Delete, ⌘D, ⌘C/X/V.
**Patterns:** ↑/↓ rows, Enter select, F2 rename. **Saved projects:** ↑/↓, Enter, Delete.

## Verification (automated, headless Chromium)
- axe: **0 violations** except colour contrast (below). Before the pass: 5 rule groups (prohibited ARIA, contrast, name mismatch,
  region, heading order) plus issues axe cannot see (focus, keyboard).
- 18/18 keyboard checks: tab arrows + panel labelling, announcement of workspace change, menu focus in / trapped / returned,
  lane cursor + toggle announcements, note added by keyboard, graph value change by keyboard, drawer tab arrows, popover focus in/out,
  pattern rename by keyboard, guide makes the app inert.
- 836 unit tests and `tsc` unchanged.

## Open: needs a decision from you (both would change how the UI looks or behaves)
1. **Colour contrast (WCAG 1.4.3), 72 nodes.** The dim text token `--text-dim: #6b7686` is 4.0–4.2:1 on the panel backgrounds
   (needs 4.5:1) and the hint text that also uses `opacity: .7` is 2.6:1. Smallest fix: `--text-dim: #7a8696` (≥ 4.76:1 on every panel
   surface) and drop the `.7` opacity on hints. It is a single token plus one rule, and slightly brighter secondary text.
2. **Single-key shortcuts (WCAG 2.1.4):** `1 2 3 B D G` act without a modifier. They are inactive while typing in a field, but the
   criterion asks for a way to turn them off or remap them. Fix would be a "single-key shortcuts" switch in Main menu → Help.
3. **Gestures with no keyboard equivalent:** dragging a note to a new step in the step lane and resizing by edge (resizing has the
   graph's Length tab, moving has the roll's arrows); dragging clips on Arrange is V1's timeline (Enter/Delete only).
4. Real screen-reader testing (above).
