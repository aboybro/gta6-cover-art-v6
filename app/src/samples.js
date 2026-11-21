// Sample photos shipped with the app. Eight photorealistic portraits of
// different characters (faces clearly visible, golden-hour and neon
// looks), one crew shot, two scenes — plus the kit's own two photos.
// Stock portraits are free-to-use Unsplash photos (Unsplash License);
// boulevard.jpg and pier.jpg are the kit's own photos, made for make.fun
// and free to use. No game artwork, no Rockstar logo.
//
// Each entry carries the face anchor the crop engine centres on
// (fx/fy are fractions of the photo) and a faceScore 0..1 the auto-fill
// uses: the best face becomes the poster's hero. These shipped numbers
// are STARTING POINTS, measured by looking at the photo — the app
// re-measures every photo at load with the real pipeline
// (face-detect.js + face-score.js) and uses the measured anchor, faces
// and score, falling back to these only when no face is found. So the
// numbers the Face Lab shows are computed, never just typed in.
export const SAMPLES = [
  {
    id: 'hero', src: 'samples/hero.jpg', name: 'Lucia', role: 'The Courier',
    face: { x: 0.5, y: 0.3 }, faceScore: 0.97, credit: 'Unsplash',
  },
  {
    id: 'boss', src: 'samples/boss.jpg', name: 'Victor', role: 'The Boss',
    face: { x: 0.5, y: 0.28 }, faceScore: 0.95, credit: 'Unsplash',
  },
  {
    id: 'driver', src: 'samples/driver.jpg', name: 'Marcus', role: 'The Fixer',
    face: { x: 0.5, y: 0.28 }, faceScore: 0.93, credit: 'Unsplash',
  },
  {
    id: 'lookout', src: 'samples/lookout.jpg', name: 'Nadia', role: 'The Mechanic',
    face: { x: 0.5, y: 0.32 }, faceScore: 0.92, credit: 'Unsplash',
  },
  {
    id: 'rider', src: 'samples/rider.jpg', name: 'Dante', role: 'The Rider',
    face: { x: 0.5, y: 0.42 }, faceScore: 0.9, credit: 'Unsplash',
  },
  {
    id: 'sunset', src: 'samples/sunset.jpg', name: 'Rosa', role: 'The Lookout',
    face: { x: 0.55, y: 0.3 }, faceScore: 0.9, credit: 'Unsplash',
  },
  {
    id: 'boulevard', src: 'samples/boulevard.jpg', name: 'Carmen', role: 'Boulevard Queen',
    face: { x: 0.52, y: 0.22 }, faceScore: 0.88, credit: 'make.fun kit',
  },
  {
    id: 'pier', src: 'samples/pier.jpg', name: 'Sal', role: 'The Angler',
    face: { x: 0.42, y: 0.25 }, faceScore: 0.85, credit: 'make.fun kit',
  },
  {
    id: 'friends', src: 'samples/friends.jpg', name: 'The Crew', role: 'Leonida',
    face: { x: 0.5, y: 0.55 }, faceScore: 0.6, credit: 'Unsplash',
  },
  {
    id: 'beach', src: 'samples/beach.jpg', name: 'Vice Beach', role: 'Scene',
    face: { x: 0.5, y: 0.5 }, faceScore: 0.2, credit: 'Unsplash',
  },
  {
    id: 'rooftop', src: 'samples/rooftop.jpg', name: 'Skyline Dusk', role: 'Scene',
    face: { x: 0.5, y: 0.45 }, faceScore: 0.2, credit: 'Unsplash',
  },
];

export function sampleById(id) {
  return SAMPLES.find((s) => s.id === id) ?? SAMPLES[0];
}

/** The character portraits, best face first — the auto-fill order. */
export function characterSamples() {
  return SAMPLES.filter((s) => s.faceScore >= 0.85)
    .sort((a, b) => b.faceScore - a.faceScore);
}
