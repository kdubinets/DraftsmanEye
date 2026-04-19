# AGENTS.md

This file provides guidance to coding agents working in this repository.

See [apps/draftsman-description.md](apps/draftsman-description.md) for the product brief. Keep this file focused on repository conventions and implementation constraints rather than duplicating the full product description.

## Project Summary

**Draftsman Eye** is a small client-only web app for practicing observational drawing estimation exercises in the browser.

The app is a **perceptual training tool**, not a drawing simulator. It should help users improve visual judgment through repeated short trials with immediate objective feedback. It should remain narrow, fast, and quiet.

## Product Scope

The app covers four exercise families:

- **Division** — divide a horizontal or vertical line into halves, thirds, quarters, or fifths
- **Freehand Control** — draw a straight line, circle, or ellipse freehand and compare it to the fitted ideal
- **Target Drawing** — draw to explicit targets: a line through two points, or a circle from center+radius or three points
- **Trace Control** — trace a faint guide shape (line, circle, ellipse) as accurately as possible

Same-axis transfer and cross-axis transfer are planned but not yet implemented.

These families train different perceptual and motor skills and should be treated as distinct modes with separate statistics.

On app load, the main page should act as the practice index:

- list available exercises and relevant variations
- show the user's previous aggregated score for each selectable drill
- offer an `Auto` option to choose the next exercise

After each completed exercise, the user should be able to:

- repeat the same exercise
- return to the main list
- ask `Auto` to choose the next drill

## Product Non-Goals

The app trains visual judgment and freehand motor control, not full studio workflow. Do not include:

- pencil or brush simulation (pressure curves, texture, blending)
- ruler simulation
- account systems
- cloud sync
- social features
- gamification clutter (streaks-as-currency, XP, unlocks)
- complex settings unrelated to the core drill loop

Freehand drawing, target drawing, and trace drills **are** in scope — they are first-class exercise families, not non-goals.

When in doubt, prefer a simpler interaction model that supports fast repetition.

## Stack

- **TypeScript + Vite**
- **Vanilla DOM APIs** — no UI framework unless explicitly adopted later
- **SVG-first rendering** for geometry, guides, marks, and feedback
- **Browser-local persistence** only for MVP
- **Static hosting** suitable for Cloudflare Pages or GitHub Pages

There is no backend in the MVP. Do not introduce server dependencies casually.

## Commands

Assume these commands are the expected developer workflow once the project is scaffolded:

```bash
npm run dev
npm run build
npm run lint
npm run format
npm test        # Playwright E2E tests
npm run unit    # vitest unit tests (geometry, scoring, storage, catalog)
npm run typecheck  # tsc --noEmit, faster than a full build
```

If the repository has not yet been scaffolded far enough for a command to exist, say so explicitly instead of guessing.

## Core Implementation Principles

- Keep the interaction loop minimal: one exercise, one action, one reveal, next trial
- Keep the screen uncluttered and easy to read
- Make geometry and scoring deterministic and inspectable
- Prefer simple direct DOM and SVG code over abstraction-heavy UI architecture
- Avoid helpers that only save one or two lines of code
- Do not add infrastructure for hypothetical future features

The value of the app is the repetition-feedback loop, not architectural cleverness.

## Interaction Model

Two distinct trial flows exist:

**Single-mark flow** (Division, Transfer):
1. Show the main exercise list with scores and `Auto`
2. User selects a drill directly, or chooses `Auto`
3. App shows one exercise
4. User places one mark (click/tap)
5. App commits the answer
6. App reveals the placed mark, correct mark, visual error, and numeric error
7. User chooses `Again`, `Back to List`, or `Auto Next`

**Freehand/Target/Trace flow**:
1. Same list and selection step
2. App shows the exercise canvas (with guide marks for target/trace variants)
3. User draws a stroke with pointer/stylus
4. App fits the ideal shape, overlays the correction, shows numeric scores
5. History thumbnail is appended; user can inspect past attempts
6. User chooses `Again`, `Back to List`, or `Auto Next`

