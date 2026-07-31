import { createHash } from 'crypto';
import { isIP } from 'net';

export const OPPORTUNITY_TOURNAMENT_ALGORITHM_VERSION = 'cheap_tournament_v4';
const TOURNAMENT_GENERATOR_CONTRACT =
  'opportunity_tournament_compact_v1';

const MAX_HYPOTHESES = 10_000;
const MAX_FINALISTS = 20;
const MAX_EVIDENCE_ITEMS = 64;
const MAX_SEEDS_PER_DIMENSION = 8;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const MAX_TIMING_VERIFICATION_OBSERVATION_AGE_MS =
  45 * DAY_MILLISECONDS;
const MAX_TIMING_VERIFICATION_FUTURE_SKEW_MS = DAY_MILLISECONDS;
const MAX_INBOUND_ASSET_OBSERVATION_AGE_MS =
  90 * DAY_MILLISECONDS;
// OpenRouter prompt/completion ceilings are USD per million tokens. Request is
// only a ceiling on a provider's fixed per-request fee; it does not cap token
// spend or the total price of a generation. Callers may tighten, but never
// loosen, these tournament-specific caps.
const MAX_PROVIDER_PRICE = {
  prompt: 0.4,
  completion: 1.6,
  request: 0.12
};
const OPENAI_PROMPT_FRAMING_TOKEN_RESERVE = 1_024;
const TOURNAMENT_PROVIDER_ROUTING = {
  order: ['openai'],
  only: ['openai'],
  allow_fallbacks: false,
  require_parameters: true,
  data_collection: 'deny'
};
const RESEARCH_ONLY_CONSTRAINT =
  'Research and recommendation only; do not contact, message, publish, purchase ads, or submit forms.';
const RESEARCH_APPROVED_SOURCE_STATUSES = new Set([
  'approved',
  'connected',
  'monitoring'
]);

const DIMENSIONS = [
  ['offers', ['offers', 'offerSeeds', 'o']],
  ['buyerSegments', ['buyerSegments', 'audiences', 'buyers', 'b']],
  ['channels', ['channels', 'c']],
  ['actions', ['actions', 'a']],
  ['timingTriggers', ['timingTriggers', 'triggers', 't']],
  ['proofPoints', ['proofPoints', 'proofAngles', 'p']],
  ['followUps', ['followUps', 'followUpPaths', 'f']],
  ['revenuePaths', ['revenuePaths', 'revenuePath', 'r']]
];

// One canonical path per family keeps the strict provider output bounded. The
// model compares broadly in-context and returns its best two coherent paths;
// deterministic gates then validate and rank those two finalists.
const INITIAL_FAMILY_VARIANT_COUNT = 1;
const REPAIR_FAMILY_VARIANT_COUNT = 1;
const MAX_PROMPT_EVIDENCE_ITEMS = MAX_EVIDENCE_ITEMS;
const MAX_REPAIR_OUTPUT_TOKENS = 4_000;

const DEFAULT_JUDGE_WEIGHTS = {
  objectiveFit: 0.22,
  evidenceStrength: 0.18,
  buyerAuthority: 0.12,
  timing: 0.1,
  warmPath: 0.08,
  reachability: 0.04,
  expectedValue: 0.14,
  effort: 0.03,
  cost: 0.02,
  risk: 0.04,
  uncertainty: 0.03
};

const POSITIVE_SCORE_FIELDS = [
  'objectiveFit',
  'evidenceStrength',
  'buyerAuthority',
  'timing',
  'warmPath',
  'reachability',
  'expectedValue'
];

const BURDEN_SCORE_FIELDS = ['effort', 'cost', 'risk', 'uncertainty'];

const COHERENCE_GATE_VERSION = 'acquisition_mode_family_v3';
const LEGACY_COHERENCE_GATE_VERSION = 'strategy_family_motion_v2';
const LEGACY_SEED_CONTRACT_VERSION = 'revenue_family_bundle_v1';
const SEED_CONTRACT_VERSION = 'revenue_family_bundle_v2';
const LEGACY_REVENUE_PATH_CONTRACT_VERSION =
  'incremental_revenue_v1';
export const REVENUE_PATH_CONTRACT_VERSION =
  'incremental_revenue_v2';
export const REVENUE_GATE_VERSION = 'incremental_income_v2';
const LEGACY_REVENUE_GATE_VERSION = 'incremental_income_v1';
export const REVENUE_EVIDENCE_EXPERIMENT_CONTRACT =
  'revenue_evidence_experiment_v1';
const REVENUE_MECHANISMS = new Set([
  'paid_booking',
  'direct_sale',
  'signed_contract',
  'paid_pilot',
  'subscription_or_retainer',
  'insurance_reimbursement',
  'license_or_royalty',
  'commission_or_referral',
  'sponsorship',
  'platform_payout',
  'compensated_role'
]);
const ACQUISITION_MODES = new Set([
  'inbound',
  'warm_referral',
  'permissioned_outreach',
  'existing_customer',
  'partner_channel'
]);
const ATTRIBUTION_METHODS = new Set([
  'booking_record',
  'payment_receipt',
  'invoice_or_contract',
  'checkout_or_order',
  'claim_record',
  'crm_source',
  'referral_code',
  'license_or_royalty_record',
  'affiliate_or_commission_record',
  'platform_or_marketplace_record',
  'employment_compensation_record'
]);
const OWNED_INBOUND_ASSET_KIND = 'owned_inbound_asset';
const SYNTHESIZED_OWNED_INBOUND_ASSETS = new WeakSet();

