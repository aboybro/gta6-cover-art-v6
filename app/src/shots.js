// Fixed scenes for screenshots: ?shot=cover shows the exported cover
// full-frame, ?shot=editor shows the app with a photo loaded, and
// ?shot=portrait / ?shot=square show the other post sizes. The scenes run
// through the same render the user exports, so a screenshot is the app's
// own drawing, never a mock-up. window.__shotReady is set once painted.

export function shotScene(query) {
  const shot = query.get('shot') ?? 'cover';
  if (shot === 'portrait') {
    return { mode: 'cover', size: '1080x1350', layout: 'cast-mosaic', grade: 'neon-night', preset: 2 };
  }
  if (shot === 'square') {
    return { mode: 'cover', size: '1080x1080', layout: 'six-grid', grade: 'heat-wave', preset: 4 };
  }
  if (shot === 'editor') {
    // The editor shot proves the pipeline: face boxes + scores on.
    return { mode: 'editor', size: '1920x1080', layout: 'cast-mosaic', grade: 'sunset-gold', preset: 0, faceOverlay: true };
  }
  return { mode: 'cover', size: '1920x1080', layout: 'cast-mosaic', grade: 'sunset-gold', preset: 0 };
}

export function markShotReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
