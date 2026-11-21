// Wires the page: pick a layout and a grade, type the title, click a
// panel to re-crop it, drop in your own photos, export the poster as a
// PNG in 1080x1080, 1080x1350 or 1920x1080. Three live mini-previews
// show every post size at once. The Face Lab ranks the cast by measured
// face quality and the face overlay draws the detected boxes and scores
// right on the poster, so the pipeline is visible, not just claimed.
// A `?shot=` query sets up a fixed scene for a screenshot instead
// (./shots.js).

import { SAMPLES, sampleById, characterSamples } from './samples.js';
import { LAYOUTS, layoutById, panelsFor } from './layouts.js';
import { GRADES } from './grades.js';
import { renderPoster } from './render.js';
import { detectFaces } from './face-detect.js';
import { scoreFaceDetailed, scoreLabel } from './face-score.js';
import { measureAnchors, panelFaceBox } from './face-anchor.js';
import { rankCast, autoFillAssignments } from './face-rank.js';
import { TITLE_PRESETS, SIZES, sizeById, TITLE_FONTS, SCRIPT_FONTS, EDITION_TAG } from './presets.js';
import { exportPosterPNG, exportAllSizes, downloadBlob } from './exporter.js';
import { shotScene, markShotReady } from './shots.js';

const canvas = document.getElementById('poster');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const query = new URLSearchParams(location.search);
const scene = query.get('shot') ? shotScene(query) : null;

/** The poster's state: everything a render needs, nothing more. */
let state = defaultState();
let images = new Map();
let selectedPanel = -1;
let history = [];
let historyAt = -1;
/** The measured cast ranking — the same list the Face Lab shows. */
let rankedCast = [];
/** Draw detected face boxes + scores on the poster (on in the editor shot). */
let faceOverlay = false;

function defaultState(preset = 0) {
  const p = TITLE_PRESETS[preset];
  return {
    layoutId: 'cast-mosaic',
    gradeId: 'sunset-gold',
    sizeId: '1920x1080',
    title: p.title,
    subtitle: p.subtitle,
    tagline: p.tagline,
    quote: p.quote,
    source: p.source,
    edition: EDITION_TAG,
    titleFont: 'Anton',
    scriptFont: 'Pacifico',
    assignments: {},
    tweaks: {},
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Loads the samples and RE-MEASURES each one with the real pipeline:
 * detectFaces on a fine grid, then the five-signal quality score of the
 * primary face. The shipped anchor/score in samples.js is only the
 * fallback when no face is found — the numbers the Face Lab shows are
 * computed from the photo itself.
 */
async function loadSamples() {
  for (const s of SAMPLES) {
    const img = await loadImage(s.src);
    const { anchor, faces } = measureAnchors(img);
    if (faces.length) {
      const breakdown = scoreFaceDetailed(img, faces[0]);
      images.set(s.id, {
        img,
        face: anchor,
        faces,
        faceScore: breakdown.score,
        breakdown,
      });
    } else {
      images.set(s.id, {
        img,
        face: s.face,
        faces: [],
        faceScore: s.faceScore,
        breakdown: null,
      });
    }
  }
}

/**
 * Auto-fill by measured face quality: the best face becomes the first
 * (hero) panel, the next-best faces fill the other panels, scenes fill
 * what is left, the weakest photo is left out when there are more
 * photos than panels. Uploads join the ranking with the score their
 * own detection gave them, so a stranger's best photo can take the
 * hero slot too.
 */
function autoFill() {
  const layout = layoutById(state.layoutId);
  const heroPanel = layout.panels[0];
  const heroAspect = heroPanel ? heroPanel.w / heroPanel.h : 1.6;
  rankedCast = rankCast(
    [...images.entries()].map(([id, entry]) => ({
      id,
      faceScore: entry.faceScore ?? 0.5,
      breakdown: entry.breakdown ?? null,
      faces: entry.faces ?? [],
    })),
    heroAspect,
  );
  const { assignments, leftOut } = autoFillAssignments(layout.panels.length, rankedCast);
  state.assignments = assignments;
  state.tweaks = {};
  state.leftOut = leftOut;
  renderFaceLab();
}

/** The Face Lab: the measured ranking, with the score breakdown. */
function renderFaceLab() {
  const lab = document.getElementById('faceLab');
  if (!lab) return;
  lab.innerHTML = '';
  for (const r of rankedCast) {
    const s = sampleById(r.id);
    const row = document.createElement('div');
    row.className = 'facerow';
    const b = r.breakdown;
    const detail = b
      ? `skin ${b.skin.toFixed(2)} · sharp ${b.sharpness.toFixed(2)} · expo ${b.exposure.toFixed(2)} · size ${b.size.toFixed(2)} · centre ${b.centrality.toFixed(2)}`
      : 'shipped score — no face detected';
    row.innerHTML = '';
    const rank = document.createElement('b');
    rank.textContent = `#${r.rank}`;
    const name = document.createElement('span');
    name.textContent = `${s.name} — ${s.role}`;
    const score = document.createElement('span');
    score.className = 'score';
    score.textContent = `${r.score.toFixed(2)} · ${r.label}`;
    const det = document.createElement('small');
    det.textContent = detail;
    row.append(rank, name, score, det);
    lab.appendChild(row);
  }
  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = state.leftOut?.length
    ? `Left out of this poster (weakest first): ${state.leftOut.map((id) => sampleById(id).name).join(', ')}.`
    : 'Every photo made the poster.';
  lab.appendChild(note);
}

/** Preview resolution for the editor canvas, from the chosen post size. */
function previewSize() {
  const size = sizeById(state.sizeId);
  const scale = size.w >= size.h ? 960 / size.w : 720 / size.w;
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

let rafPending = false;
function redraw() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const size = scene?.mode === 'cover'
      ? { w: window.innerWidth, h: window.innerHeight }
      : previewSize();
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    renderPoster(ctx, state, images, size.w, size.h);
    drawSelection(size.w, size.h);
    drawFaceOverlay(size.w, size.h);
    renderMinis();
  });
}

