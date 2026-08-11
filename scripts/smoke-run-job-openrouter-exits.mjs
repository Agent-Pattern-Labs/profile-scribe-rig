#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'profilescribe-rig-openrouter-exits-'));
const usage = {
  prompt_tokens: 640,
  completion_tokens: 96,
  total_tokens: 736,
  cost: 0.0042,
  prompt: 'SENSITIVE_PROMPT_MUST_NOT_SURVIVE'
};
const source = {
  id: 'src-openrouter-exits',
  kind: 'website',
  label: 'Exit Metadata Lab',
  url: '',
  status: 'monitoring',
  trustLevel: 'high'
};
const goodBody = 'Exit Metadata Lab keeps OpenRouter accounting attached to each drafting attempt. Usage totals now survive skipped drafts and downstream submission failures without storing the private generation prompt.';
let scenario = 'no_body';

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/exit-metadata-lab') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<html><head><title>Exit Metadata Lab</title></head><body><h1>OpenRouter exit accounting</h1><p>Usage totals survive every draft outcome.</p></body></html>');
    return;
  }

  let raw = '';
  for await (const chunk of request) raw += chunk;

  if (request.url === '/openrouter') {
    if (scenario === 'provider_failure') {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        error: {
          message: 'SENSITIVE_PROMPT_MUST_NOT_SURVIVE'
        }
      }));
      return;
    }
    if (scenario === 'provider_invalid_schema') {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        error: {
          code: 400,
          message: 'Provider rejected the invalid JSON schema',
          metadata: {}
        }
      }));
      return;
    }
    const body = scenario === 'no_body'
      ? ''
      : scenario === 'quality'
        ? 'The approved sources and source graph show Exit Metadata Lab through the internal posting workflow, which is concrete enough for this deliberately rejected quality test.'
        : goodBody;
    const scenarioUsage = scenario === 'invalid_cost_string'
      ? { ...usage, cost: '0.0042' }
      : scenario === 'invalid_cost_negative'
        ? { ...usage, cost: -1 }
        : scenario === 'invalid_cost_null'
          ? { ...usage, cost: null }
          : usage;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      choices: [{
        message: {
          content: scenario === 'invalid_message' ? 'not-json' : JSON.stringify({
            topic: 'OpenRouter exit accounting',
            body,
            abstracts: ['Exit Metadata Lab retains safe provider usage metadata.'],
            tone: 'specific and technical',
            sourceIds: [source.id]
          })
        }
      }],
      usage: scenarioUsage
    }));
    return;
  }

  const envelope = JSON.parse(raw || '{}');
  const name = envelope?.params?.name || '';
  const args = envelope?.params?.arguments || {};
  let result;
  if (name === 'read_profile') {
    result = { identity: { fullName: 'Test Builder', headline: 'Builds reliable agent accounting' } };
  } else if (name === 'read_sources') {
    result = [source];
  } else if (name === 'read_source_evidence') {
    result = [{
      sourceId: source.id,
      sourceLabel: source.label,
      sourceUrl: source.url,
      kind: 'page',
      title: 'Exit Metadata Lab',
      summary: 'Exit Metadata Lab retains OpenRouter usage across every run outcome.',
      observedAt: '2026-07-17T12:00:00Z'
    }];
  } else if (name === 'search_timeline_posts') {
    result = {
      query: args.query || '',
      results: scenario === 'pre_submit_duplicate' ? [{
        id: 'existing-exit-accounting-post',
        topic: 'OpenRouter exit accounting',
        body: goodBody,
        publishedAt: '2026-07-17T11:00:00Z',
        sources: [source]
      }] : []
    };
  } else if (name === 'discover_timeline_posts') {
    result = { posts: [] };
  } else if (name === 'create_source_backed_timeline_post') {
    if (scenario === 'mcp_duplicate') {
      return sendMCPError(response, envelope.id, 'draft duplicates a recent published post');
    }
    if (scenario === 'mcp_failure') {
      return sendMCPError(response, envelope.id, 'temporary downstream storage failure');
    }
    result = { draft: { id: `draft-${scenario}` } };
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
  source.url = `http://127.0.0.1:${port}/exit-metadata-lab`;

  for (const test of [
    { name: 'no_body', status: 'skipped', usage: true },
    { name: 'provider_failure', status: 'skipped', usage: false, error: 'openrouter_http_500' },
    {
      name: 'provider_invalid_schema',
      status: 'skipped',
      usage: false,
      error: 'openrouter_invalid_schema'
    },
    { name: 'invalid_message', status: 'skipped', usage: true, error: 'openrouter_invalid_response' },
    { name: 'quality', status: 'skipped', usage: true },
    {
      name: 'invalid_cost_string',
      status: 'completed',
      usage: true,
      invalidCost: true
    },
    {
      name: 'invalid_cost_negative',
      status: 'completed',
      usage: true,
      invalidCost: true
    },
    {
      name: 'invalid_cost_null',
      status: 'completed',
      usage: true,
      invalidCost: true
    },
    { name: 'pre_submit_duplicate', status: 'skipped', usage: true },
    { name: 'mcp_duplicate', status: 'skipped', usage: true },
    { name: 'mcp_failure', status: 'failed', usage: true, exitCode: 1 }
  ]) {
    scenario = test.name;
    const receipt = await runScenario(test.name, port, test.exitCode || 0);
    if (receipt.status !== test.status) {
      throw new Error(`${test.name}: expected status ${test.status}, got ${JSON.stringify(receipt)}`);
    }
    const drafter = receipt.metadata?.drafter || {};
    if (drafter.provider !== 'openrouter' || drafter.model !== 'test/openrouter-exit-model') {
      throw new Error(`${test.name}: missing OpenRouter drafter metadata: ${JSON.stringify(drafter)}`);
    }
    if (test.usage &&
        drafter.openRouterUsage?.total_tokens !== usage.total_tokens) {
      throw new Error(`${test.name}: missing OpenRouter usage: ${JSON.stringify(drafter)}`);
    }
    if (test.invalidCost &&
        Object.prototype.hasOwnProperty.call(
          drafter.openRouterUsage || {},
          'cost'
        )) {
      throw new Error(
        `${test.name}: invalid provider cost survived normalization: ${JSON.stringify(drafter)}`
      );
    }
    if (test.usage && !test.invalidCost &&
        drafter.openRouterUsage?.cost !== usage.cost) {
      throw new Error(
        `${test.name}: valid provider cost was lost: ${JSON.stringify(drafter)}`
      );
    }
    if (test.error && drafter.error !== test.error) {
      throw new Error(`${test.name}: expected safe error ${test.error}, got ${JSON.stringify(drafter)}`);
    }
    const serialized = JSON.stringify(receipt);
    if (serialized.includes('SENSITIVE_PROMPT_MUST_NOT_SURVIVE') || serialized.includes('sk-or-private-test-value')) {
      throw new Error(`${test.name}: receipt leaked a prompt or credential`);
    }
  }

  console.log('profile-scribe-rig OpenRouter exit metadata smoke check passed.');
} finally {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}

