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
  PROFILESCRIBE_RIG_OPENROUTER_MODEL   Optional OpenRouter model override for non-draft native tasks
  PROFILESCRIBE_RIG_DRAFT_MODEL        Optional OpenRouter model override for final post drafting
  PROFILESCRIBE_RIG_DRAFTER_COMMAND    Optional command that receives context JSON and returns draft JSON
  PROFILESCRIBE_RIG_INTERVIEW_COMMAND  Optional command that receives interview context JSON and returns message JSON
`;

const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash';
const DEFAULT_OPENROUTER_DRAFT_MODEL = 'anthropic/claude-opus-4.8';
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
  const draft = normalizeDraftSourceIds(
    await resolveDraft(job, context),
    context,
    numberOr(payload.maxSources, 3)
  );
  const submissionDraft = {
    ...draft,
    topic: resolveTimelinePostTopic(draft, payload)
  };
  if (!draft.body && !boolEnv('PROFILESCRIBE_RIG_ALLOW_HOSTED_DRAFT_FALLBACK')) {
    return {
      status: 'skipped',
      jobId: text(job.id),
      jobKind: text(job.kind),
      summary: 'No harness-composed body was available; leaving job as a no-op instead of publishing generic copy.',
      metadata: {
        checkedSources: context.sources.length,
        profileName: context.profile?.identity?.fullName || '',
        timelineBrief: compactTimelineBrief(context.timelineBrief),
        sourceOpportunities: compactSourceOpportunities(context.sourceOpportunities)
      }
    };
  }
  const duplicate = await findRecentDuplicateDraft(submissionDraft, context);
  if (duplicate) {
    return skipped(job, `A recent timeline post already covers this update: ${duplicate.topic || 'untitled post'}`, {
      duplicatePost: duplicate,
      topic: submissionDraft.topic,
      sourceIds: array(submissionDraft.sourceIds),
      checkedSources: context.sources.length,
      timelineBrief: compactTimelineBrief(context.timelineBrief),
      sourceOpportunities: compactSourceOpportunities(context.sourceOpportunities)
    });
  }

  let response;
  try {
    response = await callMCPTool('create_source_backed_timeline_post', compact({
      topic: submissionDraft.topic,
      body: submissionDraft.body || '',
      abstracts: array(submissionDraft.abstracts),
      tone: submissionDraft.tone || payload.tone || 'professional',
      maxSources: numberOr(payload.maxSources, 3),
      sourceIds: array(submissionDraft.sourceIds)
    }));
  } catch (error) {
    if (isDuplicateTimelinePostError(error)) {
      return skipped(job, 'A recent timeline post already covers this source-backed update.', {
        topic: submissionDraft.topic,
        sourceIds: array(submissionDraft.sourceIds),
        checkedSources: context.sources.length,
        timelineBrief: compactTimelineBrief(context.timelineBrief),
        sourceOpportunities: compactSourceOpportunities(context.sourceOpportunities)
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
      topic: submissionDraft.topic,
      sourceIds: array(submissionDraft.sourceIds),
      checkedSources: context.sources.length,
      timelineBrief: compactTimelineBrief(context.timelineBrief),
      sourceOpportunities: compactSourceOpportunities(context.sourceOpportunities),
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
  const sourceList = Array.isArray(sources) ? sources : [];
  let timelineSearch = null;
  const query = text(payload.topic || profile?.identity?.headline || profile?.identity?.fullName);
  if (query) {
    try {
      timelineSearch = await callMCPTool('search_timeline_posts', { query, limit: 8 });
    } catch {
      timelineSearch = null;
    }
  }
  const timelineBrief = await buildTimelineBrief({
    payload,
    profile,
    sources: sourceList,
    primarySearch: timelineSearch
  });
  const sourceOpportunities = buildSourceOpportunities({
    payload,
    sources: sourceList,
    timelineBrief
  });
  return {
    profile,
    sources: sourceList,
    timelineSearch,
    timelineBrief,
    sourceOpportunities,
    sourceExtracts: shouldLoadSourceExtracts()
      ? await loadSourceExtracts(
        selectSourcesForDiscovery(sourceList, sourceOpportunities, payload),
        numberOr(process.env.PROFILESCRIBE_RIG_SOURCE_DISCOVERY_LIMIT, 8)
      )
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

function normalizeDraftSourceIds(draft, context, maxSources) {
  draft = object(draft);
  const rawSourceIds = array(draft.sourceIds);
  const normalized = normalizeSourceIds(rawSourceIds, context.sources, maxSources);
  const metadata = object(draft.metadata);
  if (normalized.changed) {
    metadata.sourceIdNormalization = compact({
      requested: rawSourceIds,
      submitted: normalized.ids,
      dropped: normalized.dropped
    });
  }
  return {
    ...draft,
    sourceIds: normalized.ids,
    metadata
  };
}

function resolveTimelinePostTopic(draft, payload) {
  draft = object(draft);
  payload = object(payload);
  const candidates = [
    text(draft.topic),
    text(payload.topic),
    ...array(draft.abstracts),
    topicFromBody(draft.body)
  ];

  for (const candidate of candidates) {
    const topic = sanitizeTimelinePostTopic(candidate);
    if (topic) return topic;
  }
  return '';
}

function sanitizeTimelinePostTopic(value) {
  const topic = text(value)
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
  if (!topic || isPostInstructionTopic(topic)) return '';
  return truncate(topic, 96);
}

function topicFromBody(value) {
  const body = text(value).replace(/\s+/g, ' ');
  if (!body) return '';
  return body.split(/[.!?]\s+/)[0] || body;
}

function isPostInstructionTopic(value) {
  const topic = comparablePostText(value);
  if (!topic) return false;
  if (/^(please )?(publish|post|create|write|draft|make|generate|add|send|share) (a |an |one |another |new |more )?(source backed |profile scribe |timeline )*(post|update)\b/.test(topic)) {
    return true;
  }
  if (/^(please )?(publish|post|create|write|draft|make|generate|add|send|share)\b.*\b(profile scribe post|timeline post|post|update)\b/.test(topic)) {
    return true;
  }
  if (/\b(one more|another|new|more)\b.*\b(profile scribe post|timeline post|post)\b/.test(topic)) {
    return true;
  }
  return false;
}

function normalizeSourceIds(sourceIds, sources, maxSources) {
  const sourceList = arrayOfObjects(sources);
  const approvedIDs = sourceList
    .map((source) => text(source.id))
    .filter(Boolean);
  const limit = numberOr(maxSources, 3);
  const ids = [];
  const seen = new Set();
  const dropped = [];

  for (const rawID of array(sourceIds)) {
    const sourceID = resolveApprovedSourceId(rawID, approvedIDs);
    if (!sourceID) {
      dropped.push(rawID);
      continue;
    }
    if (seen.has(sourceID)) continue;
    ids.push(sourceID);
    seen.add(sourceID);
    if (limit > 0 && ids.length >= limit) break;
  }

  return {
    ids,
    dropped,
    changed: dropped.length > 0 || ids.join('\n') !== array(sourceIds).join('\n')
  };
}

function resolveApprovedSourceId(rawID, approvedIDs) {
  const sourceID = text(rawID);
  if (!sourceID) return '';
  if (approvedIDs.includes(sourceID)) return sourceID;

  const sourceIDLower = sourceID.toLowerCase();
  const prefixMatches = approvedIDs.filter((approvedID) =>
    approvedID.toLowerCase().startsWith(sourceIDLower)
  );
  if (prefixMatches.length === 1) return prefixMatches[0];
  return '';
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
      candidates.push(normalizeTimelinePost(post));
    }
  }
  for (const post of arrayOfObjects(context.timelineBrief?.recentPosts)) {
    const normalized = normalizeTimelinePost(post);
    const key = text(normalized.id || `${normalized.authorSlug}:${normalized.topic}:${normalized.publishedAt}`);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    candidates.push(normalized);
  }
  for (const post of arrayOfObjects(context.timelineBrief?.relatedPosts)) {
    const normalized = normalizeTimelinePost(post);
    const key = text(normalized.id || `${normalized.authorSlug}:${normalized.topic}:${normalized.publishedAt}`);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    candidates.push(normalized);
  }

  for (const post of candidates) {
    const reason = duplicateReasonForDraft(draft, post, context);
    if (reason) {
      return duplicatePostSummary(post, reason);
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

async function buildTimelineBrief({ payload, profile, sources, primarySearch }) {
  const searches = [];
  if (object(primarySearch).results) searches.push(object(primarySearch));

  const searchLimit = numberOr(process.env.PROFILESCRIBE_RIG_TIMELINE_SEARCH_LIMIT, 12);
  const seenQueries = new Set();
  for (const query of timelineBriefQueries(payload, profile, sources)) {
    const comparable = comparablePostText(query);
    if (!comparable || seenQueries.has(comparable)) continue;
    seenQueries.add(comparable);
    const result = await searchTimelinePosts(query, searchLimit);
    if (result) searches.push(result);
    if (seenQueries.size >= numberOr(process.env.PROFILESCRIBE_RIG_TIMELINE_QUERY_LIMIT, 8)) break;
  }

  const discovered = await discoverTimelinePosts(numberOr(process.env.PROFILESCRIBE_RIG_TIMELINE_DISCOVER_LIMIT, 24));
  if (discovered) searches.push(discovered);

  const posts = dedupeTimelinePosts(searches.flatMap(timelinePostsFromResult))
    .sort((left, right) => timestamp(right.publishedAt) - timestamp(left.publishedAt));
  return summarizeTimelineBrief(posts, sources);
}

function timelineBriefQueries(payload, profile, sources) {
  payload = object(payload);
  const identity = object(profile?.identity);
  const sourceList = arrayOfObjects(sources);
  const selectedSourceIDs = new Set(array(payload.sourceIds));
  const selectedSources = sourceList.filter((source) => selectedSourceIDs.has(text(source.id)));
  const sourceCandidates = selectedSources.length > 0 ? selectedSources : sourceList;
  return [
    text(payload.topic),
    text(identity.fullName),
    text(identity.headline),
    text(identity.company || identity.currentCompany),
    ...sourceCandidates.slice(0, 6).map((source) => text(source.label || source.url))
  ].filter((value) => value && !isPostInstructionTopic(value));
}

async function discoverTimelinePosts(limit) {
  try {
    return await callMCPTool('discover_timeline_posts', { limit });
  } catch {
    return null;
  }
}

function timelinePostsFromResult(result) {
  result = object(result);
  return [
    ...arrayOfObjects(result.results),
    ...arrayOfObjects(result.posts),
    ...arrayOfObjects(result.timelinePosts)
  ].map(normalizeTimelinePost).filter((post) => post.topic || post.body);
}

function dedupeTimelinePosts(posts) {
  const seen = new Set();
  const out = [];
  for (const post of posts) {
    const key = text(post.id || post.postId) ||
      comparablePostText(`${post.authorSlug}:${post.topic}:${post.publishedAt}:${truncate(post.body, 120)}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(post);
  }
  return out;
}

