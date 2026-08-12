#!/usr/bin/env node

import { readOpenRouterChatCompletionSSE } from '../bin/openrouter-sse.mjs';
import { serializeOpenRouterJSONRequestBody } from '../bin/opportunity-tournament.mjs';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);

await verifyActiveGenerationOutlivesFormerWallClock();
await verifyOpenRouterProcessingKeepalivesPreserveLiveness();
await verifyStalledGenerationHitsIdleDeadline();
await verifyActiveGenerationStillHitsHardDeadline();
await verifyMidstreamErrorRemainsAnErrorEnvelope();
await verifyIncompleteTerminalAccountingIsRejected();
await verifyInvalidSuccessContractsAreRejected();
await verifyTerminalAccountingIsBoundToFinalEvent();
await verifyHangingCancelCannotDefeatDeadline();
verifyStreamingRequestIsInsideExactSerializedPreflight();
await verifyRunJobUsesStreamingTransport();

process.stdout.write(
  'OpenRouter SSE smoke passed (active progress, idle deadline, hard deadline, exact serialized request)\n'
);

async function verifyActiveGenerationOutlivesFormerWallClock() {
  const oldScaledWallClockMs = 55;
  const startedAt = Date.now();
  const stream = scheduledStream([
    [0, event({
      id: 'gen-stream-success',
      model: 'deepseek/deepseek-v4-flash-0731',
      provider: 'Provider A',
      choices: [{ delta: { content: '{"status":' } }]
    })],
    [25, event({
      id: 'gen-stream-success',
      choices: [{ delta: { content: '"planned"' } }]
    })],
    [25, event({
      id: 'gen-stream-success',
      choices: [{ delta: { content: '}' } }]
    })],
    [25, event({
      id: 'gen-stream-success',
      choices: [{
        delta: {},
        finish_reason: 'stop',
        native_finish_reason: 'stop'
      }]
    })],
    [25, event({
      id: 'gen-stream-success',
      choices: [],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        cost: 0.001
      },
      openrouter_metadata: {
        strategy: 'default',
        attempt: 2,
        endpoints: {
          total: 2,
          available: [{
            provider: 'Provider A',
            model: 'deepseek/deepseek-v4-flash-0731',
            selected: true
          }]
        },
        attempts: [
          {
            provider: 'Provider B',
            model: 'deepseek/deepseek-v4-flash-0731',
            status: 524
          },
          {
            provider: 'Provider A',
            model: 'deepseek/deepseek-v4-flash-0731',
            status: 200
          }
        ]
      }
    })],
    [0, 'data: [DONE]\n\n']
  ]);

  const result = await readOpenRouterChatCompletionSSE(stream, {
    idleTimeoutMs: 45,
    totalTimeoutMs: 250,
    initialGenerationId: 'gen-stream-success',
    initialSelectedProvider: 'Header Provider'
  });
  const elapsedMs = Date.now() - startedAt;
  assert(
    elapsedMs > oldScaledWallClockMs,
    `active stream did not outlive scaled former wall clock (${elapsedMs}ms)`
  );
  assertEqual(
    result.envelope.choices[0].message.content,
    '{"status":"planned"}',
    'stream content was not reconstructed'
  );
  assertEqual(result.envelope.id, 'gen-stream-success', 'generation id lost');
  assertEqual(result.envelope.provider, 'Provider A', 'selected provider lost');
  assertEqual(result.envelope.usage.total_tokens, 120, 'usage chunk lost');
  assertEqual(
    result.envelope.openrouter_metadata.attempts.length,
    2,
    'router attempt sequence lost'
  );
  assert(result.diagnostics.streamCompleted === true, 'stream not complete');
}

