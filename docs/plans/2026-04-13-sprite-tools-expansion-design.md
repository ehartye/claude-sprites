# Sprite Tools Expansion — Design

**Date:** 2026-04-13
**Status:** Approved, pending implementation plan

## Motivation

During the bounce-basketball build (2026-04-13 session), Claude took ~120 CLI calls across 8 frames to produce the finished sprite (base + 5 lighting tiers + 4 seams + halo per frame). The per-frame work was highly repetitive, the bash loop orchestrating it was brittle (multiple server force-kills lost state), and per-cell arithmetic had to happen in shell.

The user's priority order for improvements was:
1. **(A) Speed for the authoring agent (Claude)** — collapse turns, reduce ceremony.
2. **(C) Correctness / robustness** — stop losing state, make errors visible.
3. **(B) Repeatability** — presets / shareable recipes (distant third but welcome side-benefit).

## Goals

Cut agent turn-count on complex sprite builds by ~100x by introducing:
- Compound draw commands that emit validated multi-shape patterns in one call.
- A recipe batch mode with variable substitution for per-frame parameterization.
- Correctness fixes that eliminate the force-kill workaround and silent-error patterns.
- Small ergonomics commands that remove shell-scripting brittleness.

## Non-Goals

- **Macros / command recording.** Considered as Approach 3; rejected because variable inference from recorded commands is brittle and error messages would be obscure.
- **Arithmetic in recipes.** The recipe DSL is substitution-only. Callers pre-compute numeric values.
- **Conditionals / loops inside recipes.** Keep the DSL flat. Iteration comes from the vars file array.
- **Material / preset library** (B priority beyond sphere-shade). Recipes are shareable files; a curated library can emerge organically.

## Approved Design

### 1. `draw sphere-shade`

Compound command that emits the validated 5-tier sphere lighting recipe in one call.

```
sprite draw sphere-shade --cell R,C --shape <target>
                          [--direction top-left]
                          [--intensity low|med|high|auto]
                          [--name <base>]
```

Behavior:
- Target must be `circle` or `ellipse`. Errors on rect/line/point.
- Target color must resolve in a palette ramp (same constraint as existing `highlight`/`shadow`).
- `--intensity auto` (default) picks tiers by target `sizeMetric`:
  - `≤6` → **low** (highlight + core shadow, 2 tiers)
  - `7–12` → **med** (+ form shadow, 3 tiers)
  - `>12` → **high** (+ rim light + spec peak, 5 tiers)
- `--direction` rotates all tiers consistently (highlight/spec toward direction, shadow/rim opposite).
- Output shapes named `<base>_<tier>_<i>` (default base `<target>_shade`).
- Emits a shape-group `<base>_group` bundling all output shapes, so the recipe is deletable/movable as a unit.

### 2. `draw arc`

Partial ellipse outline primitive — replaces the "draw oversized + clip" workaround for surface curves.

```
sprite draw arc --cell R,C --cx --cy --rx --ry
                 --from-deg <A> --to-deg <B>
                 --color <hex|name>
                 [--r N]                 # circle shorthand
                 [--name <base>]
                 [--clip-to <mask>]
```

- Rasterizes only the outline portion between angles `A` and `B` (standard math convention: 0° east, 90° south, increasing clockwise since y is down).
- Emits individual named points (`<name>_<i>`) like `draw highlight`.
- `--clip-to` continues to work as a secondary filter.

**No filled arc / pie slice.** Combine arc + fill if needed.

### 3. `batch` with `--vars-file` (recipe mode)

Extends the existing `batch` JSON array format with variable substitution.

```
sprite batch --file ops.json [--vars-file frames.json | --vars k=v,k=v]
              [--continue-on-error]
```

- `ops.json` — existing batch array. Values may contain `{{var}}` placeholders.
- `--vars-file frames.json` — array of per-iteration variable dicts. Ops replay per dict.
- `--vars k=v,k=v` — single-iteration inline shortcut.
- **Type preservation:** a string value exactly `"{{foo}}"` where `foo` is numeric becomes a number. Embedded substitutions (`"0,{{i}}"`) stay strings.
- **Clear errors:** `variable 'brx' not found at frame index 3` — never silent.
- **No arithmetic / conditionals / nested interpolation.** Flat substitution only.

### 4. Correctness: `sprite restart` + fail-fast batch

**`sprite restart`** — new CLI command replacing the `Stop-Process -Force` hammer.
- Hits `POST /api/control/shutdown`.
- Server handler broadcasts shutdown, calls `db.close()`, exits cleanly.
- CLI polls `/health` until it stops responding (≤2s), then spawns a fresh detached server via existing `ensureServer()`.

**Fail-fast batch:**
- Default `batch` stops on first error with structured stderr (`ERROR at op 4/12: draw ellipse cell=0,2 — "ball" not found`).
- `--continue-on-error` is the opt-in; today's behavior becomes explicit.
- Retires the `2>/dev/null` pattern project-wide.

### 5. Ergonomics: fan-out clone and group pattern-match

**`clone-cell --from R,C --to R,C1 R,C2 ...`**
- Deep-copy one cell into many destinations atomically. Replaces the bash loop pattern for animation frame setup.
- Either the full fan-out succeeds or nothing changes.

**`shape-group create <name> --all-cells --pattern <regex>`**
- Create a shape group across every cell that contains shapes matching the name pattern.
- Replaces the `grep -oE 'seam_*' | sort -u` bash pattern used for refresh/delete workflows.

### 6. Optional: `draw ring`

Syntactic sugar over `draw border`:
```
sprite draw ring --shape <target> --offset-px 1 --color <c> [--clip-to <mask>]
```
Same semantics as `draw border --shape-prefix <name of target>` but reads clearer for single-target halos. XS effort; include if trivial.

## Build Order

| # | Item | Impact | Effort | Risk |
|---|---|---|---|---|
| 1 | `sprite restart` + fail-fast batch | ⭐⭐⭐ | S | Low |
| 2 | `draw sphere-shade` | ⭐⭐⭐ | S | Low |
| 3 | `draw arc` | ⭐⭐ | S | Low |
| 4 | `batch --vars-file` | ⭐⭐⭐ | M | Med (DSL) |
| 5 | `clone-cell` fan-out | ⭐⭐ | S | Low |
| 6 | `shape-group create --all-cells --pattern` | ⭐ | S | Low |
| 7 | `draw ring` | ⭐ | XS | Low |

Ship 1–3 in one cut, 4 alone (DSL needs isolated testing), 5–7 opportunistically.

## Expected Impact on Reference Workflow (basketball build)

- **Today:** ~120 CLI calls, 8-cell bash loop, multiple server restarts, per-cell arithmetic.
- **After 1–3:** ~40 calls. Per-frame lighting collapses 5 → 1.
- **After 4:** ~1 CLI call. Single JSON recipe + vars file replaces the entire bash loop.

## Open Questions

None at approval. `sphere-shade --name` emitting a shape-group (decided yes) and `ring` inclusion (decided include if trivial) were resolved in brainstorm.

## References

- Reference build that motivated this design: `assets/claude-sprites/bounce-basketball/`
- Tool reference (current state): `skills/sprite-editing/references/tool-reference.md`
- Technique skills informing sphere-shade tier ordering: `skills/sprite-shading/SKILL.md`
