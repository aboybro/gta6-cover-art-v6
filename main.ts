// Vice Heat v6 — the entry program (Node 22, standard library only).
// It hands the app in: copies app/ and screenshots/ from beside this
// file to the output directory and writes /output/dossier.json with the
// vendored make.fun library, exactly as the kit's starter does. Outside
// the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The app itself is the face-pipeline build: five real modules under
// app/src/ (face-detect, face-score, face-anchor, face-grade, face-rank)
// plus the Face Lab and the face overlay in the editor. Every panel is
// exposed and sharpened for its face before the colour grade lands
// (face-grade.js, called from render.js). The dossier the library
// computes from the copied files is what the judge reads, so the
// pipeline modules and FACE-PIPELINE.md travel with the entry.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The program is deterministic by construction: it copies files and
// writes the dossier the library computes from them, so two runs write
// the same bytes — and the face pipeline itself carries no randomness
// (fixed grids, fixed thresholds, fixed kernels), so two renders of the
// same poster are byte-identical too. Verify with
// MAKEFUN_OUTPUT_DIR=out1/out2 + diff -r.
// The library enforces the entry's own caps: at most 4 screenshots,
// each at most 256 KiB; at most 993 files in app/ and 48 MiB of app
// files in all; no path under app/ over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
