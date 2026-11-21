// Poster furniture: everything around the photos that makes a poster read
// as a poster — the review top bar, the striped chrome title with its
// glow, the script subtitle, the tagline ribbon, the cast name tags, the
// Leonida seal with ring text, sparkles, a lens flare, the release line,
// the billing block and a barcode. All of it is drawn, never an image, so
// it stays sharp at any export size.

/**
 * The big title in striped chrome: the title font, filled with a vertical
 * chrome gradient, overlaid with thin white stripes, outlined in black,
 * with a neon glow behind it and a hard offset shadow. Returns the width
 * the title took.
 */
export function drawChromeTitle(ctx, text, x, y, size, align = 'left', tilt = -0.02, family = 'Anton') {
  const label = text.trim().toUpperCase() || 'VICE HEAT';
  let fontSize = size;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${fontSize}px ${family}, "Arial Black", sans-serif`;
  const maxW = ctx.canvas.width * 0.62;
  while (measure.measureText(label).width > maxW && fontSize > 24) {
    fontSize -= 4;
    measure.font = `${fontSize}px ${family}, "Arial Black", sans-serif`;
  }
  const textW = measure.measureText(label).width;
  // Render the title on its own canvas first: the stripe pass uses
  // source-atop, which would otherwise stripe every photo already on
  // the poster, not just the letters.
  const pad = Math.ceil(fontSize * 0.9);
  const off = document.createElement('canvas');
  off.width = Math.ceil(textW + pad * 2);
  off.height = Math.ceil(fontSize * 2.6);
  const o = off.getContext('2d');
  const ox = align === 'center' ? off.width / 2 : pad;
  const oy = fontSize * 1.3;
  o.textAlign = align;
  o.textBaseline = 'alphabetic';
  o.font = `${fontSize}px ${family}, "Arial Black", sans-serif`;
  // Neon glow behind the letters.
  o.save();
  o.shadowColor = 'rgba(255,77,141,0.85)';
  o.shadowBlur = fontSize * 0.28;
  o.fillStyle = 'rgba(255,77,141,0.35)';
  o.fillText(label, ox, oy);
  o.restore();
  // Hard shadow, then the chrome fill.
  o.fillStyle = 'rgba(0,0,0,0.6)';
  o.fillText(label, ox + 6, oy + 8);
  const chrome = o.createLinearGradient(0, oy - fontSize * 0.85, 0, oy + fontSize * 0.15);
  chrome.addColorStop(0, '#ffffff');
  chrome.addColorStop(0.35, '#ffe9a8');
  chrome.addColorStop(0.55, '#ff9d5c');
  chrome.addColorStop(0.75, '#ff4d8d');
  chrome.addColorStop(1, '#b8f1ff');
  o.fillStyle = chrome;
  o.fillText(label, ox, oy);
  // Thin white stripes clipped to the letters only.
  o.save();
  o.globalAlpha = 0.5;
  o.globalCompositeOperation = 'source-atop';
  o.fillStyle = '#ffffff';
  for (let sy = oy - fontSize; sy < oy + fontSize * 0.2; sy += fontSize * 0.16) {
    o.fillRect(0, sy, off.width, fontSize * 0.045);
  }
  o.restore();
  // Black outline, drawn last so the letters pop off any photo.
  o.lineWidth = Math.max(3, fontSize * 0.045);
  o.strokeStyle = '#14061f';
  o.lineJoin = 'round';
  o.strokeText(label, ox, oy);
  // Blit the finished title onto the poster, tilted.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const dx = align === 'center' ? -off.width / 2 : -pad;
  ctx.drawImage(off, dx, -oy);
  ctx.restore();
  return textW;
}

/** The neon script subtitle, in the picked script font. */
export function drawScriptSubtitle(ctx, text, x, y, size, family = 'Pacifico') {
  if (!text.trim()) return;
  ctx.save();
  ctx.font = `${size}px ${family}, cursive`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(255,46,136,0.9)';
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = '#ffd7ef';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * The review top bar: a masthead band across the poster's top — five
 * stars, the review quote and its source on the left, the edition tag
 * chipped on the right. It replaces the old full-width black strip at
 * the foot, so the poster's bottom stays open for the art.
 */
export function drawTopBar(ctx, W, H, quote, source, edition) {
  const barH = H * 0.05;
  ctx.save();
  ctx.fillStyle = 'rgba(8,3,14,0.96)';
  ctx.fillRect(0, 0, W, barH);
  ctx.fillStyle = '#ffd76a';
  ctx.fillRect(0, barH - Math.max(2, H * 0.003), W, Math.max(2, H * 0.003));
  const starSize = barH * 0.44;
  ctx.font = `${starSize}px Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('★★★★★', W * 0.02, barH * 0.52);
  ctx.font = `italic ${barH * 0.36}px Georgia, serif`;
  ctx.fillStyle = '#ffffff';
  const q = `“${quote}” — ${source}`;
  ctx.fillText(q, W * 0.02 + starSize * 5.6, barH * 0.52);
  // Edition chip, right-aligned.
  ctx.font = `bold ${barH * 0.32}px Arial, sans-serif`;
  const chipText = edition.toUpperCase();
  const chipW = ctx.measureText(chipText).width + barH * 0.9;
  const chipX = W * 0.98 - chipW;
  const chipY = barH * 0.18;
  const chipH = barH * 0.64;
  ctx.fillStyle = 'rgba(255,215,106,0.16)';
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = Math.max(1.5, barH * 0.04);
  roundRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd76a';
  ctx.textAlign = 'center';
  ctx.fillText(chipText, chipX + chipW / 2, barH * 0.54);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
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

/** The tagline ribbon: a slanted pink band with the tagline in caps. */
export function drawTaglineRibbon(ctx, text, x, y, w, angle = -0.02) {
  if (!text.trim()) return { x, y, w, h: 0 };
  const h = Math.max(18, ctx.canvas.height * 0.032);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = '#ff4d8d';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffd76a';
  ctx.fillRect(0, 0, w, Math.max(2, h * 0.1));
  ctx.fillRect(0, h - Math.max(2, h * 0.1), w, Math.max(2, h * 0.1));
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${h * 0.52}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), w / 2, h * 0.54);
  ctx.restore();
  // Bounding box (unrotated) for the tag keep-out check.
  return { x, y: y - h * 0.12, w, h: h * 1.24 };
}