function normalizeTimelinePost(post) {
  post = object(post);
  return compact({
    id: text(post.id || post.postId || post.draftId),
    postId: text(post.postId || post.id || post.draftId),
    topic: text(post.topic || post.title || post.headline),
    body: text(post.body || post.text || post.content),
    publishedAt: text(post.publishedAt || post.createdAt || post.updatedAt),
    authorSlug: text(post.authorSlug || post.slug),
    url: text(post.url || post.href),
    matchReasons: array(post.matchReasons).slice(0, 4),
    sources: normalizeTimelinePostSources(post)
  });
}

function normalizeTimelinePostSources(post) {
  const sources = arrayOfObjects(post.sources).map((source) => compact({
    id: text(source.id || source.sourceId),
    label: text(source.label || source.name || source.title),
    url: text(source.url || source.href)
  }));
  const sourceLabels = array(post.sourceLabels).map((label) => compact({ label }));
  const sourceUrls = array(post.sourceUrls).map((url) => compact({ url }));
  return [...sources, ...sourceLabels, ...sourceUrls];
}

function summarizeTimelineBrief(posts, sources) {
  const recentPosts = posts.slice(0, numberOr(process.env.PROFILESCRIBE_RIG_TIMELINE_BRIEF_POST_LIMIT, 16));
  const repeatedTopics = repeatedTimelineTopics(recentPosts);
  const repeatedOpenings = repeatedTimelineOpenings(recentPosts);
  const coveredSources = timelineCoveredSources(recentPosts, sources);
  const avoidAngles = timelineAvoidAngles(repeatedTopics, repeatedOpenings, coveredSources);
  const directionTerms = timelineDirectionTerms(recentPosts);

  return compact({
    status: recentPosts.length > 0 ? 'available' : 'empty',
    checkedPostCount: recentPosts.length,
    directionTerms,
    coveredSources,
    repeatedTopics,
    repeatedOpenings,
    avoidAngles,
    recentPosts: recentPosts.map((post) => compact({
      id: post.id || post.postId,
      topic: post.topic,
      body: truncate(post.body, 700),
      publishedAt: post.publishedAt,
      authorSlug: post.authorSlug,
      url: post.url,
      sources: post.sources,
      matchReasons: post.matchReasons
    }))
  });
}

