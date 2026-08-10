#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const temporaryDirectory = mkdtempSync(
  join(tmpdir(), 'profilescribe-rig-opportunity-tournament-')
);
const providerCalls = [];
const mcpCalls = [];
const generatorCallsByObjective = new Map();
const unexpectedRequests = [];
const usage = {
  prompt_tokens: 1200,
  completion_tokens: 900,
  total_tokens: 2100,
  cost: 0.0042
};

const server = createServer(async (request, response) => {
  let raw = '';
  for await (const chunk of request) raw += chunk;

  if (request.url === '/mcp') {
    const envelope = JSON.parse(raw || '{}');
    const name = envelope?.params?.name || '';
    mcpCalls.push({
      name,
      arguments: envelope?.params?.arguments || {}
    });
    const results = {
      read_profile: {
        identity: {
          fullName: 'Casey Founder',
          website: 'https://example.com/'
        }
      },
      read_sources: [{
        id: 'src-run-job-revenue',
        kind: 'website',
        label: 'Paid diagnostic page',
        url: 'https://example.com/diagnostic',
        status: 'approved',
        trustLevel: 'high'
      }],
      read_source_evidence: [{
        observationId: 'obs-run-job-revenue',
        sourceId: 'src-run-job-revenue',
        kind: 'service-page',
        title: 'Paid client-delivery diagnostic booking page',
        summary:
          'Professional-service clients seeking delivery consulting arrive through organic search at the paid client-delivery diagnostic booking page, where they can book and pay $500 for a paid client-delivery diagnostic. One paid booking is recorded, and the booking record source field stores the organic-search UTM campaign.',
        url: 'https://example.com/diagnostic',
        observedAt: '2026-07-29T12:00:00Z',
        confidence: 'high'
      }],
      search_timeline_posts: {
        results: [{
          authorSlug: 'unrelated-user',
          topic: 'Foreign timeline evidence must not enter the tournament'
        }]
      },
      discover_timeline_posts: {
        posts: [{
          authorSlug: 'unrelated-user',
          topic: 'Foreign timeline evidence must not enter the tournament'
        }]
      }
    };
    if (!(name in results)) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        error: { message: `unexpected MCP tool ${name}` }
      }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      jsonrpc: '2.0',
      id: envelope.id || 1,
      result: {
        content: [{ type: 'text', text: JSON.stringify(results[name]) }]
      }
    }));
    return;
  }

  if (request.url !== '/openrouter') {
    unexpectedRequests.push({ method: request.method, url: request.url });
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      error: { message: 'unexpected non-OpenRouter request' }
    }));
    return;
  }

  const envelope = JSON.parse(raw || '{}');
  const schemaName =
    envelope.response_format?.json_schema?.name || '';
  const userMessage = envelope.messages?.find(
    (message) => message.role === 'user'
  )?.content || '{}';
  const input = JSON.parse(userMessage);
  providerCalls.push({ envelope, input, schemaName });

  let data;
  if (schemaName === 'opportunity_tournament_critic_v1') {
    data = criticResponse(input.finalists || []);
  } else {
    const objectiveID = input.objective?.id || 'unknown-objective';
    const callCount =
      (generatorCallsByObjective.get(objectiveID) || 0) + 1;
    generatorCallsByObjective.set(objectiveID, callCount);
    if (objectiveID === 'objective-run-job-repair' && callCount === 1) {
      data = { seedContract: 'unsupported_seed_contract' };
    } else {
      const evidenceRef = (input.evidenceCatalog || [])
        .map((item) => item.id)
        .find((id) => id === 'observation:obs-run-job-revenue');
      data = generatorResponse(evidenceRef);
    }
  }

  const content = JSON.stringify(data);
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({
    id: `gen-run-job-${providerCalls.length}`,
    choices: [{
      finish_reason: 'stop',
      native_finish_reason: 'stop',
      message: { content }
    }],
    usage
  }));
});