/** The three live mini-previews: 16:9, 4:5 and 1:1 of the same poster. */
function renderMinis() {
  const minis = [
    ['miniWide', 192, 108],
    ['miniPortrait', 144, 180],
    ['miniSquare', 160, 160],
  ];
  for (const [id, w, h] of minis) {
    const cv = document.getElementById(id);
    if (!cv) continue;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    renderPoster(cv.getContext('2d'), state, images, w, h);
  }
}

function drawSelection(W, H) {
  if (selectedPanel < 0) return;
  const geo = panelsFor(layoutById(state.layoutId), W, H);
  const rect = geo.panels[selectedPanel];
  if (!rect) return;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffd76a';
  ctx.strokeRect(rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8);
  ctx.restore();
  const label = document.getElementById('panelLabel');
  if (label) {
    label.textContent = `Panel ${selectedPanel + 1} selected — zoom, nudge, flip and photo buttons below apply to it.`;
  }
}

/**
 * The face overlay: every panel's detected face box, drawn where the
 * poster shows it, with the measured score beside it. This is the
 * pipeline made visible — the boxes are the detector's real output,
 * mapped through the panel's own crop.
 */
function drawFaceOverlay(W, H) {
  if (!faceOverlay) return;
  const geo = panelsFor(layoutById(state.layoutId), W, H);
  geo.panels.forEach((panel, i) => {
    const photoId = state.assignments?.[i] ?? panel.photo;
    const entry = images.get(photoId);
    const face = entry?.faces?.[0];
    if (!entry || !face) return;
    const box = panelFaceBox(face, entry.img, panel, state.tweaks?.[i] ?? {});
    if (!box || box.w < 8 || box.h < 8) return;
    const sample = sampleById(photoId);
    ctx.save();
    ctx.lineWidth = Math.max(2, W * 0.002);
    ctx.strokeStyle = '#3dff8e';
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    const label = `${sample.name} ${entry.faceScore.toFixed(2)}`;
    ctx.font = `bold ${Math.max(11, Math.round(H * 0.02))}px Arial, sans-serif`;
    const tw = ctx.measureText(label).width;
    const th = Math.max(16, Math.round(H * 0.028));
    const lx = Math.min(box.x, W - tw - 12);
    const ly = Math.max(0, box.y - th - 4);
    ctx.fillStyle = 'rgba(10,20,12,0.85)';
    ctx.fillRect(lx, ly, tw + 12, th);
    ctx.fillStyle = '#3dff8e';
    ctx.fillText(label, lx + 6, ly + th * 0.72);
    ctx.restore();
  });
}

