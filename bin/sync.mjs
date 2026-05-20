#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, symlinkSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');
const PROJECT_DIR = process.env.INIT_CWD || process.env.PROFILE_SCRIBE_HARNESS_PROJECT || process.cwd();

if (PROJECT_DIR === PKG_ROOT || isHarnessRoot(PROJECT_DIR)) {
  console.log('profile-scribe-harness sync: skipping inside harness repo.');
  process.exit(0);
}

const links = [
  { src: 'Agents.md', dst: 'Agents.harness.md' },
  { src: 'iso', dst: 'iso' },
  { src: 'modes', dst: 'modes' },
  { src: 'templates', dst: 'templates' },
  { src: 'models.yaml', dst: 'models.yaml' },
  { src: 'config/profile-scribe.example.json', dst: 'config/profile-scribe.example.json' },
  { src: 'docs/architecture.md', dst: 'docs/profile-scribe-harness-architecture.md' },
  { src: 'batch/README.md', dst: 'batch/README.md' }
];

let created = 0;
let skipped = 0;
let warned = 0;

for (const { src, dst } of links) {
  const absSrc = join(PKG_ROOT, src);
  const absDst = join(PROJECT_DIR, dst);

  if (!existsSync(absSrc)) {
    console.warn(`warn: missing harness source ${src}`);
    warned++;
    continue;
  }

  const parent = dirname(absDst);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });

  let stat = null;
  try {
    stat = lstatSync(absDst);
  } catch {
    stat = null;
  }

  if (stat) {
    if (stat.isSymbolicLink()) {
      const current = readlinkSync(absDst);
      const expected = relative(dirname(absDst), absSrc);
      if (current === expected || resolve(dirname(absDst), current) === absSrc) {
        skipped++;
        continue;
      }
      console.warn(`warn: ${dst} points elsewhere (${current}); leaving it alone`);
      warned++;
      continue;
    }

    console.warn(`warn: ${dst} exists as a real file or directory; leaving it alone`);
    warned++;
    continue;
  }

  const relSrc = relative(dirname(absDst), absSrc);
  const type = lstatSync(absSrc).isDirectory() ? 'dir' : 'file';
  symlinkSync(relSrc, absDst, type);
  console.log(`linked: ${dst} -> ${relSrc}`);
  created++;
}

console.log(`profile-scribe-harness sync: ${created} created, ${skipped} up-to-date, ${warned} warnings`);

function isHarnessRoot(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.name === '@agent-pattern-labs/profile-scribe-rig' && resolve(dir) === PKG_ROOT;
  } catch {
    return false;
  }
}
