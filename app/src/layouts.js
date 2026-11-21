// The three layouts. Every rect is a fraction of the poster (x, y, w, h
// in 0..1), so one layout works for landscape, portrait and square
// posters. A layout names a background scene, its panels (each with a
// sample photo and a cast tag), and where the title sits. The top 5% of
// every poster is the review top bar, so no panel starts above y 0.06.
// In Cast Mosaic the first panel is the pop-out: it overflows its frame
// slightly, with a white cut-out outline and a hard shadow, so the best
// face reads as the poster's hero. panelsFor() turns fractions into pixels.

export const LAYOUTS = [
  {
    id: 'cast-mosaic',
    name: 'Cast Mosaic',
    bg: 'beach',
    panels: [
      { x: 0.02, y: 0.06, w: 0.46, h: 0.84, photo: 'hero', tag: null, popout: true },
      { x: 0.5, y: 0.06, w: 0.48, h: 0.26, photo: 'boss', tag: 'Victor' },
      { x: 0.5, y: 0.34, w: 0.48, h: 0.26, photo: 'driver', tag: 'Marcus' },
      { x: 0.5, y: 0.62, w: 0.48, h: 0.26, photo: 'lookout', tag: 'Nadia' },
    ],
    hero: null,
    title: { x: 0.03, y: 0.74, align: 'left', scale: 0.8 },
    seal: { x: 0.93, y: 0.14 },
  },
  {
    id: 'diagonal-strips',
    name: 'Diagonal Strips',
    bg: 'rooftop',
    panels: [
      { x: 0.02, y: 0.08, w: 0.3, h: 0.8, photo: 'hero', tag: 'Lucia', slant: 0.03 },
      { x: 0.35, y: 0.08, w: 0.3, h: 0.8, photo: 'boss', tag: 'Victor', slant: 0.03 },
      { x: 0.68, y: 0.08, w: 0.3, h: 0.8, photo: 'sunset', tag: 'Rosa', slant: 0.03 },
    ],
    hero: null,
    title: { x: 0.5, y: 0.42, align: 'center', scale: 0.9 },
    seal: { x: 0.93, y: 0.12 },
  },
  {
    id: 'six-grid',
    name: 'Six Grid',
    bg: 'beach',
    panels: [
      { x: 0.02, y: 0.06, w: 0.313, h: 0.38, photo: 'hero', tag: 'Lucia' },
      { x: 0.343, y: 0.06, w: 0.313, h: 0.38, photo: 'boss', tag: 'Victor' },
      { x: 0.666, y: 0.06, w: 0.313, h: 0.38, photo: 'driver', tag: 'Marcus' },
      { x: 0.02, y: 0.46, w: 0.313, h: 0.38, photo: 'sunset', tag: 'Rosa' },
      { x: 0.343, y: 0.46, w: 0.313, h: 0.38, photo: 'rider', tag: 'Dante' },
      { x: 0.666, y: 0.46, w: 0.313, h: 0.38, photo: 'friends', tag: 'The Crew' },
    ],
    hero: null,
    title: { x: 0.5, y: 0.44, align: 'center', scale: 0.62 },
    seal: { x: 0.93, y: 0.1 },
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/** Turns a layout's fractions into pixel rects for a poster of W x H. */
export function panelsFor(layout, W, H) {
  const rect = (p) => ({
    x: p.x * W,
    y: p.y * H,
    w: p.w * W,
    h: p.h * H,
    photo: p.photo,
    tag: p.tag,
    slant: (p.slant ?? 0) * W,
    popout: p.popout ?? false,
  });
  return {
    bg: layout.bg,
    panels: layout.panels.map(rect),
    hero: null,
    title: { x: layout.title.x * W, y: layout.title.y * H, align: layout.title.align, scale: layout.title.scale },
    seal: { x: layout.seal.x * W, y: layout.seal.y * H, r: Math.min(W, H) * 0.045 },
  };
}