For all flows:
- keep the intended action visually obvious
- avoid multi-step editing or configuration flows
- the challenge should come from perceptual or motor judgment, not interface decoding

## Geometry and Scoring

Geometry and scoring are central to the product. Treat them as first-class behavior.

- Use relative error as the primary metric
- Absolute pixel error is useful as supporting feedback
- Signed error should be shown when direction is meaningful
- Do not imply physical measurement accuracy or real-world units
- Keep calculations deterministic and easy to verify from the rendered geometry
- Randomization should stay within controlled bounds so trials remain legible and comparable
- Keep stored score aggregation simple enough to inspect and explain

For aggregated progress shown on the main page:

- use an exponential moving average as the default aggregation model
- store aggregates separately for each selectable exercise or variation
- update the aggregate after each completed trial
- prefer recent performance over distant history

If `Auto` selection depends on score data, keep the heuristic explicit and debuggable. A reasonable default is to bias toward weaker or less-practiced drills rather than selecting uniformly at random.

If geometry or scoring code becomes non-obvious, explain the reasoning with a short comment at the point of use.

## Persistence

For MVP, all data should remain in the browser.

- Prefer `localStorage` for simple state and lightweight history
- Consider `IndexedDB` only if local history becomes too rich for `localStorage`
- Keep persisted data small, explicit, and versionable
- Do not add accounts, sync, or remote analytics without an explicit product decision

Statistics and aggregated scores should remain separated by selectable drill unless there is a deliberate reason to combine them.

## UI Tone

The UI should feel:

- quiet
- precise
- utilitarian
- focused

Visual design should support concentration. Avoid decorative UI that competes with the geometry or feedback.

## Code Quality Gates

Run before every commit when the relevant commands exist:

```bash
npm run lint
npm run build
npm run unit
```

Run before reporting a behavior change as complete:

```bash
npm test
```

If the repo is not yet scaffolded enough for these commands or tests to run, state that clearly in the final report.

## Design Philosophy

Priority: **Correctness > Clarity > Simplicity > Performance > Cleverness.**

- Prefer deep functions with cohesive responsibility over many shallow wrappers
- Do not create utilities for one-off operations
- Do not design for hypothetical future requirements
- Comments explain *why*, not *what*
- Consistency matters more than novelty
- If code within scope feels below the bar, improve it; if it is out of scope, note it and move on

Signs of too-shallow design:

- a function body mostly forwards to another function
- callers must understand internals to use an API safely
- several functions are always called together in sequence
- a function name describes implementation mechanics instead of purpose

## Documentation and Comments

- JSDoc is for users of the code; inline comments are for maintainers
- Each file should start with a short purpose summary
- Document types and functions when their contracts, side effects, or failure behavior are not obvious from names and signatures
- Keep comments terse, factual, and local to the non-obvious decision they explain
- Review and update adjacent comments when changing behavior
- Remove stale comments rather than working around them

Knowledge should live where it is used:

- code-specific insight: add an inline comment nearby
- module-level pattern: update that file's header comment
- cross-cutting convention: add it to this file

## Error Handling

Errors should be handled close to the interaction that failed.

- Show user-facing errors inline near the relevant control or exercise view
- Never silently discard unexpected failures
- Log unexpected errors with `console.error`
- Prefer specific messages for invalid state, storage failures, and rendering assumptions

There is no need for a global toast or notification system in the MVP unless the UI grows enough to justify it.

## Testing

Default test stance: E2E for user-visible flows, unit tests for geometry and scoring.

- **E2E (Playwright):** exercise flow, feedback display, statistics tracking, navigation — run with `npm test`
- **Unit (vitest):** geometry fitting (`fitLine`, `fitCircle`, `fitEllipse`), scoring functions, band thresholds, storage, catalog — run with `npm run unit`

Unit tests live alongside their source files as `*.test.ts`. Current coverage:

