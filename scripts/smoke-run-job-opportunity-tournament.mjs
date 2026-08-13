#!/usr/bin/env node

import { spawn } from 'child_process';
import { createHash } from 'crypto';
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
const STRICT_CONTENT_PROSE_SENTINEL =
  'raw-structured-prose-must-not-persist';
const BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES = 160 * 1_024;
const BUFFERED_RESPONSE_SECRET_SENTINEL =
  'raw-oversized-response-secret-must-not-persist';
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function bufferedResponseFixture(byteCount) {
  const prefix = `${BUFFERED_RESPONSE_SECRET_SENTINEL}:`;
  if (byteCount < Buffer.byteLength(prefix, 'utf8')) {
    throw new Error('buffered response fixture is smaller than its prefix');
  }
  return `${prefix}${'x'.repeat(byteCount - Buffer.byteLength(prefix, 'utf8'))}`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function bomResponseFixture(value) {
  return Buffer.concat([UTF8_BOM, Buffer.from(value, 'utf8')]);
}

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
  providerCalls.push({
    envelope,
    input,
    schemaName,
    routerMetadataHeader: request.headers['x-openrouter-metadata']
  });

  if (input.objective?.id === 'objective-run-job-slow-response-body' ||
      (input.objective?.id ===
        'objective-run-job-slow-response-body-critic' &&
       schemaName === 'opportunity_tournament_critic_v1')) {
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Generation-Id': 'gen-run-job-slow-response-body',
      'X-Provider-Name': 'Slow Body Provider'
    });
    response.flushHeaders();
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
    if (!response.destroyed) {
      response.end('raw-slow-body-secret-sentinel');
    }
    return;
  }

  if (input.objective?.id === 'objective-run-job-provider-502') {
    response.writeHead(502, {
      'Content-Type': 'application/json',
      'X-Generation-Id': 'gen-run-job-provider-502'
    });
    response.end(JSON.stringify({
      error: {
        code: 502,
        message: 'raw-provider-secret-sentinel',
        metadata: {
          error_type: 'provider_unavailable',
          provider_code: 'upstream_502'
        }
      },
      openrouter_metadata: {
        strategy: 'fallback',
        attempt: 2,
        endpoints: {
          total: 2,
          available: [{
            provider: 'OpenAI',
            model: 'deepseek/deepseek-v4-flash-0731',
            selected: false
          }, {
            provider: 'Azure',
            model: 'deepseek/deepseek-v4-flash-0731',
            selected: false
          }]
        },
        attempts: [
          { provider: 'OpenAI', status: 502 },
          { provider: 'Azure', status: 502 }
        ]
      }
    }));
    return;
  }

  if (input.objective?.id ===
      'objective-run-job-buffered-exact-limit-malformed') {
    const body = bufferedResponseFixture(
      BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES
    );
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Generation-Id': 'gen-run-job-buffered-exact-limit',
      'X-Provider-Name': 'Exact Limit Provider'
    });
    response.end(body);
    return;
  }

  if (input.objective?.id ===
      'objective-run-job-buffered-bom-malformed') {
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Generation-Id': 'gen-run-job-buffered-bom-malformed',
      'X-Provider-Name': 'BOM Malformed Provider'
    });
    response.end(bomResponseFixture(
      `${BUFFERED_RESPONSE_SECRET_SENTINEL}:not-json`
    ));
    return;
  }

  if (input.objective?.id ===
      'objective-run-job-buffered-bom-502') {
    response.writeHead(502, {
      'Content-Type': 'application/json',
      'X-Generation-Id': 'gen-run-job-buffered-bom-502',
      'X-Provider-Name': 'BOM Error Provider'
    });
    response.end(bomResponseFixture(
      `${BUFFERED_RESPONSE_SECRET_SENTINEL}:not-json`
    ));
    return;
  }

  if (input.objective?.id ===
        'objective-run-job-buffered-over-limit-2xx-critic' &&
      schemaName === 'opportunity_tournament_critic_v1') {
    const body = bufferedResponseFixture(
      BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES + 1
    );
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Generation-Id': 'gen-run-job-buffered-over-limit-2xx',
      'X-Provider-Name': 'Oversized Critic Provider'
    });
    response.end(body);
    return;
  }

  if (input.objective?.id ===
      'objective-run-job-buffered-over-limit-502') {
    const body = bufferedResponseFixture(
      BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES * 2
    );
    response.writeHead(502, {
      'Content-Type': 'application/json',
      'X-Generation-Id': 'gen-run-job-buffered-over-limit-502',
      'X-Provider-Name': 'Oversized Error Provider'
    });
    response.end(body);
    return;
  }

  if (input.objective?.id ===
        'objective-run-job-buffered-over-limit-502-critic' &&
      schemaName === 'opportunity_tournament_critic_v1') {
    const body = bufferedResponseFixture(
      BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES * 2
    );
    response.writeHead(502, {
      'Content-Type': 'application/json',
      'X-Generation-Id': 'gen-run-job-buffered-over-limit-502-critic',
      'X-Provider-Name': 'Oversized Critic Error Provider'
    });
    response.end(body);
    return;
  }

  if (input.objective?.id ===
      'objective-run-job-generation-conflict-502') {
    const body = JSON.stringify({
      id: 'gen-run-job-envelope-502',
      error: {
        code: 502,
        message: 'raw-generation-conflict-secret-sentinel'
      },
      usage
    });
    response.writeHead(502, {
      'Content-Type': 'application/json',
      'X-Generation-Id': 'gen-run-job-header-502',
      'X-Provider-Name': 'Generation Conflict Provider'
    });
    response.end(body);
    return;
  }

  if (input.objective?.id === 'objective-run-job-embedded-502') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      id: 'gen-run-job-embedded-502',
      model: 'deepseek/deepseek-v4-flash-0731',
      error: {
        code: 502,
        message: 'raw-embedded-provider-secret-sentinel',
        metadata: {
          error_type: 'provider_unavailable',
          provider_code: 'upstream_502'
        }
      },
      choices: [{
        finish_reason: 'error',
        native_finish_reason: 'error',
        message: { content: '{"partial":"must-not-be-accepted"}' }
      }],
      usage,
      openrouter_metadata: {
        strategy: 'fallback',
        attempt: 3,
        endpoints: {
          total: 3,
          available: [{
            provider: 'OpenAI',
            model: 'deepseek/deepseek-v4-flash-0731',
            selected: true
          }]
        },
        attempts: [
          { provider: 'OpenAI', status: 502 },
          { provider: 'Google AI Studio', status: 502 },
          { provider: 'Parasail', status: 502 }
        ]
      }
    }));
    return;
  }

  let data;
  if (schemaName === 'opportunity_tournament_critic_v1') {
    data = criticResponse(input.finalists || []);
    if (input.objective?.id === 'objective-run-job-invalid-critic-bound') {
      data.reason = 'x'.repeat(361);
    }
    if (input.objective?.id ===
        'objective-run-job-invalid-critic-whitespace') {
      data.comparisons[0].reason =
        ' Leading critic reason with  rewritten whitespace.\n';
    }
  } else {
    const objectiveID = input.objective?.id || 'unknown-objective';
    const callCount =
      (generatorCallsByObjective.get(objectiveID) || 0) + 1;
    generatorCallsByObjective.set(objectiveID, callCount);
    if ([
      'objective-run-job-repair',
      'objective-run-job-repair-foreign-model'
    ].includes(objectiveID) && callCount === 1) {
      data = { seedContract: 'unsupported_seed_contract' };
    } else {
      const evidenceRef = (input.evidenceCatalog || [])
        .map((item) => item.id)
        .find((id) => id === 'observation:obs-run-job-revenue');
      data = generatorResponse(evidenceRef);
    }
  }

  const objectiveID = input.objective?.id || '';
  const criticCall = schemaName === 'opportunity_tournament_critic_v1';
  let content = JSON.stringify(data);
  if (!criticCall && objectiveID ===
      'objective-run-job-generator-prefix-prose') {
    content = `PREFIX ${STRICT_CONTENT_PROSE_SENTINEL}\n${content}`;
  }
  if (criticCall && objectiveID ===
      'objective-run-job-critic-suffix-prose') {
    content = `${content}\nSUFFIX ${STRICT_CONTENT_PROSE_SENTINEL}`;
  }
  if ((!criticCall && objectiveID ===
        'objective-run-job-generator-unmatched-fence') ||
      (criticCall && objectiveID ===
        'objective-run-job-critic-unmatched-fence')) {
    content = `\`\`\`json\n${content}\n${STRICT_CONTENT_PROSE_SENTINEL}`;
  }
  let selectedProvider;
  let openRouterMetadata = {
    strategy: 'direct',
    attempt: 1,
    endpoints: {
      total: 1,
      available: [{
        provider: 'OpenAI',
        model: 'deepseek/deepseek-v4-flash-0731',
        selected: true
      }]
    },
    attempts: [
      {
        provider: 'OpenAI',
        model: 'deepseek/deepseek-v4-flash-0731',
        status: 200
      }
    ]
  };
  if (criticCall && [
    'objective-run-job-critic-fallback-provenance',
    'objective-run-job-critic-fallback-incomplete',
    'objective-run-job-critic-fallback-missing-model',
    'objective-run-job-critic-fallback-nonfinal-2xx',
    'objective-run-job-critic-fallback-final-non-2xx',
    'objective-run-job-critic-route-mismatch',
    'objective-run-job-critic-route-extra',
    'objective-run-job-critic-route-filtered'
  ].includes(objectiveID)) {
    openRouterMetadata = {
      strategy: 'fallback',
      attempt: 2,
      endpoints: {
        total: 2,
        available: [{
          provider: 'OpenAI',
          model: 'deepseek/deepseek-v4-flash-0731',
          selected: false
        }, {
          provider: 'Azure',
          model: 'deepseek/deepseek-v4-flash-0731',
          selected: true
        }]
      },
      attempts: [
        {
          provider: 'OpenAI',
          model: 'deepseek/deepseek-v4-flash-0731',
          status: 502
        },
        {
          provider: 'Azure',
          model: 'deepseek/deepseek-v4-flash-0731',
          status: 200
        }
      ]
    };
    if (objectiveID ===
        'objective-run-job-critic-fallback-incomplete') {
      delete openRouterMetadata.attempts;
    }
    if (objectiveID ===
        'objective-run-job-critic-fallback-missing-model') {
      delete openRouterMetadata.attempts[0].model;
    }
    if (objectiveID ===
        'objective-run-job-critic-fallback-nonfinal-2xx') {
      openRouterMetadata.attempts[0].status = 200;
    }
    if (objectiveID ===
        'objective-run-job-critic-fallback-final-non-2xx') {
      openRouterMetadata.attempts[1].status = 502;
    }
    if (objectiveID ===
        'objective-run-job-critic-route-mismatch') {
      openRouterMetadata.endpoints.available[1].provider =
        'Mismatched Provider';
    }
    if (objectiveID ===
        'objective-run-job-critic-route-extra') {
      openRouterMetadata.attempts.push({
        provider: 'Unexpected Provider',
        model: 'deepseek/deepseek-v4-flash-0731',
        status: 503
      });
    }
    if (objectiveID ===
        'objective-run-job-critic-route-filtered') {
      openRouterMetadata.attempts.splice(1, 0, {
        provider: 'Malformed Provider',
        model: 'deepseek/deepseek-v4-flash-0731',
        status: 'not-a-status'
      });
    }
  }
  if (criticCall && objectiveID ===
      'objective-run-job-critic-direct-reconstructed') {
    delete openRouterMetadata.attempts;
  }
  if (criticCall && objectiveID ===
      'objective-run-job-critic-direct-missing-model') {
    delete openRouterMetadata.attempts[0].model;
    openRouterMetadata.attempts[0].status = 201;
  }
  if (criticCall && objectiveID ===
      'objective-run-job-critic-direct-unevidenced') {
    openRouterMetadata.endpoints.available[0].selected = false;
    delete openRouterMetadata.attempts;
    selectedProvider = 'OpenAI';
  }
  if (criticCall && objectiveID ===
      'objective-run-job-critic-direct-permaslug') {
    openRouterMetadata.endpoints.available[0].model =
      'deepseek/deepseek-v4-flash-20260731';
    openRouterMetadata.attempts[0].model =
      'deepseek/deepseek-v4-flash-20260731';
  }
  if (criticCall && objectiveID ===
      'objective-run-job-critic-foreign-model') {
    openRouterMetadata.endpoints.available[0].model =
      'foreign/vendor-model';
    openRouterMetadata.attempts[0].model = 'foreign/vendor-model';
  }
  if (!criticCall && objectiveID ===
      'objective-run-job-generator-foreign-model') {
    openRouterMetadata.endpoints.available[0].model =
      'foreign/vendor-model';
    openRouterMetadata.attempts[0].model = 'foreign/vendor-model';
  }
  if (!criticCall && objectiveID ===
      'objective-run-job-generator-numeric-string-route') {
    openRouterMetadata.attempt = '1';
    openRouterMetadata.endpoints.total = '1';
    openRouterMetadata.attempts[0].status = '200';
  }
  if (!criticCall && objectiveID ===
      'objective-run-job-generator-direct-missing-model') {
    delete openRouterMetadata.attempts[0].model;
  }
  if (!criticCall && objectiveID ===
      'objective-run-job-repair-foreign-model' &&
      generatorCallsByObjective.get(objectiveID) === 2) {
    openRouterMetadata.endpoints.available[0].model =
      'foreign/vendor-model';
    openRouterMetadata.attempts[0].model = 'foreign/vendor-model';
  }
  let responseUsage = { ...usage };
  if (criticCall && objectiveID ===
      'objective-run-job-critic-missing-usage') {
    responseUsage = {};
  }
  if (criticCall && objectiveID ===
      'objective-run-job-critic-string-usage') {
    responseUsage = Object.fromEntries(Object.entries(usage).map(
      ([key, value]) => [key, String(value)]
    ));
  }
  if (criticCall && objectiveID ===
      'objective-run-job-critic-inconsistent-usage') {
    responseUsage.total_tokens += 1;
  }
  if (criticCall && objectiveID ===
      'objective-run-job-critic-call-spend-exceeded') {
    responseUsage.cost = 0.148;
  }
  let finishReason = 'stop';
  let nativeFinishReason = 'stop';
  if (criticCall && objectiveID ===
      'objective-run-job-critic-length-finish') {
    finishReason = 'length';
    nativeFinishReason = 'length';
  }
  if (criticCall && objectiveID ===
      'objective-run-job-critic-unsafe-finish') {
    finishReason = 'raw finish reason secret sentinel !';
    nativeFinishReason = 'raw native finish secret sentinel !';
  }
  const finishFields = criticCall && objectiveID ===
      'objective-run-job-critic-missing-finish'
    ? {}
    : {
        finish_reason: finishReason,
        native_finish_reason: nativeFinishReason
      };
  const envelopeProvider = criticCall && objectiveID ===
      'objective-run-job-critic-env-provider-conflict'
    ? 'Contradictory Envelope Provider'
    : selectedProvider;
  const envelopeModel = criticCall && objectiveID ===
      'objective-run-job-critic-env-model-conflict'
    ? 'foreign/contradictory-model'
    : 'deepseek/deepseek-v4-flash-0731';
  const responseGenerationId = criticCall && objectiveID ===
      'objective-run-job-critic-generation-missing'
    ? undefined
    : criticCall && objectiveID ===
        'objective-run-job-critic-generation-unsafe'
      ? 'unsafe generation id raw-secret-sentinel'
      : criticCall && objectiveID ===
          'objective-run-job-critic-generation-conflict'
        ? 'gen-run-job-envelope-critic-conflict'
        : `gen-run-job-${providerCalls.length}`;
  const responseHeaders = { 'Content-Type': 'application/json' };
  if (criticCall && objectiveID ===
      'objective-run-job-critic-generation-conflict') {
    responseHeaders['X-Generation-Id'] =
      'gen-run-job-header-critic-conflict';
  }
  response.writeHead(200, responseHeaders);
  response.end(JSON.stringify({
    ...(responseGenerationId ? { id: responseGenerationId } : {}),
    model: envelopeModel,
    provider: envelopeProvider,
    ...(/critic-env-(?:provider|model)-conflict/.test(objectiveID)
      ? { debug_message: 'raw-route-conflict-secret-sentinel' }
      : {}),
    choices: [{
      ...finishFields,
      message: { content }
    }],
    usage: responseUsage,
    openrouter_metadata: openRouterMetadata
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

  const generatorDirectMissingModelJob = tournamentJob(
    'generator-direct-missing-model',
    'objective-run-job-generator-direct-missing-model'
  );
  const generatorDirectMissingModelFile = writeJob(
    'generator-direct-missing-model',
    generatorDirectMissingModelJob
  );
  const generatorDirectMissingModelCallOffset = providerCalls.length;
  const generatorDirectMissingModel = await runJob(
    generatorDirectMissingModelFile,
    port
  );
  const generatorDirectMissingModelCalls = providerCalls.slice(
    generatorDirectMissingModelCallOffset
  );
  verifySuccessfulTournament(
    generatorDirectMissingModel,
    generatorDirectMissingModelJob,
    generatorDirectMissingModelCalls
  );
  verifyGeneratorDirectMissingModelCanonicalization(
    generatorDirectMissingModel,
    generatorDirectMissingModelCalls
  );

  for (const scenario of [{
    label: 'generator-foreign-model',
    issue: 'selected_model_not_requested'
  }, {
    label: 'generator-numeric-string-route',
    issue: 'attempt_count_invalid'
  }]) {
    const job = tournamentJob(
      scenario.label,
      `objective-run-job-${scenario.label}`
    );
    const file = writeJob(scenario.label, job);
    const callOffset = providerCalls.length;
    const receipt = await runJob(file, port);
    verifyGeneratorRouteProvenance(
      receipt,
      providerCalls.slice(callOffset),
      scenario
    );
  }

  for (const scenario of [{
    label: 'critic-generation-missing',
    expectedGenerationId: undefined
  }, {
    label: 'critic-generation-unsafe',
    expectedGenerationId: undefined,
    forbiddenText: 'unsafe generation id raw-secret-sentinel'
  }]) {
    const job = tournamentJob(
      scenario.label,
      `objective-run-job-${scenario.label}`
    );
    const file = writeJob(scenario.label, job);
    const callOffset = providerCalls.length;
    const receipt = await runJob(file, port);
    verifyCriticGenerationContract(
      receipt,
      providerCalls.slice(callOffset),
      scenario
    );
  }

  const criticGenerationConflictJob = tournamentJob(
    'critic-generation-conflict',
    'objective-run-job-critic-generation-conflict'
  );
  const criticGenerationConflictFile = writeJob(
    'critic-generation-conflict',
    criticGenerationConflictJob
  );
  const criticGenerationConflictOffset = providerCalls.length;
  const criticGenerationConflict = await runJob(
    criticGenerationConflictFile,
    port
  );
  verifyGenerationConflictFailure(
    criticGenerationConflict,
    providerCalls.slice(criticGenerationConflictOffset),
    {
      label: 'critic 2xx generation conflict',
      stage: 'critic',
      expectedHTTPStatus: 200,
      expectedGenerationId: undefined,
      forbiddenTexts: [
        'gen-run-job-envelope-critic-conflict',
        'gen-run-job-header-critic-conflict'
      ]
    }
  );

  for (const scenario of [{
    label: 'critic-fallback-provenance',
    issue: ''
  }, {
    label: 'critic-direct-reconstructed',
    issue: ''
  }, {
    label: 'critic-direct-missing-model',
    issue: ''
  }, {
    label: 'critic-direct-permaslug',
    issue: ''
  }, {
    label: 'critic-foreign-model',
    issue: 'selected_model_not_requested'
  }, {
    label: 'critic-fallback-incomplete',
    issue: 'attempt_sequence_incomplete'
  }, {
    label: 'critic-direct-unevidenced',
    issue: 'attempt_sequence_incomplete'
  }, {
    label: 'critic-fallback-missing-model',
    issue: 'attempt_model_missing'
  }, {
    label: 'critic-fallback-nonfinal-2xx',
    issue: 'nonfinal_attempt_is_2xx'
  }, {
    label: 'critic-fallback-final-non-2xx',
    issue: 'final_attempt_not_2xx'
  }, {
    label: 'critic-route-mismatch',
    issue: 'route_observation_conflict'
  }, {
    label: 'critic-route-extra',
    issue: 'route_observation_conflict'
  }, {
    label: 'critic-route-filtered',
    issue: 'fallback_attempt_sequence_not_reported'
  }, {
    label: 'critic-env-provider-conflict',
    issue: 'route_observation_conflict',
    conflictKind: 'envelope_provider_conflict'
  }, {
    label: 'critic-env-model-conflict',
    issue: 'route_observation_conflict',
    conflictKind: 'envelope_model_conflict'
  }]) {
    const job = tournamentJob(
      scenario.label,
      `objective-run-job-${scenario.label}`
    );
    const file = writeJob(scenario.label, job);
    const callOffset = providerCalls.length;
    const receipt = await runJob(file, port);
    verifyCriticRouteProvenance(
      receipt,
      providerCalls.slice(callOffset),
      scenario
    );
  }

  for (const scenario of [{
    label: 'critic-missing-usage',
    usageIssue: 'usage_tokens_missing_or_not_exact_positive_integers'
  }, {
    label: 'critic-string-usage',
    usageIssue: 'usage_tokens_missing_or_not_exact_positive_integers'
  }, {
    label: 'critic-inconsistent-usage',
    usageIssue: 'usage_total_tokens_inconsistent'
  }]) {
    const job = tournamentJob(
      scenario.label,
      `objective-run-job-${scenario.label}`
    );
    const file = writeJob(scenario.label, job);
    const callOffset = providerCalls.length;
    const receipt = await runJob(file, port);
    verifyCriticUsageGate(
      receipt,
      providerCalls.slice(callOffset),
      scenario
    );
  }

  {
    const label = 'critic-call-spend-exceeded';
    const job = tournamentJob(label, `objective-run-job-${label}`);
    const file = writeJob(label, job);
    const callOffset = providerCalls.length;
    const receipt = await runJob(file, port);
    verifyCriticCallSpendGate(
      receipt,
      providerCalls.slice(callOffset)
    );
  }

  for (const scenario of [{
    label: 'critic-missing-finish',
    finishIssue: 'finish_reason_missing'
  }, {
    label: 'critic-length-finish',
    finishIssue: 'finish_reason_not_stop',
    successfulCalls: 1,
    providerStatus: 'incomplete'
  }, {
    label: 'critic-unsafe-finish',
    finishIssue: 'finish_reason_missing'
  }]) {
    const job = tournamentJob(
      scenario.label,
      `objective-run-job-${scenario.label}`
    );
    const file = writeJob(scenario.label, job);
    const callOffset = providerCalls.length;
    const receipt = await runJob(file, port);
    verifyCriticFinishGate(
      receipt,
      providerCalls.slice(callOffset),
      scenario
    );
  }

  for (const scenario of [{
    label: 'invalid-critic-bound',
    objective: 'objective-run-job-invalid-critic-bound'
  }, {
    label: 'invalid-critic-whitespace',
    objective: 'objective-run-job-invalid-critic-whitespace'
  }]) {
    const invalidCriticJob = tournamentJob(
      scenario.label,
      scenario.objective
    );
    const invalidCriticFile = writeJob(
      scenario.label,
      invalidCriticJob
    );
    const invalidCriticCallOffset = providerCalls.length;
    const invalidCritic = await runJob(invalidCriticFile, port);
    verifyInvalidCriticBound(
      invalidCritic,
      providerCalls.slice(invalidCriticCallOffset),
      scenario.label
    );
  }

  for (const scenario of [{
    label: 'generator-prefix-prose',
    stage: 'generator'
  }, {
    label: 'critic-suffix-prose',
    stage: 'critic'
  }, {
    label: 'generator-unmatched-fence',
    stage: 'generator'
  }, {
    label: 'critic-unmatched-fence',
    stage: 'critic'
  }]) {
    const job = tournamentJob(
      scenario.label,
      `objective-run-job-${scenario.label}`
    );
    const file = writeJob(scenario.label, job);
    const callOffset = providerCalls.length;
    const receipt = await runJob(file, port);
    verifyStrictContentProseRejected(
      receipt,
      providerCalls.slice(callOffset),
      scenario
    );
  }

  const repairJob = tournamentJob(
    'repair',
    'objective-run-job-repair'
  );
  const repairFile = writeJob('repair', repairJob);
  const repairCallOffset = providerCalls.length;
  const repair = await runJob(repairFile, port);
  const repairCalls = providerCalls.slice(repairCallOffset);
  verifyRepairDisplacesCritic(repair, repairCalls);

  const repairForeignJob = tournamentJob(
    'repair-foreign-model',
    'objective-run-job-repair-foreign-model'
  );
  const repairForeignFile = writeJob(
    'repair-foreign-model',
    repairForeignJob
  );
  const repairForeignCallOffset = providerCalls.length;
  const repairForeign = await runJob(repairForeignFile, port);
  verifyRepairRouteProvenance(
    repairForeign,
    providerCalls.slice(repairForeignCallOffset),
    'selected_model_not_requested'
  );

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

  const providerFailureJob = tournamentJob(
    'provider-502',
    'objective-run-job-provider-502'
  );
  const providerFailureFile = writeJob(
    'provider-502',
    providerFailureJob
  );
  const providerFailureCallOffset = providerCalls.length;
  const providerFailure = await runJob(providerFailureFile, port);
  verifyProvider502Failure(
    providerFailure,
    providerCalls.slice(providerFailureCallOffset)
  );

  const exactLimitJob = tournamentJob(
    'buffered-exact-limit-malformed',
    'objective-run-job-buffered-exact-limit-malformed'
  );
  const exactLimitFile = writeJob(
    'buffered-exact-limit-malformed',
    exactLimitJob
  );
  const exactLimitCallOffset = providerCalls.length;
  const exactLimit = await runJob(exactLimitFile, port);
  verifyBoundedBufferedResponseFailure(
    exactLimit,
    providerCalls.slice(exactLimitCallOffset),
    {
      label: 'exact-limit malformed 2xx',
      stage: 'generator',
      expectedError: 'openrouter_invalid_response',
      expectedHTTPStatus: 200,
      expectedGenerationId: 'gen-run-job-buffered-exact-limit',
      expectedProvider: 'Exact Limit Provider',
      expectedByteCount: BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES,
      expectedSha256: sha256(bufferedResponseFixture(
        BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES
      ))
    }
  );

  for (const scenario of [{
    label: 'BOM malformed 2xx',
    jobLabel: 'buffered-bom-malformed',
    objectiveID: 'objective-run-job-buffered-bom-malformed',
    expectedError: 'openrouter_invalid_response',
    expectedHTTPStatus: 200,
    expectedGenerationId: 'gen-run-job-buffered-bom-malformed',
    expectedProvider: 'BOM Malformed Provider'
  }, {
    label: 'BOM malformed non-2xx',
    jobLabel: 'buffered-bom-502',
    objectiveID: 'objective-run-job-buffered-bom-502',
    expectedError: 'openrouter_http_502',
    expectedHTTPStatus: 502,
    expectedGenerationId: 'gen-run-job-buffered-bom-502',
    expectedProvider: 'BOM Error Provider'
  }]) {
    const bomBody = bomResponseFixture(
      `${BUFFERED_RESPONSE_SECRET_SENTINEL}:not-json`
    );
    const job = tournamentJob(scenario.jobLabel, scenario.objectiveID);
    const file = writeJob(scenario.jobLabel, job);
    const callOffset = providerCalls.length;
    const result = await runJob(file, port);
    verifyBoundedBufferedResponseFailure(
      result,
      providerCalls.slice(callOffset),
      {
        ...scenario,
        stage: 'generator',
        expectedByteCount: bomBody.byteLength,
        expectedSha256: sha256(bomBody)
      }
    );
  }

  const overLimit2xxJob = tournamentJob(
    'buffered-over-limit-2xx-critic',
    'objective-run-job-buffered-over-limit-2xx-critic'
  );
  const overLimit2xxFile = writeJob(
    'buffered-over-limit-2xx-critic',
    overLimit2xxJob
  );
  const overLimit2xxCallOffset = providerCalls.length;
  const overLimit2xx = await runJob(overLimit2xxFile, port);
  verifyBoundedBufferedResponseFailure(
    overLimit2xx,
    providerCalls.slice(overLimit2xxCallOffset),
    {
      label: 'over-limit critic 2xx',
      stage: 'critic',
      expectedError: 'openrouter_response_body_too_large',
      expectedHTTPStatus: 200,
      expectedGenerationId: 'gen-run-job-buffered-over-limit-2xx',
      expectedProvider: 'Oversized Critic Provider',
      expectedByteCount: BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES + 1,
      expectedSha256: sha256(bufferedResponseFixture(
        BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES + 1
      ))
    }
  );

  const overLimit502Job = tournamentJob(
    'buffered-over-limit-502',
    'objective-run-job-buffered-over-limit-502'
  );
  const overLimit502File = writeJob(
    'buffered-over-limit-502',
    overLimit502Job
  );
  const overLimit502CallOffset = providerCalls.length;
  const overLimit502 = await runJob(overLimit502File, port);
  verifyBoundedBufferedResponseFailure(
    overLimit502,
    providerCalls.slice(overLimit502CallOffset),
    {
      label: 'over-limit non-2xx',
      stage: 'generator',
      expectedError: 'openrouter_response_body_too_large',
      expectedHTTPStatus: 502,
      expectedGenerationId: 'gen-run-job-buffered-over-limit-502',
      expectedProvider: 'Oversized Error Provider',
      expectedByteCount: BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES + 1,
      expectedSha256: sha256(
        bufferedResponseFixture(
          BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES * 2
        ).slice(0, BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES + 1)
      )
    }
  );

  const overLimit502CriticBody = bufferedResponseFixture(
    BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES * 2
  );
  const overLimit502CriticJob = tournamentJob(
    'buffered-over-limit-502-critic',
    'objective-run-job-buffered-over-limit-502-critic'
  );
  const overLimit502CriticFile = writeJob(
    'buffered-over-limit-502-critic',
    overLimit502CriticJob
  );
  const overLimit502CriticOffset = providerCalls.length;
  const overLimit502Critic = await runJob(
    overLimit502CriticFile,
    port
  );
  verifyBoundedBufferedResponseFailure(
    overLimit502Critic,
    providerCalls.slice(overLimit502CriticOffset),
    {
      label: 'over-limit critic non-2xx',
      stage: 'critic',
      expectedError: 'openrouter_response_body_too_large',
      expectedHTTPStatus: 502,
      expectedGenerationId:
        'gen-run-job-buffered-over-limit-502-critic',
      expectedProvider: 'Oversized Critic Error Provider',
      expectedByteCount: BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES + 1,
      expectedSha256: sha256(overLimit502CriticBody.slice(
        0,
        BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES + 1
      )),
      expectedRecoveryKind: 'strategy_generation_critic_provider_recovery'
    }
  );

  const generationConflict502Job = tournamentJob(
    'generation-conflict-502',
    'objective-run-job-generation-conflict-502'
  );
  const generationConflict502File = writeJob(
    'generation-conflict-502',
    generationConflict502Job
  );
  const generationConflict502Offset = providerCalls.length;
  const generationConflict502 = await runJob(
    generationConflict502File,
    port
  );
  verifyGenerationConflictFailure(
    generationConflict502,
    providerCalls.slice(generationConflict502Offset),
    {
      label: 'non-2xx generation conflict',
      stage: 'generator',
      expectedHTTPStatus: 502,
      expectedGenerationId: undefined,
      forbiddenTexts: [
        'gen-run-job-envelope-502',
        'gen-run-job-header-502'
      ]
    }
  );

  const slowResponseBodyJob = tournamentJob(
    'slow-response-body',
    'objective-run-job-slow-response-body-critic'
  );
  const slowResponseBodyFile = writeJob(
    'slow-response-body',
    slowResponseBodyJob
  );
  const slowResponseBodyCallOffset = providerCalls.length;
  const slowResponseBody = await runJob(slowResponseBodyFile, port, {
    env: { PROFILESCRIBE_RIG_OPENROUTER_TIMEOUT_MS: '250' }
  });
  verifySlowResponseBodyTimeout(
    slowResponseBody,
    providerCalls.slice(slowResponseBodyCallOffset)
  );

  const embeddedFailureJob = tournamentJob(
    'embedded-502',
    'objective-run-job-embedded-502'
  );
  const embeddedFailureFile = writeJob('embedded-502', embeddedFailureJob);
  const embeddedFailureCallOffset = providerCalls.length;
  const embeddedFailure = await runJob(embeddedFailureFile, port);
  verifyEmbeddedProviderFailure(
    embeddedFailure,
    providerCalls.slice(embeddedFailureCallOffset)
  );

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
  for (const providerReceipt of [
    metadata.llm?.strategyGeneratorJudge,
    metadata.llm?.commercialCritic
  ]) {
    assertEqual(
      providerReceipt?.responseDiagnostics?.routerStrategy,
      'direct',
      'successful call lost router strategy diagnostics'
    );
    assertEqual(
      providerReceipt?.responseDiagnostics?.routerAttempt,
      1,
      'successful call lost its router attempt count'
    );
    assertEqual(
      providerReceipt?.responseDiagnostics?.routerFallbackUsed,
      undefined,
      'successful direct call incorrectly recorded fallback use'
    );
    assertEqual(
      providerReceipt?.responseDiagnostics?.routerSelectedProvider,
      'OpenAI',
      'successful call lost its selected provider'
    );
    assertEqual(
      providerReceipt?.responseDiagnostics?.routerSelectedModel,
      'deepseek/deepseek-v4-flash-0731',
      'successful call lost its selected model'
    );
    assertEqual(
      providerReceipt?.model,
      'deepseek/deepseek-v4-flash-0731',
      'successful receipt did not account against the selected model'
    );
    assertEqual(
      providerReceipt?.requestedModel,
      'deepseek/deepseek-v4-flash-0731',
      'successful receipt lost the requested primary model'
    );
    assertEqual(
      JSON.stringify(
        providerReceipt?.responseDiagnostics?.routerAttemptStatuses
      ),
      JSON.stringify([200]),
      'successful call lost bounded fallback statuses'
    );
    assertEqual(
      JSON.stringify(providerReceipt?.responseDiagnostics?.routerAttempts),
      JSON.stringify([{
        provider: 'OpenAI',
        model: 'deepseek/deepseek-v4-flash-0731',
        status: 200
      }]),
      'successful call lost its bounded provider attempt trace'
    );
  }
  assert(
    metadata.trace?.notes?.includes(
      'two_bounded_llm_calls_generator_and_critic'
    ),
    'trace did not distinguish generator plus critic'
  );
  assert(
    !/folded_exa|upstream_generator_search|outside_target_discovery_completed_upstream/i.test(
      JSON.stringify(metadata.trace?.notes || [])
    ),
    'trace claimed an Exa/plugin search that was not serialized'
  );
  assertEqual(
    traceStep(metadata, 'run_commercial_critic')?.status,
    'completed',
    'trace did not record the completed critic'
  );
  assertEqual(
    traceStep(metadata, 'generate_semantic_strategy_seeds')?.status,
    'completed',
    'trace did not record the current-job generator call'
  );
  assertEqual(
    traceStep(metadata, 'generate_semantic_strategy_seeds')?.source,
    'current_job_generator_call',
    'trace did not bind generation to its actual current-job source'
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

function verifyInvalidCriticBound(receipt, calls, label) {
  const metadata = receipt.metadata || {};
  const critic = metadata.searchSpace?.commercialCritic || {};
  const providerReceipt = metadata.llm?.commercialCritic || {};
  assertEqual(
    receipt.status,
    'skipped',
    `${label}: schema-invalid critic response did not stop safely`
  );
  assertEqual(calls.length, 2, `${label}: invalid critic caused an extra model call`);
  assertEqual(metadata.usage?.calls, 2, 'invalid critic lost call accounting');
  assertEqual(
    metadata.usage?.successfulCalls,
    2,
    'invalid critic provider completion was not accounted'
  );
  assertEqual(critic.attempted, true, 'invalid critic was not recorded');
  assertEqual(critic.valid, false, 'invalid critic passed local validation');
  assertEqual(
    critic.cause,
    'critic_strict_schema_mismatch',
    `${label}: invalid critic lost its exact local schema cause`
  );
  assertEqual(
    providerReceipt.status,
    'completed',
    'schema-invalid JSON was misclassified as provider transport failure'
  );
  assertEqual(
    metadata.result?.resultType,
    'technical_recovery',
    'invalid critic was mislabeled as a market-evidence result'
  );
  assert(
    !JSON.stringify(receipt).includes(
      'Leading critic reason with  rewritten whitespace'
    ),
    `${label}: schema-invalid authored critic reason survived acceptance`
  );
  verifyNoExecution(metadata);
}

function verifyStrictContentProseRejected(receipt, calls, scenario) {
  const metadata = receipt.metadata || {};
  const generatorReceipt = metadata.llm?.strategyGeneratorJudge;
  const criticReceipt = metadata.llm?.commercialCritic;
  assertEqual(
    receipt.status,
    'skipped',
    `${scenario.label}: prose-wrapped strict JSON was accepted`
  );
  assertEqual(
    calls.length,
    scenario.stage === 'generator' ? 1 : 2,
    `${scenario.label}: strict root rejection changed the call count`
  );
  assertEqual(
    metadata.usage?.calls,
    calls.length,
    `${scenario.label}: strict root rejection lost call accounting`
  );
  assertEqual(
    metadata.usage?.reportedCostMicros,
    calls.length * 4_200,
    `${scenario.label}: strict root rejection lost exact provider cost`
  );
  const rejectedReceipt = scenario.stage === 'generator'
    ? generatorReceipt
    : criticReceipt;
  assertEqual(
    rejectedReceipt?.status,
    'failed',
    `${scenario.label}: malformed strict content was not rejected`
  );
  assertEqual(
    rejectedReceipt?.error,
    'openrouter_invalid_response',
    `${scenario.label}: malformed strict content lost its safe cause`
  );
  assertEqual(
    rejectedReceipt?.openRouterUsage?.cost,
    usage.cost,
    `${scenario.label}: rejected completion lost exact usage`
  );
  assertEqual(
    rejectedReceipt?.responseDiagnostics?.routerAttempt,
    1,
    `${scenario.label}: rejected completion lost its route receipt`
  );
  assertEqual(
    rejectedReceipt?.responseDiagnostics?.routerSelectedProvider,
    'OpenAI',
    `${scenario.label}: rejected completion lost its selected provider`
  );
  assert(
    !JSON.stringify(receipt).includes(STRICT_CONTENT_PROSE_SENTINEL),
    `${scenario.label}: rejected raw model content leaked into the receipt`
  );
  assertEqual(
    metadata.result?.resultType,
    'technical_recovery',
    `${scenario.label}: malformed strict content became business evidence`
  );
  if (scenario.stage === 'critic') {
    assertEqual(
      metadata.searchSpace?.commercialCritic?.cause,
      'critic_provider_failure',
      'critic suffix prose was accepted by substring extraction'
    );
    assertEqual(
      metadata.usage?.successfulCalls,
      1,
      'critic suffix prose changed the generator completion accounting'
    );
  } else {
    assertEqual(
      metadata.usage?.successfulCalls,
      0,
      'generator prefix prose was counted as a successful strict completion'
    );
    assert(
      criticReceipt === undefined,
      'critic ran after generator strict-root rejection'
    );
  }
  verifyNoExecution(metadata);
}

function verifyCriticRouteProvenance(receipt, calls, scenario) {
  const metadata = receipt.metadata || {};
  const critic = metadata.searchSpace?.commercialCritic || {};
  const providerReceipt = metadata.llm?.commercialCritic || {};
  const diagnostics = providerReceipt.responseDiagnostics || {};
  assertEqual(
    calls.length,
    2,
    `${scenario.label}: critic provenance caused an extra model call`
  );
  assertEqual(
    metadata.usage?.calls,
    2,
    `${scenario.label}: critic provenance lost call accounting`
  );
  assertEqual(
    metadata.usage?.successfulCalls,
    2,
    `${scenario.label}: completed HTTP critic usage was not accounted`
  );
  assertEqual(
    providerReceipt.status,
    'completed',
    `${scenario.label}: local route rejection rewrote provider completion`
  );
  assertEqual(
    providerReceipt.openRouterUsage?.cost,
    usage.cost,
    `${scenario.label}: local route gate lost exact provider cost`
  );
  assert(
    !JSON.stringify(providerReceipt).includes('raw-provider-secret-sentinel'),
    `${scenario.label}: route diagnostics leaked a raw provider response`
  );
  if (!scenario.issue) {
    assertEqual(
      receipt.status,
      'completed',
      `${scenario.label}: complete route provenance blocked the critic`
    );
    assertEqual(
      critic.valid,
      true,
      `${scenario.label}: valid critic route was not accepted`
    );
    assertEqual(
      critic.routeProvenanceValidated,
      true,
      `${scenario.label}: accepted critic lacks provenance validation`
    );
    if (scenario.label === 'critic-fallback-provenance') {
      assertEqual(
        diagnostics.routerAttemptSequenceSource,
        'reported',
        'fallback critic did not retain its reported attempt source'
      );
      assertEqual(
        diagnostics.routerAttempt,
        2,
        'fallback critic lost its exact attempt count'
      );
      assertEqual(
        diagnostics.routerFallbackUsed,
        true,
        'fallback critic lost its fallback marker'
      );
      assertEqual(
        JSON.stringify(diagnostics.routerAttempts),
        JSON.stringify([{
          provider: 'OpenAI',
          model: 'deepseek/deepseek-v4-flash-0731',
          status: 502
        }, {
          provider: 'Azure',
          model: 'deepseek/deepseek-v4-flash-0731',
          status: 200
        }]),
        'fallback critic lost its complete ordered route'
      );
    } else if ([
      'critic-direct-reconstructed',
      'critic-direct-missing-model'
    ].includes(scenario.label)) {
      assertEqual(
        diagnostics.routerAttemptSequenceSource,
        'selected_endpoint_reconstructed',
        'direct critic did not record bounded reconstruction provenance'
      );
      assertEqual(
        diagnostics.routerSelectedEndpointEvidenced,
        true,
        'direct reconstruction was not bound to a selected endpoint'
      );
      assertEqual(
        diagnostics.routerAttempt,
        1,
        'direct reconstructed critic lost its exact attempt count'
      );
      if (scenario.label === 'critic-direct-missing-model') {
        assertEqual(
          diagnostics.routerAttempts?.[0]?.status,
          201,
          'direct reconstruction changed the reported successful status'
        );
        assertEqual(
          diagnostics.routerAttemptStatuses?.[0],
          201,
          'direct reconstruction changed the reported status sequence'
        );
      }
    } else {
      assertEqual(
        diagnostics.routerAttemptSequenceSource,
        'reported',
        'complete direct critic did not retain its reported attempt source'
      );
      assertEqual(
        diagnostics.routerAttempt,
        1,
        'reported direct critic lost its exact attempt count'
      );
    }
  } else {
    assertEqual(
      receipt.status,
      'skipped',
      `${scenario.label}: incomplete route provenance accepted a winner: ${JSON.stringify({ critic, providerReceipt, objectiveIds: calls.map((call) => call.input?.objective?.id) })}`
    );
    assertEqual(
      metadata.result?.resultType,
      'technical_recovery',
      `${scenario.label}: route failure became a business result`
    );
    assertEqual(
      metadata.nextExperiment?.kind,
      'strategy_generation_critic_route_provenance_recovery',
      `${scenario.label}: route failure lost its cause-matched recovery`
    );
    assert(
      metadata.nextExperiment?.missingEvidence?.includes(
        'commercial_critic_route_provenance_recovery'
      ) &&
      /selected provider and model.*complete ordered attempt sequence/i.test(
        metadata.nextExperiment?.action || ''
      ) &&
      /new business evidence is not required/i.test(
        metadata.nextExperiment?.rerunPolicy?.trigger || ''
      ),
      `${scenario.label}: route recovery changed business evidence or omitted the route contract`
    );
    assertEqual(
      critic.valid,
      false,
      `${scenario.label}: invalid route passed the critic gate`
    );
    assertEqual(
      critic.cause,
      'critic_route_provenance_invalid',
      `${scenario.label}: invalid route lost its technical cause`
    );
    assertEqual(
      critic.routeProvenanceIssue,
      scenario.issue,
      `${scenario.label}: invalid route lost its exact diagnostic`
    );
    assertEqual(
      critic.routeProvenanceValidated,
      false,
      `${scenario.label}: invalid route claimed provenance validation`
    );
    assertEqual(
      critic.comparisons?.length || 0,
      0,
      `${scenario.label}: rejected critic content survived the route gate`
    );
    if (scenario.conflictKind) {
      assertEqual(
        diagnostics.routerRouteObservationConflict,
        true,
        `${scenario.label}: conflict was not retained as a finite diagnostic`
      );
      assert(
        diagnostics.routerRouteObservationConflictKinds?.includes(
          scenario.conflictKind
        ),
        `${scenario.label}: exact conflict kind was not retained`
      );
      assert(
        !JSON.stringify(providerReceipt).includes(
          'raw-route-conflict-secret-sentinel'
        ),
        `${scenario.label}: route conflict copied arbitrary raw data`
      );
    }
  }
  verifyNoExecution(metadata);
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

function verifyGeneratorDirectMissingModelCanonicalization(receipt, calls) {
  const metadata = receipt.metadata || {};
  const diagnostics = metadata.llm?.strategyGeneratorJudge
    ?.responseDiagnostics || {};
  assertEqual(
    calls.length,
    2,
    'direct generator missing-model parity run changed the two-call contract'
  );
  assertEqual(
    receipt.status,
    'completed',
    'direct generator missing-model sequence was not safely canonicalized'
  );
  assertEqual(
    diagnostics.routerAttempt,
    1,
    'direct generator missing-model sequence lost its attempt count'
  );
  assertEqual(
    diagnostics.routerAttemptSequenceSource,
    'selected_endpoint_reconstructed',
    'direct generator missing-model sequence did not disclose canonicalization'
  );
  assertEqual(
    diagnostics.routerSelectedEndpointEvidenced,
    true,
    'direct generator missing-model canonicalization lacked endpoint evidence'
  );
  assertEqual(
    JSON.stringify(diagnostics.routerAttempts),
    JSON.stringify([{
      provider: 'OpenAI',
      model: 'deepseek/deepseek-v4-flash-0731',
      status: 200
    }]),
    'direct generator missing-model sequence reached the receipt without its reviewed model'
  );
}

function verifyCriticGenerationContract(receipt, calls, scenario) {
  const metadata = receipt.metadata || {};
  const critic = metadata.searchSpace?.commercialCritic || {};
  const providerReceipt = metadata.llm?.commercialCritic || {};
  assertEqual(
    calls.length,
    2,
    `${scenario.label}: generation contract changed the two-call ceiling`
  );
  assertEqual(
    receipt.status,
    'skipped',
    `${scenario.label}: anonymous critic completion was accepted`
  );
  assertEqual(
    metadata.usage?.calls,
    2,
    `${scenario.label}: completed critic lost call accounting`
  );
  assertEqual(
    metadata.usage?.successfulCalls,
    2,
    `${scenario.label}: local identity rejection rewrote provider completion`
  );
  assertEqual(
    providerReceipt.status,
    'completed',
    `${scenario.label}: completed provider call became a transport failure`
  );
  assertEqual(
    providerReceipt.generationId,
    scenario.expectedGenerationId,
    `${scenario.label}: unsafe or missing generation identity persisted`
  );
  assertEqual(
    critic.cause,
    'critic_route_provenance_invalid',
    `${scenario.label}: missing generation identity lost its route cause`
  );
  assertEqual(
    critic.routeProvenanceIssue,
    'generation_id_missing',
    `${scenario.label}: missing generation identity lost its finite issue`
  );
  assertEqual(
    metadata.nextExperiment?.kind,
    'strategy_generation_critic_route_provenance_recovery',
    `${scenario.label}: missing generation identity lost cause-matched recovery`
  );
  if (scenario.forbiddenText) {
    assert(
      !JSON.stringify(receipt).includes(scenario.forbiddenText),
      `${scenario.label}: unsafe generation identity leaked into the receipt`
    );
  }
  verifyNoExecution(metadata);
}

function verifyGenerationConflictFailure(receipt, calls, scenario) {
  const metadata = receipt.metadata || {};
  const providerReceipt = scenario.stage === 'critic'
    ? metadata.llm?.commercialCritic || {}
    : metadata.llm?.strategyGeneratorJudge || {};
  const diagnostics = providerReceipt.responseDiagnostics || {};
  const expectedCalls = scenario.stage === 'critic' ? 2 : 1;
  assertEqual(
    calls.length,
    expectedCalls,
    `${scenario.label}: generation conflict caused a redispatch`
  );
  assertEqual(
    receipt.status,
    'skipped',
    `${scenario.label}: conflicting identities were accepted`
  );
  assertEqual(
    metadata.usage?.calls,
    expectedCalls,
    `${scenario.label}: generation conflict lost call accounting`
  );
  assertEqual(
    metadata.usage?.successfulCalls,
    scenario.stage === 'critic' ? 1 : 0,
    `${scenario.label}: conflicting provider response was accepted`
  );
  assertEqual(
    providerReceipt.status,
    'failed',
    `${scenario.label}: identity conflict became a completed receipt`
  );
  assertEqual(
    providerReceipt.error,
    'openrouter_invalid_response',
    `${scenario.label}: identity conflict lost its finite failure code`
  );
  assertEqual(
    providerReceipt.generationId,
    scenario.expectedGenerationId,
    `${scenario.label}: exact safe envelope generation ID was not retained`
  );
  assertEqual(
    diagnostics.httpStatus,
    scenario.expectedHTTPStatus,
    `${scenario.label}: identity conflict lost its HTTP status`
  );
  assert(
    (scenario.forbiddenTexts || []).every((value) =>
      !JSON.stringify(receipt).includes(value)
    ) &&
      !JSON.stringify(receipt).includes(
        'raw-generation-conflict-secret-sentinel'
      ),
    `${scenario.label}: conflicting identity or provider body leaked`
  );
  assertEqual(
    metadata.nextExperiment?.kind,
    scenario.stage === 'critic'
      ? 'strategy_generation_critic_provider_recovery'
      : 'strategy_generation_provider_recovery',
    `${scenario.label}: invalid provider envelope lost cause-matched recovery`
  );
  verifyNoExecution(metadata);
}

function verifyGeneratorRouteProvenance(receipt, calls, scenario) {
  const metadata = receipt.metadata || {};
  const route = metadata.searchSpace?.strategyGeneratorRoute || {};
  const providerReceipt = metadata.llm?.strategyGeneratorJudge || {};
  assertEqual(
    calls.length,
    1,
    `${scenario.label}: invalid generator route caused another model call`
  );
  assertEqual(
    receipt.status,
    'skipped',
    `${scenario.label}: invalid generator route accepted a result`
  );
  assertEqual(
    metadata.usage?.calls,
    1,
    `${scenario.label}: generator route lost call accounting`
  );
  assertEqual(
    metadata.usage?.successfulCalls,
    1,
    `${scenario.label}: local route rejection rewrote HTTP completion`
  );
  assertEqual(
    providerReceipt.status,
    'completed',
    `${scenario.label}: completed generator became provider failure`
  );
  assertEqual(
    route.routeProvenanceIssue,
    scenario.issue,
    `${scenario.label}: generator route lost its exact diagnostic`
  );
  assertEqual(
    route.routeProvenanceValidated,
    false,
    `${scenario.label}: invalid generator route claimed validation`
  );
  assertEqual(
    metadata.nextExperiment?.kind,
    'strategy_generation_route_provenance_recovery',
    `${scenario.label}: invalid generator route lost technical recovery`
  );
  assertEqual(
    metadata.result?.resultType,
    'technical_recovery',
    `${scenario.label}: invalid generator route became business evidence`
  );
  verifyNoExecution(metadata);
}

function verifyRepairRouteProvenance(receipt, calls, expectedIssue) {
  const metadata = receipt.metadata || {};
  const repair = metadata.searchSpace?.structuredRepair || {};
  const providerReceipt = metadata.llm?.strategyFamilyRepair || {};
  assertEqual(calls.length, 2, 'repair route changed the two-call ceiling');
  assertEqual(receipt.status, 'skipped', 'invalid repair route was accepted');
  assertEqual(
    metadata.usage?.successfulCalls,
    2,
    'local repair route rejection rewrote completed usage'
  );
  assertEqual(
    providerReceipt.status,
    'completed',
    'completed repair route became provider failure'
  );
  assertEqual(
    repair.failure,
    'structured_repair_route_provenance_invalid',
    'repair route lost its bounded failure code'
  );
  assertEqual(
    repair.routeProvenanceIssue,
    expectedIssue,
    'repair route lost its exact diagnostic'
  );
  assertEqual(
    repair.routeProvenanceValidated,
    false,
    'invalid repair route claimed validation'
  );
  assertEqual(
    metadata.nextExperiment?.kind,
    'strategy_generation_route_provenance_recovery',
    'invalid repair route lost cause-matched recovery'
  );
  assertEqual(
    metadata.result?.resultType,
    'technical_recovery',
    'invalid repair route became business evidence'
  );
  verifyNoExecution(metadata);
}

function verifyCriticUsageGate(receipt, calls, scenario) {
  const metadata = receipt.metadata || {};
  const critic = metadata.searchSpace?.commercialCritic || {};
  const providerReceipt = metadata.llm?.commercialCritic || {};
  const diagnostics = providerReceipt.responseDiagnostics || {};
  assertEqual(
    calls.length,
    2,
    `${scenario.label}: invalid usage changed the exact two-call contract`
  );
  assertEqual(
    receipt.status,
    'skipped',
    `${scenario.label}: incomplete/coerced usage accepted a winner`
  );
  assertEqual(
    metadata.usage?.successfulCalls,
    2,
    `${scenario.label}: local usage rejection rewrote HTTP completion`
  );
  assertEqual(
    providerReceipt.status,
    'completed',
    `${scenario.label}: completed critic receipt became provider failure`
  );
  assertEqual(
    diagnostics.httpStatus,
    200,
    `${scenario.label}: safe completed HTTP diagnostic was lost`
  );
  assertEqual(
    critic.cause,
    'critic_provider_usage_invalid',
    `${scenario.label}: invalid usage lost its bounded trace cause`
  );
  assertEqual(
    critic.usageIssue,
    scenario.usageIssue,
    `${scenario.label}: invalid usage lost its exact machine diagnostic`
  );
  assertEqual(
    critic.routeProvenanceValidated,
    false,
    `${scenario.label}: route was claimed before usage acceptance`
  );
  assertEqual(
    critic.exactSchemaValidated,
    false,
    `${scenario.label}: AJV ran before usage acceptance`
  );
  assertEqual(
    metadata.nextExperiment?.kind,
    'strategy_generation_critic_contract_recovery',
    `${scenario.label}: invalid usage lost cause-matched recovery`
  );
  assertEqual(
    metadata.result?.resultType,
    'technical_recovery',
    `${scenario.label}: invalid usage became business evidence`
  );
  verifyNoExecution(metadata);
}

function verifyCriticCallSpendGate(receipt, calls) {
  const metadata = receipt.metadata || {};
  const critic = metadata.searchSpace?.commercialCritic || {};
  const providerReceipt = metadata.llm?.commercialCritic || {};
  assertEqual(
    calls.length,
    2,
    'critic per-call spend rejection changed the exact two-call contract'
  );
  assertEqual(
    receipt.status,
    'skipped',
    'critic cost above its proved request ceiling was accepted'
  );
  assertEqual(
    metadata.usage?.successfulCalls,
    2,
    'critic per-call spend rejection rewrote completed provider usage'
  );
  assertEqual(
    providerReceipt.status,
    'completed',
    'critic per-call spend rejection rewrote the provider completion'
  );
  assertEqual(
    critic.cause,
    'critic_reported_budget_exceeded',
    'critic per-call spend rejection lost its bounded cause'
  );
  assert(
    critic.preflight?.callSpendCeilingMicros < 148_000,
    'critic cost fixture did not exceed the request-specific ceiling'
  );
  assertEqual(
    critic.routeProvenanceValidated,
    false,
    'critic route was claimed before the request-specific cost gate'
  );
  assertEqual(
    critic.exactSchemaValidated,
    false,
    'critic AJV ran before the request-specific cost gate'
  );
  assertEqual(
    metadata.nextExperiment?.kind,
    'strategy_generation_critic_budget_recovery',
    'critic per-call spend rejection lost cause-matched recovery'
  );
  assertEqual(
    metadata.result?.resultType,
    'technical_recovery',
    'critic per-call spend rejection became business evidence'
  );
  verifyNoExecution(metadata);
}

function verifyCriticFinishGate(receipt, calls, scenario) {
  const metadata = receipt.metadata || {};
  const critic = metadata.searchSpace?.commercialCritic || {};
  const providerReceipt = metadata.llm?.commercialCritic || {};
  assertEqual(
    calls.length,
    2,
    `${scenario.label}: invalid finish changed the exact two-call contract`
  );
  assertEqual(
    receipt.status,
    'skipped',
    `${scenario.label}: incomplete finish accepted a winner`
  );
  assertEqual(
    metadata.usage?.successfulCalls,
    scenario.successfulCalls ?? 2,
    `${scenario.label}: local finish rejection rewrote HTTP completion`
  );
  assertEqual(
    providerReceipt.status,
    scenario.providerStatus ?? 'completed',
    `${scenario.label}: completed critic receipt became provider failure`
  );
  assertEqual(
    critic.cause,
    'critic_finish_reason_invalid',
    `${scenario.label}: invalid finish lost its bounded trace cause`
  );
  assertEqual(
    critic.finishIssue,
    scenario.finishIssue,
    `${scenario.label}: invalid finish lost its exact machine diagnostic`
  );
  assertEqual(
    critic.routeProvenanceValidated,
    false,
    `${scenario.label}: route was claimed before finish acceptance`
  );
  assertEqual(
    critic.exactSchemaValidated,
    false,
    `${scenario.label}: AJV ran before finish acceptance`
  );
  assertEqual(
    metadata.nextExperiment?.kind,
    'strategy_generation_critic_contract_recovery',
    `${scenario.label}: invalid finish lost cause-matched recovery`
  );
  assertEqual(
    metadata.result?.resultType,
    'technical_recovery',
    `${scenario.label}: invalid finish became business evidence`
  );
  assert(
    !JSON.stringify(receipt).includes('raw finish reason secret sentinel') &&
      !JSON.stringify(receipt).includes('raw native finish secret sentinel'),
    `${scenario.label}: unsafe finish reason leaked into the durable receipt`
  );
  verifyNoExecution(metadata);
}

function verifyProvider502Failure(receipt, calls) {
  const metadata = receipt.metadata || {};
  const providerReceipt = metadata.llm?.strategyGeneratorJudge || {};
  const diagnostics = providerReceipt.responseDiagnostics || {};
  assertEqual(receipt.status, 'skipped', 'provider 502 did not stop safely');
  assertEqual(calls.length, 1, 'provider 502 caused an application redispatch');
  assertEqual(metadata.usage?.calls, 1, 'provider 502 lost its call count');
  assertEqual(
    metadata.usage?.successfulCalls,
    0,
    'provider 502 recorded a successful model call'
  );
  assertEqual(
    metadata.usage?.costReporting,
    'unavailable',
    'provider 502 fabricated exact cost accounting'
  );
  assertEqual(
    providerReceipt.error,
    'openrouter_provider_unavailable',
    'provider 502 lost its cause-matched error type'
  );
  assertEqual(
    providerReceipt.generationId,
    'gen-run-job-provider-502',
    'provider 502 lost its safe generation header'
  );
  assertEqual(diagnostics.httpStatus, 502, 'provider 502 lost HTTP status');
  assertEqual(
    diagnostics.providerErrorType,
    'provider_unavailable',
    'provider 502 lost the safe upstream type'
  );
  assertEqual(
    diagnostics.providerErrorCode,
    'upstream_502',
    'provider 502 lost the safe upstream code'
  );
  assertEqual(diagnostics.routerAttempt, 2, 'provider 502 lost fallback count');
  assertEqual(
    JSON.stringify(diagnostics.routerAttemptStatuses),
    JSON.stringify([502, 502]),
    'provider 502 lost bounded fallback status diagnostics'
  );
  assertEqual(
    JSON.stringify(diagnostics.routerAttempts),
    JSON.stringify([
      { provider: 'OpenAI', status: 502 },
      { provider: 'Azure', status: 502 }
    ]),
    'provider 502 lost its bounded provider attempt trace'
  );
  assert(
    !JSON.stringify(receipt).includes('raw-provider-secret-sentinel'),
    'provider 502 leaked the raw upstream response body'
  );
  verifyNoExecution(metadata);
}

function verifyBoundedBufferedResponseFailure(receipt, calls, scenario) {
  const metadata = receipt.metadata || {};
  const providerReceipt = scenario.stage === 'critic'
    ? metadata.llm?.commercialCritic || {}
    : metadata.llm?.strategyGeneratorJudge || {};
  const diagnostics = providerReceipt.responseDiagnostics || {};
  const expectedCalls = scenario.stage === 'critic' ? 2 : 1;
  assertEqual(
    receipt.status,
    'skipped',
    `${scenario.label}: unsafe response did not stop safely`
  );
  assertEqual(
    calls.length,
    expectedCalls,
    `${scenario.label}: response failure caused a model redispatch`
  );
  assertEqual(
    calls.filter((call) => call.schemaName ===
      (scenario.stage === 'critic'
        ? 'opportunity_tournament_critic_v1'
        : 'opportunity_tournament_commercial_v2')).length,
    1,
    `${scenario.label}: failing stage was called more than once`
  );
  assertEqual(
    metadata.usage?.calls,
    expectedCalls,
    `${scenario.label}: response failure lost call accounting`
  );
  assertEqual(
    metadata.usage?.successfulCalls,
    scenario.stage === 'critic' ? 1 : 0,
    `${scenario.label}: unsafe response was counted as accepted`
  );
  assertEqual(
    providerReceipt.status,
    'failed',
    `${scenario.label}: unsafe response became a completed receipt`
  );
  assertEqual(
    providerReceipt.error,
    scenario.expectedError,
    `${scenario.label}: response failure lost its finite cause`
  );
  assertEqual(
    providerReceipt.generationId,
    scenario.expectedGenerationId,
    `${scenario.label}: response failure lost its safe generation header`
  );
  assertEqual(
    diagnostics.routerSelectedProvider,
    scenario.expectedProvider,
    `${scenario.label}: response failure lost its safe provider header`
  );
  assertEqual(
    diagnostics.httpStatus,
    scenario.expectedHTTPStatus,
    `${scenario.label}: response failure lost its HTTP status`
  );
  assertEqual(
    diagnostics.contentByteCount,
    scenario.expectedByteCount,
    `${scenario.label}: response failure did not preserve the bounded observed byte count`
  );
  assertEqual(
    diagnostics.contentSha256,
    scenario.expectedSha256,
    `${scenario.label}: response failure did not preserve the bounded observed digest`
  );
  assert(
    diagnostics.contentByteCount <=
      BUFFERED_OPENROUTER_RESPONSE_MAX_BYTES + 1,
    `${scenario.label}: diagnostics retained more than the bounded prefix`
  );
  assert(
    !JSON.stringify(receipt).includes(BUFFERED_RESPONSE_SECRET_SENTINEL),
    `${scenario.label}: raw response content leaked into the receipt`
  );
  if (scenario.expectedError ===
      'openrouter_response_body_too_large' && scenario.stage === 'critic') {
    const expectedRecoveryKind = scenario.expectedRecoveryKind ||
      'strategy_generation_critic_contract_recovery';
    assertEqual(
      metadata.searchSpace?.commercialCritic?.cause,
      expectedRecoveryKind === 'strategy_generation_critic_contract_recovery'
        ? 'critic_contract_invalid'
        : 'critic_provider_failure',
      `${scenario.label}: HTTP status did not control wire-bound classification`
    );
    assertEqual(
      metadata.nextExperiment?.kind,
      expectedRecoveryKind,
      `${scenario.label}: wire-bound failure lost cause-matched recovery`
    );
  }
  verifyNoExecution(metadata);
}

function verifySlowResponseBodyTimeout(receipt, calls) {
  const metadata = receipt.metadata || {};
  const providerReceipt = metadata.llm?.commercialCritic || {};
  const diagnostics = providerReceipt.responseDiagnostics || {};
  assertEqual(
    receipt.status,
    'skipped',
    'slow response body did not stop safely'
  );
  assertEqual(
    calls.length,
    2,
    `slow response body caused an application redispatch: ${JSON.stringify(receipt)}`
  );
  assertEqual(
    metadata.usage?.calls,
    2,
    'slow response body lost its call count'
  );
  assertEqual(
    metadata.usage?.successfulCalls,
    1,
    'slow critic response lost the completed generator call'
  );
  assertEqual(
    providerReceipt.status,
    'failed',
    'slow response body was accepted'
  );
  assertEqual(
    providerReceipt.error,
    'openrouter_timeout',
    'slow response body lost its cause-matched timeout'
  );
  assertEqual(
    providerReceipt.generationId,
    'gen-run-job-slow-response-body',
    'slow response body lost its safe generation header'
  );
  assertEqual(
    diagnostics.routerSelectedProvider,
    'Slow Body Provider',
    'slow response body lost its safe provider header'
  );
  assertEqual(
    diagnostics.timeoutOrigin,
    'profilescribe_local_deadline',
    'slow response body was misattributed as an upstream timeout'
  );
  assertEqual(diagnostics.timeoutKind, 'total', 'slow body timeout kind');
  assertEqual(
    diagnostics.timeoutPhase,
    'response_body',
    'slow body timeout phase'
  );
  assertEqual(
    diagnostics.responseHeadersReceived,
    true,
    'slow body header state'
  );
  assertEqual(diagnostics.timeoutDeadlineMs, 250, 'slow body deadline');
  assert(
    diagnostics.timeoutElapsedMs >= 230,
    `slow body elapsed time missing: ${JSON.stringify(diagnostics)}`
  );
  assert(
    !JSON.stringify(receipt).includes('raw-slow-body-secret-sentinel'),
    'slow response body leaked the raw provider body'
  );
  verifyNoExecution(metadata);
}

function verifyEmbeddedProviderFailure(receipt, calls) {
  const metadata = receipt.metadata || {};
  const providerReceipt = metadata.llm?.strategyGeneratorJudge || {};
  const diagnostics = providerReceipt.responseDiagnostics || {};
  assertEqual(receipt.status, 'skipped', 'embedded provider error did not stop safely');
  assertEqual(calls.length, 1, 'partial provider output caused an application redispatch');
  assertEqual(metadata.usage?.calls, 1, 'embedded provider error lost its call count');
  assertEqual(metadata.usage?.successfulCalls, 0, 'partial provider output was counted as successful');
  assertEqual(providerReceipt.status, 'failed', 'partial provider output was accepted');
  assertEqual(providerReceipt.error, 'openrouter_provider_unavailable', 'embedded provider error lost its cause');
  assertEqual(
    diagnostics.httpStatus,
    200,
    'embedded provider error lost its distinct successful transport status'
  );
  assertEqual(diagnostics.providerErrorType, 'provider_unavailable', 'embedded provider error lost upstream type');
  assertEqual(diagnostics.providerErrorCode, 'upstream_502', 'embedded provider error lost upstream code');
  assertEqual(diagnostics.routerAttempt, 3, 'embedded provider error lost the exhausted route count');
  assert(
    !JSON.stringify(receipt).includes('must-not-be-accepted') &&
      !JSON.stringify(receipt).includes('raw-embedded-provider-secret-sentinel'),
    'embedded provider error leaked or accepted partial/raw output'
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
  assertEqual(call.envelope.temperature, undefined, 'generator must keep the qualified provider request stable');
  assertEqual(call.envelope.model, undefined, 'generator must use the ordered OpenRouter models contract');
  assertEqual(
    JSON.stringify(call.envelope.reasoning),
    JSON.stringify({ enabled: false, exclude: true }),
    'generator lost the bounded reasoning-disabled contract'
  );
  assertEqual(
    JSON.stringify(call.envelope.models),
    JSON.stringify(['deepseek/deepseek-v4-flash-0731']),
    'generator lost the bounded multi-vendor model route'
  );
  assertEqual(
    call.envelope.provider?.data_collection,
    'deny',
    'generator lost the privacy route'
  );
  assertEqual(
    call.envelope.provider?.allow_fallbacks,
    true,
    'generator disabled compatible multi-vendor fallback'
  );
  assertEqual(call.envelope.provider?.order, undefined,
    'generator unexpectedly pinned a provider order');
  assertEqual(call.envelope.provider?.only, undefined,
    'generator replaced default routing with a provider allowlist');
  assertEqual(
    JSON.stringify(call.envelope.provider?.ignore),
    JSON.stringify([
      'cloudflare',
      'open-inference',
      'decart',
      'digitalocean',
      'akashml',
      'siliconflow',
      'wafer'
    ]),
    'generator lost its evidence-backed provider quarantine'
  );
  assertEqual(
    call.envelope.provider?.require_parameters,
    true,
    'generator allowed a fallback that cannot honor the strict request'
  );
  assertEqual(
    call.envelope.provider?.sort,
    'throughput',
    'generator did not prioritize deadline-compatible throughput'
  );
  assertEqual(
    call.routerMetadataHeader,
    'enabled',
    'generator did not opt into bounded router diagnostics'
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
  assertEqual(call.envelope.max_tokens, 2000, 'critic output was not bounded');
  assertEqual(call.envelope.stream, undefined, 'critic must stay buffered');
  assertEqual(
    JSON.stringify(call.envelope.plugins),
    JSON.stringify([{ id: 'response-healing' }]),
    'critic lost bounded response healing'
  );
  const schemaEnvelope = call.envelope.response_format?.json_schema || {};
  const schema = schemaEnvelope.schema || {};
  const comparison = schema.properties?.comparisons?.items || {};
  assertEqual(schemaEnvelope.strict, true, 'critic schema was not strict');
  assertEqual(
    comparison.properties?.reason?.maxLength,
    240,
    'critic comparison reason was unbounded'
  );
  assertEqual(
    schema.properties?.reason?.maxLength,
    360,
    'critic ordering reason was unbounded'
  );
  const maximumResponse = maximumJSONSchemaValue(schema);
  const maximumResponseBytes = Buffer.byteLength(
    JSON.stringify(maximumResponse),
    'utf8'
  );
  assert(
    maximumResponseBytes > 14_000 && maximumResponseBytes <= 16 * 1_024,
    `critic schema response bound drifted: ${maximumResponseBytes}`
  );
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

function maximumJSONSchemaValue(schemaValue) {
  const schema = schemaValue || {};
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.reduce((longest, candidate) =>
      Buffer.byteLength(JSON.stringify(candidate), 'utf8') >
        Buffer.byteLength(JSON.stringify(longest), 'utf8')
        ? candidate
        : longest
    );
  }
  if (schema.type === 'object') {
    return Object.fromEntries((schema.required || []).map((key) => [
      key,
      maximumJSONSchemaValue(schema.properties?.[key])
    ]));
  }
  if (schema.type === 'array') {
    return Array.from(
      { length: schema.maxItems },
      () => maximumJSONSchemaValue(schema.items)
    );
  }
  if (schema.type === 'string') {
    return '\0'.repeat(schema.maxLength);
  }
  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer' || schema.type === 'number') {
    const candidates = [schema.minimum, schema.maximum]
      .filter((value) => Number.isFinite(value));
    return candidates.reduce((longest, candidate) =>
      JSON.stringify(candidate).length > JSON.stringify(longest).length
        ? candidate
        : longest
    );
  }
  throw new Error(`unsupported critic schema node: ${JSON.stringify(schema)}`);
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
          'deepseek/deepseek-v4-flash-0731',
        PROFILESCRIBE_APP_URL: 'https://profilescribe.test',
        PROFILESCRIBE_AGENT_TOKEN: 'test-token',
        ...(options.mcpURL
          ? { PROFILESCRIBE_MCP_URL: options.mcpURL }
          : {}),
        ...(options.env || {})
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
