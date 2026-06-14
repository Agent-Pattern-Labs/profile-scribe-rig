#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'profilescribe-rig-agent-chat-'));
const toolCalls = [];
const sentMessages = [];

const peer = {
  tenantId: 'acme',
  userId: 'peer-user',
  slug: 'peer-builder',
  fullName: 'Peer Builder',
  headline: 'Builds source-backed launch tooling',
  status: 'connected'
};

const conversation = {
  peer,
  conversationId: 'chat-peer-builder',
  messages: [{
    id: 'msg-peer-1',
    senderName: 'Peer Builder',
    agentName: 'Peer agent',
    recipientName: 'Abraham Greenman',
    body: 'Our launch workflow needs better review loops before publishing.',
    createdAt: '2026-06-14T12:20:00Z'
  }]
};

const source = {
  id: 'src-agent-chat',
  kind: 'website',
  label: 'Agent Chat Workbench',
  url: 'https://profilescribe.com/agent-chat-workbench',
  status: 'monitoring',
  trustLevel: 'high'
};

const server = createServer(async (request, response) => {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const envelope = JSON.parse(raw || '{}');
  const name = envelope?.params?.name || '';
  const args = envelope?.params?.arguments || {};
  toolCalls.push({ name, args });
  let result;

  if (name === 'list_agent_chats') {
    result = {
      chats: [{
        peer,
        conversationId: conversation.conversationId,
        lastMessage: conversation.messages[0],
        messageCount: conversation.messages.length,
        updatedAt: '2026-06-14T12:20:00Z'
      }]
    };
  } else if (name === 'read_agent_chat') {
    if (args.targetTenantId !== peer.tenantId || args.targetUserId !== peer.userId) {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'wrong chat target' } }));
      return;
    }
    result = conversation;
  } else if (name === 'read_profile') {
    result = {
      identity: {
        fullName: 'Abraham Greenman',
        headline: 'Builds agent-managed professional presence'
      }
    };
  } else if (name === 'read_sources') {
    result = [source];
  } else if (name === 'read_source_evidence') {
    result = [{
      sourceId: source.id,
      sourceLabel: source.label,
      sourceUrl: source.url,
      kind: 'page',
      title: 'Agent Chat Workbench',
      summary: 'Agent Chat Workbench records review loops and source-backed publishing decisions.',
      observedAt: '2026-06-14T12:00:00Z'
    }];
  } else if (name === 'search_timeline_posts') {
    result = { query: args.query || '', results: [] };
  } else if (name === 'discover_timeline_posts') {
    result = { posts: [] };
  } else if (name === 'send_agent_chat_message') {
    sentMessages.push(args);
    result = {
      id: 'chat-reply-1',
      conversationId: conversation.conversationId,
      body: args.body,
      agentName: args.agentName || 'ProfileScribe agent',
      createdAt: '2026-06-14T12:21:00Z'
    };
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
  const chatCommandFile = join(tmp, 'chat-command.mjs');
  writeFileSync(jobFile, `${JSON.stringify({
    id: 'job-agent-chat-smoke',
    kind: 'agent_avatar_chat',
    payload: {
      targetSlug: peer.slug,
      agentName: 'ProfileScribe agent'
    }
  })}\n`, 'utf8');
  writeFileSync(chatCommandFile, `
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  const input = JSON.parse(raw || '{}');
  if (input.chat?.peer?.slug !== '${peer.slug}') {
    console.error('missing peer context');
    process.exit(2);
  }
  if (!input.chat?.messages?.some((message) => /review loops/.test(message.body || ''))) {
    console.error('missing chat history');
    process.exit(3);
  }
  process.stdout.write(JSON.stringify({
    body: 'That overlaps with ProfileScribe work on source-backed review loops. The specific useful comparison is how each system decides when a draft is ready to publish versus held for revision.',
    handoffRecommended: true,
    handoffReason: 'Both workflows are about review-gated launch publishing.'
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
      PROFILESCRIBE_RIG_CHAT_COMMAND: `"${process.execPath}" "${chatCommandFile}"`
    }
  });

  if (run.code !== 0) {
    console.error(run.stdout);
    console.error(run.stderr);
    throw new Error(`run-job exited with status ${run.code}`);
  }
  const names = toolCalls.map((call) => call.name);
  for (const expected of ['list_agent_chats', 'read_agent_chat', 'read_profile', 'read_sources', 'send_agent_chat_message']) {
    if (!names.includes(expected)) {
      throw new Error(`expected ${expected} tool call, got ${JSON.stringify(names)}`);
    }
  }
  if (sentMessages.length !== 1 || !/review loops/i.test(sentMessages[0].body || '')) {
    throw new Error(`expected one grounded chat send, got ${JSON.stringify(sentMessages)}`);
  }

  const receipt = JSON.parse(run.stdout || '{}');
  if (receipt.status !== 'completed' || receipt.artifactType !== 'agent_chat_message') {
    throw new Error(`expected completed agent chat receipt, got ${JSON.stringify(receipt)}`);
  }
  if (receipt.metadata?.chat?.handoffRecommended !== true) {
    throw new Error(`expected handoff recommendation metadata, got ${JSON.stringify(receipt.metadata?.chat)}`);
  }
  if (!receipt.metadata?.trace?.tools?.includes('send_agent_chat_message')) {
    throw new Error(`expected chat trace tools, got ${JSON.stringify(receipt.metadata?.trace)}`);
  }

  console.log('profile-scribe-rig agent-avatar chat smoke check passed.');
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
