// PNG export: renders the poster off-screen at the post size and hands
// the browser a file to save. Nothing is uploaded anywhere — the pixels
// never leave the machine.

import { renderPoster } from './render.js';

/**
 * Renders the poster at w x h and resolves to a PNG Blob. The caller
 * decides the size: 1920x1080, 1080x1350 or 1080x1080.
 */
export function exportPosterPNG(state, images, w, h) {
  return new Promise((resolve) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    renderPoster(ctx, state, images, w, h);
    cv.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/** Downloads a Blob as a file with the given name. */
export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/**
 * Renders all three post sizes at once (the "Export all" button) and
 * downloads them one after another.
 */
export async function exportAllSizes(state, images, sizes, onEach) {
  for (const size of sizes) {
    const blob = await exportPosterPNG(state, images, size.w, size.h);
    downloadBlob(blob, `vice-heat-${size.id}.png`);
    if (onEach) onEach(size);
    await new Promise((r) => setTimeout(r, 250));
  }
}
