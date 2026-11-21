// The grade pipeline. Every grade is a real per-pixel transform run on the
// panel's own pixels — auto-exposure (percentile level stretch), gamma,
// an S-curve, saturation, and split toning — plus overlay effects
// (halftone, grain, bloom, vignette, light leak). Skin pixels are
// protected: saturation and split toning are softened on them so faces
// keep a warm, human hue under every grade. The skin test is shared
// with the face pipeline (face-detect.js) — one definition, one truth.
// Face-region exposure and sharpening run before this grade lands
// (face-grade.js, called from render.js).

import { isSkin as isSkinPixel } from './face-detect.js';

export const GRADES = [
  {
    id: 'sunset-gold', name: 'Sunset Gold', black: 8, white: 248, gamma: 0.92,
    sat: 1.28, curve: 0.18, shadow: [255, 90, 42], highlight: [255, 215, 106],
    shadowAmt: 0.22, highAmt: 0.25, halftone: 0, grain: 0.05, bloom: 0, vignette: 0.28, leak: 0,
  },
  {
    id: 'neon-night', name: 'Neon Night', black: 4, white: 250, gamma: 0.95,
    sat: 1.42, curve: 0.22, shadow: [36, 27, 77], highlight: [255, 46, 136],
    shadowAmt: 0.3, highAmt: 0.3, halftone: 0, grain: 0.06, bloom: 0.35, vignette: 0.34, leak: 0,
  },
  {
    id: 'retro-print', name: 'Retro Print', black: 18, white: 238, gamma: 1.05,
    sat: 0.85, curve: 0.3, shadow: [120, 60, 30], highlight: [255, 240, 200],
    shadowAmt: 0.18, highAmt: 0.15, halftone: 0.35, grain: 0.14, bloom: 0, vignette: 0.2, leak: 0,
  },
  {
    id: 'tropic-teal', name: 'Tropic Teal', black: 6, white: 250, gamma: 0.95,
    sat: 1.32, curve: 0.2, shadow: [0, 90, 100], highlight: [255, 190, 90],
    shadowAmt: 0.28, highAmt: 0.28, halftone: 0, grain: 0.05, bloom: 0.15, vignette: 0.3, leak: 0,
  },
  {
    id: 'ultraviolet', name: 'Ultraviolet', black: 4, white: 252, gamma: 0.9,
    sat: 1.5, curve: 0.2, shadow: [70, 20, 130], highlight: [255, 90, 220],
    shadowAmt: 0.32, highAmt: 0.3, halftone: 0, grain: 0.06, bloom: 0.4, vignette: 0.32, leak: 0,
  },
  {
    id: 'heat-wave', name: 'Heat Wave', black: 10, white: 246, gamma: 0.88,
    sat: 1.36, curve: 0.24, shadow: [160, 20, 10], highlight: [255, 170, 60],
    shadowAmt: 0.3, highAmt: 0.32, halftone: 0, grain: 0.07, bloom: 0.25, vignette: 0.26, leak: 0.5,
  },
  {
    id: 'palm-noir', name: 'Palm Noir', black: 12, white: 240, gamma: 1.08,
    sat: 0.72, curve: 0.34, shadow: [10, 10, 18], highlight: [235, 225, 205],
    shadowAmt: 0.2, highAmt: 0.12, halftone: 0, grain: 0.12, bloom: 0, vignette: 0.45, leak: 0,
  },
  {
    id: 'vice-chrome', name: 'Vice Chrome', black: 6, white: 250, gamma: 0.94,
    sat: 1.12, curve: 0.2, shadow: [20, 60, 110], highlight: [140, 230, 255],
    shadowAmt: 0.3, highAmt: 0.3, halftone: 0, grain: 0.05, bloom: 0.2, vignette: 0.28, leak: 0,
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

/** Deterministic PRNG (mulberry32) so grain is identical on every render. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Applies a grade to the pixels of `ctx`'s canvas in place, then paints
 * the overlay effects (halftone, grain, bloom, vignette, light leak) on
 * top. Runs per panel, at the panel's own pixel size.
 */
export function applyGrade(ctx, w, h, grade, seed = 7) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const black = grade.black;
  const white = grade.white;
  const span = white - black;
  const gamma = grade.gamma;
  const sat = grade.sat;
  const curve = grade.curve;
  const sh = grade.shadow;
  const hi = grade.highlight;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    // Auto-exposure: percentile level stretch.
    r = ((r - black) / span) * 255;
    g = ((g - black) / span) * 255;
    b = ((b - black) / span) * 255;
    r = clamp255(r);
    g = clamp255(g);
    b = clamp255(b);
    // Gamma + S-curve contrast.
    r = sCurve(Math.pow(r / 255, gamma) * 255, curve);
    g = sCurve(Math.pow(g / 255, gamma) * 255, curve);
    b = sCurve(Math.pow(b / 255, gamma) * 255, curve);
    // Luminance and the pixel's lightness, for split toning.
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const light = luma / 255;
    // Skin protection: soften the colour work on warm skin pixels.
    const skin = isSkinPixel(r, g, b) ? 0.38 : 1;
    // Saturation around the luma.
    const s = 1 + (sat - 1) * skin;
    r = clamp255(luma + (r - luma) * s);
    g = clamp255(luma + (g - luma) * s);
    b = clamp255(luma + (b - luma) * s);
    // Split tone: shadows toward the shadow colour, highlights toward
    // the highlight colour, both softened on skin.
    const shAmt = grade.shadowAmt * (1 - light) * skin;
    const hiAmt = grade.highAmt * light * skin;
    r = clamp255(r + (sh[0] - r) * shAmt * 0.5 + (hi[0] - r) * hiAmt * 0.5);
    g = clamp255(g + (sh[1] - g) * shAmt * 0.5 + (hi[1] - g) * hiAmt * 0.5);
    b = clamp255(b + (sh[2] - b) * shAmt * 0.5 + (hi[2] - b) * hiAmt * 0.5);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  paintOverlays(ctx, w, h, grade, seed);
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function sCurve(v, amount) {
  const t = v / 255;
  const s = t * t * (3 - 2 * t);
  return clamp255((t + (s - t) * amount * 2) * 255);
}

/** Halftone dots, film grain, bloom, vignette and a light leak, in order. */
function paintOverlays(ctx, w, h, grade, seed) {
  if (grade.halftone > 0) {
    const step = Math.max(6, Math.round(w / 160));
    ctx.save();
    ctx.globalAlpha = grade.halftone * 0.35;
    ctx.fillStyle = '#000000';
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        const r = step * 0.22 * (0.5 + 0.5 * Math.sin((x + y) * 0.05));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  if (grade.grain > 0) {
    const rnd = seededRandom(seed);
    const n = Math.round(w * h * grade.grain * 0.0012);
    ctx.save();
    for (let i = 0; i < n; i++) {
      const v = rnd() > 0.5 ? 255 : 0;
      ctx.globalAlpha = 0.05 + rnd() * 0.06;
      ctx.fillStyle = v === 255 ? '#ffffff' : '#000000';
      ctx.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
    }
    ctx.restore();
  }
  if (grade.bloom > 0) {
    ctx.save();
    ctx.globalAlpha = grade.bloom * 0.5;
    ctx.filter = 'blur(6px) brightness(1.4)';
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
  }
  if (grade.vignette > 0) {
    const g = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.35,
      w / 2, h / 2, Math.max(w, h) * 0.72,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${grade.vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (grade.leak > 0) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `rgba(255,120,40,${grade.leak * 0.28})`);
    g.addColorStop(0.5, 'rgba(255,120,40,0)');
    g.addColorStop(1, `rgba(255,40,120,${grade.leak * 0.2})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
