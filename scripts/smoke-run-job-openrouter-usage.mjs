#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'profilescribe-rig-openrouter-usage-'));
const createPostCalls = [];
const openRouterCalls = [];

const source = {
  id: 'src-openrouter-usage',
  kind: 'website',
  label: 'Usage Lab',
  url: '',
  status: 'monitoring',
  trustLevel: 'high'
};

const usage = {
  prompt_tokens: 1200,
  completion_tokens: 180,
  total_tokens: 1380,
  cost: 0.0105
};

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/usage-lab') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<title>Usage Lab</title><meta name="description" content="Usage Lab shows token telemetry for source-backed drafting."><main>Usage Lab documents OpenRouter token telemetry flowing from draft generation into job metadata.</main>');
    return;
  }

  let raw = '';
  for await (const chunk of request) raw += chunk;

  if (request.url === '/openrouter') {
    const body = JSON.parse(raw || '{}');
    openRouterCalls.push(body);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            topic: 'OpenRouter draft usage telemetry',
            body: 'Usage Lab makes the OpenRouter token telemetry path visible for ProfileScribe drafting. The useful implementation detail is that draft generation can now carry prompt, completion, and total token counts into the job receipt for later cost reporting.',
            abstracts: ['Usage Lab documents OpenRouter token telemetry flowing from draft generation into job metadata.'],
            tone: 'technical and concrete',
            sourceIds: [source.id]
          })
        }
      }],
      usage
    }));
    return;
  }

  const envelope = JSON.parse(raw || '{}');
  const name = envelope?.params?.name || '';
  const args = envelope?.params?.arguments || {};
  let result;

  if (name === 'read_profile') {
    result = {
      identity: {
        fullName: 'Abraham Greenman',
        headline: 'Builds practical AI systems'
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
      observationId: 'obs-openrouter-usage',
      url: source.url,
      kind: 'page',
      title: 'Usage Lab',
      summary: 'Usage Lab documents OpenRouter token telemetry flowing from draft generation into job metadata.',
      changeType: 'changed',
      observedAt: '2026-06-13T12:00:00Z'
    }];
  } else if (name === 'search_timeline_posts') {
    result = { query: args.query || '', results: [] };
  } else if (name === 'discover_timeline_posts') {
    result = { posts: [] };
  } else if (name === 'create_source_backed_timeline_post') {
    createPostCalls.push(args);
    result = { draft: { id: 'draft-openrouter-usage' } };
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
  source.url = `http://127.0.0.1:${port}/usage-lab`;

  const jobFile = join(tmp, 'job.json');
  writeFileSync(jobFile, `${JSON.stringify({
    id: 'job-openrouter-usage-smoke',
    kind: 'draft_post',
    payload: {
      topic: 'draft about OpenRouter usage telemetry',
      maxSources: 1
    }
  })}\n`, 'utf8');

  const run = await spawnRun(process.execPath, [join(root, 'bin/run-job.mjs'), '--job-file', jobFile], {
    cwd: root,
    env: {
      ...process.env,
      OPENROUTER_API_KEY: 'sk-or-test',
      PROFILESCRIBE_AGENT_TOKEN: 'test-token',
      PROFILESCRIBE_MCP_URL: `http://127.0.0.1:${port}`,
      PROFILESCRIBE_RIG_OPENROUTER_CHAT_COMPLETIONS_URL: `http://127.0.0.1:${port}/openrouter`,
      PROFILESCRIBE_RIG_DRAFT_MODEL: 'test/openrouter-usage-model'
    }
  });

  if (run.code !== 0) {
    console.error(run.stdout);
    console.error(run.stderr);
    throw new Error(`run-job exited with status ${run.code}`);
  }

  if (openRouterCalls.length !== 1) {
    throw new Error(`expected one OpenRouter call, got ${openRouterCalls.length}`);
  }
  if (createPostCalls.length !== 1) {
    throw new Error(`expected one create_source_backed_timeline_post call, got ${createPostCalls.length}`);
  }

  const receipt = JSON.parse(run.stdout || '{}');
  const captured = receipt.metadata?.drafter?.openRouterUsage || {};
  if (captured.prompt_tokens !== usage.prompt_tokens ||
      captured.completion_tokens !== usage.completion_tokens ||
      captured.total_tokens !== usage.total_tokens ||
      captured.raw?.total_tokens !== usage.total_tokens) {
    throw new Error(`expected OpenRouter usage in drafter metadata, got ${JSON.stringify(captured)}`);
  }

  console.log('profile-scribe-rig OpenRouter usage smoke check passed.');
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
