// Cast ranking: the auto-fill order, computed from the measured face
// scores — best face to the hero panel, the rest by quality, the
// weakest left out when there are more photos than panels. The ranking
// is the same list the editor's Face Lab shows, so what the user sees
// is exactly what the auto-fill does. Deterministic: ties break by
// photo id, so the same cast always fills the same way.

import { heroFit } from './face-score.js';

/**
 * Ranks cast entries for a poster. `entries` is [{ id, faceScore,
 * breakdown, faces }] (faces = detectFaces() boxes, may be empty).
 * `heroAspect` is the hero panel's w/h. Returns the entries sorted
 * best-first, each with { id, score, label, heroFit, faces, breakdown,
 * rank }.
 */
export function rankCast(entries, heroAspect = 1.6) {
  const ranked = entries
    .map((e) => {
      const face = e.faces?.[0] ?? null;
      return {
        id: e.id,
        score: e.faceScore ?? 0.5,
        label: e.breakdown?.label ?? 'Usable',
        heroFit: face ? heroFit(face, heroAspect) : 0.5,
        faces: e.faces ?? [],
        breakdown: e.breakdown ?? null,
      };
    })
    .sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : 1));
  ranked.forEach((r, i) => { r.rank = i + 1; });
  return ranked;
}

/**
 * Fills `panelCount` panels from the ranked cast. Faces first
 * (score >= 0.75), then the rest, cycling if there are fewer photos
 * than panels. Returns { assignments, leftOut }: assignments maps
 * panel index -> photo id, leftOut lists the ranked ids that did not
 * get a panel (the weakest first).
 */
export function autoFillAssignments(panelCount, ranked) {
  const faces = ranked.filter((r) => r.score >= 0.75);
  const rest = ranked.filter((r) => r.score < 0.75);
  const order = [...faces, ...rest];
  const assignments = {};
  for (let i = 0; i < panelCount; i++) {
    assignments[i] = order[i % order.length].id;
  }
  const used = new Set(Object.values(assignments));
  const leftOut = ranked.filter((r) => !used.has(r.id)).map((r) => r.id);
  return { assignments, leftOut };
}