function commit() {
  history = history.slice(0, historyAt + 1);
  history.push(JSON.stringify(state));
  if (history.length > 50) history.shift();
  historyAt = history.length - 1;
  redraw();
}

function restore(json) {
  state = JSON.parse(json);
  syncControls();
  redraw();
}

function syncControls() {
  document.getElementById('titleInput').value = state.title;
  document.getElementById('subtitleInput').value = state.subtitle;
  document.getElementById('quoteInput').value = state.quote;
  document.getElementById('taglineInput').value = state.tagline;
  document.getElementById('titleFontSelect').value = state.titleFont;
  document.getElementById('scriptFontSelect').value = state.scriptFont;
  document.querySelectorAll('#layoutRow button').forEach((b) => {
    b.classList.toggle('on', b.dataset.id === state.layoutId);
  });
  document.querySelectorAll('#gradeRow button').forEach((b) => {
    b.classList.toggle('on', b.dataset.id === state.gradeId);
  });
  document.querySelectorAll('#sizeRow button').forEach((b) => {
    b.classList.toggle('on', b.dataset.id === state.sizeId);
  });
  const overlayBtn = document.getElementById('faceOverlayBtn');
  if (overlayBtn) overlayBtn.classList.toggle('on', faceOverlay);
}

function buildButtons() {
  const layoutRow = document.getElementById('layoutRow');
  for (const l of LAYOUTS) {
    const b = document.createElement('button');
    b.textContent = l.name;
    b.dataset.id = l.id;
    b.onclick = () => { state.layoutId = l.id; autoFill(); selectedPanel = -1; commit(); syncControls(); };
    layoutRow.appendChild(b);
  }
  const gradeRow = document.getElementById('gradeRow');
  for (const g of GRADES) {
    const b = document.createElement('button');
    b.textContent = g.name;
    b.dataset.id = g.id;
    b.onclick = () => { state.gradeId = g.id; commit(); syncControls(); };
    gradeRow.appendChild(b);
  }
  const sizeRow = document.getElementById('sizeRow');
  for (const s of SIZES) {
    const b = document.createElement('button');
    b.textContent = s.label;
    b.dataset.id = s.id;
    b.onclick = () => { state.sizeId = s.id; commit(); syncControls(); };
    sizeRow.appendChild(b);
  }
  const strip = document.getElementById('sampleStrip');
  for (const s of SAMPLES) {
    strip.appendChild(sampleButton(s.id, s.src, `${s.name} — ${s.role}`));
  }
  const presetSel = document.getElementById('presetSelect');
  TITLE_PRESETS.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${p.title} — ${p.subtitle}`;
    presetSel.appendChild(o);
  });
  presetSel.onchange = () => {
    const p = TITLE_PRESETS[Number(presetSel.value)];
    state.title = p.title;
    state.subtitle = p.subtitle;
    state.tagline = p.tagline;
    state.quote = p.quote;
    state.source = p.source;
    commit();
    syncControls();
  };
  const titleFontSel = document.getElementById('titleFontSelect');
  for (const f of TITLE_FONTS) {
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = f.label;
    titleFontSel.appendChild(o);
  }
  titleFontSel.onchange = () => { state.titleFont = titleFontSel.value; commit(); };
  const scriptFontSel = document.getElementById('scriptFontSelect');
  for (const f of SCRIPT_FONTS) {
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = f.label;
    scriptFontSel.appendChild(o);
  }
  scriptFontSel.onchange = () => { state.scriptFont = scriptFontSel.value; commit(); };
}

function sampleButton(id, src, label) {
  const b = document.createElement('button');
  b.className = 'sample';
  b.dataset.id = id;
  const img = document.createElement('img');
  img.src = src;
  img.alt = label;
  b.appendChild(img);
  const span = document.createElement('span');
  span.textContent = label;
  b.appendChild(span);
  const badge = document.createElement('span');
  badge.className = 'score';
  badge.textContent = 'measuring…';
  b.appendChild(badge);
  b.onclick = () => {
    const target = selectedPanel >= 0 ? selectedPanel : 0;
    state.assignments[target] = id;
    commit();
  };
  return b;
}

/** Fills in the measured score badges once the pipeline has run. */
function updateStripBadges() {
  document.querySelectorAll('#sampleStrip .sample').forEach((b) => {
    const entry = images.get(b.dataset.id);
    const badge = b.querySelector('.score');
    if (!entry || !badge) return;
    badge.textContent = `★ ${entry.faceScore.toFixed(2)} · ${scoreLabel(entry.faceScore)}`;
  });
}

/** A dropped or pasted photo joins the cast, face-scored like a sample. */
async function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    const id = `up-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const faces = detectFaces(img, { cols: 96, maxFaces: 4 });
    const face = faces[0] ?? null;
    const breakdown = face ? scoreFaceDetailed(img, face) : null;
    const faceScore = breakdown ? breakdown.score : 0.2;
    images.set(id, {
      img,
      face: face ? { x: face.ax, y: face.ay } : { x: 0.5, y: 0.35 },
      faces,
      faceScore,
      breakdown,
    });
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Your photo';
    const btn = sampleButton(id, url, `${name} — your photo`);
    const badge = btn.querySelector('.score');
    if (badge) badge.textContent = `★ ${faceScore.toFixed(2)} · ${scoreLabel(faceScore)}`;
    document.getElementById('sampleStrip').appendChild(btn);
    autoFill();
    state.assignments[0] = id;
    statusEl.textContent = face
      ? `Loaded ${file.name} — ${faces.length} face${faces.length > 1 ? 's' : ''} detected, score ${faceScore.toFixed(2)} (${scoreLabel(faceScore)}).`
      : `Loaded ${file.name} — no face detected, treated as a scene.`;
  }
  commit();
}

