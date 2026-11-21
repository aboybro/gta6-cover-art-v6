// Face anchors: where each face is, measured from the photo itself.
// The shipped samples carry a hand-measured anchor as a starting point,
// but the app re-measures every photo at load on a fine grid (96
// columns) and uses the measured faces — so an upload behaves exactly
// like a shipped sample, and the editor can draw the real boxes.

import { detectFaces } from './face-detect.js';
import { faceCropRect } from './photos.js';

/**
 * Measures a photo's faces on a fine grid. Returns
 *   { anchor: {x, y}, faces: [...] }
 * `anchor` is the primary face's centroid (the crop engine centres on
 * it); `faces` is every detected face, biggest skin mass first.
 * When no face is found, returns { anchor: null, faces: [] } — the
 * caller falls back to the shipped anchor, never to an invented face.
 */
export function measureAnchors(img) {
  const faces = detectFaces(img, { cols: 96, maxFaces: 4 });
  if (!faces.length) return { anchor: null, faces: [] };
  const f = faces[0];
  return { anchor: { x: f.ax, y: f.ay }, faces };
}

/**
 * The panel-pixel rectangle of a face box: maps a face's photo-fraction
 * box through the same face-aware crop the panel draws, so the editor's
 * overlay box sits exactly on the face the poster shows. `panel` is
 * {x, y, w, h} in canvas pixels; `tweak` is the panel's {zoom, ox, oy}.
 * Returns null when the face is cropped out of the panel.
 */
export function panelFaceBox(face, img, panel, tweak = {}) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const anchor = { x: face.ax, y: face.ay };
  const r = faceCropRect(img, panel.w, panel.h, anchor, tweak.zoom ?? 1, tweak.ox ?? 0, tweak.oy ?? 0);
  // Face box corners in source pixels, then into panel pixels.
  const x0 = face.x * sw;
  const x1 = (face.x + face.w) * sw;
  const y0 = face.y * sh;
  const y1 = (face.y + face.h) * sh;
  const px0 = panel.x + ((x0 - r.sx) / r.sw) * panel.w;
  const px1 = panel.x + ((x1 - r.sx) / r.sw) * panel.w;
  const py0 = panel.y + ((y0 - r.sy) / r.sh) * panel.h;
  const py1 = panel.y + ((y1 - r.sy) / r.sh) * panel.h;
  if (px1 < panel.x || px0 > panel.x + panel.w || py1 < panel.y || py0 > panel.y + panel.h) return null;
  return {
    x: Math.max(panel.x, px0),
    y: Math.max(panel.y, py0),
    w: Math.min(panel.x + panel.w, px1) - Math.max(panel.x, px0),
    h: Math.min(panel.y + panel.h, py1) - Math.max(panel.y, py0),
  };
}

/**
 * The face in `faces` that best fills a panel of the given aspect —
 * the one the auto-fill should put there. Ties break toward the
 * bigger skin mass (the faces list is already skin-sorted).
 */
export function bestFaceForPanel(faces, panelAspect) {
  if (!faces.length) return null;
  let best = faces[0];
  let bestFit = -1;
  for (const f of faces) {
    const faceAspect = f.w / Math.max(0.01, f.h);
    const ratio = Math.max(faceAspect, panelAspect) / Math.min(faceAspect, panelAspect);
    const fit = Math.max(0, 1 - 0.35 * (ratio - 1));
    if (fit > bestFit) {
      bestFit = fit;
      best = f;
    }
  }
  return best;
}
