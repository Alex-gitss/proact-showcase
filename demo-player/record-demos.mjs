/**
 * Record all 4 ProAct demos as WebM videos using Playwright.
 *
 * Prerequisites:
 *   npm init -y && npm install playwright
 *   npx playwright install chromium
 *
 * Usage:
 *   1. Start local server:  python3 -m http.server 4173 --bind 127.0.0.1 --directory ..
 *   2. Run this script:     node record-demos.mjs
 *
 * Output:  ../assets/media/demo-*.webm (crop to the 1280x800 content frame and convert to mp4 with ffmpeg below)
 *
 * ffmpeg conversion (run after recording):
 *   for f in ../assets/media/demo-*.webm; do
 *     ffmpeg -i "$f" -vf "crop=1280:800:72:0" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -an "${f%.webm}.mp4"
 *   done
 */

import { chromium } from 'playwright';
import { rename } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '../assets/media');

const cases = [
  { id: 'project_product_push_01', out: 'demo-project-kickoff' },
  { id: 'release_rollout_observation_05', out: 'demo-rollout-signal' },
  { id: 'case_eligibility_document_gap_02', out: 'demo-document-gap' },
  { id: 'farm_harvest_traceability_handoff_04', out: 'demo-traceability-handoff' },
];

const BASE = 'http://127.0.0.1:4173/demo-player/player.html';
const VIEWPORT = { width: 1424, height: 800 };
const WAIT_MS = 68_000;

async function recordCase({ id, out }) {
  console.log(`Recording: ${id} → ${out}.webm`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: outputDir, size: VIEWPORT },
  });

  const page = await context.newPage();
  await page.goto(`${BASE}?mode=video&case=${id}&autoplay=1`, {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForTimeout(WAIT_MS);

  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const tmpPath = await video.path();
    const finalPath = resolve(outputDir, `${out}.webm`);
    await rename(tmpPath, finalPath);
    console.log(`  Saved: ${finalPath}`);
  }
}

console.log('ProAct Demo Recorder');
console.log('====================');
console.log(`Output directory: ${outputDir}`);
console.log(`Viewport: ${VIEWPORT.width}x${VIEWPORT.height}`);
console.log(`Duration per demo: ${WAIT_MS / 1000}s\n`);

for (const c of cases) {
  await recordCase(c);
}

console.log('\nDone. Crop the shell and convert to MP4:');
console.log('  for f in ../assets/media/demo-*.webm; do');
console.log('    ffmpeg -i "$f" -vf "crop=1280:800:72:0" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -an "${f%.webm}.mp4"');
console.log('  done');
