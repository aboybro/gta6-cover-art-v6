// Renders the whole poster onto a 2D context at any size: background
// scene, graded panels with cast tags, the pop-out panel breaking its
// frame, chrome title with glow, script subtitle, tagline ribbon, seal,
// review top bar, sparkles, lens flare, release line, billing block and
// barcode. Name tags are drawn last and skipped wherever the title, the
// subtitle, the ribbon, the seal or the top bar would strike through
// them. The editor preview and the PNG export both call this one
// function, so what you see is exactly what you share.
//
// Face-weighted grading: each panel's pixels are first exposed for its
// face (face-grade.js) and the face is sharpened, and only then does the
// colour grade land — so the face, not the sky, sets the exposure.

import { layoutById, panelsFor } from './layouts.js';
import { gradeById, applyGrade } from './grades.js';
import { drawPhotoInto } from './photos.js';
import { exposeForFace, sharpenFace } from './face-grade.js';
import { panelFaceBox } from './face-anchor.js';
import { sampleById } from './samples.js';
import {
  drawChromeTitle, drawScriptSubtitle, drawNameTag, drawSeal,
  drawTopBar, drawTaglineRibbon, drawSparkles, drawLensFlare,
  drawReleaseLine, drawBilling, drawBarcode,
} from './furniture.js';
import { BILLING_LINE, RELEASE_LINE, EDITION_TAG } from './presets.js';

/**
 * Renders the poster for `state` onto ctx at W x H.
 * state: { layoutId, gradeId, title, subtitle, tagline, quote, source,
 *   edition, titleFont, scriptFont,
 *   assignments: {panelIndex: photoId}, tweaks: {panelIndex: {zoom, ox, oy, flip}} }
 * images: Map of photoId -> { img, face, faces, faceScore } (samples and user uploads).
 */
export function renderPoster(ctx, state, images, W, H) {
  const layout = layoutById(state.layoutId);
  const geo = panelsFor(layout, W, H);
  const grade = gradeById(state.gradeId);

  // 1. Background scene, full bleed, with a dusk gradient so the panels
  // and the title sit on something warm and dark, never flat.
  drawBackground(ctx, images.get(geo.bg), W, H);

  // 2. Panels: each photo face-aware cropped, face-exposed, face-
  // sharpened, then graded on its own pixels, framed in black and
  // white. Tags come later, after the keep-out zones are known.
  geo.panels.forEach((panel, i) => {
    const photoId = state.assignments?.[i] ?? panel.photo;
    const entry = images.get(photoId);
    if (!entry) return;
    const tweak = state.tweaks?.[i] ?? {};
    drawPanel(ctx, entry, panel, grade, tweak, i);
  });

  // 3. Chrome title + script subtitle.
  const titleSize = H * 0.125 * geo.title.scale;
  const tx = geo.title.align === 'center' ? W / 2 : geo.title.x;
  const ty = geo.title.y + titleSize;
  const titleW = drawChromeTitle(ctx, state.title, tx, ty, titleSize, geo.title.align, -0.02, state.titleFont || 'Anton');
  ctx.font = `${H * 0.038}px ${state.scriptFont || 'Pacifico'}, cursive`;
  const subW = ctx.measureText(state.subtitle).width;
  const subX = geo.title.align === 'center' ? W / 2 - subW / 2 : geo.title.x + titleSize * 0.08;
  const subY = ty + H * 0.055;
  drawScriptSubtitle(ctx, state.subtitle, subX, subY, H * 0.038, state.scriptFont || 'Pacifico');

  // 4. Tagline ribbon: under the subtitle for left-aligned titles, in
  // the open strip under the grid for centred ones (never across a face).
  ctx.font = `bold ${Math.max(18, H * 0.032 * 0.52)}px Arial, sans-serif`;
  const tagW = ctx.measureText((state.tagline || '').toUpperCase()).width + H * 0.05;
  const ribbonX = geo.title.align === 'center' ? W / 2 - tagW / 2 : geo.title.x;
  const ribbonY = geo.title.align === 'center' ? H * 0.875 : subY + H * 0.02;
  const ribbon = drawTaglineRibbon(ctx, state.tagline || '', ribbonX, ribbonY, tagW);

  // 5. Seal, then the review top bar over everything's top edge.
  drawSeal(ctx, geo.seal.x, geo.seal.y, geo.seal.r);
  drawTopBar(ctx, W, H, state.quote, state.source, state.edition || EDITION_TAG);

  // 6. Name tags — but never where the title, subtitle, ribbon, seal or
  // top bar would strike through them.
  const keepOut = [
    { x: 0, y: 0, w: W, h: H * 0.05 }, // top bar
    titleBand(tx, ty, titleW, titleSize, geo.title.align, H),
    { x: subX - 6, y: subY - H * 0.038, w: subW + 12, h: H * 0.05 }, // subtitle
    ribbon, // tagline ribbon
    { x: geo.seal.x - geo.seal.r, y: geo.seal.y - geo.seal.r, w: geo.seal.r * 2, h: geo.seal.r * 2 }, // seal
  ];
  geo.panels.forEach((panel, i) => {
    const photoId = state.assignments?.[i] ?? panel.photo;
    const sample = sampleById(photoId);
    if (!panel.tag || sample.role === 'Scene') return;
    const scale = Math.max(0.5, panel.w / 560);
    const tagH = (26 + 17 + 22) * scale;
    const tagX = panel.x + panel.w * 0.03;
    const tagW = panel.w * 0.5;
    const bottomRect = { x: tagX, y: panel.y + panel.h - panel.h * 0.04 - tagH, w: tagW, h: tagH };
    const topRect = { x: tagX, y: panel.y + panel.h * 0.04, w: tagW, h: tagH };
    // Bottom-left first; if the title, subtitle, ribbon or seal sits
    // there, move the tag to the panel's top-left instead of dropping it.
    if (!keepOut.some((z) => rectsOverlap(bottomRect, z))) {
      drawNameTag(ctx, sample.name, sample.role, tagX, panel.y + panel.h - panel.h * 0.04, scale);
    } else if (!keepOut.some((z) => rectsOverlap(topRect, z))) {
      drawNameTag(ctx, sample.name, sample.role, tagX, panel.y + panel.h * 0.04 + tagH, scale);
    }
  });

  // 7. Sparkles (never on the hero's face), lens flare, release line, billing, barcode.
  const heroFaceZone = geo.panels[0]
    ? { x: geo.panels[0].x, y: geo.panels[0].y, w: geo.panels[0].w, h: geo.panels[0].h * 0.5 }
    : null;
  drawSparkles(ctx, W, H, 42, heroFaceZone);
  drawLensFlare(ctx, W * 0.07, H * 0.09, H * 0.05);
  drawReleaseLine(ctx, W, H, RELEASE_LINE);
  drawBilling(ctx, W, H, BILLING_LINE);
  drawBarcode(ctx, W * 0.895, H * 0.93, W * 0.085, H * 0.04);
}

