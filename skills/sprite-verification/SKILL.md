---
name: sprite-verification
description: Use when verifying sprite sheets or atlases, or when frames look wrong — triggers on "verify", "QA", "check the sheet", "bleed", "wrong frame", "misaligned", "facing is wrong", "animation bounces", "broken frames", after export/conversion/generation, and before wiring frames into a game. Covers structural checks, per-frame contact-sheet inspection, baseline alignment, facing semantics, animation coherence, and in-engine loader verification.
---

# Sprite Sheet Verification

A sheet is not verified until every frame has been *seen*. Frame counts,
"animations registered", and clean console output prove the loader parsed
something — not that the pixels are right. Run this before wiring any sheet
into a game, and again after any pipeline change (export settings, converter
edits, regeneration).

## Verification ladder

Run in order; each level catches what the previous one can't.

**1. Structural.** Atlas dimensions must divide exactly by the declared frame
size (`width % frameWidth === 0`, same for height), and detected frame count
must equal `rows × cols`. A remainder means every frame after the first drifts
by an accumulating offset — the bug looks like "bleed on later frames only."
Check declared metadata (atlas JSON, meta files) against the actual PNG, not
against what the generator intended to emit.

**2. Per-frame contact sheet.** Render EVERY frame individually at 2–4×
nearest-neighbor zoom and inspect each one for:

- empty or near-empty cells
- neighbor bleed (pixels from the adjacent frame along a cell edge)
- wrong facing for the row it lives in
- partial figures (amputated heads/feet from bad slicing)
- character consistency (same costume, same proportions, every cell)

For claude-sprites projects, `sprite.js view --sheet --scale 8 --out qa.png` is
the contact sheet. For external or converted sheets, build one in-engine (below).

**3. Baseline alignment.** Within each animation row, the feet must sit on the
same line. Misaligned baselines read as vertical bounce during walks — visible
in motion, invisible in single-frame checks unless you look for it. Bottom-
anchored slicing prevents this; verify it survived.

**4. In-engine contact sheet.** Loading the PNG in an image viewer verifies
the file; only the engine verifies the *loader config*. Spawn one static
sprite per frame index from the actual loaded texture, one grid row per
animation row, and screenshot it (Phaser shown; same idea in any engine —
`FRAMES`, `COLS`, `cellW/cellH`, and `'sheetkey'` are yours to fill in):

```js
// debug-mode contact sheet: light band over dark band, one row per anim row
const g = scene.add.graphics().setDepth(8900);
g.fillStyle(0x847e87).fillRect(x0, y0, w, h / 2);       // light band
g.fillStyle(0x595652).fillRect(x0, y0 + h / 2, w, h / 2); // dark band
for (let f = 0; f < FRAMES; f++)
  scene.add.sprite(x0 + (f % COLS) * cellW + cellW / 2,
                   y0 + (Math.floor(f / COLS) + 1) * cellH, 'sheetkey', f)
    .setOrigin(0.5, 1).setDepth(9000).setScale(2);
```

**Always inspect on a neutral mid-tone backdrop.** Dark sprites on dark game
ground produce false alarms — two overlapping dark figures read as one broken
split sprite. Diagnose frames on grey, never on the map.

**5. Facing semantics.** A frame being *clean* says nothing about which way it
*faces*. Determine facing from the pixels (nose, eye, stride direction) at
6–8× zoom — **never from generation-prompt row labels; image models mirror
rows routinely**. Then verify movement mapping by driving the character with
real input in each direction and screenshotting mid-walk: the face must point
where the body moves. A robust pattern for generated sheets: use the one
unambiguous profile row per character and mirror-flip for the opposite side,
rather than trusting two rows that were supposed to be mirrors.

**6. Animation coherence.** For each animation, confirm its frame list uses
only verified frames of a single facing, and that the sequence reads as a gait
(step, pass, step, pass — repeated cells/frames are the normal 4-beat trick).
Play each animation and watch at least one full loop — `sprite.js view-anim
<group> --fps N --loops 3` for claude-sprites projects, in-engine otherwise.
When testing in a live game, reset game state first — a timer-spawned
encounter can freeze your test subject mid-verification and hand you stale
animation state that looks like a bug.

## The usage map

End verification with an explicit frame-usage map: which frames each animation
consumes and which frames are **deliberately unused**. Unused-on-purpose is a
valid verdict (generated sheets often have one ambiguous row) — but it must be
recorded, or the next session will "fix" the animations by wiring the bad
frames in.

## Generated / converted sheets (extra checks)

- **Verify slicing used whitespace gutters, not even division.** Generated
  grids drift; confirm the slicer detected transparent gutter bands and that
  the band count matches the expected rows × cols.
- **Verify alpha is real** before trusting it: sample the corner pixels. A
  "transparent background" request can come back as a solid painted panel,
  which silently breaks alpha-mask slicing.
- After palette quantization, re-inspect at game scale — quantization can
  merge the eye pixels into the face ramp or erase 1px details that read fine
  at source resolution.

## Sign-off checklist

- [ ] Dimensions divide exactly; frame count matches expectation
- [ ] Every frame individually inspected on a neutral backdrop (not the map)
- [ ] Baselines level within each row
- [ ] In-engine sheet matches file-level sheet (loader config verified)
- [ ] Facing read from pixels at zoom AND confirmed by driving each direction
- [ ] Every animation plays one clean loop from verified frames only
- [ ] Frame-usage map recorded, deliberately-unused frames listed

Run this before the wiring steps in the `game-integration` skill.
