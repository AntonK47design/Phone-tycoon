// Build gate (PLAN §5): fails when CrazyGames limits are exceeded.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const LIMITS = {
  initialHard: 20 * 1024 * 1024,
  initialTarget: 10 * 1024 * 1024,
  total: 250 * 1024 * 1024,
  files: 1500,
};

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (!existsSync(DIST)) {
  console.error('dist/ missing – run vite build first');
  process.exit(1);
}

const files = walk(DIST).filter((f) => !f.includes(`${DIST}/.vite`));
const total = files.reduce((a, f) => a + statSync(f).size, 0);

// Initial set: index.html + entry chunk + its static imports and CSS (from the Vite manifest).
const manifest = JSON.parse(readFileSync(join(DIST, '.vite/manifest.json'), 'utf8'));
const initial = new Set([join(DIST, 'index.html')]);
const visit = (key) => {
  const chunk = manifest[key];
  if (!chunk) return;
  const file = join(DIST, chunk.file);
  if (initial.has(file) && key !== 'index.html') return;
  initial.add(file);
  (chunk.css ?? []).forEach((c) => initial.add(join(DIST, c)));
  (chunk.assets ?? []).forEach((a) => initial.add(join(DIST, a)));
  (chunk.imports ?? []).forEach(visit);
};
Object.entries(manifest).filter(([, c]) => c.isEntry).forEach(([k]) => visit(k));
const initialBytes = [...initial].reduce((a, f) => a + (existsSync(f) ? statSync(f).size : 0), 0);
const initialGz = [...initial].reduce((a, f) => a + (existsSync(f) ? gzipSync(readFileSync(f)).length : 0), 0);

const mb = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;
const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
console.log('\nBuild size report');
console.log('─────────────────');
for (const f of [...initial]) console.log(`  initial  ${relative(DIST, f).padEnd(40)} ${kb(statSync(f).size)}`);
console.log(`  Initial download: ${mb(initialBytes)} (gzip ${mb(initialGz)}) – target ≤ ${mb(LIMITS.initialTarget)}, hard ≤ ${mb(LIMITS.initialHard)}`);
console.log(`  Total:            ${mb(total)} – limit ${mb(LIMITS.total)}`);
console.log(`  Files:            ${files.length} – limit ${LIMITS.files}`);

const errors = [];
if (initialBytes > LIMITS.initialHard) errors.push('initial download exceeds 20 MB');
if (total > LIMITS.total) errors.push('total size exceeds 250 MB');
if (files.length > LIMITS.files) errors.push('more than 1500 files');
if (initialBytes > LIMITS.initialTarget) console.warn('  ⚠ initial download above the 10 MB target');
const devLeak = files.filter((f) => f.endsWith('.js')).some((f) => readFileSync(f, 'utf8').includes('DEV {'));
if (devLeak) errors.push('debug panel leaked into the production build');

if (errors.length) {
  console.error(`\n✗ Size check failed: ${errors.join(', ')}`);
  process.exit(1);
}
console.log('\n✓ Size check passed\n');
