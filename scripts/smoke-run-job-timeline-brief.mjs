#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'profilescribe-rig-timeline-brief-'));
const createPostCalls = [];
const source = {
  id: 'src-turnkeybook',
  kind: 'website',
  label: 'TurnkeyBook',
  url: 'https://turnkeybook.com',
  status: 'monitoring',
  trustLevel: 'high'
};
const priorPost = {
  id: 'draft-existing-turnkeybook',
  topic: 'TurnkeyBook: Human-written nonfiction books delivered in 7 days',
  body: 'Launched TurnkeyBook, a done-for-you ghostwriting service for founders, coaches, and experts. Writers interview you, capture your voice, and deliver a complete manuscript as PDF and Kindle-ready .epub within one week. One-time $2,800 investment includes two revision rounds and full copyright transfer. No AI copy, no outline required.',
  publishedAt: '2026-05-26T14:44:00Z',
  authorSlug: 'abraham-greenman',
  sources: [source]
};

const server = createServer(async (request, response) => {
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
    result = [source];
  } else if (name === 'search_timeline_posts') {
    result = { query: envelope?.params?.arguments?.query || '', results: [priorPost] };
  } else if (name === 'discover_timeline_posts') {
    result = { posts: [priorPost] };
  } else if (name === 'create_source_backed_timeline_post') {
    createPostCalls.push(envelope?.params?.arguments || {});
    result = { draft: { id: 'draft-should-not-be-created' } };
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
    id: 'job-timeline-brief-smoke',
    kind: 'draft_post',
    payload: {
      topic: 'TurnkeyBook process details',
      sourceIds: [source.id],
      maxSources: 3
    }
  })}\n`, 'utf8');
  writeFileSync(drafterFile, `
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  const input = JSON.parse(raw || '{}');
  const recentPosts = input.context?.timelineBrief?.recentPosts || [];
  if (!recentPosts.some((post) => /TurnkeyBook: Human-written/.test(post.topic || ''))) {
    console.error('drafter did not receive timelineBrief recent posts');
    process.exit(2);
  }
  process.stdout.write(JSON.stringify({
    topic: 'Inside TurnkeyBook: a 7-day human-written nonfiction publishing package',
    body: 'A closer look at how TurnkeyBook works in practice. The service converts rough notes, a talk track, or accumulated experience into an authored nonfiction manuscript without turning the client into a part-time writer. The deliverables are a human-written PDF plus a Kindle-ready .epub, with full copyright transfer and two revision rounds included. The flat investment is $2,800, and the product is voice, structure, and clarity preserved — not generated copy.',
    abstracts: ['TurnkeyBook converts rough notes into a human-written nonfiction manuscript.'],
    tone: 'professional',
    sourceIds: ['src-turnkeybook']
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
  if (createPostCalls.length !== 0) {
    throw new Error('near-duplicate post was submitted instead of skipped');
  }
  if (!receipt.metadata?.duplicatePost?.duplicateReason?.kind) {
    throw new Error(`expected duplicate reason metadata, got ${JSON.stringify(receipt.metadata)}`);
  }
  if (!receipt.metadata?.timelineBrief?.recentPosts?.length) {
    throw new Error(`expected timeline brief metadata, got ${JSON.stringify(receipt.metadata)}`);
  }

  console.log('profile-scribe-rig timeline brief duplicate smoke check passed.');
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