function repeatedTimelineTopics(posts) {
  const groups = groupTimelinePosts(posts, (post) => comparablePostText(post.topic));
  return [...groups.values()]
    .filter((group) => group.key && group.posts.length > 1)
    .map((group) => compact({
      topic: group.posts[0].topic,
      count: group.posts.length,
      posts: compactPostRefs(group.posts)
    }));
}

function repeatedTimelineOpenings(posts) {
  const groups = groupTimelinePosts(posts, (post) => openingSignature(post.body, 10));
  return [...groups.values()]
    .filter((group) => group.key && group.posts.length > 1)
    .map((group) => compact({
      opening: truncate(firstSentence(group.posts[0].body), 140),
      count: group.posts.length,
      posts: compactPostRefs(group.posts)
    }));
}

function timelineCoveredSources(posts, sources) {
  const sourceList = arrayOfObjects(sources);
  const sourceStats = new Map();
  for (const source of sourceList) {
    const sourceKey = sourceComparableRef(source.label || source.url || source.id);
    if (!sourceKey) continue;
    sourceStats.set(sourceKey, {
      id: text(source.id),
      label: text(source.label || source.url || source.id),
      url: text(source.url),
      count: 0,
      posts: []
    });
  }

  for (const post of posts) {
    const refs = sourceRefsForPost(post, { sources: sourceList });
    for (const [key, stat] of sourceStats) {
      if (!refs.has(key)) continue;
      stat.count += 1;
      stat.posts.push(post);
    }
  }

  return [...sourceStats.values()]
    .filter((stat) => stat.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 10)
    .map((stat) => compact({
      id: stat.id,
      label: stat.label,
      url: stat.url,
      count: stat.count,
      latestPost: compactPostRefs(stat.posts.slice(0, 1))[0]
    }));
}

