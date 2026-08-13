import { createHash } from 'crypto';

export const MAX_OPENROUTER_SSE_WIRE_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_CONTENT_BYTES = 192 * 1024;
const OUTPUT_LIMIT_FINISH_REASONS = new Set([
  'length',
  'max_tokens',
  'max_output_tokens'
]);

/**
 * Read one OpenRouter chat-completions SSE response without imposing a short
 * wall-clock deadline on an actively progressing generation. The idle clock
 * advances for any successfully read provider bytes, including OpenRouter's
 * documented `: OPENROUTER PROCESSING` keepalive. A separate hard deadline
 * prevents keepalives from extending the call indefinitely.
 */
export async function readOpenRouterChatCompletionSSE(
  stream,
  {
    idleTimeoutMs,
    totalTimeoutMs,
    maxWireBytes = MAX_OPENROUTER_SSE_WIRE_BYTES,
    maxContentBytes = DEFAULT_MAX_CONTENT_BYTES,
    abortController,
    initialGenerationId,
    initialSelectedModel,
    initialSelectedProvider,
    now = () => Date.now()
  } = {}
) {
  if (!stream || typeof stream.getReader !== 'function') {
    const error = new Error('OpenRouter streaming response has no readable body');
    error.openRouterFailureCode = 'openrouter_invalid_response';
    attachStreamState(error, {
      usage: {},
      generationId: safeGenerationId(initialGenerationId),
      selectedModel: '',
      selectedProvider: '',
      envelopeModel: '',
      envelopeProvider: '',
      headerModel: safeModelName(initialSelectedModel),
      headerProvider: safeProviderName(initialSelectedProvider),
      routeObservationConflictKinds: [],
      openrouterMetadata: {},
      finishReason: '',
      nativeFinishReason: '',
      contentByteCount: 0,
      contentSha256: createHash('sha256').digest('hex'),
      streamEventCount: 0,
      streamWireByteCount: 0,
      streamFirstDataLatencyMs: undefined,
      streamDurationMs: 0,
      streamCompleted: false
    });
    throw error;
  }

  const idleMs = positiveMilliseconds(idleTimeoutMs, 60_000);
  const totalMs = positiveMilliseconds(totalTimeoutMs, 300_000);
  const wireLimit = positiveInteger(
    maxWireBytes,
    MAX_OPENROUTER_SSE_WIRE_BYTES
  );
  const contentLimit = positiveInteger(
    maxContentBytes,
    DEFAULT_MAX_CONTENT_BYTES
  );
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const startedAt = now();
  const totalDeadlineAt = startedAt + totalMs;
  let progressDeadlineAt = startedAt + idleMs;
  let firstDataAt;
  let buffer = '';
  let eventDataLines = [];
  let wireByteCount = 0;
  let eventCount = 0;
  let sawDone = false;
  let lastJSONEventWasTerminalAccounting = false;
  let terminalAccountingImmediatelyBeforeDone = false;
  let generationId = safeGenerationId(initialGenerationId);
  // Keep every safe provenance source separate. In particular, do not let a
  // selected endpoint overwrite a contradictory top-level chunk observation
  // before the terminal route contract has compared them.
  const headerModel = safeModelName(initialSelectedModel);
  const headerProvider = safeProviderName(initialSelectedProvider);
  let envelopeModel = '';
  let envelopeProvider = '';
  let selectedModel = '';
  let selectedProvider = '';
  const routeObservationConflictKinds = new Set();
  let usage = {};
  let openrouterMetadata = {};
  let topLevelError;
  let choiceError;
  let finishReason = '';
  let nativeFinishReason = '';
  let content = '';
  let contentByteCount = 0;
  const annotations = [];
  const contentHash = createHash('sha256');

  const terminalAccountingComplete = () =>
    sawDone &&
    terminalAccountingImmediatelyBeforeDone &&
    finishReason === 'stop' &&
    contentByteCount > 0 &&
    completeOpenRouterUsage(usage) &&
    completeOpenRouterRoute({
      metadata: openrouterMetadata,
      selectedModel,
      selectedProvider,
      envelopeModel,
      envelopeProvider,
      headerModel,
      headerProvider,
      routeObservationConflictKinds
    });

  const state = () => ({
    usage,
    generationId,
    selectedModel,
    selectedProvider,
    envelopeModel,
    envelopeProvider,
    headerModel,
    headerProvider,
    routeObservationConflictKinds:
      [...routeObservationConflictKinds].slice(0, 8),
    openrouterMetadata,
    finishReason,
    nativeFinishReason,
    contentByteCount,
    contentSha256: contentHash.copy().digest('hex'),
    streamEventCount: eventCount,
    streamWireByteCount: wireByteCount,
    streamFirstDataLatencyMs:
      firstDataAt === undefined ? undefined : Math.max(0, firstDataAt - startedAt),
    streamDurationMs: Math.max(0, now() - startedAt),
    streamCompleted: terminalAccountingComplete()
  });

  const stopTransport = (reason) => {
    try {
      abortController?.abort();
    } catch {
      // The parsed terminal state is more important than cancellation errors.
    }
    try {
      void reader.cancel(reason).catch(() => {});
    } catch {
      // Cancellation is best-effort after the request has been aborted.
    }
  };

  const fail = (error) => {
    // Abort first: a custom or broken stream may never settle reader.cancel(),
    // and the timeout path itself must stay bounded.
    stopTransport(error);
    attachStreamState(error, state());
    throw error;
  };

  const dispatchEvent = () => {
    if (eventDataLines.length === 0) return false;
    const rawData = eventDataLines.join('\n');
    eventDataLines = [];
    if (rawData.trim() === '[DONE]') {
      terminalAccountingImmediatelyBeforeDone =
        lastJSONEventWasTerminalAccounting;
      sawDone = true;
      return true;
    }
    let chunk;
    try {
      chunk = JSON.parse(rawData);
    } catch {
      const error = new Error('OpenRouter streaming event is not valid JSON');
      error.openRouterFailureCode = 'openrouter_invalid_response';
      throw error;
    }
    if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) {
      const error = new Error('OpenRouter streaming event has an invalid envelope');
      error.openRouterFailureCode = 'openrouter_invalid_response';
      throw error;
    }
    eventCount += 1;
    lastJSONEventWasTerminalAccounting = false;
    const rawChunkGenerationId = safeText(chunk.id);
    const chunkGenerationId = safeGenerationId(rawChunkGenerationId);
    if (rawChunkGenerationId && !chunkGenerationId) {
      // An invalid provider observation makes any earlier header/chunk ID
      // unsuitable as the canonical generation identity for reconciliation.
      generationId = '';
      const error = new Error(
        'OpenRouter streaming response reported an invalid generation identity'
      );
      error.openRouterFailureCode = 'openrouter_invalid_response';
      throw error;
    }
    if (chunkGenerationId && generationId && chunkGenerationId !== generationId) {
      // Do not persist either side of a disputed safe identity. The finite
      // invalid-response code and bounded stream diagnostics are sufficient;
      // choosing the header or first chunk would poison later accounting.
      generationId = '';
      const error = new Error(
        'OpenRouter streaming response changed generation identity midstream'
      );
      error.openRouterFailureCode = 'openrouter_invalid_response';
      throw error;
    }
    generationId = chunkGenerationId || generationId;
    const chunkModel = safeModelName(chunk.model);
    const chunkProvider = safeProviderName(chunk.provider);
    if (chunkModel) {
      if (envelopeModel &&
          !reviewedModelEquivalent(envelopeModel, chunkModel)) {
        routeObservationConflictKinds.add('envelope_model_changed');
      }
      if (selectedModel &&
          !reviewedModelEquivalent(selectedModel, chunkModel)) {
        routeObservationConflictKinds.add('envelope_model_conflict');
      }
      envelopeModel ||= chunkModel;
    }
    if (chunkProvider) {
      if (envelopeProvider && envelopeProvider !== chunkProvider) {
        routeObservationConflictKinds.add('envelope_provider_changed');
      }
      if (selectedProvider && selectedProvider !== chunkProvider) {
        routeObservationConflictKinds.add('envelope_provider_conflict');
      }
      envelopeProvider ||= chunkProvider;
    }
    if (plainObject(chunk.usage)) usage = chunk.usage;
    if (plainObject(chunk.error)) topLevelError = chunk.error;
    const chunkMetadata = plainObject(chunk.openrouter_metadata);
    if (chunkMetadata) {
      openrouterMetadata = chunkMetadata;
      const selectedEndpoint = selectedOpenRouterEndpoint(chunkMetadata);
      const finalAttempt = finalOpenRouterAttempt(chunkMetadata);
      const endpointProvider = safeProviderName(selectedEndpoint?.provider);
      const endpointModel = safeModelName(selectedEndpoint?.model);
      const finalProvider = safeProviderName(finalAttempt?.provider);
      const finalModel = safeModelName(finalAttempt?.model);
      const nextSelectedProvider = endpointProvider || finalProvider;
      const nextSelectedModel = endpointModel || finalModel;
      if (endpointProvider && finalProvider &&
          endpointProvider !== finalProvider) {
        routeObservationConflictKinds.add(
          'selected_endpoint_final_provider_conflict'
        );
      }
      if (endpointModel && finalModel &&
          !reviewedModelEquivalent(endpointModel, finalModel)) {
        routeObservationConflictKinds.add(
          'selected_endpoint_final_model_conflict'
        );
      }
      if (nextSelectedProvider && envelopeProvider &&
          nextSelectedProvider !== envelopeProvider) {
        routeObservationConflictKinds.add('envelope_provider_conflict');
      }
      if (nextSelectedModel && envelopeModel &&
          !reviewedModelEquivalent(nextSelectedModel, envelopeModel)) {
        routeObservationConflictKinds.add('envelope_model_conflict');
      }
      if (nextSelectedProvider && headerProvider &&
          nextSelectedProvider !== headerProvider) {
        routeObservationConflictKinds.add('header_provider_conflict');
      }
      if (nextSelectedModel && headerModel &&
          !reviewedModelEquivalent(nextSelectedModel, headerModel)) {
        routeObservationConflictKinds.add('header_model_conflict');
      }
      if (nextSelectedProvider) {
        if (selectedProvider && selectedProvider !== nextSelectedProvider) {
          routeObservationConflictKinds.add('selected_provider_changed');
        }
        selectedProvider ||= nextSelectedProvider;
      }
      if (nextSelectedModel) {
        if (selectedModel &&
            !reviewedModelEquivalent(selectedModel, nextSelectedModel)) {
          routeObservationConflictKinds.add('selected_model_changed');
        }
        selectedModel ||= nextSelectedModel;
      }
    }
    const errorMetadata = plainObject(chunk.error?.metadata);
    if (errorMetadata?.provider_name) {
      const errorProvider = safeProviderName(errorMetadata.provider_name);
      if (errorProvider && selectedProvider &&
          errorProvider !== selectedProvider) {
        routeObservationConflictKinds.add('error_provider_conflict');
      }
    }

    const choice = Array.isArray(chunk.choices) && plainObject(chunk.choices[0])
      ? chunk.choices[0]
      : {};
    const delta = plainObject(choice.delta)
      ? choice.delta
      : plainObject(choice.message)
        ? choice.message
        : {};
    const fragment = typeof delta.content === 'string' ? delta.content : '';
    if (fragment) {
      contentByteCount += Buffer.byteLength(fragment, 'utf8');
      contentHash.update(fragment, 'utf8');
      if (contentByteCount > contentLimit) {
        const error = new Error(
          'OpenRouter streaming content exceeded its bounded structured-output envelope'
        );
        // This is an intentionally incomplete local projection of a provider
        // generation, not an invalid provider envelope. Reuse the established
        // incomplete structured-output code while retaining a separate finite
        // marker for the exact local cause. The caller must not parse, repair,
        // or accept the bounded prefix.
        error.openRouterFailureCode =
          'openrouter_truncated_structured_output';
        error.openRouterStructuredOutputEnvelopeExceeded = true;
        error.openRouterMaxContentByteCount = contentLimit;
        throw error;
      }
      // Never retain more than the declared structured-output envelope. The
      // overflowing fragment is counted and hashed for safe diagnostics only.
      content += fragment;
    }
    if (Array.isArray(delta.annotations)) {
      annotations.push(...delta.annotations.slice(0, 5 - annotations.length));
    }
    if (plainObject(choice.error)) {
      choiceError = choice.error;
      const metadata = plainObject(choice.error.metadata);
      if (metadata?.provider_name) {
        const errorProvider = safeProviderName(metadata.provider_name);
        if (errorProvider && selectedProvider &&
            errorProvider !== selectedProvider) {
          routeObservationConflictKinds.add('error_provider_conflict');
        }
      }
    }
    finishReason = safeFinishReason(choice.finish_reason) || finishReason;
    nativeFinishReason = safeFinishReason(
      choice.native_finish_reason
    ) || nativeFinishReason;
    lastJSONEventWasTerminalAccounting =
      completeOpenRouterUsage(chunk.usage) &&
      completeOpenRouterRoute({
        metadata: chunkMetadata,
        selectedModel,
        selectedProvider,
        envelopeModel,
        envelopeProvider,
        headerModel,
        headerProvider,
        routeObservationConflictKinds
      });
    return true;
  };

  try {
    while (!sawDone) {
      const current = now();
      const idleRemaining = progressDeadlineAt - current;
      const totalRemaining = totalDeadlineAt - current;
      if (totalRemaining <= 0) {
        fail(timeoutError('total', totalMs));
      }
      if (idleRemaining <= 0) {
        fail(timeoutError('idle', idleMs));
      }

      let result;
      try {
        result = await readBeforeDeadline(reader, {
          idleRemaining,
          totalRemaining,
          idleMs,
          totalMs
        });
      } catch (error) {
        fail(error);
      }
      if (result.done) break;

      const chunkBytes = result.value instanceof Uint8Array
        ? result.value
        : new Uint8Array(result.value || []);
      wireByteCount += chunkBytes.byteLength;
      if (wireByteCount > wireLimit) {
        const error = new Error('OpenRouter streaming response exceeded its bounded wire envelope');
        error.openRouterFailureCode = 'openrouter_invalid_response';
        fail(error);
      }
      if (chunkBytes.byteLength > 0) {
        const progressedAt = now();
        if (firstDataAt === undefined) firstDataAt = progressedAt;
        progressDeadlineAt = progressedAt + idleMs;
      }

      const decoded = decoder.decode(chunkBytes, { stream: true });
      buffer += decoded;
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line === '') {
          dispatchEvent();
          if (sawDone || topLevelError || choiceError) break;
          continue;
        }
        if (line.startsWith(':')) continue;
        if (line === 'data' || line.startsWith('data:')) {
          eventDataLines.push(
            line === 'data' ? '' : line.slice(5).replace(/^ /, '')
          );
        }
      }
      if (topLevelError || choiceError) {
        // OpenRouter documents this error chunk as terminal once streaming has
        // begun. Stop the transport too, so a malformed/nonclosing upstream
        // cannot keep consuming the bounded worker window after that signal.
        stopTransport();
        break;
      }
    }

    if (!sawDone && !topLevelError && !choiceError) {
      buffer += decoder.decode();
    }
    if (!sawDone && !topLevelError && !choiceError && buffer) {
      let line = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
      if (!line.startsWith(':') && (line === 'data' || line.startsWith('data:'))) {
        eventDataLines.push(line === 'data' ? '' : line.slice(5).replace(/^ /, ''));
      }
    }
    if (!sawDone && !topLevelError && !choiceError && eventDataLines.length > 0) {
      dispatchEvent();
    }
    if (sawDone) stopTransport();
  } catch (error) {
    if (error?.openRouterStreamState) throw error;
    fail(error);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore release errors after cancellation.
    }
  }

  if (!topLevelError && !choiceError && !terminalAccountingComplete()) {
    const incompleteStructuredOutput = contentByteCount > 0 &&
      (OUTPUT_LIMIT_FINISH_REASONS.has(finishReason) ||
        OUTPUT_LIMIT_FINISH_REASONS.has(nativeFinishReason));
    const error = new Error(
      incompleteStructuredOutput
        ? 'OpenRouter streaming response ended with incomplete structured output'
        : 'OpenRouter streaming response ended before its complete terminal accounting event'
    );
    error.openRouterFailureCode = incompleteStructuredOutput
      ? 'openrouter_truncated_structured_output'
      : 'openrouter_invalid_response';
    attachStreamState(error, state());
    throw error;
  }

  return {
    envelope: {
      ...(generationId ? { id: generationId } : {}),
      // Preserve only the actual safe top-level observations here. The
      // selected endpoint/final attempt remains separately available in
      // openrouter_metadata and diagnostics.
      ...(envelopeModel ? { model: envelopeModel } : {}),
      ...(envelopeProvider ? { provider: envelopeProvider } : {}),
      ...(Object.keys(openrouterMetadata).length > 0
        ? { openrouter_metadata: openrouterMetadata }
        : {}),
      ...(Object.keys(usage).length > 0 ? { usage } : {}),
      ...(topLevelError ? { error: topLevelError } : {}),
      choices: [{
        message: {
          content,
          ...(annotations.length > 0 ? { annotations } : {})
        },
        ...(choiceError ? { error: choiceError } : {}),
        finish_reason: finishReason || null,
        native_finish_reason: nativeFinishReason || null
      }]
    },
    diagnostics: state()
  };
}

