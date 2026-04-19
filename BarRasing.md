# Bar-Raising Recommendations

Technical-debt review and recommendations for moving Draftsman Eye beyond the POC. Written as a tech-lead / architect pass over the current state (April 2026).

## Context

Product direction that shapes these recommendations:

- Freehand / target / trace exercises are **first-class, not a non-goal**. The current brief is stale.
- Upcoming work: user configuration screen, more exercises, UX/design refresh, guiding system for repeated practice.
- Guiding system should **suggest, never gate** — help the user pick, but never block experimentation or enjoyment.
- No UI framework. Small in-house render helpers are acceptable.
- User progress in local storage may be wiped when schema changes.

## Headline verdict

The POC works and the geometry math is solid, but the codebase is **one ~3000-line file doing everything** and the **data model is too thin** to support the planned roadmap. The biggest risks aren't bugs — they're structural choices that will make the next phase painful.

---

## 0. Prerequisite: update the brief [Done]

[AGENTS.md](AGENTS.md) and [apps/draftsman-description.md](apps/draftsman-description.md) both list freehand drawing, pencil/ruler simulation, etc. as explicit non-goals. The code has moved past that. Until the brief is honest, every new contributor (human or agent) will argue with decisions you've already made.

30-minute job. Do this before any refactor.

---

## 1. Critical — blocks the roadmap [One left for later]

### 1.1 Split `src/main.ts` (3008 lines)   [Done]

[src/main.ts](src/main.ts) currently mixes: bootstrap, routing, rendering, geometry fitting (circle/ellipse least-squares, Gaussian elimination), scoring, DOM construction, pressure/speed visualization, fullscreen, modal, history, CSS class juggling. No module boundaries.

Target layout:

```
src/
  app/
    state.ts          // signals, routing, history integration
    screens.ts        // Screen = { mount(root): () => void }
  render/
    h.ts              // h(), s(), attr helpers
    components.ts     // button, card, stat, feedback banner
  exercises/
    types.ts          // ExerciseDefinition with render() + score()
    singleMark/       // division + future transfer/copy/double
    freehand/         // free line/circle/ellipse + target + trace
    registry.ts       // EXERCISES array + getById + auto selector
  geometry/
    fitLine.ts, fitCircle.ts, fitEllipse.ts   // pure, tested
    primitives.ts     // distance, angle diff, normalize, clamp
  scoring/
    bands.ts          // single source for thresholds + labels + hues
    weights.ts        // named scoring constants with rationale
    line.ts, circle.ts, ellipse.ts, singleMark.ts
  storage/
    progress.ts       // v2 schema, migration (wipe v1)
    settings.ts       // user config, persisted, reactive
  styles/
    tokens.css, layout.css, exercise.css, history.css
```

### 1.2 Progress model is too shallow for a guiding system [Done]

[src/storage/progress.ts](src/storage/progress.ts) stores only `{emaScore, attempts}`. The existing product brief asks for median error, spread, and directional bias — none are captured. Spaced-repetition and "weakest recent" selection need per-attempt timestamps too.

**Schema v2** (wipe v1 on load):

```ts
type AttemptRecord = {
  exerciseId: ExerciseId;
  score: number;           // 0..100
  signedError: number;     // for directional bias
  timestamp: number;
};

type ProgressStore = {
  version: 2;
  attempts: AttemptRecord[];                // capped ring buffer, e.g. last 500
  aggregates: Record<ExerciseId, {
    ema: number;
    attempts: number;
    lastPracticedAt: number;
  }>;
};
```

Derive median / spread / bias on read from the recent slice. Cap attempts globally to keep localStorage bounded. Move to IndexedDB only when localStorage actually hurts — not speculatively.

### 1.3 Config is frozen at compile time [Done]