function titleBand(tx, ty, titleW, titleSize, align, H) {
  const x0 = align === 'center' ? tx - titleW / 2 : tx;
  return { x: x0 - 8, y: ty - titleSize, w: titleW + 16, h: titleSize * 1.15 + H * 0.01 };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function drawBackground(ctx, entry, W, H) {
  ctx.fillStyle = '#1c0b28';
  ctx.fillRect(0, 0, W, H);
  if (entry) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawPhotoInto(ctx, entry.img, { x: 0, y: 0, w: W, h: H }, entry.face, 1);
    ctx.restore();
  }
  // Dusk wash: warm at the top, deep plum at the foot.
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, 'rgba(255,110,60,0.18)');
  wash.addColorStop(0.5, 'rgba(120,30,90,0.12)');
  wash.addColorStop(1, 'rgba(12,4,22,0.62)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
}

/**
 * One panel: graded photo, comic frame, optional diagonal slant, optional
 * pop-out (overflows its frame slightly, white cut-out outline, hard
 * shadow — the cast mosaic's hero panel). Before the grade lands, the
 * panel is exposed for its face and the face is sharpened, so the
 * grade serves the person in the frame.
 */
function drawPanel(ctx, entry, panel, grade, tweak, seed) {
  const overflow = panel.popout ? 0.012 : 0;
  const px = panel.x - panel.w * overflow;
  const py = panel.y - panel.h * overflow;
  const pw = Math.max(2, Math.round(panel.w * (1 + overflow * 2)));
  const ph = Math.max(2, Math.round(panel.h * (1 + overflow * 2)));
  const off = document.createElement('canvas');
  off.width = pw;
  off.height = ph;
  const octx = off.getContext('2d');
  drawPhotoInto(octx, entry.img, { x: 0, y: 0, w: pw, h: ph }, entry.face, tweak.zoom ?? 1, tweak.ox ?? 0, tweak.oy ?? 0, tweak.flip ?? false);
  // Face-weighted passes on the panel's own pixels: expose for the face,
  // sharpen the face, then the colour grade. The face box is mapped
  // through the same face-aware crop the panel draws (face-anchor.js),
  // so the box sits exactly on the face the poster shows.
  const face = entry.faces?.[0] ?? null;
  if (face) {
    const boxPx = panelFaceBox(face, entry.img, { x: 0, y: 0, w: pw, h: ph }, tweak);
    if (boxPx) {
      const box = { x: boxPx.x / pw, y: boxPx.y / ph, w: boxPx.w / pw, h: boxPx.h / ph };
      exposeForFace(octx, pw, ph, box);
      sharpenFace(octx, pw, ph, box, 0.35);
    }
  }
  applyGrade(octx, pw, ph, grade, seed * 13 + 5);

  if (panel.popout) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = panel.w * 0.018;
    ctx.shadowOffsetY = panel.h * 0.016;
    roundRectPath(ctx, px, py, pw, ph, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  if (panel.slant) {
    // Parallelogram clip: the top edge slides right by `slant`.
    ctx.beginPath();
    ctx.moveTo(px + panel.slant, py);
    ctx.lineTo(px + pw, py);
    ctx.lineTo(px + pw - panel.slant, py + ph);
    ctx.lineTo(px, py + ph);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(off, px, py);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#0d0512';
    ctx.lineWidth = Math.max(3, panel.w * 0.008);
    ctx.beginPath();
    ctx.moveTo(px + panel.slant, py);
    ctx.lineTo(px + pw, py);
    ctx.lineTo(px + pw - panel.slant, py + ph);
    ctx.lineTo(px, py + ph);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, panel.w * 0.004);
    ctx.stroke();
    ctx.restore();
    return;
  }
  roundRectPath(ctx, px, py, pw, ph, 4);
  ctx.clip();
  ctx.drawImage(off, px, py);
  ctx.restore();
  ctx.save();
  ctx.lineWidth = Math.max(3, panel.w * 0.01);
  ctx.strokeStyle = panel.popout ? '#ffffff' : '#0d0512';
  roundRectPath(ctx, px, py, pw, ph, 4);
  ctx.stroke();
  ctx.lineWidth = Math.max(2, panel.w * 0.005);
  ctx.strokeStyle = '#ffffff';
  roundRectPath(ctx, px + 3, py + 3, pw - 6, ph - 6, 3);
  ctx.stroke();
  ctx.restore();
}
