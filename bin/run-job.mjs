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
  OPENROUTER_API_KEY                   Optional OpenRouter key for native rig drafting/interviews
  PROFILESCRIBE_RIG_OPENROUTER_MODEL   Optional OpenRouter model override
  PROFILESCRIBE_RIG_DRAFTER_COMMAND    Optional command that receives context JSON and returns draft JSON
  PROFILESCRIBE_RIG_INTERVIEW_COMMAND  Optional command that receives interview context JSON and returns message JSON
`;

const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash';
const DEFAULT_OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
  const duplicate = await findRecentDuplicateDraft(draft, context);
  if (duplicate) {
    return skipped(job, `A recent timeline post already covers this update: ${duplicate.topic || 'untitled post'}`, {
      duplicatePost: duplicate,
      topic: draft.topic || payload.topic || '',
      sourceIds: array(draft.sourceIds || payload.sourceIds),
      checkedSources: context.sources.length
    });
  }

  let response;
  try {
    response = await callMCPTool('create_source_backed_timeline_post', compact({
      topic: draft.topic || payload.topic || '',
      body: draft.body || '',
      abstracts: array(draft.abstracts),
      tone: draft.tone || payload.tone || 'professional',
      maxSources: numberOr(payload.maxSources, 3),
      sourceIds: array(draft.sourceIds || payload.sourceIds)
    }));
  } catch (error) {
    if (isDuplicateTimelinePostError(error)) {
      return skipped(job, 'A recent timeline post already covers this source-backed update.', {
        topic: draft.topic || payload.topic || '',
        sourceIds: array(draft.sourceIds || payload.sourceIds),
        checkedSources: context.sources.length
      });
    }
    throw error;
  }

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
      checkedSources: context.sources.length,
      drafter: object(draft.metadata)
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
    : await resolveInterviewMessage(job, context);

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
    timelineSearch,
    sourceExtracts: openRouterApiKey()
      ? await loadSourceExtracts(Array.isArray(sources) ? sources : [], numberOr(payload.maxSources, 3))
      : []
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
  const draft = command
    ? runJSONCommand(command, { job, context })
    : await resolveDraftWithOpenRouter(job, context);
  return {
    topic: text(draft.topic),
    body: text(draft.body),
    abstracts: array(draft.abstracts),
    tone: text(draft.tone),
    sourceIds: array(draft.sourceIds),
    metadata: object(draft.metadata)
  };
}

async function findRecentDuplicateDraft(draft, context) {
  const seen = new Set();
  const searches = [object(context.timelineSearch)];
  const topic = text(draft.topic);
  const body = text(draft.body);
  if (topic) searches.push(await searchTimelinePosts(topic, 8));
  if (body) searches.push(await searchTimelinePosts(truncate(body, 180), 8));

  const candidates = [];
  for (const search of searches) {
    for (const post of arrayOfObjects(search?.results)) {
      const key = text(post.postId || post.id || `${post.authorSlug}:${post.topic}:${post.publishedAt}`);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      candidates.push(post);
    }
  }

  const draftBody = comparablePostText(body);
  const draftTopic = comparablePostText(topic);
  const draftSourceURLs = sourceURLsForDraft(draft, context);
  for (const post of candidates) {
    if (draftBody && draftBody === comparablePostText(post.body)) {
      return duplicatePostSummary(post);
    }
    if (
      draftTopic &&
      draftTopic === comparablePostText(post.topic) &&
      sourceURLSetsOverlap(draftSourceURLs, sourceURLsForPost(post))
    ) {
      return duplicatePostSummary(post);
    }
  }
  return null;
}

async function searchTimelinePosts(query, limit) {
  query = text(query);
  if (!query) return null;
  try {
    return await callMCPTool('search_timeline_posts', { query, limit });
  } catch {
    return null;
  }
}

async function resolveDraftWithOpenRouter(job, context) {
  if (!openRouterApiKey()) return {};
  try {
    const payload = object(job.payload);
    const response = await callOpenRouterJSON({
      system: `You are a ProfileScribe source-backed posting agent.
