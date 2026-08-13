#!/usr/bin/env node

import { readOpenRouterChatCompletionSSE } from '../bin/openrouter-sse.mjs';
import { serializeOpenRouterJSONRequestBody } from '../bin/opportunity-tournament.mjs';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
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
await verifyDisputedGenerationIdentityIsNeverCanonical();
await verifyConflictingRouteObservationsAreRejected();
await verifyReviewedPermaslugObservationIsAccepted();
await verifyRouteAttemptBoundsAndOutcomes();
await verifyPlannerContentLimitIsEnforced();
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
    initialSelectedProvider: 'Provider A'
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
    caught.openRouterStreamState.headerProvider,
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

async function verifyDisputedGenerationIdentityIsNeverCanonical() {
  for (const scenario of [{
    name: 'header versus first chunk',
    initialGenerationId: 'gen-stream-header-disputed',
    events: [[0, event({
      id: 'gen-stream-first-chunk-disputed',
      choices: [{ delta: { content: '{}' } }]
    })]],
    forbidden: [
      'gen-stream-header-disputed',
      'gen-stream-first-chunk-disputed'
    ]
  }, {
    name: 'first chunk versus later chunk',
    initialGenerationId: undefined,
    events: [[0, event({
      id: 'gen-stream-first-disputed',
      choices: [{ delta: { content: '{' } }]
    })], [0, event({
      id: 'gen-stream-later-disputed',
      choices: [{ delta: { content: '}' } }]
    })]],
    forbidden: [
      'gen-stream-first-disputed',
      'gen-stream-later-disputed'
    ]
  }]) {
    let caught;
    try {
      await readOpenRouterChatCompletionSSE(
        scheduledStream(scenario.events),
        {
          idleTimeoutMs: 100,
          totalTimeoutMs: 500,
          initialGenerationId: scenario.initialGenerationId
        }
      );
    } catch (error) {
      caught = error;
    }
    assert(caught, `${scenario.name} identity conflict unexpectedly succeeded`);
    assertEqual(
      caught.openRouterFailureCode,
      'openrouter_invalid_response',
      `${scenario.name} identity conflict failure code`
    );
    assertEqual(
      caught.openRouterStreamState?.generationId,
      '',
      `${scenario.name} retained a disputed canonical generation ID`
    );
    assert(
      scenario.forbidden.every((value) =>
        !JSON.stringify(caught.openRouterStreamState).includes(value)
      ),
      `${scenario.name} leaked a disputed ID through bounded stream state`
    );
  }
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
      name: 'unsafe freeform finish',
      finishReason: 'raw finish reason secret sentinel !',
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
    assert(
      !JSON.stringify(caught.openRouterStreamState || {}).includes(
        'raw finish reason secret sentinel'
      ),
      `${testCase.name} leaked a freeform provider finish reason`
    );
  }
}

