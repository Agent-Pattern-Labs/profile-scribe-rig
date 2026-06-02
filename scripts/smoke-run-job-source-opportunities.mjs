#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'profilescribe-rig-source-opportunities-'));
const createPostCalls = [];

const sources = [
  {
    id: 'src-covered',
    kind: 'website',
    label: 'Covered Product',
    url: '',
    status: 'monitoring',
    trustLevel: 'high',
    lastCheckedAt: '2026-06-02T14:00:00Z'
  },
  {
    id: 'src-fresh',
    kind: 'website',
    label: 'Fresh Product',
    url: '',
    status: 'monitoring',
    trustLevel: 'high',
    lastCheckedAt: '2026-06-02T15:00:00Z'
  }
];

const priorPost = {
  id: 'draft-covered-product',
  topic: 'Covered Product launch details',
  body: 'Covered Product has already been explained in recent timeline posts.',
  publishedAt: '2026-06-02T14:30:00Z',
  authorSlug: 'abraham-greenman',
  sources: []
};

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/covered') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<title>Covered Product</title><meta name="description" content="Already covered product"><main>Covered Product repeats an older launch story.</main>');
    return;
  }
  if (request.method === 'GET' && request.url === '/fresh') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<title>Fresh Product</title><meta name="description" content="A fresh workflow for professional discovery"><main>Fresh Product turns scattered professional signals into prioritized discovery opportunities for autonomous profile updates.</main>');
    return;
  }

  let raw = '';
  for await (const chunk of request) raw += chunk;
  const envelope = JSON.parse(raw || '{}');
  const name = envelope?.params?.name || '';
  let result;

  if (name === 'read_profile') {
    result = {
      identity: {
        fullName: 'Abraham Greenman',
        headline: 'Builder of practical AI systems'
      }
    };
  } else if (name === 'read_sources') {
    result = sources;
  } else if (name === 'search_timeline_posts') {
    result = { query: envelope?.params?.arguments?.query || '', results: [priorPost] };
  } else if (name === 'discover_timeline_posts') {
    result = { posts: [priorPost] };
  } else if (name === 'create_source_backed_timeline_post') {
    createPostCalls.push(envelope?.params?.arguments || {});
    result = { draft: { id: 'draft-source-opportunity-smoke' } };
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
  sources[0].url = `http://127.0.0.1:${port}/covered`;
  sources[1].url = `http://127.0.0.1:${port}/fresh`;
  priorPost.sources = [sources[0]];

  const jobFile = join(tmp, 'job.json');
  const drafterFile = join(tmp, 'drafter.mjs');

  writeFileSync(jobFile, `${JSON.stringify({
    id: 'job-source-opportunity-smoke',
    kind: 'draft_post',
    payload: {
      topic: 'create one more timeline post',
      maxSources: 3
    }
  })}\n`, 'utf8');
  writeFileSync(drafterFile, `
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  const input = JSON.parse(raw || '{}');
  const opportunities = input.context?.sourceOpportunities || [];
  const extracts = input.context?.sourceExtracts || [];
  if (opportunities[0]?.sourceId !== 'src-fresh') {
    console.error('expected fresh source to be top opportunity: ' + JSON.stringify(opportunities));
    process.exit(2);
  }
  if (!extracts.some((extract) => extract.sourceId === 'src-fresh' && /prioritized discovery opportunities/.test(extract.excerpt || ''))) {
    console.error('expected fresh source extract in drafter context: ' + JSON.stringify(extracts));
    process.exit(3);
  }
  process.stdout.write(JSON.stringify({
    topic: 'Fresh Product prioritizes professional discovery opportunities',
    body: 'I am making the next layer of profile automation more explicit: Fresh Product turns scattered professional signals into prioritized discovery opportunities, so the profile can find a better update before asking for manual direction.',
    abstracts: ['Fresh Product turns scattered professional signals into prioritized discovery opportunities.'],
    tone: 'professional',
    sourceIds: ['src-fresh']
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
  if (receipt.status !== 'completed') {
    throw new Error(`expected completed receipt, got ${JSON.stringify(receipt)}`);
  }
  const createPostCall = createPostCalls[0];
  if (!createPostCall) throw new Error('create_source_backed_timeline_post was not called');
  if (!Array.isArray(createPostCall.sourceIds) || createPostCall.sourceIds[0] !== 'src-fresh') {
    throw new Error(`expected fresh source id, got ${JSON.stringify(createPostCall.sourceIds)}`);
  }
  if (receipt.metadata?.sourceOpportunities?.[0]?.sourceId !== 'src-fresh') {
    throw new Error(`expected source opportunity metadata, got ${JSON.stringify(receipt.metadata)}`);
  }

  console.log('profile-scribe-rig source opportunity smoke check passed.');
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
