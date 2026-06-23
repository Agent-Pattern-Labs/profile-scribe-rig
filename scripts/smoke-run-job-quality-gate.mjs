#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'profilescribe-rig-quality-gate-'));
const createPostCalls = [];

const source = {
  id: 'src-makebind-quality',
  kind: 'website',
  label: 'MakeBind',
  url: '',
  status: 'monitoring',
  trustLevel: 'high'
};

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/makebind') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<title>MakeBind</title><meta name="description" content="MakeBind helps builders turn source material into working software context."><main>MakeBind release notes describe source-to-context workflows for software builders.</main>');
    return;
  }

  let raw = '';
  for await (const chunk of request) raw += chunk;
  const envelope = JSON.parse(raw || '{}');
  const name = envelope?.params?.name || '';
  const args = envelope?.params?.arguments || {};
  let result;

  if (name === 'read_profile') {
    result = {
      identity: {
        fullName: 'Abraham Greenman',
        headline: 'Builder of practical AI systems'
      }
    };
  } else if (name === 'read_sources') {
    result = [source];
  } else if (name === 'read_source_evidence') {
    result = [{
      sourceId: source.id,
      sourceLabel: source.label,
      sourceUrl: source.url,
      sourceKind: source.kind,
      observationId: 'obs-makebind',
      url: source.url,
      kind: 'page',
      title: 'MakeBind',
      summary: 'MakeBind helps builders turn source material into working software context.',
      changeType: 'changed',
      observedAt: '2026-06-13T12:00:00Z'
    }];
  } else if (name === 'search_timeline_posts') {
    result = { query: args.query || '', results: [] };
  } else if (name === 'discover_timeline_posts') {
    result = { posts: [] };
  } else if (name === 'create_source_backed_timeline_post') {
    createPostCalls.push(args);
    result = { draft: { id: 'draft-should-not-publish' } };
  } else {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { message: `unexpected tool ${name}` } }));
    return;
  }

  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({
    jsonrpc: '2.0',
    id: envelope.id || 1,
    result: {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    }
  }));
});

try {
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  source.url = `http://127.0.0.1:${port}/makebind`;

  const jobFile = join(tmp, 'job.json');
  const drafterFile = join(tmp, 'drafter.mjs');

  writeFileSync(jobFile, `${JSON.stringify({
    id: 'job-quality-gate-smoke',
    kind: 'draft_post',
    payload: {
      topic: 'create one more timeline post about MakeBind',
      maxSources: 1
    }
  })}\n`, 'utf8');
  writeFileSync(drafterFile, `
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  JSON.parse(raw || '{}');
  process.stdout.write(JSON.stringify({
    topic: 'Source spotlight: MakeBind',
    body: 'I\\'m highlighting MakeBind because it gives people a concrete way to inspect the work.\\n\\nSpecifically, We turn source material into working software context. $1,200 one-time. Visible headings include MakeBind, Build Context., Ship.',
    abstracts: ['MakeBind turns source material into working software context.'],
    tone: 'professional',
    sourceIds: ['${source.id}']
  }));
});
`, 'utf8');

  const run = await spawnRun(process.execPath, [join(root, 'bin/run-job.mjs'), '--job-file', jobFile], {
    cwd: root,
    env: {
      ...process.env,
      OPENROUTER_API_KEY: '',
      PROFILESCRIBE_AGENT_TOKEN: 'test-token',
      PROFILESCRIBE_MCP_URL: `http://127.0.0.1:${port}`,
      PROFILESCRIBE_RIG_DRAFTER_COMMAND: `"${process.execPath}" "${drafterFile}"`
    }
  });

  if (run.code !== 0) {
    console.error(run.stdout);
    console.error(run.stderr);
    throw new Error(`run-job exited with status ${run.code}`);
  }

  const receipt = JSON.parse(run.stdout || '{}');
  if (receipt.status !== 'skipped') {
    throw new Error(`expected skipped receipt, got ${JSON.stringify(receipt)}`);
  }
  if (!/quality gate/i.test(receipt.summary || '')) {
    throw new Error(`expected quality gate summary, got ${JSON.stringify(receipt)}`);
  }
  if (!/placeholder language/i.test(receipt.metadata?.qualityCheck?.reason || '') ||
      !/visible headings include/i.test(receipt.metadata?.qualityCheck?.reason || '')) {
    throw new Error(`expected placeholder-language quality reason, got ${JSON.stringify(receipt.metadata?.qualityCheck)}`);
  }
  if (createPostCalls.length !== 0) {
    throw new Error(`weak draft should not call create_source_backed_timeline_post: ${JSON.stringify(createPostCalls)}`);
  }

  writeFileSync(drafterFile, `
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  JSON.parse(raw || '{}');
  process.stdout.write(JSON.stringify({
    topic: 'MakeBind source-to-context workflow',
    body: 'MakeBind now states its source-to-context workflow clearly: it helps builders turn source material into working software context.',
    abstracts: ['MakeBind helps builders turn source material into working software context.'],
    tone: 'professional',
    sourceIds: ['${source.id}'],
    platformVariants: {
      threads: 'Specifically, We turn source material into working software context.'
    }
  }));
});
`, 'utf8');

  const variantRun = await spawnRun(process.execPath, [join(root, 'bin/run-job.mjs'), '--job-file', jobFile], {
    cwd: root,
    env: {
      ...process.env,
      OPENROUTER_API_KEY: '',
      PROFILESCRIBE_AGENT_TOKEN: 'test-token',
      PROFILESCRIBE_MCP_URL: `http://127.0.0.1:${port}`,
      PROFILESCRIBE_RIG_DRAFTER_COMMAND: `"${process.execPath}" "${drafterFile}"`
    }
  });
  if (variantRun.code !== 0) {
    console.error(variantRun.stdout);
    console.error(variantRun.stderr);
    throw new Error(`variant run-job exited with status ${variantRun.code}`);
  }
  const variantReceipt = JSON.parse(variantRun.stdout || '{}');
  if (variantReceipt.status !== 'skipped') {
    throw new Error(`expected variant skipped receipt, got ${JSON.stringify(variantReceipt)}`);
  }
  if (!/platform variant/i.test(variantReceipt.metadata?.qualityCheck?.reason || '')) {
    throw new Error(`expected platform-variant quality reason, got ${JSON.stringify(variantReceipt.metadata?.qualityCheck)}`);
  }
  if (createPostCalls.length !== 0) {
    throw new Error(`bad platform variant should not call create_source_backed_timeline_post: ${JSON.stringify(createPostCalls)}`);
  }

  console.log('profile-scribe-rig quality gate smoke check passed.');
} finally {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}

function spawnRun(command, args, options) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      resolveRun({ code, stdout, stderr });
    });
  });
}