Draft concise professional timeline posts only from the provided profile, approved source metadata, source extracts, and timeline history.
Do not invent accomplishments, credentials, numbers, affiliations, launches, or claims.
If the provided sources do not support a meaningful professional update, return an empty body.
Return only JSON with keys: topic, body, abstracts, tone, sourceIds.`,
      user: JSON.stringify({
        task: 'Draft one source-backed ProfileScribe timeline post.',
        constraints: {
          topic: 'short title, maximum 96 characters',
          body: 'plain text, specific, professional, maximum 900 characters',
          abstracts: '1-3 short evidence summary lines',
          tone: 'short tone label',
          sourceIds: 'IDs of the approved sources used; use at most maxSources',
          maxSources: numberOr(payload.maxSources, 3),
          skipWhenWeak: 'Return empty body if evidence is generic, stale, missing, or not professionally meaningful.'
        },
        profile: compactProfile(context.profile),
        sources: compactSources(context.sources),
        sourceExtracts: compactSourceExtracts(context.sourceExtracts),
        timelineSearch: compactTimelineSearch(context.timelineSearch),
        jobPayload: payload
      }),
      maxTokens: 900
    });
    return {
      topic: text(response.topic),
      body: text(response.body),
      abstracts: array(response.abstracts),
      tone: text(response.tone),
      sourceIds: array(response.sourceIds),
      metadata: {
        provider: 'openrouter',
        model: openRouterModel()
      }
    };
  } catch (error) {
    return {
      metadata: {
        provider: 'openrouter',
        model: openRouterModel(),
        status: 'fallback',
        error: error.message || 'OpenRouter drafting failed'
      }
    };
  }
}

async function resolveInterviewMessage(job, context) {
  if (!openRouterApiKey()) return defaultInterviewMessage(context);
  try {
    const payload = object(job.payload);
    const response = await callOpenRouterJSON({
      system: `You are a ProfileScribe managed-agent interview agent.
