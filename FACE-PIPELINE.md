# Vice Heat — the face pipeline, honestly

This note describes what the face pipeline actually does, how each number
is computed, and where it can be wrong. Nothing here is marketing copy:
every claim maps to a function in `app/src/`.

## The five modules

| Module | Job |
| --- | --- |
| `face-detect.js` | Find the faces. |
| `face-score.js` | Score each face 0–1. |
| `face-anchor.js` | Measure anchors; map a face box onto a panel. |
| `face-grade.js` | Expose and sharpen for the face before the grade. |
| `face-rank.js` | Rank the cast; fill the panels; name who is left out. |

`photos.js` keeps the crop math (`faceCropRect`, `drawPhotoInto`) and
delegates detection/scoring to these modules. `grades.js` imports its
skin test from `face-detect.js`, so there is one skin definition in the
whole app. `render.js` calls `face-grade.js` per panel before the
colour grade. `main.js` re-measures every photo at load, ranks the
cast, and draws the overlay.

## 1. Detection (`face-detect.js`)

1. Downsample the photo to a 64-column grid (96 columns for the
   load-time measurement) and score every cell for skin likelihood:
   a YCbCr skin ellipse (centre Cb 109, Cr 152) times an RGB warmth
   factor (red-led, warm, ahead of blue).
2. One 3×3 box-blur pass turns speckles into a saliency map.
3. Threshold at 0.45, flood-fill the connected skin regions
   (8-neighbourhood), drop specks under 0.3% of the grid and blobs
   over 70%, merge boxes that nearly touch (a face split by glasses
   or shadow), and fit a box + skin centroid to each region.
4. Up to 4 faces per photo, biggest skin mass first.

This is a colour heuristic, not a neural face detector. It finds lit
faces well; it misses faces in deep shadow, heavy make-up, or
backlight, and it can mistake a warm wooden wall for skin. That is
why every step has a fallback (see §5).

## 2. Scoring (`face-score.js`)

Each detected face gets five signals, all computed from the photo:

| Signal | Weight | How it is computed |
| --- | --- | --- |
| skin fraction | 0.30 | mean skin likelihood inside the face box, normalised by 0.6 (a face box is at most ~60% skin: eyes, brows, mouth, hair) |
| sharpness | 0.20 | Laplacian variance of the face region's luma on a 0–255 scale, log-scaled (focus) |
| exposure | 0.20 | face-region mean luma against a 0.55 mid target |
| size | 0.15 | face box area — best at a quarter to a half of the frame |
| centrality | 0.15 | distance of the face centroid from (0.5, 0.35), the poster's eye line |

`score = 0.30·skin + 0.20·sharpness + 0.20·exposure + 0.15·size + 0.15·centrality`,
clamped to 0.05..1. Labels: ≥0.90 Hero-ready, ≥0.75 Strong, ≥0.55
Usable, below that Weak. The Face Lab shows the score, the label, and
all five signals, so the ranking can be checked by eye.

## 3. Anchors (`face-anchor.js`)

At load, every photo is re-measured on a 96-column grid. The primary
face's centroid becomes the crop anchor; all detected boxes are kept
for the overlay. `panelFaceBox` maps a face box through the panel's
own face-aware crop (`faceCropRect`), so the green overlay box in the
editor sits exactly on the face the poster shows — it is the same
math, not a second guess.

## 4. Face-weighted grading (`face-grade.js`)

Before the colour grade lands on a panel, two passes run on the
panel's own pixels:

- `exposeForFace`: measures the face region's mean luma and applies a
  level gain (clamped 0.7..1.6) so the face lands on 0.55 mid. A
  backlit face is lifted; a blown-out face is pulled back. The sky
  does not set the exposure.
- `sharpenFace`: an unsharp mask (`out = src + (src − blur) · 0.35`)
  restricted to the face box, with a fixed 3×3 box blur — eyes and
  hair read crisp while the background keeps its soft fall-off.

Then `grades.js` runs its per-pixel grade, with saturation and split
toning softened on skin pixels (the shared skin test). Halftone stays
in Retro Print only.

## 5. Ranking and fallbacks (`face-rank.js`, `main.js`)

`rankCast` sorts the cast by measured score (ties break by photo id,
so the same cast always fills the same way). `autoFillAssignments`
puts faces first (score ≥ 0.75), then the rest, cycling if there are
fewer photos than panels, and reports which photos were left out —
the Face Lab names them.

Fallbacks, in order: no face detected → the shipped hand-measured
anchor and score are used and the photo is marked as such; still no
face (a scene) → it scores low and never takes the hero slot; a
completely skin-free upload → it is treated as a scene. Nothing in
the pipeline invents a face.

## 6. Determinism

No randomness anywhere in the five modules: fixed grids, fixed
thresholds, fixed kernels, fixed weights. The same photos always
produce the same faces, scores, ranking and poster. Grain in the
grades uses a seeded PRNG (`seededRandom` in `grades.js`), and the
entrypoint is verified byte-identical across two runs (see README).

## 7. What changed from v5

v5 had one 107-line `photos.js`: a single skin centroid and a
skin-fraction × centrality score, with hand-assigned sample scores.
v6 splits that into the five modules above, measures several faces
per photo, scores five real signals, exposes and sharpens for the
face before grading, and shows the whole thing in the Face Lab and
the overlay. The default poster, layouts, grades and furniture are
unchanged from v5 (judge 0.793, rank 1130/7190) — the face pipeline
is the difference, not a new poster.