| Module | File |
|--------|------|
| Linear algebra solvers | `src/geometry/linearAlgebra.test.ts` |
| `fitLine` | `src/geometry/fitLine.test.ts` |
| `fitCircle` | `src/geometry/fitCircle.test.ts` |
| `fitEllipse` | `src/geometry/fitEllipse.test.ts` |
| Feedback bands | `src/scoring/bands.test.ts` |
| Line scoring (golden values) | `src/scoring/line.test.ts` |
| Circle scoring (golden values) | `src/scoring/circle.test.ts` |
| Ellipse scoring (golden values) | `src/scoring/ellipse.test.ts` |
| Progress storage | `src/storage/progress.test.ts` |
| Exercise catalog / Auto selector | `src/practice/catalog.test.ts` |

**Before any refactor or weight re-tuning**, run `npm run unit` to confirm existing golden-value snapshots still match. If scoring weights change intentionally, update the inline snapshots with `npm run unit -- --update-snapshots`.

The scoring golden values reflect real scorer behavior including the join-angle penalty — even a perfect geometric circle or ellipse will score below 100 due to that penalty. This is expected and captured in the snapshots.

- Test confusing or boundary-case inputs before polishing happy paths

When writing tests, ask:

- what mistaken input would a confused user try?
- what valid but unusual geometry could break assumptions?
- what state transitions are easy to get subtly wrong?

Before reporting behavior work as done, run the available quality gates in the current session. If tests are missing, blocked, or not yet scaffolded, say so explicitly.

## Security

- Never insert user-controlled content with `innerHTML`; use `textContent` or explicit DOM construction
- Treat persisted browser data as untrusted input when reading it back
- Keep local storage formats explicit and defensive against missing or malformed values
- Do not introduce remote data collection, auth, or networked persistence without explicit approval

This app does not depend on secrecy of client-side state for correctness.

## Troubleshooting

When diagnosing issues, check in this order:

1. Browser DevTools Console for exceptions and explicit `console.error` output
2. DOM and SVG state in the Elements panel
3. Event flow and pointer coordinates for input bugs
4. Local storage contents for persistence bugs
5. Build output for TypeScript, bundling, or asset issues

For geometry bugs, verify both the rendered positions and the underlying numeric calculation. Do not assume the drawing is wrong or the math is wrong until both are inspected.

## Agent Workflow

### Design

For non-trivial tasks, discuss the approach and agree on direction before implementation. If requirements are ambiguous or multiple approaches are plausible, surface the tradeoffs and get alignment first.

When improvement opportunities are discovered during a task that are out of scope, record them in [NextToDo.md](NextToDo.md) under a `Debt` section if that file exists. If it does not exist yet, mention the debt in the final report rather than creating unrelated project management structure without approval.

### By task size

| Task | Process |
|------|---------|
| Single file, obvious change | Just do it |
| Multi-file or non-obvious | Brief discussion -> written plan -> implement -> quality gates |
| Uncertain scope or approach | Stop and discuss before code |

### When to stop and escalate

- Requirements are ambiguous enough that a wrong assumption would be costly
- The same issue persists after three attempts without measurable progress
- The task expands materially beyond the original scope

### Approval

Captain may reply with **"+"** to mean: approved, proceed.

## Git

Commit messages should use a short imperative subject, followed by a blank line and a concise explanation of purpose and effect.

Example:

```text
Add first-pass division exercise rendering

Render horizontal and vertical division trials in SVG and
compute target marks from a single geometry model.
```

No `Co-Authored-By` trailers.

## Communication

Captain is an experienced software engineer who may be new to this specific JS/TS stack. Explain non-obvious decisions when they matter:

- why a stack-specific pattern is appropriate here
- what a more obvious alternative would look like
- why that alternative was not chosen

Keep explanations concise and contextual rather than tutorial-style.

## Deployment

Assume static deployment unless the project direction changes.

- preferred targets: Cloudflare Pages or GitHub Pages
- build output should remain static-host friendly
- do not add backend-dependent deployment assumptions without approval