/** A cast name tag: black chip, white name, pink role, bottom-left of a panel. */
export function drawNameTag(ctx, name, role, x, y, scale = 1) {
  const pad = 10 * scale;
  const nameSize = 26 * scale;
  const roleSize = 17 * scale;
  ctx.save();
  ctx.font = `bold ${nameSize}px "Arial Black", sans-serif`;
  const nw = ctx.measureText(name.toUpperCase()).width;
  ctx.font = `${roleSize}px Arial, sans-serif`;
  const rw = ctx.measureText(role.toUpperCase()).width;
  const w = Math.max(nw, rw) + pad * 2;
  const h = nameSize + roleSize + pad * 2.2;
  ctx.fillStyle = 'rgba(10,4,18,0.88)';
  ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = '#ff4d8d';
  ctx.fillRect(x, y - h, 5 * scale, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${nameSize}px "Arial Black", sans-serif`;
  ctx.fillText(name.toUpperCase(), x + pad + 4 * scale, y - h + pad + nameSize * 0.85);
  ctx.fillStyle = '#ffb3d1';
  ctx.font = `${roleSize}px Arial, sans-serif`;
  ctx.fillText(role.toUpperCase(), x + pad + 4 * scale, y - pad * 0.6);
  ctx.restore();
}

/** The circular Leonida seal, rotated, ring text around a star. */
export function drawSeal(ctx, x, y, r, text = 'LEONIDA • EST. 2026 • ') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.22);
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.strokeStyle = '#ffe9a8';
  ctx.fillStyle = 'rgba(20,6,31,0.72)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  // Ring text, one letter at a time around the circle.
  ctx.fillStyle = '#ffe9a8';
  ctx.font = `bold ${r * 0.2}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ring = text.repeat(2);
  for (let i = 0; i < ring.length; i++) {
    const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -r * 0.89);
    ctx.fillText(ring[i], 0, 0);
    ctx.restore();
  }
  // Star.
  ctx.fillStyle = '#ff4d8d';
  drawStar(ctx, 0, 0, r * 0.42, r * 0.18, 5);
  ctx.restore();
}

function drawStar(ctx, cx, cy, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Four-point sparkles, seeded so they land in the same place every render.
 *  `avoid` is a rect (the hero's face zone) no sparkle lands in. */
export function drawSparkles(ctx, W, H, seed = 42, avoid = null) {
  let a = seed >>> 0;
  const rnd = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const x = W * (0.05 + rnd() * 0.9);
    const y = H * (0.08 + rnd() * 0.55);
    if (avoid && x > avoid.x && x < avoid.x + avoid.w && y > avoid.y && y < avoid.y + avoid.h) continue;
    const r = H * (0.006 + rnd() * 0.012);
    const gold = rnd() > 0.5;
    ctx.fillStyle = gold ? 'rgba(255,215,106,0.95)' : 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }
  ctx.restore();
}

/** A warm lens flare: hot core, halo, and a horizontal streak. */
export function drawLensFlare(ctx, x, y, r) {
  ctx.save();
  const core = ctx.createRadialGradient(x, y, 0, x, y, r);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.25, 'rgba(255,220,150,0.55)');
  core.addColorStop(1, 'rgba(255,180,90,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  const streak = ctx.createLinearGradient(x - r * 3, y, x + r * 3, y);
  streak.addColorStop(0, 'rgba(255,200,120,0)');
  streak.addColorStop(0.5, 'rgba(255,220,160,0.5)');
  streak.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = streak;
  ctx.fillRect(x - r * 3, y - r * 0.06, r * 6, r * 0.12);
  ctx.restore();
}

/** The release line, small gold caps above the billing block. */
export function drawReleaseLine(ctx, W, H, line) {
  ctx.save();
  ctx.font = `bold ${Math.max(12, H * 0.016)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(line.toUpperCase(), W / 2, H * 0.968);
  ctx.restore();
}

/** Tiny billing credits, one line, bottom edge. */
export function drawBilling(ctx, W, H, line) {
  ctx.save();
  ctx.font = `${Math.max(11, H * 0.011)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(line, W / 2, H - H * 0.006);
  ctx.restore();
}

/** A barcode sticker, seeded bars so it is identical on every render. */
export function drawBarcode(ctx, x, y, w, h, code = '8 901234 567890') {
  let a = 1234567;
  const rnd = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 18);
  ctx.fillStyle = '#111111';
  let bx = x;
  while (bx < x + w - 2) {
    const bw = 1 + Math.floor(rnd() * 3) * (w / 220);
    if (rnd() > 0.45) ctx.fillRect(bx, y, Math.max(1.2, bw), h);
    bx += Math.max(2, bw) + 1 + rnd() * 2;
  }
  ctx.font = `${Math.max(9, h * 0.22)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(code, x + w / 2, y + h + 13);
  ctx.restore();
}