async function verifyStalledGenerationHitsIdleDeadline() {
  const stream = scheduledStream([
    [0, event({
      id: 'gen-stream-idle',
      choices: [{ delta: { content: '{' } }]
    })],
    [100, event({
      id: 'gen-stream-idle',
      choices: [{ delta: { content: '}' }, finish_reason: 'stop' }]
    })]
  ]);
  let caught;
  try {
    await readOpenRouterChatCompletionSSE(stream, {
      idleTimeoutMs: 35,
      totalTimeoutMs: 200,
      initialSelectedProvider: 'Header Provider'
    });
  } catch (error) {
    caught = error;
  }
  assert(caught, 'stalled stream unexpectedly succeeded');
  assertEqual(caught.openRouterFailureCode, 'openrouter_timeout', 'idle code');
  assertEqual(caught.openRouterStreamState.timeoutKind, 'idle', 'idle kind');
  assertEqual(
    caught.openRouterStreamState.selectedProvider,
    'Header Provider',
    'safe selected-provider header was lost on timeout'
  );
  assertEqual(
    caught.openRouterStreamState.contentByteCount,
    1,
    'partial timeout byte diagnostic drifted'
  );
  assert(
    /^[a-f0-9]{64}$/.test(caught.openRouterStreamState.contentSha256),
    'partial timeout content hash missing'
  );
}

async function verifyOpenRouterProcessingKeepalivesPreserveLiveness() {
  const stream = scheduledStream([
    [0, ': OPENROUTER PROCESSING\n\n'],
    [20, ': OPENROUTER PROCESSING\n\n'],
    [20, ': OPENROUTER PROCESSING\n\n'],
    [20, event({
      id: 'gen-stream-keepalive',
      choices: [{ delta: { content: '{}' }, finish_reason: 'stop' }]
    })],
    [0, event({
      id: 'gen-stream-keepalive',
      choices: [],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 2,
        total_tokens: 12,
        cost: 0.0001
      },
      openrouter_metadata: {
        strategy: 'default',
        attempt: 1,
        endpoints: {
          total: 1,
          available: [{
            provider: 'Keepalive Provider',
            model: 'deepseek/deepseek-v4-flash-0731',
            selected: true
          }]
        },
        attempts: [{
          provider: 'Keepalive Provider',
          model: 'deepseek/deepseek-v4-flash-0731',
          status: 200
        }]
      }
    })],
    [0, 'data: [DONE]\n\n']
  ]);
  const result = await readOpenRouterChatCompletionSSE(stream, {
    idleTimeoutMs: 30,
    totalTimeoutMs: 150
  });
  assertEqual(
    result.envelope.choices[0].message.content,
    '{}',
    'documented OpenRouter processing keepalive did not preserve liveness'
  );
}

async function verifyActiveGenerationStillHitsHardDeadline() {
  const events = [];
  for (let index = 0; index < 10; index += 1) {
    events.push([index === 0 ? 0 : 15, event({
      id: 'gen-stream-total',
      choices: [{ delta: { content: String(index) } }]
    })]);
  }
  const stream = scheduledStream(events);
  let caught;
  try {
    await readOpenRouterChatCompletionSSE(stream, {
      idleTimeoutMs: 40,
      totalTimeoutMs: 65
    });
  } catch (error) {
    caught = error;
  }
  assert(caught, 'unbounded active stream unexpectedly succeeded');
  assertEqual(caught.openRouterFailureCode, 'openrouter_timeout', 'total code');
  assertEqual(caught.openRouterStreamState.timeoutKind, 'total', 'total kind');
}

async function verifyMidstreamErrorRemainsAnErrorEnvelope() {
  const abortController = new AbortController();
  const stream = scheduledStream([
    [0, event({
      id: 'gen-stream-error',
      choices: [{ delta: { content: '{"partial":' } }]
    }).replace(/\n/g, '\r\n')],
    [5, event({
      id: 'gen-stream-error',
      provider: 'Failed Provider',
      error: {
        code: 502,
        message: 'upstream failed after streaming began',
        metadata: {
          error_type: 'provider_unavailable',
          provider_code: 'upstream_502'
        }
      },
      choices: []
    }).replace(/\n/g, '\r\n')]
  ]);
  const result = await readOpenRouterChatCompletionSSE(stream, {
    idleTimeoutMs: 40,
    totalTimeoutMs: 100,
    abortController
  });
  assertEqual(result.envelope.error.code, 502, 'midstream error was lost');
  assertEqual(
    result.envelope.choices[0].message.content,
    '{"partial":',
    'midstream partial-content accounting drifted'
  );
  assertEqual(result.envelope.provider, 'Failed Provider', 'error provider lost');
  assert(abortController.signal.aborted, 'midstream error did not abort transport');
  assert(
    /^[a-f0-9]{64}$/.test(result.diagnostics.contentSha256),
    'midstream error partial-content hash missing'
  );
}