function timelineAvoidAngles(repeatedTopics, repeatedOpenings, coveredSources) {
  return [
    ...arrayOfObjects(repeatedTopics).slice(0, 4).map((item) =>
      `Do not reuse the recent topic "${item.topic}".`
    ),
    ...arrayOfObjects(repeatedOpenings).slice(0, 4).map((item) =>
      `Do not reuse the opening/story shape "${item.opening}".`
    ),
    ...arrayOfObjects(coveredSources)
      .filter((item) => Number(item.count) > 1)
      .slice(0, 6)
      .map((item) => `${item.label} has already appeared in ${item.count} recent posts; require a materially new angle.`)
  ];
}

function timelineDirectionTerms(posts) {
  const counts = new Map();
  for (const post of posts) {
    for (const token of meaningfulTokens(`${post.topic} ${post.body}`)) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 16)
    .map(([term, count]) => ({ term, count }));
}

function groupTimelinePosts(posts, keyFn) {
  const groups = new Map();
  for (const post of posts) {
    const key = text(keyFn(post));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { key, posts: [] });
    groups.get(key).posts.push(post);
  }
  return groups;
}

function compactPostRefs(posts) {
  return arrayOfObjects(posts).map((post) => compact({
    id: post.id || post.postId,
    topic: post.topic,
    publishedAt: post.publishedAt,
    url: post.url
  }));
}

