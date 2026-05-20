#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'));

const args = process.argv.slice(2);
const force = args.includes('--force');
const help = args.includes('--help') || args.includes('-h');
const positional = args.filter((arg) => !arg.startsWith('--'));

if (help || positional.length === 0) {
  console.log(`create-profile-scribe-harness

Usage:
  npm exec --package @agent-pattern-labs/profile-scribe-rig -- create-profile-scribe-harness <dir> [--force]

Examples:
  npm exec --package @agent-pattern-labs/profile-scribe-rig -- create-profile-scribe-harness my-post-workspace
  npm exec --package @agent-pattern-labs/profile-scribe-rig -- create-profile-scribe-harness . --force

After scaffolding:
  cd <dir>
  npm install
  edit config/profile-scribe.json
  npm run sync
`);
  process.exit(help ? 0 : 1);
}

const targetDir = resolve(positional[0]);
const projectName = basename(targetDir);

if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

function write(rel, content, { overwrite = force } = {}) {
  const abs = join(targetDir, rel);
  if (existsSync(abs) && !overwrite) {
    console.log(`skip: ${rel} exists`);
    return;
  }
  const parent = dirname(abs);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(abs, content, 'utf8');
  console.log(`create: ${rel}`);
}

function touch(rel) {
  write(rel, '', { overwrite: false });
}

const consumerPkg = {
  name: projectName,
  version: '0.1.0',
  private: true,
  type: 'module',
  scripts: {
    sync: 'profile-scribe-harness sync',
    'config:check': 'profile-scribe-harness config:check',
    workflow: 'profile-scribe-harness workflow'
  },
  dependencies: {
    [pkg.name]: `^${pkg.version}`
  },
  engines: {
    node: '>=20.6.0'
  }
};

write('package.json', `${JSON.stringify(consumerPkg, null, 2)}\n`);

write('config/profile-scribe.json', `${JSON.stringify({
  profileScribe: {
    root: '',
    apiUrl: '',
    mcpCommand: 'profilescribe-mcp',
    mcpUrl: 'https://profilescribe.com/api/mcp',
    apiTokenEnv: 'PROFILE_SCRIBE_API_TOKEN',
    agentTokenEnv: 'PROFILESCRIBE_AGENT_TOKEN',
    submitMode: 'draft'
  },
  crawler: {
    timeoutMs: 20000,
    maxBytes: 2000000,
    userAgent: 'profile-scribe-rig'
  },
  retrieval: {
    priorPostLimit: 100,
    relatedPostLimit: 12
  },
  posting: {
    defaultVisibility: 'draft',
    requireReview: true
  }
}, null, 2)}\n`);

write('README.md', `# ${projectName}

Personal Profile Scribe harness workspace.

## Setup

1. Run \`npm install\`.
2. Install \`profilescribe-mcp\`:
   \`go install github.com/razroo/profilescribe-mcp/cmd/profilescribe-mcp@latest\`.
3. Create a scoped ProfileScribe token from \`/agents\` with \`mcp:tools\`,
   \`read:profile\`, \`read:sources\`, \`observe:sources\`, and \`write:drafts\`.
4. Export \`PROFILESCRIBE_AGENT_TOKEN=psagt_...\`.
5. Edit \`config/profile-scribe.json\` or set \`PROFILE_SCRIBE_ROOT\` /
   \`PROFILE_SCRIBE_API_URL\`.
6. Put request notes in \`data/request.md\` or invoke the harness from your
   agent runtime with "create a post". URLs are optional; the harness should
   read ProfileScribe profile data, approved sources, source activity, and prior
   timeline context before deciding what to publish.

Private data, crawled sources, previous posts, generated drafts, and submission
records should stay in this consumer project, not in the harness package.
`);

write('AGENTS.md', `# Local Profile Scribe Harness Overrides

This consumer project uses the shared harness instructions from
\`Agents.harness.md\`.

Local priorities:

- Keep private prior posts, crawl outputs, drafts, and submission receipts out
  of public commits.
- Submit generated posts as drafts unless the user explicitly asks to publish.
- Prefer local Profile Scribe config from \`config/profile-scribe.json\`, then
  environment variables.
`);

write('.gitignore', `node_modules/
Agents.harness.md
modes
templates
models.yaml
iso
.state-trace/
.profile-scribe-runs/
.profile-scribe-cache/
.profile-scribe-ledger/
.profile-scribe-index.json
.profile-scribe-facts.json
.profile-scribe-lineage.json
.profile-scribe-redacted/
data/crawls/
data/prior-posts/
data/voice-profile.json
data/drafts/
reports/
*.log
`);

write('data/request.md', `# Request

Topic:

URLs:

Notes:
`);
touch('data/crawls/.gitkeep');
touch('data/prior-posts/.gitkeep');
touch('data/drafts/.gitkeep');
touch('reports/.gitkeep');

console.log(`\nScaffolded ${projectName} in ${targetDir}`);
console.log('\nNext commands:');
console.log(`  cd ${targetDir}`);
console.log('  npm install');
console.log('  npm run sync');