async function verifyIncompleteTerminalAccountingIsRejected() {
  const incompleteCases = [
    scheduledStream([
      [0, event({
        id: 'gen-stream-no-accounting',
        choices: [{
          delta: { content: '{}' },
          finish_reason: 'stop'
        }]
      })],
      [0, 'data: [DONE]\n\n']
    ]),
    scheduledStream([
      [0, event({
        id: 'gen-stream-no-done',
        choices: [{
          delta: { content: '{}' },
          finish_reason: 'stop'
        }]
      })],
      [0, event({
        id: 'gen-stream-no-done',
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        openrouter_metadata: {
          strategy: 'default',
          attempt: 1,
          attempts: [{ provider: 'Incomplete Provider', status: 200 }]
        }
      })]
    ])
  ];
  for (const stream of incompleteCases) {
    let caught;
    try {
      await readOpenRouterChatCompletionSSE(stream, {
        idleTimeoutMs: 50,
        totalTimeoutMs: 150
      });
    } catch (error) {
      caught = error;
    }
    assert(caught, 'incomplete terminal accounting unexpectedly succeeded');
    assertEqual(
      caught.openRouterFailureCode,
      'openrouter_invalid_response',
      'incomplete terminal accounting failure code'
    );
    assert(
      caught.openRouterStreamState?.streamCompleted === false,
      'incomplete stream was marked complete'
    );
  }
}

async function verifyInvalidSuccessContractsAreRejected() {
  const baseUsage = {
    prompt_tokens: 10,
    completion_tokens: 2,
    total_tokens: 12,
    cost: 0.0001
  };
  const baseMetadata = {
    strategy: 'default',
    attempt: 1,
    endpoints: {
      total: 1,
      available: [{
        provider: 'Contract Provider',
        model: 'deepseek/deepseek-v4-flash-0731',
        selected: true
      }]
    },
    attempts: [{
      provider: 'Contract Provider',
      model: 'deepseek/deepseek-v4-flash-0731',
      status: 200
    }]
  };
  const cases = [
    {
      name: 'malformed usage',
      finishReason: 'stop',
      usage: { garbage: true },
      metadata: baseMetadata
    },
    {
      name: 'non-success finish',
      finishReason: 'content_filter',
      usage: baseUsage,
      metadata: baseMetadata
    },
    {
      name: 'incomplete fallback trace',
      finishReason: 'stop',
      usage: baseUsage,
      metadata: {
        ...baseMetadata,
        attempt: 2,
        endpoints: {
          total: 2,
          available: baseMetadata.endpoints.available
        },
        attempts: [{
          provider: 'Contract Provider',
          model: 'deepseek/deepseek-v4-flash-0731',
          status: 200
        }]
      }
    }
  ];
  for (const testCase of cases) {
    const stream = scheduledStream([
      [0, event({
        id: `gen-stream-${testCase.name.replaceAll(' ', '-')}`,
        model: 'deepseek/deepseek-v4-flash-0731',
        provider: 'Contract Provider',
        choices: [{
          delta: { content: '{}' },
          finish_reason: testCase.finishReason
        }]
      })],
      [0, event({
        id: `gen-stream-${testCase.name.replaceAll(' ', '-')}`,
        choices: [],
        usage: testCase.usage,
        openrouter_metadata: testCase.metadata
      })],
      [0, 'data: [DONE]\n\n']
    ]);
    let caught;
    try {
      await readOpenRouterChatCompletionSSE(stream, {
        idleTimeoutMs: 50,
        totalTimeoutMs: 150
      });
    } catch (error) {
      caught = error;
    }
    assert(caught, `${testCase.name} unexpectedly succeeded`);
    assertEqual(
      caught.openRouterFailureCode,
      'openrouter_invalid_response',
      `${testCase.name} failure code`
    );
    assert(
      caught.openRouterStreamState?.streamCompleted === false,
      `${testCase.name} was marked complete`
    );
  }
}

