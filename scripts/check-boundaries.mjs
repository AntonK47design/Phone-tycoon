// Enforces architecture rules (PLAN §2): the simulation stays pure.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const rules = [
  { dir: 'src/sim', forbid: [/from ['"]three/, /from ['"]preact/, /from ['"]\.\.\/(\.\.\/)?(render|ui|platform|audio)\//, /\bdocument\./, /\bwindow\./, /Math\.random\(/, /Date\.now\(/] },
  { dir: 'src/data', forbid: [/from ['"]three/, /from ['"]preact/, /from ['"]\.\.\/(render|ui|platform|audio)\//] },
  { dir: 'src/render', forbid: [/from ['"]\.\.\/(\.\.\/)?ui\//, /from ['"]\.\.\/(\.\.\/)?platform\//, /\.dispatch\(/] },
];

let failed = 0;
for (const rule of rules) {
  for (const file of walk(rule.dir).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'))) {
    const src = readFileSync(file, 'utf8');
    for (const re of rule.forbid) {
      if (re.test(src)) {
        console.error(`✗ ${file}: forbidden pattern ${re}`);
        failed++;
      }
    }
  }
}
if (failed) process.exit(1);
console.log('✓ Architecture boundaries OK');