async function verifyConflictingRouteObservationsAreRejected() {
  for (const testCase of [{
    name: 'provider conflict',
    envelopeProvider: 'Contradictory Provider',
    envelopeModel: 'deepseek/deepseek-v4-flash-0731',
    expectedConflict: 'envelope_provider_conflict'
  }, {
    name: 'model conflict',
    envelopeProvider: 'Selected Provider',
    envelopeModel: 'foreign/vendor-model',
    expectedConflict: 'envelope_model_conflict'
  }]) {
    const stream = scheduledStream([
      [0, event({
        id: `gen-stream-${testCase.name.replaceAll(' ', '-')}`,
        model: testCase.envelopeModel,
        provider: testCase.envelopeProvider,
        choices: [{
          delta: { content: '{}' },
          finish_reason: 'stop',
          native_finish_reason: 'stop'
        }]
      })],
      [0, event({
        id: `gen-stream-${testCase.name.replaceAll(' ', '-')}`,
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 2,
          total_tokens: 12,
          cost: 0.0001
        },
        openrouter_metadata: {
          strategy: 'direct',
          attempt: 1,
          endpoints: {
            total: 1,
            available: [{
              provider: 'Selected Provider',
              model: 'deepseek/deepseek-v4-flash-0731',
              selected: true
            }]
          },
          attempts: [{
            provider: 'Selected Provider',
            model: 'deepseek/deepseek-v4-flash-0731',
            status: 200
          }]
        }
      })],
      [0, 'data: [DONE]\n\n']
    ]);
    let caught;
    try {
      await readOpenRouterChatCompletionSSE(stream, {
        idleTimeoutMs: 50,
        totalTimeoutMs: 150,
        initialSelectedProvider: 'Selected Provider'
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
      caught.openRouterStreamState?.routeObservationConflictKinds?.includes(
        testCase.expectedConflict
      ),
      `${testCase.name} lost its finite conflict diagnostic`
    );
    assert(
      caught.openRouterStreamState?.streamCompleted === false,
      `${testCase.name} was accepted as a complete stream`
    );
  }
}

async function verifyReviewedPermaslugObservationIsAccepted() {
  const stream = scheduledStream([
    [0, event({
      id: 'gen-stream-reviewed-permaslug',
      model: 'deepseek/deepseek-v4-flash-0731',
      provider: 'Alias Provider',
      choices: [{
        delta: { content: '{}' },
        finish_reason: 'stop',
        native_finish_reason: 'stop'
      }]
    })],
    [0, event({
      id: 'gen-stream-reviewed-permaslug',
      choices: [],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 2,
        total_tokens: 12,
        cost: 0.0001
      },
      openrouter_metadata: {
        strategy: 'direct',
        attempt: 1,
        endpoints: {
          total: 1,
          available: [{
            provider: 'Alias Provider',
            model: 'deepseek/deepseek-v4-flash-20260731',
            selected: true
          }]
        },
        attempts: [{
          provider: 'Alias Provider',
          model: 'deepseek/deepseek-v4-flash-20260731',
          status: 200
        }]
      }
    })],
    [0, 'data: [DONE]\n\n']
  ]);
  const result = await readOpenRouterChatCompletionSSE(stream, {
    idleTimeoutMs: 50,
    totalTimeoutMs: 150,
    initialSelectedProvider: 'Alias Provider'
  });
  assert(
    result.diagnostics.streamCompleted === true,
    'reviewed model alias/permaslug equivalence was rejected'
  );
  assertEqual(
    result.envelope.model,
    'deepseek/deepseek-v4-flash-0731',
    'top-level reviewed model observation was overwritten'
  );
  assertEqual(
    result.diagnostics.selectedModel,
    'deepseek/deepseek-v4-flash-20260731',
    'selected endpoint permaslug was not preserved separately'
  );
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

async function verifyRouteAttemptBoundsAndOutcomes() {
  const directSelected = {
    provider: 'Direct Provider',
    model: 'deepseek/deepseek-v4-flash-0731',
    selected: true
  };
  const reconstructedDirect = scheduledStream([
    [0, event({
      id: 'gen-stream-direct-reconstructed',
      model: directSelected.model,
      provider: directSelected.provider,
      choices: [{
        delta: { content: '{}' },
        finish_reason: 'stop',
        native_finish_reason: 'stop'
      }]
    })],
    [0, event({
      id: 'gen-stream-direct-reconstructed',
      choices: [],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 2,
        total_tokens: 12,
        cost: 0.0001
      },
      openrouter_metadata: {
        strategy: 'direct',
        attempt: 1,
        endpoints: { total: 1, available: [directSelected] },
        attempts: [{ provider: directSelected.provider, status: 200 }]
      }
    })],
    [0, 'data: [DONE]\n\n']
  ]);
  const directResult = await readOpenRouterChatCompletionSSE(
    reconstructedDirect,
    { idleTimeoutMs: 50, totalTimeoutMs: 150 }
  );
  assert(
    directResult.diagnostics.streamCompleted === true,
    'direct attempt was not reconstructed from its selected endpoint'
  );

  const selected = {
    provider: 'Provider 64',
    model: 'deepseek/deepseek-v4-flash-0731',
    selected: true
  };
  const attempts = Array.from({ length: 64 }, (_, index) => ({
    provider: `Provider ${index + 1}`,
    model: 'deepseek/deepseek-v4-flash-0731',
    status: index === 63 ? 200 : 503
  }));
  const successful = scheduledStream([
    [0, event({
      id: 'gen-stream-64-attempts',
      model: 'deepseek/deepseek-v4-flash-0731',
      provider: selected.provider,
      choices: [{
        delta: { content: '{}' },
        finish_reason: 'stop',
        native_finish_reason: 'stop'
      }]
    })],
    [0, event({
      id: 'gen-stream-64-attempts',
      choices: [],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 2,
        total_tokens: 12,
        cost: 0.0001
      },
      openrouter_metadata: {
        strategy: 'default',
        attempt: 64,
        endpoints: { total: 64, available: [selected] },
        attempts
      }
    })],
    [0, 'data: [DONE]\n\n']
  ]);
  const result = await readOpenRouterChatCompletionSSE(successful, {
    idleTimeoutMs: 50,
    totalTimeoutMs: 150
  });
  assertEqual(
    result.envelope.openrouter_metadata.attempts.length,
    64,
    '64-attempt default route trace was rejected'
  );

  for (const [name, mutated] of [
    ['too many attempts', [...attempts, { ...attempts[62] }]],
    ['nonfinal success', attempts.map((item, index) =>
      index === 5 ? { ...item, status: 200 } : item)],
    ['fallback attempt missing model', attempts.map((item, index) =>
      index === 5
        ? { provider: item.provider, status: item.status }
        : item)],
    ['fallback final attempt missing model', attempts.map((item, index) =>
      index === attempts.length - 1
        ? { provider: item.provider, status: item.status }
        : item)]
  ]) {
    const stream = scheduledStream([
      [0, event({
        id: `gen-stream-${name.replaceAll(' ', '-')}`,
        model: 'deepseek/deepseek-v4-flash-0731',
        provider: selected.provider,
        choices: [{
          delta: { content: '{}' },
          finish_reason: 'stop',
          native_finish_reason: 'stop'
        }]
      })],
      [0, event({
        id: `gen-stream-${name.replaceAll(' ', '-')}`,
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 2,
          total_tokens: 12,
          cost: 0.0001
        },
        openrouter_metadata: {
          strategy: 'default',
          attempt: mutated.length,
          endpoints: { total: mutated.length, available: [selected] },
          attempts: mutated
        }
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
    assert(caught, `${name} unexpectedly succeeded`);
    assertEqual(
      caught.openRouterFailureCode,
      'openrouter_invalid_response',
      `${name} failure code`
    );
  }
}

async function verifyPlannerContentLimitIsEnforced() {
  const stream = scheduledStream([
    [0, event({
      id: 'gen-stream-content-limit',
      model: 'deepseek/deepseek-v4-flash-0731',
      provider: 'Limit Provider',
      choices: [{ delta: { content: '12345' } }]
    })]
  ]);
  let caught;
  try {
    await readOpenRouterChatCompletionSSE(stream, {
      idleTimeoutMs: 50,
      totalTimeoutMs: 150,
      maxContentBytes: 4
    });
  } catch (error) {
    caught = error;
  }
  assert(caught, 'planner content overflow unexpectedly succeeded');
  assertEqual(
    caught.openRouterFailureCode,
    'openrouter_truncated_structured_output',
    'planner content overflow failure code'
  );
  assertEqual(
    caught.openRouterStreamState?.contentByteCount,
    5,
    'planner content overflow lost safe byte diagnostic'
  );
  assertEqual(
    caught.openRouterStreamState?.structuredOutputEnvelopeExceeded,
    true,
    'planner content overflow lost its finite envelope marker'
  );
  assertEqual(
    caught.openRouterStreamState?.maxContentByteCount,
    4,
    'planner content overflow lost its exact local ceiling'
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
  let providerRequestCount = 0;
  const server = createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    providerRequest = JSON.parse(raw || '{}');
    providerRequestCount += 1;
    const providerInput = JSON.parse(
      providerRequest.messages?.find((message) => message.role === 'user')
        ?.content || '{}'
    );
    if (providerInput.objective?.id ===
        'objective-openrouter-sse-generation-conflict') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'X-Generation-Id': 'gen-sse-header-disputed',
        'X-Provider-Name': 'Disputed Stream Provider'
      });
      response.end(event({
        id: 'gen-sse-chunk-disputed',
        debug_message: 'raw-sse-generation-conflict-secret-sentinel',
        choices: [{ delta: { content: '{}' } }]
      }));
      return;
    }
    if (providerInput.objective?.id ===
        'objective-openrouter-sse-content-overflow') {
      const contentLimit = 40 * 1024;
      const sentinel = 'raw-stream-overflow-secret-sentinel:';
      const content = `${sentinel}${'x'.repeat(
        contentLimit + 1 - Buffer.byteLength(sentinel, 'utf8')
      )}`;
      const model = 'deepseek/deepseek-v4-flash-0731';
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'X-Generation-Id': 'gen-stream-compact-overflow',
        'X-Provider-Name': 'OpenInference'
      });
      response.end(event({
        id: 'gen-stream-compact-overflow',
        model,
        provider: 'OpenInference',
        choices: [{ delta: { content } }],
        usage: {
          prompt_tokens: 2961,
          completion_tokens: 10248,
          total_tokens: 13209,
          cost: 0.00208152
        },
        openrouter_metadata: {
          strategy: 'fallback',
          attempt: 3,
          endpoints: {
            total: 3,
            available: [{
              provider: 'OpenInference',
              model,
              selected: true
            }]
          },
          attempts: [
            { provider: 'Venice', model, status: 402 },
            { provider: 'Together', model, status: 503 },
            { provider: 'OpenInference', model, status: 200 }
          ]
        }
      }));
      return;
    }
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
      'X-Provider-Name': 'Integration Provider'
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
        attempt: 64,
        endpoints: {
          total: 64,
          available: [{
            provider: 'Integration Provider',
            model: 'deepseek/deepseek-v4-flash-0731',
            selected: true
          }]
        },
        attempts: [
          ...Array.from({ length: 63 }, (_, index) => ({
            provider: `Fallback Provider ${index + 1}`,
            model: 'deepseek/deepseek-v4-flash-0731',
            status: 503
          })),
          {
            provider: 'Integration Provider',
            model: 'deepseek/deepseek-v4-flash-0731',
            status: 200
          }
        ]
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
    assertEqual(
      execution.code,
      0,
      `run-job integration failed: ${execution.stderr || execution.stdout}`
    );
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
    assertEqual(
      diagnostics?.routerAttempts?.length,
      64,
      'run-job truncated the complete fallback attempt sequence'
    );
    assertEqual(
      diagnostics?.routerAttemptStatuses?.length,
      64,
      'run-job truncated the complete fallback status sequence'
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
      emptyDiagnostics?.routerHeaderProvider,
      'Empty Stream Provider',
      'empty stream lost its separate safe provider-header observation'
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

    const conflictJobFile = join(temporaryDirectory, 'conflict-job.json');
    writeFileSync(
      conflictJobFile,
      JSON.stringify(streamingPlannerJob('generation-conflict')),
      'utf8'
    );
    const conflictExecution = await runCommand(
      process.execPath,
      ['bin/run-job.mjs', '--job-file', conflictJobFile],
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
      conflictExecution.code,
      0,
      `conflicting-ID run-job integration failed: ${conflictExecution.stderr}`
    );
    const conflictOutput = JSON.parse(conflictExecution.stdout);
    const conflictPlanner =
      conflictOutput.metadata?.discoveryPlan?.llm?.discoveryPlanner;
    assertEqual(
      conflictPlanner?.error,
      'openrouter_invalid_response',
      'streamed planner generation conflict lost its finite provider error'
    );
    assertEqual(
      conflictPlanner?.generationId,
      undefined,
      'streamed planner persisted one side of a disputed generation ID'
    );
    assert(
      [
        'gen-sse-header-disputed',
        'gen-sse-chunk-disputed',
        'raw-sse-generation-conflict-secret-sentinel'
      ].every((value) => !JSON.stringify(conflictOutput).includes(value)),
      'streamed planner receipt leaked disputed IDs or raw provider data'
    );
    assert(
      conflictOutput.metadata?.discoveryPlan?.status !== 'planned' &&
        (conflictOutput.metadata?.discoveryPlan?.plans?.length || 0) === 0,
      'streamed planner identity conflict became accepted business evidence'
    );

    const overflowJobFile = join(temporaryDirectory, 'overflow-job.json');
    writeFileSync(
      overflowJobFile,
      JSON.stringify(streamingPlannerJob('content-overflow')),
      'utf8'
    );
    const overflowRequestOffset = providerRequestCount;
    const overflowExecution = await runCommand(
      process.execPath,
      ['bin/run-job.mjs', '--job-file', overflowJobFile],
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
      overflowExecution.code,
      0,
      `overflow run-job integration failed: ${overflowExecution.stderr}`
    );
    const overflowOutput = JSON.parse(overflowExecution.stdout);
    const overflowPlan = overflowOutput.metadata?.discoveryPlan;
    const overflowPlanner = overflowPlan?.llm?.discoveryPlanner;
    const overflowDiagnostics = overflowPlanner?.responseDiagnostics;
    assertEqual(
      providerRequestCount - overflowRequestOffset,
      1,
      'overflow dispatched an unauthorized repair or critic call'
    );
    assertEqual(
      providerRequest?.max_tokens,
      42_000,
      'overflow fixture was not bound to the current compact output contract'
    );
    assertEqual(
      providerRequest?.response_format?.json_schema?.strict,
      true,
      'overflow fixture lost strict structured output'
    );
    assertEqual(
      providerRequest?.response_format?.json_schema?.name,
      'opportunity_discovery_plan_v2',
      'overflow fixture used the wrong structured contract'
    );
    assertEqual(
      providerRequest?.provider?.require_parameters,
      true,
      'overflow fixture admitted incompatible provider parameters'
    );
    assertEqual(
      providerRequest?.provider?.sort,
      'throughput',
      'overflow fixture did not prioritize provider throughput'
    );
    assertEqual(overflowPlan?.status, 'blocked', 'overflow plan status');
    assertEqual(overflowPlan?.plans?.length, 0, 'overflow accepted plans');
    assertEqual(
      overflowPlan?.recoveryCause,
      'commercial_discovery_planner_output_envelope_recovery',
      'overflow recovery cause'
    );
    assertEqual(
      overflowPlan?.failureCode,
      'planner_output_envelope_exceeded',
      'overflow failure code'
    );
    assertEqual(
      overflowPlan?.preflight?.cause,
      'commercial_discovery_planner_output_envelope_recovery',
      'overflow preflight recovery cause'
    );
    assertEqual(
      overflowPlan?.preflight?.failureCode,
      'planner_output_envelope_exceeded',
      'overflow preflight failure code'
    );
    assertEqual(
      overflowPlan?.preflight?.routeProvenanceValidated,
      false,
      'overflow claimed route acceptance after a partial stream'
    );
    assertEqual(overflowPlanner?.status, 'incomplete', 'overflow receipt status');
    assertEqual(
      overflowPlanner?.error,
      'openrouter_truncated_structured_output',
      'overflow receipt error'
    );
    assertEqual(
      overflowPlanner?.generationId,
      'gen-stream-compact-overflow',
      'overflow generation identity'
    );
    assertEqual(
      overflowDiagnostics?.structuredOutputEnvelopeExceeded,
      true,
      'overflow diagnostic marker'
    );
    assertEqual(
      overflowDiagnostics?.maxContentByteCount,
      40 * 1024,
      'overflow diagnostic ceiling'
    );
    assertEqual(
      overflowDiagnostics?.contentByteCount,
      40 * 1024 + 1,
      'overflow observed content bytes'
    );
    const overflowSentinel = 'raw-stream-overflow-secret-sentinel:';
    const overflowContent = `${overflowSentinel}${'x'.repeat(
      40 * 1024 + 1 - Buffer.byteLength(overflowSentinel, 'utf8')
    )}`;
    assertEqual(
      overflowDiagnostics?.contentSha256,
      createHash('sha256').update(overflowContent).digest('hex'),
      'overflow bounded content hash'
    );
    assertEqual(overflowDiagnostics?.httpStatus, 200, 'overflow HTTP status');
    assertEqual(
      overflowDiagnostics?.streamCompleted,
      false,
      'overflow was incorrectly marked as a terminal stream completion'
    );
    assertEqual(
      overflowDiagnostics?.localJSONRepairApplied,
      undefined,
      'overflow attempted local JSON repair on a partial response'
    );
    assertEqual(
      overflowDiagnostics?.localJSONRepairFailure,
      undefined,
      'overflow recorded JSON repair diagnostics for a partial response'
    );
    assertEqual(
      overflowPlan?.llm?.strategyFamilyRepair,
      undefined,
      'overflow fabricated a structured repair receipt'
    );
    assertEqual(
      overflowPlan?.llm?.commercialCritic,
      undefined,
      'overflow fabricated a critic receipt'
    );
    assertEqual(
      JSON.stringify(overflowDiagnostics?.routerAttempts),
      JSON.stringify([
        {
          provider: 'Venice',
          model: 'deepseek/deepseek-v4-flash-0731',
          status: 402
        },
        {
          provider: 'Together',
          model: 'deepseek/deepseek-v4-flash-0731',
          status: 503
        },
        {
          provider: 'OpenInference',
          model: 'deepseek/deepseek-v4-flash-0731',
          status: 200
        }
      ]),
      'overflow route attempt receipt'
    );
    assertEqual(
      overflowPlanner?.openRouterUsage?.total_tokens,
      13209,
      'overflow partial-stream usage'
    );
    assertEqual(
      overflowPlan?.usage?.calls,
      1,
      'overflow model call count'
    );
    assertEqual(
      overflowPlan?.usage?.successfulCalls,
      0,
      'overflow was incorrectly accepted as a successful model call'
    );
    assert(
      !JSON.stringify(overflowOutput).includes(
        'raw-stream-overflow-secret-sentinel'
      ),
      'overflow receipt leaked raw model content'
    );
    assertEqual(
      providerRequest?.provider?.ignore?.join(','),
      'cloudflare,open-inference,decart,digitalocean,akashml,siliconflow',
      'overflow request lost the evidence-backed route quarantine'
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
