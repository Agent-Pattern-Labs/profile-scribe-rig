#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);

const requiredFiles = [
  'package.json',
  'Agents.md',
  'README.md',
  'models.yaml',
  'bin/profile-scribe-harness.mjs',
  'bin/create-profile-scribe-harness.mjs',
  'bin/run-job.mjs',
  'bin/sync.mjs',
  'config/profile-scribe.example.json',
  'iso/instructions.md',
  'iso/instructions.opencode.md',
  'iso/mcp.json',
  'iso/config.json',
  'iso/commands/profile-scribe.md',
  'iso/agents/general-free.md',
  'iso/agents/general-paid.md',
  'iso/agents/glm-minimal.md',
  'modes/_shared.md',
  'modes/compose.md',
  'modes/crawl.md',
  'modes/history.md',
  'modes/voice.md',
  'modes/submit.md',
  'modes/reference-profile-scribe.md',
  'templates/states.yml',
  'templates/contracts.json',
  'templates/context.json',
  'templates/capabilities.json',
  'templates/migrations.json',
  'templates/redact.json',
  'docs/architecture.md',
  'docs/profilescribe-mcp.md'
];

const jsonFiles = [
  'package.json',
  'config/profile-scribe.example.json',
  'iso/mcp.json',
  'iso/config.json',
  'templates/contracts.json',
  'templates/context.json',
  'templates/capabilities.json',
  'templates/migrations.json',
  'templates/redact.json'
];

const executableFiles = [
  'bin/profile-scribe-harness.mjs',
  'bin/create-profile-scribe-harness.mjs',
  'bin/run-job.mjs',
  'bin/sync.mjs',
  'scripts/smoke-config.mjs'
];

let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

for (const rel of requiredFiles) {
  if (!existsSync(join(root, rel))) fail(`missing ${rel}`);
}

for (const rel of jsonFiles) {
  const path = join(root, rel);
  if (!existsSync(path)) continue;
  try {
    JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${rel} is not valid JSON: ${error.message}`);
  }
}

for (const rel of executableFiles) {
  const path = join(root, rel);
  if (!existsSync(path)) continue;
  const mode = statSync(path).mode;
  if ((mode & 0o111) === 0) fail(`${rel} is not executable`);
}

const agents = existsSync(join(root, 'Agents.md'))
  ? readFileSync(join(root, 'Agents.md'), 'utf8')
  : '';
if (!agents.includes('/Users/charlie/AgentPatternLabs/Agent-Skills')) {
  fail('Agents.md does not reference Agent-Skills construction pattern');
}

if (failures > 0) {
  console.error(`\n${failures} smoke check failure(s).`);
  process.exit(1);
}

console.log(`profile-scribe-rig smoke checks passed (${requiredFiles.length} files checked).`);