try {
  await new Promise((resolveListen) =>
    server.listen(0, '127.0.0.1', resolveListen)
  );
  const port = server.address().port;

  const successJob = tournamentJob(
    'success',
    'objective-run-job-success'
  );
  const successFile = writeJob('success', successJob);
  const successCallOffset = providerCalls.length;
  const success = await runJob(successFile, port);
  const successCalls = providerCalls.slice(successCallOffset);
  verifySuccessfulTournament(success, successJob, successCalls);

  const repairJob = tournamentJob(
    'repair',
    'objective-run-job-repair'
  );
  const repairFile = writeJob('repair', repairJob);
  const repairCallOffset = providerCalls.length;
  const repair = await runJob(repairFile, port);
  const repairCalls = providerCalls.slice(repairCallOffset);
  verifyRepairDisplacesCritic(repair, repairCalls);

  const dryRunJob = tournamentJob(
    'dry-run',
    'objective-run-job-dry-run'
  );
  const dryRunFile = writeJob('dry-run', dryRunJob);
  const dryRunCallOffset = providerCalls.length;
  const dryRun = await runJob(dryRunFile, port, {
    args: ['--dry-run']
  });
  assertEqual(
    providerCalls.length,
    dryRunCallOffset,
    'dry run made a provider call'
  );
  verifyDryRun(dryRun);

  const scopedContextJob = tournamentJob(
    'scoped-context',
    'objective-run-job-scoped-context'
  );
  delete scopedContextJob.payload.evidenceSnapshot;
  const scopedContextFile = writeJob('scoped-context', scopedContextJob);
  const scopedContextCallOffset = mcpCalls.length;
  const scopedContext = await runJob(scopedContextFile, port, {
    mcpURL: `http://127.0.0.1:${port}/mcp`
  });
  verifyTournamentContextIsolation(
    scopedContext,
    mcpCalls.slice(scopedContextCallOffset)
  );

  const missingKeyJob = tournamentJob(
    'missing-key',
    'objective-run-job-missing-key'
  );
  const missingKeyFile = writeJob('missing-key', missingKeyJob);
  const missingKeyCallOffset = providerCalls.length;
  const missingKey = await runJob(missingKeyFile, port, {
    apiKey: ''
  });
  assertEqual(
    providerCalls.length,
    missingKeyCallOffset,
    'missing-key preflight made a provider call'
  );
  verifyMissingKeyPreflight(missingKey);

  assertEqual(
    unexpectedRequests.length,
    0,
    `run-job issued unexpected requests: ${JSON.stringify(unexpectedRequests)}`
  );

  console.log(
    'profile-scribe-rig opportunity tournament run-job smoke check passed.'
  );
} finally {
  server.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function tournamentJob(label, objectiveID) {
  return {
    id: `job-run-job-${label}`,
    kind: 'opportunity_tournament',
    tenantId: 'tenant-run-job-smoke',
    userId: 'user-run-job-smoke',
    payload: {
      tournamentId: `tournament-run-job-${label}`,
      algorithmVersion: 'cheap_tournament_v5',
      researchOnly: true,
      objective: {
        id: objectiveID,
        outcome: 'Generate one new attributed paid diagnostic booking.',
        successMetric:
          'One paid booking receipt attributed to organic search.',
        targetCount: 1,
        allowedActions: ['research', 'recommend', 'review'],
        constraints: [
          'Research and recommendation only; do not contact, message, publish, purchase ads, or submit forms.'
        ]
      },
      budget: {
        currency: 'USD',
        maxSpendMicros: 2_000_000,
        maxLLMSpendMicros: 1_000_000,
        maxHypotheses: 512,
        maxFinalists: 8,
        maxLLMCalls: 2,
        maxOutputTokens: 8000,
        hardStop: true
      },
      commercialContext: {
        allowedChannels: ['organic search'],
        allowedActions: ['research', 'recommend', 'review'],
        permissionRequired: 'explicit_user_approval'
      },
      evidenceSnapshot: {
        profile: {
          identity: {
            fullName: 'Casey Founder',
            website: 'https://example.com/'
          }
        },
        sources: [{
          id: 'src-run-job-revenue',
          kind: 'website',
          label: 'Paid diagnostic page',
          url: 'https://example.com/diagnostic',
          status: 'approved',
          trustLevel: 'high'
        }],
        sourceEvidence: [{
          observationId: 'obs-run-job-revenue',
          sourceId: 'src-run-job-revenue',
          kind: 'service-page',
          title: 'Paid client-delivery diagnostic booking page',
          summary:
            'Professional-service clients seeking delivery consulting arrive through organic search at the paid client-delivery diagnostic booking page, where they can book and pay $500 for a paid client-delivery diagnostic. One paid booking is recorded, and the booking record source field stores the organic-search UTM campaign.',
          url: 'https://example.com/diagnostic',
          observedAt: '2026-07-29T12:00:00Z',
          confidence: 'high'
        }]
      }
    }
  };
}

function generatorResponse(evidenceRef) {
  assert(
    evidenceRef === 'observation:obs-run-job-revenue',
    `generator prompt omitted approved revenue evidence: ${evidenceRef}`
  );
  const scores = (offset) => ({
    of: 0.92 - offset,
    es: 0.9 - offset,
    ba: 0.8 - offset,
    ti: 0.7 - offset,
    wp: 0.4 - offset,
    re: 0.75 - offset,
    ev: 0.88 - offset,
    ef: 0.24 + offset,
    co: 0.14 + offset,
    ri: 0.2 + offset,
    un: 0.24 + offset
  });
  const item = (label) => ({ l: label, e: [evidenceRef] });
  const pair = (first, second) => [item(first), item(second)];
  const family = (suffix, offset, discovery) => ({
    l: `${discovery} paid-diagnostic family ${suffix}`,
    m: 'inbound',
    e: [evidenceRef],
    s: scores(offset),
    d: {
      r: [{
        l: `One paid diagnostic booking from ${discovery}`,
        e: [evidenceRef],
        v: 'incremental_revenue_v3',
        rm: 'paid_booking',
        io:
          'One new paid client-delivery diagnostic booking adds incremental gross income',
        a: 'inbound',
        c:
          `Use ${discovery} inbound discovery to the paid client-delivery diagnostic booking page and complete one paid booking`,
        o: 'One paid booking recorded',
        atm: 'booking_record',
        ats:
          'Booking record source field stores the organic-search UTM campaign',
        cd: 'Paid client-delivery diagnostic booking page',
        st:
          'Stop after 25 qualified visits, 1 paid booking, or 14 calendar days.',
        g: {
          b: [evidenceRef],
          o: [evidenceRef],
          a: [evidenceRef],
          d: {
            l: 'Paid client-delivery diagnostic booking page',
            e: [evidenceRef]
          },
          c: [evidenceRef],
          t: [evidenceRef]
        },
        sb: '',
        vm: 500_000
      }],
      o: pair(
        'A $500 paid client-delivery diagnostic',
        'A paid client-delivery diagnostic booking'
      ),
      b: pair(
        'Professional-service clients seeking delivery consulting',
        'Professional-service clients buying a paid delivery diagnostic'
      ),
      c: pair(
        `${discovery} routes qualified buyers to the paid diagnostic booking page`,
        `${discovery} discovery reaches professional-service buyers`
      ),
      a: pair(
        `Use ${discovery} inbound discovery to reach qualified buyers and complete one paid booking`,
        `Route ${discovery} inbound buyers to the paid diagnostic booking page and complete one paid booking`
      ),
      t: [{
        l: 'Determine whether organic search continues to reach qualified buyers',
        e: [evidenceRef],
        q: 'organic search'
      }, {
        l: 'Determine whether the organic-search UTM campaign remains attributable',
        e: [evidenceRef],
        q: 'organic-search UTM campaign'
      }],
      p: pair(
        'Buyers can book and pay $500 for the diagnostic',
        'The booking record stores the organic-search UTM campaign'
      ),
      f: pair(
        'Review the attributed paid booking before another step',
        'Stop after the bounded paid result is recorded'
      )
    }
  });
  return {
    seedContract: 'revenue_family_bundle_v2',
    familyA: family('A', 0, 'organic search'),
    familyB: family('B', 0.06, 'nonbranded organic search'),
    evidenceExperiment: {
      l: 'Measure paid diagnostic bookings from organic search',
      k:
        'The current paid diagnostic booking page records an organic-search source field.',
      b: 'Professional-service clients seeking delivery consulting',
      o: 'A $500 paid client-delivery diagnostic',
      a: 'organic search',
      d: 'Paid client-delivery diagnostic booking page',
      c: 'One paid booking recorded',
      t:
        'Booking record source field stores the organic-search UTM campaign',
      x:
        'Review first: for 14 days or 25 qualified visits, test organic-search discovery to the existing paid diagnostic booking page and count attributed paid bookings.',
      s: 'One paid booking attributed to organic search',
      days: 14,
      n: 25,
      u: 'qualified visits',
      e: [evidenceRef]
    },
    candidates: [],
    w: {
      of: 0.22,
      es: 0.18,
      ba: 0.12,
      ti: 0.1,
      wp: 0.08,
      re: 0.04,
      ev: 0.14,
      ef: 0.03,
      co: 0.02,
      ri: 0.04,
      un: 0.03
    }
  };
}

function criticResponse(finalists) {
  const selectedOrdering = finalists.map(
    (finalist) => finalist.finalistId
  );
  assert(
    selectedOrdering.length >= 2,
    `critic received fewer than two finalists: ${JSON.stringify(finalists)}`
  );
  return {
    criticContract: 'opportunity_tournament_critic_v1',
    selectedOrdering,
    selectedFinalistId: selectedOrdering[0],
    comparisons: finalists.map((finalist) => ({
      finalistId: finalist.finalistId,
      verdict: 'accept',
      activeRevenueAction: true,
      causalAcquisitionPath: true,
      incrementalRevenueOutcome: true,
      incrementalRevenue: 'strong',
      evidenceStrength: 'strong',
      reachability: 'moderate',
      timeToFirstDollar: 'moderate',
      paidOutcomeProbability: 0.35,
      timeToFirstDollarDays: 14,
      recurringValue: 'repeatable',
      cost: 'low',
      effort: 'moderate',
      uncertainty: 'moderate',
      reasonCode: 'active_incremental_path',
      reason:
        'The grounded inbound motion actively advances an attributable paid booking.'
    })),
    reason:
      'Ranked every finalist by incremental revenue, evidence, reachability, time, cost, effort, and uncertainty.'
  };
}

function verifySuccessfulTournament(receipt, job, calls) {
  assertEqual(
    receipt.status,
    'completed',
    `success path did not complete: ${JSON.stringify(receipt)}`
  );
  assertEqual(
    receipt.artifactType,
    'opportunity_tournament_result',
    'success path returned the wrong artifact type'
  );
  assertEqual(
    receipt.artifactId,
    job.payload.tournamentId,
    'success path returned the wrong artifact id'
  );
  const metadata = receipt.metadata || {};
  const critic = metadata.searchSpace?.commercialCritic || {};
  const winnerID = metadata.winner?.hypothesisId;
  const winnerFamilyID = metadata.hypotheses?.find(
    (hypothesis) => hypothesis.id === winnerID
  )?.provenance?.strategyFamilyId;

  assertEqual(
    metadata.algorithmVersion,
    'cheap_tournament_v5',
    'explicit legacy replay lost its v5 algorithm binding'
  );
  assert(
    /^[a-f0-9]{64}$/.test(metadata.commercialEvidenceGraphHash || ''),
    'success path lost the deterministic commercial graph hash'
  );
  assert(
    metadata.trace?.commercialDiscovery &&
      typeof metadata.trace.commercialDiscovery === 'object',
    'run-job wrapper discarded the tournament commercial-discovery trace'
  );
  assertEqual(
    metadata.result?.resultContract,
    'opportunity_tournament_result_v2',
    'success path lost the result contract'
  );
  assertEqual(
    metadata.result?.resultType,
    'immediate_revenue_action',
    'success path returned the wrong typed result'
  );
  assertEqual(
    metadata.result?.recommendedAction,
    metadata.winner?.action,
    'typed action did not bind to the winner'
  );
  // Approval is durable control-plane authority, not model-authored prose.
  // Legacy v5 recommendations retain the exact LLM-authored action while the
  // typed result and gate independently prohibit execution until review.
  assertEqual(
    metadata.result?.permissionRequired,
    'explicit_user_approval',
    'winner lost its structural approval requirement'
  );
  assertEqual(
    metadata.gate?.requiresReview,
    true,
    'winner gate bypassed structural review authority'
  );
  verifyNoExecution(metadata);
  assertEqual(metadata.usage?.calls, 2, 'success path did not use two calls');
  assertEqual(
    metadata.searchSpace?.modelCalls,
    2,
    'search trace did not record generator plus critic'
  );
  assert(
    metadata.searchSpace?.theoreticalCount >= 100,
    'success path did not preserve broad local exploration'
  );
  assertEqual(
    critic.contract,
    'opportunity_tournament_critic_v1',
    'critic trace lost its contract'
  );
  assertEqual(critic.attempted, true, 'critic was not attempted');
  assertEqual(critic.enforced, true, 'critic was not mandatory');
  assertEqual(critic.valid, true, 'critic was not valid');
  assertEqual(critic.verdict, 'accepted', 'critic did not accept finalists');
  assertEqual(
    critic.selectedOrdering?.[0],
    winnerID,
    'critic rank one did not control the winner'
  );
  assert(
    critic.acceptedFinalistIds?.includes(winnerID),
    'critic did not bind the winning finalist'
  );
  assert(
    critic.acceptedFamilyIds?.includes(winnerFamilyID),
    'critic did not bind the winning family'
  );
  assertEqual(
    critic.inputFinalists?.length,
    critic.comparisons?.length,
    'critic input bindings did not cover each comparison'
  );
  assert(
    critic.inputFinalists?.every((binding, index) =>
      binding.finalistId === critic.comparisons?.[index]?.finalistId &&
      binding.familyId === critic.comparisons?.[index]?.familyId
    ),
    'critic input finalist/family bindings changed before persistence'
  );
  assertEqual(
    metadata.llm?.strategyGeneratorJudge?.purpose,
    'opportunity_tournament_strategy_generation',
    'generator receipt lost its purpose'
  );
  assertEqual(
    metadata.llm?.strategyGeneratorJudge?.structuredOutputContract,
    'opportunity_tournament_commercial_v2',
    'generator receipt lost its structured contract'
  );
  assertEqual(
    metadata.llm?.commercialCritic?.purpose,
    'opportunity_tournament_commercial_critic',
    'critic receipt lost its purpose'
  );
  assertEqual(
    metadata.llm?.commercialCritic?.structuredOutputContract,
    'opportunity_tournament_critic_v1',
    'critic receipt lost its structured contract'
  );
  assert(
    metadata.llm?.commercialCritic?.generatorContract === undefined,
    'critic receipt was mislabeled as a generator call'
  );
  assert(
    metadata.trace?.notes?.includes(
      'two_bounded_llm_calls_generator_and_critic'
    ),
    'trace did not distinguish generator plus critic'
  );
  assertEqual(
    traceStep(metadata, 'run_commercial_critic')?.status,
    'completed',
    'trace did not record the completed critic'
  );
  assertEqual(calls.length, 2, 'success path made the wrong call count');
  verifyGeneratorCall(calls[0], 8000);
  verifyCriticCall(calls[1]);
}

function verifyRepairDisplacesCritic(receipt, calls) {
  const metadata = receipt.metadata || {};
  assertEqual(receipt.status, 'skipped', 'repair path accepted a winner');
  assertEqual(
    metadata.result?.resultContract,
    'opportunity_tournament_result_v2',
    'repair path lost the result contract'
  );
  assertEqual(
    metadata.result?.resultType,
    'technical_recovery',
    'repair path was mislabeled as a business evidence gap'
  );
  assertEqual(metadata.usage?.calls, 2, 'repair path did not use two calls');
  assertEqual(
    metadata.searchSpace?.structuredRepair?.attempted,
    true,
    'structured repair was not attempted'
  );
  assertEqual(
    metadata.searchSpace?.structuredRepair?.succeeded,
    true,
    'structured repair did not succeed'
  );
  assertEqual(
    metadata.searchSpace?.commercialCritic?.attempted,
    false,
    'critic ran after repair consumed call two'
  );
  assertEqual(
    metadata.searchSpace?.commercialCritic?.cause,
    'commercial_critic_displaced_by_repair',
    'repair path lost its cause-matched critic trace'
  );
  assertEqual(
    metadata.nextExperiment?.kind,
    'strategy_generation_critic_displaced_by_repair',
    'repair path returned the wrong technical recovery'
  );
  assertEqual(
    metadata.llm?.strategyFamilyRepair?.purpose,
    'opportunity_tournament_structured_repair',
    'repair receipt lost its purpose'
  );
  assertEqual(
    metadata.llm?.strategyFamilyRepair?.structuredOutputContract,
    'opportunity_tournament_commercial_v2',
    'repair receipt lost its generator contract'
  );
  assert(
    metadata.llm?.commercialCritic === undefined,
    'repair path fabricated a critic call receipt'
  );
  assert(
    metadata.trace?.notes?.includes(
      'two_bounded_llm_calls_generator_and_shape_repair'
    ),
    'trace did not distinguish generator plus shape repair'
  );
  assertEqual(
    traceStep(metadata, 'run_commercial_critic')?.status,
    'skipped',
    'trace did not record the displaced critic'
  );
  verifyNoExecution(metadata);
  assertEqual(calls.length, 2, 'repair path made the wrong call count');
  verifyGeneratorCall(calls[0], 8000);
  verifyGeneratorCall(calls[1], 4000);
  assert(
    /Freshly regenerate/i.test(calls[1].input?.task || ''),
    'repair call did not regenerate from the objective'
  );
  assert(
    calls[1].input?.repairIssue &&
      !JSON.stringify(calls[1].input).includes('unsupported_seed_contract"}'),
    'repair call embedded or continued the invalid response'
  );
}

function verifyDryRun(receipt) {
  const metadata = receipt.metadata || {};
  assertEqual(receipt.status, 'skipped', 'dry run did not skip');
  assertEqual(
    metadata.result?.resultType,
    'no_grounded_path',
    'dry run returned the wrong typed result'
  );
  assertEqual(metadata.usage?.calls, 0, 'dry run recorded a model call');
  assertEqual(
    metadata.searchSpace?.commercialCritic?.cause,
    'dry_run',
    'dry-run critic trace lacked a machine cause'
  );
  assertEqual(
    metadata.searchSpace?.commercialCritic?.attempted,
    false,
    'dry-run critic trace claimed a call'
  );
  verifyNoExecution(metadata);
}

function verifyTournamentContextIsolation(receipt, calls) {
  assert(
    receipt.status === 'completed' || receipt.status === 'skipped',
    `tournament context run returned an invalid receipt: ${JSON.stringify(receipt)}`
  );
  const toolNames = calls.map((call) => call.name);
  assertEqual(
    JSON.stringify(toolNames),
    JSON.stringify([
      'read_profile',
      'read_sources',
      'read_source_evidence'
    ]),
    'tournament context invoked tools outside scoped profile/source evidence'
  );
  assert(
    !toolNames.includes('search_timeline_posts') &&
      !toolNames.includes('discover_timeline_posts'),
    'tournament context consumed the global timeline'
  );
  assertEqual(
    JSON.stringify(receipt.metadata?.trace?.tools || []),
    JSON.stringify(toolNames),
    'tournament trace did not match the scoped research tools'
  );
}

function verifyMissingKeyPreflight(receipt) {
  const metadata = receipt.metadata || {};
  const preflight = metadata.searchSpace?.providerPreflight || {};
  assertEqual(receipt.status, 'skipped', 'missing key did not skip');
  assertEqual(
    metadata.result?.resultType,
    'technical_recovery',
    'missing key was not a technical recovery'
  );
  assertEqual(
    metadata.nextExperiment?.kind,
    'strategy_generation_provider_recovery',
    'missing key returned the wrong recovery'
  );
  assertEqual(
    preflight.contractVersion,
    'opportunity_tournament_provider_preflight_v1',
    'missing key lost its preflight contract'
  );
  assertEqual(preflight.status, 'blocked', 'missing key preflight was not blocked');
  assertEqual(
    preflight.cause,
    'missing_provider_credential',
    'missing key preflight lost its machine cause'
  );
  assertEqual(
    preflight.providerCallsAttempted,
    0,
    'missing key preflight claimed a provider attempt'
  );
  assertEqual(metadata.usage?.calls, 0, 'missing key recorded model usage');
  assertEqual(
    metadata.usage?.successfulCalls,
    0,
    'missing key recorded a successful model call'
  );
  assertEqual(
    metadata.usage?.totalTokens,
    0,
    'missing key retained a token reservation'
  );
  assertEqual(
    metadata.usage?.costReporting,
    'complete',
    'missing key did not close zero-call cost accounting'
  );
  assertEqual(
    metadata.usage?.withinBudget,
    true,
    'missing key did not close its budget accounting'
  );
  assertEqual(
    metadata.searchSpace?.commercialCritic?.cause,
    'missing_provider_credential',
    'missing-key critic trace lacked a machine cause'
  );
  assertEqual(
    metadata.searchSpace?.commercialCritic?.attempted,
    false,
    'missing-key critic trace claimed a call'
  );
  assert(
    metadata.llm === undefined,
    'missing-key preflight fabricated an LLM call receipt'
  );
  assertEqual(
    traceStep(metadata, 'provider_preflight')?.status,
    'blocked',
    'trace did not record the blocked provider preflight'
  );
  verifyNoExecution(metadata);
}

function verifyGeneratorCall(call, expectedMaxTokens) {
  assertEqual(
    call.schemaName,
    'opportunity_tournament_commercial_v2',
    'generator used the wrong structured contract'
  );
  assertEqual(
    call.envelope.max_tokens,
    expectedMaxTokens,
    'generator used an unbounded or wrong output limit'
  );
  const schema = call.envelope.response_format?.json_schema || {};
  const family = schema.schema?.$defs?.family || {};
  const dimensions = family.properties?.d?.properties || {};
  assertEqual(schema.strict, true, 'generator schema was not strict');
  assertEqual(
    schema.schema?.properties?.seedContract?.enum?.[0],
    'revenue_family_bundle_v2',
    'generator schema lost the v2 seed contract'
  );
  for (const key of ['o', 'b', 'c', 'a', 't', 'p', 'f']) {
    assertEqual(
      dimensions[key]?.minItems,
      2,
      `generator schema did not require two ${key} variants`
    );
    assertEqual(
      dimensions[key]?.maxItems,
      2,
      `generator schema allowed an unbounded ${key} variant count`
    );
  }
  assertEqual(dimensions.r?.minItems, 1, 'generator schema lost its revenue path');
  assertEqual(dimensions.r?.maxItems, 1, 'generator schema allowed extra revenue paths');
  assertEqual(call.envelope.temperature, undefined, 'generator must omit temperature for Luna require_parameters');
  assertEqual(call.envelope.model, 'openai/gpt-5.6-luna', 'generator must use pinned Luna OpenRouter model');
  assertEqual(
    call.envelope.provider?.data_collection,
    'deny',
    'generator lost the privacy route'
  );
  assertEqual(
    call.envelope.provider?.allow_fallbacks,
    false,
    'generator allowed provider fallback'
  );
  assert(
    /research[- ]only/i.test(
      call.envelope.messages?.find((message) => message.role === 'system')
        ?.content || ''
    ),
    'generator lost the research-only boundary'
  );
}

function verifyCriticCall(call) {
  assertEqual(
    call.schemaName,
    'opportunity_tournament_critic_v1',
    'critic used the wrong structured contract'
  );
  assertEqual(call.envelope.max_tokens, 1200, 'critic output was not bounded');
  assertEqual(
    call.input?.criticContract,
    'opportunity_tournament_critic_v1',
    'critic prompt lost its contract binding'
  );
  assert(
    Array.isArray(call.input?.finalists) && call.input.finalists.length >= 2,
    'critic prompt lacked comparable finalists'
  );
  assert(
    /independent commercial-motion critic/i.test(
      call.envelope.messages?.find((message) => message.role === 'system')
        ?.content || ''
    ),
    'critic prompt lost its independent role'
  );
}

function verifyNoExecution(metadata) {
  assertEqual(
    metadata.result?.executionAuthorization,
    'none',
    'result authorized execution'
  );
  assertEqual(
    metadata.result?.sideEffectsPerformed,
    0,
    'result claimed a side effect'
  );
  assertEqual(
    metadata.result?.requiresReview,
    true,
    'result bypassed human review'
  );
  for (const [name, count] of Object.entries(
    metadata.gate?.sideEffects || {}
  )) {
    assertEqual(count, 0, `gate recorded ${name}`);
  }
}

function traceStep(metadata, name) {
  return (metadata.trace?.steps || []).find((step) => step.name === name);
}

function writeJob(label, job) {
  const path = join(temporaryDirectory, `${label}.json`);
  writeFileSync(path, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
  return path;
}

function runJob(jobFile, port, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [
      join(root, 'bin/run-job.mjs'),
      '--job-file',
      jobFile,
      ...(options.args || [])
    ], {
      cwd: root,
      env: {
        ...process.env,
        OPENROUTER_API_KEY:
          options.apiKey === undefined
            ? 'sk-or-run-job-smoke'
            : options.apiKey,
        PROFILESCRIBE_RIG_OPENROUTER_CHAT_COMPLETIONS_URL:
          `http://127.0.0.1:${port}/openrouter`,
        PROFILESCRIBE_RIG_TOURNAMENT_MODEL:
          'openai/gpt-5.6-luna',
        PROFILESCRIBE_APP_URL: 'https://profilescribe.test',
        PROFILESCRIBE_AGENT_TOKEN: 'test-token',
        ...(options.mcpURL
          ? { PROFILESCRIBE_MCP_URL: options.mcpURL }
          : {})
      },
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
      if (code !== 0) {
        rejectRun(new Error(
          `run-job exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`
        ));
        return;
      }
      try {
        resolveRun(JSON.parse(stdout || '{}'));
      } catch (error) {
        rejectRun(new Error(
          `invalid run-job JSON: ${error.message}\n${stdout}\n${stderr}`
        ));
      }
    });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}
