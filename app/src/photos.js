// Face-aware cropping: where a photo lands in a panel, the face stays in
// frame. A panel asks for a source rectangle of the photo that covers the
// panel exactly (no letterbox), centred on the face anchor, then the user
// can zoom and nudge it. Detection and scoring live in the face modules
// (face-detect.js, face-score.js); this file keeps the crop math and the
// drawing, plus the old single-anchor helpers as thin delegates so
// uploads and samples share one code path.

import { detectFaces, isSkin } from './face-detect.js';
import { scoreFaceDetailed } from './face-score.js';

export { isSkin };

/**
 * Source rectangle of `img` that covers a dstW x dstH panel while keeping
 * the face anchor in frame. zoom > 1 crops tighter; ox/oy nudge the crop
 * in fractions of the crop size (-1..1). Returns {sx, sy, sw, sh}.
 */
export function faceCropRect(img, dstW, dstH, face, zoom = 1, ox = 0, oy = 0) {
  // Works for images and for canvases (a graded hero is a canvas).
  const sw0 = img.naturalWidth || img.width;
  const sh0 = img.naturalHeight || img.height;
  const scale = Math.max(dstW / sw0, dstH / sh0) * zoom;
  let cw = dstW / scale;
  let ch = dstH / scale;
  cw = Math.min(cw, sw0);
  ch = Math.min(ch, sh0);
  // Centre the crop on the face, biased so the face sits a third down the
  // panel instead of dead centre — the poster's eye line.
  let cx = face.x * sw0 + ox * cw * 0.5;
  let cy = face.y * sh0 - ch * 0.18 + oy * ch * 0.5;
  cx = clamp(cx, cw / 2, sw0 - cw / 2);
  cy = clamp(cy, ch / 2, sh0 - ch / 2);
  return { sx: cx - cw / 2, sy: cy - ch / 2, sw: cw, sh: ch };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Finds the face anchor of an uploaded photo: the primary detected
 * face's centroid. Falls back to the upper-middle of the frame when no
 * face is found (a landscape, a car, a skyline).
 */
export function detectFaceAnchor(img) {
  const faces = detectFaces(img, { cols: 96, maxFaces: 1 });
  if (!faces.length) return { x: 0.5, y: 0.35 };
  return { x: faces[0].ax, y: faces[0].ay };
}

/** Draws img into a panel rect with the face-aware crop above. flip mirrors it. */
export function drawPhotoInto(ctx, img, rect, face, zoom = 1, ox = 0, oy = 0, flip = false) {
  const r = faceCropRect(img, rect.w, rect.h, face, zoom, ox, oy);
  if (!flip) {
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, rect.x, rect.y, rect.w, rect.h);
    return;
  }
  ctx.save();
  ctx.translate(rect.x + rect.w, rect.y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, rect.w, rect.h);
  ctx.restore();
}

/**
 * Scores how good a face is for the hero slot, 0..1 — the full
 * five-signal breakdown from face-score.js, reduced to the number the
 * auto-fill ranks on. Shipped samples carry their score in samples.js
 * as a starting point; the app re-measures at load and uses the
 * measured number.
 */
export function scoreFace(img, face) {
  return scoreFaceDetailed(img, face).score;
}
