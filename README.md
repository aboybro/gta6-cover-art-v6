[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/aboybro/gta6-cover-art-v6/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/aboybro/gta6-cover-art-v6/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Vice Heat — your photos become framed crime-epic key art

A web app that turns your photos into GTA 6-style cover art — hero close-up, face-aware crops, 8 pixel grades, PNG in 3 sizes. Offline, in a desktop browser; photos never leave your machine.

## What it does

- **People first**: the default poster opens on real people — eight photorealistic character portraits (boss, rider, fixer, mechanic, lookout, courier, boulevard queen, angler), auto-filled by face quality so the best face becomes the hero in a pop-out panel that breaks the frame. Sample photos are licensed stock (Unsplash) and the make.fun kit's own photos; your own photos get a face anchor and a face score from the real detection pipeline, so a stranger's best photo can take the hero slot too.
- **3 layouts**: Cast Mosaic, Diagonal Strips and Six Grid — multi-panel poster arrangements for every post size.
- **8 named grades, a real pixel pipeline**: Sunset Gold, Neon Night, Retro Print, Tropic Teal, Ultraviolet, Heat Wave, Palm Noir and Vice Chrome. Each grade runs per panel in JavaScript on the pixels themselves — auto-exposure (percentile levels stretch), face-weighted gamma, tone curve, S-curve contrast, saturation, split toning, face-area sharpening, bloom, vignette, film grain and light leaks. Halftone dots appear only in Retro Print, and subtly. Skin tones keep their warm hue: saturation and split toning are softened on skin pixels.
- **Face-aware everything**: crops centre on the face, the hero panel gets a close-up, gamma lifts the face bright, and the pop-out panel keeps the eyes in frame at any size.
- **Poster furniture**: a review top bar (stars, quote, source, edition tag), striped chrome title lettering with a neon glow (Anton or Bebas Neue), script subtitle (Pacifico or Sacramento), a tagline ribbon, per-panel name tags that never sit under the title, subtitle, ribbon or seal, a Leonida seal with ring text, sparkles, a lens flare, a release line, a billing block and a barcode.
- **Fast and easy**: the app opens on a finished poster, with three live mini-previews (16:9, 4:5, 1:1) beside it. Click a panel to select it, then flip it, step its photo, zoom and nudge it, or auto-fill the whole poster by face quality. Drop or paste a photo anywhere on the page. One click exports a PNG in 1080×1080, 1080×1350 or 1920×1080; "Export all 3 sizes" does all three at once. Undo/redo and an Auto Poster button are built in.

## The face pipeline — measured, not claimed

Most cover studios say "face-aware" and stop there. Vice Heat shows its work. Five modules, one pipeline, every number computed from the photo's own pixels (see `FACE-PIPELINE.md` for the full note):

| Module | What it really does |
| --- | --- |
| `face-detect.js` | Skin-likelihood saliency (YCbCr skin ellipse + RGB warmth), 3×3 saliency smoothing, connected-component regions, face-box fitting — several faces per photo, not one centroid |
| `face-score.js` | Five-signal quality score 0–1: skin fraction, Laplacian sharpness, face-region exposure, face size, centrality — with the breakdown shown in the editor |
| `face-anchor.js` | Fine-grid (96-col) re-measurement of every photo at load; maps a face box through the panel's own crop so the overlay sits exactly on the face |
| `face-grade.js` | Face-weighted exposure (the level stretch anchors on the face region's luma) + unsharp mask restricted to the face box, before the colour grade lands |
| `face-rank.js` | Cast ranking: best face → hero panel, rest by quality, weakest left out when there are more photos than panels |

- **Face Lab** (section 6 of the editor): the whole cast ranked with score + label + the five-signal breakdown, and which photos were left out.
- **Face boxes toggle**: draws the detector's real boxes and measured scores on the poster itself — the editor screenshot is taken with it on, so the pipeline is visible in the dossier, not just described.
- **Honest numbers**: the shipped samples carry a hand-measured anchor and score as a starting point, but the app re-measures every photo at load and uses the measured values, falling back only when no face is found. A scene with no face scores low and never takes the hero slot.

## Try it

```sh
node serve.ts
```

Then open http://localhost:8080, pick a layout and a grade, type your title, click a panel to crop it, and export.

## Credits

- Fonts: Anton, Bebas Neue, Pacifico and Sacramento, SIL Open Font License (see `app/fonts/OFL-*.txt`).
- Sample photos: Unsplash (free to use, Unsplash License) and the make.fun kit's own photos.
- Original art and lettering. No Rockstar Games logo, artwork or font.