async function runScenario(name, port, expectedExitCode) {
  const jobFile = join(tmp, `${name}.json`);
  writeFileSync(jobFile, `${JSON.stringify({
    id: `job-openrouter-exit-${name}`,
    kind: 'draft_post',
    payload: {
      topic: 'OpenRouter exit accounting',
      maxSources: 1
    }
  })}\n`, 'utf8');
  const run = await spawnRun(process.execPath, [join(root, 'bin/run-job.mjs'), '--job-file', jobFile], {
    cwd: root,
    env: {
      ...process.env,
      OPENROUTER_API_KEY: 'sk-or-private-test-value',
      PROFILESCRIBE_AGENT_TOKEN: 'test-token',
      PROFILESCRIBE_MCP_URL: `http://127.0.0.1:${port}`,
      PROFILESCRIBE_RIG_OPENROUTER_CHAT_COMPLETIONS_URL: `http://127.0.0.1:${port}/openrouter`,
      PROFILESCRIBE_RIG_DRAFT_MODEL: 'test/openrouter-exit-model'
    }
  });
  if (run.code !== expectedExitCode) {
    throw new Error(`${name}: expected exit ${expectedExitCode}, got ${run.code}\nstdout: ${run.stdout}\nstderr: ${run.stderr}`);
  }
  return JSON.parse(run.stdout || '{}');
}

function sendMCPError(response, id, message) {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({
    jsonrpc: '2.0',
    id: id || 1,
    error: { message }
  }));
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