function safeFinishReason(value) {
  // Finish reasons are provider contract fields, not user-facing text. Keep
  // their raw type and spelling authoritative so whitespace/case coercion
  // cannot turn a nonconforming terminal event into an accepted `stop` (or a
  // cause-matched output-limit event).
  const reason = typeof value === 'string' ? value : '';
  return new Set([
    'stop',
    'length',
    'error',
    'content_filter',
    'tool_calls',
    'function_call',
    'cancelled',
    'canceled',
    'max_tokens',
    'max_output_tokens',
    'refusal'
  ]).has(reason) ? reason : '';
}

async function readBeforeDeadline(
  reader,
  { idleRemaining, totalRemaining, idleMs, totalMs }
) {
  let timer;
  const timeoutKind = totalRemaining <= idleRemaining ? 'total' : 'idle';
  const delay = Math.max(1, Math.min(idleRemaining, totalRemaining));
  try {
    return await Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(timeoutError(
            timeoutKind,
            timeoutKind === 'total' ? totalMs : idleMs
          )),
          delay
        );
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function timeoutError(kind, milliseconds) {
  const error = new Error(
    kind === 'total'
      ? `OpenRouter streaming response exceeded its ${milliseconds}ms hard deadline`
      : `OpenRouter streaming response made no provider data progress for ${milliseconds}ms`
  );
  error.openRouterFailureCode = 'openrouter_timeout';
  error.openRouterTimeoutKind = kind;
  return error;
}

function attachStreamState(error, state) {
  Object.defineProperty(error, 'openRouterStreamState', {
    value: {
      ...state,
      timeoutKind: safeText(error?.openRouterTimeoutKind) || undefined,
      structuredOutputEnvelopeExceeded:
        error?.openRouterStructuredOutputEnvelopeExceeded === true
          ? true
          : undefined,
      maxContentByteCount:
        error?.openRouterStructuredOutputEnvelopeExceeded === true
          ? positiveInteger(error?.openRouterMaxContentByteCount, undefined)
          : undefined
    },
    configurable: true,
    enumerable: false,
    writable: false
  });
  return error;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined;
}

function safeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function completeOpenRouterUsage(value) {
  const usage = plainObject(value);
  const promptTokens = usage?.prompt_tokens;
  const completionTokens = usage?.completion_tokens;
  const totalTokens = usage?.total_tokens;
  const cost = usage?.cost;
  return Number.isInteger(promptTokens) && promptTokens > 0 &&
    Number.isInteger(completionTokens) && completionTokens > 0 &&
    Number.isInteger(totalTokens) &&
    totalTokens === promptTokens + completionTokens &&
    typeof cost === 'number' && Number.isFinite(cost) && cost > 0;
}

function selectedOpenRouterEndpoint(metadata) {
  const available = plainObject(metadata?.endpoints)?.available;
  if (!Array.isArray(available)) return undefined;
  const selected = available.filter(
    (endpoint) => plainObject(endpoint)?.selected === true
  );
  return selected.length === 1 ? selected[0] : undefined;
}

function finalOpenRouterAttempt(metadata) {
  const attempts = metadata?.attempts;
  return Array.isArray(attempts) && attempts.length > 0
    ? plainObject(attempts[attempts.length - 1])
    : undefined;
}

function completeOpenRouterRoute({
  metadata,
  selectedModel,
  selectedProvider,
  envelopeModel,
  envelopeProvider,
  headerModel,
  headerProvider,
  routeObservationConflictKinds
}) {
  metadata = plainObject(metadata);
  const attemptNumber = metadata?.attempt;
  const attempts = metadata?.attempts;
  const selectedEndpoint = selectedOpenRouterEndpoint(metadata);
  const selectedEndpointCount = Array.isArray(metadata?.endpoints?.available)
    ? metadata.endpoints.available.filter(
      (endpoint) => plainObject(endpoint)?.selected === true
    ).length
    : 0;
  const endpointProvider = safeText(selectedEndpoint?.provider);
  const endpointModel = safeText(selectedEndpoint?.model).toLowerCase();
  const observedProvider = safeText(selectedProvider);
  const observedModel = safeText(selectedModel).toLowerCase();
  const topLevelProvider = safeProviderName(envelopeProvider);
  const topLevelModel = safeModelName(envelopeModel);
  const responseHeaderProvider = safeProviderName(headerProvider);
  const responseHeaderModel = safeModelName(headerModel);
  if (selectedEndpointCount !== 1 ||
      !Number.isInteger(attemptNumber) || attemptNumber < 1 ||
      attemptNumber > 64 ||
      !safeProvider(endpointProvider) || !safeModel(endpointModel) ||
      observedProvider !== endpointProvider ||
      !reviewedModelEquivalent(observedModel, endpointModel) ||
      (routeObservationConflictKinds?.size || 0) > 0 ||
      (topLevelProvider && topLevelProvider !== endpointProvider) ||
      (topLevelModel &&
        !reviewedModelEquivalent(topLevelModel, endpointModel)) ||
      (responseHeaderProvider &&
        responseHeaderProvider !== endpointProvider) ||
      (responseHeaderModel &&
        !reviewedModelEquivalent(responseHeaderModel, endpointModel))) {
    return false;
  }
  // OpenRouter documents attempts as optional on a direct success. That route
  // is still fully reconstructable from attempt=1 plus the selected endpoint.
  // A fallback success is not: require every ordered attempt when attempt>1.
  if (!Array.isArray(attempts)) return attemptNumber === 1;
  if (attempts.length !== attemptNumber) return false;
  for (const [index, rawAttempt] of attempts.entries()) {
    const attempt = plainObject(rawAttempt);
    const provider = safeText(attempt?.provider);
    const model = safeText(attempt?.model).toLowerCase();
    const status = attempt?.status;
    const final = index === attempts.length - 1;
    if (!safeProvider(provider) ||
        (attemptNumber > 1 ? !safeModel(model) : model && !safeModel(model)) ||
        !Number.isInteger(status) || status < 100 || status > 599 ||
        (!final && status >= 200 && status <= 299) ||
        (final && (status < 200 || status > 299))) {
      return false;
    }
  }
  const finalAttempt = plainObject(attempts[attempts.length - 1]);
  const finalModel = safeText(finalAttempt?.model).toLowerCase();
  return safeText(finalAttempt?.provider) === endpointProvider &&
    (attemptNumber === 1
      ? !finalModel || reviewedModelEquivalent(finalModel, endpointModel)
      : reviewedModelEquivalent(finalModel, endpointModel)) &&
    finalAttempt.status >= 200 && finalAttempt.status <= 299;
}

function safeProvider(value) {
  return /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,63}$/.test(value);
}

function safeModel(value) {
  return /^[a-z0-9][a-z0-9._:/-]{0,127}$/.test(value);
}

function safeGenerationId(value) {
  const generationId = safeText(value);
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(generationId)
    ? generationId
    : '';
}

function safeProviderName(value) {
  const provider = safeText(value);
  return safeProvider(provider) ? provider : '';
}

function safeModelName(value) {
  const model = safeText(value).toLowerCase();
  return safeModel(model) ? model : '';
}

function reviewedModelEquivalent(leftValue, rightValue) {
  const left = safeModelName(leftValue);
  const right = safeModelName(rightValue);
  if (!left || !right) return false;
  if (left === right) return true;
  return new Set([
    'deepseek/deepseek-v4-flash-0731',
    'deepseek/deepseek-v4-flash-20260731'
  ]).has(left) && new Set([
    'deepseek/deepseek-v4-flash-0731',
    'deepseek/deepseek-v4-flash-20260731'
  ]).has(right);
}

function positiveMilliseconds(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}