function buildSourceOpportunities({ payload, sources, timelineBrief }) {
  payload = object(payload);
  const sourceList = arrayOfObjects(sources).filter((source) => text(source.url));
  const selectedSourceIDs = new Set(array(payload.sourceIds));
  const payloadTopic = comparablePostText(payload.topic);
  const coveredSources = arrayOfObjects(timelineBrief?.coveredSources);

  return sourceList
    .map((source, index) => {
      const coverage = coverageForSource(source, coveredSources);
      const coverageCount = Number(coverage.count || 0);
      const selected = selectedSourceIDs.has(text(source.id));
      const topicMatched = sourceMatchesTopic(source, payloadTopic);
      const reasons = [];
      let score = Math.max(0, 100 - index);

      if (selected) {
        score += 120;
        reasons.push('explicitly requested');
      }
      if (topicMatched) {
        score += 60;
        reasons.push('matches requested topic');
      }
      if (coverageCount === 0) {
        score += 45;
        reasons.push('not covered in recent timeline brief');
      } else if (coverageCount === 1) {
        score += 12;
        reasons.push('lightly covered recently');
      } else {
        score -= coverageCount * 16;
        reasons.push(`covered ${coverageCount} times recently`);
      }

      const recency = sourceRecencyScore(source);
      if (recency.score > 0) {
        score += recency.score;
        reasons.push(recency.reason);
      }
      if (comparablePostText(source.trustLevel).includes('high')) {
        score += 6;
        reasons.push('high-trust source');
      }
      if (/monitor|active|approved/i.test(text(source.status))) {
        score += 4;
        reasons.push('active approved source');
      }
      if (isBroadProfileSource(source)) {
        score -= 10;
        reasons.push('broad profile source');
      }

      return compact({
        sourceId: text(source.id),
        label: text(source.label || source.url),
        url: text(source.url),
        kind: text(source.kind),
        score,
        coverageCount,
        latestPost: coverage.latestPost,
        reasons: reasons.slice(0, 5)
      });
    })
    .sort((left, right) => Number(right.score) - Number(left.score))
    .slice(0, numberOr(process.env.PROFILESCRIBE_RIG_SOURCE_OPPORTUNITY_LIMIT, 12));
}

function coverageForSource(source, coveredSources) {
  const refs = new Set([
    sourceComparableRef(source.id),
    sourceComparableRef(source.label),
    sourceComparableRef(source.url)
  ].filter(Boolean));
  for (const covered of arrayOfObjects(coveredSources)) {
    for (const value of [covered.id, covered.label, covered.url]) {
      const ref = sourceComparableRef(value);
      if (ref && refs.has(ref)) return covered;
    }
  }
  return {};
}

function sourceMatchesTopic(source, payloadTopic) {
  if (!payloadTopic) return false;
  return [source.label, source.url, source.kind]
    .map(comparablePostText)
    .some((value) => value && (payloadTopic.includes(value) || value.includes(payloadTopic)));
}

function sourceRecencyScore(source) {
  const candidates = [
    source.lastCheckedAt,
    source.lastObservedAt,
    source.updatedAt,
    source.createdAt
  ].map(timestamp).filter((value) => value > 0);
  if (candidates.length === 0) return { score: 0, reason: '' };
  const latest = Math.max(...candidates);
  const ageHours = (Date.now() - latest) / (1000 * 60 * 60);
  if (ageHours <= 48) return { score: 14, reason: 'checked in the last 48 hours' };
  if (ageHours <= 24 * 7) return { score: 8, reason: 'checked in the last week' };
  if (ageHours <= 24 * 30) return { score: 3, reason: 'checked in the last month' };
  return { score: 0, reason: '' };
}

function isBroadProfileSource(source) {
  const url = text(source.url).toLowerCase();
  const label = comparablePostText(source.label);
  return url.includes('linkedin.com/in/') ||
    url.includes('github.com/abrahamgreenman') ||
    url.includes('github.com/charliegreenman') ||
    label === 'github repositories';
}

