#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'profilescribe-rig-evidence-opportunities-'));
const createPostCalls = [];

const source = {
  id: 'src-grnmn',
  kind: 'website',
  label: 'GRNMN',
  url: '',
  status: 'monitoring',
  trustLevel: 'high',
  lastCheckedAt: '2026-06-03T12:00:00Z'
};

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<title>GRNMN</title><meta name="description" content="A public home for work and writing"><main>Abraham Greenman writes about practical AI systems and software infrastructure.</main>');
    return;
  }
  if (request.method === 'GET' && request.url === '/blog/practical-ai-systems/') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<title>Practical AI systems need boring edges</title><meta name="description" content="Review loops, source-backed claims, and constrained automation make practical AI systems useful."><main>Useful AI products depend on review loops, source-backed claims, and constrained automation.</main>');
    return;
  }
  if (request.method === 'GET' && request.url === '/blog/my-favorite-music/') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<title>My favorite music to listen to</title><main>A personal list of albums and music.</main>');
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
        headline: 'Builder of practical AI systems and software infrastructure'
      },
      skills: ['AI agents', 'software systems', 'product infrastructure']
    };
  } else if (name === 'read_sources') {
    result = [source];
  } else if (name === 'read_source_evidence') {
    result = [
      {
        sourceId: source.id,
        sourceLabel: source.label,
        sourceUrl: source.url,
        sourceKind: source.kind,
        observationId: 'obs-music',
        url: `${source.url}/blog/my-favorite-music/`,
        kind: 'article',
        title: 'My favorite music to listen to',
        summary: 'A personal list of albums and music.',
        changeType: 'new',
        observedAt: '2026-06-03T12:00:00Z'
      },
      {
        sourceId: source.id,
        sourceLabel: source.label,
        sourceUrl: source.url,
        sourceKind: source.kind,
        observationId: 'obs-ai-systems',
        url: `${source.url}/blog/practical-ai-systems/`,
        kind: 'article',
        title: 'Practical AI systems need boring edges',
        summary: 'Review loops, source-backed claims, and constrained automation make practical AI systems useful.',
        changeType: 'new',
        observedAt: '2026-06-03T11:00:00Z'
      }
    ];
  } else if (name === 'search_timeline_posts') {
    result = { query: envelope?.params?.arguments?.query || '', results: [] };
  } else if (name === 'discover_timeline_posts') {
    result = { posts: [] };
  } else if (name === 'create_source_backed_timeline_post') {
    createPostCalls.push(envelope?.params?.arguments || {});
    result = { draft: { id: 'draft-evidence-opportunity-smoke' } };
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
  source.url = `http://127.0.0.1:${port}`;

  const jobFile = join(tmp, 'job.json');
  const drafterFile = join(tmp, 'drafter.mjs');

  writeFileSync(jobFile, `${JSON.stringify({
    id: 'job-evidence-opportunity-smoke',
    kind: 'draft_post',
    payload: {
      topic: 'create one more timeline post',
      maxSources: 2
    }
  })}\n`, 'utf8');
  writeFileSync(drafterFile, `
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  const input = JSON.parse(raw || '{}');
  const opportunities = input.context?.evidenceOpportunities || [];
  const extracts = input.context?.sourceExtracts || [];
  if (opportunities[0]?.url !== '${source.url}/blog/practical-ai-systems/') {
    console.error('expected practical AI article to be top evidence opportunity: ' + JSON.stringify(opportunities));
    process.exit(2);
  }
  if (!extracts.some((extract) => extract.url === '${source.url}/blog/practical-ai-systems/' && /source-backed claims/.test(extract.excerpt || ''))) {
    console.error('expected practical AI article extract in drafter context: ' + JSON.stringify(extracts));
    process.exit(3);
  }
  process.stdout.write(JSON.stringify({
    topic: 'Practical AI systems need boring edges',
    body: 'I keep coming back to the boring edge of practical AI systems: review loops, source-backed claims, and constrained automation are what make agentic products useful outside a demo.',
    abstracts: ['Practical AI systems need review loops, source-backed claims, and constrained automation.'],
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
  if (receipt.status !== 'completed') {
    throw new Error(`expected completed receipt, got ${JSON.stringify(receipt)}`);
  }
  const createPostCall = createPostCalls[0];
  if (!createPostCall) throw new Error('create_source_backed_timeline_post was not called');
  if (!Array.isArray(createPostCall.sourceIds) || createPostCall.sourceIds[0] !== source.id) {
    throw new Error(`expected parent source id, got ${JSON.stringify(createPostCall.sourceIds)}`);
  }
  if (receipt.metadata?.evidenceOpportunities?.[0]?.url !== `${source.url}/blog/practical-ai-systems/`) {
    throw new Error(`expected evidence opportunity metadata, got ${JSON.stringify(receipt.metadata)}`);
  }

  console.log('profile-scribe-rig evidence opportunity smoke check passed.');
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
