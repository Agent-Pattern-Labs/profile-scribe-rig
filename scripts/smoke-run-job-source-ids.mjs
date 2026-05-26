#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'profilescribe-rig-source-ids-'));
const fullSourceID = 'src-365b099c-60f4-43fc-8298-282a50eaad27';
const truncatedSourceID = 'src-365b099c';
const createPostCalls = [];

const sources = [
  {
    id: fullSourceID,
    kind: 'website',
    label: 'Razroo Projects',
    url: 'https://razroo.com/projects',
    status: 'monitoring',
    trustLevel: 'high'
  }
];

const server = createServer(async (request, response) => {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const envelope = JSON.parse(raw || '{}');
  const name = envelope?.params?.name || '';
  const args = envelope?.params?.arguments || {};
  let result;

  if (name === 'read_profile') {
    result = { identity: { fullName: 'Abraham Greenman', headline: 'Builder' } };
  } else if (name === 'read_sources') {
    result = sources;
  } else if (name === 'search_timeline_posts') {
    result = { query: args.query || '', results: [] };
  } else if (name === 'create_source_backed_timeline_post') {
    createPostCalls.push(args);
    result = { draft: { id: 'draft-source-id-smoke' } };
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
  const jobFile = join(tmp, 'job.json');
  const drafterFile = join(tmp, 'drafter.mjs');

  writeFileSync(jobFile, `${JSON.stringify({
    id: 'job-source-id-smoke',
    kind: 'draft_post',
    payload: {
      maxSources: 3
    }
  })}\n`, 'utf8');
  writeFileSync(drafterFile, `
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  JSON.parse(raw || '{}');
  process.stdout.write(JSON.stringify({
    topic: 'Source ID smoke test',
    body: 'Razroo Projects describes agent-assisted project planning.',
    abstracts: ['Razroo Projects describes agent-assisted project planning.'],
    tone: 'professional',
    sourceIds: [${JSON.stringify(truncatedSourceID)}]
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

  const createPostCall = createPostCalls[0];
  if (!createPostCall) throw new Error('create_source_backed_timeline_post was not called');
  const submittedSourceIDs = Array.isArray(createPostCall.sourceIds) ? createPostCall.sourceIds : [];
  if (submittedSourceIDs.length !== 1 || submittedSourceIDs[0] !== fullSourceID) {
    throw new Error(`expected full source id ${fullSourceID}, got ${JSON.stringify(submittedSourceIDs)}`);
  }

  console.log('profile-scribe-rig source ID smoke check passed.');
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