export function buildOpenRouterJSONRequestBody({
  model,
  system,
  user,
  maxTokens,
  provider,
  responseFormat,
  plugins,
  temperature
}) {
  const requestedTemperature = Number(temperature);
  const requestedPlugins = asArray(plugins)
    .filter((item) =>
      item && typeof item === 'object' && !Array.isArray(item)
    );
  const requestedMaxTokens = Number(maxTokens);
  return {
    model: firstText(model),
    temperature: Number.isFinite(requestedTemperature) &&
      requestedTemperature >= 0 &&
      requestedTemperature <= 2
      ? requestedTemperature
      : 0.25,
    max_tokens: Number.isFinite(requestedMaxTokens) &&
      requestedMaxTokens > 0
      ? requestedMaxTokens
      : 700,
    ...(Object.keys(asObject(provider)).length > 0
      ? { provider: asObject(provider) }
      : {}),
    ...(Object.keys(asObject(responseFormat)).length > 0
      ? { response_format: asObject(responseFormat) }
      : {}),
    ...(requestedPlugins.length > 0
      ? { plugins: requestedPlugins }
      : {}),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
}

export function serializeOpenRouterJSONRequestBody(request) {
  return JSON.stringify(buildOpenRouterJSONRequestBody(request));
}

// Patterns run against comparable() text: lowercase ASCII words separated by
// one space. Keep this vocabulary stable because the control plane mirrors it
// when independently validating persisted finalist provenance.
const STRATEGY_MOTION_PATTERNS = {
  payer_network: [
    /\bprovider network\b/,
    /\bnetwork (?:management|contracting|relations|participation)\b/,
    /\bprovider (?:credentialing|enrollment|relations|contracting)\b/,
    /\bcredential(?:ing|ed)\b/,
    /\bin network (?:application|enrollment|credentialing|contracting|participation)\b/,
    /\bmanaged care (?:contracting|network|organization|leadership|team|executive|director|manager|decision maker)s?\b/,
    /\b(?:payer|insurer|insurance carrier|insurance company|health plan) (?:contracting|credentialing|network|enrollment|application|participation|relations|partnership|leadership|team|executive|director|manager|decision maker)s?\b/,
    /\b(?:contracting|credentialing|network|enrollment|application|participation|relations|partnership) (?:with|for) (?:a |an |the )?(?:payer|insurer|insurance carrier|insurance company|health plan)\b/
  ],
  patient_inbound: [
    /\bprospective (?:patient|client|parent|mother|family|caregiver)s?\b/,
    /\b(?:patient|client|parent|mother|family|caregiver)s? seeking\b/,
    /\b(?:covered|eligible|insured) (?:patient|client|parent|mother|family|caregiver|member)s?\b/,
    /\b(?:patient|client|parent|mother|family|caregiver) facing\b/,
    /\b(?:patient|client|parent|mother|family|caregiver|member) (?:appointment|booking|consultation|coverage|eligibility|inquiry|service|care|benefit|conversion|lead)s?\b/,
    /\b(?:health plan|insurance|coverage|benefit|benefits) (?:acceptance|accepted|verification|eligibility|coverage|member service|member care)\b/,
    /\baccept(?:s|ed|ance)?\b.{0,48}\b(?:consultation|care|coverage|insurance|health plan|service)s?\b/,
    /\bappointment(?:s)?\b/,
    /\bconsultation (?:booking|inquiry|request|path|page)s?\b/,
    /\bbook(?:ed|ing)? consultation(?:s)?\b/,
    /\binquir(?:y|ies)\b/,
    /\bservice page\b/,
    /\blanding page\b/,
    /\bwebsite visitor(?:s)?\b/,
    /\bconversion (?:path|funnel|page)\b/
  ],
  clinical_referral: [
    /\bclinical referral\b/,
    /\breferr(?:al|ing) (?:clinician|provider|practice|source)s?\b/,
    /\bclinician referral\b/,
    /\bpediatrician(?:s)?\b/,
    /\bob gyns?\b/,
    /\bobstetrician(?:s)?\b/,
    /\bmidwi(?:fe|ves)\b/,
    /\bdoula(?:s)?\b/,
    /\bphysician(?:s)?\b/,
    /\bmedical practice(?:s)?\b/,
    /\bpediatric practice(?:s)?\b/
  ],
  hospital_program: [
    /\bbaby friendly\b/,
    /\bhospital (?:program|coordinator|partnership|proposal|recertification|leadership|team|executive|director|manager|system|initiative|accreditation|designation)s?\b/,
    /\bhospitals (?:program|coordinator|partnership|proposal|recertification|leadership|team|executive|director|manager|system|initiative|accreditation|designation)s?\b/,
    /\bhealth system(?:s)? (?:program|partnership|proposal|leadership|team|executive|director|manager|initiative|accreditation|designation)s?\b/,
    /\bbirth(?:ing)? center(?:s)? (?:program|partnership|proposal|leadership|team|initiative|accreditation|designation|review|plan)s?\b/,
    /\bmaternity (?:unit|ward|program|team|quality|coordinator|center|initiative)s?\b/,
    /\blabor and delivery (?:unit|ward|program|team|quality|coordinator|center|initiative)s?\b/,
    /\bfacilit(?:y|ies) (?:designation|quality|maternity|proposal|program|coordinator|accreditation)s?\b/,
    /\b(?:hospital|health system|birth center|birthing center|maternity|facility) accreditation\b/,
    /\b(?:hospital|health system|birth center|birthing center|maternity|facility) designation\b/,
    /\b(?:hospital|health system|birth center|birthing center|maternity|facility) recertification\b/
  ],
  employer_workplace: [
    /\bemployer (?:partnership|program|benefits|leadership|team|executive|director|manager)s?\b/,
    /\bemployers (?:partnership|program|benefits|leadership|team|executive|director|manager)s?\b/,
    /\bworkplace (?:program|partnership|benefits|policy|initiative|support|leadership|team)s?\b/,
    /\bhuman resources\b/,
    /\bhr (?:leader|manager|team|department|director|executive)s?\b/,
    /\bemployee benefits?\b/,
    /\breturn to work (?:program|policy|support|benefit|initiative|plan)s?\b/,
    /\bcorporate benefits?\b/,
    /\bworkforce (?:program|benefit|support|initiative)s?\b/,
    /\bbenefit(?:s)? package\b/,
    /\bpeople operations\b/
  ],
  organization_partnership: [
    /\borganization(?:al)? (?:buyer|leader|leadership|team|executive|director|manager|decision maker|partnership|proposal|introduction)s?\b/,
    /\binstitution(?:al)? (?:buyer|leader|leadership|team|executive|director|manager|decision maker|partnership|proposal|introduction)s?\b/,
    /\b(?:business|company|agency) (?:buyer|leader|leadership|team|executive|director|manager|decision maker|partnership|proposal|introduction)s?\b/,
    /\b(?:partnership|operations) (?:leader|leadership|team|executive|director|manager|decision maker)s?\b/,
    /\b(?:founder led|boutique|professional service) (?:business|businesses|company|companies|agency|agencies|organization|organizations|studio|studios)\b/,
    /\bindependent consultants?\b/,
    /\bservice founders?\b/,
    /\bstrategic partnership\b/
  ]
};

const SCORE_ALIASES = {
  objectiveFit: ['objectiveFit', 'of'],
  evidenceStrength: ['evidenceStrength', 'es'],
  buyerAuthority: ['buyerAuthority', 'ba'],
  timing: ['timing', 'ti'],
  warmPath: ['warmPath', 'wp'],
  reachability: ['reachability', 're'],
  expectedValue: ['expectedValue', 'ev'],
  effort: ['effort', 'ef'],
  cost: ['cost', 'co'],
  risk: ['risk', 'ri'],
  uncertainty: ['uncertainty', 'un'],
  total: ['total', 'to']
};

/**
 * Runs one research-only opportunity tournament.
 *
 * completeJSON must follow run-job's OpenRouter helper contract:
 *   ({ model, system, user, maxTokens, provider, responseFormat,
 *      plugins, temperature }) =>
 *     { data, usage, generationId?, diagnostics? }
 *
 * The model generates compact, grounded strategy dimensions and semantic score
 * inputs once. This module performs the Cartesian expansion, hard filtering,
 * judging, diversity selection, and winner explanation deterministically.
 */
export async function runOpportunityTournament({
  job,
  context = {},
  model,
  completeJSON,
  now = new Date()
}) {
  const payload = asObject(job?.payload);
  const tournamentId = firstText(payload.tournamentId, job?.id);
  const algorithmVersion = firstText(
    payload.algorithmVersion,
    OPPORTUNITY_TOURNAMENT_ALGORITHM_VERSION
  );
  const objective = normalizeObjective(payload.objective, payload);
  const budget = normalizeBudget(payload.budget);
  const constraints = normalizeConstraints(objective, payload);
  const evidenceCatalog = buildEvidenceCatalog(payload, context, now);
  const evidenceHash = stableHash(evidenceCatalog);
  const timestamp = validDate(now).toISOString();
  const base = {
    tournamentId,
    algorithmVersion,
    objective,
    evidenceHash,
    hypotheses: [],
    candidates: [],
    winner: null,
    runnerUp: null,
    nextExperiment: null,
    searchSpace: emptySearchSpace(budget),
    gate: researchOnlyGate('redefine_objective', 'The win objective needs clarification.'),
    usage: emptyUsage(model, budget),
    llm: {},
    trace: {
      objective: 'Select one source-grounded professional opportunity.',
      world: 'Authorized ProfileScribe profile, source evidence, prior outcomes, and explicit constraints.',
      probe: 'Generate compact strategy dimensions and judge a deterministic expansion.',
      memory: 'Return attributable hypotheses and evidence references to ProfileScribe.',
      sideEffects: zeroSideEffects()
    }
  };
  let generatedEvidenceExperiment = null;
  const nextExperimentFor = (missingEvidence) =>
    revenueEvidenceExperiment({
      objective,
      evidenceCatalog,
      evidenceHash,
      missingEvidence,
      referenceTime: timestamp,
      generatedExperiment: generatedEvidenceExperiment
    });

  const objectiveIssue = objectiveValidationIssue(objective);
  if (objectiveIssue) {
    return {
      status: 'skipped',
      summary: objectiveIssue.summary,
      ...base,
      gate: researchOnlyGate('redefine_objective', objectiveIssue.summary, {
        question: objectiveIssue.question
      })
    };
  }

  if (!constraints.researchOnly) {
    return {
      status: 'skipped',
      summary: 'Opportunity tournaments support research and recommendation only.',
      ...base,
      gate: researchOnlyGate(
        'block',
        'This worker cannot authorize enrichment, outreach, publishing, or provider writes.'
      )
    };
  }

  if (evidenceCatalog.length === 0) {
    return {
      status: 'skipped',
      summary: 'No approved professional evidence was available for a grounded opportunity tournament.',
      ...base,
      nextExperiment: nextExperimentFor([
        'buyer',
        'paid_offer',
        'acquisition_mechanism',
        'conversion_destination',
        'paid_conversion',
        'attribution_signal'
      ]),
      gate: researchOnlyGate(
        'needs_more_approved_evidence',
        'No professional facts or public offer were available, so the bounded next step is to document one attributable paid path for review.'
      )
    };
  }

  if (budget.maxLLMCalls < 1) {
    return {
      status: 'skipped',
      summary: 'Tournament budget does not authorize the one required strategy-generation call.',
      ...base,
      gate: researchOnlyGate('block', 'The tournament has no authorized LLM-call budget.')
    };
  }

  const promptEvidenceCatalog = compactPromptEvidenceCatalog(
    evidenceCatalog
  );
  const prompt = seedAndJudgePrompt({
    objective,
    constraints,
    evidenceCatalog: promptEvidenceCatalog,
    priorOutcomes: normalizePriorOutcomes(payload.priorOutcomes),
    maxSeedsPerDimension: Math.min(4, MAX_SEEDS_PER_DIMENSION)
  });
  const promptHash = stableHash({ system: prompt.system, user: prompt.user });
  const initialCompletionRequest = {
    model,
    system: prompt.system,
    user: prompt.user,
    maxTokens: budget.maxOutputTokens,
    responseFormat: tournamentStructuredResponseFormat(
      promptEvidenceCatalog,
      INITIAL_FAMILY_VARIANT_COUNT
    ),
    plugins: [{ id: 'response-healing' }],
    temperature: 0,
    provider: {
      ...TOURNAMENT_PROVIDER_ROUTING,
      max_price: budget.providerMaxPrice
    }
  };
  const initialProviderSpendPreflight =
    providerCallSpendPreflight(initialCompletionRequest, budget);
  const initialCallSpendCeilingMicros =
    initialProviderSpendPreflight.callSpendCeilingMicros;
  if (budget.hardStop &&
      initialCallSpendCeilingMicros > budget.maxLLMSpendMicros) {
    return {
      status: 'skipped',
      summary:
        'The bounded strategy-generation request could exceed the tournament LLM budget, so no provider call was made.',
      ...base,
      nextExperiment: nextExperimentFor([
        'within_budget_strategy_generation'
      ]),
      searchSpace: {
        ...base.searchSpace,
        modelCalls: 0,
        providerSpendPreflight: {
          ...initialProviderSpendPreflight,
          authorized: false,
          maxLLMSpendMicros: budget.maxLLMSpendMicros
        }
      },
      gate: researchOnlyGate(
        'block',
        'The conservative prompt and output ceiling for the initial call did not fit the hard LLM budget.'
      )
    };
  }

  let completion;
  let initialTruncationError = null;
  try {
    completion = await completeJSON(initialCompletionRequest);
  } catch (error) {
    if (openRouterFailureCode(error) ===
        'openrouter_truncated_structured_output' &&
        budget.maxLLMCalls >= 2) {
      initialTruncationError = error;
    } else {
      const missingStrategyEvidence =
        strategyGenerationFailureMissingEvidence(error);
      const providerMetadata = openRouterMetadata({
        model,
        status: 'failed',
        usage: error?.openRouterUsage,
        generationId: error?.openRouterGenerationId,
        diagnostics: error?.openRouterDiagnostics,
        promptHash,
        error: openRouterFailureCode(error)
      });
      return {
        status: 'skipped',
        summary: 'The strategy generator did not return a usable tournament seed set.',
        ...base,
        nextExperiment: nextExperimentFor([
          missingStrategyEvidence
        ]),
        llm: { strategyGeneratorJudge: providerMetadata },
        usage: aggregateUsage([providerMetadata], budget),
        gate: researchOnlyGate(
          'block',
          'The bounded strategy-generation call failed; no deterministic recommendation was substituted.'
        )
      };
    }
  }

  const initialCompletionTruncated =
    Boolean(initialTruncationError) ||
    openRouterDiagnosticsIndicateTruncation(completion?.diagnostics);
  const providerMetadata = initialTruncationError
    ? openRouterMetadata({
        model,
        status: 'failed',
        usage: initialTruncationError?.openRouterUsage,
        generationId: initialTruncationError?.openRouterGenerationId,
        diagnostics: initialTruncationError?.openRouterDiagnostics,
        promptHash,
        error: 'openrouter_truncated_structured_output'
      })
    : openRouterMetadata({
        model,
        status: initialCompletionTruncated ? 'incomplete' : 'completed',
        usage: completion?.usage,
        generationId: completion?.generationId,
        diagnostics: completion?.diagnostics,
        promptHash,
        error: initialCompletionTruncated
          ? 'openrouter_truncated_structured_output'
          : undefined
      });
  const providerMetadataEntries = [providerMetadata];
  const llmTrace = {
    strategyGeneratorJudge: providerMetadata
  };
  const initialPromptTokenCanary = providerPromptTokenCanary(
    initialProviderSpendPreflight,
    providerMetadata.openRouterUsage
  );
  let usage = aggregateUsage(providerMetadataEntries, budget);
  if (budget.hardStop && usage.reportedCostMicros > budget.maxLLMSpendMicros) {
    return {
      status: 'skipped',
      summary: 'The strategy-generation call exceeded the tournament LLM budget; no recommendation was selected.',
      ...base,
      nextExperiment: nextExperimentFor([
        'within_budget_strategy_generation'
      ]),
      llm: llmTrace,
      usage,
      gate: researchOnlyGate(
        'block',
        'Reported LLM cost exceeded the hard tournament LLM budget.'
      )
    };
  }

  let seedSet = normalizeSeedSet(
    completion?.data,
    evidenceCatalog,
    timestamp
  );
  generatedEvidenceExperiment = normalizeGeneratedEvidenceExperiment(
    completion?.data?.evidenceExperiment,
    evidenceCatalog,
    timestamp
  );
  const initialShapeIssue = initialCompletionTruncated
    ? structuredOutputLengthIssue(
        initialTruncationError?.openRouterDiagnostics ??
          completion?.diagnostics
      )
    : structuredSeedSetShapeIssue(seedSet);
  let terminalStructuredIssue = initialShapeIssue;
  const structuredRepair = {
    authorized: budget.maxLLMCalls >= 2,
    attempted: false,
    succeeded: false,
    initialIssue: initialShapeIssue?.code || '',
    initialSeedContract: firstText(seedSet.seedContract),
    initialFamilyWrapperCount:
      nonNegativeInteger(seedSet.familyWrapperCount) || 0,
    initialValidStrategyFamilyCount:
      nonNegativeInteger(seedSet.validStrategyFamilyCount) || 0,
    initialCallSpendCeilingMicros,
    initialFixedRequestFeeCeilingMicros:
      initialProviderSpendPreflight.fixedRequestFeeCeilingMicros,
    initialPromptTokenCanary
  };
  if (initialPromptTokenCanary.withinCeiling === false) {
    structuredRepair.failure = 'prompt_token_ceiling_exceeded';
    structuredRepair.finalIssue = structuredRepair.initialIssue;
    return {
      status: 'skipped',
      summary:
        'Provider prompt-token accounting exceeded the preflight ceiling, so no recommendation was accepted and no repair call was authorized.',
      ...base,
      nextExperiment: nextExperimentFor([
        'within_budget_strategy_generation'
      ]),
      llm: llmTrace,
      usage,
      searchSpace: {
        ...base.searchSpace,
        ...seedSetShapeSearchTrace(seedSet),
        modelCalls: usage.calls,
        structuredRepair
      },
      gate: researchOnlyGate(
        'block',
        'The provider prompt-token canary exceeded the exact request-byte ceiling; no generated recommendation was accepted and the remaining reservation was not reused.'
      )
    };
  }
  if (initialShapeIssue && structuredRepair.authorized) {
    const remainingSpendMicros = remainingRepairSpendMicros(
      budget,
      usage,
      [initialCompletionRequest]
    );
    structuredRepair.remainingSpendMicros = remainingSpendMicros;
    if (remainingSpendMicros > 0) {
      const repairPrompt = seedAndJudgeRepairPrompt({
        originalPrompt: prompt,
        issue: initialShapeIssue
      });
      const repairPromptHash = stableHash({
        system: repairPrompt.system,
        user: repairPrompt.user
      });
      const repairCompletionRequest = {
        model,
        system: repairPrompt.system,
        user: repairPrompt.user,
        maxTokens: Math.min(
          budget.maxOutputTokens,
          MAX_REPAIR_OUTPUT_TOKENS
        ),
        responseFormat:
          tournamentStructuredResponseFormat(
            promptEvidenceCatalog,
            REPAIR_FAMILY_VARIANT_COUNT
          ),
        plugins: [{ id: 'response-healing' }],
        temperature: 0,
        provider: {
          ...TOURNAMENT_PROVIDER_ROUTING,
          max_price: {
            ...budget.providerMaxPrice,
            // This only tightens a possible fixed provider fee. The explicit
            // request spend ceiling below accounts for prompt/output tokens.
            request: roundMoney(Math.min(
              budget.providerMaxPrice.request,
              remainingSpendMicros / 1_000_000
            ))
          }
        }
      };
      const repairProviderSpendPreflight =
        providerCallSpendPreflight(repairCompletionRequest, budget);
      structuredRepair.repairCallSpendCeilingMicros =
        repairProviderSpendPreflight.callSpendCeilingMicros;
      structuredRepair.repairRequestBodyByteCount =
        repairProviderSpendPreflight.requestBodyByteCount;
      structuredRepair.repairPromptTokenCeiling =
        repairProviderSpendPreflight.promptTokenCeiling;
      structuredRepair.repairFixedRequestFeeCeilingMicros =
        repairProviderSpendPreflight.fixedRequestFeeCeilingMicros;
      if (budget.hardStop &&
          structuredRepair.repairCallSpendCeilingMicros >
            remainingSpendMicros) {
        structuredRepair.failure = 'repair_budget_unavailable';
        structuredRepair.finalIssue = initialShapeIssue.code;
        return {
          status: 'skipped',
          summary:
            'The initial strategy response needed a structured repair, but the bounded repair request could exceed the remaining LLM spend.',
          ...base,
          nextExperiment: nextExperimentFor([
            'within_budget_strategy_generation'
          ]),
          llm: llmTrace,
          usage,
          searchSpace: {
            ...base.searchSpace,
            ...seedSetShapeSearchTrace(seedSet),
            modelCalls: usage.calls,
            structuredRepair
          },
          gate: researchOnlyGate(
            'block',
            'The conservative prompt and output ceiling for the repair did not fit the remaining hard LLM budget.'
          )
        };
      }
      structuredRepair.attempted = true;
      let repairCompletion;
      try {
        repairCompletion = await completeJSON(repairCompletionRequest);
      } catch (error) {
        const repairFailureCode = openRouterFailureCode(error);
        const repairWasTruncated = repairFailureCode ===
          'openrouter_truncated_structured_output';
        const repairMetadata = openRouterMetadata({
          model,
          status: 'failed',
          usage: error?.openRouterUsage,
          generationId: error?.openRouterGenerationId,
          diagnostics: error?.openRouterDiagnostics,
          promptHash: repairPromptHash,
          error: repairFailureCode
        });
        structuredRepair.repairPromptTokenCanary =
          providerPromptTokenCanary(
            repairProviderSpendPreflight,
            repairMetadata.openRouterUsage
          );
        providerMetadataEntries.push(repairMetadata);
        llmTrace.strategyFamilyRepair = repairMetadata;
        usage = aggregateUsage(providerMetadataEntries, budget);
        structuredRepair.finalIssue = repairWasTruncated
          ? 'output_length_truncated'
          : initialShapeIssue.code;
        structuredRepair.failure = repairWasTruncated
          ? 'structured_repair_output_truncated'
          : 'structured_repair_provider_failure';
        return {
          status: 'skipped',
          summary:
            'The bounded strategy-family repair call failed, so the tournament did not substitute a market-evidence explanation.',
          ...base,
          nextExperiment: nextExperimentFor([
            repairWasTruncated
              ? 'structured_strategy_family_repair'
              : 'usable_strategy_generation'
          ]),
          llm: llmTrace,
          usage,
          searchSpace: {
            ...base.searchSpace,
            ...seedSetShapeSearchTrace(seedSet),
            modelCalls: usage.calls,
            structuredRepair
          },
          gate: researchOnlyGate(
            'strategy_generation_repair_failed',
            'The AI returned an incomplete comparison and its one authorized structured repair call failed.'
          )
        };
      }
      const repairCompletionTruncated =
        openRouterDiagnosticsIndicateTruncation(
          repairCompletion?.diagnostics
        );
      const repairMetadata = openRouterMetadata({
        model,
        status: repairCompletionTruncated
          ? 'incomplete'
          : 'completed',
        usage: repairCompletion?.usage,
        generationId: repairCompletion?.generationId,
        diagnostics: repairCompletion?.diagnostics,
        promptHash: repairPromptHash,
        error: repairCompletionTruncated
          ? 'openrouter_truncated_structured_output'
          : undefined
      });
      structuredRepair.repairPromptTokenCanary =
        providerPromptTokenCanary(
          repairProviderSpendPreflight,
          repairMetadata.openRouterUsage
        );
      providerMetadataEntries.push(repairMetadata);
      llmTrace.strategyFamilyRepair = repairMetadata;
      usage = aggregateUsage(providerMetadataEntries, budget);
      const repairedSeedSet = normalizeSeedSet(
        repairCompletion?.data,
        evidenceCatalog,
        timestamp
      );
      const repairedEvidenceExperiment =
        normalizeGeneratedEvidenceExperiment(
          repairCompletion?.data?.evidenceExperiment,
          evidenceCatalog,
          timestamp
        );
      const repairedIssue = repairCompletionTruncated
        ? structuredOutputLengthIssue(repairCompletion?.diagnostics)
        : structuredSeedSetShapeIssue(repairedSeedSet);
      if (budget.hardStop &&
          usage.reportedCostMicros > budget.maxLLMSpendMicros) {
        // A provider-reported hard-budget breach takes precedence over any
        // simultaneous accounting canary drift. Preserve the repaired shape
        // trace, but never select its recommendation.
        completion = repairCompletion;
        seedSet = repairedSeedSet;
        generatedEvidenceExperiment = repairedEvidenceExperiment;
        structuredRepair.succeeded = !repairedIssue;
        structuredRepair.finalIssue = repairedIssue?.code || '';
        terminalStructuredIssue = repairedIssue;
        structuredRepair.failure = 'repair_budget_exceeded';
        return {
          status: 'skipped',
          summary:
            'The structured strategy repair exceeded the tournament LLM budget; no recommendation was selected.',
          ...base,
          nextExperiment: nextExperimentFor([
            'within_budget_strategy_generation'
          ]),
          llm: llmTrace,
          usage,
          searchSpace: {
            ...base.searchSpace,
            ...seedSetShapeSearchTrace(seedSet),
            modelCalls: usage.calls,
            structuredRepair
          },
          gate: researchOnlyGate(
            'block',
            'Reported LLM cost exceeded the hard tournament budget during structured repair.'
          )
        };
      }
      if (structuredRepair.repairPromptTokenCanary.withinCeiling ===
          false) {
        structuredRepair.failure =
          'repair_prompt_token_ceiling_exceeded';
        structuredRepair.finalIssue = initialShapeIssue.code;
        return {
          status: 'skipped',
          summary:
            'The repair response exceeded its preflight prompt-token ceiling, so it was not accepted.',
          ...base,
          nextExperiment: nextExperimentFor([
            'within_budget_strategy_generation'
          ]),
          llm: llmTrace,
          usage,
          searchSpace: {
            ...base.searchSpace,
            ...seedSetShapeSearchTrace(seedSet),
            modelCalls: usage.calls,
            structuredRepair
          },
          gate: researchOnlyGate(
            'block',
            'The provider prompt-token canary exceeded the repair request-byte ceiling; no repaired recommendation was accepted.'
          )
        };
      }
      completion = repairCompletion;
      seedSet = repairedSeedSet;
      generatedEvidenceExperiment = repairedEvidenceExperiment;
      structuredRepair.succeeded = !repairedIssue;
      structuredRepair.finalIssue = repairedIssue?.code || '';
      terminalStructuredIssue = repairedIssue;
    } else {
      structuredRepair.failure = 'repair_budget_unavailable';
      structuredRepair.finalIssue = initialShapeIssue.code;
      return {
        status: 'skipped',
        summary:
          'The initial strategy response needed a structured repair, but no authorized LLM spend remained for that repair.',
        ...base,
        nextExperiment: nextExperimentFor([
          'within_budget_strategy_generation'
        ]),
        llm: llmTrace,
        usage,
        searchSpace: {
          ...base.searchSpace,
          ...seedSetShapeSearchTrace(seedSet),
          modelCalls: usage.calls,
          structuredRepair
        },
        gate: researchOnlyGate(
          'block',
          'The initial model call consumed the available LLM spend, so the required structured repair was not attempted.'
        )
      };
    }
  }
  if (terminalStructuredIssue?.code === 'output_length_truncated') {
    structuredRepair.failure = structuredRepair.failure ||
      (structuredRepair.attempted
        ? 'structured_repair_output_truncated'
        : 'structured_output_truncated');
    return {
      status: 'skipped',
      summary:
        'The bounded AI response ended at its output limit, so no healed or partial comparison was treated as complete.',
      ...base,
      nextExperiment: nextExperimentFor([
        'structured_strategy_family_repair'
      ]),
      llm: llmTrace,
      usage,
      searchSpace: {
        ...base.searchSpace,
        ...seedSetShapeSearchTrace(seedSet),
        modelCalls: usage.calls,
        structuredRepair
      },
      gate: researchOnlyGate(
        structuredRepair.attempted
          ? 'strategy_generation_repair_failed'
          : 'strategy_generation_incomplete',
        'The AI output hit its length limit. New market evidence is not required; another automatic model call is not authorized.'
      )
    };
  }
  if (seedSet.seedContract === 'invalid') {
    return {
      status: 'skipped',
      summary:
        'The strategy generator returned an unsupported seed contract; no legacy or upgraded interpretation was assumed.',
      ...base,
      nextExperiment: nextExperimentFor([
        'structured_strategy_family_repair'
      ]),
      llm: llmTrace,
      usage,
      searchSpace: {
        ...base.searchSpace,
        seedContract: seedSet.seedContract,
        declaredStrategyFamilyCount:
          seedSet.declaredStrategyFamilyCount,
        familyWrapperCount: seedSet.familyWrapperCount,
        validStrategyFamilyCount: seedSet.validStrategyFamilyCount,
        strategyFamilyCount: seedSet.strategyFamilies.length,
        modelCalls: usage.calls,
        structuredRepair
      },
      gate: researchOnlyGate(
        'strategy_generation_incomplete',
        'The AI response and any authorized bounded repair did not declare a supported seed contract.'
      )
    };
  }
  const searchContracts = searchContractsForSeedSet(seedSet);
  const missingDimension = DIMENSIONS.find(([name]) => seedSet[name].length === 0)?.[0];
  if (missingDimension) {
    const unsupportedTiming = missingDimension === 'timingTriggers' &&
      seedSet.unsupportedTimingSeedCount > 0;
    const finalShapeIssue = structuredSeedSetShapeIssue(seedSet);
    return {
      status: 'skipped',
      summary: unsupportedTiming
        ? 'The strategy generator returned no source-backed timing trigger; urgency was not inferred.'
        : `The strategy generator returned no grounded ${missingDimension} seeds.`,
      ...base,
      nextExperiment: nextExperimentFor([
        finalShapeIssue
          ? 'structured_strategy_family_repair'
          : `missing_${missingDimension}`
      ]),
      llm: llmTrace,
      usage,
      searchSpace: {
        ...base.searchSpace,
        dimensionCounts: dimensionCounts(seedSet),
        seedContract: seedSet.seedContract,
        declaredStrategyFamilyCount: seedSet.declaredStrategyFamilyCount,
        familyWrapperCount: seedSet.familyWrapperCount,
        validStrategyFamilyCount: seedSet.validStrategyFamilyCount,
        strategyFamilyCount: seedSet.strategyFamilies.length,
        completeStrategyFamilyCount: seedSet.completeStrategyFamilyCount,
        incompleteStrategyFamilyCount: seedSet.incompleteStrategyFamilyCount,
        strategyFamilyAnchorCoverage: seedSet.strategyFamilyAnchorCoverage,
        strategyFamilyCollisionCount: seedSet.strategyFamilyCollisionCount,
        familyEvidenceMismatchSeedCount: seedSet.familyEvidenceMismatchSeedCount,
        invalidFamilySeedCount: seedSet.invalidFamilySeedCount,
        unsupportedTimingSeedCount: seedSet.unsupportedTimingSeedCount,
        timingVerificationRepairCount: seedSet.timingVerificationRepairCount,
        coherenceGate: searchContracts.coherenceGate,
        revenueGate: searchContracts.revenueGate,
        revenuePathContract: searchContracts.revenuePathContract,
        modelCalls: usage.calls,
        structuredRepair
      },
      gate: researchOnlyGate(
        finalShapeIssue
          ? 'strategy_generation_incomplete'
          : 'block',
        finalShapeIssue
          ? 'The AI response and any authorized bounded repair returned an incomplete structured strategy seed set.'
          : unsupportedTiming
            ? 'No timing claim was directly supported by an exact phrase in approved evidence.'
            : 'The structured strategy seed set was incomplete or ungrounded.'
      )
    };
  }
  if (seedSet.completeStrategyFamilyCount < 2) {
    return {
      status: 'skipped',
      summary: 'The strategy generator returned fewer than two complete, source-anchored strategy families.',
      ...base,
      nextExperiment: nextExperimentFor([
        'structured_strategy_family_repair'
      ]),
      llm: llmTrace,
      usage,
      searchSpace: {
        ...base.searchSpace,
        dimensionCounts: dimensionCounts(seedSet),
        seedContract: seedSet.seedContract,
        declaredStrategyFamilyCount: seedSet.declaredStrategyFamilyCount,
        familyWrapperCount: seedSet.familyWrapperCount,
        validStrategyFamilyCount: seedSet.validStrategyFamilyCount,
        strategyFamilyCount: seedSet.strategyFamilies.length,
        completeStrategyFamilyCount: seedSet.completeStrategyFamilyCount,
        incompleteStrategyFamilyCount: seedSet.incompleteStrategyFamilyCount,
        strategyFamilyAnchorCoverage: seedSet.strategyFamilyAnchorCoverage,
        strategyFamilyCollisionCount: seedSet.strategyFamilyCollisionCount,
        familyEvidenceMismatchSeedCount: seedSet.familyEvidenceMismatchSeedCount,
        invalidFamilySeedCount: seedSet.invalidFamilySeedCount,
        unsupportedTimingSeedCount: seedSet.unsupportedTimingSeedCount,
        timingVerificationRepairCount: seedSet.timingVerificationRepairCount,
        coherenceGate: searchContracts.coherenceGate,
        revenueGate: searchContracts.revenueGate,
        revenuePathContract: searchContracts.revenuePathContract,
        modelCalls: usage.calls,
        structuredRepair
      },
      gate: researchOnlyGate(
        'strategy_generation_incomplete',
        'The AI response and any authorized bounded repair did not produce two complete comparison families where every dimension cites specific family evidence and each family uses at least one approved observation.'
      )
    };
  }

  const expanded = expandAndJudge({
    objective,
    constraints,
    evidenceCatalog,
    priorOutcomes: normalizePriorOutcomes(payload.priorOutcomes),
    seedSet,
    weights: normalizeJudgeWeights(
      completion?.data?.judgeWeights ?? completion?.data?.w
    ),
    budget,
    timestamp
  });
  const initialHypotheses = expanded.finalists;
  const searchSpaceFor = (retainedHypotheses) => ({
    maxHypotheses: budget.maxHypotheses,
    generatorContract: TOURNAMENT_GENERATOR_CONTRACT,
    theoreticalCount: expanded.theoreticalCount,
    expandedCount: expanded.expandedCount,
    eligibleCount: expanded.eligibleCount,
    filteredCount: expanded.filteredCount,
    incompatibleCount: expanded.incompatibleCount,
    motionConflictCount: expanded.motionConflictCount,
    motionConflictDimensions: expanded.motionConflictDimensions,
    revenueGate: searchContracts.revenueGate,
    revenuePathContract: searchContracts.revenuePathContract,
    revenueRejectedCount: expanded.revenueRejectedCount,
    revenueRejectionReasons: expanded.revenueRejectionReasons,
    retainedCount: retainedHypotheses.length,
    dimensionCounts: dimensionCounts(seedSet),
    seedContract: seedSet.seedContract,
    declaredStrategyFamilyCount: seedSet.declaredStrategyFamilyCount,
    familyWrapperCount: seedSet.familyWrapperCount,
    validStrategyFamilyCount: seedSet.validStrategyFamilyCount,
    strategyFamilyCount: seedSet.strategyFamilies.length,
    completeStrategyFamilyCount: seedSet.completeStrategyFamilyCount,
    incompleteStrategyFamilyCount: seedSet.incompleteStrategyFamilyCount,
    strategyFamilyAnchorCoverage: seedSet.strategyFamilyAnchorCoverage,
    strategyFamilyCollisionCount: seedSet.strategyFamilyCollisionCount,
    familyEvidenceMismatchSeedCount: seedSet.familyEvidenceMismatchSeedCount,
    invalidFamilySeedCount: seedSet.invalidFamilySeedCount,
    unsupportedTimingSeedCount: seedSet.unsupportedTimingSeedCount,
    timingVerificationRepairCount: seedSet.timingVerificationRepairCount,
    coherenceGate: searchContracts.coherenceGate,
    deterministic: true,
    modelCalls: usage.calls,
    structuredRepair,
    judgeWeights: expanded.weights
  });
  if (initialHypotheses.length < 2) {
    return {
      status: 'skipped',
      summary: 'The tournament retained fewer than two grounded strategies.',
      ...base,
      hypotheses: initialHypotheses.map(publicHypothesis),
      nextExperiment: nextExperimentFor([
        ...Object.keys(expanded.revenueRejectionReasons),
        'second_grounded_finalist'
      ]),
      searchSpace: searchSpaceFor(initialHypotheses),
      llm: llmTrace,
      usage,
      gate: researchOnlyGate(
        'needs_more_approved_evidence',
        'A completed tournament requires a distinct winner and runner-up grounded in approved evidence.'
      )
    };
  }
  const profileScribePublicBaseURL = firstText(
    payload.profileScribePublicBaseURL,
    payload.publicBaseUrl
  );
  const externallyGroundedCandidateValues = [
    ...collectStructuredCandidates(
      payload,
      context,
      profileScribePublicBaseURL
    ),
    ...normalizeModelExtractedCandidates(
      completion?.data?.candidates,
      evidenceCatalog
    )
  ];
  const ownedInboundAssetValues = synthesizeOwnedInboundAssetCandidates(
    initialHypotheses,
    evidenceCatalog,
    timestamp
  );
  const ownerIdentity = ownerCandidateIdentity(
    job,
    payload,
    context,
    profileScribePublicBaseURL
  );
  const primaryCandidates = normalizeCandidates(
    externallyGroundedCandidateValues,
    initialHypotheses,
    evidenceCatalog,
    timestamp,
    profileScribePublicBaseURL,
    ownerIdentity
  );
  const hasActionablePrimaryCandidate = primaryCandidates.some(
    (candidate) => initialHypotheses.some((hypothesis) =>
      candidateActionableForHypothesis(
        candidate,
        hypothesis,
        evidenceCatalog
      )
    )
  );
  const candidateValues = hasActionablePrimaryCandidate
    ? [
        ...externallyGroundedCandidateValues,
        ...ownedInboundAssetValues
      ]
    : [
        ...externallyGroundedCandidateValues,
        ...normalizeSeedMentionedOrganizationCandidates(
          seedSet,
          evidenceCatalog
        ),
        ...ownedInboundAssetValues
      ];
  const provisionalCandidates = normalizeCandidates(
    candidateValues,
    initialHypotheses,
    evidenceCatalog,
    timestamp,
    profileScribePublicBaseURL,
    ownerIdentity
  );
  const actionableHypotheses = initialHypotheses
    .filter((hypothesis) =>
      provisionalCandidates.some((candidate) =>
        candidateActionableForHypothesis(
          candidate,
          hypothesis,
          evidenceCatalog
        )
      )
    )
    .sort(compareHypotheses);
  const winningHypothesis = actionableHypotheses[0];
  if (!winningHypothesis) {
    return {
      status: 'skipped',
      summary: 'No source-backed revenue target grounded a retained strategy.',
      ...base,
      hypotheses: initialHypotheses.map(publicHypothesis),
      candidates: provisionalCandidates,
      nextExperiment: nextExperimentFor([
        ...Object.keys(expanded.revenueRejectionReasons),
        initialHypotheses.some((hypothesis) =>
          hypothesis.revenuePath?.acquisitionMode === 'inbound'
        )
          ? 'approved_inbound_asset'
          : 'named_revenue_target'
      ]),
      searchSpace: searchSpaceFor(initialHypotheses),
      llm: llmTrace,
      usage,
      gate: researchOnlyGate(
        'needs_more_approved_evidence',
        'The strategy field was explored, but completing the result requires either a named person or organization for an external acquisition path, or an approved public offer/booking asset for an inbound paid-conversion path.',
        {
          question: 'Which approved source grounds either a specific outside revenue target or a public inbound offer/booking page with a measurable paid conversion?'
        }
      )
    };
  }
  const remainingHypotheses = initialHypotheses
    .filter((hypothesis) =>
      hypothesis.id !== winningHypothesis.id &&
      hypothesis.score.total <= winningHypothesis.score.total
    )
    .sort(compareHypotheses);
  const alternateFamilyIndex = remainingHypotheses.findIndex((hypothesis) =>
    firstText(hypothesis._strategyFamily) !==
      firstText(winningHypothesis._strategyFamily)
  );
  if (alternateFamilyIndex < 0) {
    return {
      status: 'skipped',
      summary: 'The best candidate-grounded strategy had no family-diverse runner-up.',
      ...base,
      hypotheses: initialHypotheses.map(publicHypothesis),
      candidates: provisionalCandidates,
      nextExperiment: nextExperimentFor([
        'family_diverse_revenue_path'
      ]),
      searchSpace: searchSpaceFor(initialHypotheses),
      llm: llmTrace,
      usage,
      gate: researchOnlyGate(
        'needs_more_approved_evidence',
        'A completed tournament requires a candidate-grounded winner and a lower-ranked runner-up from a different complete strategy family.'
      )
    };
  }
  const familyDiverseRunner = alternateFamilyIndex >= 0
    ? remainingHypotheses.splice(alternateFamilyIndex, 1)
    : [];
  const hypotheses = [
    winningHypothesis,
    ...familyDiverseRunner,
    ...remainingHypotheses
  ]
    .map((hypothesis, index) => ({
      ...hypothesis,
      rank: index + 1,
      status: index === 0
        ? 'winner'
        : index === 1 ? 'runner_up' : 'finalist'
    }));
  const publicHypotheses = hypotheses.map(publicHypothesis);
  const searchSpace = searchSpaceFor(hypotheses);
  if (hypotheses.length < 2) {
    return {
      status: 'skipped',
      summary: 'The best candidate-grounded strategy had no distinct runner-up.',
      ...base,
      hypotheses: publicHypotheses,
      nextExperiment: nextExperimentFor([
        'distinct_runner_up'
      ]),
      searchSpace,
      llm: llmTrace,
      usage,
      gate: researchOnlyGate(
        'needs_more_approved_evidence',
        'A completed tournament requires a candidate-grounded winner and a distinct lower-ranked runner-up.'
      )
    };
  }
  const candidates = normalizeCandidates(
    candidateValues,
    hypotheses,
    evidenceCatalog,
    timestamp,
    profileScribePublicBaseURL,
    ownerIdentity
  );
  const selected = selectWinner({
    objective,
    hypotheses,
    candidates,
    evidenceCatalog,
    eligibleCount: expanded.eligibleCount,
    exploredCount: expanded.expandedCount
  });

  if (!selected.winner) {
    return {
      status: 'skipped',
      summary: 'No source-backed revenue target grounded the best actionable strategy.',
      ...base,
      hypotheses: publicHypotheses,
      candidates: selected.candidates,
      nextExperiment: nextExperimentFor([
        initialHypotheses.some((hypothesis) =>
          hypothesis.revenuePath?.acquisitionMode === 'inbound'
        )
          ? 'approved_inbound_asset'
          : 'named_revenue_target'
      ]),
      searchSpace,
      llm: llmTrace,
      usage,
      gate: researchOnlyGate(
        'needs_more_approved_evidence',
        'The strategy field was explored, but completing the result requires either a named outside target or an approved public inbound offer/booking asset whose evidence grounds the rank-one buyer segment and paid offer or proof.',
        {
          question: 'Which approved source grounds either a specific outside revenue target or a public inbound offer/booking page with a measurable paid conversion?'
        }
      )
    };
  }

  return {
    status: 'completed',
    summary: 'Selected one source-grounded opportunity for human review; no external action was taken.',
    ...base,
    hypotheses: publicHypotheses,
    candidates: selected.candidates,
    winner: selected.winner,
    runnerUp: selected.runnerUp,
    searchSpace,
    llm: llmTrace,
    usage,
    gate: researchOnlyGate(
      'human_review',
      'Tournament research is complete. Starting the tournament did not authorize the recommended action.',
      {
        requiresReview: true,
        winnerHypothesisId: selected.winner.hypothesisId
      }
    )
  };
}

function strategyGenerationFailureMissingEvidence(error) {
  const message = comparable(
    `${error?.message || ''} ${error?.body || ''} ${error || ''}`
  );
  if (/\b(?:max price|price cap|request price|within budget|budget cap|affordable route|no (?:model|provider|route).{0,40}(?:price|budget)|(?:price|budget).{0,40}no (?:model|provider|route))\b/.test(
    message
  )) {
    return 'within_budget_strategy_generation';
  }
  return 'usable_strategy_generation';
}

function publicHypothesis(hypothesis) {
  const {
    _tuple,
    _strategyFamily,
    ...value
  } = asObject(hypothesis);
  return value;
}

export function buildEvidenceCatalog(
  payload,
  context = {},
  referenceTime = new Date()
) {
  payload = asObject(payload);
  context = asObject(context);
  const snapshot = asObject(payload.evidenceSnapshot);
  const profile = asObject(
    Object.keys(asObject(snapshot.profile)).length > 0 ? snapshot.profile : context.profile
  );
  const sources = firstArray(snapshot.sources, context.sources);
  const sourceEvidence = firstArray(
    snapshot.sourceEvidence,
    snapshot.evidence,
    snapshot.observations,
    context.sourceEvidence
  );
  const sourceExtracts = firstArray(snapshot.sourceExtracts, context.sourceExtracts);
  const explicitFacts = firstArray(
    snapshot.facts,
    snapshot.proofPoints,
    snapshot.factCandidates,
    payload.evidence
  );
  const recentPosts = firstArray(
    snapshot.recentTimelinePosts,
    asObject(snapshot.timelineBrief).recentPosts,
    asObject(context.timelineBrief).recentPosts
  );
  const profileControlledURLs = profileDeclaredControlledURLs(profile);
  const approvedSourceIDs = new Set(
    sources
      .map(asObject)
      .filter(sourceIsResearchApproved)
      .map((source) => firstText(source.id, source.sourceId))
      .filter(Boolean)
  );
  const approvedSourcesByID = new Map(
    sources
      .map(asObject)
      .filter(sourceIsResearchApproved)
      .map((source) => [
        firstText(source.id, source.sourceId),
        {
          url: safePublicURL(firstText(source.url, source.sourceUrl)),
          label: firstText(source.label, source.title, source.url),
          profileControlled: profileControlsSource(
            source,
            profileControlledURLs
          )
        }
      ])
      .filter(([sourceID]) => Boolean(sourceID))
  );
  const persistedEvidenceSourceIDs = new Set(
    [...sourceEvidence, ...sourceExtracts]
      .map(asObject)
      .filter((evidence) => firstText(
        evidence.label,
        evidence.title,
        evidence.sourceLabel,
        evidence.evidenceTitle,
        evidence.summary,
        evidence.description,
        evidence.evidenceSummary,
        evidence.excerpt,
        evidence.body,
        evidence.value
      ))
      .map((evidence) => firstText(evidence.sourceId, evidence.sourceID))
      .filter((sourceID) => approvedSourceIDs.has(sourceID))
  );
  const catalog = [];
  const seen = new Set();

  const append = (raw, fallbackType, fallbackID, origin = {}) => {
    raw = asObject(raw);
    const type = firstText(raw.type, raw.kind, fallbackType, 'evidence');
    const label = firstText(
      raw.label,
      raw.title,
      raw.name,
      raw.sourceLabel,
      raw.evidenceTitle,
      raw.role,
      raw.topic,
      raw.headline
    );
    const summary = truncate(
      firstText(
        raw.summary,
        raw.description,
        raw.evidenceSummary,
        raw.detail,
        raw.excerpt,
        raw.body,
        raw.value
      ),
      420
    );
    const url = safePublicURL(firstText(raw.url, raw.sourceUrl, raw.publicUrl));
    const sourceID = firstText(raw.sourceId, raw.sourceID);
    const rawID = firstText(
      raw.evidenceRef,
      raw.id,
      raw.observationId,
      raw.factId,
      raw.factID,
      fallbackID
    );
    let id = rawID
      ? normalizeEvidenceID(rawID, type, sourceID)
      : `evidence:${stableHash({ type, label, summary, url }).slice(0, 20)}`;
    // The observation namespace is owned by persisted source observations.
    // Explicit facts, extracts, timeline posts, and caller payloads cannot mint
    // an observation:* identifier that later looks source-approved.
    if (/^observation:/i.test(id) &&
        asObject(origin).approvedSourceObservation !== true) {
      id = `evidence:${stableHash({
        type,
        label,
        summary,
        url,
        claimedID: id
      }).slice(0, 20)}`;
    }
    if (!id || (!label && !summary) || seen.has(id)) return;
    seen.add(id);
    catalog.push(compact({
      id,
      type: truncate(type, 80),
      label: truncate(label || summary, 180),
      summary,
      url,
      sourceId: sourceID,
      observedAt: firstText(raw.observedAt, raw.updatedAt, raw.publishedAt),
      publishedAt: firstText(raw.publishedAt),
      startDate: firstText(raw.startDate),
      endDate: firstText(raw.endDate),
      current: typeof raw.current === 'boolean' ? raw.current : undefined,
      status: firstText(raw.status),
      priority: firstText(raw.priority),
      confidence: normalizeConfidence(raw.confidence, raw.trustLevel),
      approvedSourceObservation:
        asObject(origin).approvedSourceObservation === true ? true : undefined,
      approvedSourceUrl: safePublicURL(
        asObject(origin).approvedSourceUrl
      ),
      approvedSourceLabel: firstText(
        asObject(origin).approvedSourceLabel
      ),
      profileControlledSource:
        asObject(origin).profileControlledSource === true ? true : undefined,
      aliases: compactStrings([
        url
      ])
    }));
  };

  const identity = asObject(profile.identity);
  if (firstText(identity.headline, identity.profession, identity.about, profile.about)) {
    append({
      id: 'profile:identity',
      type: 'profile_fact',
      label: firstText(identity.headline, identity.profession, identity.fullName),
      summary: compactStrings([
        identity.about,
        profile.about,
        identity.profession,
        ...asArray(identity.specialties),
        ...asArray(identity.serviceAreas),
        ...asArray(identity.credentials),
        identity.availability
      ]).join('; '),
      confidence: 'high'
    });
  }
  for (const [index, focus] of firstArray(profile.currentFocus).entries()) {
    const value = asObject(focus);
    append({
      ...value,
      summary: compactStrings([
        value.description,
        ...asArray(value.evidence)
      ]).join('; '),
      sourceId: firstText(...asArray(value.sourceIds))
    }, 'current_focus', `profile:focus:${index + 1}`);
  }
  for (const [index, experience] of firstArray(profile.experience).slice(0, 12).entries()) {
    const value = asObject(experience);
    append({
      ...value,
      label: compactStrings([value.role, value.company]).join(' at '),
      summary: compactStrings([
        value.description,
        value.summary,
        ...asArray(value.highlights)
      ]).join('; '),
      sourceId: firstText(...asArray(value.sourceIds))
    }, 'experience', `profile:experience:${firstText(value.id, String(index + 1))}`);
  }
  for (const [index, project] of firstArray(profile.projects).slice(0, 12).entries()) {
    const value = asObject(project);
    append({
      ...value,
      summary: compactStrings([
        value.description,
        ...asArray(value.highlights)
      ]).join('; '),
      sourceId: firstText(...asArray(value.sourceIds))
    }, 'project', `profile:project:${firstText(value.id, String(index + 1))}`);
  }
  const skills = firstArray(profile.skills)
    .map((item) => typeof item === 'string' ? item.trim() : firstText(asObject(item).name, asObject(item).label))
    .filter(Boolean)
    .slice(0, 30);
  if (skills.length > 0) {
    append({
      id: 'profile:skills',
      type: 'profile_fact',
      label: 'Professional skills',
      summary: skills.join(', '),
      confidence: 'high'
    });
  }
  for (const [index, publication] of firstArray(profile.publications).slice(0, 12).entries()) {
    append(publication, 'publication', `profile:publication:${firstText(asObject(publication).id, String(index + 1))}`);
  }
  for (const [index, education] of firstArray(profile.education).slice(0, 8).entries()) {
    const value = asObject(education);
    append({
      ...value,
      label: compactStrings([value.degree, value.fieldOfStudy, value.school]).join(' — '),
      summary: firstText(value.program)
    }, 'education', `profile:education:${firstText(value.id, String(index + 1))}`);
  }
  for (const source of sources.slice(0, 32)) {
    const value = asObject(source);
    const sourceID = firstText(value.id, value.sourceId);
    if (!sourceID ||
        !approvedSourceIDs.has(sourceID) ||
        !persistedEvidenceSourceIDs.has(sourceID)) {
      continue;
    }
    append({
      ...value,
      id: sourceID ? `source:${sourceID}` : '',
      type: firstText(value.kind, 'approved_source'),
      label: firstText(value.label, value.title, value.url),
      summary: firstText(value.summary, value.description),
      confidence: firstText(value.trustLevel, value.confidence)
    }, 'approved_source');
  }
  // A source may retain many crawl observations for the same page. Collapse
  // those revisions before applying the bounded prompt catalog so repeated
  // old observations cannot crowd a newer owner offer page out of the model's
  // evidence. Canonicalization treats only the conventional www/no-www host
  // aliases as the same host; it does not merge arbitrary subdomains.
  for (const evidence of dedupeSourceEvidenceByCanonicalPage(sourceEvidence)) {
    const value = asObject(evidence);
    const sourceID = firstText(value.sourceId, value.sourceID);
    if (!sourceID || !approvedSourceIDs.has(sourceID)) continue;
    const approvedSource = asObject(approvedSourcesByID.get(sourceID));
    append({
      ...value,
      id: firstText(
        value.evidenceRef,
        value.observationId ? `observation:${value.observationId}` : '',
        value.factId ? `fact:${value.factId}` : ''
      ),
      type: firstText(value.kind, 'source_evidence'),
      label: firstText(value.title, value.sourceLabel, value.label),
      summary: firstText(value.summary, value.description)
    }, 'source_evidence', undefined, {
      approvedSourceObservation: true,
      approvedSourceUrl: approvedSource.url,
      approvedSourceLabel: approvedSource.label,
      profileControlledSource: approvedSource.profileControlled === true
    });
  }
  for (const extract of sourceExtracts.slice(0, 24)) {
    const sourceID = firstText(asObject(extract).sourceId, asObject(extract).sourceID);
    if (!sourceID || !approvedSourceIDs.has(sourceID)) continue;
    append(extract, 'source_extract');
  }
  for (const fact of explicitFacts.slice(0, 32)) {
    append(fact, 'explicit_fact');
  }
  for (const post of recentPosts.slice(0, 12)) {
    const value = asObject(post);
    append({
      ...value,
      id: firstText(value.id ? `timeline:${value.id}` : '', value.evidenceRef),
      type: 'source_backed_timeline',
      label: firstText(value.topic, value.title),
      summary: firstText(value.summary, value.body)
    }, 'source_backed_timeline');
  }

  const candidateEvidencePriority = prioritizedCandidateEvidenceRefs(
    collectStructuredCandidates(
      payload,
      context,
      firstText(payload.profileScribePublicBaseURL, payload.publicBaseUrl)
    ),
    catalog
  );
  const catalogByID = evidenceIndex(catalog);
  const ownerControlledPaidAssetIDs = new Set(
    catalog
      .filter((evidence) =>
        approvedOwnedAssetEvidence(evidence, catalogByID) &&
        inboundAssetEvidenceSupportsPaidConversion(
          evidence,
          referenceTime
        )
      )
      .map((evidence) => evidence.id)
  );
  const informationalEvidenceIDs = new Set(
    catalog
      .filter((evidence) => informationalAssetEvidence(evidence))
      .map((evidence) => evidence.id)
  );
  return catalog
    .sort((left, right) => {
      const leftPriority = candidateEvidencePriority.get(left.id);
      const rightPriority = candidateEvidencePriority.get(right.id);
      if (leftPriority !== undefined || rightPriority !== undefined) {
        if (leftPriority === undefined) return 1;
        if (rightPriority === undefined) return -1;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      }
      const leftPaidAsset =
        ownerControlledPaidAssetIDs.has(left.id) ? 1 : 0;
      const rightPaidAsset =
        ownerControlledPaidAssetIDs.has(right.id) ? 1 : 0;
      if (leftPaidAsset !== rightPaidAsset) {
        return rightPaidAsset - leftPaidAsset;
      }
      return evidenceQuality(right) - evidenceQuality(left) || left.id.localeCompare(right.id);
    })
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map((evidence) => compact({
      ...evidence,
      revenueAssetRole: ownerControlledPaidAssetIDs.has(evidence.id)
        ? 'current_owner_paid_conversion_asset'
        : informationalEvidenceIDs.has(evidence.id)
          ? 'informational_only'
          : undefined
    }));
}

export function expandAndJudge({
  objective,
  constraints,
  evidenceCatalog,
  priorOutcomes,
  seedSet,
  weights,
  budget,
  timestamp
}) {
  const dimensionValues = DIMENSIONS.map(([name]) => seedSet[name]);
  const theoreticalCount = dimensionValues.reduce((total, items) => total * items.length, 1);
  const expandedCount = Math.min(theoreticalCount, budget.maxHypotheses);
  const priorityIndexes = strategyFamilyPriorityIndexes(
    dimensionValues,
    seedSet
  );
  const indexes = prioritizedCartesianIndexes(
    theoreticalCount,
    expandedCount,
    stableHash({ objective, evidence: evidenceCatalog.map((item) => item.id) }),
    priorityIndexes
  );
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const eligible = [];
  let filteredCount = 0;
  let incompatibleCount = 0;
  let motionConflictCount = 0;
  const motionConflictDimensions = emptyMotionConflictDimensions();
  let revenueRejectedCount = 0;
  const revenueRejectionReasons = {};

  for (const flatIndex of indexes) {
    const selected = decodeCartesianIndex(flatIndex, dimensionValues);
    const tuple = Object.fromEntries(
      DIMENSIONS.map(([name], index) => [name, selected[index]])
    );
    const compatibleFamilies = commonCompatibilityFamilies(tuple, seedSet);
    if (compatibleFamilies.length === 0) {
      incompatibleCount += 1;
      filteredCount += 1;
      continue;
    }
    const motionSignature = strategyMotionSignature(tuple);
    if (!motionSignature.coherent) {
      motionConflictCount += 1;
      for (const dimension of motionSignature.conflictDimensions) {
        motionConflictDimensions[dimension] += 1;
      }
      filteredCount += 1;
      continue;
    }
    if (timingEvidenceConflictsWithStrategyMotion(
      tuple,
      motionSignature,
      evidenceByID
    )) {
      motionConflictCount += 1;
      motionConflictDimensions.timingTrigger += 1;
      filteredCount += 1;
      continue;
    }
    const revenueValidation = validateRevenuePath(
      tuple,
      evidenceByID,
      timestamp
    );
    if (!revenueValidation.valid) {
      revenueRejectedCount += 1;
      for (const reason of revenueValidation.reasons) {
        revenueRejectionReasons[reason] =
          (revenueRejectionReasons[reason] || 0) + 1;
      }
      filteredCount += 1;
      continue;
    }
    if (!tupleAllowed(tuple, constraints)) {
      filteredCount += 1;
      continue;
    }
    const evidenceRefs = compactStrings(
      selected.flatMap((item) => item.evidenceRefs)
    ).filter((id) => evidenceByID.has(id));
    if (evidenceRefs.length === 0 ||
        tuple.offers.evidenceRefs.length === 0 ||
        tuple.proofPoints.evidenceRefs.length === 0) {
      filteredCount += 1;
      continue;
    }

    const score = scoreHypothesis({
      objective,
      tuple,
      evidenceRefs,
      evidenceByID,
      priorOutcomes,
      weights
    });
    if (score.total < budget.minimumScore) {
      filteredCount += 1;
      continue;
    }
    const id = `hyp-${stableHash(
      DIMENSIONS.map(([name]) => tuple[name].id).join('|')
    ).slice(0, 24)}`;
    const estimatedSpendMicros = sumFinite(
      selected.map((item) => item.estimatedSpendMicros)
    );
    const expectedValueMicros =
      tuple.revenuePaths.expectedValueMicros;
    eligible.push(compact({
      id,
      offer: tuple.offers.label,
      buyerSegment: tuple.buyerSegments.label,
      channel: tuple.channels.label,
      action: tuple.actions.label,
      timingTrigger: tuple.timingTriggers.label,
      proofPoint: tuple.proofPoints.label,
      followUp: tuple.followUps.label,
      revenuePath: revenueValidation.revenuePath,
      evidenceRefs,
      score,
      status: 'eligible',
      judgeReason: hypothesisJudgeReason(tuple, score),
      estimatedSpendMicros: estimatedSpendMicros > 0 ? Math.round(estimatedSpendMicros) : undefined,
      expectedValueMicros: Math.round(expectedValueMicros),
      _tuple: tuple,
      _strategyFamily: compatibleFamilies[0],
      provenance: strategyProvenance(
        tuple,
        compatibleFamilies[0],
        seedSet,
        evidenceByID,
        motionSignature
      )
    }));
  }

  const finalists = diverseFinalists(eligible, budget.maxFinalists)
    .map((hypothesis, index) => ({
      ...hypothesis,
      rank: index + 1,
      status: index === 0 ? 'winner' : index === 1 ? 'runner_up' : 'finalist'
    }));
  return {
    theoreticalCount,
    expandedCount,
    eligibleCount: eligible.length,
    filteredCount,
    incompatibleCount,
    motionConflictCount,
    motionConflictDimensions,
    revenueRejectedCount,
    revenueRejectionReasons: Object.fromEntries(
      Object.entries(revenueRejectionReasons).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
    finalists,
    weights
  };
}

function normalizeObjective(value, payload) {
  const raw = typeof value === 'string' ? { outcome: value } : asObject(value);
  const deadline = firstText(raw.deadline, payload.deadline);
  return compact({
    id: firstText(raw.id, payload.objectiveId),
    outcome: firstText(
      raw.outcome,
      raw.desiredOutcome,
      raw.primaryOutcome,
      raw.description,
      payload.outcome
    ),
    successMetric: firstText(
      raw.successMetric,
      raw.successDefinition,
      raw.successCondition,
      payload.successMetric
    ),
    targetCount: positiveInteger(raw.targetCount) || 1,
    deadline: validISOString(deadline),
    estimatedValueMicros: nonNegativeInteger(
      raw.estimatedValueMicros ?? payload.estimatedValueMicros
    ),
    currency: firstText(raw.currency, 'USD'),
    allowedChannels: compactStrings(raw.allowedChannels),
    allowedActions: compactStrings(raw.allowedActions),
    constraints: compactStrings(raw.constraints),
    evidenceRefs: compactStrings(raw.evidenceRefs)
  });
}

function normalizeBudget(value) {
  const raw = asObject(value);
  const maxSpendMicros = positiveInteger(raw.maxSpendMicros) || 1_000_000;
  const configuredLLMMicros = positiveInteger(
    raw.maxLLMSpendMicros ??
    raw.maxLlmSpendMicros ??
    (Number(raw.maxLLMCostUsd ?? raw.maxLlmCostUsd) * 1_000_000)
  );
  const maxLLMSpendMicros = Math.min(
    maxSpendMicros,
    configuredLLMMicros || Math.min(maxSpendMicros, 400_000)
  );
  const requestedProviderPrice = asObject(
    raw.providerMaxPrice ?? raw.provider_max_price
  );
  return {
    currency: firstText(raw.currency, 'USD'),
    maxSpendMicros,
    maxLLMSpendMicros,
    providerMaxPrice: {
      prompt: tightenedPriceCap(
        requestedProviderPrice.prompt ?? raw.maxProviderPromptPricePerMillionUsd,
        MAX_PROVIDER_PRICE.prompt
      ),
      completion: tightenedPriceCap(
        requestedProviderPrice.completion ?? raw.maxProviderCompletionPricePerMillionUsd,
        MAX_PROVIDER_PRICE.completion
      ),
      request: Math.min(
        tightenedPriceCap(
          requestedProviderPrice.request ?? raw.maxProviderRequestPriceUsd,
          MAX_PROVIDER_PRICE.request
        ),
        maxLLMSpendMicros / 1_000_000
      )
    },
    maxHypotheses: clampInteger(raw.maxHypotheses, 1, MAX_HYPOTHESES, MAX_HYPOTHESES),
    maxFinalists: clampInteger(raw.maxFinalists, 2, MAX_FINALISTS, MAX_FINALISTS),
    // One initial structured generation plus, when the caller explicitly
    // budgets it, one bounded shape-repair call. The default remains one so
    // existing callers cannot incur a second request implicitly.
    maxLLMCalls: clampInteger(raw.maxLLMCalls, 0, 2, 1),
    maxOutputTokens: clampInteger(raw.maxOutputTokens, 600, 10_000, 8_000),
    minimumScore: clampNumber(raw.minimumScore, 0.2, 0.9, 0.42),
    hardStop: raw.hardStop !== false
  };
}

function normalizeConstraints(objective, payload) {
  const raw = asObject(payload.constraints);
  return {
    researchOnly: payload.researchOnly !== false,
    requiresReview: true,
    allowedChannels: compactStrings([
      ...asArray(objective.allowedChannels),
      ...asArray(raw.allowedChannels)
    ]),
    allowedActions: compactStrings([
      ...asArray(objective.allowedActions),
      ...asArray(raw.allowedActions)
    ]),
    prohibitedActions: compactStrings([
      ...asArray(raw.prohibitedActions),
      ...asArray(raw.blockedActions),
      ...asArray(objective.constraints)
        .filter((item) => /\b(do not|never|prohibit|without approval)\b/i.test(item))
    ]),
    rules: compactStrings([
      RESEARCH_ONLY_CONSTRAINT,
      ...asArray(objective.constraints),
      ...asArray(raw.rules)
    ])
  };
}

function objectiveValidationIssue(objective) {
  if (!firstText(objective.outcome)) {
    return {
      summary: 'A concrete win outcome is required before running an opportunity tournament.',
      question: 'What single external professional outcome should this tournament optimize for?'
    };
  }
  if (!firstText(objective.successMetric)) {
    return {
      summary: 'A verifiable success metric is required before running an opportunity tournament.',
      question: 'What observable event would prove that this opportunity produced a real win?'
    };
  }
  return null;
}

function compactPromptEvidenceCatalog(value) {
  return asArray(value)
    .slice(0, MAX_PROMPT_EVIDENCE_ITEMS)
    .map((itemValue) => {
      const item = asObject(itemValue);
      return compact({
        id: firstText(item.id),
        type: firstText(item.type),
        label: firstText(item.label),
        summary: firstText(item.summary),
        url: firstText(item.url),
        sourceId: firstText(item.sourceId),
        observedAt: firstText(item.observedAt),
        publishedAt: firstText(item.publishedAt),
        startDate: firstText(item.startDate),
        endDate: firstText(item.endDate),
        current: typeof item.current === 'boolean'
          ? item.current
          : undefined,
        status: firstText(item.status),
        approvedSourceObservation:
          item.approvedSourceObservation === true ? true : undefined,
        profileControlledSource:
          item.profileControlledSource === true ? true : undefined,
        revenueAssetRole: firstText(item.revenueAssetRole)
      });
    });
}

function seedAndJudgePrompt({
  objective,
  constraints,
  evidenceCatalog,
  priorOutcomes,
  maxSeedsPerDimension
}) {
  const system = `You are ProfileScribe's research-only opportunity strategist and semantic judge.
Generate compact incremental-income strategy dimensions grounded only in the supplied professional evidence.
Internally compare multiple plausible evidence-grounded acquisition-to-payment paths, then emit only the strongest two coherent families. Do not expose private analysis or intermediate alternatives.
This is internal hypothesis exploration, not outreach, publishable copy, or permission to act.
Never invent accomplishments, customers, affiliations, contact details, market demand, intent, urgency, or relationships.
Treat experience with a past endDate as historical proof, never as a current role or affiliation.
Do not recommend applying for, enrolling in, or creating a capability when the evidence says that capability already exists. Treat the existing capability as proof or supporting context for a paid acquisition/conversion path. Any verification of that capability belongs only in supportingBottleneck and must never be the primary action.
Use only exact evidence IDs from evidenceCatalog. Unknown evidence IDs will be discarded.
Treat evidenceCatalog.revenueAssetRole as a deterministic eligibility signal. A current_owner_paid_conversion_asset is a current owner-controlled paid or reimbursable offer destination and must be preferred over adjacent articles or other informational evidence. informational_only evidence may support expertise but must never ground a paid offer, conversion destination, paid conversion, or evidenceExperiment asset.
You may extract up to eight compact named person or organization candidates only when each exact name appears verbatim in cited evidence. Do not return contact details or URLs; return no candidate rather than infer or complete an identity.
When an exact named organization is the intended target buyer, begin the buyerSegments label with that exact evidence-backed name and return the same organization in candidates.
Keep every strategy family coherent end to end. Its family m is one acquisition mode, and its buyer, offer, channel, action, timing trigger, proof point, follow-up, and revenue path must all belong to that same acquisition-to-payment route.
Every family must trace one actual buyer and explicitly paid offer through inbound, warm, existing-customer, partner, or otherwise permissioned acquisition to an observable paid conversion and durable attribution record. A conversation, inquiry, eligibility check, scheduled consultation, profile change, post, impression, workflow improvement, or completed research task is not incremental income.
Operations, administration, visibility, content, research, and workflow improvements may appear only as auxiliary supportingBottleneck context. The singular action must itself advance permissioned acquisition or paid conversion, align with revenuePath.conversionAction, and must never merely perform the supporting bottleneck.
For inbound acquisition, name one explicit discovery or demand origin such as organic/local search, an app store, a comparison/search listing, an owned opted-in audience, earned media/directory discovery, a marketplace, a community, social distribution, platform discovery, or agent-mediated discovery, and separately name the offer, pricing, signup, demo, application, licensing, sponsorship-inquiry, storefront, product, service, landing, booking, download, marketplace-listing, or checkout destination. A destination by itself is not an acquisition channel.
Construct each family's revenuePath first. Then derive that family's paid offer, buyer, channel, action, timing, proof, and follow-up items from the same revenue path.
For every revenue path, explicitly bind the buyer, paid offer, acquisition mechanism, conversion destination, paid conversion, and attribution signal to the exact approved evidence records that support each element. If approved evidence does not support one element, do not disguise the gap by attaching an unrelated evidence ID.
Return exactly two complete top-level family bundles named familyA and familyB. Family A is the strongest grounded path; family B is the strongest coherent alternative. They may use distinct tactics within the same business motion when the evidence does not support two different motions.
Prefer an inbound paid-conversion path for familyA when approved evidence can ground it. Use warm referral, partner channel, existing-customer, or permissioned-outreach paths when inbound is ungrounded or semantically weaker; never invent inbound demand or an inbound asset.
Within each family bundle, return exactly one family-specific paid offer, buyer segment, channel, action, timing trigger, proof point, follow-up, and revenue path. Never return global dimension arrays or cross-family compatibility tags.
Also return one evidenceExperiment as a fallback for human review. It must name a known fact or owned asset from the evidence, one buyer, one paid offer, one singular acquisition mechanism that is not the conversion destination, one paid conversion, one durable attribution signal, and a numeric time and sample stop. Write its title, action, and success signal for the profile owner, never as internal source-approval or observation-processing instructions. The experiment is only a recommendation; do not claim it was launched.
When any current_owner_paid_conversion_asset exists, the evidenceExperiment must cite the strongest relevant one and must test the missing acquisition or attribution evidence around that existing offer. Never ask the owner to attach, approve, create, or document another paid-offer page in that case.
Return no email, direct message, post, pitch, sales script, or other outreach copy.
Reject spray-and-pray, bulk outreach, scraping, automated form submission, or high-volume behavior.
Each seed should be a short structured concept. Family score and judge-weight values are semantic judgments from 0 to 1; positive scores are better while effort, cost, risk, and uncertainty are burdens. Deterministic application code owns final validation and ranking.
Return only JSON.`;
  const user = JSON.stringify({
    task: 'Return two grounded revenue strategy families and one review-first fallback experiment.',
    objective,
    constraints,
    evidenceCatalog,
    priorOutcomes,
    outputContract: compactTournamentOutputContract(
      INITIAL_FAMILY_VARIANT_COUNT,
      maxSeedsPerDimension
    ),
    hardRules: compactTournamentHardRules()
  });
  return { system, user };
}

function compactTournamentOutputContract(
  variantCount,
  maxSeedsPerDimension = variantCount * 2
) {
  return {
    seedContract: SEED_CONTRACT_VERSION,
    familyKeys: 'familyA and familyB each use {l,m,e,s,d}',
    familyMode: [...ACQUISITION_MODES],
    familyScores:
      's uses of,es,ba,ti,wp,re,ev,ef,co,ri,un; every value is 0..1',
    dimensions:
      `d uses only {r,o,b,c,a,t,p,f}: r=1 revenue path; ` +
      `o,b,c,a,f=${variantCount} each; t,p=1 each; across both ` +
      `families no multi-variant dimension exceeds ${maxSeedsPerDimension}`,
    item: '{l,e}; timing t item is {l,e,q}; e contains exact evidence IDs',
    revenuePath:
      '{l,e,v,rm,io,a,c,o,atm,ats,g:{b,o,a,d:{l,e},c,t},sb,vm}; ' +
      `v=${REVENUE_PATH_CONTRACT_VERSION}; rm is a revenue mechanism; ` +
      'io is incremental paid outcome; a is acquisition mode; c is conversion action; ' +
      'o is observable paid outcome; atm is attribution method; ats is attribution record; ' +
      'g binds buyer/offer/acquisition/destination/conversion/attribution evidence; ' +
      'sb is optional support only; vm is positive expected gross-income micros',
    revenueMechanisms: [...REVENUE_MECHANISMS],
    attributionMethods: [...ATTRIBUTION_METHODS],
    evidenceExperiment:
      '{l,k,b,o,a,d,c,t,x,s,days,n,u,e}: title, known fact, buyer, paid offer, ' +
      'acquisition, distinct destination, paid conversion, attribution record, review-first action, ' +
      'success signal, 7..30 days, 5..100 sample stop, sample unit, evidence IDs',
    candidates:
      'candidates uses zero to eight {k,l,o,r,m,e} exact named people/organizations only',
    weights: 'w uses the same eleven score keys',
    compactness:
      'Use the exact short keys above, concise strings, at most 2 evidence IDs per item, and no prose outside JSON.'
  };
}

function compactTournamentHardRules() {
  return [
    'Return exactly two coherent families; construct each r path first, use one acquisition mode end to end, and derive every other item from it.',
    'Use only evidenceCatalog IDs. Family e contains every ID cited by its items. Each item cites only IDs in its own family, and each family includes an approved observation:* anchor.',
    'Ground the buyer, current paid offer, acquisition, distinct destination, paid conversion, and attribution record; never invent demand or an outside target.',
    'Inbound names discovery separately from destination. Operations, research, scheduling, content, and verification may appear only in sb, never as the revenue action.',
    'r.ats names its booking/payment/invoice/contract/order/claim/CRM/referral record and source/referral/UTM/campaign/channel field.',
    'Timing q copies an exact phrase from a cited observation. If urgency is not observed, t.l begins Determine and includes that exact phrase; never invent urgency.',
    'The fallback experiment uses a current owner paid asset when present, is singular and bounded, and performs no external action.',
    'Candidate names are copied exactly from cited evidence; otherwise return [].',
    'Return no outreach copy, publishing, ads, form submission, scraping, bulk contact, provider write, or prose outside the JSON.',
    'Silently audit the strict JSON once, then return it immediately without explanation or repeated alternatives.'
  ];
}

function seedAndJudgeRepairPrompt({
  originalPrompt,
  issue
}) {
  let originalTask = {};
  try {
    originalTask = JSON.parse(firstText(originalPrompt?.user));
  } catch {
    originalTask = {};
  }
  const system = `You are ProfileScribe's bounded structured-output repair strategist.
Generate a fresh compact replacement from the supplied objective and evidence. Do not reconstruct, quote, or continue the prior response.
Return exactly two complete source-grounded incremental-income families plus one review-first evidence experiment. This is research only: no outreach, publishing, advertising, form submission, or provider write.
Use exact evidence IDs only. Prefer current_owner_paid_conversion_asset for an inbound paid offer/destination; informational_only is never an offer anchor.
An acquisition mechanism is distinct from its conversion destination. A valid path ends in a durable paid event with an attribution record.
Return only the strict compact JSON once.`;
  const user = JSON.stringify({
    task:
      'Freshly regenerate two compact complete comparison families; do not continue prior output.',
    objective: originalTask.objective,
    constraints: originalTask.constraints,
    evidenceCatalog: originalTask.evidenceCatalog,
    priorOutcomes: originalTask.priorOutcomes,
    repairIssue: issue,
    outputContract: compactTournamentOutputContract(
      REPAIR_FAMILY_VARIANT_COUNT
    ),
    hardRules: compactTournamentHardRules()
  });
  return { system, user };
}

function openRouterDiagnosticsIndicateTruncation(value) {
  const diagnostics = asObject(value);
  const reason = `${firstText(diagnostics.finishReason)} ${
    firstText(diagnostics.nativeFinishReason)
  }`.toLowerCase();
  return /\b(?:length|max(?:imum)?[_ -]?(?:tokens?|output)|token[_ -]?limit)\b/.test(
    reason
  );
}

function structuredOutputLengthIssue(value) {
  const diagnostics = asObject(value);
  return {
    code: 'output_length_truncated',
    finishReason: truncate(firstText(diagnostics.finishReason), 64),
    nativeFinishReason: truncate(
      firstText(diagnostics.nativeFinishReason),
      64
    )
  };
}

function structuredSeedSetShapeIssue(seedSetValue) {
  const seedSet = asObject(seedSetValue);
  if (seedSet.seedContract === 'invalid') {
    return {
      code: 'unsupported_seed_contract',
      seedContract: firstText(seedSet.seedContract)
    };
  }
  const missingDimensions = DIMENSIONS
    .map(([name]) => name)
    .filter((name) => asArray(seedSet[name]).length === 0);
  if (missingDimensions.length > 0) {
    const onlyUnsafeTimingWasRemoved =
      missingDimensions.length === 1 &&
      missingDimensions[0] === 'timingTriggers' &&
      (nonNegativeInteger(seedSet.unsupportedTimingSeedCount) || 0) > 0 &&
      (nonNegativeInteger(seedSet.completeStrategyFamilyCount) || 0) === 0;
    if (onlyUnsafeTimingWasRemoved) {
      return null;
    }
    return {
      code: 'missing_grounded_dimensions',
      missingDimensions,
      completeStrategyFamilyCount:
        nonNegativeInteger(seedSet.completeStrategyFamilyCount) || 0,
      familyCoverage: seedSet.strategyFamilyAnchorCoverage
    };
  }
  if ((nonNegativeInteger(seedSet.completeStrategyFamilyCount) || 0) < 2) {
    return {
      code: 'incomplete_strategy_families',
      completeStrategyFamilyCount:
        nonNegativeInteger(seedSet.completeStrategyFamilyCount) || 0,
      incompleteStrategyFamilyCount:
        nonNegativeInteger(seedSet.incompleteStrategyFamilyCount) || 0,
      familyCoverage: seedSet.strategyFamilyAnchorCoverage
    };
  }
  return null;
}

function seedSetShapeSearchTrace(seedSetValue) {
  const seedSet = asObject(seedSetValue);
  return {
    dimensionCounts: dimensionCounts(seedSet),
    seedContract: firstText(seedSet.seedContract),
    declaredStrategyFamilyCount:
      nonNegativeInteger(seedSet.declaredStrategyFamilyCount) || 0,
    familyWrapperCount:
      nonNegativeInteger(seedSet.familyWrapperCount) || 0,
    validStrategyFamilyCount:
      nonNegativeInteger(seedSet.validStrategyFamilyCount) || 0,
    strategyFamilyCount: asArray(seedSet.strategyFamilies).length,
    completeStrategyFamilyCount:
      nonNegativeInteger(seedSet.completeStrategyFamilyCount) || 0,
    incompleteStrategyFamilyCount:
      nonNegativeInteger(seedSet.incompleteStrategyFamilyCount) || 0,
    strategyFamilyAnchorCoverage:
      asArray(seedSet.strategyFamilyAnchorCoverage),
    strategyFamilyCollisionCount:
      nonNegativeInteger(seedSet.strategyFamilyCollisionCount) || 0,
    familyEvidenceMismatchSeedCount:
      nonNegativeInteger(seedSet.familyEvidenceMismatchSeedCount) || 0,
    invalidFamilySeedCount:
      nonNegativeInteger(seedSet.invalidFamilySeedCount) || 0,
    unsupportedTimingSeedCount:
      nonNegativeInteger(seedSet.unsupportedTimingSeedCount) || 0,
    timingVerificationRepairCount:
      nonNegativeInteger(seedSet.timingVerificationRepairCount) || 0
  };
}

function remainingRepairSpendMicros(
  budgetValue,
  usageValue,
  completedRequests = []
) {
  const budget = asObject(budgetValue);
  const usage = asObject(usageValue);
  const reported = nonNegativeInteger(usage.reportedCostMicros) || 0;
  const requests = asArray(completedRequests);
  const conservativeCallCeiling = requests.length > 0
    ? requests.reduce(
        (total, request) =>
          total + providerCallSpendCeilingMicros(request, budget),
        0
      )
    : nonNegativeInteger(budget.maxLLMSpendMicros) || 0;
  const accountedSpend = usage.costReporting === 'complete'
    ? reported
    : Math.max(reported, conservativeCallCeiling);
  return Math.max(
    0,
    (nonNegativeInteger(budget.maxLLMSpendMicros) || 0) -
      accountedSpend
  );
}

function providerCallSpendPreflight(requestValue, budgetValue) {
  const request = asObject(requestValue);
  const budget = asObject(budgetValue);
  const provider = asObject(request.provider);
  const configuredPrice = asObject(budget.providerMaxPrice);
  const requestPrice = asObject(provider.max_price);
  const price = {
    prompt: nonNegativeNumber(
      requestPrice.prompt ?? configuredPrice.prompt
    ),
    completion: nonNegativeNumber(
      requestPrice.completion ?? configuredPrice.completion
    ),
    request: nonNegativeNumber(
      requestPrice.request ?? configuredPrice.request
    )
  };
  const maxLLMSpendMicros =
    nonNegativeInteger(budget.maxLLMSpendMicros) || 0;
  let serializedRequest;
  let requestByteCount;
  try {
    serializedRequest = serializeOpenRouterJSONRequestBody(request);
    requestByteCount = Buffer.byteLength(serializedRequest, 'utf8');
  } catch {
    return {
      serializationSucceeded: false,
      requestBodyByteCount: 0,
      promptTokenCeiling: 0,
      outputTokenCeiling: nonNegativeInteger(request.maxTokens) || 0,
      fixedRequestFeeCeilingMicros: Math.ceil(
        price.request * 1_000_000
      ),
      callSpendCeilingMicros: maxLLMSpendMicros + 1
    };
  }
  // GPT tokenization cannot emit more text/schema tokens than the UTF-8 bytes
  // supplied. The fixed reserve covers chat/schema framing not represented by
  // user-visible strings. Price-per-million USD multiplied by tokens is the
  // same numeric unit as micro-USD.
  const promptTokenCeiling =
    requestByteCount + OPENAI_PROMPT_FRAMING_TOKEN_RESERVE;
  const outputTokenCeiling =
    nonNegativeInteger(request.maxTokens) || 0;
  const fixedRequestFeeCeilingMicros = Math.ceil(
    price.request * 1_000_000
  );
  return {
    serializationSucceeded: true,
    requestBodyByteCount: requestByteCount,
    promptTokenCeiling,
    outputTokenCeiling,
    fixedRequestFeeCeilingMicros,
    callSpendCeilingMicros:
      Math.ceil(promptTokenCeiling * price.prompt) +
      Math.ceil(outputTokenCeiling * price.completion) +
      fixedRequestFeeCeilingMicros
  };
}

export function providerCallSpendCeilingMicros(
  requestValue,
  budgetValue
) {
  return providerCallSpendPreflight(
    requestValue,
    budgetValue
  ).callSpendCeilingMicros;
}

function providerPromptTokenCanary(preflightValue, usageValue) {
  const preflight = asObject(preflightValue);
  const usage = normalizeUsage(usageValue);
  const reportedPromptTokens = nonNegativeInteger(
    usage.prompt_tokens ?? usage.promptTokens
  );
  const promptTokenCeiling = nonNegativeInteger(
    preflight.promptTokenCeiling
  ) || 0;
  return compact({
    requestBodyByteCount:
      nonNegativeInteger(preflight.requestBodyByteCount) || 0,
    framingTokenReserve: OPENAI_PROMPT_FRAMING_TOKEN_RESERVE,
    promptTokenCeiling,
    reportedPromptTokens,
    withinCeiling: reportedPromptTokens === undefined
      ? undefined
      : reportedPromptTokens <= promptTokenCeiling
  });
}

function tournamentStructuredResponseFormat(
  evidenceCatalog,
  familyVariantCount = INITIAL_FAMILY_VARIANT_COUNT
) {
  // Keep the provider grammar deliberately structural. Exact evidence IDs
  // remain enumerated, while paid/acquisition language, current-offer status,
  // attribution semantics, grounding containment, and numeric bounds are all
  // revalidated below against the full approved evidence catalog. Encoding
  // those semantic gates again as large regexes and repeated descriptions
  // expands the constrained grammar without strengthening the local trust
  // boundary.
  const evidenceIDs = compactStrings(
    asArray(evidenceCatalog).map((item) => asObject(item).id)
  )
    .filter((id) => !/^source:/i.test(id))
    .slice(0, MAX_EVIDENCE_ITEMS);
  const evidenceRef = {
    type: 'string',
    ...(evidenceIDs.length > 0
      ? { enum: evidenceIDs }
      : {})
  };
  const evidenceRefs = {
    type: 'array',
    items: { $ref: '#/$defs/evidenceRef' },
    minItems: 1,
    maxItems: 12
  };
  const compactEvidenceRefs = {
    type: 'array',
    items: { $ref: '#/$defs/evidenceRef' },
    minItems: 1,
    maxItems: 2
  };
  const scoreProperties = Object.fromEntries([
    'of',
    'es',
    'ba',
    'ti',
    'wp',
    're',
    'ev',
    'ef',
    'co',
    'ri',
    'un'
  ].map((key) => [
    key,
    { type: 'number' }
  ]));
  const scores = {
    type: 'object',
    properties: scoreProperties,
    required: Object.keys(scoreProperties),
    additionalProperties: false
  };
  const item = (timing = false) => {
    const properties = {
      l: { type: 'string' },
      e: { $ref: '#/$defs/compactEvidenceRefs' },
      ...(timing
        ? {
            q: { type: 'string' }
          }
        : {})
    };
    return {
      type: 'object',
      properties,
      required: Object.keys(properties),
      additionalProperties: false
    };
  };
  const exactItems = (ref, count) => ({
    type: 'array',
    items: { $ref: ref },
    minItems: count,
    maxItems: count
  });
  const grounding = {
    type: 'object',
    properties: {
      b: { $ref: '#/$defs/compactEvidenceRefs' },
      o: { $ref: '#/$defs/compactEvidenceRefs' },
      a: { $ref: '#/$defs/compactEvidenceRefs' },
      d: {
        type: 'object',
        properties: {
          l: { type: 'string' },
          e: { $ref: '#/$defs/compactEvidenceRefs' }
        },
        required: ['l', 'e'],
        additionalProperties: false
      },
      c: { $ref: '#/$defs/compactEvidenceRefs' },
      t: { $ref: '#/$defs/compactEvidenceRefs' }
    },
    required: ['b', 'o', 'a', 'd', 'c', 't'],
    additionalProperties: false
  };
  const evidenceExperiment = {
    type: 'object',
    properties: {
      l: { type: 'string' },
      k: { type: 'string' },
      b: { type: 'string' },
      o: { type: 'string' },
      a: { type: 'string' },
      d: { type: 'string' },
      c: { type: 'string' },
      t: { type: 'string' },
      x: { type: 'string' },
      s: { type: 'string' },
      days: { type: 'integer' },
      n: { type: 'integer' },
      u: { type: 'string' },
      e: { $ref: '#/$defs/compactEvidenceRefs' }
    },
    required: [
      'l',
      'k',
      'b',
      'o',
      'a',
      'd',
      'c',
      't',
      'x',
      's',
      'days',
      'n',
      'u',
      'e'
    ],
    additionalProperties: false
  };
  const family = () => ({
    type: 'object',
    properties: {
      l: { type: 'string' },
      m: {
        type: 'string',
        enum: [...ACQUISITION_MODES]
      },
      e: { $ref: '#/$defs/evidenceRefs' },
      s: { $ref: '#/$defs/scores' },
      d: {
        type: 'object',
        properties: {
          r: exactItems('#/$defs/revenuePath', 1),
          o: exactItems('#/$defs/offerItem', familyVariantCount),
          b: exactItems('#/$defs/buyerItem', familyVariantCount),
          c: exactItems('#/$defs/channelItem', familyVariantCount),
          a: exactItems('#/$defs/actionItem', familyVariantCount),
          t: exactItems('#/$defs/timingItem', 1),
          p: exactItems('#/$defs/proofItem', 1),
          f: exactItems('#/$defs/followUpItem', familyVariantCount)
        },
        required: ['r', 'o', 'b', 'c', 'a', 't', 'p', 'f'],
        additionalProperties: false
      }
    },
    required: ['l', 'm', 'e', 's', 'd'],
    additionalProperties: false
  });
  const weightProperties = Object.fromEntries(
    Object.keys(scoreProperties).map((key) => [
      key,
      { type: 'number' }
    ])
  );

  return {
    type: 'json_schema',
    json_schema: {
      name: TOURNAMENT_GENERATOR_CONTRACT,
      strict: true,
      schema: {
        type: 'object',
        properties: {
          seedContract: {
            type: 'string',
            enum: [SEED_CONTRACT_VERSION]
          },
          familyA: { $ref: '#/$defs/family' },
          familyB: { $ref: '#/$defs/family' },
          evidenceExperiment: { $ref: '#/$defs/evidenceExperiment' },
          candidates: {
            type: 'array',
            items: { $ref: '#/$defs/candidate' },
            maxItems: 8
          },
          w: {
            type: 'object',
            properties: weightProperties,
            required: Object.keys(weightProperties),
            additionalProperties: false
          }
        },
        required: [
          'seedContract',
          'familyA',
          'familyB',
          'evidenceExperiment',
          'candidates',
          'w'
        ],
        additionalProperties: false,
        $defs: {
          evidenceRef,
          evidenceRefs,
          compactEvidenceRefs,
          scores,
          offerItem: item(),
          buyerItem: item(),
          channelItem: item(),
          actionItem: item(),
          timingItem: item(true),
          proofItem: item(),
          followUpItem: item(),
          revenuePath: {
            type: 'object',
            properties: {
              l: { type: 'string' },
              e: { $ref: '#/$defs/evidenceRefs' },
              v: {
                type: 'string',
                enum: [REVENUE_PATH_CONTRACT_VERSION]
              },
              rm: {
                type: 'string',
                enum: [...REVENUE_MECHANISMS]
              },
              io: { type: 'string' },
              a: {
                type: 'string',
                enum: [...ACQUISITION_MODES]
              },
              c: { type: 'string' },
              o: { type: 'string' },
              atm: {
                type: 'string',
                enum: [...ATTRIBUTION_METHODS]
              },
              ats: { type: 'string' },
              g: grounding,
              sb: { type: 'string' },
              vm: { type: 'integer' }
            },
            required: [
              'l',
              'e',
              'v',
              'rm',
              'io',
              'a',
              'c',
              'o',
              'atm',
              'ats',
              'g',
              'sb',
              'vm'
            ],
            additionalProperties: false
          },
          evidenceExperiment,
          candidate: {
            type: 'object',
            properties: {
              k: {
                type: 'string',
                enum: ['person', 'organization']
              },
              l: { type: 'string' },
              o: { type: 'string' },
              r: { type: 'string' },
              m: { type: 'string' },
              e: { $ref: '#/$defs/compactEvidenceRefs' }
            },
            required: ['k', 'l', 'o', 'r', 'm', 'e'],
            additionalProperties: false
          },
          family: family()
        }
      }
    }
  };
}

function normalizeSeedSet(value, evidenceCatalog, referenceTime) {
  const raw = asObject(value);
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const familyInputs = strategyFamilyInputs(raw);
  const familyWrapperCount = ['familyA', 'familyB']
    .filter((key) => Object.prototype.hasOwnProperty.call(raw, key))
    .length;
  const hasFamilyBundleContract =
    Object.keys(asObject(raw.familyA)).length > 0 &&
    Object.keys(asObject(raw.familyB)).length > 0;
  const normalizedFamilies = normalizeStrategyFamilies(
    familyInputs,
    evidenceByID
  );
  const strategyFamilies = normalizedFamilies.families;
  const declaredSeedContract = firstText(raw.seedContract);
  const out = {
    seedContract: hasFamilyBundleContract
      ? declaredSeedContract === SEED_CONTRACT_VERSION
        ? SEED_CONTRACT_VERSION
        : declaredSeedContract === LEGACY_SEED_CONTRACT_VERSION
          ? LEGACY_SEED_CONTRACT_VERSION
          : 'invalid'
      : 'legacy_flat',
    declaredStrategyFamilyCount: familyInputs.length,
    familyWrapperCount,
    validStrategyFamilyCount: strategyFamilies.size,
    strategyFamilies: [...strategyFamilies.values()],
    strategyFamilyCollisionCount: normalizedFamilies.collisionCount,
    familyEvidenceMismatchSeedCount: 0,
    invalidFamilySeedCount: 0,
    unsupportedTimingSeedCount: 0,
    timingVerificationRepairCount: 0
  };
  for (const [name, aliases] of DIMENSIONS) {
    const nestedValues = nestedStrategyFamilySeeds(
      familyInputs,
      name,
      aliases
    );
    // The fixed family wrappers are the v3 trust boundary. Once present,
    // ignore all top-level dimension arrays so a model cannot inject a seed
    // that declares both families or carries evidence across the wrappers.
    const values = hasFamilyBundleContract
      ? nestedValues
      : [
          ...nestedValues,
          ...firstArray(...aliases.map((alias) => raw[alias]))
        ];
    const seen = new Set();
    out[name] = [];
    for (const [index, seedValue] of values.entries()) {
      const seed = asObject(seedValue);
      let label = truncate(firstText(seed.l, seed.label, seed.name, seed.title), 180);
      if (!label) continue;
      let evidenceRefs = compactStrings([
        ...asArray(seed.e),
        ...asArray(seed.evidenceRefs),
        ...asArray(seed.evidenceIds)
      ])
        .map((id) => evidenceByID.get(id)?.id)
        .filter(Boolean)
        .filter((id, evidenceIndexValue, ids) =>
          ids.indexOf(id) === evidenceIndexValue
        );
      const declaredFamilyIds = compactStrings([
        ...asArray(seed.f),
        ...asArray(seed.familyIds),
        seed.family,
        seed.strategyFamily
      ])
        .map(normalizeStrategyFamilyID)
        .filter((id) => strategyFamilies.has(id))
        .filter((id, familyIndex, ids) => ids.indexOf(id) === familyIndex)
        .slice(0, 4);
      const specificEvidenceRefs = strategyAnchorEvidenceRefs(evidenceRefs);
      let familyIds = declaredFamilyIds.filter((id) =>
        stringsOverlap(
          specificEvidenceRefs,
          strategyAnchorEvidenceRefs(
            strategyFamilies.get(id)?.evidenceRefs
          )
        )
      );
      let familyLocalTimingRepair = null;
      if (declaredFamilyIds.length > 0 && familyIds.length === 0) {
        out.familyEvidenceMismatchSeedCount += 1;
        if (name === 'timingTriggers' && declaredFamilyIds.length === 1) {
          const familyID = declaredFamilyIds[0];
          const familyEvidence = new Set(
            asArray(strategyFamilies.get(familyID)?.evidenceRefs)
          );
          const buyerGroundedFamilyObservations =
            normalizedFamilyBuyerObservationEvidenceRefs(
              out,
              familyID,
              evidenceByID
            )
              .filter((ref) => familyEvidence.has(ref));
          familyLocalTimingRepair = repairTimingAsVerification(
            buyerGroundedFamilyObservations,
            evidenceByID,
            referenceTime
          );
          if (familyLocalTimingRepair) {
            familyIds = [familyID];
            evidenceRefs = [
              ...familyLocalTimingRepair.supportEvidenceRefs
            ];
          }
        }
      }
      if (familyIds.length === 0) {
        out.invalidFamilySeedCount += 1;
        continue;
      }
      // A seed is allowed to retain only evidence declared by its family.
      // This keeps the emitted provenance a real containment proof instead of
      // allowing one valid family ref to smuggle unrelated refs into a tuple.
      evidenceRefs = evidenceRefs.filter((ref) =>
        familyIds.some((familyID) =>
          asArray(strategyFamilies.get(familyID)?.evidenceRefs)
            .includes(ref)
        )
      );
      let supportPhrase = name === 'timingTriggers'
        ? truncate(firstText(
          seed.q,
          seed.supportPhrase,
          seed.timingEvidencePhrase
        ), 180)
        : '';
      let supportEvidenceRefs = [];
      let timingWasRepaired = false;
      if (name === 'timingTriggers') {
        if (familyLocalTimingRepair) {
          label = familyLocalTimingRepair.label;
          supportPhrase = familyLocalTimingRepair.supportPhrase;
          supportEvidenceRefs =
            familyLocalTimingRepair.supportEvidenceRefs;
          timingWasRepaired = true;
        } else {
          const supportedRefs = evidenceRefs.filter((id) =>
            /^observation:/i.test(id) &&
            timingEvidenceIsSafe(evidenceByID.get(id), referenceTime) &&
            evidenceSupportsExactTimingText(
              evidenceByID.get(id),
              supportPhrase,
              label
            )
          );
          if (!supportPhrase ||
              supportedRefs.length === 0 ||
              !timingSupportPhraseGroundsLabel(label, supportPhrase)) {
            const repaired = repairTimingAsVerification(
              evidenceRefs.filter((ref) =>
                familyIds.some((familyID) =>
                  asArray(strategyFamilies.get(familyID)?.evidenceRefs)
                    .includes(ref)
                )
              ),
              evidenceByID,
              referenceTime
            );
            if (!repaired) {
              out.unsupportedTimingSeedCount += 1;
              continue;
            }
            label = repaired.label;
            supportPhrase = repaired.supportPhrase;
            supportEvidenceRefs = repaired.supportEvidenceRefs;
            timingWasRepaired = true;
          } else {
            supportEvidenceRefs = supportedRefs;
          }
        }
      }
      const key = `${comparable(label)}|${familyIds.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const scores = normalizeScores(seed.s ?? seed.scores);
      if (timingWasRepaired) {
        scores.timing = Math.min(
          finite(scores.timing) ?? defaultScoreForField('timing'),
          0.25
        );
        scores.risk = Math.max(
          finite(scores.risk) ?? defaultScoreForField('risk'),
          0.35
        );
        scores.uncertainty = Math.max(
          finite(scores.uncertainty) ?? defaultScoreForField('uncertainty'),
          0.75
        );
      }
      const expectedValueMicros = nonNegativeInteger(
        seed.vm ?? seed.expectedValueMicros
      );
      // A revenue path summarizes the family's offer-to-payment contract. Its
      // evidence is therefore the canonical union of the same family's
      // revenue-bearing dimensions, rather than a second model-authored copy
      // that can accidentally omit one otherwise-valid anchor.
      const revenuePathEvidenceRefs = name === 'revenuePaths'
        ? compactStrings([
            ...evidenceRefs,
            ...familyIds.flatMap((familyID) =>
              asArray(strategyFamilies.get(familyID)?.evidenceRefs)
            )
          ])
            .filter((ref) => evidenceByID.has(ref))
            .slice(0, MAX_EVIDENCE_ITEMS)
        : evidenceRefs;
      const revenuePath = name === 'revenuePaths'
        ? normalizeRevenuePathSeed(
            seed,
            revenuePathEvidenceRefs
          )
        : undefined;
      const acquisitionModes = compactStrings(
        familyIds.map((familyID) =>
          strategyFamilies.get(familyID)?.acquisitionMode
        )
      )
        .filter((mode) => ACQUISITION_MODES.has(mode))
        .filter((mode, modeIndex, modes) =>
          modes.indexOf(mode) === modeIndex
        );
      out[name].push({
        id: normalizeSeedID(firstText(seed.id, `${name}-${index + 1}`), name, label),
        label,
        familyIds,
        acquisitionModes,
        evidenceRefs,
        supportPhrase,
        supportEvidenceRefs,
        timingVerificationRepaired: timingWasRepaired,
        reason: truncate(firstText(seed.r, seed.reason, seed.rationale), 320),
        uncertainty: timingWasRepaired
          ? 'Timing is not established; verify the cited observation before treating it as a trigger.'
          : truncate(firstText(seed.u, seed.uncertainty, seed.unknown), 240),
        scores,
        estimatedSpendMicros: nonNegativeInteger(seed.sp ?? seed.estimatedSpendMicros),
        expectedValueMicros,
        revenuePath
      });
      if (timingWasRepaired) {
        out.timingVerificationRepairCount += 1;
      }
      if (out[name].length >= MAX_SEEDS_PER_DIMENSION) break;
    }
  }
  out.strategyFamilyAnchorCoverage = strategyFamilyAnchorCoverage(out);
  out.completeStrategyFamilyCount = out.strategyFamilyAnchorCoverage
    .filter((family) => family.complete)
    .length;
  out.incompleteStrategyFamilyCount =
    out.strategyFamilies.length - out.completeStrategyFamilyCount;
  return out;
}

function searchContractsForSeedSet(seedSetValue) {
  const seedContract = firstText(asObject(seedSetValue).seedContract);
  if (seedContract === LEGACY_SEED_CONTRACT_VERSION ||
      seedContract === 'legacy_flat') {
    return {
      revenueGate: LEGACY_REVENUE_GATE_VERSION,
      revenuePathContract: LEGACY_REVENUE_PATH_CONTRACT_VERSION,
      coherenceGate: LEGACY_COHERENCE_GATE_VERSION
    };
  }
  return {
    revenueGate: REVENUE_GATE_VERSION,
    revenuePathContract: REVENUE_PATH_CONTRACT_VERSION,
    coherenceGate: COHERENCE_GATE_VERSION
  };
}

function normalizeRevenuePathSeed(seedValue, evidenceRefs) {
  const seed = asObject(seedValue);
  const grounding = normalizeRevenuePathGrounding(
    seed.g ?? seed.grounding,
    evidenceRefs
  );
  return compact({
    contractVersion: firstText(
      seed.contractVersion,
      seed.revenueContractVersion,
      seed.v
    ),
    revenueMechanism: contractEnum(firstText(
      seed.revenueMechanism,
      seed.mechanism,
      seed.rm
    )),
    incrementalIncomeOutcome: truncate(firstText(
      seed.incrementalIncomeOutcome,
      seed.incomeOutcome,
      seed.io
    ), 320),
    acquisitionMode: contractEnum(firstText(
      seed.acquisitionMode,
      seed.acquisition,
      seed.amode,
      seed.a
    )),
    conversionAction: truncate(firstText(
      seed.conversionAction,
      seed.ca,
      seed.c
    ), 320),
    observableRevenueOutcome: truncate(firstText(
      seed.observableRevenueOutcome,
      seed.revenueOutcome,
      seed.ro,
      seed.o
    ), 320),
    attributionMethod: contractEnum(firstText(
      seed.attributionMethod,
      seed.atm
    )),
    attributionSignal: truncate(firstText(
      seed.attributionSignal,
      seed.ats
    ), 320),
    _grounding: grounding,
    supportingBottleneck: truncate(firstText(
      seed.supportingBottleneck,
      seed.sb,
      seed.b
    ), 240),
    evidenceRefs: compactStrings(evidenceRefs)
  });
}

function normalizeRevenuePathGrounding(value, allowedEvidenceRefs) {
  const raw = asObject(value);
  const allowed = new Set(compactStrings(allowedEvidenceRefs));
  const refs = (...values) => compactStrings(
    values.flatMap((item) => asArray(item))
  )
    .filter((ref) => allowed.has(ref))
    .filter((ref, index, items) => items.indexOf(ref) === index)
    .slice(0, 12);
  const destination = asObject(raw.d ?? raw.conversionDestination);
  const grounding = {
    buyerEvidenceRefs: refs(raw.b, raw.buyerEvidenceRefs),
    paidOfferEvidenceRefs: refs(raw.o, raw.paidOfferEvidenceRefs),
    acquisitionEvidenceRefs: refs(raw.a, raw.acquisitionEvidenceRefs),
    conversionDestination: truncate(firstText(
      destination.l,
      destination.label,
      raw.conversionDestinationLabel
    ), 240),
    conversionDestinationEvidenceRefs: refs(
      destination.e,
      destination.evidenceRefs,
      raw.conversionDestinationEvidenceRefs
    ),
    paidConversionEvidenceRefs: refs(
      raw.c,
      raw.paidConversionEvidenceRefs
    ),
    attributionEvidenceRefs: refs(
      raw.t,
      raw.attributionEvidenceRefs
    )
  };
  return Object.values(grounding).some((item) =>
    Array.isArray(item) ? item.length > 0 : Boolean(item)
  )
    ? grounding
    : undefined;
}

function contractEnum(value) {
  return comparable(firstText(value)).replace(/\s+/g, '_');
}

function strategyFamilyInputs(rawValue) {
  const raw = asObject(rawValue);
  const fixedBundles = [
    ['family-a', raw.familyA],
    ['family-b', raw.familyB]
  ]
    .filter(([, value]) => Object.keys(asObject(value)).length > 0)
    .map(([id, value]) => ({
      ...asObject(value),
      id
    }));
  if (fixedBundles.length > 0) return fixedBundles;
  return firstArray(raw.families, raw.strategyFamilies);
}

function nestedStrategyFamilySeeds(familyInputs, dimension, aliases) {
  const out = [];
  for (const familyValue of asArray(familyInputs)) {
    const family = asObject(familyValue);
    const familyScores = asObject(family.s ?? family.scores);
    const familyID = normalizeStrategyFamilyID(firstText(
      family.id,
      family.familyId,
      family.name
    ));
    if (!familyID) continue;
    const dimensions = Object.keys(asObject(family.d)).length > 0
      ? asObject(family.d)
      : asObject(family.dimensions);
    const values = firstArray(
      ...aliases.map((alias) => dimensions[alias]),
      ...aliases.map((alias) => family[alias])
    );
    for (const [index, value] of values.entries()) {
      const seed = asObject(value);
      out.push({
        ...seed,
        ...(Object.keys(asObject(seed.s ?? seed.scores)).length > 0
          ? {}
          : { s: familyScores }),
        id: `${familyID}-${firstText(
          seed.id,
          `${dimension}-${index + 1}`
        )}`,
        f: [familyID]
      });
    }
  }
  return out;
}

function strategyFamilyAnchorCoverage(seedSet) {
  return asArray(asObject(seedSet).strategyFamilies)
    .map(asObject)
    .map((family) => {
      const familyAnchorRefs = strategyObservationEvidenceRefs(
        family.evidenceRefs
      );
      let sharedAnchorRefs = [...familyAnchorRefs];
      const dimensions = {};
      for (const [dimension] of DIMENSIONS) {
        const familySeeds = asArray(asObject(seedSet)[dimension])
          .map(asObject)
          .filter((seed) => asArray(seed.familyIds).includes(family.id));
        dimensions[dimension] = familySeeds.length;
        const dimensionRefs = new Set(
          familySeeds.flatMap((seed) =>
            strategyObservationEvidenceRefs(seed.evidenceRefs)
          )
        );
        sharedAnchorRefs = sharedAnchorRefs.filter((ref) =>
          dimensionRefs.has(ref)
        );
      }
      return {
        id: family.id,
        complete: Object.values(dimensions).every((count) => count > 0) &&
          familyAnchorRefs.length > 0,
        familyAnchorCount: familyAnchorRefs.length,
        sharedAnchorCount: sharedAnchorRefs.length,
        dimensions
      };
    });
}

function strategyObservationEvidenceRefs(values) {
  return compactStrings(values)
    .filter((ref) => /^observation:/i.test(ref));
}

function normalizedFamilyBuyerObservationEvidenceRefs(
  seedSet,
  familyID,
  evidenceByID
) {
  const buyerSeeds = asArray(asObject(seedSet).buyerSegments)
    .map(asObject)
    .filter((seed) => asArray(seed.familyIds).includes(familyID));
  if (buyerSeeds.length === 0) return [];
  if (firstText(asObject(seedSet).seedContract) ===
      SEED_CONTRACT_VERSION) {
    const family = asArray(asObject(seedSet).strategyFamilies)
      .map(asObject)
      .find((item) => item.id === familyID);
    if (!ACQUISITION_MODES.has(
      firstText(family?.acquisitionMode)
    )) {
      return [];
    }
    const refs = [];
    for (const seed of buyerSeeds) {
      const supportedRefs = strategyObservationEvidenceRefs(
        seed.evidenceRefs
      ).filter((ref) => {
        const evidence = asObject(evidenceByID.get(ref));
        if (evidence.approvedSourceObservation !== true) return false;
        return textOverlap(
          seed.label,
          compactStrings([
            evidence.label,
            evidence.summary
          ]).join(' ')
        ) > 0;
      });
      if (supportedRefs.length === 0) return [];
      refs.push(...supportedRefs);
    }
    return compactStrings(refs)
      .filter((ref, index, values) =>
        values.indexOf(ref) === index
      );
  }
  let buyerMotion = '';
  const refs = [];
  for (const seed of buyerSeeds) {
    const seedMotions = strategyMotions(seed.label, 'buyerSegment');
    if (seedMotions.length !== 1) return [];
    if (buyerMotion && buyerMotion !== seedMotions[0]) return [];
    buyerMotion = seedMotions[0];
    for (const ref of strategyObservationEvidenceRefs(seed.evidenceRefs)) {
      const evidence = asObject(evidenceByID.get(ref));
      const evidenceMotions = strategyMotions(compactStrings([
        evidence.label,
        evidence.summary
      ]).join(' '));
      if (evidenceMotions.length === 1 &&
          evidenceMotions[0] === buyerMotion) {
        refs.push(ref);
      }
    }
  }
  return compactStrings(refs)
    .filter((ref, index, values) => values.indexOf(ref) === index);
}

function strategyFamilyRevenueCoreEvidenceRefs(rawValue) {
  const raw = asObject(rawValue);
  const dimensions = Object.keys(asObject(raw.d)).length > 0
    ? asObject(raw.d)
    : asObject(raw.dimensions);
  const coreDimensions = new Set([
    'offers',
    'buyerSegments',
    'channels',
    'actions',
    'proofPoints',
    'revenuePaths'
  ]);
  const refs = [];
  for (const [dimension, aliases] of DIMENSIONS) {
    if (!coreDimensions.has(dimension)) continue;
    const values = firstArray(
      ...aliases.map((alias) => dimensions[alias]),
      ...aliases.map((alias) => raw[alias])
    );
    for (const value of values) {
      const item = asObject(value);
      refs.push(
        ...asArray(item.e),
        ...asArray(item.evidenceRefs),
        ...asArray(item.evidenceIds)
      );
    }
  }
  return compactStrings(refs);
}

function normalizeStrategyFamilies(values, evidenceByID) {
  const families = new Map();
  const collidedIDs = new Set();
  let collisionCount = 0;
  for (const value of asArray(values).slice(0, 4)) {
    const raw = asObject(value);
    const id = normalizeStrategyFamilyID(firstText(
      raw.id,
      raw.familyId,
      raw.name
    ));
    if (!id || collidedIDs.has(id)) continue;
    const evidenceRefs = compactStrings([
      ...asArray(raw.e),
      ...asArray(raw.evidenceRefs),
      ...asArray(raw.evidenceIds),
      ...strategyFamilyRevenueCoreEvidenceRefs(raw)
    ])
      .map((ref) => evidenceByID.get(ref)?.id)
      .filter(Boolean)
      .filter((ref, index, refs) => refs.indexOf(ref) === index)
      .slice(0, MAX_EVIDENCE_ITEMS);
    if (evidenceRefs.length === 0 ||
        strategyObservationEvidenceRefs(evidenceRefs).length === 0) {
      continue;
    }
    const family = {
      id,
      label: truncate(firstText(raw.l, raw.label, raw.name, id), 120),
      evidenceRefs,
      acquisitionMode: ACQUISITION_MODES.has(
        contractEnum(firstText(raw.m, raw.acquisitionMode))
      )
        ? contractEnum(firstText(raw.m, raw.acquisitionMode))
        : ''
    };
    const existing = families.get(id);
    if (existing) {
      const sameDefinition = comparable(existing.label) === comparable(family.label) &&
        stableHash([...existing.evidenceRefs].sort()) ===
          stableHash([...family.evidenceRefs].sort());
      if (!sameDefinition) {
        families.delete(id);
        collidedIDs.add(id);
        collisionCount += 1;
      }
      continue;
    }
    families.set(id, family);
  }
  return { families, collisionCount };
}

function normalizeStrategyFamilyID(value) {
  return comparable(firstText(value))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function normalizeJudgeWeights(value) {
  const raw = asObject(value);
  const out = {};
  for (const field of [...POSITIVE_SCORE_FIELDS, ...BURDEN_SCORE_FIELDS]) {
    out[field] = clampNumber(
      scoreFieldValue(raw, field),
      0.005,
      0.3,
      DEFAULT_JUDGE_WEIGHTS[field]
    );
  }
  const total = Object.values(out).reduce((sum, item) => sum + item, 0);
  if (total <= 0) return { ...DEFAULT_JUDGE_WEIGHTS };
  for (const key of Object.keys(out)) {
    out[key] = round(out[key] / total);
  }
  // Semantic weights may tune emphasis, but cannot make grounding or objective
  // fit subordinate to convenience or reachability.
  if (out.objectiveFit < 0.14 || out.evidenceStrength < 0.14 || out.reachability > 0.1) {
    return { ...DEFAULT_JUDGE_WEIGHTS };
  }
  return out;
}

function normalizePriorOutcomes(value) {
  return firstArray(value)
    .slice(0, 64)
    .map((raw) => {
      const item = asObject(raw);
      return compact({
        kind: firstText(item.kind, item.outcome, item.status),
        verified: item.verified === true,
        offer: firstText(item.offer),
        buyerSegment: firstText(item.buyerSegment, item.audience),
        channel: firstText(item.channel),
        action: firstText(item.action),
        evidenceRefs: compactStrings(item.evidenceRefs)
      });
    });
}

function scoreHypothesis({
  objective,
  tuple,
  evidenceRefs,
  evidenceByID,
  priorOutcomes,
  weights
}) {
  const seeds = DIMENSIONS.map(([name]) => tuple[name]);
  const evidenceScores = evidenceRefs
    .map((id) => evidenceByID.get(id))
    .filter(Boolean)
    .map(evidenceQualityNormalized);
  const semantic = {};
  for (const field of [...POSITIVE_SCORE_FIELDS, ...BURDEN_SCORE_FIELDS]) {
    const values = seeds
      .map((seed) => finite(seed.scores[field]))
      .filter((value) => value !== null);
    semantic[field] = values.length > 0
      ? average(values)
      : defaultScoreForField(field);
  }
  const tupleText = DIMENSIONS.map(([name]) => tuple[name].label).join(' ');
  const objectiveOverlap = textOverlap(
    `${objective.outcome} ${objective.successMetric}`,
    tupleText
  );
  semantic.objectiveFit = clamp01(
    semantic.objectiveFit * 0.72 + objectiveOverlap * 0.28
  );
  semantic.evidenceStrength = clamp01(
    semantic.evidenceStrength * 0.55 +
    (evidenceScores.length > 0 ? average(evidenceScores) : 0) * 0.45
  );
  const priorAdjustment = priorOutcomeAdjustment(tuple, priorOutcomes);
  semantic.expectedValue = clamp01(semantic.expectedValue + priorAdjustment.value);
  semantic.uncertainty = clamp01(semantic.uncertainty + priorAdjustment.uncertainty);
  if (timingIsVerificationStep(tuple.timingTriggers.label)) {
    semantic.timing = Math.min(semantic.timing, 0.25);
    semantic.risk = Math.max(semantic.risk, 0.35);
    semantic.uncertainty = Math.max(semantic.uncertainty, 0.75);
  }

  let positive = 0;
  let burden = 0;
  for (const field of POSITIVE_SCORE_FIELDS) positive += semantic[field] * weights[field];
  for (const field of BURDEN_SCORE_FIELDS) burden += semantic[field] * weights[field];
  const positiveWeight = POSITIVE_SCORE_FIELDS.reduce((sum, field) => sum + weights[field], 0);
  const burdenWeight = BURDEN_SCORE_FIELDS.reduce((sum, field) => sum + weights[field], 0);
  const positiveNormalized = positiveWeight > 0 ? positive / positiveWeight : 0;
  const burdenNormalized = burdenWeight > 0 ? burden / burdenWeight : 0;
  const inboundPreference =
    tuple.revenuePaths.revenuePath.acquisitionMode === 'inbound'
      ? 0.012
      : 0;
  const total = clamp01(
    positiveNormalized * 0.82 +
    (1 - burdenNormalized) * 0.18 +
    inboundPreference
  );
  return {
    objectiveFit: round(semantic.objectiveFit),
    evidenceStrength: round(semantic.evidenceStrength),
    buyerAuthority: round(semantic.buyerAuthority),
    timing: round(semantic.timing),
    warmPath: round(semantic.warmPath),
    reachability: round(semantic.reachability),
    expectedValue: round(semantic.expectedValue),
    effort: round(semantic.effort),
    cost: round(semantic.cost),
    risk: round(semantic.risk),
    uncertainty: round(semantic.uncertainty),
    total: round(total)
  };
}

function priorOutcomeAdjustment(tuple, outcomes) {
  let value = 0;
  let uncertainty = 0;
  const tupleText = DIMENSIONS.map(([name]) => tuple[name].label).join(' ');
  for (const outcome of outcomes) {
    const outcomeText = [
      outcome.offer,
      outcome.buyerSegment,
      outcome.channel,
      outcome.action
    ].join(' ');
    if (textOverlap(tupleText, outcomeText) < 0.35) continue;
    const kind = comparable(outcome.kind);
    const verifiedFactor = outcome.verified ? 1 : 0.55;
    if (/\b(won|paid|accepted|qualified reply|meeting booked|referral)\b/.test(kind)) {
      value += 0.08 * verifiedFactor;
      uncertainty -= 0.04 * verifiedFactor;
    } else if (/\b(lost|rejected|skipped|spam|complaint)\b/.test(kind)) {
      value -= 0.08 * verifiedFactor;
      uncertainty += 0.04;
    } else if (/\b(not now|no response|unverified)\b/.test(kind)) {
      value -= 0.025;
      uncertainty += 0.03;
    }
  }
  return {
    value: clampNumber(value, -0.16, 0.16, 0),
    uncertainty: clampNumber(uncertainty, -0.08, 0.12, 0)
  };
}

function diverseFinalists(hypotheses, limit) {
  // Diversity selection is quadratic in the retained pool. The global score
  // sort first keeps the pool bounded while preserving the true top scorer.
  const remaining = [...hypotheses]
    .sort(compareHypotheses)
    .slice(0, Math.max(200, limit * 25));
  const selected = [];
  const selectedFamilies = new Set();
  if (remaining.length > 0 && selected.length < limit) {
    const winner = remaining.shift();
    selected.push(winner);
    selectedFamilies.add(firstText(winner._strategyFamily));
  }
  while (remaining.length > 0 && selected.length < limit) {
    const nextFamilyIndex = remaining.findIndex((candidate) =>
      !selectedFamilies.has(firstText(candidate._strategyFamily))
    );
    if (nextFamilyIndex < 0) break;
    const candidate = remaining.splice(nextFamilyIndex, 1)[0];
    selected.push(candidate);
    selectedFamilies.add(firstText(candidate._strategyFamily));
  }
  while (remaining.length > 0 && selected.length < limit) {
    let bestIndex = 0;
    let bestAdjusted = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const similarity = selected.reduce(
        (max, prior) => Math.max(max, hypothesisSimilarity(candidate, prior)),
        0
      );
      const adjusted = candidate.score.total - similarity * 0.075;
      if (adjusted > bestAdjusted ||
          (adjusted === bestAdjusted && compareHypotheses(candidate, remaining[bestIndex]) < 0)) {
        bestAdjusted = adjusted;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected;
}

function compareHypotheses(left, right) {
  return right.score.total - left.score.total ||
    right.score.evidenceStrength - left.score.evidenceStrength ||
    right.score.objectiveFit - left.score.objectiveFit ||
    left.id.localeCompare(right.id);
}

function hypothesisSimilarity(left, right) {
  const fields = ['offer', 'buyerSegment', 'channel', 'action', 'timingTrigger', 'followUp'];
  const same = fields.filter((field) => comparable(left[field]) === comparable(right[field])).length;
  return same / fields.length;
}

function selectWinner({
  objective,
  hypotheses,
  candidates,
  evidenceCatalog,
  eligibleCount,
  exploredCount
}) {
  if (hypotheses.length === 0) {
    return { winner: null, runnerUp: null, candidates };
  }
  const winnerHypothesis = hypotheses[0];
  const runnerHypothesis = hypotheses[1];
  const selectedCandidate = candidates
    .filter((candidate) =>
      candidateActionableForHypothesis(
        candidate,
        winnerHypothesis,
        evidenceCatalog
      )
    )
    .sort((left, right) =>
      selectionAnchorPriority(left, winnerHypothesis) -
        selectionAnchorPriority(right, winnerHypothesis) ||
      right.score.total - left.score.total ||
      left.id.localeCompare(right.id)
    )[0];
  const normalizedCandidates = candidates.map((candidate) => ({
    ...candidate,
    hypothesisId: selectedCandidate && candidate.id === selectedCandidate.id
      ? winnerHypothesis.id
      : candidate.hypothesisId,
    selected: Boolean(selectedCandidate && candidate.id === selectedCandidate.id)
  }));
  if (!selectedCandidate) {
    return { winner: null, runnerUp: null, candidates: normalizedCandidates };
  }
  const winner = recommendationFor({
    objective,
    hypothesis: winnerHypothesis,
    runnerUp: runnerHypothesis,
    candidate: selectedCandidate,
    evidenceCatalog,
    eligibleCount,
    exploredCount
  });
  const runnerUp = runnerHypothesis
    ? recommendationFor({
      objective,
      hypothesis: runnerHypothesis,
      runnerUp: null,
      candidate: normalizedCandidates.find((candidate) => candidate.hypothesisId === runnerHypothesis.id),
      evidenceCatalog,
      eligibleCount,
      exploredCount
    })
    : null;
  return { winner, runnerUp, candidates: normalizedCandidates };
}

function selectionAnchorPriority(candidate, hypothesis) {
  if (firstText(hypothesis?.revenuePath?.acquisitionMode) === 'inbound') {
    return ownedInboundAssetCandidate(candidate) ? 0 : 1;
  }
  return ownedInboundAssetCandidate(candidate) ? 2 : 0;
}

function recommendationFor({
  objective,
  hypothesis,
  runnerUp,
  candidate,
  evidenceCatalog,
  eligibleCount,
  exploredCount
}) {
  const tuple = hypothesis._tuple;
  const candidateLabel = truncate(firstText(candidate?.displayLabel), 180);
  const isV2 =
    firstText(hypothesis?.revenuePath?.contractVersion) ===
      REVENUE_PATH_CONTRACT_VERSION;
  const buyerMotions = isV2
    ? acquisitionModesFromText(hypothesis.buyerSegment)
    : strategyMotions(
        hypothesis.buyerSegment,
        'buyerSegment'
      );
  const candidateIsOwnedInboundAsset =
    ownedInboundAssetCandidate(candidate);
  const candidateIsContextAnchor =
    candidateIsOwnedInboundAsset ||
    (
      !isV2 &&
      organizationCandidateRequiresBuyerMatch(candidate) &&
      buyerMotions.includes('patient_inbound') &&
      !buyerMotions.includes('payer_network')
    );
  const candidateCopyLabel = candidateIsContextAnchor ? '' : candidateLabel;
  const timingLabel = firstText(tuple?.timingTriggers?.label);
  const timingSupport = firstText(tuple?.timingTriggers?.supportPhrase);
  const whyNow = timingLabel && timingSupport
    ? timingIsVerificationStep(timingLabel)
      ? `Timing is unverified; ${timingLabel}. Source relevance: ${timingSupport}`
      : `${timingLabel} Source support: ${timingSupport}`
    : 'The timing remains a hypothesis and should be verified before acting.';
  const uncertainty = compactStrings([
    tuple?.buyerSegments?.uncertainty,
    tuple?.timingTriggers?.uncertainty,
    tuple?.channels?.uncertainty,
    'No real-world outcome has been observed yet; this is a review-first research recommendation.'
  ]).slice(0, 2).join(' ');
  const actionNamesCandidate = exactTextContains(
    hypothesis.action,
    candidateCopyLabel
  );
  const offerNamesCandidate = exactTextContains(
    hypothesis.offer,
    candidateCopyLabel
  );
  const action = truncate(
    candidateCopyLabel && !actionNamesCandidate
      ? `${hypothesis.action} for ${candidateCopyLabel} through ${hypothesis.channel}; prepare only the singular, reviewable next step.`
      : `${hypothesis.action} through ${hypothesis.channel}; prepare only the singular, reviewable next step.`,
    600
  );
  const title = truncate(
    candidateCopyLabel && !offerNamesCandidate
      ? `${hypothesis.offer} with ${candidateCopyLabel}`
      : hypothesis.offer,
    180
  );
  const evidenceRefs = compactStrings(hypothesis.evidenceRefs)
    .filter((id) => evidenceIndex(evidenceCatalog).has(id))
    .slice(0, 12);
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const citedEvidenceLabels = compactStrings(
    evidenceRefs.map((id) => evidenceByID.get(id)?.label)
  ).slice(0, 2);
  const grounding = citedEvidenceLabels.length > 0
    ? `Cited evidence: ${citedEvidenceLabels.join('; ')}.`
    : 'Its evidence references remain attached for review.';
  const revenueWhy =
    `Incremental-income target: ${hypothesis.revenuePath.incrementalIncomeOutcome} ` +
    `Observable proof: ${hypothesis.revenuePath.observableRevenueOutcome} ` +
    `Attribution: ${hypothesis.revenuePath.attributionSignal}.`;
  const why = candidateLabel
    ? `${revenueWhy} ${candidateLabel} is the ${candidateIsOwnedInboundAsset ? 'approved owned inbound execution asset' : candidateIsContextAnchor ? 'exact named evidence anchor' : 'exact named candidate'} attached to this strategy. ${grounding} It led ${eligibleCount.toLocaleString('en-US')} coherent, evidence-grounded strategies retained from ${exploredCount.toLocaleString('en-US')} evaluated combinations on objective fit, evidence strength, buyer authority, timing, incremental expected value, effort, cost, risk, and uncertainty.`
    : `${revenueWhy} ${grounding} This was one of ${eligibleCount.toLocaleString('en-US')} coherent, evidence-grounded strategies retained from ${exploredCount.toLocaleString('en-US')} evaluated combinations.`;
  const whyOverRunnerUp = runnerUp
    ? comparisonReason(hypothesis, runnerUp)
    : '';
  const recommendationSignatureTexts = [
    title,
    action,
    why,
    whyNow,
    whyOverRunnerUp,
    uncertainty
  ];
  const recommendationMotionSignatures = compactStrings(
    recommendationSignatureTexts.flatMap((value) =>
      isV2
        ? acquisitionModesFromText(value)
        : strategyMotions(value)
    )
  ).sort();
  const hypothesisMotionSignatures = compactStrings(
    asObject(hypothesis.provenance).motionSignatures
  ).sort();
  if (recommendationMotionSignatures.length > 1 ||
      recommendationMotionSignatures.some((motion) =>
        !hypothesisMotionSignatures.includes(motion)
      )) {
    return null;
  }
  const recommendation = compact({
    hypothesisId: hypothesis.id,
    candidateId: candidate?.id,
    actionId: `action-${stableHash(`${hypothesis.id}|${action}`).slice(0, 20)}`,
    title,
    action,
    why,
    whyNow,
    whyOverRunnerUp,
    uncertainty,
    motionSignatures: recommendationMotionSignatures,
    evidenceRefs,
    requiresReview: true,
    score: hypothesis.score,
    expectedValueMicros: hypothesis.expectedValueMicros,
    revenuePath: hypothesis.revenuePath,
    objective: {
      id: objective.id,
      outcome: objective.outcome,
      successMetric: objective.successMetric
    }
  });
  // An empty signature is meaningful: it proves the deterministic
  // recommendation text introduced no independently classified motion.
  recommendation.motionSignatures = recommendationMotionSignatures;
  return recommendation;
}

function comparisonReason(winner, runnerUp) {
  const fields = [
    ['objectiveFit', 'objective fit'],
    ['evidenceStrength', 'evidence strength'],
    ['buyerAuthority', 'buyer authority'],
    ['timing', 'timing'],
    ['warmPath', 'warm-path potential'],
    ['expectedValue', 'expected value']
  ];
  const best = fields
    .map(([field, label]) => ({
      field,
      label,
      difference: winner.score[field] - runnerUp.score[field]
    }))
    .sort((left, right) => right.difference - left.difference)[0];
  if (!best || best.difference <= 0) {
    return `It had the stronger total score (${winner.score.total.toFixed(3)} versus ${runnerUp.score.total.toFixed(3)}) after cost, risk, and uncertainty were included.`;
  }
  return `It led the runner-up on ${best.label} and had the stronger total score (${winner.score.total.toFixed(3)} versus ${runnerUp.score.total.toFixed(3)}).`;
}

function collectStructuredCandidates(payload, context, profileScribePublicBaseURL) {
  payload = asObject(payload);
  context = asObject(context);
  const snapshot = asObject(payload.evidenceSnapshot);
  const sources = firstArray(snapshot.sources, context.sources);
  const approvedSourceIDs = new Set(
    sources
      .map(asObject)
      .filter(sourceIsResearchApproved)
      .map((source) => firstText(source.id, source.sourceId))
      .filter(Boolean)
  );
  const values = [];
  const appendCaller = (items) => {
    for (const item of asArray(items)) {
      const raw = asObject(item);
      values.push({
        ...raw,
        providers: compactStrings([
          ...asArray(raw.providers),
          firstText(raw.provider),
          'caller'
        ])
      });
    }
  };
  appendCaller(payload.candidates);
  appendCaller(payload.publicCandidates);
  appendCaller(snapshot.candidates);

  const timelinePosts = [
    ...asArray(asObject(context.timelineBrief).recentPosts),
    ...asArray(asObject(snapshot.timelineBrief).recentPosts),
    ...asArray(snapshot.recentTimelinePosts)
  ];
  for (const postValue of timelinePosts) {
    const candidate = structuredCandidateFromTimelinePost(
      postValue,
      profileScribePublicBaseURL
    );
    if (candidate) values.push(candidate);
  }

  const evidenceItems = [
    ...asArray(context.sourceEvidence),
    ...asArray(snapshot.sourceEvidence),
    ...asArray(snapshot.evidence),
    ...asArray(snapshot.observations)
  ];
  for (const evidenceValue of evidenceItems) {
    const evidence = asObject(evidenceValue);
    const sourceID = firstText(evidence.sourceId, evidence.sourceID);
    if (!sourceID || !approvedSourceIDs.has(sourceID)) continue;
    values.push(...structuredCandidatesFromEvidence(
      evidence,
      profileScribePublicBaseURL
    ));
  }
  return values;
}

function prioritizedCandidateEvidenceRefs(values, evidenceCatalog) {
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const ordered = [
    ...asArray(values).filter((value) => asObject(value).selected === true),
    ...asArray(values).filter((value) => asObject(value).selected !== true)
  ];
  const priority = new Map();
  for (const candidateValue of ordered) {
    for (const ref of compactStrings(asObject(candidateValue).evidenceRefs)) {
      const canonicalID = evidenceByID.get(ref)?.id;
      if (canonicalID && !priority.has(canonicalID)) {
        priority.set(canonicalID, priority.size);
      }
    }
  }
  return priority;
}

function normalizeModelExtractedCandidates(values, evidenceCatalog) {
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const candidates = [];
  for (const [index, candidateValue] of asArray(values).slice(0, 8).entries()) {
    const raw = asObject(candidateValue);
    const declaredKind = comparable(firstText(raw.k, raw.kind, raw.type));
    if (declaredKind !== 'person' && declaredKind !== 'organization') continue;
    const displayLabel = truncate(firstText(
      raw.l,
      raw.displayLabel,
      raw.fullName,
      raw.name
    ), 180);
    if (!concreteCandidateLabel(displayLabel)) continue;
    // Model-declared types are hints, not authority. Obvious organizations
    // must retain the stricter buyer-name binding even when the model labels
    // them as people.
    const kind = declaredKind === 'person' &&
      organizationLikeCandidateLabel(displayLabel)
      ? 'organization'
      : declaredKind;
    const requestedRefs = compactStrings([
      ...asArray(raw.e),
      ...asArray(raw.evidenceRefs),
      ...asArray(raw.evidenceIds)
    ]);
    const supportedEvidence = [];
    const seenEvidenceIDs = new Set();
    for (const ref of requestedRefs) {
      const evidence = evidenceByID.get(ref);
      if (!evidence ||
          seenEvidenceIDs.has(evidence.id) ||
          !evidenceSupportsExactText(evidence, displayLabel)) {
        continue;
      }
      seenEvidenceIDs.add(evidence.id);
      supportedEvidence.push(evidence);
    }
    if (supportedEvidence.length === 0) continue;

    const exactOptionalText = (...candidateValues) => {
      const value = truncate(firstText(...candidateValues), 180);
      return value && supportedEvidence.some((evidence) =>
        evidenceSupportsExactText(evidence, value)
      )
        ? value
        : '';
    };
    const organization = kind === 'organization'
      ? displayLabel
      : exactOptionalText(raw.o, raw.organization, raw.company);
    candidates.push(compact({
      id: `candidate:model:${stableHash({
        displayLabel,
        kind,
        evidenceRefs: supportedEvidence.map((item) => item.id)
      }).slice(0, 20)}`,
      kind: kind === 'organization' ? 'evidence_named_organization' : 'evidence_named_person',
      displayLabel,
      organization,
      role: exactOptionalText(raw.r, raw.role, raw.title),
      market: exactOptionalText(raw.m, raw.market, raw.location),
      providers: ['openrouter_evidence_extraction'],
      evidenceRefs: supportedEvidence.map((item) => item.id),
      contactPaths: [],
      exactNamedCandidate: true,
      identityResolved: true,
      modelCandidateIndex: index
    }));
  }
  return candidates;
}

function normalizeSeedMentionedOrganizationCandidates(seedSet, evidenceCatalog) {
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const offerProofRefs = new Set(
    [
      ...asArray(seedSet.offers),
      ...asArray(seedSet.proofPoints)
    ].flatMap((seed) =>
      asArray(asObject(seed).evidenceRefs)
        .map((ref) => evidenceByID.get(ref)?.id)
        .filter(Boolean)
    )
  );
  const candidatesByName = new Map();
  for (const buyerSeedValue of asArray(seedSet.buyerSegments)) {
    const buyerSeed = asObject(buyerSeedValue);
    const buyerRefs = new Set(
      asArray(buyerSeed.evidenceRefs)
        .map((ref) => evidenceByID.get(ref)?.id)
        .filter(Boolean)
    );
    for (const displayLabel of seedMentionedOrganizationNames(
      buyerSeed.label
    )) {
      const key = comparable(displayLabel);
      const existing = candidatesByName.get(key) || {
        displayLabel,
        evidenceRefs: new Set()
      };
      for (const evidenceRef of buyerRefs) {
        const evidence = evidenceByID.get(evidenceRef);
        if (!evidence ||
            !offerProofRefs.has(evidence.id) ||
            !evidenceSupportsExactText(evidence, displayLabel)) {
          continue;
        }
        existing.evidenceRefs.add(evidence.id);
      }
      if (existing.evidenceRefs.size > 0) {
        candidatesByName.set(key, existing);
      }
    }
  }
  return [...candidatesByName.values()]
    .slice(0, 8)
    .map(({ displayLabel, evidenceRefs: refSet }) => {
      const evidenceRefs = [...refSet];
      return {
        id: `candidate:seed:${stableHash({
          displayLabel,
          evidenceRefs
        }).slice(0, 20)}`,
        kind: 'evidence_named_organization',
        displayLabel,
        organization: displayLabel,
        providers: ['openrouter_seed_extraction'],
        evidenceRefs,
        contactPaths: [],
        exactNamedCandidate: true,
        identityResolved: true
      };
    });
}

function seedMentionedOrganizationNames(value) {
  const matches = String(value || '').match(
    /\b[A-Z][\p{L}\p{N}&.'’+-]*(?:\s+(?:[A-Z][\p{L}\p{N}&.'’+-]*|and|of|the)){1,5}\b/gu
  ) || [];
  return compactStrings(matches)
    .map((match) => match.trim().replace(/[.,;:!?]+$/, ''))
    .filter((match) =>
      /\b(?:association|bank|co|company|corporation|foundation|healthcare|hospital|inc|insurance|labs|llc|ltd|plc|university)\b/i.test(match)
    )
    .filter(concreteCandidateLabel);
}

function evidenceSupportsExactText(evidence, value) {
  const haystack = compactStrings([
    asObject(evidence).label,
    asObject(evidence).summary
  ]).join(' ');
  return exactTextContains(haystack, value);
}

function evidenceSupportsExactTimingText(evidence, value, timingLabel) {
  if (!evidenceSupportsExactText(evidence, value)) return false;
  const evidenceTokens = comparable(compactStrings([
    asObject(evidence).label,
    asObject(evidence).summary
  ]).join(' ')).split(' ');
  const phraseTokens = comparable(value).split(' ').filter(Boolean);
  if (phraseTokens.length === 0) return false;
  const negativeTokens = new Set([
    'no',
    'not',
    'never',
    'without',
    'unknown',
    'unconfirmed',
    'missing',
    'lack',
    'lacks',
    'neither',
    'closed',
    'unavailable',
    'absent',
    'ended',
    'expired'
  ]);
  const staleTokens = new Set([
    'archived',
    'former',
    'formerly',
    'historical',
    'historic',
    'inactive',
    'obsolete',
    'old',
    'outdated',
    'previous',
    'previously',
    'superseded'
  ]);
  const directTimingClaim = !timingIsVerificationStep(timingLabel);
  for (let index = 0;
    index + phraseTokens.length <= evidenceTokens.length;
    index += 1) {
    if (!phraseTokens.every((token, offset) =>
      evidenceTokens[index + offset] === token
    )) {
      continue;
    }
    const context = [
      ...evidenceTokens.slice(Math.max(0, index - 12), index),
      ...evidenceTokens.slice(
        index + phraseTokens.length,
        index + phraseTokens.length + 12
      )
    ];
    const historicallyQualified = directTimingClaim &&
      [...phraseTokens, ...context].some((token) => staleTokens.has(token));
    if (!context.some((token) => negativeTokens.has(token)) &&
        !historicallyQualified) {
      return true;
    }
  }
  return false;
}

function repairTimingAsVerification(
  evidenceRefs,
  evidenceByID,
  referenceTime
) {
  for (const id of compactStrings(evidenceRefs)) {
    if (!/^observation:/i.test(id)) continue;
    const evidence = asObject(evidenceByID.get(id));
    if (!timingEvidenceIsSafe(evidence, referenceTime)) continue;
    const supportPhrase = timingVerificationSupportPhrase(evidence);
    if (!supportPhrase) continue;
    const label = truncate(
      `Determine whether the cited fact "${supportPhrase}" supports acting`,
      180
    );
    if (!evidenceSupportsExactTimingText(evidence, supportPhrase, label) ||
        !timingSupportPhraseGroundsLabel(label, supportPhrase)) {
      continue;
    }
    return {
      label,
      supportPhrase,
      supportEvidenceRefs: [id]
    };
  }
  return null;
}

function timingEvidenceIsSafe(evidence, referenceTime) {
  if (asObject(evidence).approvedSourceObservation !== true) return false;
  if (asObject(evidence).current === false ||
      /\b(?:absent|archived|cancelled|canceled|closed|discontinued|ended|expired|former|formerly|historical|historic|inactive|lack|lacks|missing|neither|never|no|not|obsolete|old|outdated|previous|previously|superseded|unavailable|unconfirmed|unknown|was|without|withdrawn)\b/i.test(
        firstText(asObject(evidence).status)
      )) {
    return false;
  }
  const referenceDate = new Date(referenceTime);
  const observedDate = new Date(firstText(asObject(evidence).observedAt));
  if (!Number.isFinite(referenceDate.getTime()) ||
      !Number.isFinite(observedDate.getTime())) {
    return false;
  }
  const observationAge = referenceDate.getTime() - observedDate.getTime();
  if (observationAge < -MAX_TIMING_VERIFICATION_FUTURE_SKEW_MS ||
      observationAge > MAX_TIMING_VERIFICATION_OBSERVATION_AGE_MS) {
    return false;
  }
  if (informationalAssetEvidence(evidence)) {
    const publishedDate = new Date(firstText(evidence.publishedAt));
    if (Number.isFinite(publishedDate.getTime()) &&
        referenceDate.getTime() - publishedDate.getTime() >
          MAX_TIMING_VERIFICATION_OBSERVATION_AGE_MS) {
      return false;
    }
  }
  const rawEndDate = firstText(asObject(evidence).endDate);
  if (rawEndDate) {
    const endDate = new Date(rawEndDate);
    if (!Number.isFinite(endDate.getTime()) ||
        endDate.getTime() < referenceDate.getTime()) {
      return false;
    }
  }
  const text = comparable(compactStrings([
    asObject(evidence).label,
    asObject(evidence).summary
  ]).join(' '));
  if (!text) return false;
  // Verification repair is allowed only for an affirmative, current-looking
  // observation. A single negation or stale qualifier makes the fallback fail
  // closed so archived/closed evidence cannot be reframed as a live trigger.
  if (/\b(?:no|not|never|without|unknown|unconfirmed|missing|lack|lacks|neither|closed|unavailable|absent|ended|expired|archived|cancelled|canceled|discontinued|former|formerly|historical|historic|inactive|obsolete|old|outdated|previous|previously|superseded|was|withdrawn)\b/.test(
    text
  )) {
    return false;
  }
  const referenceYear = referenceDate.getUTCFullYear();
  return !(text.match(/\b20\d{2}\b/g) || [])
    .some((year) => Number(year) < referenceYear);
}

function timingVerificationSupportPhrase(evidence) {
  const candidates = compactStrings([
    asObject(evidence).label,
    ...String(asObject(evidence).summary || '').split(/[.!?;\n]+/)
  ]);
  const operationalSignal =
    /\b(?:accepts?|accepted|available|availability|book|booked|booking|call now|currently|live|offers?|open|provides?|same day|same-day|schedule|scheduled|scheduling|today)\b/i;
  for (const candidate of candidates) {
    const phrase = exactPhraseWindow(candidate, operationalSignal, 24);
    if (phrase) return phrase;
  }
  for (const candidate of candidates) {
    const phrase = exactPhraseWindow(candidate, /[\p{L}\p{N}]/u, 24);
    if (phrase && meaningfulTokens(phrase).size >= 3) return phrase;
  }
  return '';
}

function exactPhraseWindow(value, signalPattern, maxWords) {
  const text = firstText(value).replace(/\s+/g, ' ').trim();
  if (!text || !signalPattern.test(text)) return '';
  const words = text.split(' ');
  const match = text.match(signalPattern);
  if (!match || match.index == null) return '';
  const before = text.slice(0, match.index).trim();
  const matchWordIndex = before ? before.split(' ').length : 0;
  const start = Math.max(
    0,
    Math.min(matchWordIndex - Math.floor(maxWords / 3), words.length - maxWords)
  );
  const boundedWords = words.slice(start, start + maxWords);
  while (boundedWords.length > 1 &&
      boundedWords.join(' ').length > 120) {
    boundedWords.pop();
  }
  const phrase = boundedWords.join(' ');
  return signalPattern.test(phrase) ? phrase : '';
}

function exactTextContains(haystackValue, needleValue) {
  const haystack = comparable(haystackValue);
  const needle = comparable(needleValue);
  return Boolean(needle) && ` ${haystack} `.includes(` ${needle} `);
}

function dedupeSourceEvidenceByCanonicalPage(values) {
  const selectedByPage = new Map();
  for (const [index, value] of asArray(values).entries()) {
    const evidence = asObject(value);
    const sourceID = firstText(evidence.sourceId, evidence.sourceID);
    const pageURL = canonicalPublicPageURL(firstText(
      evidence.url,
      evidence.sourceUrl,
      evidence.publicUrl
    ));
    const recordID = firstText(
      evidence.observationId,
      evidence.evidenceRef,
      evidence.factId,
      evidence.id
    );
    const key = pageURL
      ? `${sourceID}|url:${pageURL}`
      : `${sourceID}|record:${recordID || stableHash({
          label: firstText(evidence.label, evidence.title),
          summary: firstText(evidence.summary, evidence.description),
          index
        })}`;
    const candidate = {
      evidence: value,
      index,
      freshness: sourceEvidenceFreshness(evidence),
      quality: rawSourceEvidenceQuality(evidence)
    };
    const existing = selectedByPage.get(key);
    if (!existing ||
        candidate.freshness > existing.freshness ||
        (
          candidate.freshness === existing.freshness &&
          (
            candidate.quality > existing.quality ||
            (
              candidate.quality === existing.quality &&
              candidate.index > existing.index
            )
          )
        )) {
      selectedByPage.set(key, candidate);
    }
  }
  return [...selectedByPage.values()]
    .sort((left, right) =>
      right.freshness - left.freshness ||
      right.quality - left.quality ||
      right.index - left.index
    )
    .map((item) => item.evidence);
}

function sourceEvidenceFreshness(value) {
  const evidence = asObject(value);
  for (const timestamp of compactStrings([
    evidence.observedAt,
    evidence.crawledAt,
    evidence.fetchedAt,
    evidence.updatedAt,
    evidence.createdAt,
    evidence.publishedAt
  ])) {
    const date = new Date(timestamp);
    if (Number.isFinite(date.getTime())) return date.getTime();
  }
  return 0;
}

function rawSourceEvidenceQuality(value) {
  const evidence = asObject(value);
  let score = 0;
  if (firstText(evidence.summary, evidence.description)) score += 4;
  if (firstText(evidence.title, evidence.label)) score += 2;
  if (evidence.current === true) score += 2;
  if (evidence.current === false) score -= 4;
  if (comparable(firstText(evidence.confidence, evidence.trustLevel)) ===
      'high') {
    score += 1;
  }
  return score;
}

function canonicalPublicPageURL(value) {
  const raw = safePublicURL(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hostname = canonicalPublicHostname(parsed.hostname);
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString().toLowerCase();
  } catch {
    return '';
  }
}

function canonicalPublicHostname(value) {
  return firstText(value).toLowerCase().replace(/^www\./, '');
}

function publicURLsShareCanonicalOrigin(leftValue, rightValue) {
  try {
    const left = leftValue instanceof URL
      ? leftValue
      : new URL(safePublicURL(leftValue));
    const right = rightValue instanceof URL
      ? rightValue
      : new URL(safePublicURL(rightValue));
    return left.protocol === right.protocol &&
      canonicalPublicHostname(left.hostname) ===
        canonicalPublicHostname(right.hostname) &&
      left.port === right.port;
  } catch {
    return false;
  }
}

function sourceIsResearchApproved(source) {
  return RESEARCH_APPROVED_SOURCE_STATUSES.has(
    comparable(asObject(source).status)
  );
}

function profileDeclaredControlledURLs(profileValue) {
  const profile = asObject(profileValue);
  const identity = asObject(profile.identity);
  const declarations = [
    ['website', identity.website],
    ['booking', identity.bookingUrl],
    ['booking', identity.bookingURL],
    ['website', profile.website],
    ['booking', profile.bookingUrl],
    ['booking', profile.bookingURL]
  ];
  const seen = new Set();
  return declarations
    .map(([kind, value]) => ({
      kind,
      url: safePublicURL(value)
    }))
    .filter(({ kind, url }) => {
      const key = `${kind}:${url}`;
      if (!url || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function profileControlsSource(sourceValue, controlledURLs) {
  const sourceURL = safePublicURL(firstText(
    asObject(sourceValue).url,
    asObject(sourceValue).sourceUrl
  ));
  if (!sourceURL) return false;
  try {
    const source = new URL(sourceURL);
    const sourcePath = source.pathname.replace(/\/+$/, '') || '/';
    return asArray(controlledURLs).some((controlledValue) => {
      try {
        const declaration = asObject(controlledValue);
        const controlled = new URL(declaration.url);
        if (!publicURLsShareCanonicalOrigin(source, controlled)) {
          return false;
        }
        if (declaration.kind === 'booking') {
          if (!urlContainsDeclaredQuery(source, controlled)) return false;
        }
        const controlledPath = controlled.pathname.replace(/\/+$/, '') || '/';
        if (declaration.kind === 'website' && controlledPath === '/') {
          return true;
        }
        return sourcePath === controlledPath ||
          sourcePath.startsWith(`${controlledPath}/`);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function urlContainsDeclaredQuery(candidate, declaration) {
  const declaredKeys = [
    ...new Set([...declaration.searchParams.keys()])
  ];
  for (const key of declaredKeys) {
    const declaredValues = declaration.searchParams.getAll(key).sort();
    const candidateValues = candidate.searchParams.getAll(key).sort();
    if (declaredValues.length !== candidateValues.length ||
        declaredValues.some(
          (value, index) => value !== candidateValues[index]
        )) {
      return false;
    }
  }
  return true;
}

function concreteCandidateLabel(value) {
  const label = firstText(value);
  const normalized = comparable(label);
  if (!normalized || normalized.length < 2) return false;
  if (/^(?:a|an|some|any)\s+/i.test(label)) return false;
  if (/\b(?:buyer segments?|audiences?|prospects?|businesses|founders|leaders|consultants|operators|agencies|companies|organizations)\s*$/i.test(label)) {
    return false;
  }
  return /[a-z]/i.test(label);
}

function organizationLikeCandidateLabel(value) {
  const label = firstText(value);
  return /\b(?:association|bank|clinic|co|company|corporation|foundation|group|healthcare|health[- ]plan|health system|hospital|inc|insurance|labs|llc|ltd|network|organization|partners|plc|practice|services|uhc|united[\s-]*healthcare|university)\b(?:[.,]?\s*)$/i.test(
    label
  );
}

function structuredCandidateFromTimelinePost(value, profileScribePublicBaseURL) {
  const post = asObject(value);
  const author = asObject(post.author);
  const slug = firstText(post.authorSlug, author.slug, post.slug);
  const displayLabel = firstText(
    post.authorName,
    author.fullName,
    author.name,
    slug
  );
  if (!displayLabel) return null;
  const publicUrl = firstText(
    post.authorProfileUrl,
    post.authorPublicUrl,
    author.publicUrl,
    author.profileUrl,
    slug ? internalProfileURL(profileScribePublicBaseURL, slug) : ''
  );
  const postID = firstText(post.id, post.postId);
  const ownerTenantID = firstText(post.ownerTenantId, author.tenantId);
  const ownerUserID = firstText(post.ownerUserId, author.userId);
  const evidenceRefs = compactStrings([
    postID ? `timeline:${postID}` : '',
    ...asArray(post.evidenceRefs)
  ]);
  return compact({
    id: firstText(
      post.authorCandidateId,
      ownerTenantID && ownerUserID
        ? `candidate:profilescribe:${ownerTenantID}:${ownerUserID}`
        : '',
      slug ? `candidate:profilescribe:${slug}` : ''
    ),
    kind: 'profilescribe_profile',
    displayLabel,
    organization: firstText(
      post.authorCompany,
      author.company,
      author.organization
    ),
    role: firstText(
      post.authorHeadline,
      author.headline,
      author.role
    ),
    market: firstText(
      post.authorLocation,
      author.location,
      author.market
    ),
    publicUrl,
    authorSlug: slug,
    providers: ['profilescribe_internal'],
    evidenceRefs,
    contactPaths: publicUrl ? [{
      kind: 'profilescribe_profile',
      available: true,
      verified: true,
      reference: publicUrl
    }] : [],
    exactNamedCandidate: true,
    identityResolved: Boolean(slug || (ownerTenantID && ownerUserID)),
    discoveredAt: firstText(post.publishedAt, post.createdAt)
  });
}

function structuredCandidatesFromEvidence(value, profileScribePublicBaseURL) {
  const evidence = asObject(value);
  const metadata = asObject(evidence.metadata);
  const explicit = [
    evidence.candidate,
    evidence.person,
    evidence.author,
    evidence.professionalProfile,
    ...asArray(evidence.candidates),
    ...asArray(evidence.people),
    ...asArray(evidence.persons),
    ...asArray(evidence.authors),
    metadata.candidate,
    metadata.person,
    metadata.author,
    metadata.professionalProfile,
    ...asArray(metadata.candidates),
    ...asArray(metadata.people),
    ...asArray(metadata.persons),
    ...asArray(metadata.authors)
  ].map(asObject).filter((item) => Object.keys(item).length > 0);
  const directName = firstText(
    evidence.candidateName,
    evidence.personName,
    evidence.authorName,
    metadata.candidateName,
    metadata.personName,
    metadata.authorName
  );
  if (directName) {
    explicit.push({
      displayLabel: directName,
      id: firstText(
        evidence.candidateId,
        evidence.personId,
        evidence.authorId,
        metadata.candidateId,
        metadata.personId,
        metadata.authorId
      ),
      role: firstText(
        evidence.candidateRole,
        evidence.personRole,
        evidence.authorHeadline,
        metadata.candidateRole,
        metadata.personRole,
        metadata.authorHeadline
      ),
      organization: firstText(
        evidence.candidateOrganization,
        evidence.personOrganization,
        evidence.authorCompany,
        metadata.candidateOrganization,
        metadata.personOrganization,
        metadata.authorCompany
      ),
      market: firstText(
        evidence.candidateMarket,
        evidence.personMarket,
        evidence.authorLocation,
        metadata.candidateMarket,
        metadata.personMarket,
        metadata.authorLocation
      ),
      publicUrl: firstText(
        evidence.candidatePublicUrl,
        evidence.personPublicUrl,
        evidence.authorProfileUrl,
        metadata.candidatePublicUrl,
        metadata.personPublicUrl,
        metadata.authorProfileUrl
      ),
      authorSlug: firstText(
        evidence.candidateSlug,
        evidence.personSlug,
        evidence.authorSlug,
        metadata.candidateSlug,
        metadata.personSlug,
        metadata.authorSlug
      )
    });
  }
  const kind = comparable(firstText(evidence.kind, metadata.kind));
  const explicitlyPersonKind = new Set([
    'person',
    'candidate',
    'author',
    'professional profile',
    'profile person'
  ]).has(kind);
  if (explicitlyPersonKind &&
      firstText(evidence.displayLabel, evidence.fullName, evidence.name)) {
    explicit.push({
      id: firstText(evidence.candidateId, evidence.personId),
      displayLabel: firstText(evidence.displayLabel, evidence.fullName, evidence.name),
      role: firstText(evidence.role, evidence.headline),
      organization: firstText(evidence.organization, evidence.company),
      market: firstText(evidence.market, evidence.location),
      publicUrl: firstText(evidence.publicUrl, evidence.profileUrl),
      authorSlug: firstText(evidence.authorSlug, evidence.slug)
    });
  }

  const evidenceRef = structuredEvidenceRef(evidence);
  return explicit
    .map((person, index) => structuredCandidateFromPersonObject({
      person,
      evidence,
      evidenceRef,
      index,
      profileScribePublicBaseURL
    }))
    .filter(Boolean);
}

function structuredCandidateFromPersonObject({
  person,
  evidence,
  evidenceRef,
  index,
  profileScribePublicBaseURL
}) {
  person = asObject(person);
  const slug = firstText(
    person.authorSlug,
    person.profileSlug,
    person.slug,
    person.username
  );
  const displayLabel = firstText(
    person.displayLabel,
    person.fullName,
    person.name,
    person.authorName,
    person.personName,
    person.candidateName,
    slug
  );
  if (!displayLabel) return null;
  const publicUrl = firstText(
    person.publicUrl,
    person.profileUrl,
    person.authorProfileUrl,
    person.candidatePublicUrl,
    person.personPublicUrl,
    slug ? internalProfileURL(profileScribePublicBaseURL, slug) : ''
  );
  return compact({
    id: firstText(
      person.id,
      person.candidateId,
      person.personId,
      slug ? `candidate:profilescribe:${slug}` : '',
      `candidate:evidence:${stableHash(`${evidenceRef}|${displayLabel}|${index}`).slice(0, 20)}`
    ),
    kind: firstText(person.kind, slug ? 'profilescribe_profile' : 'source_evidence_person'),
    displayLabel,
    organization: firstText(
      person.organization,
      person.company,
      person.authorCompany
    ),
    role: firstText(
      person.role,
      person.headline,
      person.title,
      person.authorHeadline
    ),
    market: firstText(
      person.market,
      person.location,
      person.authorLocation
    ),
    publicUrl,
    authorSlug: slug,
    providers: compactStrings([
      ...asArray(person.providers),
      firstText(person.provider),
      slug ? 'profilescribe_internal' : 'source_evidence'
    ]),
    evidenceRefs: compactStrings([
      evidenceRef,
      ...asArray(person.evidenceRefs)
    ]),
    contactPaths: publicUrl ? [{
      kind: slug ? 'profilescribe_profile' : 'public_profile',
      available: true,
      verified: Boolean(slug),
      reference: publicUrl
    }] : [],
    exactNamedCandidate: true,
    identityResolved: true,
    discoveredAt: firstText(
      person.discoveredAt,
      evidence.observedAt,
      evidence.createdAt
    )
  });
}

function structuredEvidenceRef(evidence) {
  return firstText(
    evidence.evidenceRef,
    evidence.observationId ? `observation:${evidence.observationId}` : '',
    evidence.factId ? `fact:${evidence.factId}` : '',
    evidence.sourceId ? `source:${evidence.sourceId}` : ''
  );
}

function normalizeGeneratedEvidenceExperiment(
  value,
  evidenceCatalog,
  referenceTime
) {
  const raw = asObject(value);
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const evidenceRefs = compactStrings([
    ...asArray(raw.e),
    ...asArray(raw.evidenceRefs)
  ])
    .map((ref) => evidenceByID.get(ref)?.id)
    .filter(Boolean)
    .filter((ref, index, refs) => refs.indexOf(ref) === index)
    .slice(0, 12);
  const title = truncate(firstText(raw.l, raw.title), 240);
  const knownFact = truncate(firstText(raw.k, raw.knownFact), 320);
  const buyer = truncate(firstText(raw.b, raw.buyer), 240);
  const paidOffer = truncate(firstText(raw.o, raw.paidOffer), 240);
  const acquisitionMechanism = truncate(firstText(
    raw.a,
    raw.acquisitionMechanism
  ), 240);
  const conversionDestination = truncate(firstText(
    raw.d,
    raw.conversionDestination
  ), 240);
  const paidConversion = truncate(firstText(
    raw.c,
    raw.paidConversion
  ), 240);
  const attributionSignal = truncate(firstText(
    raw.t,
    raw.attributionSignal
  ), 320);
  const action = truncate(firstText(raw.x, raw.action), 700);
  const successSignal = truncate(firstText(
    raw.s,
    raw.successSignal
  ), 360);
  const durationDays =
    positiveInteger(raw.days) ||
    positiveInteger(raw.durationDays);
  const sampleLimit =
    positiveInteger(raw.n) ||
    positiveInteger(raw.sampleLimit);
  const sampleUnit = truncate(firstText(
    raw.u,
    raw.sampleUnit
  ), 80);
  if (evidenceRefs.length === 0 ||
      !title ||
      !knownFact ||
      !buyer ||
      !paidOffer ||
      !acquisitionMechanism ||
      !conversionDestination ||
      !paidConversion ||
      !attributionSignal ||
      !action ||
      !successSignal ||
      durationDays < 7 ||
      durationDays > 30 ||
      sampleLimit < 5 ||
      sampleLimit > 100 ||
      !sampleUnit) {
    return null;
  }
  const userCopy = `${title} ${action} ${successSignal}`;
  if (/\b(?:approve source|approve observation|evidence approval|evidence id|crawl|generator|validator|retained strateg|missing[_ ])\b/i.test(
    userCopy
  ) ||
      experimentActionHasExternalExecution(action) ||
      !/\b(?:count|inspect|measure|monitor|observe|record|review|track)\b/i.test(
        action
      ) ||
      !/\breview(?: first|-first)?\b/i.test(action)) {
    return null;
  }
  const citedText = compactStrings(
    evidenceRefs.map((ref) => {
      const evidence = asObject(evidenceByID.get(ref));
      return compactStrings([
        evidence.label,
        evidence.summary,
        evidence.url
      ]).join(' ');
    })
  ).join(' ');
  if (evidenceRefs.some((ref) =>
    !currentApprovedExperimentEvidence(
      evidenceByID.get(ref),
      referenceTime
    )
  )) {
    return null;
  }
  const asset = evidenceRefs
    .map((ref) => evidenceByID.get(ref))
    .filter((evidence) =>
      approvedOwnedAssetEvidence(evidence, evidenceByID) &&
      inboundAssetEvidenceSupportsPaidConversion(
        evidence,
        referenceTime
      )
    )
    .sort((left, right) =>
      inboundAssetConversionReadiness(right) -
        inboundAssetConversionReadiness(left) ||
      evidenceQuality(right) - evidenceQuality(left)
    )[0];
  const assetText = compactStrings([
    asset?.label,
    asset?.summary,
    asset?.url
  ]).join(' ');
  if (textOverlap(knownFact, citedText) <= 0 ||
      !asset ||
      textOverlap(title, assetText) <= 0 ||
      textOverlap(buyer, assetText) <= 0 ||
      !paidOfferText(assetText) ||
      textOverlap(paidOffer, assetText) <= 0 ||
      !conversionDestinationText(conversionDestination) ||
      !conversionDestinationEvidenceText(assetText) ||
      textOverlap(conversionDestination, assetText) <= 0 ||
      comparable(acquisitionMechanism) ===
        comparable(conversionDestination) ||
      !experimentInboundAcquisitionMechanismText(
        acquisitionMechanism
      ) ||
      !observableRevenueText(paidConversion) ||
      !observableRevenueText(successSignal) ||
      ![...ATTRIBUTION_METHODS].some((method) =>
        attributionSignalText(attributionSignal, method)
      ) ||
      ![
        buyer,
        paidOffer,
        acquisitionMechanism,
        conversionDestination,
        paidConversion,
        attributionSignal
      ]
        .every((component) => textOverlap(component, action) > 0) ||
      !action.includes(String(durationDays)) ||
      !action.includes(String(sampleLimit))) {
    return null;
  }
  return {
    title,
    knownFact,
    buyer,
    paidOffer,
    acquisitionMechanism,
    conversionDestination,
    paidConversion,
    attributionSignal,
    action,
    successSignal,
    durationDays,
    sampleLimit,
    sampleUnit,
    evidenceRefs,
    asset: asset
      ? {
          label: truncate(firstText(asset.label), 180),
          publicUrl: safePublicURL(asset.url)
        }
      : null
  };
}

function experimentInboundAcquisitionMechanismText(value) {
  return /\b(?:agent mediated|app store|community|comparison (?:listing|site)|directory|earned media|google business profile|job board|local search|marketplace discovery|nonbranded search|organic search|platform discovery|search engine|search listing)\b/i.test(
    firstText(value)
  );
}

function experimentActionHasExternalExecution(value) {
  const text = firstText(value);
  const pattern =
    /\b(?:send|email|call|message|share|invite|outreach|publish|publishing|post|posting|advertis(?:e|ing)|ads?|newsletter distribution|social distribution|content distribution|submit(?:ting)? forms?|form submission|provider writes?)\b/gi;
  for (const match of text.matchAll(pattern)) {
    const before = text.slice(0, match.index);
    const segmentStart = Math.max(
      before.lastIndexOf('.'),
      before.lastIndexOf(';'),
      before.lastIndexOf('\n')
    ) + 1;
    const prefix = before.slice(segmentStart);
    const suffix = text.slice(
      match.index + match[0].length,
      match.index + match[0].length + 50
    );
    const negatedBefore =
      /\b(?:no|not|never|without|do not|does not|must not|cannot|can't|will not)\b[^.;]*$/i.test(
        prefix
      ) &&
      !/\b(?:but|then|however|except)\b[^.;]*$/i.test(prefix);
    const negatedAfter =
      /^\s+(?:is|are|was|were|will be|remain)\s+not\s+(?:authorized|allowed|permitted)\b/i.test(
        suffix
      );
    if (!negatedBefore && !negatedAfter) return true;
  }
  return false;
}

function currentApprovedExperimentEvidence(
  evidenceValue,
  referenceTime
) {
  const evidence = asObject(evidenceValue);
  if (evidence.approvedSourceObservation !== true ||
      evidence.current === false ||
      /\b(?:archived|cancelled|canceled|closed|discontinued|ended|expired|inactive|not accepting|sold out|unavailable|withdrawn)\b/i.test(
        firstText(evidence.status)
      )) {
    return false;
  }
  const referenceDate = new Date(referenceTime);
  const observedDate = new Date(firstText(evidence.observedAt));
  if (!Number.isFinite(referenceDate.getTime()) ||
      !Number.isFinite(observedDate.getTime())) {
    return false;
  }
  const age = referenceDate.getTime() - observedDate.getTime();
  if (age < -MAX_TIMING_VERIFICATION_FUTURE_SKEW_MS ||
      age > MAX_INBOUND_ASSET_OBSERVATION_AGE_MS) {
    return false;
  }
  const rawEndDate = firstText(evidence.endDate);
  if (rawEndDate) {
    const endDate = new Date(rawEndDate);
    if (!Number.isFinite(endDate.getTime()) ||
        endDate.getTime() < referenceDate.getTime()) {
      return false;
    }
  }
  const rawText = compactStrings([
    evidence.label,
    evidence.summary,
    evidence.url
  ]).join(' ');
  const text = comparable(rawText);
  if (!text ||
      /\b(?:archived|cancelled|canceled|closed|discontinued|ended|expired|inactive|no longer (?:available|offered|accepting|bookable)|not (?:available|accepting|bookable)|sold out|unavailable|withdrawn)\b/.test(
        text
      ) ||
      /\b(?:no|not|without)\s+(?:a\s+)?(?:paid|billable|bookable|purchasable|reimbursable) (?:offer|service|consultation|session|booking|option|plan|contract|role)\b/.test(
        text
      ) ||
      /\b(?:is|are|was|were)\s+not\s+(?:paid|billable|reimbursable|reimbursed|covered|compensated)\b/.test(
        text
      )) {
    return false;
  }
  const namesFreeOption =
    /\b(?:complimentary|free trial|freemium|free|no fee|without charge|zero cost)\b/.test(
      text
    );
  const namesPaidAlternative =
    /\b(?:paid (?:plan|tier|subscription|option|version|license)|pricing|price|starts at|subscription fee|license fee|purchase|checkout)\b/.test(
      text
    ) ||
    /\$\s*\d/.test(rawText);
  return !namesFreeOption || namesPaidAlternative;
}

function revenueEvidenceExperiment({
  objective,
  evidenceCatalog,
  evidenceHash,
  missingEvidence,
  referenceTime,
  generatedExperiment
}) {
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const missing = compactStrings(missingEvidence)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 8);
  const technicalRecovery = strategyGenerationRecoveryExperiment({
    objective,
    evidenceHash,
    missingEvidence: missing
  });
  // Technical recovery fixes provider, budget, or response-shape state. Return
  // it before attaching business-only fields so it cannot masquerade as a
  // sourced buyer, offer, funnel, conversion, or attribution recommendation.
  if (technicalRecovery) return technicalRecovery;
  const objectiveText = compactStrings([
    objective?.outcome,
    objective?.successMetric
  ]).join(' ');
  const asset = selectCurrentOwnedPaidAsset(
    evidenceCatalog,
    evidenceByID,
    objectiveText,
    referenceTime
  );
  // Once a current owner-controlled paid destination is present, the bounded
  // experiment should measure the acquisition/attribution gap around that
  // offer. Do not tell the owner to supply the same offer page again or expose
  // an internal family-shape failure as their business task.
  const userReadableMissingEvidence = asset
    ? [
        'observed qualified demand from one named discovery path',
        'a paid-conversion record carrying that discovery source'
      ]
    : humanizeMissingRevenueEvidence(missing);
  if (generatedExperiment &&
      generatedExperimentMatchesFailureContext(
        generatedExperiment,
        objective,
        missing
      )) {
    const kind = generatedExperiment.asset
      ? 'inbound_revenue_evidence'
      : 'revenue_path_grounding';
    return {
      contractVersion: REVENUE_EVIDENCE_EXPERIMENT_CONTRACT,
      id: `experiment-${stableHash({
        kind,
        evidenceHash,
        missing,
        generatedExperiment
      }).slice(0, 24)}`,
      kind,
      title: generatedExperiment.title,
      knownFact: generatedExperiment.knownFact,
      buyer: generatedExperiment.buyer,
      paidOffer: generatedExperiment.paidOffer,
      acquisitionMechanism: generatedExperiment.acquisitionMechanism,
      conversionDestination: generatedExperiment.conversionDestination,
      paidConversion: generatedExperiment.paidConversion,
      attributionSignal: generatedExperiment.attributionSignal,
      action: generatedExperiment.action,
      missingEvidence: userReadableMissingEvidence.length > 0
        ? userReadableMissingEvidence
        : ['an attributable paid conversion'],
      paidOutcome: generatedExperiment.paidConversion,
      successSignal: generatedExperiment.successSignal,
      stopCondition:
        `Stop after ${generatedExperiment.sampleLimit} ${generatedExperiment.sampleUnit} or ${generatedExperiment.durationDays} calendar days, whichever comes first, followed by at most 1 rerun informed by the recorded result; do not expand volume automatically.`,
      asset: generatedExperiment.asset,
      evidenceRefs: generatedExperiment.evidenceRefs,
      requiresReview: true,
      rerunPolicy: {
        maxReruns: 1,
        trigger:
          'Rerun only after the bounded test records its result or the named business facts materially change.'
      }
    };
  }
  const anchor = asset || asArray(evidenceCatalog)
    .map(asObject)
    .filter((evidence) =>
      evidence.approvedSourceObservation === true
    )
    .sort((left, right) => {
      const relevanceDifference =
        textOverlap(
          objectiveText,
          `${right.label || ''} ${right.summary || ''}`
        ) -
        textOverlap(
          objectiveText,
          `${left.label || ''} ${left.summary || ''}`
        );
      return relevanceDifference ||
        evidenceQuality(right) - evidenceQuality(left) ||
        firstText(left.id).localeCompare(firstText(right.id));
    })[0];
  const assetLabel = truncate(firstText(asset?.label), 180);
  const assetURL = safePublicURL(asset?.url);
  const anchorLabel = truncate(firstText(
    anchor?.label,
    'one paid professional offer'
  ), 180);
  const evidenceRefs = anchor?.id ? [anchor.id] : [];
  const kind = asset
    ? 'inbound_revenue_evidence'
    : 'revenue_path_grounding';
  const experimentPlan = asset
    ? ownedAssetEvidenceExperimentPlan(asset)
    : revenuePathGroundingExperimentPlan({
        anchor,
        anchorLabel,
        objective
      });
  const title = experimentPlan.title;
  const action = experimentPlan.action;
  const successSignal = experimentPlan.successSignal;
  const stopCondition =
    asset
      ? 'Stop after 25 qualified visits, 1 attributable paid outcome, or 14 calendar days, whichever comes first, followed by at most 1 rerun informed by the result; do not expand volume automatically.'
      : 'Stop after 1 current paid-offer page or attributable revenue record, or 14 calendar days, followed by at most 1 rerun; do not launch or expand an external test automatically.';
  return {
    contractVersion: REVENUE_EVIDENCE_EXPERIMENT_CONTRACT,
    id: `experiment-${stableHash({
      kind,
      evidenceHash,
      missing,
      asset: asset?.id
    }).slice(0, 24)}`,
    kind,
    title: truncate(title, 240),
    knownFact: experimentPlan.knownFact,
    buyer: experimentPlan.buyer,
    paidOffer: experimentPlan.paidOffer,
    acquisitionMechanism: experimentPlan.acquisitionMechanism,
    conversionDestination: experimentPlan.conversionDestination,
    paidConversion: experimentPlan.paidConversion,
    attributionSignal: experimentPlan.attributionSignal,
    action: truncate(action, 700),
    missingEvidence: userReadableMissingEvidence.length > 0
      ? userReadableMissingEvidence
      : ['an attributable paid conversion'],
    paidOutcome: truncate(
      observableRevenueText(objective?.successMetric)
        ? firstText(objective?.successMetric)
        : experimentPlan.paidConversion || successSignal,
      360
    ),
    successSignal,
    stopCondition,
    asset: asset
      ? {
          label: assetLabel,
          publicUrl: assetURL
        }
      : null,
    evidenceRefs,
    requiresReview: true,
    rerunPolicy: {
      maxReruns: 1,
      trigger:
        'Rerun only after the bounded test records its result or the named business facts materially change.'
    }
  };
}

function selectCurrentOwnedPaidAsset(
  evidenceCatalog,
  evidenceByID,
  objectiveText,
  referenceTime
) {
  return asArray(evidenceCatalog)
    .map(asObject)
    .filter((evidence) =>
      approvedOwnedAssetEvidence(evidence, evidenceByID) &&
      inboundAssetEvidenceSupportsPaidConversion(
        evidence,
        referenceTime
      )
    )
    .sort((left, right) => {
      const relevanceDifference =
        textOverlap(
          objectiveText,
          `${right.approvedSourceLabel || ''} ${right.label || ''} ${right.summary || ''} ${right.url || ''}`
        ) -
        textOverlap(
          objectiveText,
          `${left.approvedSourceLabel || ''} ${left.label || ''} ${left.summary || ''} ${left.url || ''}`
        );
      const readinessDifference =
        inboundAssetConversionReadiness(right) -
        inboundAssetConversionReadiness(left);
      return relevanceDifference ||
        readinessDifference ||
        evidenceQuality(right) - evidenceQuality(left) ||
        firstText(left.id).localeCompare(firstText(right.id));
    })[0];
}

function ownedAssetEvidenceExperimentPlan(assetValue) {
  const asset = asObject(assetValue);
  const label = truncate(firstText(
    asset.label,
    'the current paid offer'
  ), 100);
  const text = comparable(compactStrings([
    asset.label,
    asset.summary,
    asset.url
  ]).join(' '));
  const outcome = ownedAssetAttributionOutcome(text);
  const buyer = truncate(
    `qualified buyers seeking ${label}`,
    160
  );
  const paidOffer = truncate(
    `${outcome.reimbursable ? 'the paid or reimbursable' : 'the paid'} ${label} offer`,
    220
  );
  const destination = truncate(
    `${label} conversion page`,
    140
  );
  const attributionSignal =
    `${outcome.record}'s source/origin field set to organic_search`;
  return {
    title: truncate(
      `Measure ${outcome.shortOutcome} from organic search for ${label}`,
      240
    ),
    knownFact: truncate(firstText(
      asset.summary,
      asset.label
    ), 320),
    buyer,
    paidOffer,
    acquisitionMechanism: 'organic search',
    conversionDestination: destination,
    paidConversion: outcome.paidConversion,
    attributionSignal,
    action: truncate(
      `Review first: for 14 days or 25 qualified organic-search visits, measure whether ${buyer} discover ${paidOffer} through organic search and complete ${outcome.paidConversion} at the ${destination}. Store organic_search in the ${outcome.record}'s source/origin field and count only that paid event. No outreach, publishing, advertising, form submission, or automatic execution is authorized.`,
      700
    ),
    successSignal: truncate(
      `One ${outcome.paidConversion} by ${buyer}, with organic_search stored in the ${outcome.record}'s source/origin field.`,
      360
    )
  };
}

function revenuePathGroundingExperimentPlan({
  anchor: anchorValue,
  anchorLabel,
  objective: objectiveValue
}) {
  const anchor = asObject(anchorValue);
  const objective = asObject(objectiveValue);
  const knownFact = truncate(
    firstText(
      anchor.summary,
      anchor.label,
      'No current approved evidence documents a complete attributable paid path.'
    ),
    320
  );
  const paidConversion = truncate(
    observableRevenueText(objective.successMetric)
      ? firstText(objective.successMetric)
      : 'one attributable paid booking, payment, order, signed contract, reimbursed claim, or compensated outcome',
    240
  );
  return {
    title: anchorValue
      ? `Define one attributable paid path for ${anchorLabel}`
      : 'Define one attributable paid offer',
    knownFact,
    buyer: truncate(
      `one specific buyer to document for ${anchorLabel}`,
      240
    ),
    paidOffer: truncate(
      `one current paid offer to document for ${anchorLabel}`,
      240
    ),
    acquisitionMechanism:
      'one singular acquisition path documented for the paid offer',
    conversionDestination:
      'one separate public booking, checkout, proposal, application, or payment destination',
    paidConversion,
    attributionSignal:
      'a source, referral, campaign, channel, or UTM field stored with the paid conversion record',
    action:
      `Review first: attach exactly 1 current public paid-offer page or 1 attributable revenue record for ${anchorLabel}. It must identify the buyer, paid offer, singular acquisition path, separate conversion destination, paid event, and the source field stored with that event. Stop after that 1 qualifying page or record, or after 14 calendar days; do not launch outreach, publishing, advertising, or provider actions.`,
    successSignal:
      'One new attributed revenue event—a paid booking, payment, order, signed contract, reimbursed claim, license or royalty payment, commission or referral fee, sponsorship payment, platform payout, or compensated-role payment—with a stored source, referral, campaign, channel, or UTM value.'
  };
}

function ownedAssetAttributionOutcome(textValue) {
  const text = comparable(textValue);
  if (/\b(?:compensated role|employment|salary|wage)\b/.test(text)) {
    return {
      shortOutcome: 'compensation payments',
      paidConversion: 'employment compensation payment',
      record: 'employment compensation record',
      reimbursable: false
    };
  }
  if (/\b(?:license|licensing|royalty)\b/.test(text)) {
    return {
      shortOutcome: 'license or royalty payments',
      paidConversion: 'license payment received',
      record: 'license or royalty record',
      reimbursable: false
    };
  }
  if (/\b(?:commission|referral fee|affiliate)\b/.test(text)) {
    return {
      shortOutcome: 'commission payments',
      paidConversion: 'commission paid',
      record: 'commission record',
      reimbursable: false
    };
  }
  if (/\b(?:sponsorship|sponsor)\b/.test(text)) {
    return {
      shortOutcome: 'sponsorship payments',
      paidConversion: 'sponsorship payment received',
      record: 'sponsorship contract record',
      reimbursable: false
    };
  }
  if (/\b(?:platform payout|marketplace payout)\b/.test(text)) {
    return {
      shortOutcome: 'platform payouts',
      paidConversion: 'platform payout recorded',
      record: 'platform payout record',
      reimbursable: false
    };
  }
  if (/\b(?:insurance|health ?care accepted|claim|reimburs)\b/.test(text)) {
    return {
      shortOutcome: 'paid or reimbursed claims',
      paidConversion: 'reimbursement received for a completed booking',
      record: 'claim record',
      reimbursable: true
    };
  }
  if (/\b(?:appointment|book|booking|consultation|home visit|session)\b/.test(
    text
  )) {
    return {
      shortOutcome: 'paid bookings',
      paidConversion: 'paid booking',
      record: 'booking record',
      reimbursable: false
    };
  }
  if (/\b(?:subscription|subscribe|membership|retainer)\b/.test(text)) {
    return {
      shortOutcome: 'subscription payments',
      paidConversion: 'subscription payment',
      record: 'payment receipt',
      reimbursable: false
    };
  }
  if (/\b(?:buy|checkout|order|product|purchase|storefront)\b/.test(text)) {
    return {
      shortOutcome: 'paid orders',
      paidConversion: 'paid order',
      record: 'order record',
      reimbursable: false
    };
  }
  if (/\b(?:contract|engagement|invoice|proposal)\b/.test(text)) {
    return {
      shortOutcome: 'signed paid contracts',
      paidConversion: 'signed paid contract',
      record: 'contract record',
      reimbursable: false
    };
  }
  return {
    shortOutcome: 'attributed payments',
    paidConversion: 'payment receipt',
    record: 'payment record',
    reimbursable: false
  };
}

function generatedExperimentMatchesFailureContext(
  generatedExperimentValue,
  objectiveValue,
  missingEvidence
) {
  const experiment = asObject(generatedExperimentValue);
  if (!experiment.asset) return false;
  const objective = asObject(objectiveValue);
  const objectiveText = compactStrings([
    objective.outcome,
    objective.successMetric
  ]).join(' ');
  const experimentText = compactStrings([
    experiment.title,
    experiment.knownFact,
    experiment.buyer,
    experiment.paidOffer,
    experiment.paidConversion,
    experiment.successSignal
  ]).join(' ');
  const businessGap = compactStrings(missingEvidence).some((value) =>
    value !== 'usable_strategy_generation' &&
    value !== 'within_budget_strategy_generation'
  );
  return businessGap &&
    textOverlap(objectiveText, experimentText) > 0;
}

function humanizeMissingRevenueEvidence(values) {
  const labels = {
    approved_inbound_asset:
      'a current owner-controlled paid offer or conversion page',
    attributable_paid_conversion:
      'an attributable paid conversion',
    buyer:
      'a specific buyer',
    paid_offer:
      'a current paid offer',
    acquisition_mechanism:
      'one acquisition path',
    conversion_destination:
      'a conversion destination separate from acquisition',
    paid_conversion:
      'a paid conversion event',
    attribution_signal:
      'a revenue record that stores acquisition source',
    named_revenue_target:
      'a named outside revenue target',
    second_grounded_strategy_family:
      'a second distinct evidence-grounded revenue path',
    second_grounded_finalist:
      'a second distinct evidence-grounded finalist',
    family_diverse_revenue_path:
      'a distinct alternate acquisition path',
    distinct_runner_up:
      'a distinct lower-ranked revenue path',
    revenue_evidence_mismatch:
      'evidence tied to the same buyer-to-payment path',
    buyer_evidence_mismatch:
      'evidence supporting the named buyer',
    paid_offer_evidence_mismatch:
      'evidence supporting the paid offer',
    acquisition_evidence_mismatch:
      'evidence supporting the acquisition path',
    conversion_destination_evidence_mismatch:
      'evidence supporting the conversion destination',
    paid_conversion_evidence_mismatch:
      'evidence supporting the paid conversion',
    attribution_evidence_mismatch:
      'evidence supporting the attribution record',
    unsupported_buyer_evidence:
      'clear buyer evidence',
    unsupported_paid_offer_evidence:
      'a current paid-offer statement',
    unsupported_acquisition_evidence:
      'an observed acquisition source',
    unsupported_paid_conversion_evidence:
      'a current paid-conversion path',
    noncurrent_or_negative_paid_offer_evidence:
      'current affirmative evidence for the paid offer',
    noncurrent_or_negative_paid_conversion_evidence:
      'current affirmative evidence for the paid conversion',
    unsupported_attribution_evidence:
      'an observed attribution field or record',
    invalid_conversion_destination:
      'a concrete conversion destination separate from acquisition',
    invalid_acquisition_mode:
      'one permitted acquisition path',
    invalid_revenue_contract:
      'a current revenue-path contract',
    invalid_revenue_mechanism:
      'a supported way the owner gets paid',
    invalid_attribution_method:
      'a supported revenue attribution record',
    nonpositive_expected_value:
      'a conservative positive gross-income estimate',
    prohibited_acquisition:
      'a permissioned or inbound acquisition path',
    operations_only_action:
      'one action that advances acquisition or payment',
    action_conversion_mismatch:
      'one action aligned with the paid conversion',
    missing_revenue_path:
      'a complete buyer-to-payment path',
    missing_paid_offer:
      'a current paid offer',
    missing_incremental_income:
      'an incremental-income outcome',
    missing_paid_conversion:
      'a paid conversion event',
    missing_observable_revenue:
      'an observable paid outcome',
    missing_attribution_signal:
      'a revenue record that stores acquisition source'
  };
  return compactStrings(values)
    .map((value) => labels[value] || String(value)
      .replace(/^(?:invalid|missing|unsupported)_/, '')
      .replace(/_/g, ' '))
    .filter((value, index, items) =>
      items.indexOf(value) === index
    )
    .slice(0, 8);
}

function strategyGenerationRecoveryExperiment({
  objective,
  evidenceHash,
  missingEvidence
}) {
  const missing = compactStrings(missingEvidence);
  const providerFailure = missing.includes('usable_strategy_generation');
  const budgetFailure = missing.includes('within_budget_strategy_generation');
  const shapeFailure = missing.includes(
    'structured_strategy_family_repair'
  );
  if (!providerFailure && !budgetFailure && !shapeFailure) return null;
  const successSignal =
    'One new attributed revenue event—a paid booking, payment, order, signed contract, reimbursed claim, license or royalty payment, commission or referral fee, sponsorship payment, platform payout, or compensated-role payment—with a stored source, referral, campaign, channel, or UTM value.';
  const kind = providerFailure
    ? 'strategy_generation_provider_recovery'
    : budgetFailure
      ? 'strategy_generation_budget_recovery'
      : 'strategy_generation_shape_recovery';
  const title = providerFailure
    ? 'Retry strategy generation once after provider recovery'
    : budgetFailure
      ? 'Retry strategy generation once on a budget-compatible route'
      : 'Retry once for a structurally complete strategy comparison';
  const action = providerFailure
    ? 'Preserve the approved evidence snapshot and make no business or provider-side changes. After the model provider is healthy and strict structured-output support is verified, retry the same bounded tournament exactly once.'
    : budgetFailure
      ? 'Preserve the approved evidence snapshot and do not raise the user budget. Select a model/provider route whose conservative prompt-token, output-token, and possible fixed per-request fee ceiling fits the existing total LLM budget, then retry the same bounded tournament exactly once. The flat request-price field is a per-request routing filter, not a total call-cost cap.'
      : 'Preserve the approved evidence snapshot and make no business, outreach, publishing, or provider-side changes. Retry the same objective exactly once only after the strict response route can return two complete comparison families; new market evidence is not required.';
  const stopCondition = providerFailure
    ? 'Stop after 1 provider-recovery retry; if structured strategy generation fails again, surface the technical failure and do not spend again automatically.'
    : budgetFailure
      ? 'Stop after 1 budget-compatible retry; if it exceeds or cannot satisfy the existing cap, surface the budget failure and do not spend again automatically.'
      : 'Stop after 1 response-shape retry; if two complete comparison families still cannot be returned, surface the AI contract failure and do not spend again automatically.';
  const trigger = providerFailure
    ? 'Rerun once only after provider health and strict structured-output support are verified; new business evidence is not required.'
    : budgetFailure
      ? 'Rerun once only after the conservative prompt-token, output-token, and possible fixed per-request fee ceiling is verified to fit the existing total LLM budget; the flat request-price field is a per-request routing filter, not a total call-cost cap.'
      : 'Rerun once only after strict structured-output support for two complete comparison families is verified; new business evidence is not required.';
  return {
    contractVersion: REVENUE_EVIDENCE_EXPERIMENT_CONTRACT,
    id: `experiment-${stableHash({
      kind,
      evidenceHash,
      missing
    }).slice(0, 24)}`,
    kind,
    title,
    action,
    missingEvidence: missing,
    paidOutcome: truncate(
      observableRevenueText(objective?.successMetric)
        ? firstText(objective?.successMetric)
        : successSignal,
      360
    ),
    successSignal,
    stopCondition,
    asset: null,
    evidenceRefs: [],
    requiresReview: true,
    rerunPolicy: {
      maxReruns: 1,
      trigger
    }
  };
}

function inboundAssetConversionReadiness(evidenceValue) {
  const evidence = asObject(evidenceValue);
  const text = comparable(
    `${evidence.label || ''} ${evidence.summary || ''} ${evidence.url || ''}`
  );
  let score = 0;
  if (/\b(?:apply|application|book|booking|buy|checkout|demo|download|inquiry|order|purchase|request|sign up|signup|subscribe)\b/.test(text)) {
    score += 4;
  }
  if (/\b(?:service|consultation|home visit|session|package|shop|software|pricing plan|subscription|membership|license|royalty|commission|sponsorship|platform payout|compensated role)\b/.test(text)) {
    score += 2;
  }
  if (/\b(?:paid|billable|price|fee|reimbursable|license|royalty|commission|referral fee|sponsorship|payout|compensated|salary|wage)\b/.test(text)) {
    score += 2;
  }
  if (informationalAssetEvidence(evidence)) {
    score -= 12;
  }
  return score;
}

function informationalAssetEvidence(evidenceValue) {
  const evidence = asObject(evidenceValue);
  const type = comparable(firstText(evidence.type));
  const label = comparable(firstText(evidence.label));
  const summary = comparable(firstText(evidence.summary));
  let pathname = '';
  try {
    pathname = new URL(safePublicURL(evidence.url)).pathname.toLowerCase();
  } catch {
    pathname = '';
  }
  const embeddedConversion =
    /\b(?:embedded|on this page|below)\b.{0,50}\b(?:booking form|checkout|order form|payment form|book now button)\b/.test(
      `${label} ${summary}`
    ) ||
    /\b(?:booking form|checkout|order form|payment form|book now button)\b.{0,50}\b(?:embedded|on this page|below)\b/.test(
      `${label} ${summary}`
    );
  if (embeddedConversion) return false;
  const informationalType =
    /\b(?:article|blog|editorial|guide|insight|news|post|publication|resource)\b/.test(
      type
    );
  const informationalPath =
    /\/(?:19|20)\d{2}(?:\/|$)|\/(?:articles?|blog|guides?|insights?|learn|news|posts?|resources?)(?:\/|$)/.test(
      pathname
    );
  const informationalTitle =
    /\b(?:article|blog|guide|how to|overview|tips|what is|why)\b/.test(
      label
    ) ||
    /\b(?:initiative|policy|program)\s+(?:in|within|across)\s+(?:businesses|companies|hospitals|institutions|organizations|schools|workplaces)\b/.test(
      label
    );
  return informationalType || informationalPath || informationalTitle;
}

function inboundAssetEvidenceSupportsPaidConversion(
  evidenceValue,
  referenceTime
) {
  const evidence = asObject(evidenceValue);
  if (evidence.current === false ||
      /\b(?:archived|cancelled|canceled|closed|discontinued|ended|expired|inactive|not accepting|sold out|unavailable|withdrawn)\b/i.test(
        firstText(evidence.status)
      )) {
    return false;
  }
  const referenceDate = new Date(referenceTime);
  const observedDate = new Date(firstText(evidence.observedAt));
  if (!Number.isFinite(referenceDate.getTime()) ||
      !Number.isFinite(observedDate.getTime())) {
    return false;
  }
  const age = referenceDate.getTime() - observedDate.getTime();
  if (age < -MAX_TIMING_VERIFICATION_FUTURE_SKEW_MS ||
      age > MAX_INBOUND_ASSET_OBSERVATION_AGE_MS) {
    return false;
  }
  const rawEndDate = firstText(evidence.endDate);
  if (rawEndDate) {
    const endDate = new Date(rawEndDate);
    if (!Number.isFinite(endDate.getTime()) ||
        endDate.getTime() < referenceDate.getTime()) {
      return false;
    }
  }
  const text = comparable(
    `${evidence.label || ''} ${evidence.summary || ''} ${evidence.url || ''}`
  );
  if (informationalAssetEvidence(evidence)) {
    return false;
  }
  if (/\b(?:archived|cancelled|canceled|closed|discontinued|ended|expired|inactive|no longer (?:available|offered|accepting|bookable)|not (?:available|accepting|bookable)|sold out|unavailable|withdrawn)\b/.test(
    text
  ) ||
      /\b(?:no|not|without)\s+(?:a\s+)?(?:paid|billable|bookable|purchasable|reimbursable) (?:offer|service|consultation|session|booking|option)\b/.test(
        text
      ) ||
      /\b(?:is|are|was|were)\s+not\s+(?:paid|billable|reimbursable|reimbursed|covered)\b/.test(
        text
      ) ||
      /\b(?:payment|insurance payment|reimbursement)\s+(?:is\s+)?not\s+required\b/.test(
        text
      )) {
    return false;
  }
  if (/\b(?:unpaid|volunteer|no compensation|no commission|no referral fee|no sponsorship fee)\b/.test(
    text
  )) {
    return false;
  }
  const namesFreeOption =
    /\b(?:complimentary|free|no fee|without charge|zero cost)\b/.test(
      text
    );
  const namesPaidAlternative =
    /\b(?:paid (?:plan|tier|subscription|option|version)|pricing|price|starts at|subscription fee|purchase|checkout)\b/.test(
      text
    ) ||
    /\$\s*\d/.test(`${evidence.label || ''} ${evidence.summary || ''}`);
  if (namesFreeOption && !namesPaidAlternative) {
    return false;
  }
  if (/\broyalty[ -]free\b/.test(text) &&
      !namesPaidAlternative) {
    return false;
  }
  if (/\b(?:insurance (?:is )?not accepted|health ?care (?:is )?not accepted|no health ?care accepted|not covered|no coverage|without coverage|not reimburs(?:able|ed)|no reimbursement|claim denied)\b/.test(
    text
  )) {
    return false;
  }
  const insurancePaidContext =
    /\b(?:covered by insurance|insurance[- ]covered|insurance (?:is )?accepted|accepts insurance|health ?care (?:is )?accepted|bill(?:s|ing)? insurance|insurance claim|reimburs(?:able|ed|ement)|claim payment)\b/.test(
      text
    );
  const namesOffer =
    /\b(?:app|audit|class|consultation|contract|course|demo|diagnostic|digital download|engagement|home visit|license|membership|package|pilot|pricing plan|product|professional role|service|session|software|sponsorship|subscription|workshop)\b/.test(
      text
    );
  const namesPositiveConversion =
    /\b(?:apply|application|appointment|book|booking|book now|buy|checkout|contact|demo|download|inquiry|license|order|pay|payment|purchase|request|schedule|sign|sign up|signup|sponsorship inquiry|subscribe)\b/.test(
      text
    );
  const namesPaidMechanism = insurancePaidContext ||
    /\b(?:billable|commission|compensated|contract|cost|deposit|fee|invoice|license|order|paid|pay|payment|platform payout|price|purchase|referral fee|retainer|royalty|salary|sale|sponsorship|subscription|wage)\b/.test(
      text
    ) ||
    /\$\s*\d/.test(
      `${evidence.label || ''} ${evidence.summary || ''}`
    );
  return namesOffer && namesPositiveConversion && namesPaidMechanism;
}

function synthesizeOwnedInboundAssetCandidates(
  hypotheses,
  evidenceCatalog,
  referenceTime
) {
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const values = [];
  for (const hypothesis of asArray(hypotheses)) {
    if (firstText(hypothesis?.revenuePath?.acquisitionMode) !== 'inbound') {
      continue;
    }
    const tuple = asObject(hypothesis?._tuple);
    const buyerRefs = strategyObservationEvidenceRefs(
      asObject(tuple.buyerSegments).evidenceRefs
    );
    const channelRefs = strategyObservationEvidenceRefs(
      asObject(tuple.channels).evidenceRefs
    );
    const revenuePathRefs = strategyObservationEvidenceRefs(
      asObject(tuple.revenuePaths?.revenuePath).evidenceRefs
    );
    const offerOrProofRefs = strategyObservationEvidenceRefs([
      ...asArray(asObject(tuple.offers).evidenceRefs),
      ...asArray(asObject(tuple.proofPoints).evidenceRefs)
    ]);
    const assetEvidence = offerOrProofRefs
      .map((ref) => evidenceByID.get(ref))
      .filter((evidence) =>
        approvedOwnedAssetEvidence(evidence, evidenceByID) &&
        inboundAssetEvidenceSupportsPaidConversion(
          evidence,
          referenceTime
        )
      )
      .sort((left, right) =>
        inboundAssetConversionReadiness(right) -
          inboundAssetConversionReadiness(left) ||
        evidenceQuality(right) - evidenceQuality(left) ||
        firstText(left.id).localeCompare(firstText(right.id))
      )[0];
    const groundedBuyerRefs = buyerRefs.filter((ref) =>
      asObject(evidenceByID.get(ref)).approvedSourceObservation === true
    );
    const groundedChannelRefs = channelRefs.filter((ref) =>
      asObject(evidenceByID.get(ref)).approvedSourceObservation === true
    );
    const groundedRevenuePathRefs = revenuePathRefs.filter((ref) =>
      asObject(evidenceByID.get(ref)).approvedSourceObservation === true
    );
    if (!assetEvidence ||
        groundedBuyerRefs.length === 0 ||
        groundedChannelRefs.length === 0 ||
        groundedRevenuePathRefs.length === 0) {
      continue;
    }
    const publicUrl = safePublicURL(assetEvidence.url);
    const evidenceRefs = compactStrings([
      assetEvidence.id,
      ...groundedBuyerRefs,
      ...groundedChannelRefs,
      ...groundedRevenuePathRefs
    ])
      .filter((ref) =>
        asObject(evidenceByID.get(ref)).approvedSourceObservation === true
      )
      .slice(0, 12);
    const value = {
      id: `candidate:owned-inbound:${stableHash(
        `${hypothesis.id}|${publicUrl}`
      ).slice(0, 20)}`,
      hypothesisId: hypothesis.id,
      kind: OWNED_INBOUND_ASSET_KIND,
      displayLabel: truncate(firstText(
        assetEvidence.label,
        'Owned inbound offer page'
      ), 180),
      role: 'Owned inbound paid-conversion asset',
      publicUrl,
      providers: ['approved_source_observation'],
      evidenceRefs,
      contactPaths: [{
        kind: OWNED_INBOUND_ASSET_KIND,
        available: true,
        verified: true,
        reference: publicUrl
      }],
      score: hypothesis.score,
      exactNamedCandidate: false,
      identityResolved: true,
      discoveredAt: firstText(assetEvidence.observedAt)
    };
    SYNTHESIZED_OWNED_INBOUND_ASSETS.add(value);
    values.push(value);
  }
  return values;
}

function normalizeCandidates(
  values,
  hypotheses,
  evidenceCatalog,
  timestamp,
  profileScribePublicBaseURL,
  ownerIdentity
) {
  const hypothesisByID = new Map(hypotheses.map((item) => [item.id, item]));
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const candidates = [];
  for (const [index, rawValue] of asArray(values).slice(0, 160).entries()) {
    const raw = asObject(rawValue);
    if (ownedInboundAssetCandidate(raw) &&
        !SYNTHESIZED_OWNED_INBOUND_ASSETS.has(rawValue)) {
      continue;
    }
    const authorSlug = firstText(raw.authorSlug, raw.profileSlug);
    const displayLabel = truncate(firstText(
      raw.displayLabel,
      raw.fullName,
      raw.name,
      raw.label,
      authorSlug
    ), 180);
    if (!displayLabel) continue;
    const evidenceRefs = compactStrings(raw.evidenceRefs)
      .map((id) => evidenceByID.get(id)?.id)
      .filter(Boolean)
      .filter((id, refIndex, refs) => refs.indexOf(id) === refIndex)
      .slice(0, 12);
    if (evidenceRefs.length === 0) continue;
    const groundingCandidate = {
      ...raw,
      displayLabel,
      evidenceRefs
    };
    const overlappingHypotheses = hypotheses.filter((hypothesis) =>
      candidateEvidenceGroundsHypothesis(
        groundingCandidate,
        hypothesis,
        evidenceByID
      )
    );
    if (overlappingHypotheses.length === 0) continue;
    let hypothesis = hypothesisByID.get(firstText(raw.hypothesisId));
    if (!hypothesis ||
        !candidateEvidenceGroundsHypothesis(
          groundingCandidate,
          hypothesis,
          evidenceByID
        )) {
      hypothesis = [...overlappingHypotheses].sort((left, right) => {
        const leftFit = textOverlap(
          `${raw.role || ''} ${raw.organization || ''} ${displayLabel}`,
          left.buyerSegment
        );
        const rightFit = textOverlap(
          `${raw.role || ''} ${raw.organization || ''} ${displayLabel}`,
          right.buyerSegment
        );
        return rightFit - leftFit || left.rank - right.rank;
      })[0];
    }
    if (!hypothesis) continue;
    const score = {
      ...hypothesis.score,
      ...normalizeScores(raw.score)
    };
    score.total = round(clamp01(
      hypothesis.score.total * 0.8 +
      clamp01(finite(raw.score?.total) ?? hypothesis.score.total) * 0.2
    ));
    const publicUrl = safePublicURL(firstText(
      raw.publicUrl,
      raw.profileUrl,
      raw.url,
      raw.linkedinUrl,
      authorSlug ? internalProfileURL(profileScribePublicBaseURL, authorSlug) : ''
    ));
    const organization = truncate(firstText(raw.organization, raw.company), 180);
    const candidateDisplayLabel = ownedInboundAssetCandidate(raw)
      ? displayLabel
      : concreteCandidateLabel(displayLabel)
        ? displayLabel
        : organization;
    // Candidate kinds supplied by callers and approved-source extraction are
    // still untrusted classification hints. Normalize obvious organizations
    // here as the common output boundary so a payer brand cannot retain a
    // person-like kind and become eligible for downstream person enrichment.
    const declaredKind = firstText(raw.kind, 'public_professional');
    const candidateKind = ownedInboundAssetCandidate(raw)
      ? OWNED_INBOUND_ASSET_KIND
      : organizationLikeCandidateLabel(candidateDisplayLabel)
        ? 'organization'
        : declaredKind;
    if (!candidateIdentityIsConcrete({
      raw,
      displayLabel: candidateDisplayLabel,
      organization,
      publicUrl,
      authorSlug
    }) || candidateIsProfileOwner({
      raw,
      displayLabel: candidateDisplayLabel,
      publicUrl,
      authorSlug,
      ownerIdentity
    })) {
      continue;
    }
    const id = firstText(
      raw.id,
      authorSlug ? `candidate:profilescribe:${authorSlug}` : '',
      `candidate-${stableHash(`${candidateDisplayLabel}|${raw.organization || ''}|${publicUrl}|${index}`).slice(0, 20)}`
    );
    candidates.push({
      id,
      hypothesisId: hypothesis.id,
      kind: candidateKind,
      displayLabel: candidateDisplayLabel,
      organization,
      role: truncate(firstText(raw.role, raw.title), 180),
      market: truncate(firstText(raw.market, raw.location), 180),
      publicUrl,
      providers: compactStrings([
        ...asArray(raw.providers),
        firstText(raw.provider)
      ]).slice(0, 8),
      evidenceRefs,
      contactPaths: normalizeContactPaths(raw.contactPaths),
      score,
      rank: 0,
      exactNamedCandidate: raw.exactNamedCandidate === true,
      identityResolved: raw.identityResolved === true || Boolean(authorSlug),
      selected: false,
      discoveredAt: validISOString(raw.discoveredAt) || timestamp
    });
  }
  const combined = combineExactCandidates(candidates);
  combined.sort((left, right) => right.score.total - left.score.total || left.id.localeCompare(right.id));
  return combined.map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function ownerCandidateIdentity(
  job,
  payload,
  context,
  profileScribePublicBaseURL
) {
  payload = asObject(payload);
  context = asObject(context);
  const snapshot = asObject(payload.evidenceSnapshot);
  const profile = asObject(
    Object.keys(asObject(snapshot.profile)).length > 0
      ? snapshot.profile
      : context.profile
  );
  const identity = asObject(profile.identity);
  const names = new Set(compactStrings([
    identity.fullName,
    identity.name,
    profile.fullName,
    profile.name,
    payload.ownerName
  ]).map(comparable));
  const currentExperienceOrganizations = firstArray(profile.experience)
    .map(asObject)
    .filter((experience) => {
      const endDate = comparable(firstText(experience.endDate));
      return experience.current === true ||
        experience.isCurrent === true ||
        experience.active === true ||
        !endDate ||
        ['present', 'current', 'now', 'ongoing'].includes(endDate);
    })
    .map((experience) =>
      firstText(
        experience.company,
        experience.organization,
        experience.companyName
      )
    );
  const organizations = new Set(compactStrings([
    ...currentExperienceOrganizations,
    payload.ownerOrganization,
    payload.ownerCompany
  ]).map(comparable));
  const ownerSlugs = compactStrings([
    identity.slug,
    identity.profileSlug,
    identity.username,
    profile.slug,
    profile.profileSlug,
    profile.username,
    payload.ownerSlug,
    payload.profileSlug
  ]);
  const slugs = new Set(ownerSlugs.map(comparable));
  const urls = new Set(compactStrings([
    identity.publicUrl,
    identity.profileUrl,
    profile.publicUrl,
    profile.profileUrl,
    ...ownerSlugs.map((slug) =>
      internalProfileURL(profileScribePublicBaseURL, slug)
    )
  ]).map((value) => comparableURL(safePublicURL(value))).filter(Boolean));
  const tenantID = firstText(job?.tenantId, job?.tenantID);
  const userID = firstText(job?.userId, job?.userID);
  const candidateIDs = new Set(compactStrings([
    tenantID && userID
      ? `candidate:profilescribe:${tenantID}:${userID}`
      : '',
    ...ownerSlugs.map((slug) => `candidate:profilescribe:${slug}`)
  ]));
  return {
    names,
    organizations,
    slugs,
    urls,
    candidateIDs,
    tenantID,
    userID
  };
}

function candidateIdentityIsConcrete({
  raw,
  displayLabel,
  organization,
  publicUrl,
  authorSlug
}) {
  raw = asObject(raw);
  if (authorSlug ||
      raw.identityResolved === true ||
      raw.exactNamedCandidate === true) {
    return true;
  }
  const explicitName = firstText(
    raw.fullName,
    raw.personName,
    raw.candidateName,
    raw.authorName
  );
  if (concreteCandidateLabel(explicitName)) return true;
  if (concreteCandidateLabel(organization)) return true;
  return Boolean(publicUrl && concreteCandidateLabel(displayLabel));
}

function candidateIsProfileOwner({
  raw,
  displayLabel,
  publicUrl,
  authorSlug,
  ownerIdentity
}) {
  raw = asObject(raw);
  if (ownedInboundAssetCandidate(raw)) {
    return false;
  }
  ownerIdentity = ownerIdentity || {};
  if (ownerIdentity.candidateIDs?.has(firstText(raw.id))) return true;
  if (authorSlug && ownerIdentity.slugs?.has(comparable(authorSlug))) return true;
  if (publicUrl &&
      ownerIdentity.urls?.has(comparableURL(publicUrl))) {
    return true;
  }
  const ownerTenantID = firstText(raw.ownerTenantId, raw.tenantId);
  const ownerUserID = firstText(raw.ownerUserId, raw.userId);
  if (ownerTenantID && ownerUserID &&
      ownerTenantID === ownerIdentity.tenantID &&
      ownerUserID === ownerIdentity.userID) {
    return true;
  }
  const candidateName = comparable(displayLabel);
  return ownerIdentity.names?.has(candidateName) === true ||
    ownerIdentity.organizations?.has(candidateName) === true;
}

function combineExactCandidates(candidates) {
  const out = [];
  const byExactKey = new Map();
  for (const candidate of candidates) {
    const keys = compactStrings([
      candidate.id ? `id:${candidate.id}` : '',
      candidate.publicUrl ? `url:${comparableURL(candidate.publicUrl)}` : ''
    ]);
    const existingIndex = keys
      .map((key) => byExactKey.get(key))
      .find((index) => index !== undefined);
    if (existingIndex === undefined) {
      const index = out.length;
      out.push(candidate);
      for (const key of keys) byExactKey.set(key, index);
      continue;
    }
    const existing = out[existingIndex];
    const merged = {
      ...candidate,
      ...existing,
      organization: firstText(existing.organization, candidate.organization),
      role: firstText(existing.role, candidate.role),
      market: firstText(existing.market, candidate.market),
      publicUrl: firstText(existing.publicUrl, candidate.publicUrl),
      providers: compactStrings([
        ...asArray(existing.providers),
        ...asArray(candidate.providers)
      ]).slice(0, 8),
      evidenceRefs: compactStrings([
        ...asArray(existing.evidenceRefs),
        ...asArray(candidate.evidenceRefs)
      ]).slice(0, 12),
      contactPaths: combineContactPaths([
        ...asArray(existing.contactPaths),
        ...asArray(candidate.contactPaths)
      ]),
      identityResolved: existing.identityResolved || candidate.identityResolved,
      score: existing.score.total >= candidate.score.total
        ? existing.score
        : candidate.score
    };
    out[existingIndex] = merged;
    for (const key of keys) byExactKey.set(key, existingIndex);
  }
  return out;
}

function combineContactPaths(paths) {
  const seen = new Set();
  const out = [];
  for (const pathValue of paths) {
    const path = asObject(pathValue);
    const key = `${comparable(path.kind)}|${firstText(path.reference)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out.slice(0, 8);
}

function normalizeContactPaths(value) {
  return firstArray(value)
    .slice(0, 8)
    .map((rawValue) => {
      const raw = asObject(rawValue);
      return compact({
        kind: firstText(raw.kind, 'unknown'),
        available: raw.available === true,
        verified: raw.verified === true,
        reference: safeContactPathReference(raw.reference)
      });
    });
}

function safeContactPathReference(value) {
  const raw = firstText(value);
  if (!raw) return '';
  const publicURL = safePublicURL(raw);
  if (publicURL) return publicURL;
  if (/^https?:\/\//i.test(raw)) return '';
  if (/@/.test(raw) || /^(?:mailto|tel|sms):/i.test(raw)) return '';
  const phoneCharactersOnly = /^[+\d().\s-]+$/.test(raw);
  const digits = raw.replace(/\D/g, '');
  if (phoneCharactersOnly && digits.length >= 7 && digits.length <= 15) return '';
  return /^[A-Za-z][A-Za-z0-9._:/-]{2,239}$/.test(raw)
    ? raw
    : '';
}

function timingSupportPhraseGroundsLabel(label, supportPhrase) {
  if (textOverlap(label, supportPhrase) < 0.35) return false;
  const normalizedLabel = comparable(label);
  const support = comparable(supportPhrase);
  const verificationStep = /^(?:verify|confirm|check|research|determine)\b/.test(
    normalizedLabel
  );
  if (verificationStep) {
    // A prefix such as "Confirm current opportunity" still presupposes the
    // very claim it is meant to verify. Require the whole trigger to be
    // explicitly uncertainty-scoped.
    if (!/^(?:verify|confirm|check|research|determine)\s+(?:whether|if|when|the status of|the timing of)\b/.test(
      normalizedLabel
    )) {
      return false;
    }
    return specificTimingClaims(label)
      .filter((claim) => !verificationTimingClaimMayBeQuestioned(claim))
      .every((claim) => support.includes(claim));
  }
  // A non-verification trigger is a direct factual timing assertion. Preserve
  // it only when that complete assertion was copied from approved evidence.
  return exactTextContains(supportPhrase, label);
}

function timingIsVerificationStep(value) {
  return /^(?:verify|confirm|check|research|determine)\b/i.test(
    firstText(value)
  );
}

function specificTimingClaims(value) {
  const normalized = comparable(value);
  const patterns = [
    /\bcurrent(?:ly)?\b/g,
    /\bnow\b/g,
    /\btoday\b/g,
    /\btomorrow\b/g,
    /\bimmediate(?:ly)?\b/g,
    /\burgent(?:ly|cy)?\b/g,
    /\blive\b/g,
    /\bactive(?:ly)?\b/g,
    /\bopen\b/g,
    /\bongoing\b/g,
    /\brecent(?:ly)?\b/g,
    /\bnew(?:ly)?\b/g,
    /\bupcoming\b/g,
    /\bimminent(?:ly)?\b/g,
    /\bsoon\b/g,
    /\bopen enrollment(?: window| period)?\b/g,
    /\benrollment(?: window| period| cycle| deadline)?\b/g,
    /\brecertification(?: window| period| cycle| deadline)?\b/g,
    /\bplanning cycle\b/g,
    /\bawareness month\b/g,
    /\b(?:application|budget|grant|procurement|renewal) (?:window|deadline|cycle|period)\b/g,
    /\bdeadline\b/g,
    /\b(?:this|next|last) (?:week|month|quarter|year)\b/g,
    /\bq[1-4]\b/g,
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/g,
    /\b20\d{2}\b/g
  ];
  return compactStrings(
    patterns.flatMap((pattern) => normalized.match(pattern) || [])
  );
}

function verificationTimingClaimMayBeQuestioned(value) {
  return new Set([
    'open enrollment',
    'provider enrollment',
    'enrollment window',
    'enrollment period',
    'enrollment deadline',
    'recertification',
    'planning cycle',
    'awareness month',
    'application window',
    'application deadline',
    'budget window',
    'budget cycle',
    'grant window',
    'grant deadline',
    'procurement window',
    'procurement cycle',
    'renewal window',
    'renewal deadline',
    'deadline'
  ]).has(comparable(value));
}

function validateRevenuePath(
  tuple,
  evidenceByID = new Map(),
  referenceTime = new Date()
) {
  const revenueSeed = asObject(tuple?.revenuePaths);
  const revenuePath = asObject(revenueSeed.revenuePath);
  const reasons = new Set();
  if (Object.keys(revenuePath).length === 0) {
    reasons.add('missing_revenue_path');
    return {
      valid: false,
      reasons: [...reasons],
      revenuePath: {}
    };
  }
  const isV2 =
    revenuePath.contractVersion === REVENUE_PATH_CONTRACT_VERSION;
  const isLegacyV1 =
    revenuePath.contractVersion ===
      LEGACY_REVENUE_PATH_CONTRACT_VERSION;
  if (!isV2 && !isLegacyV1) {
    reasons.add('invalid_revenue_contract');
  }
  if (!REVENUE_MECHANISMS.has(revenuePath.revenueMechanism)) {
    reasons.add('invalid_revenue_mechanism');
  }
  if (!ACQUISITION_MODES.has(revenuePath.acquisitionMode)) {
    reasons.add('invalid_acquisition_mode');
  }
  if (!ATTRIBUTION_METHODS.has(revenuePath.attributionMethod)) {
    reasons.add('invalid_attribution_method');
  }
  if (!(revenueSeed.expectedValueMicros > 0)) {
    reasons.add('nonpositive_expected_value');
  }

  const offer = firstText(tuple?.offers?.label);
  const channel = firstText(tuple?.channels?.label);
  const action = firstText(tuple?.actions?.label);
  const incomeOutcome = firstText(
    revenuePath.incrementalIncomeOutcome
  );
  const conversionAction = firstText(revenuePath.conversionAction);
  const observableOutcome = firstText(
    revenuePath.observableRevenueOutcome
  );
  const attributionSignal = firstText(revenuePath.attributionSignal);
  const supportingBottleneck = firstText(
    revenuePath.supportingBottleneck
  );
  if (!paidOfferText(offer)) {
    reasons.add('missing_paid_offer');
  }
  if (!incrementalIncomeText(incomeOutcome)) {
    reasons.add('missing_incremental_income');
  }
  if (!revenueAdvancingAction(conversionAction)) {
    reasons.add('missing_paid_conversion');
  }
  if (!observableRevenueText(observableOutcome)) {
    reasons.add('missing_observable_revenue');
  }
  if (!attributionSignalText(
    attributionSignal,
    revenuePath.attributionMethod
  )) {
    reasons.add('missing_attribution_signal');
  }

  const acquisitionText = `${channel} ${conversionAction}`;
  if (prohibitedAcquisitionText(acquisitionText)) {
    reasons.add('prohibited_acquisition');
  } else if (ACQUISITION_MODES.has(revenuePath.acquisitionMode) &&
      !acquisitionModeMatchesText(
        revenuePath.acquisitionMode,
        acquisitionText
      )) {
    reasons.add('invalid_acquisition_mode');
  }

  if (!revenueAdvancingAction(action) ||
      operationOnlyAction(action) ||
      (supportingBottleneck &&
       comparable(action) === comparable(supportingBottleneck))) {
    reasons.add('operations_only_action');
  } else if (!revenueActionsAlign(action, conversionAction)) {
    reasons.add('action_conversion_mismatch');
  }

  const pathRefs = new Set(compactStrings(revenuePath.evidenceRefs));
  const overlaps = (dimension) =>
    compactStrings(asObject(dimension).evidenceRefs)
      .some((ref) => pathRefs.has(ref));
  if (pathRefs.size === 0 ||
      !overlaps(tuple?.offers) ||
      !overlaps(tuple?.buyerSegments) ||
      !overlaps(tuple?.channels) ||
      (!overlaps(tuple?.actions) && !overlaps(tuple?.proofPoints))) {
    reasons.add('revenue_evidence_mismatch');
  }
  if (isV2) {
    for (const reason of revenuePathGroundingReasons(
      tuple,
      revenuePath,
      evidenceByID,
      referenceTime
    )) {
      reasons.add(reason);
    }
  }

  const {
    _grounding: _internalGrounding,
    ...publicRevenuePath
  } = revenuePath;
  return {
    valid: reasons.size === 0,
    reasons: [...reasons].sort(),
    revenuePath: publicRevenuePath
  };
}

function revenuePathGroundingReasons(
  tuple,
  revenuePath,
  evidenceByID,
  referenceTime
) {
  const grounding = asObject(revenuePath._grounding);
  const groups = {
    buyer: compactStrings(grounding.buyerEvidenceRefs),
    paid_offer: compactStrings(grounding.paidOfferEvidenceRefs),
    acquisition: compactStrings(grounding.acquisitionEvidenceRefs),
    conversion_destination: compactStrings(
      grounding.conversionDestinationEvidenceRefs
    ),
    paid_conversion: compactStrings(
      grounding.paidConversionEvidenceRefs
    ),
    attribution: compactStrings(grounding.attributionEvidenceRefs)
  };
  const reasons = new Set();
  for (const [name, refs] of Object.entries(groups)) {
    if (refs.length === 0 ||
        refs.some((ref) =>
          /^source:/i.test(ref) || !evidenceByID.has(ref)
        )) {
      reasons.add(`missing_${name}_evidence`);
    }
  }
  const dimensionRefs = (dimension) => new Set(
    compactStrings(asObject(dimension).evidenceRefs)
  );
  const intersects = (refs, dimension) => {
    const allowed = dimensionRefs(dimension);
    return refs.some((ref) => allowed.has(ref));
  };
  if (groups.buyer.length > 0 &&
      !intersects(groups.buyer, tuple?.buyerSegments)) {
    reasons.add('buyer_evidence_mismatch');
  }
  if (groups.paid_offer.length > 0 &&
      !intersects(groups.paid_offer, tuple?.offers)) {
    reasons.add('paid_offer_evidence_mismatch');
  }
  if (groups.acquisition.length > 0 &&
      !intersects(groups.acquisition, tuple?.channels)) {
    reasons.add('acquisition_evidence_mismatch');
  }
  if (groups.conversion_destination.length > 0 &&
      !groups.conversion_destination.some((ref) =>
        [
          tuple?.offers,
          tuple?.channels,
          tuple?.proofPoints
        ].some((dimension) =>
          dimensionRefs(dimension).has(ref)
        )
      )) {
    reasons.add('conversion_destination_evidence_mismatch');
  }
  if (groups.paid_conversion.length > 0 &&
      !groups.paid_conversion.some((ref) =>
        [
          tuple?.offers,
          tuple?.actions,
          tuple?.revenuePaths
        ].some((dimension) =>
          dimensionRefs(dimension).has(ref)
        )
      )) {
    reasons.add('paid_conversion_evidence_mismatch');
  }
  if (groups.attribution.length > 0 &&
      !intersects(groups.attribution, tuple?.revenuePaths)) {
    reasons.add('attribution_evidence_mismatch');
  }

  const evidenceText = (refs) => compactStrings(
    refs.map((ref) => {
      const evidence = asObject(evidenceByID.get(ref));
      return compactStrings([
        evidence.label,
        evidence.summary,
        evidence.url
      ]).join(' ');
    })
  ).join(' ');
  if (groups.buyer.length > 0 &&
      textOverlap(
        asObject(tuple?.buyerSegments).label,
        evidenceText(groups.buyer)
      ) <= 0) {
    reasons.add('unsupported_buyer_evidence');
  }
  if (groups.paid_offer.length > 0) {
    const paidOfferEvidence = evidenceText(groups.paid_offer);
    if (!paidOfferText(paidOfferEvidence) ||
        !revenueMechanismEvidenceText(
          revenuePath.revenueMechanism,
          paidOfferEvidence
        ) ||
        textOverlap(
          asObject(tuple?.offers).label,
          paidOfferEvidence
        ) <= 0) {
      reasons.add('unsupported_paid_offer_evidence');
    }
    if (groups.paid_offer.some((ref) =>
      !currentAffirmativeRevenueEvidence(
        evidenceByID.get(ref),
        revenuePath.revenueMechanism,
        referenceTime,
        'paid_offer'
      )
    )) {
      reasons.add('noncurrent_or_negative_paid_offer_evidence');
    }
  }
  if (groups.acquisition.length > 0 &&
      !acquisitionEvidenceSupportsMode(
        revenuePath.acquisitionMode,
        evidenceText(groups.acquisition)
      )) {
    reasons.add('unsupported_acquisition_evidence');
  }
  const destination = firstText(
    grounding.conversionDestination
  );
  const destinationEvidence =
    evidenceText(groups.conversion_destination);
  if (!destination ||
      comparable(destination) === comparable(
        asObject(tuple?.channels).label
      ) ||
      !conversionDestinationText(destination) ||
      (
        groups.conversion_destination.length > 0 &&
        (
          !conversionDestinationEvidenceText(destinationEvidence) ||
          textOverlap(destination, destinationEvidence) <= 0 ||
          !paidConversionEvidenceText(
            destinationEvidence,
            revenuePath.revenueMechanism
          ) ||
          groups.conversion_destination.some((ref) =>
            !currentAffirmativeRevenueEvidence(
              evidenceByID.get(ref),
              revenuePath.revenueMechanism,
              referenceTime,
              'paid_conversion'
            )
          )
        )
      )) {
    reasons.add('invalid_conversion_destination');
  }
  if (groups.paid_conversion.length > 0) {
    if (!paidConversionEvidenceText(
      evidenceText(groups.paid_conversion),
      revenuePath.revenueMechanism
    )) {
      reasons.add('unsupported_paid_conversion_evidence');
    }
    if (groups.paid_conversion.some((ref) =>
      !currentAffirmativeRevenueEvidence(
        evidenceByID.get(ref),
        revenuePath.revenueMechanism,
        referenceTime,
        'paid_conversion'
      )
    )) {
      reasons.add('noncurrent_or_negative_paid_conversion_evidence');
    }
  }
  if (groups.attribution.length > 0 &&
      !attributionSignalText(
        evidenceText(groups.attribution),
        revenuePath.attributionMethod
      )) {
    reasons.add('unsupported_attribution_evidence');
  }
  return [...reasons];
}

function paidOfferText(value) {
  return /\b(paid|billable|reimburs(?:able|ed|ement)|fee|priced?|purchase|sale|contract|retainer|subscription|deposit|invoice|paid pilot|licen[cs]e|royalt(?:y|ies)|commission|referral fee|sponsorship|platform payout|compensated|salary|wage|insurance (?:is )?accepted|accepts insurance|in[- ]network provider|health ?care (?:is )?accepted)\b/i.test(
    firstText(value)
  );
}

function incrementalIncomeText(value) {
  const text = firstText(value);
  return /\b(new|net new|additional|incremental|increase[ds]?|added|first)\b/i.test(text) &&
    /\b(paid|payment|revenue|income|gross|sale|contract|booking|order|reimburs(?:ement|ed)|retainer|subscription|licen[cs]e|royalt(?:y|ies)|commission|referral fee|sponsorship|payout|compensation|salary|wage)\b/i.test(text);
}

function revenueAdvancingAction(value) {
  const text = firstText(value);
  const advancesAcquisition =
    /\b(inbound|warm|permission(?:ed)?|opt in|introduc(?:e|tion)|referr(?:al|ed)|partner|invite|request|offer|proposal|quote|checkout|order|purchase|sale|sell|book(?:ing|ed)?|contract|agreement|sign(?:ed)?|close|deposit|invoice|pay(?:ment|ing)?|subscribe|subscription|retainer|pilot|licen[cs](?:e|ing)|royalt(?:y|ies)|commission|sponsor(?:ship)?|payout|compensated|salary|wage|hire|role)\b/i.test(
      text
    );
  const namesPaidCommitment =
    /\b(paid|payment|purchase|sale|contract|agreement|deposit|invoice|order|checkout|subscription|retainer|reimburs(?:able|ed|ement)|paid pilot|licen[cs]e|royalt(?:y|ies)|commission|referral fee|sponsorship|platform payout|compensated role|salary|wage)\b/i.test(
      text
    );
  const namesPermissionedDemand =
    /\b(inbound|warm (?:introduction|referral)|permissioned|opt in|partner (?:introduction|referral|channel)|referral)\b/i.test(
      text
    ) &&
    /\b(offer|proposal|quote|request|invite|introduction|referral|book(?:ing|ed)?|checkout|order|purchase|contract|agreement|pilot)\b/i.test(
      text
    );
  return advancesAcquisition &&
    (namesPaidCommitment || namesPermissionedDemand);
}

function operationOnlyAction(value) {
  const text = firstText(value);
  const namesOperations =
    /\b(eligibility|coverage|schedule|scheduling|workflow|process|operations?|administration|documentation|profile|content|research|review|verify|check|map|validate|optimi[sz]e|automate|audit|diagnostic)\b/i.test(
      text
    );
  if (!namesOperations) return false;
  const namesPaidCommitment =
    /\b(paid (?:booking|order|pilot|consultation|engagement)|payment|purchase|sale|contract|agreement|deposit|invoice|order|checkout|subscription|retainer|reimburs(?:able|ed|ement)|licen[cs]e|royalt(?:y|ies)|commission|referral fee|sponsorship|platform payout|compensated role|salary|wage)\b/i.test(
      text
    );
  const namesBoundedAcquisitionStep =
    /\b(inbound|warm (?:introduction|referral)|permissioned|partner (?:introduction|referral|channel)|existing (?:customer|client|patient)|referral)\b/i.test(
      text
    ) &&
    /\b(offer|proposal|quote|request|invite|introduction|referral|book(?:ing|ed)?|checkout|order|purchase|contract|agreement|pilot)\b/i.test(
      text
    );
  return !namesPaidCommitment && !namesBoundedAcquisitionStep;
}

function observableRevenueText(value) {
  return /\b(paid (?:booking|claim|invoice|order|pilot)|payment(?: receipt)?|signed (?:contract|agreement)|contract signed|deposit received|invoice (?:issued|accepted|paid)|checkout|purchase|order|sale|subscription|retainer|revenue recorded|income recorded|reimbursement (?:received|paid)|claim paid|licen[cs]e (?:signed|payment received)|royalty (?:statement|payment)|commission (?:recorded|paid)|referral fee (?:recorded|paid)|sponsorship (?:contract signed|payment received)|platform payout recorded|compensation (?:offer accepted|payment recorded)|salary payment|wage payment)\b/i.test(
    firstText(value)
  );
}

function acquisitionEvidenceSupportsMode(mode, value) {
  const text = comparable(firstText(value));
  const patterns = {
    inbound:
      /\b(?:agent mediated|app store|community|comparison (?:listing|site)|content distribution|directory|earned (?:directory|media)|google business profile|local search|marketplace discovery|map pack|nonbranded search|organic search|owned (?:audience|email|newsletter)|platform discovery|search engine|search listing|social distribution|utm|campaign source)\b/,
    warm_referral:
      /\b(?:warm referral|warm introduction|referred by|referral source)\b/,
    permissioned_outreach:
      /\b(?:permissioned|opt in|opted in|approved introduction|approved contact)\b/,
    existing_customer:
      /\b(?:existing|current|past) (?:customer|client|patient)\b/,
    partner_channel:
      /\b(?:partner channel|partner referral|partner introduction|affiliate|association referral)\b/
  };
  return patterns[mode]?.test(text) === true;
}

function conversionDestinationText(value) {
  return /\b(?:application page|booking (?:flow|form|page)|checkout|contact form|contract (?:form|page|request)|demo (?:form|page|request)|download page|invoice (?:page|payment page)|landing page|licen[cs](?:e|ing) (?:form|page|request)|marketplace listing|offer page|order form|payment form|pricing page|product page|proposal (?:form|page)|service page|sign up page|signup page|sponsorship (?:inquiry|request) (?:form|page)|storefront|subscription page)\b/i.test(
    firstText(value)
  );
}

function conversionDestinationEvidenceText(value) {
  const text = firstText(value);
  return conversionDestinationText(text) &&
    /\b(?:book|booking|buy|checkout|contact|contract|invoice|order|pay|payment|purchase|request|schedule|sign|sign up|subscribe|apply)\b/i.test(
      text
    );
}

function revenueMechanismEvidenceText(mechanism, value) {
  const text = firstText(value);
  const patterns = {
    paid_booking:
      /\b(?:paid|billable|fee|price|reimburs(?:able|ed|ement)|insurance (?:is )?accepted|health ?care (?:is )?accepted)\b/i,
    direct_sale:
      /\b(?:paid|price|purchase|sale|order|checkout)\b/i,
    signed_contract:
      /\b(?:paid|fee|contract|invoice|compensation)\b/i,
    paid_pilot:
      /\b(?:paid pilot|pilot fee|pilot price)\b/i,
    subscription_or_retainer:
      /\b(?:paid|price|subscription|retainer|recurring fee)\b/i,
    insurance_reimbursement:
      /\b(?:insurance (?:is )?accepted|accepts insurance|health ?care (?:is )?accepted|in[- ]network provider|claim|reimburs(?:able|ed|ement))\b/i,
    license_or_royalty:
      /\b(?:licen[cs]e|royalt(?:y|ies))\b/i,
    commission_or_referral:
      /\b(?:commission|referral fee|affiliate)\b/i,
    sponsorship:
      /\bsponsor(?:ship)?\b/i,
    platform_payout:
      /\b(?:platform|marketplace) payout\b/i,
    compensated_role:
      /\b(?:compensated|compensation|salary|wage|payroll|paid role)\b/i
  };
  return patterns[mechanism]?.test(text) === true;
}

function paidConversionEvidenceText(value, mechanism) {
  const text = firstText(value);
  if (!paidOfferText(text) ||
      !revenueMechanismEvidenceText(mechanism, text)) {
    return false;
  }
  const patterns = {
    paid_booking: /\b(?:book|booking|appointment|schedule|pay|claim)\b/i,
    direct_sale: /\b(?:buy|checkout|order|purchase|sale|pay)\b/i,
    signed_contract: /\b(?:contract|agreement|invoice|sign)\b/i,
    paid_pilot: /\b(?:paid pilot|pilot (?:booking|contract|order))\b/i,
    subscription_or_retainer:
      /\b(?:subscribe|subscription|sign up|signup|retainer|payment)\b/i,
    insurance_reimbursement:
      /\b(?:book|booking|claim|reimburs(?:able|ed|ement)|pay)\b/i,
    license_or_royalty:
      /\b(?:licen[cs](?:e|ing)|royalt(?:y|ies)|sign|payment)\b/i,
    commission_or_referral:
      /\b(?:commission|referral fee|affiliate|payment)\b/i,
    sponsorship:
      /\b(?:sponsor(?:ship)?|contract|inquiry|payment)\b/i,
    platform_payout:
      /\b(?:platform|marketplace) payout\b/i,
    compensated_role:
      /\b(?:apply|compensated|compensation|hire|offer|salary|wage|payroll|role)\b/i
  };
  return patterns[mechanism]?.test(text) === true;
}

function currentAffirmativeRevenueEvidence(
  evidenceValue,
  mechanism,
  referenceTime,
  role
) {
  const evidence = asObject(evidenceValue);
  if (evidence.approvedSourceObservation !== true ||
      evidence.current === false ||
      /\b(?:archived|cancelled|canceled|closed|discontinued|ended|expired|inactive|not accepting|sold out|unavailable|withdrawn)\b/i.test(
        firstText(evidence.status)
      )) {
    return false;
  }
  const referenceDate = new Date(referenceTime);
  const observedDate = new Date(firstText(evidence.observedAt));
  if (!Number.isFinite(referenceDate.getTime()) ||
      !Number.isFinite(observedDate.getTime())) {
    return false;
  }
  const age = referenceDate.getTime() - observedDate.getTime();
  if (age < -MAX_TIMING_VERIFICATION_FUTURE_SKEW_MS ||
      age > MAX_INBOUND_ASSET_OBSERVATION_AGE_MS) {
    return false;
  }
  const rawEndDate = firstText(evidence.endDate);
  if (rawEndDate) {
    const endDate = new Date(rawEndDate);
    if (!Number.isFinite(endDate.getTime()) ||
        endDate.getTime() < referenceDate.getTime()) {
      return false;
    }
  }
  const rawText = compactStrings([
    evidence.label,
    evidence.summary,
    evidence.url
  ]).join(' ');
  const text = comparable(rawText);
  if (!text ||
      /\b(?:archived|cancelled|canceled|closed|discontinued|ended|expired|inactive|no longer (?:available|offered|accepting|bookable)|not (?:available|accepting|bookable)|sold out|unavailable|withdrawn)\b/.test(
        text
      ) ||
      /\b(?:no|not|without)\s+(?:a\s+)?(?:paid|billable|bookable|purchasable|reimbursable) (?:offer|service|consultation|session|booking|option|plan|contract|role)\b/.test(
        text
      ) ||
      /\b(?:is|are|was|were)\s+not\s+(?:paid|billable|reimbursable|reimbursed|covered|compensated)\b/.test(
        text
      ) ||
      /\b(?:payment|insurance payment|reimbursement|compensation)\s+(?:is\s+)?not\s+required\b/.test(
        text
      )) {
    return false;
  }
  const namesFreeOption =
    /\b(?:complimentary|free trial|freemium|free|no fee|without charge|zero cost)\b/.test(
      text
    );
  const namesPaidAlternative =
    /\b(?:paid (?:plan|tier|subscription|option|version|license)|pricing|price|starts at|subscription fee|license fee|purchase|checkout)\b/.test(
      text
    ) ||
    /\$\s*\d/.test(rawText);
  if (namesFreeOption && !namesPaidAlternative) return false;
  if (mechanism === 'license_or_royalty' &&
      /\broyalty[ -]free\b/.test(text) &&
      !namesPaidAlternative) {
    return false;
  }
  const negativePatterns = {
    paid_booking:
      /\b(?:unpaid booking|free (?:booking|consultation|session)|not billable|no booking fee)\b/,
    direct_sale:
      /\b(?:not for sale|no purchase|free product only)\b/,
    signed_contract:
      /\b(?:unpaid contract|no contract fee|no compensation)\b/,
    paid_pilot:
      /\b(?:unpaid pilot|free pilot|no pilot fee)\b/,
    subscription_or_retainer:
      /\b(?:no paid plan|no subscription fee|free plan only|free tier only)\b/,
    insurance_reimbursement:
      /\b(?:insurance (?:is )?not accepted|health ?care (?:is )?not accepted|no health ?care accepted|not covered|no coverage|without coverage|not reimburs(?:able|ed)|no reimbursement|claim denied)\b/,
    license_or_royalty:
      /\b(?:no licen[cs]e fee|free licen[cs]e only|no royalty payment)\b/,
    commission_or_referral:
      /\b(?:no commission|no referral fee|unpaid affiliate)\b/,
    sponsorship:
      /\b(?:no sponsorship fee|unpaid sponsorship|free sponsorship)\b/,
    platform_payout:
      /\b(?:no (?:platform|marketplace )?payout|not monetized)\b/,
    compensated_role:
      /\b(?:unpaid|volunteer|no compensation|no salary|no wage)\b/
  };
  if (negativePatterns[mechanism]?.test(text)) return false;
  if (!revenueMechanismEvidenceText(mechanism, rawText)) return false;
  if (role === 'paid_conversion') {
    return paidConversionEvidenceText(rawText, mechanism);
  }
  return paidOfferText(rawText);
}

function prohibitedAcquisitionText(value) {
  return /\b(cold|unsolicited|mass|bulk|blast|spray(?:\s+and\s+pray)?|scrape|purchased list|automated form submission)\b/i.test(
    firstText(value)
  );
}

function acquisitionModeMatchesText(mode, value) {
  const text = comparable(firstText(value));
  if (mode === 'inbound') {
    return inboundDiscoveryDemandPathText(text);
  }
  const patterns = {
    warm_referral: /\b(warm|referral|introduction|existing network)\b/i,
    permissioned_outreach: /\b(permissioned|opt in|review first|approved|professional network|introduction request)\b/i,
    existing_customer: /\b(existing|current|past) (?:customer|client|patient)\b/i,
    partner_channel: /\b(partner|referral|affiliate|association|network channel)\b/i
  };
  return patterns[mode]?.test(text) === true;
}

function inboundDiscoveryDemandPathText(value) {
  const text = comparable(firstText(value));
  const namesDiscoveryOrigin =
    /\b(?:agent mediated|app store|community|comparison (?:listing|site)|content distribution|directory|earned (?:directory|media)|google business profile|local search|marketplace discovery|map pack|nonbranded search|organic search|owned (?:audience|email|newsletter)|platform discovery|search engine|search listing|social distribution)\b/.test(
      text
    );
  const namesDiscoveryMovement =
    /\b(?:arrive|click|discover|discovery|find|reach|route|search|send|traffic|visit)\b/.test(
      text
    );
  const namesDistinctDestination =
    /\b(?:application page|booking (?:flow|form|page)|checkout|contact form|contract (?:form|page)|demo (?:form|page|request)|download page|landing page|licen[cs](?:e|ing) (?:form|page|request)|marketplace listing|offer page|order form|pricing page|product page|proposal (?:form|page)|service page|sign up page|signup page|sponsorship (?:inquiry|request) (?:form|page)|storefront|subscription page|website)\b/.test(
      text
    );
  return /\binbound\b/.test(text) &&
    namesDiscoveryOrigin &&
    namesDiscoveryMovement &&
    namesDistinctDestination;
}

function attributionSignalText(value, method) {
  const text = firstText(value);
  if (!/\b(source|referral|utm|campaign|origin|channel|code|crm)\b/i.test(text)) {
    return false;
  }
  const patterns = {
    booking_record: /\b(booking|appointment|consultation) (?:record|field|source)\b/i,
    payment_receipt: /\b(payment|receipt|transaction)\b/i,
    invoice_or_contract: /\b(invoice|contract|agreement)\b/i,
    checkout_or_order: /\b(checkout|order|purchase)\b/i,
    claim_record: /\b(claim|reimbursement)\b/i,
    crm_source: /\b(crm|source field|campaign field)\b/i,
    referral_code: /\b(referral code|code field)\b/i,
    license_or_royalty_record:
      /\b(licen[cs]e|royalty) (?:record|field|statement|contract)\b/i,
    affiliate_or_commission_record:
      /\b(affiliate|commission|referral fee) (?:record|field|statement|code)\b/i,
    platform_or_marketplace_record:
      /\b(platform|marketplace) (?:record|field|statement|payout)\b/i,
    employment_compensation_record:
      /\b(employment|compensation|payroll|salary|wage) (?:record|field|statement|offer)\b/i
  };
  return patterns[method]?.test(text) === true;
}

function revenueActionsAlign(action, conversionAction) {
  if (textOverlap(action, conversionAction) >= 0.2) return true;
  const actionCategories = revenueActionCategories(action);
  const conversionCategories = revenueActionCategories(conversionAction);
  return actionCategories.some((category) =>
    conversionCategories.includes(category)
  );
}

function revenueActionCategories(value) {
  const text = firstText(value);
  const patterns = {
    inbound: /\b(inbound|service page|landing page|website|booking page)\b/i,
    referral: /\b(warm|introduc(?:e|tion)|referr(?:al|ed)|partner)\b/i,
    permissioned: /\b(permissioned|opt in|review first|approved)\b/i,
    offer: /\b(offer|proposal|quote|pilot)\b/i,
    booking: /\b(book(?:ing|ed)?|appointment|consultation)\b/i,
    payment: /\b(paid|pay(?:ment|ing)?|deposit|invoice|checkout|purchase|order|sale)\b/i,
    contract: /\b(contract|agreement|sign(?:ed)?|retainer|subscription)\b/i,
    reimbursement: /\b(claim|reimburs(?:able|ed|ement))\b/i
    ,
    license: /\b(licen[cs]e|royalt(?:y|ies))\b/i,
    commission: /\b(commission|referral fee|affiliate)\b/i,
    sponsorship: /\bsponsor(?:ship)?\b/i,
    payout: /\b(platform|marketplace) payout\b/i,
    compensation: /\b(compensated role|employment|salary|wage|payroll|hire)\b/i
  };
  return Object.entries(patterns)
    .filter(([, pattern]) => pattern.test(text))
    .map(([category]) => category);
}

function tupleAllowed(tuple, constraints) {
  const combined = DIMENSIONS.map(([name]) => tuple[name].label).join(' ');
  if (/\b(mass|bulk|blast|spray(?:\s+and\s+pray)?|scrape|automated form submission)\b/i.test(combined)) {
    return false;
  }
  const allowedChannels = asArray(constraints.allowedChannels);
  if (allowedChannels.length > 0 && !allowedValue(tuple.channels.label, allowedChannels)) {
    return false;
  }
  const allowedActions = asArray(constraints.allowedActions)
    .filter((value) => !['research', 'recommend', 'review'].includes(comparable(value)));
  if (allowedActions.length > 0 && !allowedValue(tuple.actions.label, allowedActions)) {
    return false;
  }
  for (const prohibited of asArray(constraints.prohibitedActions)) {
    const phrase = comparable(
      String(prohibited).replace(/^(do not|never|prohibit|without approval)\s+/i, '')
    );
    if (phrase.length >= 4 && comparable(combined).includes(phrase)) return false;
  }
  return true;
}

function allowedValue(value, allowed) {
  const target = comparable(value);
  return allowed.some((item) => {
    const candidate = comparable(item);
    return candidate && (
      target === candidate ||
      target.includes(candidate) ||
      candidate.includes(target)
    );
  });
}

function hypothesisJudgeReason(tuple, score) {
  const strongest = [
    ['objectiveFit', 'objective fit'],
    ['evidenceStrength', 'evidence strength'],
    ['buyerAuthority', 'buyer authority'],
    ['timing', 'timing'],
    ['warmPath', 'warm-path potential'],
    ['expectedValue', 'expected value']
  ].sort((left, right) => score[right[0]] - score[left[0]])[0];
  return `Incremental-income path: ${tuple.revenuePaths.revenuePath.incrementalIncomeOutcome} Grounded by ${tuple.proofPoints.label}; strongest dimension was ${strongest[1]} (${score[strongest[0]].toFixed(3)}).`;
}

function commonCompatibilityFamilies(tuple, seedSet) {
  const familySets = DIMENSIONS.map(([name]) =>
    new Set(compactStrings(asObject(tuple[name]).familyIds))
  );
  if (familySets.some((families) => families.size === 0)) return [];
  return [...familySets[0]]
    .filter((family) =>
      familySets.slice(1).every((families) => families.has(family))
    )
    .sort();
}

function commonStrategyEvidenceRefs(tuple, familyID, seedSet) {
  const family = asArray(asObject(seedSet).strategyFamilies)
    .map(asObject)
    .find((item) => item.id === familyID);
  const familyRefs = new Set(
    strategyAnchorEvidenceRefs(family?.evidenceRefs)
  );
  const used = new Set();
  for (const [dimension] of DIMENSIONS) {
    for (const ref of strategyAnchorEvidenceRefs(
      asObject(tuple[dimension]).evidenceRefs
    )) {
      if (familyRefs.has(ref)) used.add(ref);
    }
  }
  return [...used].sort();
}

function strategyAnchorEvidenceRefs(values) {
  return compactStrings(values)
    .filter((ref) => !/^source:/i.test(ref));
}

function strategyProvenance(
  tuple,
  familyID,
  seedSet,
  evidenceByID,
  motionSignature = strategyMotionSignature(tuple)
) {
  const family = asArray(asObject(seedSet).strategyFamilies)
    .map(asObject)
    .find((item) => item.id === familyID);
  const dimensionNames = {
    offer: 'offers',
    buyerSegment: 'buyerSegments',
    channel: 'channels',
    action: 'actions',
    timingTrigger: 'timingTriggers',
    proofPoint: 'proofPoints',
    followUp: 'followUps',
    revenuePath: 'revenuePaths'
  };
  const dimensions = Object.fromEntries(
    Object.entries(dimensionNames).map(([publicName, tupleName]) => {
      const seed = asObject(tuple[tupleName]);
      return [publicName, {
        familyIds: compactStrings(seed.familyIds),
        evidenceRefs: compactStrings(seed.evidenceRefs)
      }];
    })
  );
  const timingSeed = asObject(tuple.timingTriggers);
  const timingEvidenceRef = compactStrings(timingSeed.supportEvidenceRefs)[0];
  const timingEvidence = asObject(evidenceByID.get(timingEvidenceRef));
  return {
    strategyFamilyId: familyID,
    motionSignatures: motionSignature.motionSignatures,
    motionDimensions: motionSignature.dimensions,
    familyEvidenceRefs: compactStrings(family?.evidenceRefs),
    sharedEvidenceRefs: commonStrategyEvidenceRefs(tuple, familyID, seedSet),
    dimensions,
    timingSupportPhrase: firstText(timingSeed.supportPhrase),
    timingEvidenceRef,
    timingEvidenceText: truncate(compactStrings([
      timingEvidence.label,
      timingEvidence.summary
    ]).join(' '), 600),
    timingVerificationRepaired:
      timingSeed.timingVerificationRepaired === true,
    revenueContractVersion: firstText(
      asObject(tuple?.revenuePaths?.revenuePath).contractVersion,
      REVENUE_PATH_CONTRACT_VERSION
    )
  };
}

function strategyMotionSignature(tuple) {
  if (firstText(
    asObject(tuple?.revenuePaths?.revenuePath).contractVersion
  ) === REVENUE_PATH_CONTRACT_VERSION) {
    return acquisitionFamilySignature(tuple);
  }
  return legacyStrategyMotionSignature(tuple);
}

function acquisitionFamilySignature(tuple) {
  const dimensionNames = {
    offer: 'offers',
    buyerSegment: 'buyerSegments',
    channel: 'channels',
    action: 'actions',
    timingTrigger: 'timingTriggers',
    proofPoint: 'proofPoints',
    followUp: 'followUps',
    revenuePath: 'revenuePaths'
  };
  const pathMode = contractEnum(firstText(
    asObject(tuple?.revenuePaths?.revenuePath).acquisitionMode
  ));
  const dimensions = Object.fromEntries(
    Object.entries(dimensionNames).map(([publicName, tupleName]) => [
      publicName,
      publicName === 'revenuePath'
        ? pathMode ? [pathMode] : []
        : acquisitionModesFromText(
            asObject(tuple[tupleName]).label
          )
    ])
  );
  const conflictDimensions = Object.entries(dimensionNames)
    .filter(([publicName, tupleName]) => {
      const labelModes = dimensions[publicName];
      const familyModes = compactStrings(
        asObject(tuple[tupleName]).acquisitionModes
      );
      const familyMismatch = familyModes.length !== 1 ||
        familyModes[0] !== pathMode;
      const labelMismatch = labelModes.length > 1 ||
        (labelModes.length === 1 && labelModes[0] !== pathMode);
      const requiresExplicitMode =
        publicName === 'channel' || publicName === 'action';
      return familyMismatch ||
        labelMismatch ||
        (requiresExplicitMode && labelModes.length !== 1);
    })
    .map(([publicName]) => publicName);
  const coherent = ACQUISITION_MODES.has(pathMode) &&
    conflictDimensions.length === 0;
  return {
    coherent,
    motionSignatures: coherent
      ? [pathMode]
      : compactStrings([
          pathMode,
          ...Object.values(dimensions).flat()
        ]).sort(),
    dimensions,
    conflictDimensions
  };
}

function acquisitionModesFromText(value) {
  const text = comparable(firstText(value));
  if (!text) return [];
  const modes = [];
  if (/\binbound\b/.test(text)) modes.push('inbound');
  if (/\bwarm (?:referral|introduction)\b/.test(text)) {
    modes.push('warm_referral');
  }
  if (/\b(?:permissioned|opt in|review first|approved) (?:outreach|introduction|request|contact|proposal|offer)\b/.test(
    text
  )) {
    modes.push('permissioned_outreach');
  }
  if (/\b(?:existing|current|past) (?:customer|client|patient)\b/.test(
    text
  )) {
    modes.push('existing_customer');
  }
  if (/\bpartner (?:channel|referral|introduction)\b/.test(text)) {
    modes.push('partner_channel');
  }
  return [...new Set(modes)].sort();
}

function legacyStrategyMotionSignature(tuple) {
  const dimensionNames = {
    offer: 'offers',
    buyerSegment: 'buyerSegments',
    channel: 'channels',
    action: 'actions',
    timingTrigger: 'timingTriggers',
    proofPoint: 'proofPoints',
    followUp: 'followUps',
    revenuePath: 'revenuePaths'
  };
  const dimensions = Object.fromEntries(
    Object.entries(dimensionNames).map(([publicName, tupleName]) => [
      publicName,
      strategyMotions(asObject(tuple[tupleName]).label, publicName)
    ])
  );
  const buyerMotions = dimensions.buyerSegment;
  const primaryMotion = buyerMotions.length === 1
    ? buyerMotions[0]
    : '';
  const conflictDimensions = Object.keys(dimensions)
    .filter((dimension) => {
      const motions = dimensions[dimension];
      if (dimension === 'buyerSegment') return motions.length !== 1;
      return motions.length > 1 ||
        (motions.length === 1 && motions[0] !== primaryMotion);
    });
  const coherent = Boolean(primaryMotion) &&
    conflictDimensions.length === 0;
  const motionSignatures = coherent
    ? [primaryMotion]
    : compactStrings(Object.values(dimensions).flat()).sort();
  return {
    coherent,
    motionSignatures,
    dimensions,
    conflictDimensions
  };
}

function timingEvidenceConflictsWithStrategyMotion(
  tuple,
  motionSignature,
  evidenceByID
) {
  if (firstText(
    asObject(tuple?.revenuePaths?.revenuePath).contractVersion
  ) === REVENUE_PATH_CONTRACT_VERSION) {
    return false;
  }
  const primaryMotion = asArray(motionSignature?.motionSignatures)[0];
  if (!primaryMotion) return true;
  const timingSeed = asObject(tuple?.timingTriggers);
  for (const ref of compactStrings(timingSeed.supportEvidenceRefs)) {
    const evidence = asObject(evidenceByID.get(ref));
    const evidenceMotions = strategyMotions(compactStrings([
      evidence.label,
      evidence.summary
    ]).join(' '));
    if (evidenceMotions.some((motion) => motion !== primaryMotion)) {
      return true;
    }
  }
  return false;
}

function emptyMotionConflictDimensions() {
  return {
    offer: 0,
    buyerSegment: 0,
    channel: 0,
    action: 0,
    timingTrigger: 0,
    proofPoint: 0,
    followUp: 0,
    revenuePath: 0
  };
}

function strategyMotions(value, dimension = '') {
  const label = comparable(firstText(value));
  if (!label) return [];
  const motions = Object.entries(STRATEGY_MOTION_PATTERNS)
    .filter(([, patterns]) =>
      patterns.some((pattern) => pattern.test(label))
    )
    .map(([motion]) => motion);
  if (dimension === 'buyerSegment' &&
      /\b(?:patient|parent|mother|family|caregiver|member)s?\b/.test(label) &&
      !motions.includes('patient_inbound')) {
    motions.push('patient_inbound');
  }
  const hasPatientBuyer = dimension === 'buyerSegment' &&
    motions.includes('patient_inbound');
  const hasPayerOrganizationIntent =
    /\b(?:contracting|credentialing|credentialed|enrollment|application|participation|relations|partnership|leadership|team|executive|director|manager|decision maker)s?\b/.test(label);
  if (hasPatientBuyer &&
      motions.includes('payer_network') &&
      !hasPayerOrganizationIntent) {
    motions.splice(motions.indexOf('payer_network'), 1);
  }
  const specializedMotions = motions.filter((motion) =>
    motion !== 'organization_partnership'
  );
  if (specializedMotions.length > 0 &&
      motions.includes('organization_partnership')) {
    motions.splice(motions.indexOf('organization_partnership'), 1);
  }
  return [...new Set(motions)].sort();
}

function strategyFamilyPriorityIndexes(dimensions, seedSet) {
  if (dimensions.some((items) => items.length === 0)) return [];
  const commonFamilies = compactStrings(
    dimensions[0].flatMap((item) => asArray(item.familyIds))
  ).filter((family, index, families) =>
    families.indexOf(family) === index &&
    dimensions.slice(1).every((items) =>
      items.some((item) => asArray(item.familyIds).includes(family))
    )
  );
  const priorityIndexes = [];
  for (const family of commonFamilies) {
    const familyDefinition = asArray(asObject(seedSet).strategyFamilies)
      .map(asObject)
      .find((item) => item.id === family);
    const familyRefs = new Set(
      strategyAnchorEvidenceRefs(familyDefinition?.evidenceRefs)
    );
    const familyIndexes = dimensions.map((items) =>
      items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) =>
          asArray(item.familyIds).includes(family) &&
          strategyAnchorEvidenceRefs(item.evidenceRefs)
            .some((ref) => familyRefs.has(ref))
        )
        .map(({ index }) => index)
    );
    if (familyIndexes.some((indexes) => indexes.length === 0)) continue;
    const familyCombinationCount = familyIndexes.reduce(
      (total, indexes) => total * indexes.length,
      1
    );
    const familySampleCount = Math.min(
      familyCombinationCount,
      MAX_HYPOTHESES
    );
    let firstSameFamilyIndex = null;
    let coherentFamilyIndex = null;
    for (const localFlatIndex of deterministicCartesianIndexes(
      familyCombinationCount,
      familySampleCount,
      `${family}:priority`
    )) {
      const indexes = decodeCartesianIndex(
        localFlatIndex,
        familyIndexes
      );
      const tuple = Object.fromEntries(
        DIMENSIONS.map(([name], index) => [
          name,
          dimensions[index][indexes[index]]
        ])
      );
      const encodedIndex = encodeCartesianIndex(indexes, dimensions);
      if (firstSameFamilyIndex == null) {
        firstSameFamilyIndex = encodedIndex;
      }
      if (strategyMotionSignature(tuple).coherent) {
        coherentFamilyIndex = encodedIndex;
        break;
      }
    }
    if (coherentFamilyIndex != null) {
      priorityIndexes.push(coherentFamilyIndex);
    } else if (firstSameFamilyIndex != null) {
      // Preserve one same-family adversarial tuple so the main gate records a
      // semantic motion conflict instead of bounded sampling observing only
      // cross-family incompatibility.
      priorityIndexes.push(firstSameFamilyIndex);
    }
  }
  return priorityIndexes;
}

function prioritizedCartesianIndexes(total, limit, seed, priorityIndexes) {
  const out = [];
  const seen = new Set();
  const append = (index) => {
    if (!Number.isInteger(index) ||
        index < 0 ||
        index >= total ||
        seen.has(index) ||
        out.length >= limit) {
      return;
    }
    seen.add(index);
    out.push(index);
  };
  for (const index of asArray(priorityIndexes)) append(index);
  const sampleCount = Math.min(total, limit + out.length);
  for (const index of deterministicCartesianIndexes(total, sampleCount, seed)) {
    append(index);
  }
  return out;
}

function deterministicCartesianIndexes(total, limit, seed) {
  if (total <= limit) return Array.from({ length: total }, (_, index) => index);
  const start = hashInteger(seed) % total;
  let step = Math.max(1, hashInteger(`${seed}:step`) % total);
  while (greatestCommonDivisor(step, total) !== 1) {
    step = (step + 1) % total;
    if (step === 0) step = 1;
  }
  const out = [];
  for (let index = 0; index < limit; index += 1) {
    out.push((start + index * step) % total);
  }
  return out;
}

function encodeCartesianIndex(indexes, dimensions) {
  let flatIndex = 0;
  for (let index = 0; index < dimensions.length; index += 1) {
    flatIndex = flatIndex * dimensions[index].length + indexes[index];
  }
  return flatIndex;
}

function decodeCartesianIndex(flatIndex, dimensions) {
  let remainder = flatIndex;
  const selected = [];
  for (let index = dimensions.length - 1; index >= 0; index -= 1) {
    const values = dimensions[index];
    selected[index] = values[remainder % values.length];
    remainder = Math.floor(remainder / values.length);
  }
  return selected;
}

function greatestCommonDivisor(left, right) {
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return Math.abs(left);
}

function evidenceIndex(catalog) {
  const index = new Map();
  for (const item of catalog) {
    index.set(item.id, item);
    for (const alias of asArray(item.aliases)) {
      if (!index.has(alias)) index.set(alias, item);
    }
  }
  return index;
}

function stringsOverlap(left, right) {
  const rightValues = new Set(compactStrings(right));
  return compactStrings(left).some((value) => rightValues.has(value));
}

function candidateEvidenceGroundsHypothesis(
  candidateValue,
  hypothesis,
  evidenceCatalogOrIndex
) {
  const candidate = asObject(candidateValue);
  const evidenceRefs = strategyAnchorEvidenceRefs(candidate.evidenceRefs);
  const tuple = asObject(hypothesis?._tuple);
  const buyerEvidence = strategyAnchorEvidenceRefs(
    asObject(tuple.buyerSegments).evidenceRefs
  );
  const offerEvidence = strategyAnchorEvidenceRefs(
    asObject(tuple.offers).evidenceRefs
  );
  const proofEvidence = strategyAnchorEvidenceRefs(
    asObject(tuple.proofPoints).evidenceRefs
  );
  const channelEvidence = strategyAnchorEvidenceRefs(
    asObject(tuple.channels).evidenceRefs
  );
  const revenuePathEvidence = strategyAnchorEvidenceRefs(
    asObject(tuple.revenuePaths?.revenuePath).evidenceRefs
  );
  if (ownedInboundAssetCandidate(candidate)) {
    const evidenceByID = evidenceCatalogOrIndex instanceof Map
      ? evidenceCatalogOrIndex
      : evidenceIndex(asArray(evidenceCatalogOrIndex));
    const publicUrl = safePublicURL(firstText(candidate.publicUrl));
    const assetEvidenceIsBound = Boolean(
      publicUrl &&
      evidenceRefs.some((ref) => {
        const evidence = asObject(evidenceByID.get(ref));
        return approvedOwnedAssetEvidence(evidence, evidenceByID) &&
          comparableURL(safePublicURL(evidence.url)) ===
            comparableURL(publicUrl) &&
          [...offerEvidence, ...proofEvidence].includes(ref);
      })
    );
    const allEvidenceIsApprovedObservation =
      evidenceRefs.length > 0 &&
      evidenceRefs.every((ref) =>
        asObject(evidenceByID.get(ref)).approvedSourceObservation === true
      );
    return firstText(hypothesis?.revenuePath?.acquisitionMode) ===
        'inbound' &&
      assetEvidenceIsBound &&
      allEvidenceIsApprovedObservation &&
      stringsOverlap(evidenceRefs, buyerEvidence) &&
      stringsOverlap(evidenceRefs, channelEvidence) &&
      stringsOverlap(evidenceRefs, revenuePathEvidence);
  }
  if (organizationCandidateRequiresBuyerMatch(candidate) &&
      !exactTextContains(
        asObject(tuple.buyerSegments).label,
        candidate.displayLabel
      )) {
    return false;
  }
  return stringsOverlap(evidenceRefs, buyerEvidence) &&
    stringsOverlap(evidenceRefs, [...offerEvidence, ...proofEvidence]);
}

function candidateActionableForHypothesis(
  candidateValue,
  hypothesis,
  evidenceCatalogOrIndex
) {
  const candidate = asObject(candidateValue);
  if (!candidateEvidenceGroundsHypothesis(
    candidate,
    hypothesis,
    evidenceCatalogOrIndex
  )) {
    return false;
  }
  const acquisitionMode = firstText(
    hypothesis?.revenuePath?.acquisitionMode
  );
  if (acquisitionMode === 'inbound') {
    return ownedInboundAssetCandidate(candidate) &&
      candidate.identityResolved === true;
  }
  return !ownedInboundAssetCandidate(candidate) &&
    candidate.identityResolved === true &&
    candidate.exactNamedCandidate === true;
}

function approvedOwnedAssetEvidence(evidenceValue, evidenceByID) {
  const evidence = asObject(evidenceValue);
  const publicUrl = safePublicURL(evidence.url);
  const sourceUrl = safePublicURL(evidence.approvedSourceUrl);
  if (evidence.approvedSourceObservation !== true ||
      evidence.profileControlledSource !== true ||
      !firstText(evidence.sourceId) ||
      !publicUrl ||
      !sourceUrl) {
    return false;
  }
  try {
    const asset = new URL(publicUrl);
    const approved = new URL(sourceUrl);
    const approvedPath = approved.pathname.replace(/\/+$/, '') || '/';
    const assetPath = asset.pathname.replace(/\/+$/, '') || '/';
    return publicURLsShareCanonicalOrigin(asset, approved) &&
      urlContainsDeclaredQuery(asset, approved) &&
      (
        approvedPath === '/' ||
        assetPath === approvedPath ||
        assetPath.startsWith(`${approvedPath}/`)
      );
  } catch {
    return false;
  }
}

function ownedInboundAssetCandidate(candidateValue) {
  const candidate = asObject(candidateValue);
  return contractEnum(firstText(candidate.kind, candidate.k)) ===
    OWNED_INBOUND_ASSET_KIND;
}

function organizationCandidateRequiresBuyerMatch(candidateValue) {
  const candidate = asObject(candidateValue);
  if (ownedInboundAssetCandidate(candidate)) return false;
  const kind = comparable(firstText(candidate.kind, candidate.k));
  const organization = firstText(candidate.organization, candidate.company);
  const displayLabel = firstText(candidate.displayLabel, candidate.l);
  const organizationKind =
    /\b(?:organization|company|business|institution|hospital|employer|association|university|health system|payer|insurer|agency|practice|facility)\b/.test(
      kind
    );
  const displayIsOrganization = Boolean(
    organization &&
    comparable(organization) === comparable(displayLabel)
  );
  return (
    organizationKind ||
    displayIsOrganization ||
    organizationLikeCandidateLabel(displayLabel)
  ) &&
    (
      candidate.exactNamedCandidate === true ||
      candidate.identityResolved === true ||
      compactStrings(candidate.providers).some((provider) =>
        /^(?:openrouter_(?:evidence|seed)_extraction|source_evidence)$/i.test(
          provider
        )
      )
    );
}

function evidenceQuality(item) {
  const value = asObject(item);
  let score = 0;
  const type = comparable(value.type);
  if (value.url) score += 4;
  if (value.summary) score += 3;
  if (value.observedAt) score += 2;
  if (value.confidence === 'high') score += 3;
  if (/\b(source evidence|source extract|explicit fact|project|experience|current focus)\b/.test(type)) score += 4;
  if (type === 'profile fact') score += 1;
  return score;
}

function evidenceQualityNormalized(item) {
  return clamp01(evidenceQuality(item) / 16);
}

function dimensionCounts(seedSet) {
  return Object.fromEntries(DIMENSIONS.map(([name]) => [name, seedSet[name]?.length || 0]));
}

function emptySearchSpace(budget) {
  return {
    maxHypotheses: budget.maxHypotheses,
    theoreticalCount: 0,
    expandedCount: 0,
    eligibleCount: 0,
    filteredCount: 0,
    incompatibleCount: 0,
    motionConflictCount: 0,
    motionConflictDimensions: emptyMotionConflictDimensions(),
    revenueGate: REVENUE_GATE_VERSION,
    revenuePathContract: REVENUE_PATH_CONTRACT_VERSION,
    revenueRejectedCount: 0,
    revenueRejectionReasons: {},
    retainedCount: 0,
    dimensionCounts: {},
    seedContract: '',
    declaredStrategyFamilyCount: 0,
    familyWrapperCount: 0,
    validStrategyFamilyCount: 0,
    strategyFamilyCount: 0,
    completeStrategyFamilyCount: 0,
    incompleteStrategyFamilyCount: 0,
    strategyFamilyAnchorCoverage: [],
    strategyFamilyCollisionCount: 0,
    familyEvidenceMismatchSeedCount: 0,
    invalidFamilySeedCount: 0,
    unsupportedTimingSeedCount: 0,
    timingVerificationRepairCount: 0,
    coherenceGate: COHERENCE_GATE_VERSION,
    generatorContract: TOURNAMENT_GENERATOR_CONTRACT,
    deterministic: true,
    modelCalls: 0
  };
}

function researchOnlyGate(decision, reason, extra = {}) {
  return {
    decision,
    reason,
    requiresReview: extra.requiresReview !== false,
    question: firstText(extra.question),
    winnerHypothesisId: firstText(extra.winnerHypothesisId),
    authorizedEffects: ['research', 'recommendation'],
    prohibitedEffects: ['pdl_enrichment', 'outreach', 'publishing', 'provider_writes'],
    sideEffects: zeroSideEffects()
  };
}

function zeroSideEffects() {
  return {
    pdlCalls: 0,
    outreachAttempts: 0,
    publishAttempts: 0,
    providerWrites: 0
  };
}

function openRouterMetadata({
  model,
  status,
  usage,
  generationId,
  diagnostics,
  promptHash,
  error
}) {
  const responseDiagnostics = normalizeOpenRouterResponseDiagnostics(
    diagnostics
  );
  return compact({
    provider: 'openrouter',
    model: firstText(model),
    purpose: 'rig_opportunity_tournament',
    generatorContract: TOURNAMENT_GENERATOR_CONTRACT,
    status,
    generationId: firstText(generationId),
    promptHash,
    error,
    openRouterUsage: normalizeUsage(usage),
    responseDiagnostics:
      Object.keys(responseDiagnostics).length > 0
        ? responseDiagnostics
        : undefined
  });
}

function normalizeOpenRouterResponseDiagnostics(value) {
  const diagnostics = asObject(value);
  const contentSha256 = firstText(diagnostics.contentSha256).toLowerCase();
  const providerErrorType = firstText(
    diagnostics.providerErrorType
  ).toLowerCase();
  const providerErrorCode = firstText(
    diagnostics.providerErrorCode
  ).toLowerCase();
  return compact({
    finishReason: truncate(firstText(diagnostics.finishReason), 64),
    nativeFinishReason: truncate(
      firstText(diagnostics.nativeFinishReason),
      64
    ),
    contentByteCount: nonNegativeInteger(diagnostics.contentByteCount),
    contentSha256: /^[a-f0-9]{64}$/.test(contentSha256)
      ? contentSha256
      : undefined,
    providerErrorType: /^[a-z][a-z0-9_]{0,63}$/.test(
      providerErrorType
    )
      ? providerErrorType
      : undefined,
    providerErrorCode: /^[a-z0-9][a-z0-9_.:-]{0,63}$/.test(
      providerErrorCode
    )
      ? providerErrorCode
      : undefined
  });
}

function aggregateUsage(entries, budget) {
  const usageEntries = entries
    .map((entry) => normalizeUsage(entry.openRouterUsage))
    .filter((usage) => Object.keys(usage).length > 0);
  const promptTokens = sumFinite(
    usageEntries.map((usage) => usage.prompt_tokens ?? usage.promptTokens)
  );
  const completionTokens = sumFinite(
    usageEntries.map((usage) => usage.completion_tokens ?? usage.completionTokens)
  );
  const totalTokens = sumFinite(
    usageEntries.map((usage) => usage.total_tokens ?? usage.totalTokens)
  );
  const costs = usageEntries
    .map((usage) => providerCost(usage.cost))
    .filter((value) => value !== null);
  const reportedCostUsd = costs.length > 0 ? sumFinite(costs) : 0;
  return {
    provider: 'openrouter',
    calls: entries.length,
    successfulCalls: entries.filter((entry) => entry.status === 'completed').length,
    models: compactStrings(entries.map((entry) => entry.model)),
    promptTokens: Math.round(promptTokens),
    completionTokens: Math.round(completionTokens),
    totalTokens: Math.round(totalTokens),
    reportedCostUsd: roundMoney(reportedCostUsd),
    reportedCostMicros: Math.round(reportedCostUsd * 1_000_000),
    costReporting: costs.length === entries.length
      ? 'complete'
      : costs.length > 0 ? 'partial' : 'unavailable',
    maxLLMSpendMicros: budget.maxLLMSpendMicros,
    providerMaxPrice: { ...budget.providerMaxPrice },
    withinBudget: costs.length === 0 || Math.round(reportedCostUsd * 1_000_000) <= budget.maxLLMSpendMicros,
    maxOutputTokens: budget.maxOutputTokens
  };
}

function emptyUsage(model, budget) {
  return {
    provider: 'openrouter',
    calls: 0,
    successfulCalls: 0,
    models: firstText(model) ? [firstText(model)] : [],
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    reportedCostUsd: 0,
    reportedCostMicros: 0,
    // No provider calls means all zero call-cost receipts are accounted for.
    costReporting: 'complete',
    maxLLMSpendMicros: budget.maxLLMSpendMicros,
    providerMaxPrice: { ...budget.providerMaxPrice },
    withinBudget: true,
    maxOutputTokens: budget.maxOutputTokens
  };
}

function normalizeUsage(value) {
  const raw = asObject(value);
  const nested = asObject(raw.raw);
  const costValue = Object.prototype.hasOwnProperty.call(raw, 'cost')
    ? raw.cost
    : nested.cost;
  return compact({
    prompt_tokens: positiveInteger(raw.prompt_tokens ?? nested.prompt_tokens),
    completion_tokens: positiveInteger(raw.completion_tokens ?? nested.completion_tokens),
    total_tokens: positiveInteger(raw.total_tokens ?? nested.total_tokens),
    promptTokens: positiveInteger(raw.promptTokens ?? nested.promptTokens),
    completionTokens: positiveInteger(raw.completionTokens ?? nested.completionTokens),
    totalTokens: positiveInteger(raw.totalTokens ?? nested.totalTokens),
    cost: providerCost(costValue)
  });
}

function normalizeScores(value) {
  const raw = asObject(value);
  const out = {};
  for (const field of [...POSITIVE_SCORE_FIELDS, ...BURDEN_SCORE_FIELDS, 'total']) {
    const score = finite(scoreFieldValue(raw, field));
    if (score !== null) out[field] = round(clamp01(score));
  }
  return out;
}

function scoreFieldValue(raw, field) {
  for (const alias of SCORE_ALIASES[field] || [field]) {
    if (raw[alias] !== undefined && raw[alias] !== null && raw[alias] !== '') {
      return raw[alias];
    }
  }
  return undefined;
}

function defaultScoreForField(field) {
  if (field === 'evidenceStrength') return 0.55;
  if (field === 'objectiveFit') return 0.5;
  if (field === 'uncertainty') return 0.62;
  if (BURDEN_SCORE_FIELDS.includes(field)) return 0.45;
  return 0.42;
}

function textOverlap(left, right) {
  const leftTokens = meaningfulTokens(left);
  const rightTokens = meaningfulTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return clamp01(intersection / Math.min(leftTokens.size, rightTokens.size));
}

function meaningfulTokens(value) {
  const stop = new Set([
    'about', 'after', 'again', 'also', 'before', 'being', 'business', 'create',
    'explicit', 'from', 'have', 'into', 'more', 'most', 'only', 'professional',
    'recommendation', 'research', 'that', 'their', 'there', 'these', 'this',
    'through', 'user', 'with', 'would', 'the', 'and', 'for', 'one'
  ]);
  return new Set(
    comparable(value)
      .split(' ')
      .filter((token) => token.length > 2 && !stop.has(token))
  );
}

function normalizeEvidenceID(rawID, type, sourceID) {
  const value = firstText(rawID);
  if (!value) return sourceID ? `source:${sourceID}` : '';
  if (/^(source|observation|fact|profile|timeline|evidence):/i.test(value) ||
      /^https?:\/\//i.test(value)) {
    return value;
  }
  return `${comparable(type).replace(/\s+/g, '_') || 'evidence'}:${value}`;
}

function normalizeSeedID(rawID, dimension, label) {
  const normalized = comparable(rawID)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || `${dimension}-${stableHash(label).slice(0, 12)}`;
}

function normalizeConfidence(value, trustLevel) {
  const numeric = value === '' || value === undefined || value === null ? NaN : Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric >= 0.8) return 'high';
    if (numeric >= 0.5) return 'medium';
    return 'low';
  }
  const candidate = comparable(firstText(value, trustLevel));
  if (candidate === 'high' || candidate === 'verified') return 'high';
  if (candidate === 'medium' || candidate === 'moderate') return 'medium';
  return candidate ? 'low' : '';
}

function safePublicURL(value) {
  const raw = firstText(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        unsafePublicHostname(parsed.hostname)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function unsafePublicHostname(value) {
  const hostname = firstText(value)
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!hostname ||
      hostname.includes('%') ||
      hostname === 'localhost' ||
      hostname === 'local' ||
      hostname === 'internal' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')) {
    return true;
  }
  const version = isIP(hostname);
  if (version === 4) return unsafePublicIPv4(hostname);
  if (version === 6) return unsafePublicIPv6(hostname);
  return false;
}

function unsafePublicIPv4(value) {
  const octets = String(value).split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) =>
    !Number.isInteger(octet) || octet < 0 || octet > 255
  )) {
    return true;
  }
  const [first, second] = octets;
  return first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224;
}

function unsafePublicIPv6(value) {
  const hextets = expandedIPv6Hextets(value);
  if (!hextets) return true;
  if (hextets.every((part) => part === 0) ||
      (hextets.slice(0, 7).every((part) => part === 0) && hextets[7] === 1) ||
      (hextets[0] & 0xfe00) === 0xfc00 ||
      (hextets[0] & 0xffc0) === 0xfe80) {
    return true;
  }
  const mappedIPv4 = hextets.slice(0, 5).every((part) => part === 0) &&
    hextets[5] === 0xffff;
  if (!mappedIPv4) return false;
  const ipv4 = [
    hextets[6] >> 8,
    hextets[6] & 0xff,
    hextets[7] >> 8,
    hextets[7] & 0xff
  ].join('.');
  return unsafePublicIPv4(ipv4);
}

function expandedIPv6Hextets(value) {
  let normalized = String(value).toLowerCase();
  const dottedTail = normalized.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (dottedTail) {
    if (isIP(dottedTail) !== 4) return null;
    const octets = dottedTail.split('.').map(Number);
    normalized = normalized.slice(0, -dottedTail.length) +
      `${((octets[0] << 8) | octets[1]).toString(16)}:` +
      `${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) ||
      (halves.length === 2 && missing < 1)) {
    return null;
  }
  const parts = [
    ...left,
    ...Array(missing).fill('0'),
    ...right
  ];
  if (parts.length !== 8 ||
      parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }
  return parts.map((part) => Number.parseInt(part, 16));
}

function internalProfileURL(baseURL, slug) {
  slug = firstText(slug);
  if (!slug) return '';
  const base = normalizedPublicBaseURL(baseURL);
  return `${base}/u/${encodeURIComponent(slug)}`;
}

function normalizedPublicBaseURL(value) {
  const raw = firstText(value, 'https://profilescribe.com');
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'https://profilescribe.com';
    return parsed.origin.replace(/\/+$/, '');
  } catch {
    return 'https://profilescribe.com';
  }
}

function comparableURL(value) {
  const raw = safePublicURL(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hostname = canonicalPublicHostname(parsed.hostname);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/+$/, '').toLowerCase();
  } catch {
    return raw.replace(/\/+$/, '').toLowerCase();
  }
}

function validISOString(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function stableHash(value) {
  const serialized = typeof value === 'string' ? value : stableJSONStringify(value);
  return createHash('sha256').update(serialized).digest('hex');
}

function stableJSONStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSONStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJSONStringify(value[key])}`
    ).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashInteger(value) {
  return Number.parseInt(stableHash(value).slice(0, 12), 16);
}

function openRouterFailureCode(error) {
  const explicit = firstText(error?.openRouterFailureCode).toLowerCase();
  if (/^openrouter_[a-z0-9_]+$/.test(explicit)) return explicit;
  const message = String(error?.message || error || '').toLowerCase();
  const status = message.match(/\bhttp\s+([45]\d{2})\b/)?.[1];
  if (status) return `openrouter_http_${status}`;
  if (message.includes('abort') || message.includes('timeout')) return 'openrouter_transport_error';
  if (message.includes('truncated')) return 'openrouter_truncated_structured_output';
  if (message.includes('not valid json') || message.includes('json message')) return 'openrouter_invalid_response';
  if (message.includes('empty message')) return 'openrouter_empty_response';
  return 'openrouter_request_failed';
}

function compact(value) {
  const out = {};
  for (const [key, item] of Object.entries(asObject(value))) {
    if (item === undefined || item === null || item === '') continue;
    if (Array.isArray(item) && item.length === 0) continue;
    out[key] = item;
  }
  return out;
}

function compactStrings(value) {
  const out = [];
  const seen = new Set();
  for (const item of asArray(value)) {
    const text = firstText(item);
    if (!text) continue;
    const key = comparable(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function truncate(value, limit) {
  const raw = firstText(value).replace(/\s+/g, ' ');
  if (!raw) return '';
  return raw.length > limit ? `${raw.slice(0, Math.max(0, limit - 3))}...` : raw;
}

function comparable(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function clampInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

function tightenedPriceCap(value, ceiling) {
  const requested = Number(value);
  if (!Number.isFinite(requested) || requested <= 0) return ceiling;
  return roundMoney(Math.min(requested, ceiling));
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function providerCost(value) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0
    ? value
    : null;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : undefined;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function average(values) {
  return values.length > 0 ? sumFinite(values) / values.length : 0;
}

function sumFinite(values) {
  return values.reduce((sum, value) => {
    const number = finite(value);
    return sum + (number === null ? 0 : number);
  }, 0);
}

function round(value) {
  return Math.round(Number(value || 0) * 1_000) / 1_000;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
}
