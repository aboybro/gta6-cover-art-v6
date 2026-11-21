// Face quality scoring: every number is computed from the photo's own
// pixels, nothing is hand-assigned. Five real signals, weighted:
//   skin fraction 0.30 — how much of the face box is actually skin
//   sharpness     0.20 — Laplacian variance of the face region (focus)
//   exposure      0.20 — face-region luma against a 0.55 mid target
//   size          0.15 — the face's share of the frame (close-up wins)
//   centrality    0.15 — how close the face sits to the poster's eye line
// The breakdown is shown in the editor's Face Lab, so the ranking the
// auto-fill uses is visible and checkable, not a black box.

import { skinLikelihood } from './face-detect.js';

/** Laplacian variance of a small luma patch — a focus measure. */
function laplacianVariance(luma, W, H) {
  let mean = 0;
  let n = 0;
  const lap = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const c = y * W + x;
      const v = 4 * luma[c] - luma[c - 1] - luma[c + 1] - luma[c - W] - luma[c + W];
      lap[c] = v;
      mean += v;
      n++;
    }
  }
  if (!n) return 0;
  mean /= n;
  let vari = 0;
  for (let i = 0; i < lap.length; i++) {
    const d = lap[i] - mean;
    vari += d * d;
  }
  return vari / Math.max(1, lap.length);
}

/**
 * Scores one detected face, 0..1, from the photo itself.
 * `face` is a detectFaces() box (fractions); `img` is the photo.
 * Returns { score, skin, sharpness, exposure, size, centrality, label }.
 */
export function scoreFaceDetailed(img, face) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const W = 48;
  const H = Math.max(8, Math.round((48 * sh) / sw));
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0, W, H);
  const data = cx.getImageData(0, 0, W, H).data;

  // Face box in grid cells.
  const x0 = Math.max(0, Math.floor(face.x * W));
  const x1 = Math.min(W, Math.ceil((face.x + face.w) * W));
  const y0 = Math.max(0, Math.floor(face.y * H));
  const y1 = Math.min(H, Math.ceil((face.y + face.h) * H));

  let skinSum = 0;
  let lumaSum = 0;
  let n = 0;
  const luma = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      luma[y * W + x] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        skinSum += skinLikelihood(r, g, b);
        lumaSum += luma[y * W + x];
        n++;
      }
    }
  }
  if (!n) {
    return { score: 0.05, skin: 0, sharpness: 0, exposure: 0, size: 0, centrality: 0, lapVar: 0, label: 'Weak' };
  }
  const skinRaw = skinSum / n;
  // A face box is at most ~60% skin (eyes, brows, mouth, hair and the
  // box's own corners are not skin), so normalise by 0.6: a good
  // portrait scores near 1 here, a warm wall or sand scores lower.
  const skin = Math.max(0, Math.min(1, skinRaw / 0.6));
  const faceLuma = lumaSum / n;
  const exposure = Math.max(0, 1 - Math.abs(faceLuma - 0.55) / 0.45);
  // Sharpness: Laplacian variance inside the face box only, on a
  // 0–255 luma scale (on a 0–1 scale the variance is ~0.001 and the
  // signal vanishes — every photo looked equally soft).
  const sub = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) sub.push(luma[y * W + x] * 255);
  }
  const swBox = Math.max(1, x1 - x0);
  const shBox = Math.max(1, y1 - y0);
  const lapVar = laplacianVariance(Float32Array.from(sub), swBox, shBox);
  // Sharpness scale, calibrated on the shipped photos: sharp portraits
  // measure a Laplacian variance of 1800–4500 (log2 ≈ 11–12), soft
  // scenes 40–400 (log2 ≈ 5–9). Divisor 14 maps that range onto
  // 0.37–0.87, so focus actually discriminates instead of saturating.
  const sharpness = Math.max(0, Math.min(1, Math.log2(1 + lapVar) / 14));
  const area = face.w * face.h;
  const size = area < 0.02 ? (area / 0.02) * 0.5
    : area <= 0.5 ? 0.5 + 0.5 * ((area - 0.02) / 0.48)
    : Math.max(0, 1 - (area - 0.5) * 1.5);
  // Centrality: the poster's eye line is centre-x, a third down.
  const centrality = Math.max(0, 1 - 0.6 * Math.abs(face.ax - 0.5) - 0.6 * Math.abs(face.ay - 0.35));
  const score = Math.max(0.05, Math.min(1,
    0.3 * skin + 0.2 * sharpness + 0.2 * exposure + 0.15 * size + 0.15 * centrality));
  return { score, skin, sharpness, exposure, size, centrality, lapVar, label: scoreLabel(score) };
}

/** Human label for a score — shown beside the number in the Face Lab. */
export function scoreLabel(score) {
  if (score >= 0.9) return 'Hero-ready';
  if (score >= 0.75) return 'Strong';
  if (score >= 0.55) return 'Usable';
  return 'Weak';
}

/**
 * How well a face fits a panel of `panelAspect` (w/h): a face whose
 * box aspect is close to the panel's fills it without a hard crop.
 * 1 = perfect fit, falling toward 0 as the aspects diverge.
 */
export function heroFit(face, panelAspect) {
  const faceAspect = face.w / Math.max(0.01, face.h);
  const ratio = Math.max(faceAspect, panelAspect) / Math.min(faceAspect, panelAspect);
  return Math.max(0, 1 - 0.35 * (ratio - 1));
}
