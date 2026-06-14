#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'profilescribe-rig-rewrite-latest-post-'));
const createPostCalls = [];
const openRouterCalls = [];

const source = {
  id: 'src-rewrite-workbench',
  kind: 'website',
  label: 'Rewrite Workbench',
  url: 'https://profilescribe.com/rewrite-workbench',
  status: 'monitoring',
  trustLevel: 'high'
};

const latestPost = {
  id: 'draft-weak-latest',
  topic: 'ProfileScribe rewrite loop',
  body: 'ProfileScribe is improving source-backed updates so the work is easier to inspect.',
  publishedAt: '2026-06-14T12:00:00Z',
  authorSlug: 'abraham-greenman',
  sources: [source]
};

const server = createServer(async (request, response) => {
  let raw = '';
  for await (const chunk of request) raw += chunk;

  if (request.url === '/openrouter') {
    const body = JSON.parse(raw || '{}');
    openRouterCalls.push(body);
    const user = JSON.parse(body.messages?.find((message) => message.role === 'user')?.content || '{}');
    if (user.rewrite?.latestPost?.id !== latestPost.id) {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'missing latest post rewrite context' }));
      return;
    }
    if (!/launch notes/i.test(user.rewrite?.feedback?.note || '')) {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'missing rewrite feedback note' }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            topic: 'Rewrite Workbench launch notes',
            body: 'Rewrite Workbench now gives ProfileScribe a tighter mobile feedback loop: weak timeline posts can be replaced with a narrower update that names the launch notes, preserves the reviewed source, and avoids repeating the generic framing that triggered the edit request.',
            abstracts: ['Rewrite Workbench connects mobile edit feedback to a narrower replacement post.'],
            tone: 'specific and practical',
            sourceIds: [source.id]
          })
        }
      }],
      usage: { prompt_tokens: 900, completion_tokens: 120, total_tokens: 1020 }
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
        headline: 'Builds practical agent products'
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
      observationId: 'obs-rewrite-workbench',
      url: source.url,
      kind: 'page',
      title: 'Rewrite Workbench launch notes',
      summary: 'Rewrite Workbench connects mobile edit feedback to a narrower replacement post.',
      changeType: 'changed',
      observedAt: '2026-06-14T12:10:00Z'
    }];
  } else if (name === 'search_timeline_posts') {
    result = { query: args.query || '', results: [latestPost] };
  } else if (name === 'discover_timeline_posts') {
    result = { posts: [latestPost] };
  } else if (name === 'create_source_backed_timeline_post') {
    createPostCalls.push(args);
    result = { draft: { id: 'draft-rewrite-replacement' } };
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
  writeFileSync(jobFile, `${JSON.stringify({
    id: 'job-rewrite-latest-post-smoke',
    kind: 'rewrite_latest_post',
    payload: {
      rewritePostId: latestPost.id,
      rewriteFeedbackReceiptId: 'receipt-needs-edit',
      rewriteNote: 'make it less generic and mention the launch notes',
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
      PROFILESCRIBE_RIG_DRAFT_MODEL: 'test/rewrite-model'
    }
  });

  if (run.code !== 0) {
    console.error(run.stdout);
    console.error(run.stderr);
    throw new Error(`run-job exited with status ${run.code}`);
  }
  if (openRouterCalls.length !== 1) {
    throw new Error(`expected one OpenRouter rewrite call, got ${openRouterCalls.length}`);
  }
  if (createPostCalls.length !== 1) {
    throw new Error(`expected one replacement post submission, got ${createPostCalls.length}`);
  }
  if (!/launch notes/i.test(createPostCalls[0].body || '')) {
    throw new Error(`expected replacement body to follow feedback, got ${JSON.stringify(createPostCalls[0])}`);
  }
  if (createPostCalls[0].sourceIds?.[0] !== source.id) {
    throw new Error(`expected approved source id, got ${JSON.stringify(createPostCalls[0].sourceIds)}`);
  }

  const receipt = JSON.parse(run.stdout || '{}');
  if (receipt.status !== 'completed' || receipt.artifactId !== 'draft-rewrite-replacement') {
    throw new Error(`expected completed rewrite receipt, got ${JSON.stringify(receipt)}`);
  }
  if (receipt.metadata?.rewriteLatestPost?.feedback?.receiptId !== 'receipt-needs-edit') {
    throw new Error(`expected feedback receipt metadata, got ${JSON.stringify(receipt.metadata)}`);
  }
  if (!receipt.metadata?.trace?.tools?.includes('create_source_backed_timeline_post')) {
    throw new Error(`expected trace tools metadata, got ${JSON.stringify(receipt.metadata?.trace)}`);
  }

  console.log('profile-scribe-rig latest-post rewrite smoke check passed.');
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
