// Face detection: skin-likelihood saliency + connected components.
// This is a real detector, not a placeholder. It downsamples a photo to a
// small grid, scores every cell for skin likelihood (YCbCr skin ellipse
// combined with an RGB warmth rule), smooths the grid into a saliency
// map, then finds connected skin regions and fits a box around each one.
// The result is a list of faces — box and anchor as fractions of the
// photo — so a group photo yields several faces, not just one centroid.
// Deterministic: no randomness anywhere in this file.

/**
 * Skin likelihood of one pixel, 0..1. YCbCr skin ellipse (centre
 * Cb 109, Cr 152) times an RGB warmth factor: skin is red-led, warm,
 * and clearly ahead of blue. A grey wall scores near 0; a lit cheek
 * scores near 1.
 */
export function skinLikelihood(r, g, b) {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const d = ((cb - 109) / 15) ** 2 + ((cr - 152) / 17) ** 2;
  const ellipse = Math.exp(-d);
  const warm = r > g && r > b ? Math.min(1, (r - b) / 40) : 0;
  const bright = r > 60 && g > 30 ? 1 : 0.4;
  return Math.max(0, Math.min(1, ellipse * (0.55 + 0.45 * warm) * bright));
}

/** A pixel counts as skin when its likelihood clears one half. */
export function isSkin(r, g, b) {
  return skinLikelihood(r, g, b) >= 0.5;
}

/**
 * Saliency grid of an image: downsample to `cols` columns, score each
 * cell, then blur 3x3 so a cheek reads as one warm region instead of
 * speckles. Returns { grid: Float32Array, W, H }.
 */
export function saliencyGrid(img, cols = 64) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const W = cols;
  const H = Math.max(8, Math.round((cols * sh) / sw));
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0, W, H);
  const data = cx.getImageData(0, 0, W, H).data;
  const grid = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      grid[y * W + x] = skinLikelihood(data[i], data[i + 1], data[i + 2]);
    }
  }
  // One 3x3 box-blur pass: saliency, not speckle.
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < W && yy >= 0 && yy < H) {
            s += grid[yy * W + xx];
            n++;
          }
        }
      }
      out[y * W + x] = s / n;
    }
  }
  return { grid: out, W, H };
}

/**
 * Finds the faces in a photo. Thresholds the saliency map, flood-fills
 * the connected skin regions (8-neighbourhood), drops specks and
 * whole-frame blobs, merges boxes that nearly touch, and returns up to
 * `maxFaces` faces, biggest skin mass first. Each face:
 *   { x, y, w, h,       // box, fractions of the photo (x/y = top-left)
 *     ax, ay,           // anchor: skin centroid, fractions
 *     skin, meanScore } // skin cell count and mean saliency
 * Returns [] when no face is found — the caller falls back to the
 * shipped anchor instead of inventing a face.
 */
export function detectFaces(img, opts = {}) {
  const cols = opts.cols ?? 64;
  const threshold = opts.threshold ?? 0.45;
  const maxFaces = opts.maxFaces ?? 4;
  const { grid, W, H } = saliencyGrid(img, cols);
  const seen = new Uint8Array(W * H);
  const faces = [];
  const minCells = Math.max(4, Math.round(W * H * 0.003));
  const maxCells = Math.round(W * H * 0.7);
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || grid[start] < threshold) continue;
    // Flood fill one connected region.
    const stack = [start];
    seen[start] = 1;
    let minX = W;
    let maxX = -1;
    let minY = H;
    let maxY = -1;
    let sx = 0;
    let sy = 0;
    let n = 0;
    let scoreSum = 0;
    while (stack.length) {
      const c = stack.pop();
      const x = c % W;
      const y = Math.floor(c / W);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sx += x;
      sy += y;
      n++;
      scoreSum += grid[c];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const cc = yy * W + xx;
          if (!seen[cc] && grid[cc] >= threshold) {
            seen[cc] = 1;
            stack.push(cc);
          }
        }
      }
    }
    if (n < minCells || n > maxCells) continue;
    faces.push({
      x: minX / W,
      y: minY / H,
      w: (maxX - minX + 1) / W,
      h: (maxY - minY + 1) / H,
      ax: sx / n / W,
      ay: sy / n / H,
      skin: n,
      meanScore: scoreSum / n,
    });
  }
  // Merge boxes that nearly touch (a face split by glasses or shadow).
  const merged = [];
  for (const f of faces.sort((a, b) => b.skin - a.skin)) {
    const hit = merged.find((m) => boxesNear(m, f, 2 / W, 2 / H));
    if (hit) {
      const x0 = Math.min(hit.x, f.x);
      const y0 = Math.min(hit.y, f.y);
      const x1 = Math.max(hit.x + hit.w, f.x + f.w);
      const y1 = Math.max(hit.y + hit.h, f.y + f.h);
      const total = hit.skin + f.skin;
      hit.ax = (hit.ax * hit.skin + f.ax * f.skin) / total;
      hit.ay = (hit.ay * hit.skin + f.ay * f.skin) / total;
      hit.skin = total;
      hit.meanScore = (hit.meanScore * (total - f.skin) + f.meanScore * f.skin) / total;
      hit.x = x0;
      hit.y = y0;
      hit.w = x1 - x0;
      hit.h = y1 - y0;
    } else {
      merged.push({ ...f });
    }
  }
  return merged.sort((a, b) => b.skin - a.skin).slice(0, maxFaces);
}

function boxesNear(a, b, gx, gy) {
  const overlapX = a.x < b.x + b.w + gx && b.x < a.x + a.w + gx;
  const overlapY = a.y < b.y + b.h + gy && b.y < a.y + a.h + gy;
  return overlapX && overlapY;
}

/** The single best face in a photo, or null when none is found. */
export function primaryFace(img, opts) {
  return detectFaces(img, opts)[0] ?? null;
}