async function verifyTerminalAccountingIsBoundToFinalEvent() {
  const metadata = {
    strategy: 'default',
    attempt: 1,
    endpoints: {
      total: 1,
      available: [{
        provider: 'Terminal Provider',
        model: 'deepseek/deepseek-v4-flash-0731',
        selected: true
      }]
    },
    attempts: [{
      provider: 'Terminal Provider',
      model: 'deepseek/deepseek-v4-flash-0731',
      status: 200
    }]
  };
  const stream = scheduledStream([
    [0, event({
      id: 'gen-stream-early-accounting',
      model: 'deepseek/deepseek-v4-flash-0731',
      provider: 'Terminal Provider',
      choices: [{
        delta: { content: '{' },
        finish_reason: 'stop'
      }]
    })],
    [0, event({
      id: 'gen-stream-early-accounting',
      choices: [],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 2,
        total_tokens: 12,
        cost: 0.0001
      },
      openrouter_metadata: metadata
    })],
    [0, ': OPENROUTER PROCESSING\n\n'],
    [0, event({
      id: 'gen-stream-early-accounting',
      choices: [{ delta: { content: '}' } }]
    })],
    [0, 'data: [DONE]\n\n']
  ]);
  let caught;
  try {
    await readOpenRouterChatCompletionSSE(stream, {
      idleTimeoutMs: 50,
      totalTimeoutMs: 150
    });
  } catch (error) {
    caught = error;
  }
  assert(caught, 'early accounting followed by content unexpectedly succeeded');
  assertEqual(
    caught.openRouterFailureCode,
    'openrouter_invalid_response',
    'terminal accounting binding failure code'
  );
  assert(
    caught.openRouterStreamState?.streamCompleted === false,
    'early accounting was marked terminal after a later JSON event'
  );
}

async function verifyHangingCancelCannotDefeatDeadline() {
  const stream = new ReadableStream({
    start() {
      // Intentionally never emit or close.
    },
    cancel() {
      return new Promise(() => {});
    }
  });
  const startedAt = Date.now();
  let caught;
  try {
    await readOpenRouterChatCompletionSSE(stream, {
      idleTimeoutMs: 25,
      totalTimeoutMs: 100
    });
  } catch (error) {
    caught = error;
  }
  assert(caught, 'hanging cancellation unexpectedly succeeded');
  assertEqual(caught.openRouterFailureCode, 'openrouter_timeout', 'cancel code');
  assert(
    Date.now() - startedAt < 80,
    'hanging reader.cancel defeated the bounded idle deadline'
  );
}

function verifyStreamingRequestIsInsideExactSerializedPreflight() {
  const serialized = serializeOpenRouterJSONRequestBody({
    models: ['deepseek/deepseek-v4-flash-0731'],
    system: 'system',
    user: 'user',
    maxTokens: 64_000,
    reasoning: { enabled: false, exclude: true },
    provider: {
      allow_fallbacks: true,
      require_parameters: true,
      data_collection: 'deny',
      max_price: { prompt: 2, completion: 6, request: 0 }
    },
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: 'test',
        strict: true,
        schema: { type: 'object', additionalProperties: false }
      }
    },
    stream: true,
    streamIdleTimeoutMs: 1,
    streamTotalTimeoutMs: 2
  });
  const request = JSON.parse(serialized);
  assert(request.stream === true, 'stream flag missing from serialized body');
  assert(
    request.stream_options === undefined,
    'deprecated stream_options leaked into serialized body'
  );
  assert(
    !serialized.includes('streamIdleTimeoutMs') &&
      !serialized.includes('streamTotalTimeoutMs'),
    'local deadlines leaked into the provider body'
  );
}

