#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');

const [cmd = 'help', ...args] = process.argv.slice(2);

const help = `profile-scribe-harness

Usage:
  profile-scribe-harness help
  profile-scribe-harness workflow
  profile-scribe-harness paths
  profile-scribe-harness config:check
  profile-scribe-harness sync

Commands:
  workflow      Show the expected crawl -> history -> voice -> draft -> submit loop
  paths         Print harness and active project paths
  config:check  Validate this harness scaffold and parse JSON policy files
  sync          Link shared harness files into the active consumer project
`;

function runNode(rel, extraArgs = []) {
  const result = spawnSync(process.execPath, [join(PKG_ROOT, rel), ...extraArgs], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env
  });
  process.exit(result.status ?? 1);
}

switch (cmd) {
  case 'help':
  case '--help':
  case '-h':
    console.log(help);
    break;

  case 'workflow':
    console.log(`Profile Scribe harness workflow

1. Accept the user request, draft, topic, and source URLs.
2. Crawl every supplied URL and store source-backed extracts.
3. Search previous Profile Scribe posts for related topics and voice signals.
4. Build or update the user's voice profile from prior posts.
5. Draft a fresh post using the request, crawled sources, and voice profile.
6. Run duplicate, provenance, privacy, and style checks.
7. Stage the post back to Profile Scribe as a draft unless configured otherwise.
`);
    break;

  case 'paths':
    console.log(JSON.stringify({
      packageRoot: PKG_ROOT,
      projectRoot: process.env.PROFILE_SCRIBE_HARNESS_PROJECT || process.env.INIT_CWD || process.cwd(),
      profileScribeRoot: process.env.PROFILE_SCRIBE_ROOT || null,
      profileScribeApiUrl: process.env.PROFILE_SCRIBE_API_URL || null
    }, null, 2));
    break;

  case 'config:check':
    runNode('scripts/smoke-config.mjs', args);
    break;

  case 'sync':
    runNode('bin/sync.mjs', args);
    break;

  default:
    console.error(`Unknown command: ${cmd}\n`);
    console.error(help);
    process.exit(1);
}