function wireControls() {
  document.getElementById('titleInput').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  document.getElementById('titleInput').addEventListener('change', commit);
  document.getElementById('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  document.getElementById('subtitleInput').addEventListener('change', commit);
  document.getElementById('taglineInput').addEventListener('input', (e) => { state.tagline = e.target.value; redraw(); });
  document.getElementById('taglineInput').addEventListener('change', commit);
  document.getElementById('quoteInput').addEventListener('input', (e) => { state.quote = e.target.value; redraw(); });
  document.getElementById('quoteInput').addEventListener('change', commit);

  document.getElementById('zoomRange').addEventListener('input', (e) => {
    applyTweak('zoom', Number(e.target.value));
  });
  document.getElementById('zoomRange').addEventListener('change', commit);
  document.getElementById('nudgeX').addEventListener('input', (e) => {
    applyTweak('ox', Number(e.target.value));
  });
  document.getElementById('nudgeX').addEventListener('change', commit);
  document.getElementById('nudgeY').addEventListener('input', (e) => {
    applyTweak('oy', Number(e.target.value));
  });
  document.getElementById('nudgeY').addEventListener('change', commit);

  document.getElementById('upload').addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });
  // Drop or paste a photo anywhere on the page.
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });
  document.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) handleFiles(files);
  });

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const y = ((e.clientY - r.top) / r.height) * canvas.height;
    const geo = panelsFor(layoutById(state.layoutId), canvas.width, canvas.height);
    selectedPanel = -1;
    for (let i = geo.panels.length - 1; i >= 0; i--) {
      const p = geo.panels[i];
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
        selectedPanel = i;
        break;
      }
    }
    redraw();
  });

  document.getElementById('flipBtn').addEventListener('click', () => {
    if (selectedPanel < 0) { statusEl.textContent = 'Click a panel first, then Flip.'; return; }
    const t = state.tweaks[selectedPanel] ?? {};
    t.flip = !t.flip;
    state.tweaks[selectedPanel] = t;
    commit();
  });
  document.getElementById('prevPhotoBtn').addEventListener('click', () => stepPhoto(-1));
  document.getElementById('nextPhotoBtn').addEventListener('click', () => stepPhoto(1));
  document.getElementById('resetBtn').addEventListener('click', () => {
    state = defaultState();
    autoFill();
    selectedPanel = -1;
    commit();
    syncControls();
    statusEl.textContent = 'Reset to the default poster.';
  });
  document.getElementById('autofillBtn').addEventListener('click', () => {
    autoFill();
    commit();
    statusEl.textContent = 'Auto-filled by face quality — best face is the hero.';
  });
  document.getElementById('faceOverlayBtn').addEventListener('click', () => {
    faceOverlay = !faceOverlay;
    syncControls();
    redraw();
    statusEl.textContent = faceOverlay
      ? 'Face overlay on — green boxes are the detected faces, with their measured scores.'
      : 'Face overlay off.';
  });

  document.getElementById('exportBtn').addEventListener('click', async () => {
    const size = sizeById(state.sizeId);
    statusEl.textContent = `Exporting ${size.id}…`;
    const blob = await exportPosterPNG(state, images, size.w, size.h);
    downloadBlob(blob, `vice-heat-${size.id}.png`);
    statusEl.textContent = `Saved vice-heat-${size.id}.png (${size.w}×${size.h}).`;
  });
  document.getElementById('exportAllBtn').addEventListener('click', async () => {
    statusEl.textContent = 'Exporting all three sizes…';
    await exportAllSizes(state, images, SIZES, (s) => {
      statusEl.textContent = `Saved vice-heat-${s.id}.png.`;
    });
    statusEl.textContent = 'Saved all three sizes.';
  });
  document.getElementById('autoBtn').addEventListener('click', () => {
    const li = Math.floor(Math.random() * LAYOUTS.length);
    const gi = Math.floor(Math.random() * GRADES.length);
    const pi = Math.floor(Math.random() * TITLE_PRESETS.length);
    const p = TITLE_PRESETS[pi];
    state.layoutId = LAYOUTS[li].id;
    state.gradeId = GRADES[gi].id;
    state.title = p.title;
    state.subtitle = p.subtitle;
    state.tagline = p.tagline;
    state.quote = p.quote;
    state.source = p.source;
    autoFill();
    selectedPanel = -1;
    commit();
    syncControls();
    statusEl.textContent = `Auto Poster: ${LAYOUTS[li].name} + ${GRADES[gi].name} + “${p.title}”.`;
  });
  document.getElementById('undoBtn').addEventListener('click', () => {
    if (historyAt > 0) { historyAt--; restore(history[historyAt]); }
  });
  document.getElementById('redoBtn').addEventListener('click', () => {
    if (historyAt < history.length - 1) { historyAt++; restore(history[historyAt]); }
  });
}

