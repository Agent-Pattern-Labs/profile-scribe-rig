#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';

import {
  opportunityCommercialDiscoveryCapabilities,
  validateOpportunityCommercialDiscoveryNoTargetEnvelope
} from './opportunity-tournament.mjs';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

function canonicalJSON(value) {
  if (Array.isArray(value)) return value.map(canonicalJSON);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [
      key,
      canonicalJSON(value[key])
    ]));
  }
  return value;
}

async function readJSON(path) {
  const text = path === '-'
    ? await new Promise((resolve, reject) => {
        let value = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
          value += chunk;
        });
        process.stdin.on('end', () => resolve(value));
        process.stdin.on('error', reject);
      })
    : await readFile(path, 'utf8');
  return JSON.parse(text);
}

const rigManifest = opportunityCommercialDiscoveryCapabilities();
if (process.argv.includes('--print-rig-manifest')) {
  process.stdout.write(`${JSON.stringify(rigManifest)}\n`);
  process.exit(0);
}

const appManifestPath = argumentValue('--app-manifest');
const noTargetEnvelopePath = argumentValue('--app-no-target-envelope');
if (!appManifestPath || !noTargetEnvelopePath ||
    (appManifestPath === '-' && noTargetEnvelopePath === '-')) {
  process.stderr.write(
    'capability validation requires --app-manifest and --app-no-target-envelope\n'
  );
  process.exit(2);
}

try {
  const appManifest = await readJSON(appManifestPath);
  if (JSON.stringify(canonicalJSON(appManifest)) !==
      JSON.stringify(canonicalJSON(rigManifest))) {
    throw new Error('manifest_mismatch');
  }
  await validateOpportunityCommercialDiscoveryNoTargetEnvelope(
    await readJSON(noTargetEnvelopePath)
  );
  process.stdout.write(
    '{"valid":true,"contractVersion":"opportunity_commercial_discovery_capabilities_v1","noTargetProbe":true}\n'
  );
} catch (error) {
  const code = error?.message === 'manifest_mismatch'
    ? 'manifest_mismatch'
    : 'no_target_probe_mismatch';
  process.stderr.write(`capability validation failed: ${code}\n`);
  process.exit(1);
}
