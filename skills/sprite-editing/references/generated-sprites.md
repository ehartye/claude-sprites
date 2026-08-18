# Generated Sprites — Working With Image Models

Field guide for building game sprites from image-generation models. Every rule
here is either documented by a vendor, reported by a practitioner, or measured
on a real project — sources noted so you can tell which.

The parametric toolset in this plugin remains the better answer for anything
that must be edited by name, tiled, or rebuilt deterministically. Reach for
generation when you want painterly density or a large pose vocabulary fast, and
expect to own the geometry problem yourself.

## The one finding that organizes everything else

**Every pipeline that reliably holds character height across frames makes
geometry an *input*, not an output.** Skeleton keypoints inside a fixed canvas;
bone lengths as persistent rig data; one 3D model under one fixed camera; a
shared canvas with onion skinning; a template sheet through pose conditioning.
Nothing that only prompts or only fine-tunes claims to solve it, and hosted
image APIs expose no parameter for it — several expose no seed at all.

So: if you cannot hand the model your geometry, **impose it afterwards**. That
is the calibration step below, and it is not optional.

## Height calibration across runs

Separate generations of the same character land at different scales. Normalising
each run against *its own* median preserves the difference — the anchor has to
live outside the run.

Measured on one character across four runs: median content heights of 44, 46,
51 and 59 px for the same figure. After calibration, all four sat at 60.

1. Choose one canonical standing height in target pixels; hold it forever.
2. Per run, take the **75th percentile** of content heights — not the median
   (crouch/sit/collapse drag it down), not the max (jump/arms-raised inflate it).
3. Scale the run by `target / p75`, uniformly in x and y.
4. Exclude prop-inflated outliers from any fit clamp, **on both axes** — a
   ladder or handcart makes a bbox far taller *and wider* than the character.
   Width is often the binding constraint.
5. Anchor every frame bottom-centre so the foot baseline is shared.

Size the standard cell by the widest ordinary pose, not the tallest.

## Never ask for transparency

Ask for a flat key colour and remove it yourself. One model accepted
`background: transparent` and returned a solid painted panel; another accepted
the parameter at validation then rejected it at generation time. **Parameter
acceptance is not behaviour.**

- Name an exact hex (`#FF00FF` magenta, `#00FF00` green) and demand it flat:
  no gradients, no noise, no texture, no shadows, no lighting variation.
- Ask for a contrasting outline around each figure as an anti-aliasing buffer.
- Key in HSV, not by brightness.
- Pick a key colour absent from your palette — magenta is absent from most
  retro palettes.
- Detect alpha at conversion time and keep the chroma path configurable (key
  colour, threshold, force flag) rather than hardcoding either assumption.

## Prompt construction

**Subject first — it is a scale control.** Vendor documentation states that if
the model keeps pulling too far back, name the subject first and move
environmental detail later. Token position governs how much frame the figure
fills. Order: subject → framing → layout → style → background → exclusions.

**Say the framing out loud:** "full body visible, feet included," and size the
subject relative to a named object when you can.

**No negative prompts.** None of the current hosted models support them; several
warn that naming an unwanted thing makes it *more* likely. State exclusions as
positive instructions ("the image contains only the figures on the flat
background"). For edits: "change only X" plus "keep everything else the same,"
repeating the preserve list on every iteration.

**Ban numerals from the prompt entirely.** Digits leak into the image as
rendered text. Spell grid dimensions as words ("six rows and four columns") and
describe cells as prose in reading order ("first cell… second cell…"), never as
a numbered list. A hex code is the one acceptable exception.

**Define the pose vocabulary once, then reference it by name.** Repeating a full
pose description in every cell tripled prompt length and buried the layout
instruction. Naming also matches how animation references are captioned.

**Explicit grids control content, not spacing.** Row/column wording reliably
fixes how many poses and which. It does *not* produce uniform cell spacing —
figures vary in width with their content. Pin geometry with canvas arithmetic, a
template image, or content-aware slicing; never by asking.

## Canonical pose vocabulary

Use the animator's terms — that is the language the training captions use.

**Walk, four keys:**
- **CONTACT** — feet farthest apart, both on the ground, weight split, lead heel
  striking, trailing foot on toes, arms at widest in opposition.
- **DOWN** (aliases: recoil, squash) — lowest point, lead foot flat bearing full
  weight, big knee bend, hips and spine curling forward. *Compression.*
- **PASSING** (the breakdown, not an extreme) — planted leg straight directly
  beneath the torso, free leg lifted and bent, swinging past.
- **UP** (aliases: high point, push-off) — highest point, planted leg extended,
  heel lifting, hips and spine tilting up and back. *Extension.*

**Run — same skeleton, two substitutions:** DOWN becomes **TAKEOFF** (alias:
push); UP becomes **PEAK** — the flight phase where *both feet leave the
ground*, which never happens in a walk. Add forward lean and faster arm swing.
The naming is genuinely forked in the literature (takeoff/up vs push/peak) —
carry both as synonyms.

**Frame counts:** three-frame = classic RPG step-idle-step; four-frame = the
minimum showing real leg mechanics; eight-frame = the modern pixel-art standard.

**At four frames you keep CONTACT and PASSING** — positional extremes — and drop
DOWN and UP, which are *vertical* extremes. That is exactly why low-frame walks
read floaty, and why a 1px body bob on alternate frames restores the missing
weight. Reach for the bob knowing what it replaces.

## What the model will and will not honour

Measured across two generations of the same 24-pose brief:

| Asked for | Result |
|---|---|
| Exact cell count | Honoured once the poses were named compactly (24 asked → 24 returned; the verbose version returned 30) |
| Uniform grid spacing | **Never.** Slice on whitespace gutters, not by division |
| Stride separation, profile views | Reliably honoured |
| Stride separation, front/back views | **Collapses to feet-together** unless you add an explicit separation clause; with one, compliance went 20% → 50% |
| Consistent height within a run | Approximate — still needs calibration |
| Consistent height across runs | **No.** Calibrate |

An explicit "feet visibly far apart" clause fixes front/back collapse but can
overshoot into a straddle stance. Use it on front and back cells only.

## Verify, then cast

Everything generated goes through the `sprite-verification` skill before it
reaches game code — per-frame inspection, facing measurement, gait metrics. For
frame selection, use the collaborative casting UI (`sprite.js cast start`): let
measurement *propose* and a human *decide*. On this project the human overrode
the detector on most slots, and was right nearly every time — frames are judged as pairs and
sets, which no per-frame score captures.
