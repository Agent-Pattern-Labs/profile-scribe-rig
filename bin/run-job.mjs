#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);

const help = `profile-scribe-harness run-job

Usage:
  profile-scribe-harness run-job --job-file <path> [--output <path>] [--dry-run]

Environment:
  PROFILESCRIBE_AGENT_TOKEN            Scoped ProfileScribe agent token
  PROFILESCRIBE_MCP_URL                Hosted MCP endpoint
  PROFILESCRIBE_RIG_DRAFTER_COMMAND    Optional command that receives context JSON and returns draft JSON
  PROFILESCRIBE_RIG_INTERVIEW_COMMAND  Optional command that receives interview context JSON and returns message JSON
`;

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return '';
  return args[index + 1] || '';
}

function hasArg(name) {
  return args.includes(name);
}

if (hasArg('--help') || hasArg('-h')) {
  console.log(help);
  process.exit(0);
}

const jobFile = argValue('--job-file');
const outputFile = argValue('--output');
const dryRun = hasArg('--dry-run') || boolEnv('PROFILESCRIBE_RIG_DRY_RUN');

if (!jobFile) fail('missing --job-file');
if (!existsSync(jobFile)) fail(`job file not found: ${jobFile}`);

const job = parseJSON(readFileSync(jobFile, 'utf8'), `job file ${jobFile}`);

try {
  const result = await runJob(job, { dryRun });
  const payload = `${JSON.stringify(result, null, 2)}\n`;
  if (outputFile) {
    writeFileSync(outputFile, payload, 'utf8');
  } else {
    process.stdout.write(payload);
  }
} catch (error) {
  const failure = {
    status: 'failed',
    jobId: text(job.id),
    jobKind: text(job.kind),
    summary: error.message || 'profile-scribe-rig job failed'
  };
  const payload = `${JSON.stringify(failure, null, 2)}\n`;
  if (outputFile) {
    writeFileSync(outputFile, payload, 'utf8');
  } else {
    process.stdout.write(payload);
  }
  process.exit(1);
}

async function runJob(job, options) {
  const kind = text(job.kind);
  if (!kind) throw new Error('job.kind is required');

  switch (kind) {
    case 'scheduled_post_check':
    case 'draft_post':
      return await runPostJob(job, options);
    case 'continue_interview':
      return await runInterviewJob(job, options);
    case 'crawl_sources':
    case 'source_activity_check':
    case 'propose_profile_update':
      return skipped(job, `${kind} is queued but no rig executor is implemented yet`);
    default:
      throw new Error(`unsupported job kind ${kind}`);
  }
}

async function runPostJob(job, options) {
  const payload = object(job.payload);
  if (options.dryRun) {
    return skipped(job, 'dry run: post job would read ProfileScribe context and evaluate a draft');
  }

  const context = await loadProfileScribeContext(payload);
  const draft = await resolveDraft(job, context);
  if (!draft.body && !boolEnv('PROFILESCRIBE_RIG_ALLOW_HOSTED_DRAFT_FALLBACK')) {
    return {
      status: 'skipped',
      jobId: text(job.id),
      jobKind: text(job.kind),
      summary: 'No harness-composed body was available; leaving job as a no-op instead of publishing generic copy.',
      metadata: {
        checkedSources: context.sources.length,
        profileName: context.profile?.identity?.fullName || ''
      }
    };
  }

  const response = await callMCPTool('create_source_backed_timeline_post', compact({
    topic: draft.topic || payload.topic || '',
    body: draft.body || '',
    abstracts: array(draft.abstracts),
    tone: draft.tone || payload.tone || 'professional',
    maxSources: numberOr(payload.maxSources, 3),
    sourceIds: array(draft.sourceIds || payload.sourceIds)
  }));

  return {
    status: 'completed',
    jobId: text(job.id),
    jobKind: text(job.kind),
    summary: 'Submitted source-backed timeline post through ProfileScribe MCP.',
    artifactType: 'timeline_post',
    artifactId: response?.draft?.id || response?.id || '',
    metadata: {
      topic: draft.topic || payload.topic || '',
      sourceIds: array(draft.sourceIds || payload.sourceIds),
      checkedSources: context.sources.length
    }
  };
}