`CONFIG` in [src/main.ts:39-50](src/main.ts#L39-L50) is `as const` with no reader path. A user-facing config screen needs a proper **settings store**: typed keys, defaults, persistence, reactive readers.

Design the settings store *before* drawing the config UI. Then the UI is just a bound form, not a one-off.

### 1.4 Full re-render on every state change [Done]

`renderApp()` does `appRoot.replaceChildren()` and rebuilds the world on every transition. It works today; it will fight you as soon as you add config forms, transitions, animations, history, focus management.

Fix by modelling **screens with lifecycle**:

```ts
type Screen = {
  mount(root: HTMLElement): () => void;  // returns cleanup
};
```

Each screen owns its DOM, listeners, timers. Routing swaps screens by calling cleanup on the old and `mount` on the new. Kills the `renderVersion` stale-closure hack.

### 1.5 `renderVersion` is a stale-closure hack [Done]

[src/main.ts:53, 339, 606](src/main.ts#L53) — a module-global counter compared inside `setTimeout` to detect whether the screen has been replaced. Symptom of missing lifecycle management: nothing cancels the timer when the screen unmounts. The `Screen` pattern above fixes this at the root.

### 1.6 No unit tests on geometry / scoring [Done]

The heart of the product — `fitCircle`, `fitEllipse`, `scoreFreehandLine`, `scoreSelection`, `boundedNormalOffset` — is non-trivial math with zero tests. Only [e2e/home.spec.ts](e2e/home.spec.ts) exists.

Extract to pure modules (see 1.1), add vitest, and **pin current outputs as golden values** before any refactor or weight re-tuning. E2E stays for flows; vitest covers geometry/scoring.

---

## 2. High — raises the quality bar [Done for now]

### 2.1 Scoring weight magic numbers [Done]

Four variants of the same-shape formula across [src/main.ts:2075-2083](src/main.ts#L2075-L2083), [2197-2205](src/main.ts#L2197-L2205), [1230-1240](src/main.ts#L1230-L1240), [1297-1308](src/main.ts#L1297-L1308):

```
100 - (normalizedMeanError * 1200
     + normalizedMaxError  * 180
     + normalizedClosureGap * 420
     + joinAngleDegrees    * 0.35)
```

Extract named constants, document what each weight is *meant* to penalize (and at what magnitude of error it should cost ~10 points), and write golden-value tests so re-tuning is safe. Future-you will thank you.

### 2.2 Exercise-kind dispatch is fragile [Postponed to be done together with 4.4]

[src/main.ts:67-80](src/main.ts#L67-L80) — a 9-branch `||` chain to decide the renderer. Adding an exercise means touching core render logic. Move `render` / `scoreStroke` / `createTrial` onto the exercise definition itself (polymorphic dispatch) so [src/practice/catalog.ts](src/practice/catalog.ts) is the single source of truth.

### 2.3 Placeholder exercises carry dead code [Done]

[src/practice/catalog.ts:357-385](src/practice/catalog.ts#L357-L385) returns a synthetic trial for unimplemented drills. `implemented: false` exercises shouldn't be `SingleMarkExerciseDefinition` at all — model them as a separate narrower type, or drop the placeholders and only list implemented drills.

### 2.4 `Auto` isn't really "weaker drill first" [Done]

[src/practice/catalog.ts:238-263](src/practice/catalog.ts#L238-L263) sorts by attempts first, then by score. It always picks the least-practiced drill deterministically — no jitter, no recency. Hit Auto Next repeatedly and you see the same sequence.

New selector, consistent with the "suggest, don't gate" stance:

```
score = weaknessBonus + recencyBonus + smallRandomJitter
```

- Surface the top pick as Auto, but also the next two as "You might also try…" on the list screen.
- Show a one-line explanation when Auto picks ("Weakest recent score" / "Least practiced today"). Keeps the selector trustworthy rather than opaque.
- Never hide or disable drills based on progress. No curriculum locks.

### 2.5 Three parallel threshold functions [Done]

`feedbackHueForError`, `feedbackBandClass`, `feedbackLabel` at [src/main.ts:2911-2957](src/main.ts#L2911-L2957) repeat the same `<=1 / <=3 / <=5 / else` ladder. One band definition → derive all three. When design shifts a threshold, you'll change it in one place.

### 2.6 Progress validator is too permissive [Done]

[src/storage/progress.ts:62-78](src/storage/progress.ts#L62-L78) accepts any object whose values have numeric `emaScore` / `attempts` but doesn't validate keys against known exercise IDs or clamp ranges. Stale entries for removed drills linger forever. Add a known-id filter + a "Reset progress" control in the config screen.

### 2.7 Accessibility gaps [Deffered till later]

- No keyboard placement for single-mark drills — pointerdown only ([src/main.ts:2665](src/main.ts#L2665)).
- Focus is lost on every re-render.
- Modal has `role="dialog"` but no focus trap or focus restore ([src/main.ts:1510-1542](src/main.ts#L1510-L1542)).
- Button label typo: "Comming" at [src/main.ts:769](src/main.ts#L769).

The `Screen` lifecycle + `h()` helpers make focus management easy to add once, everywhere.

---

## 3. Medium — do while touching nearby code

- **URL routing / history integration.** Browser back doesn't work; can't deep-link to a drill for demo. `history.pushState` + `popstate` is ~20 lines once `Screen` exists.
- **Error boundaries.** [src/main.ts:87](src/main.ts#L87) throws on unknown exercise kind — crashes the whole app. Log + fall back to list.
- **Fullscreen state desync.** [src/main.ts:2596](src/main.ts#L2596) swallows errors after `console.error`, leaving the `is-maximized` class out of sync with actual fullscreen state on failure.
- **CSS split.** [src/styles/main.css](src/styles/main.css) is 11KB of everything. Fine today; with a design refresh, split by surface and drive colors from CSS-var tokens instead of mixed hsl-in-JS + CSS-vars.
- **`typecheck` script.** `npm run build` bundles *and* typechecks. Add `"typecheck": "tsc --noEmit"` for faster CI and local feedback.
- **Per-call `localStorage` re-parse.** `updateStoredProgress` re-parses the full JSON every commit. Keep an in-memory cache, write-through. Minor, but free once you touch the module.
- **Pressure/speed stroke nodes.** [src/main.ts:1870-1886](src/main.ts#L1870-L1886) creates one `<line>` per segment. Fine for short strokes, but long fast-pencil strokes yield hundreds of DOM nodes. Consider `<path>` with per-segment gradients if it bites.

---

## 4. Small in-house render helpers

Since no framework, the minimal shape that pays for itself — **stop here, don't build more**:

### 4.1 `h()` and `s()` constructors

Replaces the `document.createElement` → `setAttribute` × N → `append` verbosity. Not JSX. Not reactive. Just a constructor.

```ts
// render/h.ts
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Partial<HTMLElementTagNameMap[K]> & { class?: string; dataset?: Record<string, string> },
  children?: (Node | string | null | undefined)[],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) applyProps(el, props);
  if (children) el.append(...children.filter(isRenderable).map(toNode));
  return el;
}

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
  children?: (Node | null | undefined)[],
): SVGElementTagNameMap[K] { /* analogous, uses createElementNS + setAttribute */ }
```

SVG equivalent collapses the `toFixed(2)` boilerplate dramatically — current code has ~150 `setAttribute('cx', x.toFixed(2))`-style calls.

### 4.2 `Screen` lifecycle

```ts
// app/screens.ts
export type Screen = {
  mount(root: HTMLElement): () => void;  // returns cleanup
};

export function mountScreen(root: HTMLElement, screen: Screen): () => void {
  root.replaceChildren();
  return screen.mount(root);
}
```

Each screen owns its DOM, listeners, timers. Routing calls the previous cleanup, then mounts the next. Timers / subscriptions / `AbortController` are easy to plumb.

### 4.3 `signal<T>` atom

```ts
// app/state.ts
export type Signal<T> = {
  get(): T;
  set(next: T): void;
  subscribe(cb: (value: T) => void): () => void;
};

export function signal<T>(initial: T): Signal<T> { /* ~15 lines */ }
```

Used for settings and progress so the list screen observes without a full re-render. Tiny, explicit, debuggable. Do not generalize into a reactive framework — if you start wanting effect scheduling or computed graphs, stop and reconsider.

### 4.4 Exercise definition shape (polymorphic) [Done]

```ts
// exercises/types.ts
export type Exercise = {
  id: ExerciseId;
  family: string;
  label: string;
  description: string;
  implemented: boolean;
  mount(root: HTMLElement, onExit: () => void): () => void;
  // per-family scorers live inside mount; catalog only sees Exercise
};
```

Registry is now a flat array. `main.ts` dispatches by calling `exercise.mount(root, onExit)` — no kind switch.

---

## 5. Refactor roadmap (PR-sized)

Order chosen to minimize risk and keep main green throughout.

| # | Scope | Outcome |
|---|-------|---------|
| 1 | Extract `geometry/*` and `scoring/*` as pure modules. Add vitest. Pin current outputs as golden values. | Math is testable. Regressions become visible. |
| 2 | Introduce `h()` / `s()`. Migrate `renderListScreen` and card components. | DOM boilerplate collapses; nothing functional changes. |
| 3 | Introduce `Screen` lifecycle. Migrate exercise screens. Delete `renderVersion`. | Timers / listeners have proper cleanup. Focus management becomes possible. |
| 4 | Polymorphic exercise definitions. Delete the kind dispatch. | Adding an exercise is one file. |
| 5 | Progress v2 schema. Rewrite Auto selector on new data. Add "reason" chip. | Guiding system has real data. Auto is trustworthy. |
| 6 | Settings store. Then config screen. Design refresh. URL routing. | New feature on a clean foundation. |

Expect roughly 2–3 focused days of work, spread across the PRs.

---

## 6. Guiding-system design notes

Given "suggest, never gate":

- **Per-session state** (non-persisted): "this session you've practiced X drills, your accuracy drifted +2pp." Gentle, visible on the list screen. Resets on reload.
- **Lightweight chips on cards** — last practiced, attempt count, trend arrow. Factual, not gamified. Avoids the "gamification clutter" the brief warns against.
- **Explainable Auto** — one-line reason per pick ("Weakest recent score", "Least practiced today", "You drift +3px high on this one"). Opaque selectors feel arbitrary; explained selectors feel like a coach.
- **No unlocks, no streaks-as-currency, no XP.** The product's value is the tight practice loop. Meta-layers that break the loop are debt disguised as engagement.

---

## 7. Call-outs to preserve

A few things that are *right* about the current code and should survive the refactor:

- Principal-axis line fit at [src/main.ts:1987-2005](src/main.ts#L1987-L2005) — clean, orientation-agnostic, correct.
- Algebraic circle fit at [src/main.ts:2099-2151](src/main.ts#L2099-L2151) — proper normal-equations form.
- `boundedNormalOffset` in [src/practice/catalog.ts:451-469](src/practice/catalog.ts#L451-L469) — good instinct on keeping trials legible while still varied.
- Per-drill EMA with `alpha = 0.35` — reasonable default; keep it, just expose the constant and comment the rationale.
- Feedback bands as colour + label combined — right UX instinct. Just consolidate the three functions into one band table.

The instincts here are good. The structure just hasn't caught up with the ambition.

---

## 8. Missing tests

Concrete test cases worth adding. Section 1.6 already calls for introducing vitest and pinning golden values; this list enumerates *which* cases materially protect behavior, organized by module. Nothing here duplicates a recommendation already made — the items below are specific scenarios, not the general "add unit tests" point.

### 8.1 Geometry fits — correctness and stability

Pure math, currently untested. Tests should live next to each module (`src/geometry/*.test.ts`).

- **`fitLine` on perfectly collinear points** — residual is effectively zero, returned direction matches input within floating-point tolerance.
- **`fitLine` orientation invariance** — same stroke rotated 90° yields the same residual and a direction rotated 90°. Confirms the principal-axis fit is not axis-biased.
- **`fitCircle` on sampled perfect circle** — center and radius recovered within ~1e-6, residual near zero.
- **`fitCircle` on near-collinear points** — does not NaN or explode; either returns a huge radius with high residual or a documented failure sentinel. Pin whichever behavior is current.
- **`fitCircle` translation invariance** — shifting all input points by (dx, dy) shifts the center by the same amount and leaves radius unchanged.
- **`fitEllipse` on sampled circle** — returns `majorRadius ≈ minorRadius`; rotation is unconstrained but should not throw.
- **`fitEllipse` on sampled rotated ellipse** — recovered axes and rotation match input within tolerance; works at rotation = 0, π/4, π/2, and near π (wrap-around case).
- **`fitEllipse` degeneracy** — three or fewer points, or all-equal points, returns a documented fallback rather than NaN.
- **`solveLinearSystem` vs `solveThreeByThree` cross-check** — per §8.3, feed the same 3×3 system to both and assert identical output. Guards against divergence if one is changed.
- **`solveLinearSystem` on a singular matrix** — returns `null`/sentinel rather than propagating NaN. Pin current behavior.

### 8.2 Scoring — band boundaries and weight regression

- **Golden-value scorers** — for each of `scoreFreehandLine`, `scoreFreehandCircle`, `scoreFreehandEllipse`, `scoreTargetLine`, `scoreTargetCircle`, `scoreTrace*`, record current output on a handful of fixed strokes (perfect, slightly off, badly off) and lock with `toMatchInlineSnapshot`. Required before any weight re-tuning (§2.1).
- **Single-mark signed error direction** — placing above vs below target flips the sign; `Exact` label only when error < 1px; `Too high`/`Too low` never shown for exact hits.
- **Band threshold boundaries** — at exactly 1px, 3px, 5px the band/hue/label functions agree (per §2.5 they should derive from one table, but until then, pin current behavior at the boundaries to catch accidental drift).
- **Closure gap on open strokes** — a line stroke (non-closed shape) should not penalize closure gap, while a circle with a 10° gap should. Currently implicit; worth an explicit test.
- **Join-angle penalty** — a circle with a sharp cusp at the closure point should score lower than a smooth one with the same mean/max error. Protects the `joinAngleDegrees * 0.35` term from silent removal.
- **Score clamps to [0, 100]** — a wildly off stroke doesn't produce negative scores; a perfect stroke doesn't exceed 100.

### 8.3 Progress storage — migration and validation

Most of these land once the v2 schema from §1.2 arrives, but several apply to v1 today.

- **v1 → v2 migration wipes cleanly** — loading v1 data under v2 returns empty state, does not throw, and overwrites the old key. Regression guard for the planned schema bump.
- **Unknown exercise IDs are filtered on read** — per §2.6, but as a test: writing `{ 'removed-drill': {...} }` and reading back yields `{}` (or omits the entry). Today the validator accepts it.
- **EMA math** — first attempt sets `emaScore = nextScore`; subsequent attempts apply `alpha = 0.35` in the documented direction. One numeric example pinned.
- **`attempts` monotonically increases** — two updates to the same drill yield `attempts: 2`.
- **Malformed payload recovery** — non-JSON, wrong shape, `null`, and array-at-root all return `{}` and `console.error` once. Currently untested; the try/catch is silent on the happy path.
- **`localStorage.setItem` failure** — quota-exceeded or disabled storage logs an error but does not throw, and the in-memory return value still reflects the update. Covers the catch at [src/storage/progress.ts:55](src/storage/progress.ts#L55).

### 8.4 Auto-selector heuristic

Independent of the §2.4 rewrite — even today's implementation needs test coverage before it's replaced, otherwise the rewrite has no baseline.

- **Empty progress** — `getAutoExercise({})` returns a deterministic first pick (document which).
- **All drills equally practiced** — tie-breaking order is stable and matches registry order. Prevents a flaky "which one wins" regression.
- **Least-practiced wins over lowest-score** — confirms the current sort order (attempts first, score second) matches §2.4's description, so a rewrite can be detected.
- **Only implemented drills are selectable** — a drill with `implemented: false` is never returned, even if it has the lowest score.
- After §2.4 lands: **jitter bounds** — with seeded RNG, the same progress state never shifts the top pick by more than N positions; and **reason string** matches the picked drill's actual weakness.

### 8.5 Catalog / trial generation

- **`boundedNormalOffset` bounds** — sampled 1000× with a seeded RNG, all outputs lie within the documented band. Preserves the §7 call-out instinct.
- **Target-line trials are legible** — generated endpoints are at least N px apart and inside the canvas viewBox. One trial per variation.
- **Three-point circle trials are non-degenerate** — the three target points are never collinear within a small epsilon (would crash the user-side solver).
- **Catalog registry round-trip** — every `ExerciseId` in the registry is reachable via `getExerciseById`, and every entry's `family` matches its `id` prefix (cheap consistency check, catches typos).

### 8.6 E2E flow gaps

Current Playwright coverage exercises each drill's happy path once. These flows are user-visible and currently unprotected:

- **`Again` re-runs the same drill** — after completion, clicking Again returns to a fresh trial of the *same* exercise (not the list, not Auto).
- **`Auto Next` navigates to a different drill** — after completion, clicking Auto Next lands on an exercise heading other than the one just completed (given >1 drill has progress).
- **Progress persists across reload** — complete a drill, reload, assert the list score chip still shows the recorded score. Covers the real `localStorage` round-trip end-to-end.
- **History modal keyboard dismissal** — Escape closes the modal (currently the test only covers click-to-dismiss at [e2e/home.spec.ts:438](e2e/home.spec.ts#L438)). Matters once §2.7 adds focus management.
- **Pressure/speed toggle** — the "Show fitted shapes" toggle at [e2e/home.spec.ts:441](e2e/home.spec.ts#L441) is tested; the pressure/speed visualization toggle (if exposed in UI) is not.
- **Touch pointer events are ignored on non-pencil devices** — the straight-line test at [e2e/home.spec.ts:544-563](e2e/home.spec.ts#L544-L563) already does this for one drill; the same filter applies to every freehand drill and should be spot-checked on at least the circle and ellipse drills.
- **Unknown route / crash recovery** — §3 notes that an unknown exercise kind throws. Once the error boundary lands, an E2E test with a bogus URL should render the list, not a blank page.

### 8.7 Ordering

Before PR 1 of the §5 roadmap (which re-tunes scoring weights and moves code), the minimum gate is: **8.1 geometry tests + 8.2 golden-value scorer snapshots.** Everything else can follow the PR it protects.

---

## 9. Findings from the 1.1 split (April 2026)

Issues discovered during the module extraction that are not covered elsewhere in this document.

### 8.1 `autoCard` was using a hardcoded fallback instead of `getAutoExercise`

The original `autoCard` button navigated to `AUTO_EXERCISE_ID` (`'division-horizontal-halves'`) unconditionally, bypassing the `getAutoExercise` scoring logic. The Auto button therefore always went to the same drill regardless of stored progress. Fixed in the split: the button now calls `getAutoExercise(progress)`.

### 8.2 "Comming" typo on the card button

[src/main.ts:769](src/main.ts#L769) — `'Comming'` on the disabled exercise card button. Fixed to `'Coming soon'` during the split.

### 8.3 `solveThreeByThree` duplicates `solveLinearSystem`

Both live in [src/geometry/linearAlgebra.ts](src/geometry/linearAlgebra.ts) and are identical in logic — the 3×3 version just avoids an index-array allocation for the circle fit's common case. The gain is marginal. Consider consolidating to a single `solveLinearSystem` with the comment explaining the performance intent, or keep both and add a golden-value test that cross-checks their outputs on the same 3×3 input.

### 8.4 Stroke DOM rebuilt from scratch on every `pointermove`  [Done]

[src/exercises/freehand/input.ts](src/exercises/freehand/input.ts) — `renderFreehandStroke` calls `parent.replaceChildren()` then `appendFreehandStroke`, which replays the full array on every event. In segmented mode (pressure/speed visualization) this creates O(n) `<line>` elements per move. For long strokes at high sampling rates this is noticeable. Fix: keep the layer's existing children and only `append` the new segment(s) on `pointermove`; rebuild from scratch only on `pointerdown`.

### 8.5 `freehandResultStats` uses positional `splice` for stat insertion [Done]

[src/exercises/freehand/stats.ts](src/exercises/freehand/stats.ts) — stats are built as a base array then mutated via `splice(3, 0, ...)` to insert kind-specific entries at a fixed index. This is order-dependent and breaks silently if the base array changes. A declarative approach (build the full array in one expression per kind) is clearer and safer.

### 8.6 History modal appends to the screen root, not `document.body`

[src/screens/freehand.ts](src/screens/freehand.ts) — `openModal` appends the modal element to the freehand screen's root `<main>`. This is an improvement over the original (which appended to the global `appRoot`), but the modal still escapes the screen's own layout context. After the Screen lifecycle refactor (PR 3), each screen should render modals into a portal at the document root to avoid z-index and stacking-context surprises.

### 8.7 Scoring functions are coupled to `FreehandPoint` via their return types

[src/scoring/line.ts](src/scoring/line.ts), [circle.ts](src/scoring/circle.ts), [ellipse.ts](src/scoring/ellipse.ts) — the scorers import `FreehandPoint` and freehand-specific result types from `exercises/freehand/types.ts`. This creates a dependency from the scoring layer into the exercise layer. The polymorphic exercise definition (PR 4) should define a generic `ScoreResult` interface per exercise family so the scoring layer stays independent of the rendering layer.

### 8.8 Canvas dimensions are compile-time constants, not CSS-driven

`CANVAS_WIDTH = 1000`, `CANVAS_HEIGHT = 620` in [src/exercises/freehand/input.ts](src/exercises/freehand/input.ts) and `viewBox="0 0 1000 620"` in several places. The CSS sets `height: min(62vh, 620px)` separately. These are in sync today but will diverge if the design changes canvas proportions. A single `CANVAS_VIEWBOX` constant (or a CSS custom property read via `getComputedStyle`) would make the coupling explicit.

### 8.9 Fullscreen error handling now preserves CSS class sync

The original `toggleFreehandFullscreen` left `is-maximized` out of sync if `requestFullscreen` threw (item 3.3 of BarRasing.md). Fixed in [src/screens/freehand.ts](src/screens/freehand.ts) — the catch block now reads `document.fullscreenElement` to set the class and button label to the actual state rather than the attempted state.
