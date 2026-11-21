// Face-weighted grading: the grade pipeline serves the face, not the
// other way round. Two passes run on each panel's own pixels before the
// colour grade lands:
//   1. exposeForFace — the level stretch is anchored on the FACE
//      region's mean luma, so a backlit face is lifted and a blown-out
//      face is pulled back, instead of the whole panel being exposed
//      for its sky.
//   2. sharpenFace — an unsharp mask restricted to the face box, so
//      eyes and hair read crisp while the background keeps its soft
//      photographic fall-off.
// Skin protection lives in grades.js (saturation/split-toning softened
// on skin pixels); this module is the face-region part. Deterministic:
// no randomness, fixed kernel, fixed target.

/** Face box in fractions -> pixel rect inside a w x h canvas. */
export function faceBoxPx(face, w, h) {
  const pad = 0.06;
  const x0 = Math.max(0, Math.floor((face.x - pad) * w));
  const y0 = Math.max(0, Math.floor((face.y - pad) * h));
  const x1 = Math.min(w, Math.ceil((face.x + face.w + pad) * w));
  const y1 = Math.min(h, Math.ceil((face.y + face.h + pad) * h));
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/**
 * Measures the face region's mean luma and applies a level gain to the
 * whole canvas so the face lands on `target` (default 0.55 mid). Gain
 * is clamped to 0.7..1.6 — it rescues exposure, it never invents light.
 * Returns the gain applied (1 when there is no face box).
 */
export function exposeForFace(ctx, w, h, face, target = 0.55) {
  if (!face) return 1;
  const box = faceBoxPx(face, w, h);
  const img = ctx.getImageData(box.x, box.y, box.w, box.h);
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  const mean = sum / Math.max(1, d.length / 4) / 255;
  if (mean <= 0.02) return 1;
  const gain = Math.max(0.7, Math.min(1.6, target / mean));
  if (Math.abs(gain - 1) < 0.02) return 1;
  const full = ctx.getImageData(0, 0, w, h);
  const fd = full.data;
  for (let i = 0; i < fd.length; i += 4) {
    fd[i] = Math.max(0, Math.min(255, fd[i] * gain));
    fd[i + 1] = Math.max(0, Math.min(255, fd[i + 1] * gain));
    fd[i + 2] = Math.max(0, Math.min(255, fd[i + 2] * gain));
  }
  ctx.putImageData(full, 0, 0);
  return gain;
}

/**
 * Unsharp mask on the face box only: out = src + (src - blur) * amount.
 * The blur is a fixed 3x3 box blur of the face region, so the result is
 * identical on every render. Returns the amount applied (0 with no box).
 */
export function sharpenFace(ctx, w, h, face, amount = 0.35) {
  if (!face || amount <= 0) return 0;
  const box = faceBoxPx(face, w, h);
  const img = ctx.getImageData(box.x, box.y, box.w, box.h);
  const d = img.data;
  const bw = box.w;
  const bh = box.h;
  // 3x3 box blur of the region (one pass, edge pixels reuse themselves).
  const blur = new Uint8ClampedArray(d.length);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      for (let c = 0; c < 3; c++) {
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(bw - 1, Math.max(0, x + dx));
            const yy = Math.min(bh - 1, Math.max(0, y + dy));
            s += d[(yy * bw + xx) * 4 + c];
            n++;
          }
        }
        blur[(y * bw + x) * 4 + c] = s / n;
      }
    }
  }
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const src = d[i + c];
      d[i + c] = Math.max(0, Math.min(255, src + (src - blur[i + c]) * amount));
    }
  }
  ctx.putImageData(img, box.x, box.y);
  return amount;
}