async function verifyRunJobUsesStreamingTransport() {
  let providerRequest;
  const server = createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    providerRequest = JSON.parse(raw || '{}');
    const providerInput = JSON.parse(
      providerRequest.messages?.find((message) => message.role === 'user')
        ?.content || '{}'
    );
    if (providerInput.objective?.id === 'objective-openrouter-sse-empty') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'X-Generation-Id': 'gen-sse-empty-header',
        'X-Provider-Name': 'Empty Stream Provider'
      });
      response.end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'X-Generation-Id': 'gen-sse-integration',
      'X-Provider-Name': 'Integration Header Provider'
    });
    response.flushHeaders();
    response.write(': OPENROUTER PROCESSING\n\n');
    await delay(15);
    response.write(event({
      id: 'gen-sse-integration',
      model: 'deepseek/deepseek-v4-flash-0731',
      provider: 'Integration Provider',
      choices: [{ delta: { content: JSON.stringify({
        contractVersion: 'opportunity_discovery_plan_v1',
        status: 'planned',
        reason: '',
        plans: []
      }) } }]
    }));
    await delay(15);
    response.write(event({
      id: 'gen-sse-integration',
      choices: [{
        delta: {},
        finish_reason: 'stop',
        native_finish_reason: 'stop'
      }]
    }));
    response.write(event({
      id: 'gen-sse-integration',
      choices: [],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        cost: 0.001
      },
      openrouter_metadata: {
        strategy: 'default',
        attempt: 1,
        endpoints: {
          total: 1,
          available: [{
            provider: 'Integration Provider',
            model: 'deepseek/deepseek-v4-flash-0731',
            selected: true
          }]
        },
        attempts: [{ provider: 'Integration Provider', status: 200 }]
      }
    }));
    response.end('data: [DONE]\n\n');
  });
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), 'profilescribe-openrouter-sse-')
  );
  try {
    await new Promise((resolveListen) =>
      server.listen(0, '127.0.0.1', resolveListen)
    );
    const jobFile = join(temporaryDirectory, 'job.json');
    writeFileSync(jobFile, JSON.stringify(streamingPlannerJob()), 'utf8');
    const execution = await runCommand(
      process.execPath,
      ['bin/run-job.mjs', '--job-file', jobFile],
      {
        ...process.env,
        OPENROUTER_API_KEY: 'smoke-key',
        PROFILESCRIBE_RIG_OPENROUTER_CHAT_COMPLETIONS_URL:
          `http://127.0.0.1:${server.address().port}/openrouter`,
        PROFILESCRIBE_RIG_OPENROUTER_STREAM_START_TIMEOUT_MS: '1000',
        PROFILESCRIBE_RIG_OPENROUTER_STREAM_IDLE_TIMEOUT_MS: '100',
        PROFILESCRIBE_RIG_OPENROUTER_STREAM_TOTAL_TIMEOUT_MS: '2000'
      }
    );
    assertEqual(execution.code, 0, `run-job integration failed: ${execution.stderr}`);
    const output = JSON.parse(execution.stdout);
    const planner = output.metadata?.discoveryPlan?.llm?.discoveryPlanner;
    const diagnostics = planner?.responseDiagnostics;
    assert(
      providerRequest?.stream === true,
      `run-job omitted stream request: ${JSON.stringify(output.metadata?.discoveryPlan)}`
    );
    assert(
      providerRequest?.stream_options === undefined,
      'run-job sent deprecated stream_options'
    );
    assertEqual(planner?.generationId, 'gen-sse-integration', 'run-job generation id');
    assertEqual(
      diagnostics?.routerSelectedProvider,
      'Integration Provider',
      'run-job selected provider'
    );
    assert(diagnostics?.streaming === true, 'run-job stream diagnostic missing');
    assert(diagnostics?.streamCompleted === true, 'run-job stream completion missing');
    assertEqual(
      planner?.openRouterUsage?.total_tokens,
      120,
      'run-job usage lost'
    );

    const emptyJobFile = join(temporaryDirectory, 'empty-job.json');
    writeFileSync(
      emptyJobFile,
      JSON.stringify(streamingPlannerJob('empty')),
      'utf8'
    );
    const emptyExecution = await runCommand(
      process.execPath,
      ['bin/run-job.mjs', '--job-file', emptyJobFile],
      {
        ...process.env,
        OPENROUTER_API_KEY: 'smoke-key',
        PROFILESCRIBE_RIG_OPENROUTER_CHAT_COMPLETIONS_URL:
          `http://127.0.0.1:${server.address().port}/openrouter`,
        PROFILESCRIBE_RIG_OPENROUTER_STREAM_START_TIMEOUT_MS: '1000',
        PROFILESCRIBE_RIG_OPENROUTER_STREAM_IDLE_TIMEOUT_MS: '100',
        PROFILESCRIBE_RIG_OPENROUTER_STREAM_TOTAL_TIMEOUT_MS: '2000'
      }
    );
    assertEqual(
      emptyExecution.code,
      0,
      `empty run-job integration failed: ${emptyExecution.stderr}`
    );
    const emptyOutput = JSON.parse(emptyExecution.stdout);
    const emptyPlanner =
      emptyOutput.metadata?.discoveryPlan?.llm?.discoveryPlanner;
    const emptyDiagnostics = emptyPlanner?.responseDiagnostics;
    assertEqual(
      emptyPlanner?.error,
      'openrouter_invalid_response',
      'empty stream lost its cause-matched provider error'
    );
    assertEqual(
      emptyPlanner?.generationId,
      'gen-sse-empty-header',
      'empty stream lost its safe generation header'
    );
    assertEqual(
      emptyDiagnostics?.routerSelectedProvider,
      'Empty Stream Provider',
      'empty stream lost its safe selected-provider header'
    );
    assertEqual(emptyDiagnostics?.httpStatus, 200, 'empty stream HTTP status');
    assertEqual(
      emptyDiagnostics?.responseHeadersReceived,
      true,
      'empty stream header state'
    );
    assertEqual(emptyDiagnostics?.contentByteCount, 0, 'empty stream byte count');
    assertEqual(
      emptyDiagnostics?.contentSha256,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'empty stream safe body hash'
    );
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function streamingPlannerJob(label = 'integration') {
  return {
    id: `job-openrouter-sse-${label}`,
    kind: 'opportunity_tournament',
    tenantId: 'tenant-openrouter-sse-integration',
    userId: 'user-openrouter-sse-integration',
    payload: {
      tournamentId: `tournament-openrouter-sse-${label}`,
      discoveryPlanningOnly: true,
      researchOnly: true,
      objective: {
        id: `objective-openrouter-sse-${label}`,
        outcome: 'Generate one new attributable paid consultation.',
        successMetric: 'One attributed paid booking.',
        targetCount: 1,
        allowedActions: ['research', 'recommend', 'review'],
        constraints: ['Research and recommendation only.']
      },
      budget: {
        currency: 'USD',
        maxSpendMicros: 1_000_000,
        maxLLMSpendMicros: 560_000,
        maxHypotheses: 10_000,
        maxFinalists: 20,
        maxLLMCalls: 2,
        maxOutputTokens: 64_000,
        providerMaxPrice: { prompt: 2, completion: 6, request: 0 },
        hardStop: true
      },
      commercialContext: {
        profile: {
          profession: 'Operations consultant',
          location: 'United States',
          specialties: ['delivery-system consulting']
        },
        allowedChannels: ['organic search'],
        allowedActions: ['research', 'recommend', 'review'],
        permissionRequired: 'explicit_user_approval'
      },
      evidenceSnapshot: {
        profile: {
          identity: {
            fullName: 'Casey Founder',
            website: 'https://example.com/',
            profession: 'Operations consultant',
            headline: 'Paid delivery-system consulting for service firms',
            location: 'United States',
            specialties: ['delivery-system consulting']
          }
        },
        sources: [{
          id: 'src-sse',
          kind: 'website',
          label: 'Paid consultation page',
          url: 'https://example.com/consultation',
          status: 'approved',
          trustLevel: 'high',
          profileControlled: true
        }],
        sourceEvidence: [{
          observationId: 'obs-sse',
          sourceId: 'src-sse',
          kind: 'service-page',
          title: 'Paid consultation booking page',
          summary:
            'Professional clients can pay $500 and book a current consultation through this owned page. The booking record stores the organic-search UTM source.',
          url: 'https://example.com/consultation',
          observedAt: '2026-08-12T12:00:00Z',
          confidence: 'high'
        }]
      }
    }
  };
}

function runCommand(command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: root, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

function scheduledStream(events) {
  let cancelled = false;
  return new ReadableStream({
    start(controller) {
      void (async () => {
        for (const [delayMs, value] of events) {
          await delay(delayMs);
          if (cancelled) return;
          controller.enqueue(new TextEncoder().encode(value));
        }
        if (!cancelled) controller.close();
      })();
    },
    cancel() {
      cancelled = true;
    }
  });
}

function event(value) {
  return `data: ${JSON.stringify(value)}\n\n`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}