Ask one concise question that helps the user provide source-backed professional evidence.
Do not claim work was done unless context proves it.
Return only JSON with keys: kind, body, status, summary, complete.`,
      user: JSON.stringify({
        task: 'Generate the next interview turn.',
        profile: compactProfile(context.profile),
        sources: compactSources(context.sources),
        sourceExtracts: compactSourceExtracts(context.sourceExtracts),
        timelineSearch: compactTimelineSearch(context.timelineSearch),
        jobPayload: payload
      }),
      maxTokens: 350
    });
    return {
      kind: text(response.kind) || 'question',
      body: text(response.body) || defaultInterviewMessage(context).body,
      status: text(response.status) || 'waiting_for_user',
      summary: text(response.summary),
      complete: Boolean(response.complete),
      metadata: {
        provider: 'openrouter',
        model: openRouterModel()
      }
    };
  } catch (error) {
    const fallback = defaultInterviewMessage(context);
    return {
      ...fallback,
      metadata: {
        provider: 'openrouter',
        model: openRouterModel(),
        status: 'fallback',
        error: error.message || 'OpenRouter interview failed'
      }
    };
  }
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

async function callOpenRouterJSON({ system, user, maxTokens }) {
  const apiKey = openRouterApiKey();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');

  const response = await fetch(openRouterChatCompletionsURL(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://profilescribe.com',
      'X-Title': 'ProfileScribe Rig'
    },
    body: JSON.stringify({
      model: openRouterModel(),
      temperature: 0.25,
      max_tokens: numberOr(maxTokens, 700),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  const envelope = parseJSON(body, 'OpenRouter response');
  const content = text(envelope?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('OpenRouter returned an empty message');
  }
  return parseJSON(extractJSONObject(content), 'OpenRouter JSON message');
}

async function loadSourceExtracts(sources, limit) {
  const selected = sources
    .filter((source) => text(source?.url))
    .slice(0, Math.min(numberOr(limit, 3), 5));
  const extracts = [];
  for (const source of selected) {
    extracts.push(await fetchSourceExtract(source));
  }
  return extracts;
}

async function fetchSourceExtract(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), numberOr(process.env.PROFILESCRIBE_RIG_SOURCE_FETCH_TIMEOUT_MS, 12000));
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ProfileScribeRig/1.0 (+https://profilescribe.com)'
      }
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      return compact({
        sourceId: source.id,
        label: source.label,
        url: source.url,
        status: `fetch failed: HTTP ${response.status}`
      });
    }
    const raw = await response.text();
    const title = htmlTitle(raw);
    const description = htmlMetaDescription(raw);
    const textContent = contentType.includes('html') ? htmlToText(raw) : raw;
    return compact({
      sourceId: source.id,
      label: source.label,
      kind: source.kind,
      url: source.url,
      title,
      description,
      excerpt: truncate(textContent, numberOr(process.env.PROFILESCRIBE_RIG_SOURCE_EXTRACT_CHARS, 2800))
    });
  } catch (error) {
    return compact({
      sourceId: source.id,
      label: source.label,
      url: source.url,
      status: `fetch failed: ${error.message || 'unknown error'}`
    });
  } finally {
    clearTimeout(timer);
  }
}

function openRouterApiKey() {
  return text(process.env.OPENROUTER_API_KEY);
}

function openRouterModel() {
  return text(process.env.PROFILESCRIBE_RIG_OPENROUTER_MODEL) ||
    text(process.env.PROFILESCRIBE_AGENT_CHAT_MODEL) ||
    DEFAULT_OPENROUTER_MODEL;
}

function openRouterChatCompletionsURL() {
  return text(process.env.PROFILESCRIBE_RIG_OPENROUTER_CHAT_COMPLETIONS_URL) ||
    text(process.env.PROFILESCRIBE_OPENROUTER_CHAT_COMPLETIONS_URL) ||
    DEFAULT_OPENROUTER_CHAT_COMPLETIONS_URL;
}

function compactProfile(profile) {
  const value = object(profile);
  return {
    identity: object(value.identity),
    experience: arrayOfObjects(value.experience).slice(0, 8),
    projects: arrayOfObjects(value.projects).slice(0, 8),
    skills: array(value.skills).slice(0, 20)
  };
}

function compactSources(sources) {
  return arrayOfObjects(sources).map((source) => compact({
    id: source.id,
    kind: source.kind,
    label: source.label,
    url: source.url,
    status: source.status,
    trustLevel: source.trustLevel,
    lastCheckedAt: source.lastCheckedAt
  }));
}

function compactSourceExtracts(extracts) {
  return arrayOfObjects(extracts).map((extract) => compact({
    sourceId: extract.sourceId,
    label: extract.label,
    kind: extract.kind,
    url: extract.url,
    title: extract.title,
    description: extract.description,
    excerpt: truncate(extract.excerpt, 2800),
    status: extract.status
  }));
}

function compactTimelineSearch(timelineSearch) {
  const value = object(timelineSearch);
  return compact({
    query: value.query,
    results: arrayOfObjects(value.results).slice(0, 6).map((post) => compact({
      topic: post.topic,
      body: truncate(post.body, 700),
      publishedAt: post.publishedAt,
      matchReasons: array(post.matchReasons).slice(0, 3)
    }))
  });
}

function comparablePostText(value) {
  return text(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .join(' ');
}

function sourceURLsForDraft(draft, context) {
  const wanted = new Set(array(draft.sourceIds).map((item) => text(item)).filter(Boolean));
  if (wanted.size === 0) return new Set();
  const urls = new Set();
  for (const source of arrayOfObjects(context.sources)) {
    if (wanted.has(text(source.id))) {
      const url = comparableURL(source.url);
      if (url) urls.add(url);
    }
  }
  return urls;
}

function sourceURLsForPost(post) {
  const urls = new Set();
  for (const source of arrayOfObjects(post.sources)) {
    const url = comparableURL(source.url);
    if (url) urls.add(url);
  }
  return urls;
}

function sourceURLSetsOverlap(left, right) {
  if (!left || !right || left.size === 0 || right.size === 0) return false;
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function comparableURL(value) {
  value = text(value);
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/+$/, '').toLowerCase();
  } catch {
    return value.replace(/\/+$/, '').toLowerCase();
  }
}

function duplicatePostSummary(post) {
  return compact({
    topic: text(post.topic),
    publishedAt: text(post.publishedAt),
    authorSlug: text(post.authorSlug)
  });
}

function isDuplicateTimelinePostError(error) {
  return text(error?.message || error)
    .toLowerCase()
    .includes('duplicates a recent published post');
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

function skipped(job, summary, metadata = {}) {
  return {
    status: 'skipped',
    jobId: text(job.id),
    jobKind: text(job.kind),
    summary,
    metadata: object(metadata)
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

function arrayOfObjects(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractJSONObject(raw) {
  let value = text(raw);
  if (value.startsWith('```')) {
    value = value.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  }
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return value.slice(start, end + 1);
  }
  return value;
}

function htmlTitle(raw) {
  const match = String(raw || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHTML(match[1]).trim() : '';
}

function htmlMetaDescription(raw) {
  const match = String(raw || '').match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    String(raw || '').match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  return match ? decodeHTML(match[1]).trim() : '';
}

function htmlToText(raw) {
  return decodeHTML(String(raw || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeHTML(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function truncate(value, limit) {
  const raw = text(value).replace(/\s+/g, ' ');
  const max = numberOr(limit, 1000);
  return raw.length > max ? `${raw.slice(0, max - 3)}...` : raw;
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