function selectSourcesForDiscovery(sources, opportunities, payload) {
  const sourceList = arrayOfObjects(sources);
  const byID = new Map(sourceList.map((source) => [text(source.id), source]));
  const selectedSourceIDs = new Set(array(object(payload).sourceIds));
  const selected = sourceList.filter((source) => selectedSourceIDs.has(text(source.id)));
  const ranked = arrayOfObjects(opportunities)
    .map((opportunity) => byID.get(text(opportunity.sourceId)))
    .filter(Boolean);

  const out = [];
  const seen = new Set();
  for (const source of [...selected, ...ranked, ...sourceList]) {
    const id = text(source.id || source.url);
    if (!id || seen.has(id) || !text(source.url)) continue;
    seen.add(id);
    out.push(source);
    if (out.length >= numberOr(process.env.PROFILESCRIBE_RIG_SOURCE_DISCOVERY_LIMIT, 8)) break;
  }
  return out;
}

async function resolveDraftWithOpenRouter(job, context) {
  if (!openRouterApiKey()) return {};
  try {
    const payload = object(job.payload);
    const model = openRouterDraftModel();
    const response = await callOpenRouterJSON({
      model,
      system: `You are a ProfileScribe source-backed posting agent.
Draft concise professional timeline posts only from the provided profile, approved source metadata, source extracts, and timeline history.
Before drafting, inspect timelineBrief to understand the recent timeline direction, sources already covered, repeated openings, repeated topics, and angles to avoid.
Then inspect sourceOpportunities and sourceExtracts to discover the strongest under-covered source-backed posting angle on your own.
Do not invent accomplishments, credentials, numbers, affiliations, launches, or claims.
Do not create a post that repeats the same source plus the same claim, fact pattern, story shape, or title from timelineBrief.
Prefer under-covered approved sources when they support a concrete professional point.
Return an empty body only after evaluating the ranked sourceOpportunities and finding no supported, non-repetitive angle.
Return only JSON with keys: topic, body, abstracts, tone, sourceIds.`,
      user: JSON.stringify({
        task: 'Discover and draft one fresh source-backed ProfileScribe timeline post.',
        constraints: {
          topic: 'specific public post headline, maximum 96 characters; describe the update itself, never the user request or posting action',
          badTopics: [
            'publish one more profile scribe post',
            'create another post for my profile scribe',
            'write a timeline post'
          ],
          body: 'plain text, specific, professional, maximum 900 characters',
          abstracts: '1-3 short evidence summary lines',
          tone: 'short tone label',
          sourceIds: 'Exact full source.id values from the approved sources used; never shorten or truncate IDs; use at most maxSources',
          maxSources: numberOr(payload.maxSources, 3),
          discovery: 'Use sourceOpportunities as the ranked discovery queue. Prefer high-scoring sources with low recent coverage. Source extracts contain the evidence you can use.',
          skipWhenWeak: 'Return empty body only if every discovered opportunity is generic, stale, missing, not professionally meaningful, or already covered by the recent timeline.',
          differentiation: 'If reusing a recently covered source, draft only when the post has a materially new angle that is visible in the final body.'
        },
        profile: compactProfile(context.profile),
        sources: compactSources(context.sources),
        sourceOpportunities: compactSourceOpportunities(context.sourceOpportunities),
        sourceExtracts: compactSourceExtracts(context.sourceExtracts),
        timelineSearch: compactTimelineSearch(context.timelineSearch),
        timelineBrief: compactTimelineBrief(context.timelineBrief),
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
        model
      }
    };
  } catch (error) {
    return {
      metadata: {
        provider: 'openrouter',
        model: openRouterDraftModel(),
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
        sourceOpportunities: compactSourceOpportunities(context.sourceOpportunities),
        sourceExtracts: compactSourceExtracts(context.sourceExtracts),
        timelineSearch: compactTimelineSearch(context.timelineSearch),
        timelineBrief: compactTimelineBrief(context.timelineBrief),
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

async function callOpenRouterJSON({ model, system, user, maxTokens }) {
  const apiKey = openRouterApiKey();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');
  model = text(model) || openRouterModel();

  const response = await fetch(openRouterChatCompletionsURL(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://profilescribe.com',
      'X-Title': 'ProfileScribe Rig'
    },
    body: JSON.stringify({
      model,
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
    .slice(0, Math.min(numberOr(limit, 3), 10));
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

function shouldLoadSourceExtracts() {
  return Boolean(openRouterApiKey() || text(process.env.PROFILESCRIBE_RIG_DRAFTER_COMMAND));
}

function openRouterModel() {
  return text(process.env.PROFILESCRIBE_RIG_OPENROUTER_MODEL) ||
    text(process.env.PROFILESCRIBE_AGENT_CHAT_MODEL) ||
    DEFAULT_OPENROUTER_MODEL;
}

function openRouterDraftModel() {
  return text(process.env.PROFILESCRIBE_RIG_DRAFT_MODEL) ||
    DEFAULT_OPENROUTER_DRAFT_MODEL;
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

function compactSourceOpportunities(opportunities) {
  return arrayOfObjects(opportunities).slice(0, 12).map((opportunity) => compact({
    sourceId: opportunity.sourceId,
    label: opportunity.label,
    url: opportunity.url,
    kind: opportunity.kind,
    score: opportunity.score,
    coverageCount: opportunity.coverageCount,
    latestPost: opportunity.latestPost,
    reasons: array(opportunity.reasons).slice(0, 5)
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

function compactTimelineBrief(timelineBrief) {
  const value = object(timelineBrief);
  return compact({
    status: value.status,
    checkedPostCount: value.checkedPostCount,
    directionTerms: arrayOfObjects(value.directionTerms).slice(0, 12),
    coveredSources: arrayOfObjects(value.coveredSources).slice(0, 8),
    repeatedTopics: arrayOfObjects(value.repeatedTopics).slice(0, 6),
    repeatedOpenings: arrayOfObjects(value.repeatedOpenings).slice(0, 6),
    avoidAngles: array(value.avoidAngles).slice(0, 12),
    recentPosts: arrayOfObjects(value.recentPosts).slice(0, 10).map((post) => compact({
      id: post.id || post.postId,
      topic: post.topic,
      body: truncate(post.body, 500),
      publishedAt: post.publishedAt,
      authorSlug: post.authorSlug,
      url: post.url,
      sources: arrayOfObjects(post.sources).slice(0, 4)
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

function duplicateReasonForDraft(draft, post, context) {
  const draftBody = comparablePostText(draft.body);
  const postBody = comparablePostText(post.body);
  const draftTopic = comparablePostText(draft.topic);
  const postTopic = comparablePostText(post.topic);
  const sameSource = sourceRefSetsOverlap(
    sourceRefsForDraft(draft, context),
    sourceRefsForPost(post, context)
  );

  if (draftBody && postBody && draftBody === postBody) {
    return { kind: 'exact_body', confidence: 'high' };
  }
  if (draftTopic && postTopic && draftTopic === postTopic && sameSource) {
    return { kind: 'same_topic_and_source', confidence: 'high' };
  }

  const keywordOverlap = meaningfulTokenOverlap(draft.body, post.body);
  const shingleSimilarity = textShingleSimilarity(draft.body, post.body, 4);
  const sameOpening = openingSignature(draft.body, 10) &&
    openingSignature(draft.body, 10) === openingSignature(post.body, 10);
  const topicOverlap = meaningfulTokenOverlap(draft.topic, post.topic);

  if (sameSource && keywordOverlap >= 0.48) {
    return {
      kind: 'same_source_same_claims',
      confidence: keywordOverlap >= 0.62 ? 'high' : 'medium',
      keywordOverlap: round(keywordOverlap),
      shingleSimilarity: round(shingleSimilarity)
    };
  }
  if (sameSource && shingleSimilarity >= 0.34) {
    return {
      kind: 'same_source_near_duplicate_body',
      confidence: 'medium',
      keywordOverlap: round(keywordOverlap),
      shingleSimilarity: round(shingleSimilarity)
    };
  }
  if (shingleSimilarity >= 0.52) {
    return {
      kind: 'near_duplicate_body',
      confidence: 'medium',
      keywordOverlap: round(keywordOverlap),
      shingleSimilarity: round(shingleSimilarity)
    };
  }
  if (sameOpening && keywordOverlap >= 0.35) {
    return {
      kind: 'repeated_opening_and_story_shape',
      confidence: 'medium',
      keywordOverlap: round(keywordOverlap),
      shingleSimilarity: round(shingleSimilarity)
    };
  }
  if (sameSource && topicOverlap >= 0.68 && keywordOverlap >= 0.28) {
    return {
      kind: 'same_source_same_angle',
      confidence: 'medium',
      topicOverlap: round(topicOverlap),
      keywordOverlap: round(keywordOverlap)
    };
  }
  return null;
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

function sourceRefsForDraft(draft, context) {
  const wanted = new Set(array(draft.sourceIds).map((item) => text(item)).filter(Boolean));
  const refs = new Set();
  if (wanted.size === 0) return refs;
  for (const source of arrayOfObjects(context.sources)) {
    const id = text(source.id);
    if (!wanted.has(id)) continue;
    for (const value of [id, source.label, source.url]) {
      const ref = sourceComparableRef(value);
      if (ref) refs.add(ref);
    }
  }
  return refs;
}

function sourceRefsForPost(post, context) {
  const refs = new Set();
  const values = [];
  for (const source of arrayOfObjects(post.sources)) {
    values.push(source.id, source.sourceId, source.label, source.name, source.title, source.url, source.href);
  }
  for (const value of values) {
    const ref = sourceComparableRef(value);
    if (ref) refs.add(ref);
  }

  const haystack = comparablePostText(`${post.topic} ${post.body}`);
  for (const source of arrayOfObjects(context.sources)) {
    const label = comparablePostText(source.label);
    if (label && haystack.includes(label)) {
      refs.add(sourceComparableRef(source.label));
      refs.add(sourceComparableRef(source.url));
      refs.add(sourceComparableRef(source.id));
    }
  }
  return refs;
}

function sourceRefSetsOverlap(left, right) {
  if (!left || !right || left.size === 0 || right.size === 0) return false;
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function sourceComparableRef(value) {
  value = text(value);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return comparableURL(value);
  return comparablePostText(value);
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

function duplicatePostSummary(post, reason = {}) {
  return compact({
    topic: text(post.topic),
    publishedAt: text(post.publishedAt),
    authorSlug: text(post.authorSlug),
    postId: text(post.postId || post.id),
    duplicateReason: object(reason)
  });
}

function timestamp(value) {
  const time = Date.parse(text(value));
  return Number.isFinite(time) ? time : 0;
}

function firstSentence(value) {
  const body = text(value).replace(/\s+/g, ' ');
  if (!body) return '';
  return body.split(/[.!?]\s+/)[0] || body;
}

function openingSignature(value, limit) {
  return meaningfulTokens(firstSentence(value)).slice(0, numberOr(limit, 10)).join(' ');
}

function meaningfulTokenOverlap(left, right) {
  const leftTokens = new Set(meaningfulTokens(left));
  const rightTokens = new Set(meaningfulTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

function textShingleSimilarity(left, right, size) {
  const leftShingles = shingles(left, size);
  const rightShingles = shingles(right, size);
  if (leftShingles.size === 0 || rightShingles.size === 0) return 0;
  let intersection = 0;
  for (const shingle of leftShingles) {
    if (rightShingles.has(shingle)) intersection += 1;
  }
  return intersection / (leftShingles.size + rightShingles.size - intersection);
}

function shingles(value, size) {
  const tokens = comparablePostText(value).split(' ').filter(Boolean);
  const width = numberOr(size, 4);
  const out = new Set();
  for (let index = 0; index <= tokens.length - width; index += 1) {
    out.add(tokens.slice(index, index + width).join(' '));
  }
  if (out.size === 0 && tokens.length > 0) out.add(tokens.join(' '));
  return out;
}

function meaningfulTokens(value) {
  const stopWords = new Set([
    'about', 'above', 'after', 'again', 'also', 'another', 'around', 'because',
    'been', 'before', 'being', 'between', 'both', 'could', 'does', 'doing',
    'done', 'each', 'from', 'have', 'into', 'just', 'more', 'most', 'need',
    'needs', 'only', 'over', 'post', 'posts', 'profile', 'public', 'right',
    'same', 'show', 'still', 'that', 'their', 'there', 'these', 'thing',
    'this', 'through', 'timeline', 'under', 'update', 'useful', 'what',
    'when', 'where', 'which', 'while', 'with', 'work', 'working', 'would',
    'your', 'the', 'and', 'for', 'can', 'not', 'one', 'two', 'three'
  ]);
  return comparablePostText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
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