async function runInterviewJob(job, options) {
  const payload = object(job.payload);
  const sessionId = text(payload.interviewSessionId);
  if (!sessionId) throw new Error('continue_interview payload.interviewSessionId is required');

  if (options.dryRun) {
    return {
      status: 'completed',
      jobId: text(job.id),
      jobKind: text(job.kind),
      summary: 'dry run: generated placeholder interview question',
      artifactType: 'interview_message',
      interviewSessionId: sessionId,
      interviewMessage: {
        kind: 'question',
        body: 'What source best proves this update?',
        status: 'waiting_for_user'
      }
    };
  }

  const context = await loadProfileScribeContext(payload);
  const command = process.env.PROFILESCRIBE_RIG_INTERVIEW_COMMAND || '';
  const message = command
    ? runJSONCommand(command, { job, context })
    : defaultInterviewMessage(context);

  return {
    status: 'completed',
    jobId: text(job.id),
    jobKind: text(job.kind),
    summary: 'Generated next managed-agent interview turn.',
    artifactType: 'interview_message',
    interviewSessionId: sessionId,
    interviewMessage: {
      kind: text(message.kind) || 'question',
      body: text(message.body),
      status: text(message.status) || 'waiting_for_user',
      summary: text(message.summary),
      complete: Boolean(message.complete),
      metadata: object(message.metadata)
    }
  };
}

async function loadProfileScribeContext(payload) {
  const profile = await callMCPTool('read_profile', {});
  const sources = await callMCPTool('read_sources', {});
  let timelineSearch = null;
  const query = text(payload.topic || profile?.identity?.headline || profile?.identity?.fullName);
  if (query) {
    try {
      timelineSearch = await callMCPTool('search_timeline_posts', { query, limit: 8 });
    } catch {
      timelineSearch = null;
    }
  }
  return {
    profile,
    sources: Array.isArray(sources) ? sources : [],
    timelineSearch
  };
}

async function resolveDraft(job, context) {
  const payload = object(job.payload);
  if (payload.body) {
    return {
      topic: text(payload.topic),
      body: text(payload.body),
      abstracts: array(payload.abstracts),
      tone: text(payload.tone),
      sourceIds: array(payload.sourceIds)
    };
  }

  const command = process.env.PROFILESCRIBE_RIG_DRAFTER_COMMAND || '';
  if (!command) return {};
  const draft = runJSONCommand(command, { job, context });
  return {
    topic: text(draft.topic),
    body: text(draft.body),
    abstracts: array(draft.abstracts),
    tone: text(draft.tone),
    sourceIds: array(draft.sourceIds)
  };
}

function defaultInterviewMessage(context) {
  const source = Array.isArray(context.sources) && context.sources.length > 0
    ? context.sources[0]
    : null;
  if (source?.label) {
    return {
      kind: 'question',
      body: `What changed recently around ${source.label} that your profile should reflect?`,
      status: 'waiting_for_user'
    };
  }
  return {
    kind: 'question',
    body: 'What recent project, launch, source, or shipped work should your profile reflect next?',
    status: 'waiting_for_user'
  };
}

async function callMCPTool(name, argumentsPayload) {
  const token = process.env.PROFILESCRIBE_AGENT_TOKEN || '';
  const url = process.env.PROFILESCRIBE_MCP_URL || 'https://profilescribe.com/api/mcp';
  if (!token) throw new Error('PROFILESCRIBE_AGENT_TOKEN is required');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name,
        arguments: argumentsPayload || {}
      }
    })
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`MCP ${name} failed with HTTP ${response.status}: ${body}`);
  const envelope = parseJSON(body, `MCP ${name} response`);
  if (envelope.error) throw new Error(`MCP ${name} failed: ${envelope.error.message || JSON.stringify(envelope.error)}`);
  const content = envelope.result?.content;
  const textPayload = Array.isArray(content) ? content.find((item) => item.type === 'text')?.text : '';
  if (!textPayload) return envelope.result;
  return parseJSON(textPayload, `MCP ${name} text result`);
}

function runJSONCommand(command, input) {
  const result = spawnSync(command, {
    input: `${JSON.stringify(input)}\n`,
    encoding: 'utf8',
    shell: true,
    timeout: numberOr(process.env.PROFILESCRIBE_RIG_COMMAND_TIMEOUT_MS, 180000),
    env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`command failed (${command}): ${result.stderr || result.stdout}`);
  }
  return parseJSON(result.stdout, `command output from ${command}`);
}

function skipped(job, summary) {
  return {
    status: 'skipped',
    jobId: text(job.id),
    jobKind: text(job.kind),
    summary
  };
}

function parseJSON(raw, label) {
  try {
    return JSON.parse(raw || '{}');
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function compact(value) {
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item) && item.length === 0) continue;
    if (item === '' || item === undefined || item === null) continue;
    out[key] = item;
  }
  return out;
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value.filter((item) => text(item) !== '').map((item) => text(item)) : [];
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function boolEnv(name) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').trim().toLowerCase());
}

function fail(message) {
  console.error(message);
  console.error('');
  console.error(help);
  process.exit(1);
}