function stepPhoto(dir) {
  if (selectedPanel < 0) { statusEl.textContent = 'Click a panel first, then pick its photo.'; return; }
  const chars = characterSamples().map((s) => s.id);
  const current = state.assignments[selectedPanel] ?? layoutById(state.layoutId).panels[selectedPanel].photo;
  const i = chars.indexOf(current);
  const next = chars[(i + dir + chars.length) % chars.length];
  state.assignments[selectedPanel] = next;
  const s = sampleById(next);
  statusEl.textContent = `Panel ${selectedPanel + 1} is now ${s.name} — ${s.role}.`;
  commit();
}

function applyTweak(key, value) {
  if (selectedPanel < 0) return;
  const t = state.tweaks[selectedPanel] ?? {};
  t[key] = value;
  state.tweaks[selectedPanel] = t;
  redraw();
}

async function start() {
  buildButtons();
  wireControls();
  if (scene) {
    const p = TITLE_PRESETS[scene.preset];
    state = defaultState(scene.preset);
    state.layoutId = scene.layout;
    state.gradeId = scene.grade;
    state.sizeId = scene.size;
    if (scene.mode === 'cover') document.body.classList.add('shot-cover');
    if (scene.faceOverlay) faceOverlay = true;
  }
  syncControls();
  await document.fonts.load('100px Anton');
  await document.fonts.load('100px "Bebas Neue"');
  await document.fonts.load('40px Pacifico');
  await document.fonts.load('40px Sacramento');
  await document.fonts.ready;
  await loadSamples();
  autoFill();
  updateStripBadges();
  commit();
  redraw();
  statusEl.textContent = 'Ready — Cast Mosaic + Sunset Gold. Click a panel to crop it, then export.';
  if (scene) markShotReady();
}

start();
