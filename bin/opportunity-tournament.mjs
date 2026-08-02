import { createHash } from 'crypto';
import { isIP } from 'net';

export const OPPORTUNITY_TOURNAMENT_ALGORITHM_VERSION = 'cheap_tournament_v6';
const LEGACY_OPPORTUNITY_TOURNAMENT_ALGORITHM_VERSIONS = new Set([
  'cheap_tournament_v5'
]);
export const OPPORTUNITY_TOURNAMENT_GENERATOR_CONTRACT =
  'opportunity_tournament_commercial_v2';
const TOURNAMENT_GENERATOR_CONTRACT =
  OPPORTUNITY_TOURNAMENT_GENERATOR_CONTRACT;
export const OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT =
  'opportunity_tournament_critic_v1';
export const OPPORTUNITY_TOURNAMENT_RESULT_CONTRACT =
  'opportunity_tournament_result_v2';
export const ACTIVE_REVENUE_ACTION_CONTRACT =
  'active_revenue_action_v1';
export const COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT =
  'commercial_discovery_evidence_v1';
export const OPPORTUNITY_DISCOVERY_PLAN_CONTRACT =
  'opportunity_discovery_plan_v2';
const LEGACY_OPPORTUNITY_DISCOVERY_PLAN_CONTRACT =
  'opportunity_discovery_plan_v1';
export const PROPOSED_COMMERCIAL_MOTIONS_CONTRACT =
  'proposed_commercial_motions_v2';
const LEGACY_PROPOSED_COMMERCIAL_MOTIONS_CONTRACT =
  'proposed_commercial_motions_v1';
export const OPPORTUNITY_DISCOVERY_WEB_SEARCH_CONTRACT =
  'openrouter_exa_web_search_v1';
export const PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID =
  'profile:system_attribution_capability:v1';

const PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY = Object.freeze({
  id: PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID,
  type: 'profilescribe_system_attribution_capability',
  label: 'ProfileScribe attributable paid-outcome recorder',
  summary:
    'After a reviewed action, ProfileScribe can durably record a user-confirmed payment receipt or linked outcome evidence with a source field bound to the tournament, objective, hypothesis, candidate, and action identifiers. This verifies attribution-recording capability only; it does not verify any buyer, paid offer, acquisition path, channel fit, demand, payment, or conversion.',
  current: true,
  status: 'verified_current',
  confidence: 'high',
  verifiedSystemCapability: true,
  systemCapabilitySource: 'profilescribe_control_plane',
  systemCapabilityProvenance: 'verified_system_capability',
  systemCapabilityRoles: Object.freeze(['attribution'])
});

const CONTINGENT_TARGET_NAME_TOKEN = '{{TARGET_NAME}}';
const CONTINGENT_TARGET_URL_TOKEN = '{{TARGET_URL}}';
const CONTINGENT_TARGET_EVIDENCE_REF = 'target:evidence';
const CONTINGENT_CONVERSION_ACTION_PROJECTION =
  'project_first_viable_tactic_action';
const OPPORTUNITY_DISCOVERY_WEB_SEARCH_PROVIDER =
  'openrouter_exa_web_search';
const OPPORTUNITY_DISCOVERY_WEB_SEARCH_OPERATION =
  'forced_exa_web_search';
const OPPORTUNITY_DISCOVERY_WEB_SEARCH_ENGINE = 'exa';
const OPPORTUNITY_DISCOVERY_WEB_SEARCH_MAX_RESULTS = 5;
const OPPORTUNITY_DISCOVERY_WEB_SEARCH_FIXED_FEE_MICROS = 5_000;
const OPPORTUNITY_DISCOVERY_WEB_SEARCH_CONTEXT_TOKEN_RESERVE = 1_047_576;

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

// One canonical revenue path per family anchors a bounded local combination
// space. Two grounded variants across each strategy dimension preserve broad
// deterministic exploration (up to 256 coherent tuples across two families)
// without adding model calls or asking the provider for extra revenue paths.
const INITIAL_FAMILY_VARIANT_COUNT = 2;
const REPAIR_FAMILY_VARIANT_COUNT = 2;
const MAX_PROMPT_EVIDENCE_ITEMS = 16;
const MAX_PROMPT_PAID_ASSET_ITEMS = 4;
const MAX_PROMPT_OBJECTIVE_EVIDENCE_ITEMS = 4;
const MAX_PROMPT_CANDIDATE_EVIDENCE_ITEMS = 4;
// Match the normalized discovery envelope so adaptive compaction never drops
// a provider-attested discovery fact that entered the standard prompt view.
const MAX_PROMPT_COMMERCIAL_DISCOVERY_EVIDENCE_ITEMS = 10;
const MAX_PROMPT_REVENUE_EVIDENCE_ITEMS = 3;
const MAX_PROMPT_ATTRIBUTION_EVIDENCE_ITEMS = 2;
const MAX_PROMPT_RISK_EVIDENCE_ITEMS = 2;
const MAX_PROMPT_MOTION_EVIDENCE_ITEMS = 2;
const MAX_PROMPT_CONTEXT_EVIDENCE_ITEMS = 2;
const MAX_PROMPT_EVIDENCE_LABEL_CHARS = 160;
const MAX_PROMPT_EVIDENCE_SUMMARY_CHARS = 320;
const MAX_PROMPT_EVIDENCE_URL_CHARS = 240;
const MAX_PROVIDER_REQUEST_BODY_BYTES = 36 * 1_024;
const PROVIDER_PROMPT_ENVELOPE_PROFILES = [
  {
    name: 'standard',
    maxItems: MAX_PROMPT_EVIDENCE_ITEMS,
    labelChars: MAX_PROMPT_EVIDENCE_LABEL_CHARS,
    summaryChars: MAX_PROMPT_EVIDENCE_SUMMARY_CHARS,
    urlChars: MAX_PROMPT_EVIDENCE_URL_CHARS,
    coreMetadataOnly: false,
    compactGraph: false
  },
  {
    name: 'dense',
    maxItems: MAX_PROMPT_EVIDENCE_ITEMS,
    labelChars: 120,
    summaryChars: 192,
    urlChars: 160,
    coreMetadataOnly: true,
    compactGraph: true
  },
  {
    name: 'focused',
    maxItems: 12,
    labelChars: 104,
    summaryChars: 160,
    urlChars: 144,
    coreMetadataOnly: true,
    compactGraph: true
  },
  {
    name: 'essential',
    maxItems: 0,
    labelChars: 96,
    summaryChars: 128,
    urlChars: 128,
    coreMetadataOnly: true,
    compactGraph: true
  }
];
const MAX_REPAIR_OUTPUT_TOKENS = 4_000;
const MAX_CRITIC_OUTPUT_TOKENS = 1_200;
const MAX_DISCOVERY_PLANNER_OUTPUT_TOKENS = 9_000;
// Call 1 must retain two economically distinct outside-world motions until
// provider evidence can bind or reject them. Prematurely collapsing to one
// motion lets a plausible but wrong route (for example, peer supplier pages
// mislabeled as demand) strand a stronger referral, buyer, or paid-demand
// path before deterministic discovery gets a vote. Each compact motion still
// carries only one shared path plus two tactic deltas, keeping the response
// inside the fixed envelope without adding a model call.
const MAX_DISCOVERY_PLANNER_PLANS = 2;
// The planner sees at most fourteen approved, non-target evidence records.
// Its two family indexes can legitimately cite different subsets, so the
// outer containment index must span that whole projected trust boundary even
// though each individual family remains capped at twelve refs.
const MAX_DISCOVERY_PLAN_EVIDENCE_REFS = 14;
// Leave a small serialization margin above the model-facing compactness
// target while still rejecting unexpectedly verbose structured output.
const MAX_DISCOVERY_PLANNER_RESPONSE_BYTES = 28 * 1_024;
const DISCOVERY_PLAN_SEARCH_MODES = new Set([
  'active_job_posting',
  'professional_counterparty',
  'local_organization',
  'public_live_demand'
]);
const DISCOVERY_PLAN_COMMERCIAL_ROLES = new Set([
  'paid_demand',
  'referral_partner',
  'buyer'
]);
const DISCOVERY_PLAN_ACQUISITION_MODES_BY_ROLE = new Map([
  ['referral_partner', new Set(['partner_channel'])],
  ['buyer', new Set(['permissioned_outreach'])],
  [
    'paid_demand',
    new Set(['inbound', 'permissioned_outreach', 'partner_channel'])
  ]
]);

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
const PRIOR_REVENUE_PATH_CONTRACT_VERSION =
  'incremental_revenue_v2';
export const REVENUE_PATH_CONTRACT_VERSION =
  'incremental_revenue_v3';
const TYPED_REVENUE_PATH_CONTRACT_VERSIONS = new Set([
  PRIOR_REVENUE_PATH_CONTRACT_VERSION,
  REVENUE_PATH_CONTRACT_VERSION
]);
export const REVENUE_GATE_VERSION = 'incremental_revenue_causal_v3';
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
const REVENUE_CAUSAL_WITNESS_CONTRACT =
  'revenue_causal_witness_v2';
const LEGACY_REVENUE_CAUSAL_WITNESS_CONTRACT =
  'revenue_causal_witness_v1';
const REVENUE_CAUSAL_INCREMENTAL_KIND =
  'counterfactual_incremental_paid_income';
const REVENUE_CAUSAL_DESTINATION_KIND =
  'separate_conversion_destination';
const REVENUE_CAUSAL_STOP_RULE = 'stop_at_limit';
const REVENUE_CAUSAL_STOP_UNITS = new Set([
  'calendar_days',
  'review_first_actions',
  'referral_requests',
  'applications',
  'qualified_visits',
  'paid_outcomes',
  'bookings',
  'orders',
  'proposals',
  'buyers'
]);
const REVENUE_CAUSAL_TERMINAL_OUTCOMES = new Set(
  [...REVENUE_MECHANISMS].map((mechanism) => `${mechanism}_terminal`)
);
const OWNED_INBOUND_ASSET_KIND = 'owned_inbound_asset';
const SYNTHESIZED_OWNED_INBOUND_ASSETS = new WeakSet();
const COMMERCIAL_CRITIC_RECURRING_VALUE_PRIORITY = new Map([
  ['one_time', 1],
  ['repeatable', 2],
  ['recurring', 3]
]);
const COMMERCIAL_CRITIC_STRENGTH_PRIORITY = new Map([
  ['weak', 1],
  ['moderate', 2],
  ['strong', 3]
]);
const COMMERCIAL_CRITIC_BURDEN_PRIORITY = new Map([
  ['high', 1],
  ['moderate', 2],
  ['low', 3]
]);
const COMMERCIAL_DISCOVERY_PROVENANCE =
  'provider_attested_commercial_discovery';
const PDL_SCOPED_DECISION_MAKER_PROVENANCE =
  'people_data_labs_resume_record_scoped_to_validated_organization';
const PDL_DECISION_MAKER_SEARCH_OPERATION =
  'planned_decision_maker_search';
const COMMERCIAL_DISCOVERY_STATUSES = new Set([
  'found',
  'not_found',
  'failed',
  'provider_unavailable'
]);
const COMMERCIAL_DISCOVERY_FOUND_STATUS = 'found';
const COMMERCIAL_DISCOVERY_PROVIDERS = new Set([
  'google_places',
  'github_search',
  'brave_web_search',
  OPPORTUNITY_DISCOVERY_WEB_SEARCH_PROVIDER,
  'people_data_labs_person_search',
  'people_data_labs_job_posting_search'
]);
const COMMERCIAL_DISCOVERY_KINDS = new Set([
  'verified_external_professional_target',
  'verified_external_live_demand'
]);
const LIVE_PAID_DEMAND_CANDIDATE_KINDS = new Set([
  'contract_opportunity',
  'employer_job_posting',
  'job_posting',
  'live_demand',
  'marketplace_request',
  'paid_opportunity',
  'public_paid_demand_page',
  'public_rfp',
  'sponsorship_request'
]);
const PROVIDER_ATTESTED_REVIEW_CHANNELS = new Set([
  'application_page',
  'partner_channel',
  'public_professional_url',
  'public_paid_demand_response'
]);
const COMMERCIAL_DISCOVERY_PROVIDER_PROVENANCE = new Map([
  ['google_places', new Set(['read_only_professional_provider'])],
  ['github_search', new Set(['read_only_professional_provider'])],
  ['brave_web_search', new Set(['read_only_professional_provider'])],
  [
    OPPORTUNITY_DISCOVERY_WEB_SEARCH_PROVIDER,
    new Set(['openrouter_exa_url_citation'])
  ],
  [
    'people_data_labs_person_search',
    new Set([
      'people_data_labs_professional_record',
      PDL_SCOPED_DECISION_MAKER_PROVENANCE
    ])
  ],
  [
    'people_data_labs_job_posting_search',
    new Set(['people_data_labs_active_job_posting'])
  ]
]);
const COMMERCIAL_DISCOVERY_ATTEMPT_OPERATIONS = new Map([
  [
    OPPORTUNITY_DISCOVERY_WEB_SEARCH_PROVIDER,
    new Set([OPPORTUNITY_DISCOVERY_WEB_SEARCH_OPERATION])
  ],
  [
    'brave_web_search',
    new Set([
      'brave_web_search',
      'web_search',
      'planned_brave_web_search',
      'planned_web_search',
      'planned_public_live_demand_search',
      'planned_professional_search',
      'planned_local_organization_search'
    ])
  ],
  [
    'people_data_labs_person_search',
    new Set([
      'person_search',
      'planned_professional_search',
      PDL_DECISION_MAKER_SEARCH_OPERATION
    ])
  ],
  [
    'people_data_labs_job_posting_search',
    new Set(['job_posting_search', 'planned_job_posting_search'])
  ]
]);
const COMMERCIAL_DISCOVERY_ROLES = new Set([
  'acquisition',
  'channel_fit',
  'conversion_destination',
  'defined_buyer',
  'demand_signal',
  'paid_conversion',
  'paid_offer',
  'prospective_partner'
]);
const COMMERCIAL_DISCOVERY_LIVE_DEMAND_ROLES = new Set([
  'acquisition',
  'channel_fit',
  'conversion_destination',
  'defined_buyer',
  'demand_signal',
  'paid_conversion',
  'paid_offer'
]);
const COMMERCIAL_DISCOVERY_CANDIDATE_ROLES = new Set([
  'buyer',
  'referral_partner',
  'paid_demand',
  'hiring_manager'
]);
const MAX_COMMERCIAL_DISCOVERY_PROVIDER_CALLS = 4;
const MAX_COMMERCIAL_DISCOVERY_PAID_PROVIDER_CALLS = 2;
const MAX_COMMERCIAL_DISCOVERY_ATTEMPTS = 2;
const MAX_COMMERCIAL_DISCOVERY_EVIDENCE = 10;
const MAX_COMMERCIAL_DISCOVERY_CANDIDATES = 10;
const MAX_COMMERCIAL_DISCOVERY_FACT_AGE_MS =
  30 * DAY_MILLISECONDS;

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

/**
 * Plans profession-neutral commercial motions while performing the one
 * bounded, read-only search folded into call 1. The model may infer motions and
 * counterpart roles from verified supply evidence, but it cannot attest that
 * an outside target, demand signal, relationship, or permission exists. Only
 * separately normalized provider citations and records can establish those
 * facts before the control plane validates and binds the target slot.
 */
export async function runOpportunityDiscoveryPlanner({
  job,
  context = {},
  model,
  completeJSON,
  now = new Date()
}) {
  const payload = asObject(job?.payload);
  const objective = normalizeObjective(payload.objective, payload);
  const constraints = normalizeConstraints(objective, payload);
  const budget = normalizeBudget(payload.budget);
  const commercialContext = normalizeCommercialContext(
    payload,
    objective,
    constraints
  );
  const evidenceCatalog = buildEvidenceCatalog(payload, context, now, {
    commercialDiscovery: {},
    includeSystemAttributionCapability: true
  });
  const promptEvidenceCatalog = compactPromptEvidenceCatalog(
    evidenceCatalog,
    objective,
    now,
    {
      maxItems: MAX_DISCOVERY_PLAN_EVIDENCE_REFS,
      labelChars: 96,
      summaryChars: 160,
      urlChars: 136
    }
  );
  const commercialEvidenceGraph = buildCommercialEvidenceGraph(
    evidenceCatalog,
    {
      commercialContext,
      priorOutcomes: normalizePriorOutcomes([
        ...asArray(payload.priorOutcomes),
        ...asArray(asObject(payload.commercialContext)
          .priorAttributedOutcomes)
      ]),
      objective,
      constraints
    }
  );
  const promptCommercialEvidenceGraph =
    projectCommercialEvidenceGraphForPrompt(
      commercialEvidenceGraph,
      promptEvidenceCatalog
    );
  const evidenceHash = stableHash(evidenceCatalog);
  const base = {
    contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
    status: 'blocked',
    reason: '',
    evidenceHash,
    plans: [],
    webSearchReceipt: null,
    preflight: {},
    usage: emptyUsage(model, budget),
    llm: {},
    sideEffectsPerformed: 0
  };

  const objectiveIssue = objectiveValidationIssue(objective);
  if (objectiveIssue) {
    return {
      ...base,
      reason: objectiveIssue.summary
    };
  }
  if (!constraints.researchOnly) {
    return {
      ...base,
      reason: 'Opportunity discovery planning requires research-only authority.'
    };
  }
  if (evidenceCatalog.length === 0 || promptEvidenceCatalog.length === 0) {
    return {
      ...base,
      reason: 'No approved professional evidence can ground an outside-world search plan.'
    };
  }
  if (budget.maxLLMCalls < 1 || budget.maxLLMSpendMicros < 1) {
    return {
      ...base,
      reason: 'The tournament budget does not authorize discovery planning.'
    };
  }

  const system = `You are ProfileScribe's research-only commercial-motion generator. Find one professional's two strongest distinct outside-world payment paths within 30 days; no side effects.
Use commercialEvidenceGraph.verifiedFacts and forced read-only search only; inferences/gaps stay unverified. roles=["attribution"] proves only a future attribution record, never a commercial fact.
Choose the outside actor or buyer-authored artifact that can cause the next payment, never a peer supplier. paid_demand requires a current purchaser/employer-authored compensated job, RFP, solicitation, or explicit buying request; supplier/competitor offers, directories, category availability, "accepts insurance," and the seller's own offer/booking page are not demand. If a protected or sensitive end buyer cannot be researched directly, choose a complementary professional referral authority. For skills/labor prefer live compensated demand; for consulting/products prefer a real buyer or buyer-authored demand. Separate payer/counterparty. Website/booking=destination, not demand. Any inbound preference is conditional on real outside demand and never overrides this route test.
Plans are contingent, not proof of target, interest, referral, budget, or permission. Model prose proves no web target. Leave {{TARGET_NAME}}/{{TARGET_URL}}/target:evidence for provider binding; use target:evidence only for its typed dimensions.
Return exactly two distinct plans; each plan has one shared pathBase plus two tactic deltas. Modes: active_job_posting=paid role; professional_counterparty=person; local_organization=organization seed then person; public_live_demand=live paid demand.
Routes: referral_partner=partner_channel; buyer=permissioned_outreach; paid_demand=inbound|permissioned_outreach|partner_channel. No warm_referral/existing_customer for unresolved targets; buyer identity!=inbound demand. professional_counterparty terminates in one person; local_organization uses the organization only as a seed and terminates in its named decision-maker person.
pathBase={e,r,o,b,t,p}: one v3 path+k and 2 o/b/t/p variants. tacticA/B={l,m,tacticKey,e,s,c,a,f}: 2 c/a/f variants; tactics differ causally over one buyer-to-payment base. Require current paid offer, separate acquisition/destination, paid conversion, attribution, numeric stop, positive value/spend, evidence, active actions.
Every a: {{TARGET_NAME}} once; active cash ask. referral_partner=partner referral/introduction of defined buyer to current paid offer+paid booking/payment; buyer=ask target to book/buy/sign current paid offer; paid_demand=typed paid application/proposal response. Bare introduce/share/connect/message/conversation and marketplace/directory placement are invalid. No setup/support/follow-up. buyer/referral a: {{TARGET_URL}} once, only review-first public professional profile; omit private/alternate routes from JSON/query. Review!=mode; code projects r.c per tactic; operations never outcomes.
Keep the complete JSON at or below 20 KiB. Return one minified object, concise strings, no formatting whitespace, and no repeated rationale/evidence prose.
target:evidence proves only typed target dimensions: never seller capability, relationship, private contacts, or paid demand unless live-paid-demand. Bind current offer/destination/attribution to exact approved IDs. Professional identity proves identity+prospective channel fit only; live-paid-demand alone grounds outside paid offer/application/compensated conversion.
Never target patients, health/family-status consumers, sensitive traits, or private contacts. Only a referral-partner query may describe the population its professional counterparty serves (e.g. "pediatric practice serving newborn patients"). Field use: professional/local uses targetRoleTerms+organizationTerms and leaves jobTitle/skills empty; active job does the reverse; public demand leaves all four empty. The typed target stays professional. Copy IDs/tokens exactly. Return strict JSON only.`;
  const user = JSON.stringify({
    objective,
    commercialContext,
    evidenceCatalog: promptEvidenceCatalog,
    commercialEvidenceGraph: promptCommercialEvidenceGraph,
    task:
      'Plan the two strongest economically distinct outside-world searches most likely to reveal one exact, review-first path to payment within 30 days; rank by attributable payment probability, then time-to-cash and one-to-many or recurring leverage.',
    outputContract: compactOpportunityDiscoveryOutputContract(),
    hardRules: compactOpportunityDiscoveryHardRules(),
    constraints: [
      RESEARCH_ONLY_CONSTRAINT,
      'Forced Exa returns <=5 sanitized URL citations; app adapters may make only separately budgeted bounded provider reads.'
    ]
  });
  const request = {
    model,
    system,
    user,
    maxTokens: Math.min(
      MAX_DISCOVERY_PLANNER_OUTPUT_TOKENS,
      Math.max(600, budget.maxOutputTokens)
    ),
    provider: {
      ...TOURNAMENT_PROVIDER_ROUTING,
      max_price: { ...budget.providerMaxPrice }
    },
    responseFormat: opportunityDiscoveryPlannerResponseFormat(
      promptEvidenceCatalog
    ),
    plugins: [{
      id: 'web',
      engine: OPPORTUNITY_DISCOVERY_WEB_SEARCH_ENGINE,
      max_results: OPPORTUNITY_DISCOVERY_WEB_SEARCH_MAX_RESULTS
    }],
    additionalPromptTokenReserve:
      OPPORTUNITY_DISCOVERY_WEB_SEARCH_CONTEXT_TOKEN_RESERVE,
    fixedToolFeeMicros:
      OPPORTUNITY_DISCOVERY_WEB_SEARCH_FIXED_FEE_MICROS,
    temperature: 0.15
  };
  const preflight = providerCallSpendPreflight(request, budget);
  const promptEnvelopeIssue = providerPromptEnvelopeIssue(preflight);
  if (promptEnvelopeIssue ||
      preflight.callSpendCeilingMicros > budget.maxLLMSpendMicros) {
    return {
      ...base,
      reason: promptEnvelopeIssue
        ? `Discovery planner request failed ${promptEnvelopeIssue}.`
        : 'Discovery planner request does not fit the bounded LLM budget.',
      preflight: {
        ...preflight,
        authorized: false,
        cause: promptEnvelopeIssue || 'planner_budget_ceiling'
      }
    };
  }

  const promptHash = stableHash({ system, user });
  let completion;
  try {
    completion = await completeJSON(request);
  } catch (error) {
    const providerMetadata = openRouterMetadata({
      model,
      purpose: 'opportunity_tournament_discovery_planning',
      structuredOutputContract: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
      status: 'failed',
      usage: error?.openRouterUsage,
      generationId: error?.openRouterGenerationId,
      diagnostics: error?.openRouterDiagnostics,
      promptHash,
      error: openRouterFailureCode(error)
    });
    return {
      ...base,
      reason: 'The bounded discovery planner did not return a usable plan.',
      preflight: { ...preflight, authorized: true },
      usage: aggregateUsage([providerMetadata], budget),
      llm: { discoveryPlanner: providerMetadata }
    };
  }

  const providerMetadata = openRouterMetadata({
    model,
    purpose: 'opportunity_tournament_discovery_planning',
    structuredOutputContract: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
    status: 'completed',
    usage: completion?.usage,
    generationId: completion?.generationId,
    diagnostics: completion?.diagnostics,
    promptHash
  });
  const usage = aggregateUsage([providerMetadata], budget);
  let responseBodyByteCount = 0;
  try {
    responseBodyByteCount = Buffer.byteLength(
      JSON.stringify(completion?.data),
      'utf8'
    );
  } catch {
    responseBodyByteCount = MAX_DISCOVERY_PLANNER_RESPONSE_BYTES + 1;
  }
  const promptTokenCanary = providerPromptTokenCanary(
    preflight,
    providerMetadata.openRouterUsage
  );
  const rawCardinalityIssue = opportunityDiscoveryRawPlanCardinalityIssue(
    completion?.data
  );
  const rawCausalWitnessIssue =
    opportunityDiscoveryRawCausalWitnessIssue(completion?.data);
  const normalized = normalizeOpportunityDiscoveryPlan(
    completion?.data,
    // The strict response enum is built from this exact projected catalog.
    // Revalidate against the same trust boundary locally instead of allowing
    // a ref that existed only in the larger, model-hidden catalog.
    promptEvidenceCatalog,
    now,
    { allowPlannerProjection: true }
  );
  const webSearchReceipt = normalizeOpportunityDiscoveryWebSearchReceipt({
    annotations: completion?.annotations,
    requestHash: preflight.requestBodySha256,
    attempted: true,
    observedAt: validDate(now).toISOString()
  });
  normalized.webSearchReceipt = webSearchReceipt;
  const issue = rawCardinalityIssue || rawCausalWitnessIssue ||
    opportunityDiscoveryPlanIssue(normalized);
  const webSearchIssue = opportunityDiscoveryWebSearchReceiptIssue(
    webSearchReceipt
  );
  if (promptTokenCanary.withinCeiling === false ||
      responseBodyByteCount > MAX_DISCOVERY_PLANNER_RESPONSE_BYTES ||
      usage.reportedCostMicros > budget.maxLLMSpendMicros || issue ||
      webSearchIssue) {
    return {
      ...base,
      reason: promptTokenCanary.withinCeiling === false
        ? 'Discovery planner prompt-token usage exceeded its serialized-request ceiling.'
        : responseBodyByteCount > MAX_DISCOVERY_PLANNER_RESPONSE_BYTES
          ? 'Discovery planner response exceeded its bounded structured-output envelope.'
        : usage.reportedCostMicros > budget.maxLLMSpendMicros
          ? 'Discovery planner exceeded its bounded LLM budget.'
          : issue || webSearchIssue,
      preflight: {
        ...preflight,
        authorized: true,
        responseBodyByteCount,
        maxResponseBodyByteCount:
          MAX_DISCOVERY_PLANNER_RESPONSE_BYTES,
        promptTokenCanary
      },
      usage,
      llm: { discoveryPlanner: providerMetadata },
      webSearchReceipt
    };
  }
  return {
    ...base,
    ...normalized,
    evidenceHash,
    webSearchReceipt,
    preflight: {
      ...preflight,
      authorized: true,
      responseBodyByteCount,
      maxResponseBodyByteCount: MAX_DISCOVERY_PLANNER_RESPONSE_BYTES,
      promptTokenCanary
    },
    usage,
    llm: { discoveryPlanner: providerMetadata }
  };
}

function opportunityDiscoveryPlannerResponseFormat(evidenceCatalog) {
  const boundedText = (maxLength, allowEmpty = false) => ({
    type: 'string',
    pattern: `^[^\\r\\n]{${allowEmpty ? '0' : '1'},${maxLength}}$`
  });
  const stringArray = (maxItems) => ({
    type: 'array',
    items: { type: 'string' },
    maxItems
  });
  const boundedStringArray = (maxItems, maxLength = 80) => ({
    type: 'array',
    items: boundedText(maxLength),
    maxItems
  });
  const contingentSchema = tournamentStructuredResponseFormat(
    [
      ...asArray(evidenceCatalog),
      { id: CONTINGENT_TARGET_EVIDENCE_REF }
    ],
    INITIAL_FAMILY_VARIANT_COUNT
  ).json_schema.schema;
  const contingentFamily = asObject(contingentSchema.$defs.family);
  const contingentDimensions = asObject(
    asObject(contingentFamily.properties).d
  );
  const contingentDimensionProperties = asObject(
    contingentDimensions.properties
  );
  const contingentActionItem = asObject(
    contingentSchema.$defs.actionItem
  );
  const boundedItemDefinition = (key, labelMaxLength = 140) => {
    const definition = asObject(contingentSchema.$defs[key]);
    const properties = asObject(definition.properties);
    return {
      ...definition,
      properties: {
        ...properties,
        l: boundedText(labelMaxLength),
        ...(Object.prototype.hasOwnProperty.call(properties, 'q')
          ? { q: boundedText(140) }
          : {})
      }
    };
  };
  const contingentFollowUpItem = boundedItemDefinition('followUpItem');
  const revenuePath = asObject(contingentSchema.$defs.revenuePath);
  const revenuePathProperties = asObject(revenuePath.properties);
  const revenueGrounding = asObject(revenuePathProperties.g);
  const revenueGroundingProperties = asObject(revenueGrounding.properties);
  const destinationGrounding = asObject(revenueGroundingProperties.d);
  const revenueMechanism = asObject(revenuePathProperties.rm);
  const attributionMethod = asObject(revenuePathProperties.atm);
  const causalWitness = {
    type: 'object',
    properties: {
      v: {
        type: 'string',
        enum: [REVENUE_CAUSAL_WITNESS_CONTRACT]
      },
      i: {
        type: 'string',
        enum: [REVENUE_CAUSAL_INCREMENTAL_KIND]
      },
      c: {
        $ref: '#/$defs/revenueMechanism'
      },
      o: {
        $ref: '#/$defs/revenueMechanism'
      },
      p: {
        type: 'string',
        enum: [...REVENUE_CAUSAL_TERMINAL_OUTCOMES]
      },
      t: {
        $ref: '#/$defs/attributionMethod'
      },
      d: {
        type: 'string',
        enum: [REVENUE_CAUSAL_DESTINATION_KIND]
      },
      s: {
        type: 'string',
        enum: [REVENUE_CAUSAL_STOP_RULE]
      },
      n: { type: 'integer', minimum: 1, maximum: 100 },
      u: {
        type: 'string',
        enum: [...REVENUE_CAUSAL_STOP_UNITS]
      }
    },
    required: ['v', 'i', 'c', 'o', 'p', 't', 'd', 's', 'n', 'u'],
    additionalProperties: false
  };
  const contingentDefs = {
    evidenceRef: contingentSchema.$defs.evidenceRef,
    evidenceRefs: contingentSchema.$defs.evidenceRefs,
    compactEvidenceRefs: contingentSchema.$defs.compactEvidenceRefs,
    revenueMechanism,
    attributionMethod,
    scores: contingentSchema.$defs.scores,
    offerItem: boundedItemDefinition('offerItem'),
    buyerItem: boundedItemDefinition('buyerItem'),
    channelItem: boundedItemDefinition('channelItem'),
    actionItem: {
      ...contingentActionItem,
      properties: {
        ...asObject(contingentActionItem.properties),
        l: {
          type: 'string',
          pattern:
            '^[^\\r\\n]{0,72}\\{\\{TARGET_NAME\\}\\}[^\\r\\n]{0,72}$',
          description:
            'Active cash ask: paid partner referral, target purchase/booking, or paid-demand response; no setup/support/follow-up.'
        }
      }
    },
    timingItem: boundedItemDefinition('timingItem'),
    proofItem: boundedItemDefinition('proofItem'),
    followUpItem: {
      ...contingentFollowUpItem,
      properties: {
        ...asObject(contingentFollowUpItem.properties),
        l: {
          type: 'string',
          pattern:
            '^[Ii]f no reply after [1-9][0-9]? days?, one review-first follow-up[.]?$'
        },
        e: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '^observation:.+$'
          },
          minItems: 1,
          maxItems: 2
        }
      }
    },
    revenuePath: {
      ...revenuePath,
      properties: {
        ...revenuePathProperties,
        rm: { $ref: '#/$defs/revenueMechanism' },
        l: boundedText(140),
        io: boundedText(180),
        c: {
          type: 'string',
          enum: [CONTINGENT_CONVERSION_ACTION_PROJECTION]
        },
        o: boundedText(180),
        atm: { $ref: '#/$defs/attributionMethod' },
        ats: boundedText(220),
        cd: boundedText(180),
        st: boundedText(180),
        k: { $ref: '#/$defs/causalWitness' },
        sb: boundedText(180, true),
        g: {
          ...revenueGrounding,
          properties: {
            ...revenueGroundingProperties,
            d: {
              ...destinationGrounding,
              properties: {
                ...asObject(destinationGrounding.properties),
                l: boundedText(180)
              }
            }
          }
        }
      },
      required: [...asArray(revenuePath.required), 'k']
    },
    causalWitness,
    pathBase: {
      type: 'object',
      properties: {
        e: asObject(contingentFamily.properties).e,
        r: contingentDimensionProperties.r,
        o: contingentDimensionProperties.o,
        b: contingentDimensionProperties.b,
        t: contingentDimensionProperties.t,
        p: contingentDimensionProperties.p
      },
      required: ['e', 'r', 'o', 'b', 't', 'p'],
      additionalProperties: false
    },
    tactic: {
      type: 'object',
      properties: {
        l: boundedText(140),
        m: asObject(contingentFamily.properties).m,
        tacticKey: {
          type: 'string',
          pattern: '^[a-z][a-z0-9_]{2,63}$'
        },
        e: contingentSchema.$defs.compactEvidenceRefs,
        s: asObject(contingentFamily.properties).s,
        c: contingentDimensionProperties.c,
        a: contingentDimensionProperties.a,
        f: contingentDimensionProperties.f
      },
      required: [
        'l',
        'm',
        'tacticKey',
        'e',
        's',
        'c',
        'a',
        'f'
      ],
      additionalProperties: false
    }
  };
  return {
    type: 'json_schema',
    json_schema: {
      name: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
      strict: true,
      schema: {
        type: 'object',
        properties: {
          contractVersion: {
            type: 'string',
            enum: [OPPORTUNITY_DISCOVERY_PLAN_CONTRACT]
          },
          status: {
            type: 'string',
            enum: ['planned', 'insufficient_verified_supply']
          },
          reason: boundedText(320, true),
          plans: {
            type: 'array',
            minItems: 0,
            maxItems: MAX_DISCOVERY_PLANNER_PLANS,
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  pattern: '^[a-z][a-z0-9_-]{2,63}$'
                },
                priority: { type: 'integer', minimum: 1, maximum: 3 },
                searchMode: {
                  type: 'string',
                  enum: [...DISCOVERY_PLAN_SEARCH_MODES]
                },
                commercialRole: {
                  type: 'string',
                  enum: [...DISCOVERY_PLAN_COMMERCIAL_ROLES]
                },
                acquisitionMode: {
                  type: 'string',
                  enum: [...ACQUISITION_MODES]
                },
                buyer: boundedText(140),
                counterparty: boundedText(140),
                paidOffer: boundedText(140),
                evidenceRefs: stringArray(
                  MAX_DISCOVERY_PLAN_EVIDENCE_REFS
                ),
                query: boundedText(180),
                market: boundedText(120, true),
                targetRoleTerms: boundedStringArray(6),
                organizationTerms: boundedStringArray(6),
                jobTitle: boundedText(100, true),
                skills: boundedStringArray(6),
                acquisitionMechanism: boundedText(180),
                conversionDestination: boundedText(180),
                paidConversion: boundedText(140),
                attributionSignal: boundedText(180),
                rationale: boundedText(180),
                targetSlot: {
                  type: 'object',
                  properties: {
                    targetNameToken: {
                      type: 'string',
                      enum: [CONTINGENT_TARGET_NAME_TOKEN]
                    },
                    targetUrlToken: {
                      type: 'string',
                      enum: [CONTINGENT_TARGET_URL_TOKEN]
                    },
                    evidenceRefToken: {
                      type: 'string',
                      enum: [CONTINGENT_TARGET_EVIDENCE_REF]
                    },
                    finalTargetKind: {
                      type: 'string',
                      enum: ['person', 'organization', 'live_paid_demand']
                    },
                    commercialRole: {
                      type: 'string',
                      enum: [...DISCOVERY_PLAN_COMMERCIAL_ROLES]
                    },
                    resolutionStrategy: {
                      type: 'string',
                      enum: [
                        'single_exact_target',
                        'organization_then_decision_maker'
                      ]
                    },
                    requiredEvidenceRoles: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: [...COMMERCIAL_DISCOVERY_ROLES]
                      },
                      minItems: 1,
                      maxItems: 7
                    }
                  },
                  required: [
                    'targetNameToken',
                    'targetUrlToken',
                    'evidenceRefToken',
                    'finalTargetKind',
                    'commercialRole',
                    'resolutionStrategy',
                    'requiredEvidenceRoles'
                  ],
                  additionalProperties: false
                },
                contingentFinalists: {
                  type: 'object',
                  properties: {
                    seedContract: {
                      type: 'string',
                      enum: [SEED_CONTRACT_VERSION]
                    },
                    pathBase: { $ref: '#/$defs/pathBase' },
                    tacticA: { $ref: '#/$defs/tactic' },
                    tacticB: { $ref: '#/$defs/tactic' },
                    w: contingentSchema.properties.w
                  },
                  required: [
                    'seedContract',
                    'pathBase',
                    'tacticA',
                    'tacticB',
                    'w'
                  ],
                  additionalProperties: false
                }
              },
              required: [
                'id',
                'priority',
                'searchMode',
                'commercialRole',
                'acquisitionMode',
                'buyer',
                'counterparty',
                'paidOffer',
                'evidenceRefs',
                'query',
                'market',
                'targetRoleTerms',
                'organizationTerms',
                'jobTitle',
                'skills',
                'acquisitionMechanism',
                'conversionDestination',
                'paidConversion',
                'attributionSignal',
                'rationale',
                'targetSlot',
                'contingentFinalists'
              ],
              additionalProperties: false
            }
          }
        },
        required: ['contractVersion', 'status', 'reason', 'plans'],
        additionalProperties: false,
        $defs: contingentDefs
      }
    }
  };
}

function compactOpportunityDiscoveryOutputContract() {
  return {
    plan:
      'Return exactly 2 ranked, economically distinct plans; fill every required field.',
    targetSlot:
      `${CONTINGENT_TARGET_NAME_TOKEN}/${CONTINGENT_TARGET_URL_TOKEN}/${CONTINGENT_TARGET_EVIDENCE_REF}; commercialRole=plan.commercialRole; live demand=live_paid_demand/single_exact_target`,
    targetRoleMap: {
      referral_partner: [
        'acquisition',
        'channel_fit',
        'prospective_partner'
      ],
      buyer: ['acquisition', 'channel_fit', 'defined_buyer'],
      paid_demand: [
        'acquisition',
        'channel_fit',
        'conversion_destination',
        'defined_buyer',
        'demand_signal',
        'paid_conversion',
        'paid_offer'
      ]
    },
    finalists:
      `{seedContract:${SEED_CONTRACT_VERSION},pathBase,tacticA,tacticB,w}; pathBase={e,r,o,b,t,p}; tactic={l,m,tacticKey,e,s,c,a,f}; m=plan.acquisitionMode; tacticKey unique`,
    dimensions:
      `pathBase r=1,o/b/t/p=${INITIAL_FAMILY_VARIANT_COUNT}; each tactic c/a/f=${INITIAL_FAMILY_VARIANT_COUNT}`,
    item: '{l,e}; t={l,e,q}; exact evidence IDs',
    revenuePath:
      `{l,e,v,rm,io,a,c,o,atm,ats,cd,st,k,g:{b,o,a,d:{l,e},c,t},sb,vm}; v=${REVENUE_PATH_CONTRACT_VERSION}; k={v,i,c,o,p,t,d,s,n,u}; p=rm+"_terminal"; g binds evidence`,
    evidence:
      `base+tactic e has ${CONTINGENT_TARGET_EVIDENCE_REF}, observation:*, all child refs; child refs⊆plan refs+target`
  };
}

function compactOpportunityDiscoveryHardRules() {
  return [
    '2 distinct motions: each pathBase+2 causal tactics; insufficient_verified_supply=0 plans+reason.',
    'Base/tactic e has observation:*; attribution ref is attribution-only; obey targetRoleMap. f="If no reply after N days, one review-first follow-up"; N=1..30; f.e=observation:*.',
    'a:2/tactic. referral=partner referral/introduction -> current paid offer -> paid booking/payment; buyer=ask target to book/buy/sign current paid offer; paid_demand=paid application/proposal response. Bare introduction/message/conversation, marketplace/directory placement, and setup/support are invalid.',
    `r.a=plan.acquisitionMode; r.c=${CONTINGENT_CONVERSION_ACTION_PROJECTION}; project valid tactic a; k.c=k.o=rm; k.p=rm+"_terminal"; k.t=atm.`,
    'r.o describes that one terminal rm event, not objective alternatives. Reject or/either/attempt/pending/declined/failed/not received.',
    'k.d=separate destination; k.s/n/u=bounded stop; calendar_days<=30; author io/o/ats/cd/st; vm>0.',
    'r.g binds exact role evidence; prospective partner proves no buyer/offer/warmness/permission/demand.',
    'Tactics and motions differ. Pick actors/artifacts causing payment, never peer suppliers. paid_demand=current buyer/employer-authored compensated job/RFP/solicitation/explicit buying request only; a bare request term is insufficient; seller/competitor offers, marketplaces, directories, category availability, and accepts-insurance pages are not demand. Sensitive end buyer=>complementary professional referral_partner. Routes: referral_partner=partner_channel; buyer=permissioned_outreach; paid_demand=inbound|permissioned_outreach|partner_channel; buyer identity!=inbound.',
    'Adapters: professional_counterparty=person/single_exact_target; local_organization=person/organization_then_decision_maker(1-6); organization is never terminal.',
    `buyer/referral a: 1 ${CONTINGENT_TARGET_URL_TOKEN}; HTTPS LinkedIn /in verified public profile only; review-first; omit private-contact/form/submission/alternate routes.`,
    'No sensitive/private targets; population only in referral query. No external writes.'
  ];
}

function normalizeOpportunityDiscoveryPlan(
  value,
  evidenceCatalog,
  referenceTime = new Date(),
  optionsValue = {}
) {
  const raw = asObject(value);
  const options = asObject(optionsValue);
  const knownEvidence = new Set(
    asArray(evidenceCatalog).map((item) => firstText(asObject(item).id))
  );
  knownEvidence.add(CONTINGENT_TARGET_EVIDENCE_REF);
  const plans = asArray(raw.plans).slice(
    0,
    firstText(raw.contractVersion) ===
      LEGACY_OPPORTUNITY_DISCOVERY_PLAN_CONTRACT
      ? 3
      : 2
  ).map((planValue) => {
    const plan = asObject(planValue);
    const evidenceRefs = normalizedDiscoveryPlanEvidenceRefs(
      plan,
      knownEvidence
    );
    const searchFields = normalizeOpportunityDiscoverySearchFields(plan);
    const planWithCanonicalEvidence = {
      ...plan,
      ...searchFields,
      evidenceRefs
    };
    return {
      id: truncate(firstText(plan.id), 64),
      priority: clampInteger(plan.priority, 1, 3, 3),
      searchMode: firstText(plan.searchMode),
      commercialRole: firstText(plan.commercialRole),
      acquisitionMode: firstText(plan.acquisitionMode),
      buyer: truncate(firstText(plan.buyer), 180),
      counterparty: truncate(firstText(plan.counterparty), 180),
      paidOffer: truncate(firstText(plan.paidOffer), 180),
      evidenceRefs,
      query: truncate(firstText(plan.query), 240),
      market: truncate(firstText(plan.market), 120),
      ...searchFields,
      acquisitionMechanism: truncate(
        firstText(plan.acquisitionMechanism),
        220
      ),
      conversionDestination: truncate(
        firstText(plan.conversionDestination),
        220
      ),
      paidConversion: truncate(firstText(plan.paidConversion), 180),
      attributionSignal: truncate(firstText(plan.attributionSignal), 220),
      rationale: truncate(firstText(plan.rationale), 260)
      ,
      targetSlot: normalizeContingentTargetSlot(
        plan.targetSlot,
        planWithCanonicalEvidence
      ),
      contingentFinalists: normalizeContingentFinalistBundle(
        plan.contingentFinalists,
        knownEvidence,
        referenceTime,
        planWithCanonicalEvidence,
        options.allowPlannerProjection === true
      )
    };
  }).sort((left, right) =>
    left.priority - right.priority || compareStableText(left.id, right.id)
  );
  return {
    contractVersion: firstText(raw.contractVersion),
    status: firstText(raw.status),
    reason: truncate(firstText(raw.reason), 320),
    plans,
    webSearchReceipt: Object.keys(asObject(raw.webSearchReceipt)).length > 0
      ? normalizeOpportunityDiscoveryWebSearchReceipt(
          raw.webSearchReceipt
        )
      : undefined
  };
}

function normalizeOpportunityDiscoverySearchFields(planValue) {
  const plan = asObject(planValue);
  const allFields = {
    targetRoleTerms: compactStrings(plan.targetRoleTerms)
      .map((item) => truncate(item, 80))
      .slice(0, 6),
    organizationTerms: compactStrings(plan.organizationTerms)
      .map((item) => truncate(item, 80))
      .slice(0, 6),
    jobTitle: truncate(firstText(plan.jobTitle), 100),
    skills: compactStrings(plan.skills)
      .map((item) => truncate(item, 80))
      .slice(0, 6)
  };
  switch (firstText(plan.searchMode)) {
  case 'professional_counterparty':
  case 'local_organization':
    // These adapters resolve a professional role, optionally through an
    // organization seed. Job-title and skill fields are not sent to either
    // adapter, so model spillover there cannot redefine the target.
    return {...allFields, jobTitle: '', skills: []};
  case 'active_job_posting':
    // A live-role search consumes only the compensated title/skill query.
    return {
      ...allFields,
      targetRoleTerms: [],
      organizationTerms: []
    };
  case 'public_live_demand':
    // Public demand is bound from the buyer-authored query and cited demand
    // artifact, not from person, organization, title, or skill filters.
    return {
      targetRoleTerms: [],
      organizationTerms: [],
      jobTitle: '',
      skills: []
    };
  default:
    // Preserve unsupported-route input so the typed route validator below
    // can reject it without normalization masking any supplied field.
    return allFields;
  }
}

function normalizedDiscoveryPlanEvidenceRefs(planValue, knownEvidence) {
  const plan = asObject(planValue);
  return compactStrings([
    ...asArray(plan.evidenceRefs),
    ...declaredContingentFinalistEvidenceRefs(plan.contingentFinalists)
  ])
    .filter((ref) =>
      ref !== CONTINGENT_TARGET_EVIDENCE_REF && knownEvidence.has(ref)
    );
}

function declaredContingentFinalistEvidenceRefs(value) {
  const refs = [];
  const evidenceArrayKeys = new Set(['e', 'b', 'o', 'a', 'c', 't']);
  const visit = (item, key = '') => {
    if (Array.isArray(item)) {
      // The compact and materialized contracts both use `e` for child
      // provenance. Revenue-path graph roles use string arrays under the
      // other listed keys. Read only those typed locations, never labels or
      // prose, and leave unknown-reference rejection to the existing shape
      // guard below.
      if (evidenceArrayKeys.has(key) &&
          item.every((entry) => typeof entry === 'string')) {
        refs.push(...item);
      }
      item.forEach((entry) => visit(entry));
      return;
    }
    if (item && typeof item === 'object') {
      for (const [childKey, child] of Object.entries(item)) {
        visit(child, childKey);
      }
    }
  };
  visit(value);
  return compactStrings(refs);
}

function normalizeContingentTargetSlot(value, planValue) {
  const raw = asObject(value);
  const plan = asObject(planValue);
  const commercialRole = contractEnum(firstText(plan.commercialRole));
  const searchMode = contractEnum(firstText(plan.searchMode));
  const livePaidDemandRoute = commercialRole === 'paid_demand' && (
    searchMode === 'active_job_posting' ||
    searchMode === 'public_live_demand'
  );
  return {
    // These are protocol structure, not model-authored commercial facts.
    // Canonicalize them locally so a harmless ordering or role-list drift
    // cannot consume the user's sole bounded recovery run.
    targetNameToken: CONTINGENT_TARGET_NAME_TOKEN,
    targetUrlToken: CONTINGENT_TARGET_URL_TOKEN,
    evidenceRefToken: CONTINGENT_TARGET_EVIDENCE_REF,
    // A typed paid-demand search can resolve only one exact public demand
    // record. The model still chooses that economic route, while provider
    // evidence must later prove and bind the actual target. Canonicalizing
    // this uniquely implied slot shape neither invents nor broadens demand.
    finalTargetKind: livePaidDemandRoute
      ? 'live_paid_demand'
      : contractEnum(firstText(raw.finalTargetKind)),
    commercialRole,
    resolutionStrategy: livePaidDemandRoute
      ? 'single_exact_target'
      : contractEnum(firstText(raw.resolutionStrategy)),
    requiredEvidenceRoles: [
      ...requiredCommercialDiscoveryRolesForSlot({ commercialRole })
    ]
  };
}

function normalizeContingentFinalistBundle(
  value,
  knownEvidence,
  _referenceTime,
  planValue,
  allowPlannerProjection = false
) {
  const raw = asObject(value);
  const compactPlannerBundle =
    Object.keys(asObject(raw.pathBase)).length > 0 &&
    Object.keys(asObject(raw.tacticA)).length > 0 &&
    Object.keys(asObject(raw.tacticB)).length > 0 &&
    Object.keys(asObject(raw.familyA)).length === 0 &&
    Object.keys(asObject(raw.familyB)).length === 0;
  let serialized = '';
  try {
    serialized = JSON.stringify(raw);
  } catch {
    return {};
  }
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > 32 * 1_024) {
    return {};
  }
  let clone;
  try {
    clone = JSON.parse(serialized);
  } catch {
    return {};
  }
  if (contingentJSONShapeUnsafe(clone, knownEvidence)) return {};
  clone = materializePlannerContingentFinalistBundle(clone);
  if (Object.keys(asObject(clone)).length === 0) return {};
  clone = canonicalizeContingentTargetEvidence(clone, planValue);
  const plan = asObject(planValue);
  const planEvidenceRefs = new Set(
    compactStrings(plan.evidenceRefs).filter((ref) =>
      knownEvidence.has(ref) && ref !== CONTINGENT_TARGET_EVIDENCE_REF
    )
  );
  for (const familyKey of ['familyA', 'familyB']) {
    const family = asObject(clone[familyKey]);
    if (Object.keys(family).length === 0) continue;
    // family.e is a containment index, so rebuild it from this family's
    // materialized shared-path and tactic children. This preserves nested
    // grounding refs omitted by an aggregate without borrowing a ref that is
    // present only in the sibling tactic.
    const familyRefs = compactStrings([
      ...asArray(family.e),
      ...declaredContingentFinalistEvidenceRefs(family.d)
    ])
      .filter((ref) => knownEvidence.has(ref))
      .filter((ref) =>
        ref === CONTINGENT_TARGET_EVIDENCE_REF || planEvidenceRefs.has(ref)
      );
    family.e = compactStrings([
      ...(familyRefs.includes(CONTINGENT_TARGET_EVIDENCE_REF)
        ? [CONTINGENT_TARGET_EVIDENCE_REF]
        : []),
      ...familyRefs.filter((ref) =>
        ref !== CONTINGENT_TARGET_EVIDENCE_REF
      )
    ]);
  }
  if (compactPlannerBundle && allowPlannerProjection === true) {
    clone = canonicalizeContingentConversionActions(clone, planValue);
  }
  if (contingentJSONShapeUnsafe(clone, knownEvidence)) return {};
  return clone;
}

/**
 * The compact call-1 contract authors one shared revenue path and two
 * tactic-local action sets. Its revenue-path `c` field is an exact structural
 * projection marker rather than a third model-authored version of the same
 * commercial step. For a compact planner response only, replace that marker
 * in each materialized family with the first same-family action that already
 * satisfies the local evidence, active-cash, acquisition-mode, and typed-role
 * gates.
 *
 * This is bounded structural projection of model-authored text, not a new
 * commercial claim: no target, evidence, offer, permission, or action is
 * synthesized. An arbitrary string is never eligible for projection. If the
 * marker is missing or neither tactic action passes the existing gates, the
 * field is left untouched and the ordinary contract validator fails closed.
 * A materialized receipt is never projected, preserving tamper detection and
 * historical validation semantics.
 */
function canonicalizeContingentConversionActions(value, planValue) {
  const bundle = asObject(value);
  for (const familyKey of ['familyA', 'familyB']) {
    const family = asObject(bundle[familyKey]);
    const dimensions = asObject(family.d);
    const revenue = asObject(asArray(dimensions.r)[0]);
    if (Object.keys(revenue).length === 0 ||
        firstText(revenue.c) !==
          CONTINGENT_CONVERSION_ACTION_PROJECTION) {
      continue;
    }
    const action = asArray(dimensions.a)
      .map(asObject)
      .find((item) => contingentViableActionItem(
        item,
        family,
        planValue
      ));
    if (!action) continue;
    revenue.c = firstText(action.l);
  }
  return bundle;
}

function contingentViableActionItem(itemValue, familyValue, planValue) {
  const item = asObject(itemValue);
  const family = asObject(familyValue);
  const plan = asObject(planValue);
  const label = firstText(item.l);
  const evidenceRefs = compactStrings(item.e);
  const familyRefs = new Set(compactStrings(family.e));
  const actionModes = acquisitionModesFromText(label);
  return evidenceRefs.length > 0 &&
    evidenceRefs.every((ref) => familyRefs.has(ref)) &&
    countExactToken(label, CONTINGENT_TARGET_NAME_TOKEN) === 1 &&
    firstText(family.m) === firstText(plan.acquisitionMode) &&
    actionModes.every((mode) =>
      mode === firstText(plan.acquisitionMode)
    ) &&
    !contingentPrimaryRevenueActionRoleIssue(label, plan) &&
    viablePrimaryRevenueAction(label);
}

/**
 * The unresolved target sentinel is protocol structure, not evidence that an
 * outside person, organization, or paid-demand record exists. Canonicalize
 * that structure locally so a model cannot strand an otherwise complete paid
 * path merely by omitting the sentinel from a repeated containment array or
 * by copying it into a role the eventual provider record cannot prove.
 *
 * This does not choose or synthesize a target. The sentinel must still be
 * replaced later by a validated public provider candidate whose typed roles
 * satisfy the canonical target slot. Only those canonical roles are projected
 * into revenue grounding. Unauthorized sentinel copies are removed without
 * removing any approved owner evidence; a field left with no evidence then
 * fails the ordinary completeness gate. No observation or seller-side fact is
 * added here.
 */
function canonicalizeContingentTargetEvidence(value, planValue) {
  const bundle = asObject(value);
  const plan = asObject(planValue);
  const normalizedTargetSlot = normalizeContingentTargetSlot(
    plan.targetSlot,
    plan
  );
  const canonicalPlan = {
    ...plan,
    targetSlot: normalizedTargetSlot
  };
  if (contingentTargetSlotIssue(canonicalPlan)) return bundle;
  const targetRoles = new Set(
    requiredCommercialDiscoveryRolesForSlot(canonicalPlan)
  );
  const withoutTargetRef = (refsValue) => compactStrings(
    asArray(refsValue).filter((ref) =>
      ref !== CONTINGENT_TARGET_EVIDENCE_REF
    )
  );
  const canonicalTargetRefs = (refsValue, allowed) => compactStrings([
    ...withoutTargetRef(refsValue),
    ...(allowed ? [CONTINGENT_TARGET_EVIDENCE_REF] : [])
  ]);
  const canonicalizeTargetBearingItem = (itemValue) => {
    const item = asObject(itemValue);
    const targetBearing = countExactToken(
      firstText(item.l),
      CONTINGENT_TARGET_NAME_TOKEN
    ) === 1;
    item.e = canonicalTargetRefs(item.e, targetBearing);
  };

  for (const familyKey of ['familyA', 'familyB']) {
    const family = asObject(bundle[familyKey]);
    if (Object.keys(family).length === 0) continue;
    const dimensions = asObject(family.d);
    const roleDimensions = targetEvidenceDimensionKeysForRole(plan);
    for (const dimension of ['o', 'b', 'c', 'a', 't', 'p', 'f']) {
      for (const item of asArray(dimensions[dimension])) {
        if (dimension === 'a') {
          canonicalizeTargetBearingItem(item);
          continue;
        }
        const normalizedItem = asObject(item);
        normalizedItem.e = canonicalTargetRefs(
          normalizedItem.e,
          roleDimensions.includes(dimension)
        );
      }
    }
    for (const revenueValue of asArray(dimensions.r)) {
      const revenue = asObject(revenueValue);
      const grounding = asObject(revenue.g);
      grounding.b = canonicalTargetRefs(
        grounding.b,
        targetRoles.has('defined_buyer')
      );
      grounding.o = canonicalTargetRefs(
        grounding.o,
        targetRoles.has('paid_offer')
      );
      grounding.a = canonicalTargetRefs(
        grounding.a,
        targetRoles.has('acquisition') && targetRoles.has('channel_fit')
      );
      const destination = asObject(grounding.d);
      destination.e = canonicalTargetRefs(
        destination.e,
        targetRoles.has('conversion_destination')
      );
      grounding.d = destination;
      grounding.c = canonicalTargetRefs(
        grounding.c,
        targetRoles.has('paid_conversion')
      );
      grounding.t = canonicalTargetRefs(grounding.t, false);
      revenue.g = grounding;
    }
  }
  return bundle;
}

function contingentTargetEvidenceRoleIssue(value, planValue) {
  const bundle = asObject(value);
  const targetRoles = new Set(
    requiredCommercialDiscoveryRolesForSlot(planValue)
  );
  const allowedDimensions = new Set([
    'a',
    ...targetEvidenceDimensionKeysForRole(planValue)
  ]);
  const dimensionRoles = {
    o: 'paid_offer',
    b: 'defined_buyer',
    c: 'acquisition_channel',
    a: 'primary_action',
    t: 'timing',
    p: 'proof',
    f: 'follow_up'
  };
  const roleLocations = [
    ['defined_buyer', (grounding) => grounding.b,
      targetRoles.has('defined_buyer')],
    ['paid_offer', (grounding) => grounding.o,
      targetRoles.has('paid_offer')],
    ['acquisition', (grounding) => grounding.a,
      targetRoles.has('acquisition') && targetRoles.has('channel_fit')],
    ['conversion_destination', (grounding) => asObject(grounding.d).e,
      targetRoles.has('conversion_destination')],
    ['paid_conversion', (grounding) => grounding.c,
      targetRoles.has('paid_conversion')],
    ['attribution', (grounding) => grounding.t, false]
  ];
  for (const [familyIndex, familyKey] of
    ['familyA', 'familyB'].entries()) {
    const dimensions = asObject(asObject(bundle[familyKey]).d);
    for (const [dimension, role] of Object.entries(dimensionRoles)) {
      if (!allowedDimensions.has(dimension) &&
          asArray(dimensions[dimension]).some((item) =>
            compactStrings(asObject(item).e).includes(
              CONTINGENT_TARGET_EVIDENCE_REF
            )
          )) {
        return `has target evidence in unauthorized ${role} dimension for contingent family ${familyIndex + 1}.`;
      }
    }
    for (const revenueValue of asArray(dimensions.r)) {
      const grounding = asObject(asObject(revenueValue).g);
      for (const [role, refs, allowed] of roleLocations) {
        if (!allowed && compactStrings(refs(grounding)).includes(
          CONTINGENT_TARGET_EVIDENCE_REF
        )) {
          return `has target evidence in unauthorized ${role} grounding for contingent family ${familyIndex + 1}.`;
        }
      }
    }
  }
  return '';
}

function targetEvidenceDimensionKeysForRole(planValue) {
  const commercialRole = firstText(asObject(planValue).commercialRole);
  if (commercialRole === 'referral_partner') return ['c'];
  if (commercialRole === 'buyer') return ['b', 'c'];
  if (commercialRole === 'paid_demand') return ['b', 'o', 'c'];
  return [];
}

function neutralContingentFollowUp(value) {
  const match = /^if no reply after ([1-9][0-9]?) days?, one review-first follow-up\.?$/i.exec(
    firstText(value).trim()
  );
  return Boolean(match) && Number(match[1]) <= 30;
}

/**
 * Call 1 authors the common paid path once and only the three tactic-local
 * dimensions twice. Downstream validation, target binding, persistence, and
 * the independent critic deliberately continue to consume the established
 * familyA/familyB contract. This is structural copying only: no commercial
 * text, evidence reference, or score is synthesized here.
 *
 * Previously persisted planner receipts already contain materialized
 * familyA/familyB values. Canonicalizing that shape to its supported keys
 * retains read compatibility while preventing a mixed compact/materialized
 * object from widening the durable contract.
 */
function materializePlannerContingentFinalistBundle(value) {
  const raw = asObject(value);
  const materializedFamilyA = asObject(raw.familyA);
  const materializedFamilyB = asObject(raw.familyB);
  if (Object.keys(materializedFamilyA).length > 0 &&
      Object.keys(materializedFamilyB).length > 0) {
    return {
      seedContract: raw.seedContract,
      familyA: materializedFamilyA,
      familyB: materializedFamilyB,
      w: asObject(raw.w)
    };
  }

  const pathBase = asObject(raw.pathBase);
  const tacticA = asObject(raw.tacticA);
  const tacticB = asObject(raw.tacticB);
  if (Object.keys(pathBase).length === 0 ||
      Object.keys(tacticA).length === 0 ||
      Object.keys(tacticB).length === 0) {
    return raw;
  }
  const copy = (item) => JSON.parse(JSON.stringify(item));
  const family = (tactic) => ({
    l: tactic.l,
    m: tactic.m,
    e: compactStrings([
      ...asArray(pathBase.e),
      ...asArray(tactic.e)
    ]),
    s: copy(asObject(tactic.s)),
    tacticKey: tactic.tacticKey,
    d: {
      r: copy(asArray(pathBase.r)),
      o: copy(asArray(pathBase.o)),
      b: copy(asArray(pathBase.b)),
      c: copy(asArray(tactic.c)),
      a: copy(asArray(tactic.a)),
      t: copy(asArray(pathBase.t)),
      p: copy(asArray(pathBase.p)),
      f: copy(asArray(tactic.f))
    }
  });
  return {
    seedContract: raw.seedContract,
    familyA: family(tacticA),
    familyB: family(tacticB),
    w: copy(asObject(raw.w))
  };
}

function contingentJSONShapeUnsafe(value, knownEvidence) {
  let unsafe = false;
  const visit = (item, key = '') => {
    if (unsafe) return;
    if (typeof item === 'string') {
      if (item.length > 700 || /\{\{(?!TARGET_(?:NAME|URL)\}\})/i.test(item)) {
        unsafe = true;
      }
      return;
    }
    if (Array.isArray(item)) {
      if (item.length > 12) {
        unsafe = true;
        return;
      }
      if (['e', 'b', 'o', 'a', 'c', 't'].includes(key) &&
          item.every((entry) => typeof entry === 'string') &&
          item.some((entry) => !knownEvidence.has(entry))) {
        unsafe = true;
        return;
      }
      item.forEach((entry) => visit(entry));
      return;
    }
    if (item && typeof item === 'object') {
      for (const [childKey, child] of Object.entries(item)) {
        visit(child, childKey);
      }
      return;
    }
    if (item !== null &&
        typeof item !== 'number' &&
        typeof item !== 'boolean') {
      unsafe = true;
    }
  };
  visit(value);
  return unsafe;
}

function opportunityDiscoveryPlanIssue(value) {
  const plan = asObject(value);
  const legacy = plan.contractVersion ===
    LEGACY_OPPORTUNITY_DISCOVERY_PLAN_CONTRACT;
  if (!legacy &&
      plan.contractVersion !== OPPORTUNITY_DISCOVERY_PLAN_CONTRACT) {
    return 'Discovery planner returned the wrong contract version.';
  }
  if (!['planned', 'insufficient_verified_supply'].includes(plan.status)) {
    return 'Discovery planner returned an unsupported status.';
  }
  if (commercialDiscoveryContainsPrivateContact(plan.reason)) {
    return 'Discovery planner reason contains private-contact data [private_contact_value].';
  }
  if (discoveryPlanExplicitlyRequestsPrivateContact(plan.reason)) {
    return 'Discovery planner reason requests private-contact data [private_contact_request].';
  }
  if (!legacy) {
    const webSearchIssue = opportunityDiscoveryWebSearchReceiptIssue(
      plan.webSearchReceipt
    );
    if (webSearchIssue) return webSearchIssue;
  }
  if (plan.status === 'insufficient_verified_supply') {
    return asArray(plan.plans).length === 0 && firstText(plan.reason)
      ? ''
      : 'Insufficient-supply planning must return no outside search plans and a reason.';
  }
  const plans = asArray(plan.plans);
  // New provider output is constrained to one outer motion by the strict
  // schema and the raw-cardinality gate. Retain read compatibility with a
  // previously persisted two-motion v2 plan so an already-paid run can still
  // compare one family from each bound motion instead of being stranded by
  // this output-compaction change.
  if ((!legacy && (plans.length < 1 || plans.length > 2)) ||
      (legacy && (plans.length < 2 || plans.length > 3))) {
    return legacy
      ? 'Legacy discovery planning requires two or three distinct commercial motions.'
      : 'Discovery planning requires one or two grounded commercial motions.';
  }
  const ids = new Set();
  const priorities = new Set();
  const signatures = new Set();
  for (const itemValue of plans) {
    const item = asObject(itemValue);
    if (!/^[a-z][a-z0-9_-]{2,63}$/.test(firstText(item.id)) ||
        ids.has(item.id)) {
      return 'Discovery plans require unique stable ids.';
    }
    ids.add(item.id);
    if (priorities.has(item.priority)) {
      return 'Discovery plan priorities must be unique.';
    }
    priorities.add(item.priority);
    if (!DISCOVERY_PLAN_SEARCH_MODES.has(item.searchMode) ||
        !DISCOVERY_PLAN_COMMERCIAL_ROLES.has(item.commercialRole) ||
        !ACQUISITION_MODES.has(item.acquisitionMode)) {
      return 'Discovery plan uses an unsupported typed commercial route.';
    }
    if (!DISCOVERY_PLAN_ACQUISITION_MODES_BY_ROLE
      .get(item.commercialRole)?.has(item.acquisitionMode)) {
      return `Discovery plan ${item.id} uses an acquisition mode that cannot be source-bound to its unresolved ${item.commercialRole} target.`;
    }
    const signature = `${item.searchMode}\x00${item.commercialRole}\x00${item.acquisitionMode}`;
    if (signatures.has(signature)) {
      return 'Discovery plans repeat the same economic search motion.';
    }
    signatures.add(signature);
    for (const field of [
      'buyer',
      'counterparty',
      'paidOffer',
      'query',
      'acquisitionMechanism',
      'conversionDestination',
      'paidConversion',
      'attributionSignal',
      'rationale'
    ]) {
      if (!firstText(item[field])) {
        return `Discovery plan ${item.id} is missing ${field}.`;
      }
    }
    if (item.commercialRole === 'referral_partner' &&
        comparable(item.buyer) === comparable(item.counterparty)) {
      return `Discovery plan ${item.id} must keep the end buyer distinct from the prospective referral counterparty.`;
    }
    if (item.commercialRole === 'referral_partner' &&
        countExactToken(item.buyer, CONTINGENT_TARGET_NAME_TOKEN) > 0) {
      return `Discovery plan ${item.id} must describe the end buyer independently of its unresolved referral target.`;
    }
    if (asArray(item.evidenceRefs).length === 0) {
      return `Discovery plan ${item.id} is not grounded in approved evidence.`;
    }
    if (asArray(item.evidenceRefs).length >
        MAX_DISCOVERY_PLAN_EVIDENCE_REFS) {
      return `Discovery plan ${item.id} exceeds the bounded approved evidence index.`;
    }
    const livePaidDemandSearch =
      item.searchMode === 'active_job_posting' ||
      item.searchMode === 'public_live_demand';
    if (livePaidDemandSearch && item.commercialRole !== 'paid_demand') {
      return 'Active-job and public-live-demand searches require paid-demand role.';
    }
    if (livePaidDemandSearch && ![
      'inbound',
      'partner_channel',
      'permissioned_outreach'
    ].includes(item.acquisitionMode)) {
      return 'Active-job and public-live-demand searches require a supported provider-attested review route.';
    }
    if (item.searchMode === 'active_job_posting') {
      if (!firstText(item.jobTitle) && asArray(item.skills).length === 0) {
        return 'Active job searches require paid-demand role and a verified title or skill query.';
      }
    } else if (item.commercialRole === 'paid_demand' &&
        item.searchMode !== 'public_live_demand') {
      return 'Paid-demand role requires an active job or public live-demand search.';
    }
    if (item.commercialRole === 'paid_demand' &&
        countExactToken(item.buyer, CONTINGENT_TARGET_NAME_TOKEN) > 0) {
      return `Discovery plan ${item.id} must name the buyer archetype independently of the unresolved paid-demand artifact.`;
    }
    if (item.commercialRole === 'paid_demand' &&
        !buyerAuthoredPaidDemandQuery(item)) {
      return `Discovery plan ${item.id} must search for a current buyer- or employer-authored compensated job, RFP, solicitation, contract, or explicit buying request rather than another supplier's offer.`;
    }
    if (item.searchMode === 'professional_counterparty' &&
        asArray(item.targetRoleTerms).length === 0) {
      return 'Professional counterparty search requires bounded professional role terms.';
    }
    const sensitiveTargetIssue = discoveryPlanSensitiveTargetIssue(item);
    if (sensitiveTargetIssue) return sensitiveTargetIssue;
    if (!legacy) {
      const targetSlotIssue = contingentTargetSlotIssue(item);
      if (targetSlotIssue) {
        return `Discovery plan ${item.id} ${targetSlotIssue}`;
      }
      const contingentIssue = contingentFinalistBundleIssue(item);
      if (contingentIssue) {
        return `Discovery plan ${item.id} ${contingentIssue}`;
      }
    }
  }
  return '';
}

function opportunityDiscoveryRawPlanCardinalityIssue(value) {
  const raw = asObject(value);
  if (!Array.isArray(raw.plans)) {
    return 'Discovery planner returned a non-array plans field.';
  }
  const status = firstText(raw.status);
  if (status === 'planned' &&
      raw.plans.length !== MAX_DISCOVERY_PLANNER_PLANS) {
    return 'Discovery planning requires exactly two grounded, economically distinct commercial motions with two causal families each.';
  }
  if (status === 'insufficient_verified_supply' &&
      raw.plans.length !== 0) {
    return 'Insufficient-supply planning must return no outside search plans and a reason.';
  }
  return '';
}

function opportunityDiscoveryRawCausalWitnessIssue(value) {
  const raw = asObject(value);
  if (firstText(raw.contractVersion) !==
      OPPORTUNITY_DISCOVERY_PLAN_CONTRACT ||
      firstText(raw.status) !== 'planned') {
    return '';
  }
  for (const planValue of asArray(raw.plans)) {
    const plan = asObject(planValue);
    const bundle = asObject(plan.contingentFinalists);
    const pathBase = asObject(bundle.pathBase);
    const revenuePaths = Object.keys(pathBase).length > 0
      ? asArray(pathBase.r)
      : ['familyA', 'familyB'].flatMap((familyKey) =>
          asArray(asObject(asObject(bundle[familyKey]).d).r)
        );
    if (revenuePaths.length === 0) {
      return `Discovery plan ${firstText(plan.id)} has no typed causal revenue witness.`;
    }
    for (const [index, revenueValue] of revenuePaths.entries()) {
      const issues = revenueCausalWitnessIssues(revenueValue);
      if (issues.length > 0) {
        return `Discovery plan ${firstText(plan.id)} has an invalid typed causal revenue witness ${index + 1} [${issues.join(',')}].`;
      }
    }
  }
  return '';
}

function contingentTargetSlotIssue(planValue) {
  const plan = asObject(planValue);
  const slot = asObject(plan.targetSlot);
  if (firstText(slot.targetNameToken) !== CONTINGENT_TARGET_NAME_TOKEN ||
      firstText(slot.targetUrlToken) !== CONTINGENT_TARGET_URL_TOKEN ||
      firstText(slot.evidenceRefToken) !==
        CONTINGENT_TARGET_EVIDENCE_REF ||
      firstText(slot.commercialRole) !== firstText(plan.commercialRole)) {
    return 'has an invalid or unbound target slot.';
  }
  const kinds = new Set(['person', 'organization', 'live_paid_demand']);
  const strategies = new Set([
    'single_exact_target',
    'organization_then_decision_maker'
  ]);
  if (!kinds.has(firstText(slot.finalTargetKind)) ||
      !strategies.has(firstText(slot.resolutionStrategy))) {
    return 'has an unsupported target resolution strategy.';
  }
  if (slot.resolutionStrategy === 'organization_then_decision_maker' &&
      slot.finalTargetKind !== 'person') {
    return 'must resolve a person after the intermediate organization.';
  }
  if (slot.resolutionStrategy === 'organization_then_decision_maker' &&
      plan.searchMode !== 'local_organization') {
    return 'may resolve an organization then decision-maker only for a local-organization search.';
  }
  if (slot.resolutionStrategy === 'organization_then_decision_maker' &&
      asArray(plan.targetRoleTerms).length === 0) {
    return 'must declare bounded professional role terms for the decision-maker lookup.';
  }
  if (plan.searchMode === 'professional_counterparty' && (
    slot.finalTargetKind !== 'person' ||
      slot.resolutionStrategy !== 'single_exact_target'
  )) {
    return 'must resolve a professional counterparty as one exact decision-maker person.';
  }
  if (plan.searchMode === 'local_organization' && (
    slot.finalTargetKind !== 'person' ||
      slot.resolutionStrategy !== 'organization_then_decision_maker'
  )) {
    return 'must use a local organization only as an intermediate seed and resolve its exact decision-maker person.';
  }
  const livePaidDemandRoute = plan.commercialRole === 'paid_demand' && (
    plan.searchMode === 'active_job_posting' ||
    plan.searchMode === 'public_live_demand'
  );
  if (slot.finalTargetKind === 'live_paid_demand' &&
      !livePaidDemandRoute) {
    return 'may bind live paid demand only for a typed paid-demand search.';
  }
  if (livePaidDemandRoute) {
    if (slot.finalTargetKind !== 'live_paid_demand' ||
        slot.resolutionStrategy !== 'single_exact_target') {
      return 'must bind live paid demand as one exact public target.';
    }
  }
  const expectedRoles = requiredCommercialDiscoveryRolesForSlot(plan);
  const returnedRoles = compactStrings(slot.requiredEvidenceRoles)
    .map(contractEnum)
    .sort(compareStableText);
  if (stableHash(returnedRoles) !==
      stableHash([...expectedRoles].sort(compareStableText))) {
    return 'declares evidence roles that do not match its typed commercial route.';
  }
  return '';
}

function requiredCommercialDiscoveryRolesForSlot(planValue) {
  const plan = asObject(planValue);
  if (firstText(plan.commercialRole) === 'referral_partner') {
    return ['acquisition', 'channel_fit', 'prospective_partner'];
  }
  if (firstText(plan.commercialRole) === 'buyer') {
    return ['acquisition', 'channel_fit', 'defined_buyer'];
  }
  return [
    'acquisition',
    'channel_fit',
    'conversion_destination',
    'defined_buyer',
    'demand_signal',
    'paid_conversion',
    'paid_offer'
  ];
}

function contingentFinalistBundleIssue(planValue) {
  const plan = asObject(planValue);
  const bundle = asObject(plan.contingentFinalists);
  if (firstText(bundle.seedContract) !== SEED_CONTRACT_VERSION) {
    return 'has no supported contingent finalist contract.';
  }
  const families = [asObject(bundle.familyA), asObject(bundle.familyB)];
  if (families.some((family) => Object.keys(family).length === 0)) {
    return 'must contain exactly two complete contingent finalist families.';
  }
  const targetEvidenceRoleIssue = contingentTargetEvidenceRoleIssue(
    bundle,
    plan
  );
  if (targetEvidenceRoleIssue) return targetEvidenceRoleIssue;
  const tacticKeys = new Set();
  const actionSignatures = new Set();
  const viableActionSignatures = new Set();
  for (const [familyIndex, family] of families.entries()) {
    if (!firstText(family.l) ||
        firstText(family.m) !== firstText(plan.acquisitionMode) ||
        !/^[a-z][a-z0-9_]{2,63}$/.test(firstText(family.tacticKey)) ||
        tacticKeys.has(firstText(family.tacticKey))) {
      return 'has duplicate or invalid contingent tactic families.';
    }
    tacticKeys.add(firstText(family.tacticKey));
    const familyRefs = compactStrings(family.e);
    if (familyRefs.length === 0) {
      return `has no evidence containment index for contingent family ${familyIndex + 1}.`;
    }
    if (!familyRefs.includes(CONTINGENT_TARGET_EVIDENCE_REF)) {
      return `is missing the unresolved target slot in contingent family ${familyIndex + 1}.`;
    }
    if (!familyRefs.some((ref) => /^observation:/i.test(ref))) {
      return `is missing approved observation evidence in contingent family ${familyIndex + 1}.`;
    }
    if (familyRefs.some((ref) =>
      ref !== CONTINGENT_TARGET_EVIDENCE_REF &&
      !asArray(plan.evidenceRefs).includes(ref)
    )) {
      return `has contingent family ${familyIndex + 1} outside its approved supply evidence.`;
    }
    const dimensions = asObject(family.d);
    for (const [dimension, count] of [
      ['r', 1],
      ['o', INITIAL_FAMILY_VARIANT_COUNT],
      ['b', INITIAL_FAMILY_VARIANT_COUNT],
      ['c', INITIAL_FAMILY_VARIANT_COUNT],
      ['a', INITIAL_FAMILY_VARIANT_COUNT],
      ['t', INITIAL_FAMILY_VARIANT_COUNT],
      ['p', INITIAL_FAMILY_VARIANT_COUNT],
      ['f', INITIAL_FAMILY_VARIANT_COUNT]
    ]) {
      const values = asArray(dimensions[dimension]);
      if (values.length !== count || values.some((itemValue) => {
        const item = asObject(itemValue);
        return !firstText(item.l) ||
          asArray(item.e).length === 0 ||
          asArray(item.e).some((ref) => !familyRefs.includes(ref)) ||
          (dimension === 't' && !firstText(item.q));
      })) {
        return `has an incomplete ${dimension} finalist dimension.`;
      }
    }
    const unsupportedFollowUpIndex = asArray(dimensions.f).findIndex(
      (item) => !neutralContingentFollowUp(
        firstText(asObject(item).l)
      )
    );
    if (unsupportedFollowUpIndex >= 0) {
      return `family ${familyIndex + 1} follow-up ${unsupportedFollowUpIndex + 1} [follow_up_unverified_state]: must use the neutral bounded no-reply follow-up contract.`;
    }
    const familyViableActionSignatures = new Set();
    const rejectedActionIssues = [];
    for (const [actionIndex, actionValue] of
      asArray(dimensions.a).entries()) {
      const action = firstText(asObject(actionValue).l);
      const targetNameCount = countExactToken(
        action,
        CONTINGENT_TARGET_NAME_TOKEN
      );
      if (targetNameCount !== 1) {
        const targetURLCount = countExactToken(
          action,
          CONTINGENT_TARGET_URL_TOKEN
        );
        return `family ${familyIndex + 1} action ${actionIndex + 1} [primary_action_target_token]: must contain exactly one target-name token (name_count=${targetNameCount}, url_count=${targetURLCount}).`;
      }
      const signature = comparable(action);
      actionSignatures.add(signature);
      const roleIssue = contingentPrimaryRevenueActionRoleIssue(
        action,
        plan
      );
      if (contingentViableActionItem(actionValue, family, plan)) {
        familyViableActionSignatures.add(signature);
        viableActionSignatures.add(signature);
      } else if (passiveOrObservationalPrimaryAction(action)) {
        rejectedActionIssues.push(
          `family ${familyIndex + 1} action ${actionIndex + 1} [primary_action_passive]: must be active rather than observational.`
        );
      } else if (operationOnlyAction(action)) {
        rejectedActionIssues.push(
          `family ${familyIndex + 1} action ${actionIndex + 1} [primary_action_operational]: must be commercial rather than operational.`
        );
      } else if (!revenueAdvancingAction(action)) {
        rejectedActionIssues.push(
          `family ${familyIndex + 1} action ${actionIndex + 1} [primary_action_non_revenue]: must causally advance acquisition or paid conversion.`
        );
      } else if (roleIssue) {
        rejectedActionIssues.push(
          `family ${familyIndex + 1} action ${actionIndex + 1} [${roleIssue}]: must perform the typed commercial role's direct cash-advancing action.`
        );
      } else if (acquisitionModesFromText(action).some((mode) =>
        mode !== firstText(plan.acquisitionMode)
      )) {
        rejectedActionIssues.push(
          `family ${familyIndex + 1} action ${actionIndex + 1} [primary_action_acquisition_mode]: must align with the typed acquisition route.`
        );
      } else {
        rejectedActionIssues.push(
          `family ${familyIndex + 1} action ${actionIndex + 1} [primary_action_claimed_execution]: must remain a review-first recommendation.`
        );
      }
    }
    if (familyViableActionSignatures.size === 0) {
      return firstText(rejectedActionIssues[0],
        `family ${familyIndex + 1} [primary_action_no_viable_variant]: must retain at least one active commercial revenue action after deterministic variant pruning.`
      );
    }
    const revenue = asObject(asArray(dimensions.r)[0]);
    if (plan.searchMode === 'active_job_posting' &&
        firstText(revenue.rm) !== 'compensated_role') {
      return `has a non-employment revenue mechanism in active-job contingent family ${familyIndex + 1}.`;
    }
    const revenuePathIssues = contingentCausalRevenuePathIssues(
      revenue,
      plan.acquisitionMode,
      plan
    );
    if (revenuePathIssues.length > 0) {
      return `has an incomplete causal revenue path in family ${familyIndex + 1} [${revenuePathIssues.join(',')}].`;
    }
  }
  if (actionSignatures.size < 4) {
    return 'must contain distinct causal primary-action variants across both families.';
  }
  if (viableActionSignatures.size < 2) {
    return 'must retain at least two distinct active commercial primary-action variants across both families.';
  }
  const weights = asObject(bundle.w);
  if (Object.keys(weights).length !== 11 ||
      Object.values(weights).some((value) => !Number.isFinite(value))) {
    return 'has incomplete semantic judge weights.';
  }
  return '';
}

function buyerAuthoredPaidDemandQuery(planValue) {
  const plan = asObject(planValue);
  const query = comparable(plan.query);
  if (!query) return false;
  if (/\b(?:canceled|cancelled|closed|do not|does not|expired|no longer|not hiring|not seeking|unpaid|volunteer|withdrawn)\b/.test(query)) {
    return false;
  }
  if (plan.searchMode === 'active_job_posting') {
    return /\b(?:compensated|contract|employment|freelance|hiring|job|paid|role|salary|vacancy|wage)\b/.test(
      query
    );
  }
  const explicitDemandArtifact = /\b(?:invitation to bid|job posting|open call|paid opportunity|procurement (?:notice|opportunity|rfp)|request for (?:bid|proposal|quotation)|rfp|rfq|solicitation|tender)\b/.test(
    query
  );
  const buyerOrEmployer = /\b(?:agency|business|buyer|client|company|employer|government|organization|purchaser)\b/.test(
    query
  );
  const compensatedAsk = /\b(?:budget|commission|compensated|contract|paid|payment|salary|wage)\b/.test(
    query
  ) && /\b(?:buying|hiring|procuring|requesting|seeking|wanted)\b/.test(
    query
  );
  return explicitDemandArtifact || (buyerOrEmployer && compensatedAsk);
}

function contingentPrimaryRevenueActionRoleIssue(value, planValue) {
  const plan = asObject(planValue);
  const text = primaryActionSemanticText(value);
  if (negatedPrimaryRevenueAction(text)) {
    return 'primary_action_negated';
  }
  if (plan.commercialRole === 'paid_demand') {
    const response = /\b(?:apply|bid|respond|submit)\b/.test(text) &&
      /\b(?:application|bid|proposal|request for proposal|response|rfp|solicitation)\b/.test(
        text
      ) &&
      /\b(?:compensated|contract|paid|payment|salary|wage)\b/.test(text);
    return response ? '' : 'primary_action_paid_demand_response';
  }
  if (plan.commercialRole === 'referral_partner') {
    const qualifiedReferral = qualifiedReferralCashAction(value);
    return qualifiedReferral ? '' : 'primary_action_partner_referral';
  }
  if (plan.commercialRole === 'buyer') {
    const buyerAsk = /\b(?:book|buy|contract|hire|offer|propos|purchase|sign|subscribe)\w*\b/.test(
      text
    ) && /\b(?:compensated|contract|paid|payment|purchase|reimburs|subscription)\w*\b/.test(
      text
    );
    return buyerAsk ? '' : 'primary_action_buyer_commitment';
  }
  return 'primary_action_unknown_commercial_role';
}

function contingentCausalRevenuePathIssues(
  revenueValue,
  acquisitionMode,
  planValue
) {
  const revenue = asObject(revenueValue);
  const grounding = asObject(revenue.g);
  const destination = asObject(grounding.d);
  const semantic = revenuePathSemanticChecks(revenue, planValue);
  return [
    [
      firstText(revenue.v) === REVENUE_PATH_CONTRACT_VERSION,
      'contract_version'
    ],
    [
      REVENUE_MECHANISMS.has(firstText(revenue.rm)),
      'revenue_mechanism'
    ],
    [
      firstText(revenue.a) === firstText(acquisitionMode),
      'acquisition_mode'
    ],
    [
      ATTRIBUTION_METHODS.has(firstText(revenue.atm)),
      'attribution_method'
    ],
    [semantic.incrementalIncome, 'incremental_income'],
    [semantic.conversionAction, 'conversion_action'],
    [semantic.observableRevenue, 'observable_revenue'],
    [semantic.attributionSignal, 'attribution_signal'],
    [semantic.conversionDestination, 'conversion_destination'],
    [semantic.numericStop, 'numeric_stop'],
    [nonNegativeInteger(revenue.vm) > 0, 'expected_value'],
    [asArray(grounding.b).length > 0, 'grounding_buyer'],
    [asArray(grounding.o).length > 0, 'grounding_offer'],
    [asArray(grounding.a).length > 0, 'grounding_acquisition'],
    [firstText(destination.l), 'grounding_destination_label'],
    [
      asArray(destination.e).length > 0,
      'grounding_destination_evidence'
    ],
    [asArray(grounding.c).length > 0, 'grounding_conversion'],
    [asArray(grounding.t).length > 0, 'grounding_attribution']
  ]
    .filter(([valid]) => !valid)
    .map(([, code]) => code);
}

function normalizeRevenueCausalWitness(value) {
  const raw = asObject(value);
  if (Object.keys(raw).length === 0) return undefined;
  return compact({
    contractVersion: firstText(raw.v, raw.contractVersion),
    incrementalIncomeKind: firstText(
      raw.i,
      raw.incrementalIncomeKind
    ),
    conversionActionMechanism: contractEnum(firstText(
      raw.c,
      raw.conversionActionMechanism
    )),
    observableOutcomeMechanism: contractEnum(firstText(
      raw.o,
      raw.observableOutcomeMechanism
    )),
    terminalOutcomeKind: contractEnum(firstText(
      raw.p,
      raw.terminalOutcomeKind
    )),
    attributionMethod: contractEnum(firstText(
      raw.t,
      raw.attributionMethod
    )),
    destinationKind: firstText(raw.d, raw.destinationKind),
    stopRule: firstText(raw.s, raw.stopRule),
    stopLimit: Number.isInteger(raw.n)
      ? raw.n
      : Number.isInteger(raw.stopLimit)
        ? raw.stopLimit
        : undefined,
    stopUnit: contractEnum(firstText(raw.u, raw.stopUnit))
  });
}

function revenueCausalWitnessFieldChecks(revenueValue) {
  const revenue = asObject(revenueValue);
  const hasCompactWitness = Object.prototype.hasOwnProperty.call(
    revenue,
    'k'
  );
  const hasNormalizedWitness = Object.prototype.hasOwnProperty.call(
    revenue,
    'causalWitness'
  );
  const witness = normalizeRevenueCausalWitness(
    hasCompactWitness ? revenue.k : revenue.causalWitness
  );
  const contractVersion = firstText(witness?.contractVersion);
  const currentVersion = contractVersion ===
    REVENUE_CAUSAL_WITNESS_CONTRACT;
  const legacyVersion = contractVersion ===
    LEGACY_REVENUE_CAUSAL_WITNESS_CONTRACT;
  const version = currentVersion;
  const mechanism = contractEnum(firstText(
    revenue.rm,
    revenue.revenueMechanism
  ));
  const attributionMethod = contractEnum(firstText(
    revenue.atm,
    revenue.attributionMethod
  ));
  const stopLimit = witness?.stopLimit;
  const stopUnit = firstText(witness?.stopUnit);
  const numericStop = version &&
    firstText(witness?.stopRule) === REVENUE_CAUSAL_STOP_RULE &&
    Number.isInteger(stopLimit) &&
    stopLimit >= 1 &&
    stopLimit <= 100 &&
    REVENUE_CAUSAL_STOP_UNITS.has(stopUnit) &&
    (stopUnit !== 'calendar_days' || stopLimit <= 30);
  return {
    present: hasCompactWitness || hasNormalizedWitness,
    currentVersion,
    legacyVersion,
    witness,
    incrementalIncome: version &&
      firstText(witness?.incrementalIncomeKind) ===
        REVENUE_CAUSAL_INCREMENTAL_KIND,
    conversionAction: version &&
      REVENUE_MECHANISMS.has(mechanism) &&
      firstText(witness?.conversionActionMechanism) === mechanism,
    observableRevenue: version &&
      REVENUE_MECHANISMS.has(mechanism) &&
      firstText(witness?.observableOutcomeMechanism) === mechanism &&
      (!currentVersion || firstText(witness?.terminalOutcomeKind) ===
        `${mechanism}_terminal`),
    terminalOutcome: currentVersion &&
      REVENUE_MECHANISMS.has(mechanism) &&
      firstText(witness?.terminalOutcomeKind) === `${mechanism}_terminal`,
    attributionSignal: version &&
      ATTRIBUTION_METHODS.has(attributionMethod) &&
      firstText(witness?.attributionMethod) === attributionMethod,
    conversionDestination: version &&
      firstText(witness?.destinationKind) ===
        REVENUE_CAUSAL_DESTINATION_KIND,
    numericStop
  };
}

function revenueCausalWitnessIssues(revenueValue) {
  const checks = revenueCausalWitnessFieldChecks(revenueValue);
  if (!checks.present) return ['missing_witness'];
  return [
    [checks.currentVersion, 'contract_version'],
    [checks.incrementalIncome, 'incremental_income'],
    [checks.conversionAction, 'conversion_action'],
    [checks.observableRevenue, 'observable_revenue'],
    [checks.attributionSignal, 'attribution_signal'],
    [checks.conversionDestination, 'conversion_destination'],
    [checks.numericStop, 'numeric_stop']
  ]
    .filter(([valid]) => !valid)
    .map(([, code]) => code);
}

function revenuePathSemanticChecks(revenueValue, planValue) {
  const revenue = asObject(revenueValue);
  const witness = revenueCausalWitnessFieldChecks(revenue);
  const revenueMechanism = contractEnum(firstText(
    revenue.rm,
    revenue.revenueMechanism
  ));
  const incrementalIncome = firstText(
    revenue.io,
    revenue.incrementalIncomeOutcome
  );
  const conversionAction = firstText(
    revenue.c,
    revenue.conversionAction
  );
  const observableRevenue = firstText(
    revenue.o,
    revenue.observableRevenueOutcome
  );
  const attributionSignal = firstText(
    revenue.ats,
    revenue.attributionSignal
  );
  const conversionDestination = firstText(
    revenue.cd,
    revenue.conversionDestination
  );
  const numericStop = firstText(
    revenue.st,
    revenue.stopCondition
  );
  const plan = asObject(planValue);
  const roleIssue = Object.keys(plan).length > 0
    ? contingentPrimaryRevenueActionRoleIssue(conversionAction, plan)
    : '';
  const typedConversionAction = witness.conversionAction &&
    Boolean(conversionAction) &&
    !passiveOrObservationalPrimaryAction(conversionAction) &&
    !operationOnlyAction(conversionAction) &&
    !negatedPrimaryRevenueAction(conversionAction) &&
    !nonRevenueArtifactOrQuestionAction(conversionAction) &&
    revenueAdvancingAction(conversionAction) &&
    !roleIssue &&
    !experimentActionClaimsCompletedExternalExecution(conversionAction);
  const legacyConversionAction = Boolean(conversionAction) &&
    !passiveOrObservationalPrimaryAction(conversionAction) &&
    !operationOnlyAction(conversionAction) &&
    !negatedPrimaryRevenueAction(conversionAction) &&
    !nonRevenueArtifactOrQuestionAction(conversionAction) &&
    revenueAdvancingAction(conversionAction) &&
    !roleIssue &&
    !experimentActionClaimsCompletedExternalExecution(conversionAction);
  const typed = witness.currentVersion;
  return {
    witness,
    incrementalIncome: typed
      ? (
        witness.incrementalIncome &&
        Boolean(incrementalIncome) &&
        !explicitlyContradictsIncrementalIncome(incrementalIncome)
      )
      : incrementalIncomeText(incrementalIncome),
    conversionAction: typed
      ? typedConversionAction
      : legacyConversionAction,
    observableRevenue: typed
      ? (
        witness.observableRevenue &&
        Boolean(observableRevenue) &&
        (witness.terminalOutcome
          ? typedTerminalPaidOutcomeText(
              observableRevenue,
              revenueMechanism
            )
          : terminalPaidOutcomeText(
              observableRevenue,
              revenueMechanism
            ))
      )
      : observableRevenueText(observableRevenue),
    attributionSignal: typed
      ? (
        witness.attributionSignal &&
        Boolean(attributionSignal) &&
        !explicitlyContradictsAttribution(attributionSignal)
      )
      : attributionSignalText(
          attributionSignal,
          firstText(revenue.atm, revenue.attributionMethod)
        ),
    conversionDestination: typed
      ? (
        witness.conversionDestination &&
        Boolean(conversionDestination) &&
        !explicitlyContradictsConversionDestination(
          conversionDestination
        )
      )
      : conversionDestinationText(conversionDestination),
    numericStop: typed
      ? (
        witness.numericStop &&
        Boolean(numericStop) &&
        !explicitlyContradictsBoundedStop(numericStop)
      )
      : boundedRevenueStopCondition(numericStop)
  };
}

function explicitlyContradictsIncrementalIncome(value) {
  return /\b(?:business as usual|equally likely without|no (?:new |additional |incremental )?(?:income|payment|revenue)|not incremental|without (?:new |additional |incremental )?(?:income|payment|revenue))\b/i.test(
    firstText(value)
  );
}

function explicitlyContradictsPaidOutcome(value) {
  return /\b(?:attempt(?:s|ed|ing)?|authori[sz](?:ation|ed)|awaiting (?:award|deposit|funds|invoice|payment|payout|settlement)|cancelled|canceled|complimentary|declined|denied|failed|free|never (?:accepted|awarded|paid|received|settled|signed)|not (?:yet )?(?:been )?(?:accepted|awarded|paid|received|settled|signed)|pending|refunded|rejected|reversed|unpaid|voided|withdrawn|(?:payment|payout|transfer) (?:is |was |has been )?(?:initiated|processing|scheduled)|(?:funds|invoice|payment|payout|reimbursement) (?:are |is |was )?(?:due|owed|outstanding)|outstanding (?:funds|invoice|payment|payout|reimbursement)|no (?:deposit|funds|income|payment|payout|revenue|settlement)|without (?:deposit|funds|income|payment|payout|revenue|settlement))\b/i.test(
    firstText(value)
  );
}

function typedTerminalPaidOutcomeText(value, mechanism) {
  const text = firstText(value);
  const recordedFinancialState =
    /\b(?:funds|invoice|payment|payout|reimbursement|transaction) (?:is |was |has been )?recorded\b/i.test(
      text
    );
  const settledFinancialState =
    /\b(?:deposit|funds|payment|payout|reimbursement|revenue)\b/i.test(text) &&
    /\b(?:deposited|paid|received|reimbursed|settled)\b/i.test(text);
  const unsettledBillableState = /\bbillable\b/i.test(text) &&
    !/\b(?:paid|received|reimbursed|settled)\b/i.test(text);
  if (!text ||
      /\b(?:either|or)\b/i.test(text) ||
      /\b(?:(?:application|bid|proposal|response) (?:is |was )?(?:filed|recorded|submitted)|(?:filed|submitted) (?:an? )?(?:application|bid|proposal|response))\b/i.test(
        text
      ) ||
      /\b(?:application (?:is |was )?accepted|accepted (?:an? )?application)\b/i.test(
        text
      ) ||
      (mechanism === 'compensated_role' &&
        /\boffer\b/i.test(text) &&
        !/\baccepted\b/i.test(text)) ||
      typedTerminalCrossMechanismContradiction(text, mechanism) ||
      (recordedFinancialState && !settledFinancialState) ||
      unsettledBillableState ||
      explicitlyContradictsPaidOutcome(text)) {
    return false;
  }
  return true;
}

function typedTerminalCrossMechanismContradiction(value, mechanism) {
  const text = firstText(value);
  const markers = new Map([
    ['paid_booking', /\bbookings?\b/i],
    ['direct_sale', /\b(?:checkout|order|purchase|retail sale)s?\b/i],
    ['signed_contract', /\b(?:consulting|paid services|service) contract\b|\bcontract award\b/i],
    ['paid_pilot', /\bpilot\b/i],
    ['subscription_or_retainer', /\b(?:retainer|subscription)s?\b/i],
    ['insurance_reimbursement', /\b(?:claim|reimbursement)s?\b|\breimbursed\b/i],
    ['license_or_royalty', /\b(?:licen[cs]e|licensing|royalt(?:y|ies))\b/i],
    ['commission_or_referral', /\b(?:affiliate|commission|referral fee)\b/i],
    ['sponsorship', /\bsponsor(?:ship|ed)?\b/i],
    ['platform_payout', /\b(?:ad revenue|creator payout|marketplace payout|platform payout)\b/i],
    ['compensated_role', /\b(?:(?:compensated|employment|job) offer|payroll|salary|wage)\b/i]
  ]);
  const selectedMarker = markers.get(contractEnum(mechanism));
  if (selectedMarker?.test(text)) return false;
  return [...markers.entries()].some(([otherMechanism, pattern]) =>
    otherMechanism !== contractEnum(mechanism) && pattern.test(text)
  );
}

function terminalPaidOutcomeText(value, mechanism) {
  const text = firstText(value);
  if (!text ||
      /\b(?:either|or)\b/i.test(text) ||
      /\b(?:(?:application|bid|proposal|response) (?:filed|recorded|submitted)|(?:filed|submitted) (?:application|bid|proposal|response))\b/i.test(
        text
      ) ||
      explicitlyContradictsPaidOutcome(text)) {
    return false;
  }

  const terminalState =
    /\b(?:accepted|activated|awarded|booked|completed|confirmed|paid|placed|received|recorded|renewed|settled|signed|started|won)\b/i.test(
      text
    );
  const cashSettlement =
    /\bpayment receipt\b/i.test(text) ||
    /\b(?:claim|deposit|funds|payment|payout|payroll|reimbursement|revenue|salary|wage)\b/i.test(text) &&
      /\b(?:deposited|paid|received|settled)\b/i.test(text) ||
    /\binvoice\b/i.test(text) && /\b(?:paid|settled)\b/i.test(text);
  if (!terminalState) return false;

  switch (contractEnum(mechanism)) {
  case 'paid_booking':
    return /\b(?:appointment|booking|consultation|engagement|service|session|visit)s?\b/i.test(
      text
    ) && /\b(?:booked|completed|recorded|payment|receipt)\b/i.test(text) && (
      cashSettlement ||
      /\b(?:billable|paid|reimbursed)\b/i.test(text)
    );
  case 'direct_sale':
    return /\b(?:checkout|order|purchase|sale)s?\b/i.test(text) &&
      /\b(?:completed|placed|received|recorded|payment|receipt)\b/i.test(text) && (
      cashSettlement ||
      /\bpaid (?:checkout|order|purchase|sale)\b/i.test(text)
    );
  case 'signed_contract':
    return /\b(?:agreement|bid|contract|proposal)s?\b/i.test(text) &&
      /\b(?:accepted|awarded|signed|won)\b/i.test(text) &&
      cashSettlement;
  case 'paid_pilot':
    return /\bpaid pilot\b/i.test(text) &&
      /\b(?:accepted|completed|signed|started)\b/i.test(text) &&
      cashSettlement;
  case 'subscription_or_retainer':
    return /\b(?:retainer|subscription)s?\b/i.test(text) && (
      cashSettlement ||
      /\bpaid subscription order\b/i.test(text)
    ) && /\b(?:accepted|activated|paid|received|recorded|renewed|settled|signed|started)\b/i.test(
      text
    );
  case 'insurance_reimbursement':
    return /\b(?:claim|reimbursement)s?\b/i.test(text) && (
      /\bpaid claim\b/i.test(text) ||
      cashSettlement
    ) || /\breimbursed\b/i.test(text) &&
      /\b(?:appointment|booking|consultation|service|session|visit)s?\b/i.test(text);
  case 'license_or_royalty':
    return /\b(?:licen[cs]e|licensing|royalt(?:y|ies))\b/i.test(text) &&
      cashSettlement;
  case 'commission_or_referral':
    return /\b(?:affiliate|commission|referral fee)\b/i.test(text) &&
      cashSettlement;
  case 'sponsorship':
    return /\bsponsor(?:ship|ed)?\b/i.test(text) &&
      /\b(?:accepted|awarded|signed|won)\b/i.test(text) &&
      cashSettlement;
  case 'platform_payout':
    return /\b(?:ad revenue|creator|marketplace|platform)\b/i.test(text) &&
      /\b(?:payment|payout|revenue received)\b/i.test(text) &&
      cashSettlement;
  case 'compensated_role': {
    const acceptedOffer =
      /\b(?:compensated|compensation|employment|job) offer\b/i.test(text) &&
      /\b(?:accepted|signed)\b/i.test(text);
    const compensationSettlement =
      /\b(?:compensation|payroll|salary|wage) payment\b/i.test(text) &&
      cashSettlement;
    return acceptedOffer || compensationSettlement && (
      /\b(?:compensated|employment|job|payroll|role|salary|wage)\b/i.test(
        text
      )
    );
  }
  default:
    return false;
  }
}

function explicitlyContradictsAttribution(value) {
  return /\b(?:no attribution|no source (?:field|record)|not attributed|not recorded|unattributed|unknown source)\b/i.test(
    firstText(value)
  );
}

function explicitlyContradictsConversionDestination(value) {
  return /\b(?:destination unavailable|no conversion destination|no destination|not bookable|not available)\b/i.test(
    firstText(value)
  );
}

function explicitlyContradictsBoundedStop(value) {
  return /\b(?:indefinite|no (?:limit|stop)|unbounded|unlimited|without (?:a )?(?:limit|stop))\b/i.test(
    firstText(value)
  );
}

function countExactToken(value, token) {
  const text = firstText(value);
  if (!text || !token) return 0;
  return text.split(token).length - 1;
}

function discoveryPlanSensitiveTargetIssue(planValue) {
  const plan = asObject(planValue);
  const privateContactIssue = discoveryPlanPrivateContactIssue(plan);
  if (privateContactIssue) {
    return `Discovery plan ${firstText(plan.id)} requests private-contact data [${privateContactIssue}].`;
  }

  const directPersonTarget = compactStrings(
    ['professional_counterparty', 'local_organization'].includes(
      firstText(plan.searchMode)
    )
      ? asArray(plan.targetRoleTerms)
      : firstText(plan.searchMode) === 'active_job_posting'
        ? [plan.jobTitle, ...asArray(plan.skills)]
        : []
  ).join(' ');
  if (discoveryPlanTargetsSensitivePerson(directPersonTarget)) {
    return `Discovery plan ${firstText(plan.id)} uses a patient or sensitive-consumer trait as a direct role, title, or skill target.`;
  }

  const organizationTarget = compactStrings(
    ['professional_counterparty', 'local_organization'].includes(
      firstText(plan.searchMode)
    )
      ? asArray(plan.organizationTerms)
      : []
  ).join(' ');
  if (discoveryPlanTargetsSensitivePerson(organizationTarget)) {
    return `Discovery plan ${firstText(plan.id)} uses a patient or sensitive-consumer population as an organization target.`;
  }

  if (discoveryPlanTargetsSensitivePerson(plan.query) &&
      !discoveryPlanHasSafeReferralPopulationQuery(plan)) {
    return `Discovery plan ${firstText(plan.id)} targets a patient or sensitive consumer in its query.`;
  }
  return '';
}

/**
 * Contact safety has two separate trust boundaries. Literal contact values
 * are forbidden everywhere because no planner field may carry or persist
 * them. Contact-seeking prose is evaluated only where it can affect provider
 * discovery or the recommended acquisition route. Descriptive fields may
 * truthfully mention a paid phone service, phone attribution, or that private
 * contact data is not needed without granting search or execution authority.
 */
function discoveryPlanPrivateContactIssue(planValue) {
  const plan = asObject(planValue);
  let serialized = '';
  try {
    serialized = JSON.stringify(plan);
  } catch {
    return 'private_contact_value';
  }
  const textEntries = discoveryPlanTextEntries(plan);
  const textValues = textEntries.map((entry) => entry.value);
  if (!serialized || textEntries.some((entry) =>
    commercialDiscoveryContainsPrivateContact(entry.value, {
      allowBareCodePackage:
        discoveryPlanPathAllowsBareCodePackage(entry.path)
    })
  ) || discoveryPlanContainsPrivateContactKey(plan)) {
    return 'private_contact_value';
  }

  if (textValues.some(
    discoveryPlanExplicitlyRequestsPrivateContact
  )) {
    return 'private_contact_request';
  }

  const searchValues = compactStrings([
    plan.query,
    plan.market,
    ...asArray(plan.targetRoleTerms),
    ...asArray(plan.organizationTerms),
    plan.jobTitle,
    ...asArray(plan.skills)
  ]);
  if (searchValues.some(discoverySearchRequestsPrivateContact)) {
    return 'private_contact_route:search';
  }

  const bundle = asObject(plan.contingentFinalists);
  const routeValues = [plan.acquisitionMechanism];
  for (const familyKey of ['familyA', 'familyB']) {
    const family = asObject(bundle[familyKey]);
    const dimensions = asObject(family.d);
    routeValues.push(
      family.l,
      ...asArray(dimensions.c).map((item) => asObject(item).l),
      ...asArray(dimensions.a).map((item) => asObject(item).l),
      ...asArray(dimensions.r).map((item) => asObject(item).c)
    );
  }
  for (const tacticKey of ['tacticA', 'tacticB']) {
    const tactic = asObject(bundle[tacticKey]);
    routeValues.push(
      tactic.l,
      ...asArray(tactic.c).map((item) => asObject(item).l),
      ...asArray(tactic.a).map((item) => asObject(item).l)
    );
  }
  routeValues.push(
    ...asArray(asObject(bundle.pathBase).r)
      .map((item) => asObject(item).c)
  );
  if (compactStrings(routeValues).some(
    discoveryAcquisitionRequestsPrivateContact
  )) {
    return 'private_contact_route:acquisition';
  }
  return '';
}

function discoveryPlanTextEntries(value, output = [], path = []) {
  if (typeof value === 'string') {
    if (!discoveryPlanTextPathIsIdentifier(path)) {
      output.push({ value, path: [...path] });
    }
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      discoveryPlanTextEntries(item, output, path);
    }
    return output;
  }
  for (const [key, item] of Object.entries(asObject(value))) {
    discoveryPlanTextEntries(item, output, [...path, key]);
  }
  return output;
}

function discoveryPlanPathAllowsBareCodePackage(path) {
  return path.at(-1) === 'skills';
}

function discoveryPlanTextPathIsIdentifier(path) {
  const key = path.at(-1);
  const parent = path.at(-2);
  return [
    'contractVersion',
    'e',
    'evidenceRefs',
    'evidenceRefToken',
    'id',
    'seedContract',
    'tacticKey',
    'targetNameToken',
    'targetUrlToken'
  ].includes(key) ||
    parent === 'g' && ['a', 'b', 'c', 'o', 't'].includes(key);
}

function discoveryPlanContainsPrivateContactKey(value) {
  if (Array.isArray(value)) {
    return value.some(discoveryPlanContainsPrivateContactKey);
  }
  const record = asObject(value);
  return Object.entries(record).some(([key, item]) =>
    /^(?:work_email|mobile_phone|phone_numbers?)$/i.test(key) ||
    discoveryPlanContainsPrivateContactKey(item)
  );
}

function discoverySearchRequestsPrivateContact(value) {
  return discoveryPlanExplicitlyRequestsPrivateContact(value) ||
    discoveryContactPatternsRequest(value, [
      /\b(?:patient|consumer) lead lists?\b/g
    ]);
}

function discoveryAcquisitionRequestsPrivateContact(value) {
  if (discoveryPlanExplicitlyRequestsPrivateContact(value)) return true;
  const rawText = commercialDiscoveryContactInspectionText(value);
  const routeText = rawText.replace(/https?:\/\/\S+/gi, ' ');
  const routePhoneMatches = commercialDiscoveryPhoneLikeMatches(routeText);
  if (routePhoneMatches.some((match) =>
    !commercialDiscoveryNumberHasProductLabel(routeText, match.index) ||
    commercialDiscoveryLabeledNumberUsedAsContactRoute(routeText, match.index)
  )) {
    return true;
  }
  if ([...rawText.matchAll(/@[a-z0-9_][a-z0-9_.-]*/gi)].some(
    (match) => !commercialDiscoveryAtTokenIsCodePackage(
      rawText,
      match,
      false
    )
  )) {
    return true;
  }
  const unnormalizedRouteText = comparable(routeText);
  if (discoveryContactPatternsRequest(unnormalizedRouteText, [
    /\b(?:chat|connect|dm|inbox|message|ping|reach out)(?: [a-z0-9]+){0,8} (?:at|on|through|via) (?:linked in|linkedin) (?:public )?professional profile\b/g,
    /\b(?:ask|invite|request)(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person)(?: [a-z0-9]+){0,3} to connect(?: [a-z0-9]+){0,3} on (?:linked in|linkedin) (?:public )?professional profile\b/g
  ])) {
    return true;
  }
  const text = unnormalizedRouteText
    .replace(
      /\b(?:linked in|linkedin) (?:public )?professional profile\b/g,
      ' public professional profile '
    )
    .replace(
      /\bpublic professional profile (?:at|on) (?:linked in|linkedin)\b/g,
      ' public professional profile '
    )
    .replace(/\b(?:consultation|session|service|support|care|visit|interview|meeting) (?:at|by|on|over|through|via) (?:phone|telephone)\b/g, ' service modality ')
    .replace(/\b(?:phone|telephone) (?:care|consultation|interview|meeting|service|session|support|visit)\b/g, ' service modality ');
  const medium = '(?:call|calling|contacts|direct message|discord|dm|doximity|e mail|e mails|ehr(?: secure)? messaging|electronic mail|email|emails|epic|facebook messenger|fax|gmail|inbox|inmail|linked in|linkedin|mail|mychart|office line|outlook(?: inbox)?|patient portal|phone|phones|portal|postal (?:letter|mail)|secure messaging|signal|slack|sms|teams|telegram|telephone|telephones|text message|voice mail|voice message|voicemail|wechat|whatsapp)';
  const commercialVerb = '(?:apply|ask|bid|chat|communicate|connect|contact|dm|drop|engage|fax|inbox|invite|introduce|leave|message|notify|offer|page|ping|propose|reach|recommend|refer|request|respond|send|shoot|start|submit|write)';
  const targetObject = '(?:target|target name|candidate|buyer|partner|professional|person)';
  return discoveryContactPatternsRequest(text, [
    new RegExp(
      `\\b(?:at|by|in|on|over|through|to|using|via)(?: an?| her| his| their| the)? ${medium}\\b(?= (?:address|and|for|to|with)\\b|$)`,
      'g'
    ),
    new RegExp(
      `\\b${commercialVerb}(?: [a-z0-9]+){0,8} (?:at|by|in|on|over|through|to|using|via)(?: an?| her| his| their| the)? ${medium}\\b`,
      'g'
    ),
    new RegExp(
      `\\b(?:at|by|in|on|over|through|to|using|via)(?: an?| her| his| their| the)? ${medium}(?: and)?(?: to| for)? ${commercialVerb}\\b`,
      'g'
    ),
    new RegExp(
      '\\b(?:call|dial|dm|email|fax|inmail|mail|page|phone|sms|telephone|text message|text|wechat|whatsapp)(?: (?:a|an|the|one|reviewed|review first|referral|partner|paid|booking|proposal|request)){0,5}(?: to)? (?:target|target name|candidate|buyer|partner|professional|person)\\b',
      'g'
    ),
    new RegExp(
      `\\b(?:use|using)(?: an?| her| his| target| their| the)? ${medium} (?:as|for|to)\\b`,
      'g'
    ),
    new RegExp(
      `\\bsend(?: an?| the)? ${medium} (?:to|through|via)\\b`,
      'g'
    ),
    new RegExp(
      `\\b${medium} (?:channel|contact|message|outreach|request|route)\\b`,
      'g'
    ),
    new RegExp(
      `\\b(?:drop|leave|mail|message|send|shoot|write)(?: an?| the)? ${targetObject}(?: an?| the| one| reviewed)? (?:${medium}|letter|note)(?: (?:letter|message|note|proposal|request))?\\b`,
      'g'
    ),
    /\b(?:send|use|using) (?:direct message|electronic mail|gmail|outlook(?: inbox)?|postal (?:letter|mail)|signal|telegram|voice mail|voicemail|whatsapp)\b/g,
    /\b(?:send|use|using)(?: an?| the)? (?:inmail|linked in inmail|linkedin inmail)\b/g,
    /\b(?:send|use|using)(?: an?| the)? (?:linked in|linkedin) (?:connection request|message|note)\b/g,
    /\b(?:direct message|dm|fax|inmail|page|signal|telegram|wechat|whatsapp) (?:target|target name|candidate|buyer|partner|professional|person)\b/g,
    /\b(?:leave|send)(?: [a-z0-9]+){0,8} (?:a |an |the )?(?:direct message|text message|voice mail|voice message|voicemail)\b/g,
    /\b(?:drop|shoot)(?: [a-z0-9]+){0,8} (?:a |an |the )?(?:e mail|email)\b/g,
    /\b(?:mail|post|send|write)(?: [a-z0-9]+){0,8} (?:a |an |the )?postal (?:letter|mail)\b/g,
    /\b(?:mail|post|send|write)(?: an?| the)?(?: reviewed)? letter(?: [a-z0-9]+){0,5} (?:for|to) (?:target|target name|candidate|buyer|partner|professional|person)\b/g,
    /\b(?:mail|post|send|write)(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person)(?: an?| the)? letter\b/g,
    /\b(?:call|dial|phone|ring|telephone)(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person)\b/g,
    /\b(?:call|dial|phone|ring|telephone)(?: an?| her| his| target| their| the)? (?:clinic|office|practice|telephone|line|number)\b/g,
    /\b(?:give|place)(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person) (?:a |one )?call\b/g,
    /\b(?:call|dial|phone|ring|telephone) up(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person)\b/g,
    /\b(?:call|dial|phone|ring|telephone)(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person) up\b/g,
    /\b(?:give|place)(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person) (?:a |one )?ring\b/g,
    /\b(?:start|open)(?: an?| the)? (?:discord|linked in|linkedin|slack|teams|telegram|wechat|whatsapp) chat(?: [a-z0-9]+){0,4} (?:target|target name|candidate|buyer|partner|professional|person)\b/g,
    /\b(?:message|reach)(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person)(?: [a-z0-9]+){0,3} by calling(?: an?| her| his| target| their| the)? (?:clinic|office|practice|line|number)\b/g,
    /\b(?:ask|invite|request)(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person)(?: [a-z0-9]+){0,3} on(?: an?| the)? call\b/g,
    /\b(?:ask|invite|request)(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person)(?: [a-z0-9]+){0,3} to connect(?: [a-z0-9]+){0,3} on (?:linked in|linkedin)\b/g,
    /\bdeliver(?: an?| the)?(?: reviewed)? letter(?: [a-z0-9]+){0,5} to (?:target|target name|candidate|buyer|partner|professional|person)\b/g,
    /\binbox(?: an?| the)? (?:target|target name|candidate|buyer|partner|professional|person)(?: [a-z0-9]+){0,3} (?:linked in|linkedin)\b/g,
    /\bdial(?: an?| the)? office line\b/g,
    /\buse(?: an?| the)? target (?:e mail|email) list\b/g
  ]);
}

function discoveryContactPatternsRequest(value, expressions) {
  const text = comparable(value);
  for (const expression of expressions) {
    for (const match of text.matchAll(expression)) {
      if (!privateContactMatchIsExplicitlyDenied(
        text,
        match.index,
        match.index + match[0].length
      )) {
        return true;
      }
    }
  }
  return false;
}

function discoveryPlanExplicitlyRequestsPrivateContact(value) {
  const text = comparable(value);
  const contactObject =
    '(?:private|personal|direct|work) (?:e mails?|emails?)|(?:e mail|email) address(?:es)?|(?:private|personal|direct) phones?|(?:mobile|cell) phone numbers?|phone numbers?|home address(?:es)?|private contacts?|contact (?:details|directory|information|lists?)|lead lists?';
  const retrieval =
    '(?:find|get|look up|lookup|obtain|collect(?:ing)?|scrap(?:e|ing)|enrich(?:ing)?|sourc(?:e|ing)|retriev(?:e|ing)|return|identify|discover|search for|request|send|use|using|need|require)';
  const expressions = [
    new RegExp(`\\b${retrieval}(?: [a-z0-9]+){0,6} (?:${contactObject})\\b`, 'g'),
    new RegExp(`\\b(?:${contactObject})(?: [a-z0-9]+){0,4} (?:lookup|search|scrape|enrichment|retrieval|collection)\\b`, 'g'),
    new RegExp(`\\b(?:${contactObject})(?: [a-z0-9]+){0,3} (?:needed|required|requested|collected|returned|searched|used)\\b`, 'g')
  ];
  for (const expression of expressions) {
    for (const match of text.matchAll(expression)) {
      if (!privateContactMatchIsExplicitlyDenied(
        text,
        match.index,
        match.index + match[0].length
      )) {
        return true;
      }
    }
  }
  return false;
}

function privateContactMatchIsExplicitlyDenied(text, start, end) {
  const prefix = text.slice(Math.max(0, start - 96), start);
  const match = text.slice(start, end);
  const suffix = text.slice(end, Math.min(text.length, end + 72));
  const plainNotBefore = /\bnot $/.test(prefix) &&
    !/\breason not $/.test(prefix);
  const deniedBefore =
    /\b(?:do not|does not|don t)(?: ever| need to)? $/.test(prefix) ||
    /\bnever $/.test(prefix) || plainNotBefore ||
    /\b(?:avoid|avoids|avoiding|exclude|excludes|excluding|omit|omits|omitting|without)(?: any| the)? $/.test(prefix) ||
    /\bno(?: need)?(?: for| to)?(?: any| the)? $/.test(prefix);
  const deniedInside =
    /\b(?:do not|does not|don t|never|no|not|without)\b(?: [a-z0-9]+){0,4} (?:collect|find|get|need|obtain|request|require|return|search|use)\w*\b/.test(
      match
    ) ||
    /\b(?:are|is|were|was) (?:never |not )(?:authorized|collected|needed|permitted|required|requested|returned|searched|used)\b/.test(
      match
    );
  const deniedAfter =
    /^ (?:are|is|were|was) (?:never |not )(?:authorized|collected|needed|permitted|required|requested|returned|searched|used)\b/.test(
      suffix
    );
  return deniedBefore || deniedInside || deniedAfter;
}

function discoveryPlanTargetsSensitivePerson(value) {
  const text = comparable(value);
  const boundedText = ` ${text} `;
  return discoveryPlanSensitivePopulationPhrases().some((phrase) =>
    boundedText.includes(` ${phrase.join(' ')} `)
  );
}

function discoveryPlanHasSafeReferralPopulationQuery(planValue) {
  const plan = asObject(planValue);
  const slot = asObject(plan.targetSlot);
  if (firstText(plan.commercialRole) !== 'referral_partner' ||
      !['professional_counterparty', 'local_organization'].includes(
        firstText(plan.searchMode)
      ) ||
      !['person', 'organization'].includes(firstText(slot.finalTargetKind))) {
    return false;
  }
  if (plan.searchMode === 'professional_counterparty' &&
      slot.finalTargetKind !== 'person') {
    return false;
  }

  const queryTokens = comparable(plan.query).split(' ').filter(Boolean);
  const sensitiveSpans = [];
  for (let index = 0; index < queryTokens.length; index += 1) {
    for (const phrase of discoveryPlanSensitivePopulationPhrases()) {
      if (discoveryPlanTokenSequenceAt(queryTokens, index, phrase)) {
        sensitiveSpans.push({start: index, end: index + phrase.length});
        break;
      }
    }
  }
  if (sensitiveSpans.length === 0) return false;

  const declaredTargetTokens = discoveryProfessionalAnchorTokens(
    compactStrings([
      ...asArray(plan.targetRoleTerms),
      ...asArray(plan.organizationTerms)
    ]).join(' ')
  );
  if (declaredTargetTokens.size === 0) return false;
  const serviceRelations = [
    ['serve'], ['serves'], ['served'], ['serving'],
    ['treat'], ['treats'], ['treated'], ['treating'],
    ['support'], ['supports'], ['supported'], ['supporting'],
    ['care', 'for'], ['cares', 'for'], ['cared', 'for'],
    ['caring', 'for'], ['provide', 'care', 'for'],
    ['provides', 'care', 'for'], ['provided', 'care', 'for'],
    ['providing', 'care', 'for'], ['provide', 'care', 'to'],
    ['provides', 'care', 'to'], ['provided', 'care', 'to'],
    ['providing', 'care', 'to']
  ];
  const sensitiveDemandTerms = new Set([
    'seeking', 'looking', 'needing', 'need', 'needs', 'wanting',
    'wants', 'interested', 'buying', 'purchase', 'purchasing',
    'lead', 'leads', 'list', 'lists'
  ]);
  const usedRelations = new Set();
  for (const sensitive of sensitiveSpans) {
    for (let index = sensitive.end; index < Math.min(
      queryTokens.length,
      sensitive.end + 4
    ); index += 1) {
      if (sensitiveDemandTerms.has(queryTokens[index])) return false;
    }

    let matchedRelation = -1;
    for (let relationStart = sensitive.start - 1;
      relationStart >= Math.max(0, sensitive.start - 7);
      relationStart -= 1) {
      if (usedRelations.has(relationStart)) continue;
      for (const phrase of serviceRelations) {
        if (!discoveryPlanTokenSequenceAt(
          queryTokens,
          relationStart,
          phrase
        ) || relationStart + phrase.length > sensitive.start ||
          sensitive.start - (relationStart + phrase.length) > 3) {
          continue;
        }
        const professionalPrefixTokens =
          discoveryProfessionalAnchorTokens(queryTokens.slice(
            Math.max(0, relationStart - 8),
            relationStart
          ).join(' '));
        if ([...declaredTargetTokens].some((token) =>
          professionalPrefixTokens.has(token)
        )) {
          matchedRelation = relationStart;
          break;
        }
      }
      if (matchedRelation >= 0) break;
    }
    if (matchedRelation < 0) return false;
    usedRelations.add(matchedRelation);
  }
  return true;
}

function discoveryPlanSensitivePopulationPhrases() {
  return [
    ['patient'], ['patients'],
    ['pregnant', 'person'], ['pregnant', 'people'],
    ['pregnant', 'woman'], ['pregnant', 'women'],
    ['postpartum', 'parent'], ['postpartum', 'parents'],
    ['postpartum', 'mother'], ['postpartum', 'mothers'],
    ['new', 'mother'], ['new', 'mothers'],
    ['breastfeeding', 'mother'], ['breastfeeding', 'mothers'],
    ['health', 'condition'], ['health', 'conditions'],
    ['medical', 'condition'], ['medical', 'conditions'],
    ['family', 'status']
  ];
}

function discoveryPlanTokenSequenceAt(tokens, start, sequence) {
  if (start < 0 || sequence.length === 0 ||
      start + sequence.length > tokens.length) {
    return false;
  }
  return sequence.every((token, index) => tokens[start + index] === token);
}

function discoveryProfessionalAnchorTokens(value) {
  const generic = new Set([
    'authority', 'business', 'care', 'company', 'current', 'decision',
    'director', 'local', 'manager', 'nearby', 'organization', 'owner',
    'partner', 'person', 'professional', 'provider', 'referral', 'service',
    'services', 'serving', 'support'
  ]);
  const tokens = comparable(value).split(' ')
    .filter((token) => token.length > 3 && !generic.has(token))
    .map(discoveryProfessionalAnchorToken);
  return new Set(tokens.filter(Boolean));
}

function discoveryProfessionalAnchorToken(value) {
  if (/ies$/.test(value) && value.length > 5) {
    return `${value.slice(0, -3)}y`;
  }
  if (/s$/.test(value) && !/ss$/.test(value) && value.length > 4) {
    return value.slice(0, -1);
  }
  return value;
}

function normalizeOpportunityDiscoveryWebSearchReceipt(value) {
  const raw = asObject(value);
  const annotationsInput = asArray(raw.annotations);
  const annotations = [];
  const seenURLs = new Set();
  for (const annotationValue of annotationsInput.slice(
    0,
    OPPORTUNITY_DISCOVERY_WEB_SEARCH_MAX_RESULTS
  )) {
    const annotation = asObject(annotationValue);
    const citation = firstText(annotation.type) === 'url_citation'
      ? asObject(annotation.url_citation)
      : annotation;
    const url = safePublicHTTPSURL(citation.url);
    // Search snippets often include a practice or employer's public contact
    // details beside an otherwise useful professional fact. Strip those
    // tokens before truncation, hashing, or persistence so the safe remainder
    // survives without ever retaining the raw contact value.
    const title = truncate(
      redactCommercialDiscoveryContactTokens(citation.title),
      180
    );
    const content = truncate(
      redactCommercialDiscoveryContactTokens(citation.content),
      700
    );
    if (!url || !title || !content ||
        seenURLs.has(comparableURL(url)) ||
        commercialDiscoveryContainsPrivateContact(title) ||
        commercialDiscoveryContainsPrivateContact(content)) {
      continue;
    }
    seenURLs.add(comparableURL(url));
    const contentHash = rawSHA256(content);
    annotations.push({
      id: `citation:${stableHash([
        comparableURL(url),
        title,
        contentHash
      ]).slice(0, 24)}`,
      url,
      title,
      content,
      contentHash
    });
  }
  return {
    contractVersion: OPPORTUNITY_DISCOVERY_WEB_SEARCH_CONTRACT,
    provider: OPPORTUNITY_DISCOVERY_WEB_SEARCH_PROVIDER,
    operation: OPPORTUNITY_DISCOVERY_WEB_SEARCH_OPERATION,
    engine: OPPORTUNITY_DISCOVERY_WEB_SEARCH_ENGINE,
    requestHash: /^[a-f0-9]{64}$/i.test(firstText(raw.requestHash))
      ? firstText(raw.requestHash).toLowerCase()
      : '',
    maxResults: OPPORTUNITY_DISCOVERY_WEB_SEARCH_MAX_RESULTS,
    fixedFeeMicros:
      OPPORTUNITY_DISCOVERY_WEB_SEARCH_FIXED_FEE_MICROS,
    injectedContextTokenReserve:
      OPPORTUNITY_DISCOVERY_WEB_SEARCH_CONTEXT_TOKEN_RESERVE,
    attempted: raw.attempted === true,
    resultCount: annotations.length,
    estimatedSpendMicros:
      OPPORTUNITY_DISCOVERY_WEB_SEARCH_FIXED_FEE_MICROS,
    actualSpendMicros: 0,
    costIncludedInLLMReceipt: true,
    includedSpendMicros: raw.attempted === true
      ? OPPORTUNITY_DISCOVERY_WEB_SEARCH_FIXED_FEE_MICROS
      : 0,
    creditsUsed: raw.attempted === true ? 1 : 0,
    observedAt: validISOString(raw.observedAt),
    annotations
  };
}

function opportunityDiscoveryWebSearchReceiptIssue(value) {
  const receipt = asObject(value);
  if (receipt.contractVersion !==
        OPPORTUNITY_DISCOVERY_WEB_SEARCH_CONTRACT ||
      receipt.provider !== OPPORTUNITY_DISCOVERY_WEB_SEARCH_PROVIDER ||
      receipt.operation !== OPPORTUNITY_DISCOVERY_WEB_SEARCH_OPERATION ||
      receipt.engine !== OPPORTUNITY_DISCOVERY_WEB_SEARCH_ENGINE ||
      !/^[a-f0-9]{64}$/.test(firstText(receipt.requestHash)) ||
      receipt.maxResults !== OPPORTUNITY_DISCOVERY_WEB_SEARCH_MAX_RESULTS ||
      receipt.fixedFeeMicros !==
        OPPORTUNITY_DISCOVERY_WEB_SEARCH_FIXED_FEE_MICROS ||
      receipt.injectedContextTokenReserve !==
        OPPORTUNITY_DISCOVERY_WEB_SEARCH_CONTEXT_TOKEN_RESERVE ||
      receipt.attempted !== true ||
      receipt.estimatedSpendMicros !==
        OPPORTUNITY_DISCOVERY_WEB_SEARCH_FIXED_FEE_MICROS ||
      receipt.actualSpendMicros !== 0 ||
      receipt.costIncludedInLLMReceipt !== true ||
      receipt.includedSpendMicros !==
        OPPORTUNITY_DISCOVERY_WEB_SEARCH_FIXED_FEE_MICROS ||
      receipt.creditsUsed !== 1 ||
      !validISOString(receipt.observedAt) ||
      receipt.resultCount !== asArray(receipt.annotations).length ||
      receipt.resultCount > OPPORTUNITY_DISCOVERY_WEB_SEARCH_MAX_RESULTS) {
    return 'The forced Exa web-search receipt failed its exact accounting or request-binding contract.';
  }
  const ids = new Set();
  const urls = new Set();
  for (const annotationValue of asArray(receipt.annotations)) {
    const annotation = asObject(annotationValue);
    const url = safePublicHTTPSURL(annotation.url);
    if (!/^citation:[a-f0-9]{24}$/.test(firstText(annotation.id)) ||
        !url || !firstText(annotation.title) ||
        !firstText(annotation.content) ||
        commercialDiscoveryContainsPrivateContact(annotation.title) ||
        commercialDiscoveryContainsPrivateContact(annotation.content) ||
        !/^[a-f0-9]{64}$/.test(firstText(annotation.contentHash)) ||
        rawSHA256(firstText(annotation.content)) !== annotation.contentHash ||
        ids.has(annotation.id) || urls.has(comparableURL(url))) {
      return 'The forced Exa web-search receipt retained an invalid or duplicate public citation.';
    }
    ids.add(annotation.id);
    urls.add(comparableURL(url));
  }
  return '';
}

function safePublicHTTPSURL(value) {
  const url = safePublicURL(value);
  if (!url) return '';
  try {
    return new URL(url).protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

function rawSHA256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
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
export async function runOpportunityTournament(args) {
  const rawResult = await runOpportunityTournamentCore(args);
  return finalizeOpportunityTournamentResult(rawResult, args);
}

async function runOpportunityTournamentCore({
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
  const commercialContext = normalizeCommercialContext(
    payload,
    objective,
    constraints
  );
  const priorOutcomes = normalizePriorOutcomes([
    ...asArray(payload.priorOutcomes),
    ...asArray(asObject(payload.commercialContext).priorAttributedOutcomes)
  ]);
  const commercialDiscovery = normalizeCommercialDiscoveryEvidence(
    payload.commercialDiscoveryEvidence,
    now
  );
  const includeSystemAttributionCapability =
    firstText(
      asObject(asObject(payload.commercialDiscoveryEvidence).plan)
        .contractVersion
    ) === OPPORTUNITY_DISCOVERY_PLAN_CONTRACT;
  const discoveryPlanSupplyEvidenceCatalog =
    commercialDiscovery.plan?.present === true
      ? buildEvidenceCatalog(payload, context, now, {
          commercialDiscovery: {
            present: false,
            valid: false,
            evidence: [],
            candidates: []
          },
          includeSystemAttributionCapability
        })
      : [];
  const proposedCommercialMotions = normalizeProposedCommercialMotions(
    commercialDiscovery.plan,
    discoveryPlanSupplyEvidenceCatalog
  );
  const evidenceCatalog = buildEvidenceCatalog(
    payload,
    context,
    now,
    { commercialDiscovery, includeSystemAttributionCapability }
  );
  let promptEvidenceCatalog = compactPromptEvidenceCatalog(
    evidenceCatalog,
    objective,
    now
  );
  let providerValidationEvidenceCatalog = promptEvidenceCatalog
    .filter((item) => !/^source:/i.test(firstText(item.id)))
    .map((item) => ({
      ...item,
      aliases: []
    }));
  let promptEvidenceHash = stableHash(promptEvidenceCatalog);
  const evidenceHash = stableHash(evidenceCatalog);
  const timestamp = validDate(now).toISOString();
  const commercialEvidenceGraph = buildCommercialEvidenceGraph(
    evidenceCatalog,
    {
      commercialContext,
      priorOutcomes,
      objective,
      constraints
    }
  );
  const commercialEvidenceGraphHash = stableHash(
    commercialEvidenceGraph
  );
  let promptCommercialEvidenceGraph =
    projectCommercialEvidenceGraphForPrompt(
      commercialEvidenceGraph,
      promptEvidenceCatalog
    );
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
    commercialEvidenceGraph,
    commercialEvidenceGraphHash,
    searchSpace: {
      ...emptySearchSpace(budget),
      evidenceCatalogCount: evidenceCatalog.length,
      commercialDiscoveryEvidenceCount:
        commercialDiscovery.evidence.length,
      commercialDiscoveryCandidateCount:
        commercialDiscovery.candidates.length,
      proposedCommercialMotionCount:
        proposedCommercialMotions.motions.length,
      promptEvidenceCount: promptEvidenceCatalog.length,
      promptEvidenceOmittedCount: Math.max(
        0,
        evidenceCatalog.length - promptEvidenceCatalog.length
      ),
      promptEvidenceHash
    },
    gate: researchOnlyGate('redefine_objective', 'The win objective needs clarification.'),
    usage: emptyUsage(model, budget),
    llm: {},
    trace: {
      objective: 'Select one source-grounded professional opportunity.',
      world: 'Authorized ProfileScribe profile, source evidence, prior outcomes, and explicit constraints.',
      probe: 'Generate compact strategy dimensions and judge a deterministic expansion.',
      memory: 'Return attributable hypotheses and evidence references to ProfileScribe.',
      commercialDiscovery:
        commercialDiscoveryPublicTrace(commercialDiscovery),
      proposedCommercialMotions:
        projectProposedCommercialMotionsForPrompt(
          proposedCommercialMotions,
          evidenceCatalog
        ),
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
      generatedExperiment: generatedEvidenceExperiment,
      commercialContext,
      commercialEvidenceGraph
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

  const contingentFinalists =
    materializeContingentFinalistsFromDiscovery({
      commercialDiscovery,
      evidenceCatalog,
      referenceTime: timestamp
    });
  const hasV2ContingentPlan =
    commercialDiscovery.plan?.present === true &&
    firstText(commercialDiscovery.plan.contractVersion) ===
      OPPORTUNITY_DISCOVERY_PLAN_CONTRACT;
  const useContingentFinalists = contingentFinalists.valid === true;
  base.trace.contingentFinalists = contingentFinalists.trace;
  base.searchSpace.contingentFinalistSource = useContingentFinalists
    ? 'discovery_planner_call_1'
    : 'not_materialized';
  const currentAlgorithm =
    algorithmVersion === OPPORTUNITY_TOURNAMENT_ALGORITHM_VERSION;
  const explicitLegacyAlgorithm =
    LEGACY_OPPORTUNITY_TOURNAMENT_ALGORITHM_VERSIONS.has(
      algorithmVersion
    );
  if (!currentAlgorithm && !explicitLegacyAlgorithm) {
    return {
      status: 'skipped',
      summary:
        'The opportunity tournament algorithm version is unsupported; no provider call was made.',
      ...base,
      nextExperiment: null,
      searchSpace: {
        ...base.searchSpace,
        modelCalls: 0,
        contingentFinalists: contingentFinalists.trace
      },
      gate: researchOnlyGate(
        'technical_recovery',
        'Only the current v6 outside-target workflow or the explicit v5 replay path is recognized.'
      )
    };
  }
  if (currentAlgorithm && !hasV2ContingentPlan) {
    return {
      status: 'skipped',
      summary:
        'The v6 tournament requires a valid, source-bindable outside-target discovery plan before recommendation.',
      ...base,
      nextExperiment: null,
      searchSpace: {
        ...base.searchSpace,
        modelCalls: 0,
        contingentFinalists: contingentFinalists.trace
      },
      gate: researchOnlyGate(
        'technical_recovery',
        'The current algorithm cannot fall back to the legacy generator or an owned-asset-only winner when opportunity_discovery_plan_v2 is absent.'
      )
    };
  }
  if (hasV2ContingentPlan && !useContingentFinalists) {
    const technicalFailure = [
      'provider_unavailable',
      'provider_failed',
      'invalid_discovery_envelope',
      'invalid_contingent_contract',
      'target_source_binding_failed',
      'exact_target_not_found'
    ].includes(firstText(contingentFinalists.cause));
    return {
      status: 'skipped',
      summary: technicalFailure
        ? 'The bounded outside-discovery or contingent-finalist contract could not be completed safely.'
        : 'The completed bounded outside search found no exact public target for the selected commercial motion.',
      ...base,
      nextExperiment: null,
      searchSpace: {
        ...base.searchSpace,
        modelCalls: 0,
        contingentFinalists: contingentFinalists.trace
      },
      gate: researchOnlyGate(
        technicalFailure
          ? 'technical_recovery'
          : 'technical_recovery',
        technicalFailure
          ? firstText(
              contingentFinalists.reason,
              'Outside discovery failed its exact provider or contract boundary.'
            )
          : firstText(
              contingentFinalists.reason,
              'The target result could not be classified safely.'
            )
      )
    };
  }

  const initialEnvelope = boundedStrategyGenerationRequest({
    objective,
    constraints,
    commercialContext,
    evidenceCatalog,
    initialPromptEvidenceCatalog: promptEvidenceCatalog,
    commercialEvidenceGraph,
    proposedCommercialMotions,
    priorOutcomes,
    model,
    budget,
    referenceTime: now,
    maxSeedsPerDimension: Math.min(4, MAX_SEEDS_PER_DIMENSION)
  });
  promptEvidenceCatalog = initialEnvelope.promptEvidenceCatalog;
  providerValidationEvidenceCatalog = promptEvidenceCatalog
    .filter((item) => !/^source:/i.test(firstText(item.id)))
    .map((item) => ({
      ...item,
      aliases: []
    }));
  promptEvidenceHash = stableHash(promptEvidenceCatalog);
  promptCommercialEvidenceGraph =
    initialEnvelope.promptCommercialEvidenceGraph;
  const promptProposedCommercialMotions =
    initialEnvelope.promptProposedCommercialMotions;
  base.searchSpace.promptEvidenceCount = promptEvidenceCatalog.length;
  base.searchSpace.promptEvidenceOmittedCount = Math.max(
    0,
    evidenceCatalog.length - promptEvidenceCatalog.length
  );
  base.searchSpace.promptEvidenceHash = promptEvidenceHash;
  base.searchSpace.providerPromptEnvelope =
    initialEnvelope.providerPromptEnvelope;
  const prompt = initialEnvelope.prompt;
  const promptHash = stableHash({ system: prompt.system, user: prompt.user });
  const initialCompletionRequest = initialEnvelope.request;
  const initialProviderSpendPreflight = initialEnvelope.preflight;
  const initialCallSpendCeilingMicros =
    initialProviderSpendPreflight.callSpendCeilingMicros;
  const initialProviderEnvelopeIssue =
    providerPromptEnvelopeIssue(initialProviderSpendPreflight);
  if (!useContingentFinalists && initialProviderEnvelopeIssue) {
    const serializationFailure =
      initialProviderEnvelopeIssue ===
        'provider_request_serialization';
    return {
      status: 'skipped',
      summary: serializationFailure
        ? 'The bounded strategy-generation request could not be serialized safely, so no provider call was made.'
        : 'The bounded strategy-generation request exceeded the internal provider prompt envelope, so no provider call was made.',
      ...base,
      nextExperiment: nextExperimentFor([
        initialProviderEnvelopeIssue
      ]),
      searchSpace: {
        ...base.searchSpace,
        modelCalls: 0,
        providerPromptEnvelope: {
          ...initialEnvelope.providerPromptEnvelope,
          authorized: false,
          cause: initialProviderEnvelopeIssue,
          requestBodyByteCount:
            initialProviderSpendPreflight.requestBodyByteCount,
          maxRequestBodyByteCount: MAX_PROVIDER_REQUEST_BODY_BYTES
        }
      },
      gate: researchOnlyGate(
        'block',
        serializationFailure
          ? 'The exact structured request failed local serialization.'
          : 'The exact structured request did not fit the bounded provider prompt envelope.'
      )
    };
  }
  if (!useContingentFinalists && budget.hardStop &&
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
    completion = useContingentFinalists
      ? {
          data: contingentFinalists.data,
          diagnostics: {
            finishReason: 'planner_materialized',
            nativeFinishReason: 'planner_materialized'
          }
        }
      : await completeJSON(initialCompletionRequest);
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
        purpose: 'opportunity_tournament_strategy_generation',
        structuredOutputContract: TOURNAMENT_GENERATOR_CONTRACT,
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
        purpose: 'opportunity_tournament_strategy_generation',
        structuredOutputContract: TOURNAMENT_GENERATOR_CONTRACT,
        status: 'failed',
        usage: initialTruncationError?.openRouterUsage,
        generationId: initialTruncationError?.openRouterGenerationId,
        diagnostics: initialTruncationError?.openRouterDiagnostics,
        promptHash,
        error: 'openrouter_truncated_structured_output'
      })
    : openRouterMetadata({
        model,
        purpose: 'opportunity_tournament_strategy_generation',
        structuredOutputContract: TOURNAMENT_GENERATOR_CONTRACT,
        status: initialCompletionTruncated ? 'incomplete' : 'completed',
        usage: completion?.usage,
        generationId: completion?.generationId,
        diagnostics: completion?.diagnostics,
        promptHash,
        error: initialCompletionTruncated
          ? 'openrouter_truncated_structured_output'
          : undefined
      });
  const providerMetadataEntries = useContingentFinalists
    ? []
    : [providerMetadata];
  const llmTrace = useContingentFinalists
    ? {
        contingentFinalistGenerator: {
          provider: 'openrouter',
          purpose: 'opportunity_tournament_contingent_generation',
          structuredOutputContract:
            OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'completed_upstream',
          source: 'discovery_planner_call_1',
          motionId: firstText(contingentFinalists.motionId),
          targetCandidateId: firstText(contingentFinalists.candidateId),
          motionIds: compactStrings(contingentFinalists.motionIds),
          targetCandidateIds: compactStrings(
            contingentFinalists.candidateIds
          ),
          usageIncludedByControlPlane: true
        }
      }
    : {
        strategyGeneratorJudge: providerMetadata
      };
  const initialPromptTokenCanary = useContingentFinalists
    ? {
        withinCeiling: true,
        source: 'upstream_planner_receipt'
      }
    : providerPromptTokenCanary(
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
    useContingentFinalists
      ? evidenceCatalog.filter((item) =>
          !/^source:/i.test(firstText(item.id))
        )
      : providerValidationEvidenceCatalog,
    timestamp
  );
  const activeValidationEvidenceCatalog = useContingentFinalists
    ? evidenceCatalog.filter((item) =>
        !/^source:/i.test(firstText(item.id))
      )
    : providerValidationEvidenceCatalog;
  generatedEvidenceExperiment = rehydrateGeneratedExperimentAsset(
    normalizeGeneratedEvidenceExperiment(
      completion?.data?.evidenceExperiment,
      providerValidationEvidenceCatalog,
      timestamp
    ),
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
    authorized: !useContingentFinalists && budget.maxLLMCalls >= 2,
    attempted: false,
    succeeded: false,
    initialIssue: initialShapeIssue?.code || '',
    initialSeedContract: firstText(seedSet.seedContract),
    initialFamilyWrapperCount:
      nonNegativeInteger(seedSet.familyWrapperCount) || 0,
    initialValidStrategyFamilyCount:
      nonNegativeInteger(seedSet.validStrategyFamilyCount) || 0,
    initialCallSpendCeilingMicros: useContingentFinalists
      ? 0
      : initialCallSpendCeilingMicros,
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
      const repairProviderEnvelopeIssue =
        providerPromptEnvelopeIssue(repairProviderSpendPreflight);
      if (repairProviderEnvelopeIssue) {
        const serializationFailure =
          repairProviderEnvelopeIssue ===
            'provider_request_serialization';
        structuredRepair.failure = serializationFailure
          ? 'repair_request_serialization_failed'
          : 'repair_prompt_envelope_exceeded';
        structuredRepair.finalIssue = initialShapeIssue.code;
        return {
          status: 'skipped',
          summary: serializationFailure
            ? 'The bounded strategy repair could not be serialized safely, so no repair call was made.'
            : 'The bounded strategy repair exceeded the internal provider prompt envelope, so no repair call was made.',
          ...base,
          nextExperiment: nextExperimentFor([
            repairProviderEnvelopeIssue
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
            serializationFailure
              ? 'The one permitted repair request failed local serialization.'
              : 'The one permitted repair request did not fit the bounded provider prompt envelope.'
          )
        };
      }
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
          purpose: 'opportunity_tournament_structured_repair',
          structuredOutputContract: TOURNAMENT_GENERATOR_CONTRACT,
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
        purpose: 'opportunity_tournament_structured_repair',
        structuredOutputContract: TOURNAMENT_GENERATOR_CONTRACT,
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
        providerValidationEvidenceCatalog,
        timestamp
      );
      const repairedEvidenceExperiment =
        rehydrateGeneratedExperimentAsset(
          normalizeGeneratedEvidenceExperiment(
            repairCompletion?.data?.evidenceExperiment,
            providerValidationEvidenceCatalog,
            timestamp
          ),
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
  if (useContingentFinalists && terminalStructuredIssue) {
    structuredRepair.failure = 'upstream_contingent_contract_incomplete';
    structuredRepair.finalIssue = terminalStructuredIssue.code;
    return {
      status: 'skipped',
      summary:
        'The first AI stage did not preserve two complete source-bindable commercial finalists.',
      ...base,
      nextExperiment: null,
      llm: llmTrace,
      usage,
      searchSpace: {
        ...base.searchSpace,
        ...seedSetShapeSearchTrace(seedSet),
        modelCalls: usage.calls,
        structuredRepair
      },
      gate: researchOnlyGate(
        'technical_recovery',
        'The v2 contingent finalist contract was incomplete after exact target binding; missing market evidence was not inferred and no repair or generator call was substituted.'
      )
    };
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
        prunedPrimaryActionVariantCount:
          seedSet.prunedPrimaryActionVariantCount,
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
        prunedPrimaryActionVariantCount:
          seedSet.prunedPrimaryActionVariantCount,
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

  const requiresCommercialCritic =
    searchContracts.revenuePathContract === REVENUE_PATH_CONTRACT_VERSION;
  const requiredDownstreamLLMCalls = useContingentFinalists ? 1 : 2;
  let commercialCritic = {
    contract: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
    contractVersion: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
    attempted: false,
    enforced: requiresCommercialCritic,
    valid: false,
    verdict: requiresCommercialCritic ? 'not_run' : 'not_required',
    acceptedFamilyIds: [],
    acceptedFinalistIds: [],
    selectedOrdering: [],
    reason: requiresCommercialCritic
      ? 'A bounded comparative critic has not run.'
      : 'Legacy revenue-path contracts do not use the v5 comparative critic.',
    cause: budget.maxLLMCalls < requiredDownstreamLLMCalls
      ? 'critic_call_not_budgeted'
      : structuredRepair.attempted
        ? 'structured_repair_consumed_second_call'
        : 'insufficient_grounded_finalists'
  };
  const expanded = expandAndJudge({
    objective,
    constraints,
    evidenceCatalog: activeValidationEvidenceCatalog,
    priorOutcomes,
    seedSet,
    weights: normalizeJudgeWeights(
      completion?.data?.judgeWeights ?? completion?.data?.w
    ),
    budget,
    timestamp
  });
  let initialHypotheses = expanded.finalists;
  const searchSpaceFor = (retainedHypotheses) => ({
    ...base.searchSpace,
    maxHypotheses: budget.maxHypotheses,
    generatorContract: TOURNAMENT_GENERATOR_CONTRACT,
    theoreticalCount: expanded.theoreticalCount,
    expandedCount: expanded.expandedCount,
    eligibleCount: expanded.eligibleCount,
    filteredCount: expanded.filteredCount,
    incompatibleCount: expanded.incompatibleCount,
    motionConflictCount: expanded.motionConflictCount,
    criticRejectedCount:
      nonNegativeInteger(commercialCritic.rejectedFinalistCount) || 0,
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
    prunedPrimaryActionVariantCount:
      seedSet.prunedPrimaryActionVariantCount,
    unsupportedTimingSeedCount: seedSet.unsupportedTimingSeedCount,
    timingVerificationRepairCount: seedSet.timingVerificationRepairCount,
    coherenceGate: searchContracts.coherenceGate,
    deterministic: true,
    modelCalls: usage.calls,
    structuredRepair,
    commercialCritic,
    judgeWeights: expanded.weights
  });
  if (initialHypotheses.length < 2) {
    return {
      status: 'skipped',
      summary: useContingentFinalists
        ? 'The first AI stage did not yield two complete deterministic finalists after exact target binding.'
        : 'The tournament retained fewer than two grounded strategies.',
      ...base,
      hypotheses: initialHypotheses.map(publicHypothesis),
      nextExperiment: useContingentFinalists
        ? null
        : nextExperimentFor([
            ...Object.keys(expanded.revenueRejectionReasons),
            'second_grounded_finalist'
          ]),
      searchSpace: searchSpaceFor(initialHypotheses),
      llm: llmTrace,
      usage,
      gate: researchOnlyGate(
        useContingentFinalists
          ? 'technical_recovery'
          : 'needs_more_approved_evidence',
        useContingentFinalists
          ? 'Call 1 returned fewer than two complete finalists after deterministic causal validation; no market-evidence gap or repair call was substituted.'
          : 'A completed tournament requires a distinct winner and runner-up grounded in approved evidence.'
      )
    };
  }
  if (requiresCommercialCritic) {
    const deterministicFinalists = initialHypotheses.filter((hypothesis) =>
      deterministicCommercialHypothesisGate(
        hypothesis,
        commercialEvidenceGraph
      ).valid
    );
    const deterministicExcludedCount =
      initialHypotheses.length - deterministicFinalists.length;
    const deterministicFinalistFamilyCount = new Set(
      deterministicFinalists.map((hypothesis) =>
        firstText(hypothesis._strategyFamily)
      ).filter(Boolean)
    ).size;
    if (deterministicFinalists.length < 2 ||
        deterministicFinalistFamilyCount < 2) {
      commercialCritic = {
        ...commercialCritic,
        cause: 'insufficient_deterministic_finalists',
        reason:
          'Fewer than two family-diverse finalist motions passed the deterministic active, causal, incremental-revenue gate; no invalid, passive, or same-family-only set was sent to the critic.',
        deterministicExcludedCount,
        deterministicFinalistFamilyCount
      };
      initialHypotheses = deterministicFinalists;
      return {
        status: 'skipped',
        summary:
          'The tournament retained fewer than two active causal revenue finalists before critic review.',
        ...base,
        hypotheses: initialHypotheses.map(publicHypothesis),
        nextExperiment: useContingentFinalists
          ? null
          : nextExperimentFor([
              'active_causal_revenue_finalist',
              'second_grounded_finalist'
            ]),
        searchSpace: searchSpaceFor(initialHypotheses),
        llm: llmTrace,
        usage,
        gate: researchOnlyGate(
          useContingentFinalists
            ? 'technical_recovery'
            : 'needs_more_approved_evidence',
          useContingentFinalists
            ? 'Call 1 returned fewer than two complete active causal finalists; this is an AI-contract failure, not evidence that the market is missing.'
            : 'Passive, operational, or non-causal motions were rejected before the independent critic.'
        )
      };
    }
    if (terminalStructuredIssue ||
        budget.maxLLMCalls < requiredDownstreamLLMCalls ||
        usage.calls >= budget.maxLLMCalls) {
      commercialCritic = {
        ...commercialCritic,
        cause: structuredRepair.attempted
          ? 'commercial_critic_displaced_by_repair'
          : 'critic_call_not_budgeted',
        reason: structuredRepair.attempted
          ? 'The one bounded repair consumed call 2, so the mandatory comparative critic could not run and no recommendation was accepted.'
          : 'The configured call budget did not leave a second call for the mandatory comparative critic.',
        deterministicExcludedCount
      };
      return {
        status: 'skipped',
        summary:
          'The mandatory commercial critic could not run within the two-call ceiling, so no recommendation was accepted.',
        ...base,
        hypotheses: deterministicFinalists.map(publicHypothesis),
        nextExperiment: nextExperimentFor([
          structuredRepair.attempted
            ? 'commercial_critic_displaced_by_repair'
            : 'commercial_critic_budget_recovery'
        ]),
        llm: llmTrace,
        usage,
        searchSpace: {
          ...searchSpaceFor(deterministicFinalists),
          commercialCritic
        },
        gate: researchOnlyGate(
          'commercial_critic_failed',
          'A v5 recommendation is invalid without a completed independent comparative critic.'
        )
      };
    }
    // The upstream v6 planner has already authored exactly two causal
    // families. Compare the best finalist from each family instead of paying
    // the critic to reread locally expanded near-duplicates. Legacy replay
    // paths retain their broader bounded comparison behavior.
    const criticFinalists = useContingentFinalists
      ? selectBestFamilyDiverseCriticPair(deterministicFinalists)
      : selectCommercialCriticFinalists(deterministicFinalists, 6);
    const criticInputBindings = commercialCriticFinalists(
      criticFinalists
    ).map((finalist) => ({
      finalistId: finalist.finalistId,
      familyId: finalist.familyId
    }));
    const criticOutcome = await runCommercialCritic({
      objective,
      commercialContext,
      commercialEvidenceGraph: promptCommercialEvidenceGraph,
      proposedCommercialMotions: promptProposedCommercialMotions,
      commercialDiscoveryCandidates: commercialDiscovery.candidates,
      compactContingentContext: useContingentFinalists,
      finalists: criticFinalists,
      model,
      budget,
      usage,
      completedRequests: useContingentFinalists
        ? []
        : [initialCompletionRequest],
      completeJSON
    });
    commercialCritic = {
      ...criticOutcome.trace,
      enforced: true,
      inputFinalists: criticInputBindings,
      deterministicExcludedCount,
      preCriticFinalistCount: initialHypotheses.length,
      deterministicFinalistCount: deterministicFinalists.length,
      criticInputFinalistCount: criticFinalists.length
    };
    if (criticOutcome.metadata) {
      providerMetadataEntries.push(criticOutcome.metadata);
      llmTrace.commercialCritic = criticOutcome.metadata;
      usage = aggregateUsage(providerMetadataEntries, budget);
    }
    if (budget.hardStop &&
        usage.reportedCostMicros > budget.maxLLMSpendMicros) {
      criticOutcome.status = 'failed';
      criticOutcome.cause = 'commercial_critic_budget_recovery';
      commercialCritic.valid = false;
      commercialCritic.verdict = 'rejected';
      commercialCritic.cause = 'critic_reported_budget_exceeded';
      commercialCritic.reason =
        'The critic response exceeded the hard tournament spend budget.';
      commercialCritic.acceptedFamilyIds = [];
      commercialCritic.acceptedFinalistIds = [];
    }
    if (criticOutcome.status !== 'completed') {
      return {
        status: 'skipped',
        summary:
          'The independent commercial critic did not return a usable bounded comparison, so no recommendation was accepted.',
        ...base,
        hypotheses: deterministicFinalists.map(publicHypothesis),
        nextExperiment: nextExperimentFor([
          criticOutcome.cause ||
            'commercial_critic_contract_recovery'
        ]),
        llm: llmTrace,
        usage,
        searchSpace: {
          ...searchSpaceFor(deterministicFinalists),
          modelCalls: usage.calls,
          commercialCritic
        },
        gate: researchOnlyGate(
          'commercial_critic_failed',
          'No AI recommendation was accepted because the comparative critic failed its provider, budget, token, or strict-contract gate.'
        )
      };
    }
    const acceptedIDs = new Set(
      compactStrings(commercialCritic.acceptedFinalistIds)
    );
    const byID = new Map(
      deterministicFinalists.map((hypothesis) => [hypothesis.id, hypothesis])
    );
    initialHypotheses = compactStrings(commercialCritic.selectedOrdering)
      .map((id) => byID.get(id))
      .filter((hypothesis) => hypothesis && acceptedIDs.has(hypothesis.id))
      .map((hypothesis, index) => ({
        ...hypothesis,
        rank: index + 1,
        status: index === 0
          ? 'winner'
          : index === 1 ? 'runner_up' : 'finalist'
      }));
    if (commercialCritic.verdict !== 'accepted' ||
        initialHypotheses.length < 2) {
      return {
        status: 'skipped',
        summary:
          'The independent commercial critic did not accept two comparable causal revenue finalists.',
        ...base,
        hypotheses: initialHypotheses.map(publicHypothesis),
        nextExperiment: nextExperimentFor([
          'critic_rejected_commercial_motion',
          'second_grounded_finalist'
        ]),
        searchSpace: searchSpaceFor(initialHypotheses),
        llm: llmTrace,
        usage,
        gate: researchOnlyGate(
          'needs_more_approved_evidence',
          'The comparative critic rejected or could not rank two grounded causal revenue motions.'
        )
      };
    }
  }
  const profileScribePublicBaseURL = firstText(
    payload.profileScribePublicBaseURL,
    payload.publicBaseUrl
  );
  const externallyGroundedCandidateValues = [
    ...commercialDiscoveryCandidateValues(commercialDiscovery),
    ...collectStructuredCandidates(
      payload,
      context,
      profileScribePublicBaseURL
    ),
    ...normalizeModelExtractedCandidates(
      completion?.data?.candidates,
      activeValidationEvidenceCatalog
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
          activeValidationEvidenceCatalog
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
    );
  if (!requiresCommercialCritic) {
    actionableHypotheses.sort(compareHypotheses);
  }
  const winningHypothesis = requiresCommercialCritic &&
      actionableHypotheses[0]?.id !== initialHypotheses[0]?.id
    ? undefined
    : actionableHypotheses[0];
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
      (!requiresCommercialCritic || actionableHypotheses.some((item) =>
        item.id === hypothesis.id
      )) &&
      (requiresCommercialCritic ||
       hypothesis.score.total <= winningHypothesis.score.total)
    );
  if (!requiresCommercialCritic) {
    remainingHypotheses.sort(compareHypotheses);
  }
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
      nextExperiment: useContingentFinalists
        ? null
        : nextExperimentFor([
            'family_diverse_revenue_path'
          ]),
      searchSpace: searchSpaceFor(initialHypotheses),
      llm: llmTrace,
      usage,
      gate: researchOnlyGate(
        useContingentFinalists
          ? 'technical_recovery'
          : 'needs_more_approved_evidence',
        useContingentFinalists
          ? 'Call 1 did not preserve two family-diverse complete commercial finalists after deterministic binding; no market-evidence gap was inferred.'
          : 'A completed tournament requires a candidate-grounded winner and a lower-ranked runner-up from a different complete strategy family.'
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
      nextExperiment: useContingentFinalists
        ? null
        : nextExperimentFor([
            'distinct_runner_up'
          ]),
      searchSpace,
      llm: llmTrace,
      usage,
      gate: researchOnlyGate(
        useContingentFinalists
          ? 'technical_recovery'
          : 'needs_more_approved_evidence',
        useContingentFinalists
          ? 'Call 1 did not preserve two distinct candidate-grounded finalists; this is a contract recovery, not missing market evidence.'
          : 'A completed tournament requires a candidate-grounded winner and a distinct lower-ranked runner-up.'
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
    commercialCritic,
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

function normalizePersistedOpportunityDiscoveryPlan(value) {
  const raw = asObject(value);
  const present = Object.keys(raw).length > 0;
  const base = {
    present,
    valid: false,
    contractVersion: firstText(raw.contractVersion),
    status: firstText(raw.status),
    reason: truncate(firstText(raw.reason), 320),
    evidenceHash: /^[a-f0-9]{64}$/i.test(firstText(raw.evidenceHash))
      ? firstText(raw.evidenceHash).toLowerCase()
      : '',
    plans: [],
    sideEffectsPerformed:
      nonNegativeInteger(raw.sideEffectsPerformed) || 0,
    rejectedReason: ''
  };
  if (!present) return base;
  const rawPlans = asArray(raw.plans);
  const declaredEvidenceRefs = compactStrings(rawPlans.flatMap(
    (planValue) => asArray(asObject(planValue).evidenceRefs)
  ));
  const normalized = normalizeOpportunityDiscoveryPlan(
    raw,
    declaredEvidenceRefs.map((id) => ({ id }))
  );
  const normalizedPlanRefsAreExact = normalized.plans.every(
    (plan, index) => {
      const requested = compactStrings(
        asObject(rawPlans[index]).evidenceRefs
      );
      return requested.length === plan.evidenceRefs.length &&
        requested.every((ref) => plan.evidenceRefs.includes(ref));
    }
  );
  const issue = opportunityDiscoveryPlanIssue(normalized) ||
    (!base.evidenceHash
      ? 'Discovery plan evidenceHash must be SHA-256.'
      : '') ||
    (raw.sideEffectsPerformed !== 0
      ? 'Discovery plan cannot perform side effects.'
      : '') ||
    (rawPlans.length > 3 || rawPlans.length !== normalized.plans.length ||
      !normalizedPlanRefsAreExact
      ? 'Discovery plan shape changed during normalization.'
      : '');
  return {
    ...base,
    ...normalized,
    present: true,
    valid: !issue,
    evidenceHash: base.evidenceHash,
    sideEffectsPerformed: base.sideEffectsPerformed,
    rejectedReason: truncate(issue, 320)
  };
}

function materializeContingentFinalistsFromDiscovery({
  commercialDiscovery,
  evidenceCatalog,
  referenceTime
}) {
  const discovery = asObject(commercialDiscovery);
  const plan = asObject(discovery.plan);
  const baseTrace = {
    contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
    source: 'discovery_planner_call_1',
    materialized: false,
    motionId: firstText(discovery.motion),
    targetNameToken: CONTINGENT_TARGET_NAME_TOKEN,
    targetUrlToken: CONTINGENT_TARGET_URL_TOKEN,
    targetEvidenceRefToken: CONTINGENT_TARGET_EVIDENCE_REF,
    deterministicBindingOnly: true,
    publishableProseComposedByApplication: false
  };
  const fail = (cause, reason, extra = {}) => ({
    valid: false,
    cause,
    reason,
    trace: {
      ...baseTrace,
      ...extra,
      cause,
      reason: truncate(reason, 320)
    }
  });
  if (plan.present !== true ||
      firstText(plan.contractVersion) !==
        OPPORTUNITY_DISCOVERY_PLAN_CONTRACT) {
    return fail('no_v2_contingent_plan',
      'No v2 contingent commercial plan was available.');
  }
  if (plan.valid !== true) {
    return fail('invalid_contingent_contract',
      firstText(plan.rejectedReason,
        'The persisted contingent commercial plan was invalid.'));
  }
  if (firstText(discovery.status) === 'provider_unavailable') {
    return fail('provider_unavailable',
      'The bounded outside-discovery provider was unavailable.');
  }
  if (['failed', 'unknown'].includes(firstText(discovery.status))) {
    return fail('provider_failed',
      'The bounded outside-discovery provider did not return a claim-fenced result.');
  }
  if (discovery.valid !== true) {
    return fail('invalid_discovery_envelope',
      'The outside-discovery envelope failed local validation.');
  }
  if (firstText(discovery.status) !== 'found') {
    return fail('exact_target_not_found',
      'No exact public target was found for the bounded commercial motions.');
  }
  const plannedMotions = asArray(plan.plans).map(asObject);
  if (!plannedMotions.some((item) =>
    firstText(item.id) === firstText(discovery.motion)
  )) {
    return fail('invalid_contingent_contract',
      'The found provider result did not bind to one exact planned motion.');
  }
  const factByRef = new Map(asArray(discovery.evidence).map((factValue) => {
    const fact = asObject(factValue);
    return [firstText(fact.evidenceRef), fact];
  }));
  const bindings = plannedMotions
    .map((motion) => bindContingentMotionTarget({
      motion,
      candidates: discovery.candidates,
      factByRef
    }))
    .filter((binding) => binding.valid === true);
  if (bindings.length === 0) {
    return fail('target_source_binding_failed',
      'No exact candidate satisfied a planned target kind and its required provider evidence roles.', {
        attemptedMotionIds: plannedMotions.map((motion) =>
          firstText(motion.id)
        )
      });
  }
  // Compare distinct economic motions when both have a valid exact target.
  // If only one motion binds, retain its two AI-authored tactic families so a
  // complete critic comparison remains possible without composing new prose.
  const selectedBindings = bindings.slice(0, 2);
  const materialized = selectedBindings.length >= 2
    ? {
        seedContract: SEED_CONTRACT_VERSION,
        familyA: asObject(selectedBindings[0].materialized).familyA,
        familyB: asObject(selectedBindings[1].materialized).familyA,
        w: asObject(selectedBindings[0].materialized).w
      }
    : selectedBindings[0].materialized;
  let serialized = '';
  try {
    serialized = JSON.stringify(materialized);
  } catch {
    return fail('invalid_contingent_contract',
      'The contingent finalists could not be serialized after target binding.');
  }
  if (!serialized ||
      serialized.includes(CONTINGENT_TARGET_NAME_TOKEN) ||
      serialized.includes(CONTINGENT_TARGET_URL_TOKEN) ||
      serialized.includes(CONTINGENT_TARGET_EVIDENCE_REF)) {
    return fail('invalid_contingent_contract',
      'One or more typed target placeholders remained unresolved.');
  }
  const actionLabels = [
    ...asArray(asObject(asObject(materialized.familyA).d).a),
    ...asArray(asObject(asObject(materialized.familyB).d).a)
  ].map((item) => firstText(asObject(item).l));
  const boundTargetNames = selectedBindings.map((binding) =>
    firstText(binding.targetName)
  );
  if (actionLabels.length !== 4 ||
      (selectedBindings.length >= 2
        ? actionLabels.slice(0, 2).some((action) =>
            !exactTextContains(action, boundTargetNames[0])
          ) || actionLabels.slice(2).some((action) =>
            !exactTextContains(action, boundTargetNames[1])
          )
        : actionLabels.some((action) =>
            !exactTextContains(action, boundTargetNames[0])
          ))) {
    return fail('invalid_contingent_contract',
      'Every AI-authored primary action must contain the exact bound target after substitution.');
  }
  const normalizedSeedSet = normalizeSeedSet(
    materialized,
    asArray(evidenceCatalog).filter((item) =>
      !/^source:/i.test(firstText(asObject(item).id))
    ),
    referenceTime
  );
  const shapeIssue = structuredSeedSetShapeIssue(normalizedSeedSet);
  if (shapeIssue) {
    return fail('invalid_contingent_contract',
      `The bound contingent finalist bundle failed ${shapeIssue.code}.`, {
        shapeIssue: shapeIssue.code
      });
  }
  return {
    valid: true,
    cause: '',
    reason: '',
    data: materialized,
    motionId: firstText(selectedBindings[0].motion.id),
    candidateId: firstText(selectedBindings[0].candidate.id),
    motionIds: selectedBindings.map((binding) =>
      firstText(binding.motion.id)
    ),
    candidateIds: selectedBindings.map((binding) =>
      firstText(binding.candidate.id)
    ),
    trace: {
      ...baseTrace,
      materialized: true,
      motionId: firstText(selectedBindings[0].motion.id),
      candidateId: firstText(selectedBindings[0].candidate.id),
      motionIds: selectedBindings.map((binding) =>
        firstText(binding.motion.id)
      ),
      candidateIds: selectedBindings.map((binding) =>
        firstText(binding.candidate.id)
      ),
      targetKind: firstText(
        asObject(selectedBindings[0].motion.targetSlot).finalTargetKind
      ),
      commercialRole: firstText(
        selectedBindings[0].motion.commercialRole
      ),
      resolutionStrategy: firstText(
        asObject(selectedBindings[0].motion.targetSlot).resolutionStrategy
      ),
      targetKinds: selectedBindings.map((binding) =>
        firstText(asObject(binding.motion.targetSlot).finalTargetKind)
      ),
      commercialRoles: selectedBindings.map((binding) =>
        firstText(binding.motion.commercialRole)
      ),
      resolutionStrategies: selectedBindings.map((binding) =>
        firstText(asObject(binding.motion.targetSlot).resolutionStrategy)
      ),
      boundEvidenceRefs: compactStrings(selectedBindings.flatMap(
        (binding) => binding.evidenceRefs
      )),
      distinctMotionComparison: selectedBindings.length >= 2,
      familyCount: 2,
      primaryActionCount: actionLabels.length,
      exactTargetPresentInEveryPrimaryAction: true
    }
  };
}

function bindContingentMotionTarget({
  motion: motionValue,
  candidates: candidateValues,
  factByRef
}) {
  const motion = asObject(motionValue);
  const slot = asObject(motion.targetSlot);
  const expectedRoles = requiredCommercialDiscoveryRolesForSlot(motion);
  const candidate = asArray(candidateValues).map(asObject).find(
    (candidateValue) => {
      if (firstText(candidateValue.commercialRole) !==
          firstText(motion.commercialRole) ||
          firstText(candidateValue.motionId) !== firstText(motion.id) ||
          candidateValue.exactNamedCandidate !== true ||
          candidateValue.identityResolved !== true) {
        return false;
      }
      const facts = compactStrings(candidateValue.evidenceRefs)
        .map((ref) => factByRef.get(ref))
        .filter(Boolean);
      if (facts.length === 0 || facts.some((fact) =>
        firstText(asObject(fact).motionId) !== firstText(motion.id)
      )) return false;
      const roles = new Set(facts.flatMap((fact) =>
        compactStrings(asObject(fact).roles).map(contractEnum)
      ));
      if (expectedRoles.some((role) => !roles.has(role))) return false;
      const kind = contractEnum(firstText(candidateValue.kind));
      if (slot.finalTargetKind === 'live_paid_demand') {
        return LIVE_PAID_DEMAND_CANDIDATE_KINDS.has(kind) &&
          facts.some((fact) =>
          firstText(asObject(fact).kind) ===
            'verified_external_live_demand'
        );
      }
      if (slot.finalTargetKind === 'person' &&
          !/\b(?:person|professional|decision_maker|individual)\b/.test(
            kind.replaceAll('_', ' ')
          )) {
        return false;
      }
      if (slot.resolutionStrategy ===
          'organization_then_decision_maker') {
        const organization = firstText(candidateValue.organization);
        return Boolean(organization) &&
          organization !== firstText(candidateValue.displayLabel) &&
          facts.some((fact) => exactTextContains(
            `${firstText(asObject(fact).label)} ${
              firstText(asObject(fact).summary)
            }`,
            organization
          ));
      }
      if (slot.finalTargetKind === 'organization') {
        const organization = firstText(
          candidateValue.organization,
          candidateValue.displayLabel
        );
        return Boolean(organization) && facts.some((fact) => exactTextContains(
          `${firstText(asObject(fact).label)} ${
            firstText(asObject(fact).summary)
          }`,
          organization
        ));
      }
      return true;
    }
  );
  if (!candidate) return { valid: false };
  const evidenceRefs = compactStrings(candidate.evidenceRefs)
    .filter((ref) => factByRef.has(ref));
  const targetName = slot.finalTargetKind === 'organization'
    ? firstText(candidate.organization, candidate.displayLabel)
    : firstText(candidate.displayLabel);
  const targetURL = safePublicHTTPSURL(candidate.publicUrl);
  if (!targetName || !targetURL || evidenceRefs.length === 0 ||
      commercialDiscoveryContainsPrivateContact(targetName)) {
    return { valid: false };
  }
  const materialized = bindContingentTargetTokens(
    motion.contingentFinalists,
    { targetName, targetURL, evidenceRefs }
  );
  let serialized = '';
  try {
    serialized = JSON.stringify(materialized);
  } catch {
    return { valid: false };
  }
  if (!serialized ||
      serialized.includes(CONTINGENT_TARGET_NAME_TOKEN) ||
      serialized.includes(CONTINGENT_TARGET_URL_TOKEN) ||
      serialized.includes(CONTINGENT_TARGET_EVIDENCE_REF)) {
    return { valid: false };
  }
  const actionLabels = [
    ...asArray(asObject(asObject(materialized.familyA).d).a),
    ...asArray(asObject(asObject(materialized.familyB).d).a)
  ].map((item) => firstText(asObject(item).l));
  if (actionLabels.length !== 4 || actionLabels.some((action) =>
    !exactTextContains(action, targetName)
  )) {
    return { valid: false };
  }
  return {
    valid: true,
    motion,
    candidate,
    materialized,
    targetName,
    targetURL,
    evidenceRefs
  };
}

function bindContingentTargetTokens(value, bindingValue) {
  const binding = asObject(bindingValue);
  const bind = (item) => {
    if (typeof item === 'string') {
      if (item === CONTINGENT_TARGET_EVIDENCE_REF) {
        return compactStrings(binding.evidenceRefs);
      }
      return item
        .replaceAll(CONTINGENT_TARGET_NAME_TOKEN, firstText(binding.targetName))
        .replaceAll(CONTINGENT_TARGET_URL_TOKEN, firstText(binding.targetURL));
    }
    if (Array.isArray(item)) {
      return item.flatMap((entry) => {
        const bound = bind(entry);
        return Array.isArray(bound) ? bound : [bound];
      });
    }
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [
        key,
        bind(child)
      ]));
    }
    return item;
  };
  return bind(value);
}

/**
 * Projects planner output into an explicitly unverified hypothesis channel.
 * Planner motions never enter the evidence catalog or verified commercial
 * graph. Their supply references must still bind to the exact pre-discovery
 * evidence snapshot that the planner saw.
 */
export function normalizeProposedCommercialMotions(
  planValue,
  supplyEvidenceCatalogValue
) {
  const plan = asObject(planValue);
  const supplyEvidenceCatalog = asArray(supplyEvidenceCatalogValue)
    .map(asObject)
    .filter((item) =>
      item.providerAttestedCommercialDiscovery !== true &&
      !/^external_discovery:/i.test(firstText(item.id))
    );
  const supplyEvidenceByID = new Map(supplyEvidenceCatalog.map((item) => [
    firstText(item.id),
    item
  ]));
  const evidenceHashMatches = Boolean(
    plan.valid === true &&
    firstText(plan.evidenceHash) &&
    firstText(plan.evidenceHash) === stableHash(supplyEvidenceCatalog)
  );
  const base = {
    contractVersion: firstText(plan.contractVersion) ===
      LEGACY_OPPORTUNITY_DISCOVERY_PLAN_CONTRACT
      ? LEGACY_PROPOSED_COMMERCIAL_MOTIONS_CONTRACT
      : PROPOSED_COMMERCIAL_MOTIONS_CONTRACT,
    sourceContractVersion: firstText(plan.contractVersion),
    status: plan.present !== true
      ? 'not_available'
      : plan.valid !== true
        ? 'invalid'
        : firstText(plan.status) === 'insufficient_verified_supply'
          ? 'insufficient_verified_supply'
          : evidenceHashMatches
            ? 'proposed_unverified'
            : 'stale_or_mismatched_supply',
    evidenceStatus: 'not_evidence',
    outsideFactStatus: 'unverified',
    evidenceHashMatches,
    motions: []
  };
  if (base.status !== 'proposed_unverified') return base;
  const motions = asArray(plan.plans).flatMap((planValue) => {
    const motion = asObject(planValue);
    const evidenceRefs = compactStrings(motion.evidenceRefs);
    if (evidenceRefs.length === 0 || evidenceRefs.some((ref) =>
      !supplyEvidenceByID.has(ref)
    )) {
      return [];
    }
    return [{
      id: firstText(motion.id),
      priority: clampInteger(motion.priority, 1, 3, 3),
      searchMode: firstText(motion.searchMode),
      commercialRole: firstText(motion.commercialRole),
      acquisitionMode: firstText(motion.acquisitionMode),
      buyerRole: firstText(motion.buyer),
      counterpartyRole: firstText(motion.counterparty),
      paidOffer: firstText(motion.paidOffer),
      evidenceRefs,
      acquisitionMechanism: firstText(motion.acquisitionMechanism),
      conversionDestination: firstText(motion.conversionDestination),
      paidConversion: firstText(motion.paidConversion),
      attributionSignal: firstText(motion.attributionSignal),
      rationale: firstText(motion.rationale),
      targetSlot: asObject(motion.targetSlot),
      contingentFinalists: asObject(motion.contingentFinalists),
      hypothesisOnly: true,
      verifiedOutsideFacts: false,
      exactTargetRequired: true
    }];
  });
  return {
    ...base,
    motions
  };
}

function projectProposedCommercialMotionsForPrompt(
  value,
  promptEvidenceCatalogValue
) {
  const proposed = asObject(value);
  const promptEvidenceRefs = new Set(asArray(promptEvidenceCatalogValue)
    .map((item) => firstText(asObject(item).id))
    .filter(Boolean));
  const motions = asArray(proposed.motions).filter((motionValue) =>
    compactStrings(asObject(motionValue).evidenceRefs).every((ref) =>
      promptEvidenceRefs.has(ref)
    )
  ).map((motionValue) => {
    const motion = asObject(motionValue);
    const {
      contingentFinalists: _contingentFinalists,
      ...promptMotion
    } = motion;
    return {
      ...promptMotion,
      contingentFinalistFamilyCount:
        Object.keys(asObject(motion.contingentFinalists)).length > 0
          ? 2
          : 0
    };
  });
  return {
    contractVersion: firstText(proposed.contractVersion),
    sourceContractVersion: firstText(proposed.sourceContractVersion),
    status: firstText(proposed.status),
    evidenceStatus: 'not_evidence',
    outsideFactStatus: 'unverified',
    evidenceHashMatches: proposed.evidenceHashMatches === true,
    exactTargetRule:
      'Any outside target, live demand, relationship, permission, or exact name requires separate approved or provider-attested evidenceCatalog support.',
    motions,
    omittedMotionCount: Math.max(
      0,
      asArray(proposed.motions).length - motions.length
    )
  };
}

export function normalizeCommercialDiscoveryEvidence(
  value,
  referenceTime = new Date()
) {
  const raw = asObject(value);
  const present = Object.keys(raw).length > 0;
  const rejectedReasons = {};
  const reject = (reason) => {
    rejectedReasons[reason] = (rejectedReasons[reason] || 0) + 1;
  };
  const base = {
    present,
    valid: false,
    contractVersion: firstText(raw.contractVersion),
    status: contractEnum(firstText(raw.status)),
    attempted: raw.attempted === true,
    motion: truncate(firstText(raw.motion), 80),
    buyerArchetype: truncate(firstText(raw.buyerArchetype), 180),
    market: truncate(firstText(raw.market), 120),
    queryHash: /^[a-f0-9]{64}$/i.test(firstText(raw.queryHash))
      ? firstText(raw.queryHash).toLowerCase()
      : '',
    providersAttempted: compactStrings(raw.providersAttempted)
      .slice(0, MAX_COMMERCIAL_DISCOVERY_PROVIDER_CALLS)
      .map((item) => truncate(item, 100)),
    providerCalls: nonNegativeInteger(raw.providerCalls) || 0,
    paidProviderCalls: nonNegativeInteger(raw.paidProviderCalls) || 0,
    creditsUsed: nonNegativeInteger(raw.creditsUsed) || 0,
    resultCount: nonNegativeInteger(raw.resultCount) || 0,
    patientTargetingExcluded: raw.patientTargetingExcluded === true,
    sideEffectsPerformed:
      nonNegativeInteger(raw.sideEffectsPerformed) || 0,
    discoveredAt: validISOString(raw.discoveredAt),
    plan: normalizePersistedOpportunityDiscoveryPlan(raw.plan),
    attempts: [],
    evidence: [],
    candidates: [],
    rejectedReasons
  };
  if (!present) return base;
  if (base.contractVersion !== COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT) {
    reject('invalid_contract');
    return base;
  }
  if (!COMMERCIAL_DISCOVERY_STATUSES.has(base.status)) {
    reject('invalid_status');
    return base;
  }
  const providerUnavailable = base.status === 'provider_unavailable';
  if ((!providerUnavailable && !base.queryHash) ||
      !base.patientTargetingExcluded ||
      base.sideEffectsPerformed !== 0 ||
      !base.discoveredAt ||
      base.providerCalls > MAX_COMMERCIAL_DISCOVERY_PROVIDER_CALLS ||
      base.paidProviderCalls >
        MAX_COMMERCIAL_DISCOVERY_PAID_PROVIDER_CALLS ||
      base.paidProviderCalls > base.providerCalls ||
      asArray(raw.providersAttempted).length !==
        base.providersAttempted.length ||
      base.providersAttempted.some((provider) =>
        !COMMERCIAL_DISCOVERY_PROVIDERS.has(provider)
      ) ||
      base.providersAttempted.length > base.providerCalls ||
      (base.providerCalls > 0 && base.providersAttempted.length === 0)) {
    reject('invalid_envelope');
    return base;
  }
  if (base.plan.present && !base.plan.valid) {
    reject('invalid_discovery_plan');
    return base;
  }
  if ((providerUnavailable && (
    base.attempted ||
    base.providerCalls !== 0 ||
    base.paidProviderCalls !== 0 ||
    base.creditsUsed !== 0 ||
    base.resultCount !== 0 ||
    asArray(raw.attempts).length !== 0 ||
    asArray(raw.evidence).length !== 0 ||
    asArray(raw.candidates).length !== 0
  )) || (!providerUnavailable && !base.attempted)) {
    reject('invalid_attempt_state');
    return base;
  }
  const referenceDate = validDate(referenceTime);
  const discoveredDate = new Date(base.discoveredAt);
  const discoveryAge = referenceDate.getTime() - discoveredDate.getTime();
  if (discoveryAge < -MAX_TIMING_VERIFICATION_FUTURE_SKEW_MS ||
      discoveryAge > MAX_COMMERCIAL_DISCOVERY_FACT_AGE_MS) {
    reject('stale_or_future_envelope');
    return base;
  }

  const attemptIDs = new Set();
  for (const attemptValue of asArray(raw.attempts)
    .slice(0, MAX_COMMERCIAL_DISCOVERY_ATTEMPTS)) {
    const attempt = normalizeCommercialDiscoveryAttempt(attemptValue);
    if (!attempt || attemptIDs.has(attempt.id)) {
      reject(attempt ? 'duplicate_attempt' : 'invalid_attempt');
      continue;
    }
    if (!base.providersAttempted.includes(attempt.provider) ||
        !COMMERCIAL_DISCOVERY_ATTEMPT_OPERATIONS
          .get(attempt.provider)?.has(attempt.operation)) {
      reject('attempt_ledger_mismatch');
      continue;
    }
    attemptIDs.add(attempt.id);
    base.attempts.push(attempt);
  }
  if (base.attempts.length > 0 &&
      commercialDiscoveryAttemptLedgerHash(base.attempts) !==
        base.queryHash) {
    reject('attempt_ledger_hash_mismatch');
    return base;
  }
  if (asArray(raw.attempts).length > MAX_COMMERCIAL_DISCOVERY_ATTEMPTS ||
      base.attempts.length !== asArray(raw.attempts).length ||
      base.attempts.length !== base.paidProviderCalls ||
      base.providerCalls < base.paidProviderCalls ||
      base.creditsUsed !== base.attempts.reduce(
        (sum, attempt) => sum + attempt.creditsUsed,
        0
      ) ||
      base.resultCount < base.attempts.reduce(
        (sum, attempt) => sum + attempt.resultCount,
        0
      )) {
    reject('invalid_attempt_ledger');
    return base;
  }
  const attemptedProviders = new Set(base.providersAttempted.map(comparable));
  const ledgerProviders = new Set(base.attempts.map((item) =>
    comparable(item.provider)
  ));
  if ((!providerUnavailable && attemptedProviders.size === 0) ||
      [...ledgerProviders].some((provider) =>
        !attemptedProviders.has(provider)
      )) {
    reject('provider_ledger_mismatch');
    return base;
  }

  if (base.status !== COMMERCIAL_DISCOVERY_FOUND_STATUS) {
    if (asArray(raw.evidence).length !== 0 ||
        asArray(raw.candidates).length !== 0) {
      reject('non_found_payload_retained_results');
      return base;
    }
    return {
      ...base,
      valid: true
    };
  }

  const allowedMotionIds = new Set(
    base.plan.present === true && base.plan.valid === true
      ? asArray(base.plan.plans)
          .map((motionValue) => firstText(asObject(motionValue).id))
          .filter(Boolean)
      : compactStrings([base.motion])
  );
  const plannedMotionByID = new Map(
    base.plan.present === true && base.plan.valid === true
      ? asArray(base.plan.plans).map((motionValue) => {
          const motion = asObject(motionValue);
          return [firstText(motion.id), motion];
        })
      : []
  );
  const hasSucceededDecisionMakerSearch = base.attempts.some((attempt) =>
    attempt.provider === 'people_data_labs_person_search' &&
    attempt.operation === PDL_DECISION_MAKER_SEARCH_OPERATION &&
    attempt.status === 'succeeded' &&
    attempt.resultCount > 0
  );
  if (allowedMotionIds.size === 0 ||
      !allowedMotionIds.has(base.motion)) {
    reject('invalid_discovery_motion');
    return base;
  }
  const evidenceByID = new Map();
  for (const factValue of asArray(raw.evidence)
    .slice(0, MAX_COMMERCIAL_DISCOVERY_EVIDENCE)) {
    const fact = normalizeCommercialDiscoveryFact(
      factValue,
      referenceDate,
      attemptedProviders,
      allowedMotionIds
    );
    if (fact?.provenance === PDL_SCOPED_DECISION_MAKER_PROVENANCE &&
        !hasSucceededDecisionMakerSearch) {
      reject('decision_maker_evidence_without_succeeded_attempt');
      continue;
    }
    if (!fact || evidenceByID.has(fact.evidenceRef)) {
      reject(fact ? 'duplicate_evidence_ref' : 'invalid_evidence');
      continue;
    }
    evidenceByID.set(fact.evidenceRef, fact);
    base.evidence.push(fact);
  }
  if (asArray(raw.evidence).length > MAX_COMMERCIAL_DISCOVERY_EVIDENCE) {
    reject('evidence_limit_exceeded');
  }
  if (base.evidence.some((fact) =>
    ledgerProviders.has(comparable(fact.provider)) &&
    !base.attempts.some((attempt) =>
      attempt.provider === fact.provider &&
      attempt.status === 'succeeded' &&
      attempt.resultCount > 0
    )
  )) {
    reject('claim_fenced_evidence_without_succeeded_attempt');
    return base;
  }

  const candidateIDs = new Set();
  for (const candidateValue of asArray(raw.candidates)
    .slice(0, MAX_COMMERCIAL_DISCOVERY_CANDIDATES)) {
    const candidate = normalizeCommercialDiscoveryCandidate(
      candidateValue,
      evidenceByID,
      attemptedProviders,
      allowedMotionIds,
      plannedMotionByID
    );
    if (!candidate || candidateIDs.has(candidate.id)) {
      reject(candidate ? 'duplicate_candidate_id' : 'invalid_candidate');
      continue;
    }
    candidateIDs.add(candidate.id);
    base.candidates.push(candidate);
  }
  if (asArray(raw.candidates).length > MAX_COMMERCIAL_DISCOVERY_CANDIDATES) {
    reject('candidate_limit_exceeded');
  }
  const unboundDecisionMakerFact = base.evidence.find((fact) =>
    fact.provenance === PDL_SCOPED_DECISION_MAKER_PROVENANCE &&
    !base.candidates.some((candidate) =>
      candidate.provider === 'people_data_labs_person_search' &&
      candidate.kind === 'person' &&
      candidate.evidenceRefs.length === 2 &&
      candidate.evidenceRefs.includes(fact.evidenceRef)
    )
  );
  if (unboundDecisionMakerFact) {
    reject('unbound_decision_maker_evidence');
    return base;
  }
  if (base.evidence.length === 0 || base.candidates.length === 0) {
    reject('empty_verified_discovery');
    return base;
  }
  if (base.resultCount < base.evidence.length) {
    reject('result_count_mismatch');
    return base;
  }
  return {
    ...base,
    valid: true
  };
}

/**
 * SHA-256 over UTF-8 compact JSON for the ordered exact ledger tuples:
 * [[provider, operation, queryHash], ...]. The order is semantically binding;
 * a one-attempt ledger uses the same one-element array representation.
 */
export function commercialDiscoveryAttemptLedgerHash(attemptsValue) {
  return stableHash(asArray(attemptsValue).map((attemptValue) => {
    const attempt = asObject(attemptValue);
    return [
      firstText(attempt.provider),
      contractEnum(firstText(attempt.operation)),
      firstText(attempt.queryHash).toLowerCase()
    ];
  }));
}

function normalizeCommercialDiscoveryAttempt(value) {
  const raw = asObject(value);
  const id = truncate(firstText(raw.id), 120);
  const provider = truncate(firstText(raw.provider), 100);
  const operation = contractEnum(firstText(raw.operation));
  const queryHash = firstText(raw.queryHash).toLowerCase();
  const status = contractEnum(firstText(raw.status));
  const statuses = new Set([
    'succeeded',
    'not_found',
    'failed',
    'unknown'
  ]);
  if (!id || !provider || !operation ||
      !/^[a-f0-9]{64}$/.test(queryHash) ||
      !statuses.has(status)) {
    return null;
  }
  return compact({
    id,
    provider,
    operation,
    queryHash,
    status,
    estimatedSpendMicros:
      nonNegativeInteger(raw.estimatedSpendMicros) || 0,
    actualSpendMicros:
      nonNegativeInteger(raw.actualSpendMicros) || 0,
    creditsUsed: nonNegativeInteger(raw.creditsUsed) || 0,
    resultCount: nonNegativeInteger(raw.resultCount) || 0,
    failureCode: /^[a-z0-9_.:-]{1,80}$/i.test(firstText(raw.failureCode))
      ? firstText(raw.failureCode).toLowerCase()
      : undefined,
    reservedAt: validISOString(raw.reservedAt),
    updatedAt: validISOString(raw.updatedAt),
    completedAt: validISOString(raw.completedAt)
  });
}

function normalizeCommercialDiscoveryFact(
  value,
  referenceDate,
  attemptedProviders,
  allowedMotionIds
) {
  const raw = asObject(value);
  const motionId = truncate(firstText(raw.motionId), 80);
  const evidenceRef = firstText(raw.evidenceRef);
  const kind = contractEnum(firstText(raw.kind));
  const label = truncate(firstText(raw.label), 180);
  const summary = truncate(firstText(raw.summary), 700);
  const url = safePublicURL(firstText(raw.url));
  const provider = truncate(firstText(raw.provider), 100);
  const provenance = contractEnum(firstText(raw.provenance));
  const requestedRoles = compactStrings(raw.roles).map(contractEnum);
  const roles = requestedRoles.filter((role) =>
    COMMERCIAL_DISCOVERY_ROLES.has(role)
  );
  const observedAt = validISOString(raw.observedAt);
  if (!/^[a-z][a-z0-9_-]{2,79}$/.test(motionId) ||
      !(allowedMotionIds instanceof Set) ||
      !allowedMotionIds.has(motionId) ||
      !/^external_discovery:[a-f0-9]{24}$/.test(
    evidenceRef
  ) ||
      !COMMERCIAL_DISCOVERY_KINDS.has(kind) ||
      !label ||
      !summary ||
      !COMMERCIAL_DISCOVERY_PROVIDERS.has(provider) ||
      !COMMERCIAL_DISCOVERY_PROVIDER_PROVENANCE.get(provider)?.has(
        provenance
      ) ||
      raw.verified !== true ||
      !observedAt ||
      requestedRoles.length === 0 ||
      roles.length !== requestedRoles.length ||
      !attemptedProviders.has(comparable(provider)) ||
      commercialDiscoveryContainsPrivateContact(label) ||
      commercialDiscoveryContainsPrivateContact(summary)) {
    return null;
  }
  if (!commercialDiscoveryProviderFactRolesValid(
    provider,
    kind,
    roles
  )) {
    return null;
  }
  const observedDate = new Date(observedAt);
  const age = referenceDate.getTime() - observedDate.getTime();
  if (age < -MAX_TIMING_VERIFICATION_FUTURE_SKEW_MS ||
      age > MAX_COMMERCIAL_DISCOVERY_FACT_AGE_MS) {
    return null;
  }
  return {
    motionId,
    evidenceRef,
    kind,
    label,
    summary,
    url,
    provider,
    provenance,
    roles,
    verified: true,
    observedAt
  };
}

function commercialDiscoveryProviderFactRolesValid(
  provider,
  kind,
  rolesValue
) {
  const roles = new Set(compactStrings(rolesValue));
  const paidDemandOnlyRoles = [
    'conversion_destination',
    'demand_signal',
    'paid_conversion',
    'paid_offer'
  ];
  const identityOnlyProvider =
    provider === 'people_data_labs_person_search';
  const liveDemandOnlyProvider =
    provider === 'people_data_labs_job_posting_search';
  const publicIdentityProvider = [
    'google_places',
    'github_search'
  ].includes(provider);
  if ((identityOnlyProvider || publicIdentityProvider) &&
      kind !== 'verified_external_professional_target') {
    return false;
  }
  if (liveDemandOnlyProvider &&
      kind !== 'verified_external_live_demand') {
    return false;
  }
  if (kind === 'verified_external_professional_target') {
    return !paidDemandOnlyRoles.some((role) => roles.has(role));
  }
  if (kind === 'verified_external_live_demand') {
    // In particular, a Brave identity result cannot upgrade itself into paid
    // demand through its prose or provider name. The normalized application
    // fact must explicitly carry the complete live-demand role set.
    return [...COMMERCIAL_DISCOVERY_LIVE_DEMAND_ROLES].every((role) =>
      roles.has(role)
    );
  }
  return false;
}

function normalizeCommercialDiscoveryCandidate(
  value,
  evidenceByID,
  attemptedProviders,
  allowedMotionIds,
  plannedMotionByID = new Map()
) {
  const raw = asObject(value);
  const motionId = truncate(firstText(raw.motionId), 80);
  const id = truncate(firstText(raw.id), 160);
  const kind = contractEnum(firstText(raw.kind));
  const displayLabel = truncate(firstText(raw.displayLabel), 180);
  const organization = truncate(firstText(raw.organization), 180);
  const role = truncate(firstText(raw.role), 180);
  const market = truncate(firstText(raw.market), 180);
  const publicUrl = safePublicURL(firstText(raw.publicUrl));
  const provider = truncate(firstText(raw.provider), 100);
  const commercialRole = contractEnum(firstText(raw.commercialRole));
  const evidenceRefs = compactStrings(raw.evidenceRefs)
    .filter((ref) => evidenceByID.has(ref))
    .slice(0, 8);
  if (!/^[a-z][a-z0-9_-]{2,79}$/.test(motionId) ||
      !(allowedMotionIds instanceof Set) ||
      !allowedMotionIds.has(motionId) ||
      !/^candidate:external:[a-f0-9]{24}$/.test(id) ||
      !kind ||
      !concreteCandidateLabel(displayLabel) ||
      !provider ||
      !COMMERCIAL_DISCOVERY_CANDIDATE_ROLES.has(commercialRole) ||
      evidenceRefs.length === 0 ||
      evidenceRefs.length !== compactStrings(raw.evidenceRefs).length ||
      raw.exactNamedCandidate !== true ||
      raw.identityResolved !== true ||
      !attemptedProviders.has(comparable(provider)) ||
      commercialDiscoveryContainsPrivateContact(displayLabel) ||
      commercialDiscoveryContainsPrivateContact(organization) ||
      commercialDiscoveryContainsPrivateContact(role) ||
      commercialDiscoveryContainsPrivateContact(market)) {
    return null;
  }
  const evidenceValues = evidenceRefs.map((ref) =>
    asObject(evidenceByID.get(ref))
  );
  const standardProviderBinding = evidenceValues.every((fact) =>
    fact.motionId === motionId &&
    fact.provider === provider &&
    fact.provenance !== PDL_SCOPED_DECISION_MAKER_PROVENANCE &&
    exactTextContains(
      `${firstText(fact.label)} ${firstText(fact.summary)}`,
      displayLabel
    )
  );
  const decisionMakerChainBinding =
    commercialDiscoveryDecisionMakerCandidateFactsBound({
      motion: asObject(plannedMotionByID.get(motionId)),
      evidenceValues,
      candidate: {
        motionId,
        kind,
        displayLabel,
        organization,
        publicUrl,
        provider,
        commercialRole
      }
    });
  if (!standardProviderBinding && !decisionMakerChainBinding) {
    return null;
  }
  if (publicUrl && !evidenceValues.some((fact) =>
    comparableURL(fact.url) === comparableURL(publicUrl)
  )) {
    return null;
  }
  const roleSet = new Set(evidenceValues.flatMap((fact) => fact.roles));
  const roleGrounded = commercialRole === 'referral_partner'
    ? roleSet.has('acquisition') && roleSet.has('channel_fit') &&
      roleSet.has('prospective_partner')
    : commercialRole === 'paid_demand'
      ? roleSet.has('paid_offer') &&
        roleSet.has('demand_signal') &&
        roleSet.has('conversion_destination') &&
        roleSet.has('paid_conversion')
      : commercialRole === 'buyer'
        ? roleSet.has('acquisition') && roleSet.has('channel_fit') &&
          roleSet.has('defined_buyer')
        : roleSet.has('defined_buyer') && roleSet.has('channel_fit');
  if (!roleGrounded) return null;
  const rawContactPaths = asArray(raw.contactPaths).slice(0, 8)
    .map(asObject);
  if (asArray(raw.contactPaths).length > 8 ||
      rawContactPaths.some((path) => {
        const reference = firstText(path.reference, path.Reference);
        return reference && (
          !safePublicURL(reference) ||
          commercialDiscoveryContainsPrivateContact(reference)
        );
      })) {
    return null;
  }
  const contactPaths = rawContactPaths.map((path) => {
    const kind = contractEnum(firstText(path.kind, 'unknown'));
    const reference = safePublicHTTPSURL(firstText(
      path.reference,
      path.Reference
    ));
    return compact({
      kind,
      available: path.available === true,
      verified: path.verified === true,
      reference: kind === 'public_professional_url' &&
        safePublicProfessionalProfileURL(reference)
        ? reference
        : undefined
    });
  });
  const verifiedPublicProfessionalRoute = contactPaths.some((path) =>
    path.kind === 'public_professional_url' &&
    path.available === true &&
    path.verified === true &&
    Boolean(safePublicProfessionalProfileURL(publicUrl)) &&
    comparableURL(safePublicProfessionalProfileURL(path.reference)) ===
      comparableURL(safePublicProfessionalProfileURL(publicUrl))
  );
  if (['buyer', 'referral_partner'].includes(commercialRole) &&
      !verifiedPublicProfessionalRoute) {
    return null;
  }
  if (['buyer', 'referral_partner'].includes(commercialRole) && (
    provider !== 'people_data_labs_person_search' || kind !== 'person'
  )) {
    return null;
  }
  return compact({
    motionId,
    id,
    kind,
    displayLabel,
    organization,
    role,
    market,
    publicUrl,
    provider,
    commercialRole,
    evidenceRefs,
    contactPaths,
    exactNamedCandidate: true,
    identityResolved: true
  });
}

function commercialDiscoveryDecisionMakerCandidateFactsBound({
  motion: motionValue,
  evidenceValues: evidenceValuesInput,
  candidate: candidateValue
}) {
  const motion = asObject(motionValue);
  const candidate = asObject(candidateValue);
  const slot = asObject(motion.targetSlot);
  const evidenceValues = asArray(evidenceValuesInput).map(asObject);
  const organization = firstText(candidate.organization);
  const displayLabel = firstText(candidate.displayLabel);
  const publicUrl = safePublicHTTPSURL(candidate.publicUrl);
  if (!firstText(motion.id) ||
      firstText(candidate.motionId) !== firstText(motion.id) ||
      firstText(motion.searchMode) !== 'local_organization' ||
      firstText(candidate.provider) !==
        'people_data_labs_person_search' ||
      contractEnum(firstText(candidate.kind)) !== 'person' ||
      firstText(candidate.commercialRole) !==
        firstText(motion.commercialRole) ||
      firstText(slot.commercialRole) !== firstText(motion.commercialRole) ||
      firstText(slot.finalTargetKind) !== 'person' ||
      firstText(slot.resolutionStrategy) !==
        'organization_then_decision_maker' ||
      !organization || !displayLabel || organization === displayLabel ||
      !publicUrl || evidenceValues.length !== 2) {
    return false;
  }

  let personFact;
  let organizationFact;
  for (const factValue of evidenceValues) {
    const fact = asObject(factValue);
    if (firstText(fact.motionId) !== firstText(motion.id) ||
        firstText(fact.kind) !==
          'verified_external_professional_target') {
      return false;
    }
    if (firstText(fact.provider) ===
        'people_data_labs_person_search') {
      if (personFact ||
          firstText(fact.provenance) !==
            PDL_SCOPED_DECISION_MAKER_PROVENANCE ||
          comparableURL(fact.url) !== comparableURL(publicUrl) ||
          !exactTextContains(
            `${firstText(fact.label)} ${firstText(fact.summary)}`,
            displayLabel
          ) ||
          !exactTextContains(
            `${firstText(fact.label)} ${firstText(fact.summary)}`,
            organization
          )) {
        return false;
      }
      personFact = fact;
      continue;
    }
    const organizationProvider = firstText(fact.provider);
    const expectedProvenance = organizationProvider ===
        OPPORTUNITY_DISCOVERY_WEB_SEARCH_PROVIDER
      ? 'openrouter_exa_url_citation'
      : organizationProvider === 'brave_web_search'
        ? 'read_only_professional_provider'
        : '';
    if (organizationFact || !expectedProvenance ||
        firstText(fact.provenance) !== expectedProvenance ||
        !safePublicHTTPSURL(fact.url) ||
        comparableURL(fact.url) === comparableURL(publicUrl) ||
        !exactTextContains(
          `${firstText(fact.label)} ${firstText(fact.summary)}`,
          organization
        )) {
      return false;
    }
    organizationFact = fact;
  }
  if (!personFact || !organizationFact) return false;
  const roles = new Set(evidenceValues.flatMap((fact) =>
    compactStrings(fact.roles).map(contractEnum)
  ));
  return requiredCommercialDiscoveryRolesForSlot(motion).every((role) =>
    roles.has(role)
  );
}

function commercialDiscoveryContainsPrivateContact(
  value,
  { allowBareCodePackage = false } = {}
) {
  const text = commercialDiscoveryContactInspectionText(value);
  const containsSocialHandle = [
    ...text.matchAll(/@[a-z0-9_][a-z0-9_.-]*/gi)
  ].some((match) => !commercialDiscoveryAtTokenIsCodePackage(
    text,
    match,
    allowBareCodePackage
  ));
  const containsPhoneLikeValue = commercialDiscoveryPhoneLikeMatches(
    text
  ).some((match) => !commercialDiscoveryNumberHasProductLabel(
    text,
    match.index
  ));
  return /(?:mailto:|tel:|sms:|work_email|mobile_phone|phone_numbers)/i.test(
    text
  ) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text) ||
    /\b[a-z0-9._%+-]+\s*(?:\[at\]|\(at\)|\bat\b)\s*[a-z0-9.-]+\s*(?:\[dot\]|\(dot\)|\bdot\b)\s*[a-z]{2,}\b/i.test(
      text
    ) ||
    containsSocialHandle ||
    containsPhoneLikeValue;
}

function commercialDiscoveryAtTokenIsCodePackage(
  text,
  match,
  allowBareCodePackage = false
) {
  const end = match.index + match[0].length;
  const packageSuffix = text.slice(end).match(
    /^\/[a-z0-9_][a-z0-9_.-]*/i
  );
  if (!packageSuffix) return false;
  if (allowBareCodePackage) return true;
  const prefix = text.slice(Math.max(0, match.index - 40), match.index);
  const suffix = text.slice(
    end + packageSuffix[0].length,
    end + packageSuffix[0].length + 32
  );
  return /\b(?:angular|dependency|framework|javascript|library|module|node|npm|package|react|sdk|typescript|vue)\s*$/i.test(
    prefix
  ) || /^\s+(?:application|audit|consultant|consulting|dependency|developer|development|engineer|framework|integration|library|maintenance|maintainer|migration|module|package|sdk|specialist|support)\b/i.test(
    suffix
  );
}

function commercialDiscoveryNumberHasProductLabel(text, index) {
  return /\b(?:application id|build id|catalog (?:code|id)|commit id|contract id|ean|gtin(?: 8| 12| 13| 14)?|imei|isbn(?: 10| 13)?|issue id|job (?:posting id|requisition)|npi|order id|part number|patent (?:application|number)|posting id|product (?:code|id)|reference id|requisition|rfp(?: id)?|serial number|sku|solicitation id|tender id|ticket id|upc)\s*(?:#|:|-)?\s*$/i.test(
    text.slice(Math.max(0, index - 48), index)
  );
}

function commercialDiscoveryLabeledNumberUsedAsContactRoute(text, index) {
  return /\b(?:call|contact|dial|fax|message|phone|reach|ring|sms|telephone|text)(?: [a-z0-9]+){0,4}\s*$/i.test(
    text.slice(Math.max(0, index - 64), index)
  );
}

function commercialDiscoveryPhoneLikeMatches(value) {
  const text = commercialDiscoveryContactInspectionText(value);
  return [
    ...text.matchAll(
      /(?<!\d)\+?\d[\d\s()./\-\u2010-\u2015\u2212]{5,30}\d(?!\d)/g
    )
  ].filter((match) => {
    const digitCount = (match[0].match(/\d/g) || []).length;
    return digitCount >= 7 && digitCount <= 15 &&
      !commercialDiscoveryPhoneLikeMatchIsObviouslyNonContact(
        text,
        match
      );
  });
}

function commercialDiscoveryPhoneLikeMatchIsObviouslyNonContact(text, match) {
  const raw = match[0].trim();
  const prefix = text.slice(Math.max(0, match.index - 32), match.index);
  const suffix = text.slice(
    match.index + match[0].length,
    match.index + match[0].length + 24
  );
  if (/[€£¥$]\s*$/.test(prefix) ||
      commercialDiscoveryHasISO4217CurrencyBefore(prefix) ||
      commercialDiscoveryHasISO4217CurrencyAfter(suffix) ||
      /^\s*dollars?\b/i.test(suffix)) {
    return true;
  }
  if (/^\s*(?:st|nd|rd|th)\s+(?:avenue|ave|boulevard|blvd|court|ct|drive|dr|highway|hwy|lane|ln|parkway|pkwy|place|pl|road|rd|street|st|terrace|way)\b/i.test(
    suffix
  )) {
    return true;
  }
  if (commercialDiscoveryValidCalendarDate(raw)) return true;
  const ipv4Parts = raw.split('.');
  if (ipv4Parts.length === 4 && ipv4Parts.every((part) =>
    /^\d{1,3}$/.test(part) && Number(part) <= 255
  )) {
    return true;
  }
  const cidr = raw.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/
  );
  if (cidr && cidr.slice(1, 5).every((part) => Number(part) <= 255) &&
      Number(cidr[5]) <= 32) {
    return true;
  }
  return /\b(?:v|ver|version)\s*$/i.test(prefix) &&
    /^\d+(?:\.\d+){2,3}$/.test(raw);
}

function commercialDiscoveryHasISO4217CurrencyBefore(value) {
  const match = value.match(/\b([a-z]{3})\s*$/i);
  return Boolean(match && commercialDiscoveryISO4217Currencies().has(
    match[1].toUpperCase()
  ));
}

function commercialDiscoveryHasISO4217CurrencyAfter(value) {
  const match = value.match(/^\s*([a-z]{3})\b/i);
  return Boolean(match && commercialDiscoveryISO4217Currencies().has(
    match[1].toUpperCase()
  ));
}

let cachedISO4217Currencies;

function commercialDiscoveryISO4217Currencies() {
  if (cachedISO4217Currencies) return cachedISO4217Currencies;
  const fallback = [
    'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'HKD', 'INR',
    'JPY', 'KRW', 'MXN', 'NZD', 'SGD', 'USD', 'ZAR'
  ];
  let values = fallback;
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      values = Intl.supportedValuesOf('currency');
    }
  } catch {
    values = fallback;
  }
  cachedISO4217Currencies = new Set(values);
  return cachedISO4217Currencies;
}

function commercialDiscoveryValidCalendarDate(value) {
  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return commercialDiscoveryCalendarPartsValid(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3])
    );
  }
  const local = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!local) return false;
  const first = Number(local[1]);
  const second = Number(local[2]);
  const year = Number(local[3]);
  return commercialDiscoveryCalendarPartsValid(year, first, second) ||
    commercialDiscoveryCalendarPartsValid(year, second, first);
}

function commercialDiscoveryCalendarPartsValid(year, month, day) {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 ||
      day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function commercialDiscoveryContactInspectionText(value) {
  return firstText(value)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
}

function redactCommercialDiscoveryContactTokens(value) {
  return firstText(value)
    .replace(/\b(?:mailto|tel|sms):[^\s<>"']+/gi, ' ')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ')
    .replace(/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g, ' ')
    .replace(/\b(?:work_email|mobile_phone|phone_numbers?)\b/gi, ' ')
    .replace(/@[A-Z0-9_][A-Z0-9_.-]*/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|,;:\-]+|[\s|,;:\-]+$/g, '')
    .trim();
}

function commercialDiscoveryPublicTrace(value) {
  const discovery = asObject(value);
  return compact({
    contractVersion: firstText(discovery.contractVersion),
    present: discovery.present === true,
    valid: discovery.valid === true,
    status: firstText(discovery.status),
    attempted: discovery.attempted === true,
    queryHash: firstText(discovery.queryHash),
    providersAttempted: compactStrings(discovery.providersAttempted),
    providerCalls: nonNegativeInteger(discovery.providerCalls) || 0,
    paidProviderCalls:
      nonNegativeInteger(discovery.paidProviderCalls) || 0,
    creditsUsed: nonNegativeInteger(discovery.creditsUsed) || 0,
    resultCount: nonNegativeInteger(discovery.resultCount) || 0,
    patientTargetingExcluded:
      discovery.patientTargetingExcluded === true,
    sideEffectsPerformed:
      nonNegativeInteger(discovery.sideEffectsPerformed) || 0,
    plan: discovery.plan?.present === true
      ? compact({
          contractVersion: firstText(discovery.plan.contractVersion),
          valid: discovery.plan.valid === true,
          status: firstText(discovery.plan.status),
          evidenceHash: firstText(discovery.plan.evidenceHash),
          hypothesisStatus: 'proposed_unverified',
          evidenceStatus: 'not_evidence',
          planIds: asArray(discovery.plan.plans).map((planValue) =>
            firstText(asObject(planValue).id)
          ),
          commercialRoles: compactStrings(asArray(
            discovery.plan.plans
          ).map((planValue) =>
            firstText(asObject(planValue).commercialRole)
          )),
          sideEffectsPerformed:
            nonNegativeInteger(discovery.plan.sideEffectsPerformed) || 0,
          rejectedReason: firstText(discovery.plan.rejectedReason)
        })
      : undefined,
    attempts: asArray(discovery.attempts).map((attemptValue) => {
      const attempt = asObject(attemptValue);
      return compact({
        id: firstText(attempt.id),
        provider: firstText(attempt.provider),
        operation: firstText(attempt.operation),
        queryHash: firstText(attempt.queryHash),
        status: firstText(attempt.status),
        estimatedSpendMicros:
          nonNegativeInteger(attempt.estimatedSpendMicros) || 0,
        actualSpendMicros:
          nonNegativeInteger(attempt.actualSpendMicros) || 0,
        creditsUsed: nonNegativeInteger(attempt.creditsUsed) || 0,
        resultCount: nonNegativeInteger(attempt.resultCount) || 0,
        failureCode: firstText(attempt.failureCode),
        completedAt: firstText(attempt.completedAt)
      });
    }),
    acceptedEvidenceRefs: asArray(discovery.evidence)
      .map((fact) => firstText(asObject(fact).evidenceRef)),
    acceptedCandidateIds: asArray(discovery.candidates)
      .map((candidate) => firstText(asObject(candidate).id)),
    rejectedReasons: asObject(discovery.rejectedReasons)
  });
}

function commercialDiscoveryReviewChannelForHypothesis(
  hypothesisValue,
  graphNodes,
  commercialDiscoveryValue,
  referenceTime
) {
  const hypothesis = asObject(hypothesisValue);
  if (!firstText(hypothesis.id) || !(graphNodes instanceof Map)) return '';
  const path = asObject(hypothesis.revenuePath);
  const nodes = compactStrings(hypothesis.evidenceRefs)
    .map((ref) => asObject(graphNodes.get(ref)))
    .filter((node) =>
      firstText(node.provenance) === COMMERCIAL_DISCOVERY_PROVENANCE
    );
  const discovery = normalizeCommercialDiscoveryEvidence(
    commercialDiscoveryValue,
    referenceTime
  );
  if (discovery.valid !== true || discovery.status !== 'found') return '';
  const motionIds = new Set(nodes
    .map((node) => firstText(node.commercialDiscoveryMotionId))
    .filter(Boolean));
  if (motionIds.size !== 1) return '';
  const [motionId] = motionIds;
  const motion = asArray(asObject(discovery.plan).plans)
    .map(asObject)
    .find((item) => firstText(item.id) === motionId);
  if (!motion || firstText(motion.acquisitionMode) !==
        firstText(path.acquisitionMode)) {
    return '';
  }
  const routeCandidates = asArray(discovery.candidates).map(asObject)
    .filter((candidate) =>
      firstText(candidate.motionId) === motionId &&
      candidate.exactNamedCandidate === true &&
      candidate.identityResolved === true &&
      commercialDiscoveryCandidateHasVerifiedPublicProfessionalRoute(
        candidate
      ) &&
      publicProfessionalRouteTextBindsCandidate(hypothesis, candidate)
    );
  const exactPartnerEvidenceRefs = new Set(nodes
    .filter((node) => {
      const roles = new Set(compactStrings(node.roles));
      return firstText(node.commercialDiscoveryMotionId) === motionId &&
        roles.has('acquisition') &&
        roles.has('channel_fit') &&
        roles.has('prospective_partner');
    })
    .map((node) => firstText(node.evidenceRef))
    .filter(Boolean));
  if (firstText(motion.commercialRole) === 'referral_partner' &&
      firstText(path.acquisitionMode) === 'partner_channel' &&
      routeCandidates.some((candidate) =>
        firstText(candidate.commercialRole) === 'referral_partner' &&
        firstText(candidate.provider) ===
          'people_data_labs_person_search' &&
        firstText(candidate.kind) === 'person' &&
        compactStrings(candidate.evidenceRefs).some((ref) =>
          exactPartnerEvidenceRefs.has(ref)
        )
      )) {
    return 'partner_channel';
  }
  const exactBuyerEvidenceRefs = new Set(nodes
    .filter((node) => {
      const roles = new Set(compactStrings(node.roles));
      return firstText(node.commercialDiscoveryMotionId) === motionId &&
        firstText(node.commercialDiscoveryKind) ===
          'verified_external_professional_target' &&
        Boolean(safePublicHTTPSURL(node.url)) &&
        roles.has('acquisition') &&
        roles.has('channel_fit') &&
        roles.has('defined_buyer');
    })
    .map((node) => firstText(node.evidenceRef))
    .filter(Boolean));
  const exactBuyerRoute =
    firstText(motion.commercialRole) === 'buyer' &&
    DISCOVERY_PLAN_ACQUISITION_MODES_BY_ROLE.get('buyer')?.has(
      firstText(path.acquisitionMode)
    ) &&
    exactBuyerEvidenceRefs.size > 0 &&
    routeCandidates.some((candidate) =>
      firstText(candidate.commercialRole) === 'buyer' &&
      firstText(candidate.provider) ===
        'people_data_labs_person_search' &&
      firstText(candidate.kind) === 'person' &&
      compactStrings(candidate.evidenceRefs).some((ref) =>
        exactBuyerEvidenceRefs.has(ref)
      )
    );
  if (exactBuyerRoute) return 'public_professional_url';
  const publicPaidDemandModes = new Set([
    'inbound',
    'partner_channel',
    'permissioned_outreach'
  ]);
  const completePaidDemandNode =
    firstText(motion.commercialRole) === 'paid_demand' &&
    publicPaidDemandModes.has(firstText(path.acquisitionMode)) &&
    nodes.some((node) => {
      const roles = new Set(compactStrings(node.roles));
      return firstText(node.commercialDiscoveryMotionId) === motionId &&
        firstText(node.commercialDiscoveryKind) ===
          'verified_external_live_demand' &&
        Boolean(safePublicHTTPSURL(node.url)) &&
        roles.has('acquisition') &&
        roles.has('channel_fit') &&
        roles.has('conversion_destination') &&
        roles.has('defined_buyer') &&
        roles.has('demand_signal') &&
        roles.has('paid_conversion') &&
        roles.has('paid_offer');
    });
  if (completePaidDemandNode &&
      firstText(motion.searchMode) === 'active_job_posting') {
    return firstText(path.revenueMechanism) === 'compensated_role'
      ? 'application_page'
      : '';
  }
  if (completePaidDemandNode &&
      firstText(motion.searchMode) === 'public_live_demand') {
    // This authorizes only presenting a review-first recommendation for the
    // public demand-response route. Execution remains none and the final gate
    // records that explicit approval is still required before submission.
    return 'public_paid_demand_response';
  }
  return '';
}

function commercialDiscoveryCandidateHasVerifiedPublicProfessionalRoute(
  candidateValue
) {
  const candidate = asObject(candidateValue);
  const publicUrl = safePublicProfessionalProfileURL(candidate.publicUrl);
  return Boolean(publicUrl) && asArray(candidate.contactPaths)
    .map(asObject)
    .some((path) =>
      firstText(path.kind) === 'public_professional_url' &&
      path.available === true &&
      path.verified === true &&
      comparableURL(safePublicProfessionalProfileURL(path.reference)) ===
        comparableURL(publicUrl)
    );
}

function safePublicProfessionalProfileURL(value) {
  const publicUrl = safePublicHTTPSURL(value);
  if (!publicUrl) return '';
  try {
    const parsed = new URL(publicUrl);
    const host = canonicalPublicHostname(parsed.hostname);
    const path = parsed.pathname.replace(/\/+$/, '');
    if (host !== 'linkedin.com' || parsed.search || parsed.hash ||
        parsed.port || !/^\/in\/[a-z0-9_-]+$/i.test(path)) {
      return '';
    }
    parsed.hostname = 'linkedin.com';
    parsed.pathname = path;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function publicProfessionalRouteTextBindsCandidate(
  hypothesisValue,
  candidateValue
) {
  const hypothesis = asObject(hypothesisValue);
  const candidate = asObject(candidateValue);
  const publicUrl = safePublicProfessionalProfileURL(
    candidate.publicUrl
  );
  const routeTexts = [
    firstText(hypothesis.channel),
    firstText(hypothesis.action)
  ];
  if (!publicUrl || routeTexts.some((text) => {
    const urls = exactHTTPSURLsInText(text);
    return urls.length !== 1 ||
      safePublicProfessionalProfileURL(urls[0]) !== publicUrl ||
      !/\b(?:linkedin|public professional profile|verified professional profile)\b/i.test(
        text
      );
  })) {
    return false;
  }
  return !routeTexts.some((text) =>
    discoveryAcquisitionRequestsPrivateContact(text) ||
    /\b(?:contact form|web form)\b/i.test(text)
  );
}

function exactHTTPSURLsInText(value) {
  return (firstText(value).match(/https:\/\/[^\s<>"']+/gi) || [])
    .map((url) => url.replace(/[),.;!?\]}]+$/g, ''))
    .filter(Boolean);
}

function finalizeOpportunityTournamentResult(rawValue, argsValue) {
  const raw = asObject(rawValue);
  const args = asObject(argsValue);
  const payload = asObject(asObject(args.job).payload);
  const objective = normalizeObjective(payload.objective, payload);
  const constraints = normalizeConstraints(objective, payload);
  const commercialContext = normalizeCommercialContext(
    payload,
    objective,
    constraints
  );
  const winner = asObject(raw.winner);
  const winnerHypothesis = asArray(raw.hypotheses)
    .map(asObject)
    .find((hypothesis) =>
      firstText(hypothesis.id) === firstText(winner.hypothesisId)
    );
  const path = asObject(
    winnerHypothesis?.revenuePath ?? winner.revenuePath
  );
  const hypothesisChannel = firstText(winnerHypothesis?.channel);
  const configuredAllowedChannel = commercialContext.allowedChannels.find(
    (channel) =>
      !providerAttestedReviewChannelAlias(channel) &&
      allowedValue(hypothesisChannel, [channel])
  ) || '';
  const graphNodes = new Map(
    asArray(asObject(raw.commercialEvidenceGraph).nodes)
      .map(asObject)
      .map((node) => [firstText(node.evidenceRef), node])
  );
  const discoveryReviewChannel =
    commercialDiscoveryReviewChannelForHypothesis(
      winnerHypothesis,
      graphNodes,
      payload.commercialDiscoveryEvidence,
      args.now || new Date()
    );
  const allowedChannel = configuredAllowedChannel ||
    discoveryReviewChannel;
  const dimensionRefs = (name) => compactStrings(
    asObject(asObject(winnerHypothesis?.provenance).dimensions)[name]
      ?.evidenceRefs
  );
  const verifiedRole = (refs, role) => refs.some((ref) => {
    const node = asObject(graphNodes.get(ref));
    return node.approved === true && asArray(node.roles).includes(role);
  });
  const buyerRefs = dimensionRefs('buyerSegment');
  const offerRefs = dimensionRefs('offer');
  const critic = asObject(asObject(raw.searchSpace).commercialCritic);
  const familyID = firstText(
    asObject(winnerHypothesis?.provenance).strategyFamilyId
  );
  const criticAttempted = critic.attempted === true;
  const criticAccepted =
    firstText(critic.contract) === OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT &&
    criticAttempted &&
    critic.enforced === true &&
    critic.valid === true &&
    firstText(critic.verdict) === 'accepted' &&
    Boolean(firstText(critic.reason)) &&
    asArray(critic.acceptedFamilyIds).includes(familyID) &&
    asArray(critic.acceptedFinalistIds).includes(
      firstText(winnerHypothesis?.id)
    ) &&
    firstText(asArray(critic.selectedOrdering)[0]) ===
      firstText(winnerHypothesis?.id);
  const activeAction = asObject(path.activeRevenueAction);
  const causalSemantic = revenuePathSemanticChecks(path);
  const commercialConstraint = deterministicCommercialHypothesisGate(
    winnerHypothesis,
    raw.commercialEvidenceGraph
  );
  const primarilyOperationalOrObservational = winnerHypothesis
    ? passiveOrObservationalPrimaryAction(winnerHypothesis.action) ||
      operationOnlyAction(winnerHypothesis.action)
    : true;
  const gate = {
    contractVersion: REVENUE_GATE_VERSION,
    reachableBuyer:
      Boolean(firstText(winnerHypothesis?.buyerSegment)) &&
      buyerRefs.length > 0 &&
      buyerRefs.some((ref) => asObject(graphNodes.get(ref)).approved === true),
    currentPaidOffer:
      paidOfferText(firstText(winnerHypothesis?.offer)) &&
      verifiedRole(offerRefs, 'paid_offer'),
    namedAcquisitionMechanism:
      ACQUISITION_MODES.has(firstText(path.acquisitionMode)) &&
      Boolean(hypothesisChannel),
    acquisitionDistinctFromDestination:
      Boolean(hypothesisChannel) &&
      causalSemantic.conversionDestination &&
      comparable(hypothesisChannel) !==
        comparable(path.conversionDestination),
    actionCanBeginNow:
      activeAction.active === true &&
      commercialConstraint.commercialConstraintsSatisfied === true &&
      Boolean(allowedChannel),
    knownPermissions: Boolean(allowedChannel),
    allowedChannel,
    allowedChannelSource: configuredAllowedChannel
      ? 'configured_capability'
      : discoveryReviewChannel
        ? 'provider_attested_review_route'
        : '',
    discoveryRouteRequiresApproval:
      Boolean(discoveryReviewChannel && !configuredAllowedChannel),
    observablePaidConversion: causalSemantic.observableRevenue,
    attribution: causalSemantic.attributionSignal,
    counterfactualIncrementality: causalSemantic.incrementalIncome,
    numericStop: causalSemantic.numericStop,
    primarilyOperationalOrObservational,
    activeRevenueAction: activeAction.active === true,
    causalAcquisitionPath:
      activeAction.causalAcquisitionPath === true,
    incrementalRevenueOutcome:
      activeAction.incrementalRevenueOutcome === true,
    commercialConstraintsSatisfied:
      commercialConstraint.commercialConstraintsSatisfied === true,
    criticContract: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
    criticVerdict: criticAttempted
      ? criticAccepted ? 'accepted' : 'rejected'
      : 'not_run',
    reason: ''
  };
  const requiredPositive = [
    'reachableBuyer',
    'currentPaidOffer',
    'namedAcquisitionMechanism',
    'acquisitionDistinctFromDestination',
    'actionCanBeginNow',
    'knownPermissions',
    'observablePaidConversion',
    'attribution',
    'counterfactualIncrementality',
    'numericStop',
    'activeRevenueAction',
    'causalAcquisitionPath',
    'incrementalRevenueOutcome',
    'commercialConstraintsSatisfied'
  ];
  gate.passed = raw.status === 'completed' &&
    requiredPositive.every((field) => gate[field] === true) &&
    gate.primarilyOperationalOrObservational === false &&
    criticAccepted;
  if (!gate.passed) {
    const failed = requiredPositive.filter((field) => gate[field] !== true);
    if (gate.primarilyOperationalOrObservational) {
      failed.push('primarily_operational_or_observational');
    }
    if (!criticAccepted) {
      failed.push(criticAttempted
        ? 'critic_rejected_or_unbound'
        : 'critic_not_run');
    }
    gate.reason = failed.length > 0
      ? `Failed closed: ${failed.join(', ')}.`
      : 'No completed grounded revenue recommendation was available.';
  } else {
    gate.reason =
      'The recommendation passed deterministic causal, incremental-revenue, permission-boundary, and critic checks.';
  }
  let coherent = raw;
  if (raw.status === 'completed' && !gate.passed) {
    const criticTechnicalFailure =
      criticAttempted !== true ||
      critic.enforced !== true ||
      critic.valid !== true;
    const evidenceCatalog = buildEvidenceCatalog(
      payload,
      asObject(args.context),
      args.now || new Date(),
      {
        includeSystemAttributionCapability:
          firstText(
            asObject(asObject(payload.commercialDiscoveryEvidence).plan)
              .contractVersion
          ) === OPPORTUNITY_DISCOVERY_PLAN_CONTRACT
      }
    );
    const fallbackExperiment = revenueEvidenceExperiment({
      objective,
      evidenceCatalog,
      evidenceHash: firstText(raw.evidenceHash, stableHash(evidenceCatalog)),
      missingEvidence: criticTechnicalFailure
        ? ['commercial_critic_contract_recovery']
        : requiredPositive
            .filter((field) => gate[field] !== true)
            .concat(criticAccepted ? [] : ['critic_rejected_commercial_motion']),
      referenceTime: validDate(args.now || new Date()).toISOString(),
      commercialContext,
      commercialEvidenceGraph: raw.commercialEvidenceGraph
    });
    coherent = {
      ...raw,
      status: 'skipped',
      summary: criticTechnicalFailure
        ? 'The result failed closed because the mandatory comparative critic was unavailable or invalid.'
        : 'The result failed closed because the proposed winner did not pass every causal incremental-revenue gate.',
      hypotheses: asArray(raw.hypotheses).map((hypothesisValue) => ({
        ...asObject(hypothesisValue),
        status: 'rejected'
      })),
      winner: null,
      runnerUp: null,
      nextExperiment: fallbackExperiment,
      gate: researchOnlyGate(
        criticTechnicalFailure
          ? 'commercial_critic_failed'
          : 'needs_more_approved_evidence',
        gate.reason
      )
    };
  }
  const coherentExperiment = asObject(coherent.nextExperiment);
  const technicalRecovery =
    firstText(asObject(coherent.gate).decision) === 'technical_recovery' ||
    /^strategy_generation_/i.test(firstText(coherentExperiment.kind));
  const resultType = gate.passed
    ? 'immediate_revenue_action'
    : technicalRecovery
      ? 'technical_recovery'
      : coherentExperiment.noGroundedPath === true
        ? 'no_grounded_path'
        : Object.keys(coherentExperiment).length > 0
        ? 'revenue_evidence_gap'
        : 'no_grounded_path';
  const coherentWinner = asObject(coherent.winner);
  const recommendedAction = Object.keys(coherentWinner).length > 0
    ? firstText(coherentWinner.action)
    : Object.keys(coherentExperiment).length > 0
      ? firstText(coherentExperiment.action)
      : firstText(
          coherent.summary,
          asObject(coherent.gate).reason,
          'No immediate revenue action is grounded by the approved evidence.'
        );
  const experimentAllowedChannel = commercialContext.allowedChannels.find(
    (channel) =>
      allowedValue(
        firstText(coherentExperiment.acquisitionMechanism),
        [channel]
      ) ||
      comparable(firstText(coherentExperiment.acquisitionMechanism))
        .includes(comparable(channel))
  ) || '';
  return {
    ...coherent,
    result: {
      resultContract: OPPORTUNITY_TOURNAMENT_RESULT_CONTRACT,
      resultType,
      recommendedAction,
      executionAuthorization: 'none',
      requiresReview: true,
      sideEffectsPerformed: 0,
      allowedChannel: gate.passed
        ? allowedChannel
        : resultType === 'revenue_evidence_gap' && experimentAllowedChannel
          ? experimentAllowedChannel
          : 'none',
      permissionRequired: 'explicit_user_approval',
      incrementalRevenueGate: gate
    }
  };
}

export function buildEvidenceCatalog(
  payload,
  context = {},
  referenceTime = new Date(),
  optionsValue = {}
) {
  payload = asObject(payload);
  context = asObject(context);
  const options = asObject(optionsValue);
  const commercialDiscovery = Object.keys(
    asObject(options.commercialDiscovery)
  ).length > 0
    ? asObject(options.commercialDiscovery)
    : normalizeCommercialDiscoveryEvidence(
        payload.commercialDiscoveryEvidence,
        referenceTime
      );
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
    const rawSummary = firstText(
      raw.summary,
      raw.description,
      raw.evidenceSummary,
      raw.detail,
      raw.excerpt,
      raw.body,
      raw.value
    );
    const url = safePublicURL(firstText(raw.url, raw.sourceUrl, raw.publicUrl));
    const sourceID = firstText(raw.sourceId, raw.sourceID);
    const rawEvidence = {
      type,
      label,
      summary: rawSummary,
      url,
      observedAt: firstText(
        raw.observedAt,
        raw.updatedAt,
        raw.publishedAt
      ),
      endDate: firstText(raw.endDate),
      current: typeof raw.current === 'boolean'
        ? raw.current
        : undefined,
      status: firstText(raw.status)
    };
    const trustedOwnedPaidConversion =
      asObject(origin).approvedSourceObservation === true &&
      asObject(origin).profileControlledSource === true &&
      inboundAssetEvidenceSupportsPaidConversion(
        rawEvidence,
        referenceTime
      );
    const summary = trustedOwnedPaidConversion
      ? boundedPaidConversionEvidenceSummary(
          rawSummary,
          420,
          label,
          rawEvidence,
          referenceTime
        )
      : boundedEvidenceSummary(rawSummary, 420, label);
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
    if (/^external_discovery:/i.test(id) &&
        asObject(origin).providerAttestedCommercialDiscovery !== true) {
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
      label: boundedEvidenceSummary(
        label || summary,
        180,
        label || summary
      ),
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
      providerAttestedCommercialDiscovery:
        asObject(origin).providerAttestedCommercialDiscovery === true
          ? true
          : undefined,
      commercialDiscoveryProvider: truncate(firstText(
        asObject(origin).commercialDiscoveryProvider
      ), 100),
      commercialDiscoveryMotionId: truncate(firstText(
        asObject(origin).commercialDiscoveryMotionId
      ), 80),
      commercialDiscoveryProvenance: truncate(firstText(
        asObject(origin).commercialDiscoveryProvenance
      ), 100),
      commercialDiscoveryKind: truncate(firstText(
        asObject(origin).commercialDiscoveryKind
      ), 100),
      commercialDiscoveryRoles: compactStrings(
        asObject(origin).commercialDiscoveryRoles
      ),
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
  // This capability is part of ProfileScribe's verified control plane, not a
  // caller assertion or a source observation. It allows a recommendation to
  // specify how a future paid outcome will be attributed without pretending
  // the user already has a CRM or referral-source field. Its typed role is
  // intentionally locked to attribution below and cannot ground any other
  // element of the commercial path.
  if (options.includeSystemAttributionCapability === true &&
      !seen.has(PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY.id)) {
    seen.add(PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY.id);
    catalog.push({
      ...PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY,
      systemCapabilityRoles: [
        ...PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY.systemCapabilityRoles
      ],
      aliases: []
    });
  }
  if (commercialDiscovery.valid === true) {
    for (const factValue of asArray(commercialDiscovery.evidence)) {
      const fact = asObject(factValue);
      append({
        id: firstText(fact.evidenceRef),
        type: firstText(
          fact.kind,
          'verified_external_professional_target'
        ),
        label: firstText(fact.label),
        summary: firstText(fact.summary),
        url: firstText(fact.url),
        observedAt: firstText(fact.observedAt),
        current: true,
        status: 'verified_current',
        confidence: 'high'
      }, 'verified_external_professional_target', undefined, {
        providerAttestedCommercialDiscovery: true,
        commercialDiscoveryMotionId: firstText(fact.motionId),
        commercialDiscoveryProvider: firstText(fact.provider),
        commercialDiscoveryProvenance: firstText(fact.provenance),
        commercialDiscoveryKind: firstText(fact.kind),
        commercialDiscoveryRoles: compactStrings(fact.roles)
      });
    }
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
      const leftDiscovery =
        left.providerAttestedCommercialDiscovery === true ? 1 : 0;
      const rightDiscovery =
        right.providerAttestedCommercialDiscovery === true ? 1 : 0;
      if (leftDiscovery !== rightDiscovery) {
        return rightDiscovery - leftDiscovery;
      }
      const leftPaidAsset =
        ownerControlledPaidAssetIDs.has(left.id) ? 1 : 0;
      const rightPaidAsset =
        ownerControlledPaidAssetIDs.has(right.id) ? 1 : 0;
      if (leftPaidAsset !== rightPaidAsset) {
        return rightPaidAsset - leftPaidAsset;
      }
      return evidenceQuality(right) - evidenceQuality(left) ||
        compareStableText(left.id, right.id);
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
  timestamp,
  criticAcceptedFamilyIDs = null
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
  let criticRejectedCount = 0;
  const motionConflictDimensions = emptyMotionConflictDimensions();
  let revenueRejectedCount = 0;
  const revenueRejectionReasons = {};

  for (const flatIndex of indexes) {
    const selected = decodeCartesianIndex(flatIndex, dimensionValues);
    const tuple = Object.fromEntries(
      DIMENSIONS.map(([name], index) => [name, selected[index]])
    );
    let compatibleFamilies = commonCompatibilityFamilies(tuple, seedSet);
    if (compatibleFamilies.length === 0) {
      incompatibleCount += 1;
      filteredCount += 1;
      continue;
    }
    if (criticAcceptedFamilyIDs instanceof Set) {
      compatibleFamilies = compatibleFamilies.filter((familyID) =>
        criticAcceptedFamilyIDs.has(familyID)
      );
      if (compatibleFamilies.length === 0) {
        criticRejectedCount += 1;
        filteredCount += 1;
        continue;
      }
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
    criticRejectedCount,
    motionConflictDimensions,
    revenueRejectedCount,
    revenueRejectionReasons: Object.fromEntries(
      Object.entries(revenueRejectionReasons).sort(([left], [right]) =>
      compareStableText(left, right)
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
    // V5 uses one bounded generator and one compact comparative critic. If
    // the second call is consumed by structured repair, the recommendation
    // fails closed as technical recovery because an uncriticized result is
    // never immediate-action eligible.
    maxLLMCalls: clampInteger(raw.maxLLMCalls, 0, 2, 2),
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

function normalizeCommercialContext(payloadValue, objectiveValue, constraintsValue) {
  const payload = asObject(payloadValue);
  const objective = asObject(objectiveValue);
  const constraints = asObject(constraintsValue);
  const raw = asObject(payload.commercialContext);
  const destinations = firstArray(
    raw.activeDistributionDestinations,
    raw.distributionDestinations,
    raw.destinations,
    raw.capabilities
  ).slice(0, 16).map(asObject);
  const distributionAccounts = asArray(raw.distributionAccounts)
    .map(asObject)
    .filter((account) =>
      /^(?:active|connected|enabled|ready)$/i.test(
        firstText(account.status)
      )
    )
    .slice(0, 16)
    .map((account) => compact({
      provider: truncate(firstText(
        account.provider,
        account.service,
        account.channel,
        account.name
      ), 80),
      status: truncate(firstText(account.status), 40),
      mode: truncate(firstText(account.mode), 40),
      capabilities: compactStrings(account.capabilities)
        .slice(0, 12)
        .map((value) => truncate(value, 80))
    }))
    .filter((account) => Boolean(account.provider));
  const profile = asObject(raw.profile);
  const focus = asArray(profile.currentFocus)
    .slice(0, 8)
    .map(asObject)
    .map((item) => compact({
      name: truncate(firstText(item.name, item.title), 120),
      description: truncate(firstText(item.description, item.summary), 240),
      status: truncate(firstText(item.status), 40),
      priority: truncate(firstText(item.priority), 40)
    }))
    .filter((item) => Boolean(item.name || item.description));
  return {
    allowedChannels: compactStrings([
      ...asArray(raw.allowedChannels),
      ...asArray(objective.allowedChannels),
      ...asArray(constraints.allowedChannels),
      ...destinations.flatMap((destination) => [
        destination.channel,
        destination.service,
        destination.provider,
        destination.name,
        destination.label
      ]),
      ...distributionAccounts.flatMap((account) => [
        account.provider
      ])
    ])
      .filter((value) =>
        !providerAttestedReviewChannelAlias(value)
      )
      .slice(0, 20)
      .map((value) => truncate(value, 80)),
    allowedActions: compactStrings([
      ...asArray(raw.allowedActions),
      ...asArray(raw.permissions),
      ...asArray(raw.capabilityScopes),
      ...asArray(objective.allowedActions),
      ...asArray(constraints.allowedActions),
      ...distributionAccounts.flatMap((account) =>
        asArray(account.capabilities)
      )
    ]).slice(0, 24).map((value) => truncate(value, 100)),
    constraints: compactStrings([
      ...asArray(raw.constraints),
      ...asArray(objective.constraints),
      ...asArray(constraints.rules)
    ]).slice(0, 20).map((value) => truncate(value, 240)),
    profile: compact({
      profession: truncate(firstText(profile.profession), 160),
      location: truncate(firstText(profile.location), 120),
      availability: truncate(firstText(profile.availability), 160),
      specialties: compactStrings(profile.specialties)
        .slice(0, 16)
        .map((value) => truncate(value, 100)),
      serviceAreas: compactStrings(profile.serviceAreas)
        .slice(0, 16)
        .map((value) => truncate(value, 100)),
      currentFocus: focus
    }),
    distributionAccounts,
    priorAttributedOutcomes: normalizePriorOutcomes(
      raw.priorAttributedOutcomes
    ),
    permissionRequired: firstText(
      raw.permissionRequired,
      'explicit_user_approval'
    )
  };
}

function buildCommercialEvidenceGraph(evidenceCatalogValue, optionsValue = {}) {
  const evidenceCatalog = asArray(evidenceCatalogValue).map(asObject);
  const options = asObject(optionsValue);
  const commercialContext = asObject(options.commercialContext);
  const objective = asObject(options.objective);
  const constraints = asObject(options.constraints);
  const priorOutcomes = normalizePriorOutcomes([
    ...asArray(options.priorOutcomes),
    ...asArray(commercialContext.priorAttributedOutcomes)
  ]);
  const evidenceNodes = evidenceCatalog
    .filter((evidence) => !/^source:/i.test(firstText(evidence.id)))
    .map((evidence) => {
      const text = compactStrings([
        evidence.label,
        evidence.summary,
        evidence.url
      ]).join(' ');
      const providerAttestedDiscovery =
        evidence.providerAttestedCommercialDiscovery === true;
      const systemAttributionCapability =
        verifiedSystemAttributionCapabilityEvidence(evidence);
      const roles = providerAttestedDiscovery
        ? commercialDiscoveryGraphRoles(evidence)
        : systemAttributionCapability
          ? ['attribution']
          : commercialEvidenceRoles(text);
      // This role is assigned only after deterministic owner-origin,
      // freshness, affirmative paid/reimbursable offer, and conversion-ready
      // asset checks. Keep the graph consistent with that stronger fact
      // instead of asking the planner to rediscover destination/conversion
      // semantics from a compacted evidence excerpt.
      if (firstText(evidence.revenueAssetRole) ===
          'current_owner_paid_conversion_asset') {
        roles.push(
          'paid_offer',
          'conversion_destination',
          'paid_conversion'
        );
      }
      if (firstText(evidence.revenueAssetRole) === 'informational_only') {
        for (const role of [
          'paid_offer',
          'conversion_destination',
          'paid_conversion'
        ]) {
          const index = roles.indexOf(role);
          if (index >= 0) roles.splice(index, 1);
        }
      }
      const channelFitChannels = providerAttestedDiscovery &&
          roles.includes('channel_fit')
        ? commercialDiscoveryChannelFitChannels(
            evidence,
            commercialContext.allowedChannels
          )
        : commercialChannelFitChannels(
            text,
            commercialContext.allowedChannels
          );
      if (channelFitChannels.length > 0) roles.push('channel_fit');
      return compact({
        evidenceRef: firstText(evidence.id),
        sourceId: firstText(evidence.sourceId),
        type: firstText(evidence.type),
        label: truncate(firstText(evidence.label), 180),
        summary: truncate(firstText(evidence.summary), 320),
        url: safePublicURL(evidence.url),
        roles: compactStrings(roles),
        channelFitChannels,
        observedAt: firstText(evidence.observedAt),
        approved: evidence.approvedSourceObservation === true ||
          providerAttestedDiscovery || systemAttributionCapability,
        provenance: providerAttestedDiscovery
          ? COMMERCIAL_DISCOVERY_PROVENANCE
          : systemAttributionCapability
            ? PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY
                .systemCapabilityProvenance
          : evidence.approvedSourceObservation === true
            ? 'approved_source_observation'
            : 'profile_or_caller_fact',
        ownerControlled: evidence.profileControlledSource === true ||
          systemAttributionCapability,
        revenueAssetRole: firstText(evidence.revenueAssetRole),
        provider: providerAttestedDiscovery
          ? firstText(evidence.commercialDiscoveryProvider)
          : undefined,
        commercialDiscoveryMotionId: providerAttestedDiscovery
          ? firstText(evidence.commercialDiscoveryMotionId)
          : undefined,
        providerProvenance: providerAttestedDiscovery
          ? firstText(evidence.commercialDiscoveryProvenance)
          : undefined,
        commercialDiscoveryKind: providerAttestedDiscovery
          ? firstText(evidence.commercialDiscoveryKind)
          : undefined,
        commercialDiscoveryRoles: providerAttestedDiscovery
          ? compactStrings(evidence.commercialDiscoveryRoles)
          : undefined,
        prospectiveExternalTarget: providerAttestedDiscovery
          ? true
          : undefined,
        verifiedSystemCapability: systemAttributionCapability
          ? true
          : undefined,
        systemCapabilitySource: systemAttributionCapability
          ? PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY
              .systemCapabilitySource
          : undefined,
        systemCapabilityRoles: systemAttributionCapability
          ? ['attribution']
          : undefined
      });
    });
  const contextNodes = commercialContextEvidenceNodes({
    commercialContext,
    objective,
    constraints,
    priorOutcomes
  });
  const nodes = [...evidenceNodes, ...contextNodes];
  const verifiedFacts = nodes
    .filter((node) =>
      node.approved === true ||
      /^(?:user_declared|user_constraint|verified_prior_outcome|permission_capability)$/.test(
        firstText(node.provenance)
      )
    )
    .flatMap((node) => asArray(node.roles).map((role) => ({
      evidenceRef: node.evidenceRef,
      role,
      status: 'verified',
      provenance: node.provenance
    })));
  const inferences = nodes
    .filter((node) =>
      node.approved !== true &&
      firstText(node.provenance) === 'profile_or_caller_fact'
    )
    .flatMap((node) => asArray(node.roles).map((role) => ({
      evidenceRef: node.evidenceRef,
      role,
      status: 'inferred_unverified'
    })));
  const verifiedRoles = new Set(
    verifiedFacts.map((fact) => fact.role)
  );
  const definedBuyerEvidenceRefs = compactStrings(
    verifiedFacts
      .filter((fact) => fact.role === 'defined_buyer')
      .map((fact) => fact.evidenceRef)
  );
  const inferredBuyerEvidenceRefs = compactStrings(
    inferences
      .filter((fact) => fact.role === 'defined_buyer')
      .map((fact) => fact.evidenceRef)
  );
  const missingFacts = [
    'defined_buyer',
    'paid_offer',
    'acquisition',
    'conversion_destination',
    'paid_conversion',
    'attribution',
    'channel_fit'
  ].filter((role) => !verifiedRoles.has(role));
  return {
    contractVersion: 'commercial_evidence_graph_v2',
    nodes,
    verifiedFacts,
    inferences,
    missingFacts,
    definedBuyer: {
      status: definedBuyerEvidenceRefs.length > 0
        ? 'verified'
        : inferredBuyerEvidenceRefs.length > 0
          ? 'inferred'
          : 'missing',
      evidenceRefs: definedBuyerEvidenceRefs.length > 0
        ? definedBuyerEvidenceRefs
        : inferredBuyerEvidenceRefs
    },
    summary: {
      existingCustomerOrPatientEvidenceRefs: refsForCommercialRoles(
        nodes,
        ['existing_customer', 'existing_patient']
      ),
      namedPartnerOrReferralEvidenceRefs: refsForCommercialRoles(
        nodes,
        ['named_partner', 'referral_relationship']
      ),
      prospectivePartnerEvidenceRefs: refsForCommercialRoles(
        nodes,
        ['prospective_partner']
      ),
      demandOrEngagementEvidenceRefs: refsForCommercialRoles(
        nodes,
        ['demand_signal', 'engagement_signal']
      ),
      channelFitEvidenceRefs: refsForCommercialRoles(nodes, ['channel_fit']),
      geographicConstraintEvidenceRefs: refsForCommercialRoles(
        nodes,
        ['geographic_constraint']
      ),
      capacityConstraintEvidenceRefs: refsForCommercialRoles(
        nodes,
        ['capacity_constraint']
      ),
      timingConstraintEvidenceRefs: refsForCommercialRoles(
        nodes,
        ['timing_constraint']
      ),
      priorAttributedOutcomeEvidenceRefs: refsForCommercialRoles(
        nodes,
        ['prior_attributed_outcome']
      )
    }
  };
}

function projectCommercialEvidenceGraphForPrompt(
  graphValue,
  promptEvidenceCatalogValue,
  optionsValue = {}
) {
  const graph = asObject(graphValue);
  const compactProjection =
    asObject(optionsValue).compactProjection === true;
  const descriptiveChars = compactProjection ? 64 : 100;
  const allowedEvidenceRefs = new Set(
    asArray(promptEvidenceCatalogValue)
      .map((item) => firstText(asObject(item).id))
      .filter(Boolean)
  );
  const nodes = asArray(graph.nodes)
    .map(asObject)
    .filter((node) =>
      /^commercial_context:/i.test(firstText(node.evidenceRef)) ||
      allowedEvidenceRefs.has(firstText(node.evidenceRef))
    )
    .map((node) => compact({
      evidenceRef: firstText(node.evidenceRef),
      roles: compactStrings(node.roles),
      channelFitChannels: compactStrings(node.channelFitChannels),
      revenueAssetRole: firstText(node.revenueAssetRole),
      provenance: firstText(node.provenance),
      provider: truncate(firstText(node.provider), descriptiveChars),
      commercialDiscoveryMotionId: truncate(firstText(
        node.commercialDiscoveryMotionId
      ), 80),
      providerProvenance: truncate(firstText(
        node.providerProvenance
      ), descriptiveChars),
      commercialDiscoveryKind: truncate(firstText(
        node.commercialDiscoveryKind
      ), descriptiveChars),
      commercialDiscoveryRoles: compactStrings(
        node.commercialDiscoveryRoles
      ),
      prospectiveExternalTarget:
        node.prospectiveExternalTarget === true ? true : undefined,
      verifiedSystemCapability:
        node.verifiedSystemCapability === true ? true : undefined,
      systemCapabilitySource: truncate(firstText(
        node.systemCapabilitySource
      ), descriptiveChars),
      systemCapabilityRoles: compactStrings(
        node.systemCapabilityRoles
      ),
      location: truncate(firstText(node.location),
        compactProjection ? 64 : 96),
      availability: truncate(firstText(node.availability),
        compactProjection ? 64 : 96),
      serviceAreas: compactStrings(node.serviceAreas)
        .slice(0, compactProjection ? 4 : 8)
        .map((value) => truncate(
          value,
          compactProjection ? 64 : 100
        )),
      channel: truncate(firstText(node.channel),
        compactProjection ? 64 : 96),
      linkedEvidenceRefs: compactStrings(node.linkedEvidenceRefs)
        .filter((ref) => allowedEvidenceRefs.has(ref))
        .slice(0, compactProjection ? 4 : 8)
    }));
  const projectedRefs = new Set(
    nodes.map((node) => firstText(node.evidenceRef)).filter(Boolean)
  );
  const verifiedFacts = asArray(graph.verifiedFacts)
    .map(asObject)
    .filter((fact) => projectedRefs.has(firstText(fact.evidenceRef)))
    .map((fact) => ({
      evidenceRef: firstText(fact.evidenceRef),
      role: firstText(fact.role)
    }));
  const inferences = asArray(graph.inferences)
    .map(asObject)
    .filter((fact) => projectedRefs.has(firstText(fact.evidenceRef)))
    .map((fact) => ({
      evidenceRef: firstText(fact.evidenceRef),
      role: firstText(fact.role)
    }));
  const verifiedRoles = new Set(
    verifiedFacts.map((fact) => firstText(fact.role)).filter(Boolean)
  );
  const definedBuyerEvidenceRefs = compactStrings(
    verifiedFacts
      .filter((fact) => firstText(fact.role) === 'defined_buyer')
      .map((fact) => fact.evidenceRef)
  );
  const inferredBuyerEvidenceRefs = compactStrings(
    inferences
      .filter((fact) => firstText(fact.role) === 'defined_buyer')
      .map((fact) => fact.evidenceRef)
  );
  const summary = Object.fromEntries(
    Object.entries(asObject(graph.summary)).map(([key, refs]) => [
      key,
      compactStrings(refs).filter((ref) => projectedRefs.has(ref))
    ])
  );
  return {
    contractVersion: firstText(
      graph.contractVersion,
      'commercial_evidence_graph_v2'
    ),
    projection: 'provider_prompt_v1',
    nodes,
    verifiedFacts,
    inferences,
    missingFacts: [
      'defined_buyer',
      'paid_offer',
      'acquisition',
      'conversion_destination',
      'paid_conversion',
      'attribution',
      'channel_fit'
    ].filter((role) => !verifiedRoles.has(role)),
    definedBuyer: {
      status: definedBuyerEvidenceRefs.length > 0
        ? 'verified'
        : inferredBuyerEvidenceRefs.length > 0
          ? 'inferred'
          : 'missing',
      evidenceRefs: definedBuyerEvidenceRefs.length > 0
        ? definedBuyerEvidenceRefs
        : inferredBuyerEvidenceRefs
    },
    summary
  };
}

function commercialDiscoveryGraphRoles(evidenceValue) {
  const evidence = asObject(evidenceValue);
  // The app validates that every graph role is a subset of the exact typed
  // provider fact. Preserve those roles byte-for-byte after enum
  // normalization; never expand a discovered identity into buyer intent,
  // warmness, or a commercial relationship.
  return compactStrings(evidence.commercialDiscoveryRoles)
    .map(contractEnum)
    .filter((role) => COMMERCIAL_DISCOVERY_ROLES.has(role));
}

function commercialDiscoveryChannelFitChannels(
  evidenceValue,
  allowedChannelsValue
) {
  const evidence = asObject(evidenceValue);
  const roles = new Set(
    compactStrings(evidence.commercialDiscoveryRoles).map(contractEnum)
  );
  const inferred = [];
  if (roles.has('prospective_partner')) {
    inferred.push('partner_channel');
  }
  if (roles.has('demand_signal')) {
    inferred.push('application_page', 'platform_discovery');
  }
  return compactStrings([
    ...inferred,
    ...asArray(allowedChannelsValue).filter((channel) =>
      allowedValue(channel, [
        evidence.label,
        evidence.summary,
        ...inferred
      ])
    )
  ]);
}

function commercialEvidenceRoles(value) {
  const text = firstText(value);
  const roles = [];
  if (paidOfferText(text)) roles.push('paid_offer');
  if (conversionDestinationEvidenceText(text)) {
    roles.push('conversion_destination');
  }
  if ([...ACQUISITION_MODES].some((mode) =>
    acquisitionEvidenceSupportsMode(mode, text)
  )) {
    roles.push('acquisition');
  }
  if ([...ATTRIBUTION_METHODS].some((method) =>
    attributionSignalText(text, method)
  )) {
    roles.push('attribution');
  }
  if (observableRevenueText(text)) roles.push('paid_conversion');
  if (/\b(?:buyer|buyers|customer segment|ideal customer|target customer|target patient|target client|patients? seeking|clients? seeking|customers? seeking|organizations? buying|teams? buying|leaders? seeking)\b/i.test(text) ||
      /\b(?:people|professionals|individuals|families|parents|caregivers|founders|freelancers|teams|leaders|organizations|companies|employers)\s+(?:(?:actively\s+)?(?:seeking|buying|booking|purchasing|ordering|subscribing to|looking for|needing)|(?:can|may)\s+(?:book|buy|request|purchase|order|subscribe|apply|hire))\b/i.test(text)) {
    roles.push('defined_buyer');
  }
  if (/\b(?:existing|current|returning|former|past)\s+(?:paying\s+)?(?:customer|client)s?\b/i.test(text)) {
    roles.push('existing_customer');
  }
  if (/\b(?:existing|current|returning|former|past)\s+(?:paying\s+)?patients?\b/i.test(text)) {
    roles.push('existing_patient');
  }
  if (/\b(?:named\s+)?partner(?:ship|ed)?\s+(?:with|channel|referral)|\bpartner\s+(?:introduction|referral)\b/i.test(text)) {
    roles.push('named_partner');
  }
  if (/\b(?:referred by|referral (?:from|relationship|source|partner)|warm introduction from)\b/i.test(text)) {
    roles.push('referral_relationship');
  }
  if (/\b(?:qualified (?:demand|inquir(?:y|ies)|leads?)|buyer requests?|customer requests?|patient requests?|waitlist|proposals? requested|inbound (?:demand|inquir(?:y|ies)|leads?)|(?:received|recorded|completed|new|\d+) (?:paid )?(?:bookings?|orders?|applications?))\b/i.test(text)) {
    roles.push('demand_signal');
  }
  if (/\b(?:clicks?|page views?|website visits?|qualified visits?|replies|responses|engagement rate|conversion rate|open rate|click-through|ctr)\b/i.test(text)) {
    roles.push('engagement_signal');
  }
  if (/\b(?:location|located|service area|serves?|city|state|region|remote|on[- ]site|in[- ]person|within \d+ (?:miles?|km))\b/i.test(text)) {
    roles.push('geographic_constraint');
  }
  if (/\b(?:availability|available|accepting|capacity|slots?|appointments?|hours? per week|waitlist|fully booked|limited to \d+)\b/i.test(text)) {
    roles.push('capacity_constraint');
  }
  if (/\b(?:deadline|by \d{4}|this (?:week|month|quarter)|within \d+ (?:days?|weeks?)|before |after |starts? |ends? |launch(?:es|ed)? |renewal)\b/i.test(text)) {
    roles.push('timing_constraint');
  }
  return compactStrings(roles);
}

function verifiedSystemAttributionCapabilityEvidence(value) {
  const evidence = asObject(value);
  return evidence.id ===
      PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID &&
    evidence.type ===
      PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY.type &&
    evidence.verifiedSystemCapability === true &&
    evidence.systemCapabilitySource ===
      PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY.systemCapabilitySource &&
    evidence.systemCapabilityProvenance ===
      PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY
        .systemCapabilityProvenance &&
    compactStrings(evidence.systemCapabilityRoles).length === 1 &&
    compactStrings(evidence.systemCapabilityRoles)[0] === 'attribution';
}

function commercialChannelFitChannels(value, allowedChannelsValue) {
  const text = firstText(value);
  const fitSignal = /\b(?:qualified (?:demand|buyers?|customers?|patients?|clients?|leads?|inquir(?:y|ies))|existing (?:audience|customers?|clients?|patients?)|referral|partner|bookings?|orders?|replies|responses|conversions?|attributed|source\/origin|utm|campaign source)\b/i.test(text);
  if (!fitSignal) return [];
  return compactStrings(allowedChannelsValue).filter((channel) =>
    allowedValue(channel, [text]) ||
    comparable(text).includes(comparable(channel))
  );
}

function commercialContextEvidenceNodes({
  commercialContext,
  objective,
  constraints,
  priorOutcomes
}) {
  const nodes = [];
  const profile = asObject(commercialContext.profile);
  const profileText = compactStrings([
    profile.profession,
    profile.location,
    profile.availability,
    ...asArray(profile.specialties),
    ...asArray(profile.serviceAreas),
    ...asArray(profile.currentFocus).flatMap((itemValue) => {
      const item = asObject(itemValue);
      return [item.name, item.description, item.status, item.priority];
    })
  ]).join('; ');
  if (profileText) {
    const roles = commercialEvidenceRoles(profileText);
    if (firstText(profile.location) || asArray(profile.serviceAreas).length > 0) {
      roles.push('geographic_constraint');
    }
    if (firstText(profile.availability)) roles.push('capacity_constraint');
    nodes.push(compact({
      evidenceRef: 'commercial_context:profile',
      type: 'commercial_context_profile',
      label: truncate(firstText(profile.profession, 'Declared profile context'), 180),
      summary: truncate(profileText, 320),
      roles: compactStrings(roles),
      location: firstText(profile.location),
      availability: firstText(profile.availability),
      serviceAreas: compactStrings(profile.serviceAreas),
      approved: true,
      provenance: 'user_declared',
      ownerControlled: true
    }));
  }
  const constraintValues = compactStrings([
    ...asArray(commercialContext.constraints),
    ...asArray(objective.constraints),
    ...asArray(constraints.rules),
    objective.deadline
  ]);
  constraintValues.forEach((value, index) => {
    const roles = commercialEvidenceRoles(value).filter((role) =>
      [
        'geographic_constraint',
        'capacity_constraint',
        'timing_constraint'
      ].includes(role)
    );
    if (firstText(objective.deadline) && value === objective.deadline) {
      roles.push('timing_constraint');
    }
    nodes.push(compact({
      evidenceRef: `commercial_context:constraint:${index + 1}`,
      type: 'commercial_constraint',
      label: truncate(value, 180),
      summary: truncate(value, 320),
      roles: compactStrings(roles),
      approved: true,
      provenance: 'user_constraint',
      ownerControlled: true
    }));
  });
  compactStrings(commercialContext.allowedChannels).forEach((channel, index) => {
    nodes.push({
      evidenceRef: `commercial_context:allowed_channel:${index + 1}`,
      type: 'permission_capability',
      label: channel,
      summary: 'The channel is configured or explicitly allowed; this proves permission capability only, not buyer reachability or fit.',
      roles: ['permissioned_channel'],
      channel: channel,
      approved: true,
      provenance: 'permission_capability',
      ownerControlled: true
    });
  });
  priorOutcomes.forEach((outcome, index) => {
    if (outcome.verified !== true) return;
    const attribution = asObject(outcome.attribution);
    const text = compactStrings([
      outcome.kind,
      outcome.status,
      outcome.offer,
      outcome.buyerSegment,
      outcome.channel,
      attribution.objectiveId,
      attribution.tournamentId,
      attribution.hypothesisId,
      attribution.candidateId,
      attribution.actionId,
      attribution.evidenceExperimentId,
      attribution.algorithmVersion,
      attribution.experimentArm
    ]).join('; ');
    const affirmative = affirmativePriorOutcome(outcome);
    const roles = affirmative
      ? commercialEvidenceRoles(text)
      : [];
    roles.push('prior_attributed_outcome');
    if (affirmative && firstText(outcome.buyerSegment)) {
      roles.push('defined_buyer');
    }
    if (affirmative && firstText(outcome.channel)) {
      roles.push('channel_fit');
    }
    if (Object.values(attribution).some(Boolean)) roles.push('attribution');
    nodes.push(compact({
      evidenceRef: `commercial_context:prior_outcome:${index + 1}`,
      type: 'verified_prior_outcome',
      label: truncate(firstText(outcome.kind, outcome.status, 'Verified prior outcome'), 180),
      summary: truncate(text, 320),
      roles: compactStrings(roles),
      linkedEvidenceRefs: compactStrings(outcome.evidenceRefs),
      channelFitChannels: affirmative
        ? compactStrings([outcome.channel])
        : [],
      observedAt: firstText(outcome.occurredAt),
      occurredAt: firstText(outcome.occurredAt),
      status: firstText(outcome.status),
      approved: true,
      provenance: 'verified_prior_outcome',
      ownerControlled: true
    }));
  });
  return nodes;
}

function refsForCommercialRoles(nodesValue, rolesValue) {
  const roles = new Set(compactStrings(rolesValue));
  return compactStrings(asArray(nodesValue)
    .map(asObject)
    .filter((node) => asArray(node.roles).some((role) => roles.has(role)))
    .map((node) => node.evidenceRef));
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

function boundedStrategyGenerationRequest({
  objective,
  constraints,
  commercialContext,
  evidenceCatalog,
  initialPromptEvidenceCatalog,
  commercialEvidenceGraph,
  proposedCommercialMotions,
  priorOutcomes,
  model,
  budget,
  referenceTime,
  maxSeedsPerDimension
}) {
  const attempts = [];
  let standardPromptEvidenceCatalog = [];
  let standardEvidenceRefs = [];
  let essentialEvidenceRefs = [];
  let selected;

  for (const profile of PROVIDER_PROMPT_ENVELOPE_PROFILES) {
    let selectedEvidenceRefs;
    let maxItems = profile.maxItems;
    if (profile.name !== 'standard') {
      if (profile.name === 'dense') {
        selectedEvidenceRefs = standardEvidenceRefs;
      } else if (profile.name === 'focused') {
        selectedEvidenceRefs = boundedPromptEvidenceRefs(
          standardEvidenceRefs,
          essentialEvidenceRefs,
          profile.maxItems
        );
        maxItems = selectedEvidenceRefs.length;
      } else {
        selectedEvidenceRefs = boundedPromptEvidenceRefs(
          standardEvidenceRefs,
          essentialEvidenceRefs,
          essentialEvidenceRefs.length || 1
        );
        maxItems = selectedEvidenceRefs.length;
      }
    }
    const promptEvidenceCatalog = profile.name === 'standard'
      ? asArray(initialPromptEvidenceCatalog)
      : compactPromptEvidenceCatalog(
          standardPromptEvidenceCatalog,
          objective,
          referenceTime,
          {
            selectedEvidenceRefs,
            maxItems,
            labelChars: profile.labelChars,
            summaryChars: profile.summaryChars,
            urlChars: profile.urlChars,
            coreMetadataOnly: profile.coreMetadataOnly
          }
        );
    if (profile.name === 'standard') {
      standardPromptEvidenceCatalog = promptEvidenceCatalog;
      standardEvidenceRefs = promptEvidenceCatalog
        .map((item) => firstText(item.id))
        .filter(Boolean);
      essentialEvidenceRefs = essentialPromptEvidenceRefs(
        evidenceCatalog,
        promptEvidenceCatalog,
        commercialEvidenceGraph,
        objective,
        referenceTime
      );
    }
    const promptCommercialEvidenceGraph =
      projectCommercialEvidenceGraphForPrompt(
        commercialEvidenceGraph,
        promptEvidenceCatalog,
        { compactProjection: profile.compactGraph }
      );
    const promptProposedCommercialMotions =
      projectProposedCommercialMotionsForPrompt(
        proposedCommercialMotions,
        promptEvidenceCatalog
      );
    const prompt = seedAndJudgePrompt({
      objective,
      constraints,
      commercialContext,
      evidenceCatalog: promptEvidenceCatalog,
      commercialEvidenceGraph: promptCommercialEvidenceGraph,
      proposedCommercialMotions: promptProposedCommercialMotions,
      priorOutcomes,
      maxSeedsPerDimension
    });
    const request = {
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
    const preflight = providerCallSpendPreflight(request, budget);
    const issue = providerPromptEnvelopeIssue(preflight);
    attempts.push(compact({
      profile: profile.name,
      promptEvidenceCount: promptEvidenceCatalog.length,
      promptEvidenceHash: stableHash(promptEvidenceCatalog),
      serializationSucceeded: preflight.serializationSucceeded,
      requestBodyByteCount: preflight.requestBodyByteCount,
      withinEnvelope: !issue
    }));
    selected = {
      profile: profile.name,
      promptEvidenceCatalog,
      promptCommercialEvidenceGraph,
      promptProposedCommercialMotions,
      prompt,
      request,
      preflight,
      issue
    };
    if (!issue || issue === 'provider_request_serialization') break;
  }

  const firstAttempt = attempts[0] || {};
  const finalAttempt = attempts[attempts.length - 1] || {};
  const authorized = !selected?.issue;
  return {
    ...selected,
    providerPromptEnvelope: compact({
      authorized,
      cause: selected?.issue,
      profile: selected?.profile,
      adaptiveCompactionAttempted: attempts.length > 1,
      adaptiveCompactionApplied:
        authorized && selected?.profile !== 'standard',
      originalRequestBodyByteCount:
        firstAttempt.requestBodyByteCount,
      requestBodyByteCount: finalAttempt.requestBodyByteCount,
      maxRequestBodyByteCount: MAX_PROVIDER_REQUEST_BODY_BYTES,
      originalPromptEvidenceCount:
        firstAttempt.promptEvidenceCount,
      promptEvidenceCount: finalAttempt.promptEvidenceCount,
      essentialEvidenceCount: essentialEvidenceRefs.length,
      essentialEvidenceHash: stableHash(essentialEvidenceRefs),
      attempts
    })
  };
}

function boundedPromptEvidenceRefs(
  standardEvidenceRefsValue,
  essentialEvidenceRefsValue,
  requestedCount
) {
  const standardEvidenceRefs = compactStrings(
    standardEvidenceRefsValue
  );
  const essentialEvidenceRefs = new Set(
    compactStrings(essentialEvidenceRefsValue)
  );
  const boundedCount = Math.min(
    standardEvidenceRefs.length,
    Math.max(
      nonNegativeInteger(requestedCount) || 1,
      essentialEvidenceRefs.size
    )
  );
  return [
    ...standardEvidenceRefs.filter((ref) =>
      essentialEvidenceRefs.has(ref)
    ),
    ...standardEvidenceRefs.filter((ref) =>
      !essentialEvidenceRefs.has(ref)
    )
  ].slice(0, boundedCount);
}

function essentialPromptEvidenceRefs(
  fullEvidenceCatalogValue,
  promptEvidenceCatalogValue,
  commercialEvidenceGraphValue,
  objectiveValue,
  referenceTime
) {
  const standardEvidenceRefs = asArray(promptEvidenceCatalogValue)
    .map((item) => firstText(asObject(item).id))
    .filter(Boolean);
  const selectedRefSet = new Set(standardEvidenceRefs);
  const evidenceByID = evidenceIndex(fullEvidenceCatalogValue);
  const graphNodeByRef = new Map(
    asArray(asObject(commercialEvidenceGraphValue).nodes)
      .map(asObject)
      .map((node) => [firstText(node.evidenceRef), node])
      .filter(([ref]) => selectedRefSet.has(ref))
  );
  const essential = new Set();
  const addRef = (refValue) => {
    const ref = firstText(refValue);
    if (selectedRefSet.has(ref)) essential.add(ref);
  };
  const addFirst = (predicate) => {
    const ref = standardEvidenceRefs.find((candidateRef) =>
      predicate(
        asObject(evidenceByID.get(candidateRef)),
        asObject(graphNodeByRef.get(candidateRef))
      )
    );
    addRef(ref);
  };

  addFirst((evidence) => firstText(evidence.revenueAssetRole) ===
    'current_owner_paid_conversion_asset');
  for (const ref of standardEvidenceRefs) {
    if (asObject(evidenceByID.get(ref))
      .providerAttestedCommercialDiscovery === true) {
      addRef(ref);
    }
  }
  for (const ref of compactStrings(asObject(objectiveValue).evidenceRefs)) {
    addRef(ref);
  }
  for (const role of [
    'defined_buyer',
    'paid_offer',
    'acquisition',
    'conversion_destination',
    'paid_conversion',
    'attribution',
    'channel_fit'
  ]) {
    addFirst((_evidence, node) => asArray(node.roles).includes(role));
  }
  addFirst((evidence) => promptRiskEvidence(evidence, referenceTime));
  if (essential.size === 0) addRef(standardEvidenceRefs[0]);

  // Preserve the standard deterministic order even when an adaptive profile
  // removes nonessential records.
  return standardEvidenceRefs.filter((ref) => essential.has(ref));
}

function compactPromptEvidenceCatalog(
  value,
  objectiveValue = {},
  referenceTime = new Date(),
  optionsValue = {}
) {
  const catalog = asArray(value)
    .map(asObject)
    .filter((item) => !/^source:/i.test(firstText(item.id)));
  const objective = asObject(objectiveValue);
  const options = asObject(optionsValue);
  const maxItems = Math.min(
    MAX_PROMPT_EVIDENCE_ITEMS,
    Math.max(1, nonNegativeInteger(options.maxItems) ||
      MAX_PROMPT_EVIDENCE_ITEMS)
  );
  const labelChars = Math.max(
    64,
    nonNegativeInteger(options.labelChars) ||
      MAX_PROMPT_EVIDENCE_LABEL_CHARS
  );
  const summaryChars = Math.max(
    96,
    nonNegativeInteger(options.summaryChars) ||
      MAX_PROMPT_EVIDENCE_SUMMARY_CHARS
  );
  const urlChars = Math.max(
    96,
    nonNegativeInteger(options.urlChars) ||
      MAX_PROMPT_EVIDENCE_URL_CHARS
  );
  const coreMetadataOnly = options.coreMetadataOnly === true;
  const catalogByID = evidenceIndex(catalog);
  const objectivePinned = compactStrings(objective.evidenceRefs)
    .map((ref) => catalogByID.get(ref))
    .filter(Boolean);
  const ranked = catalog
    .map((item, index) => ({
      item,
      index,
      score: promptEvidencePriorityScore(item, objective)
    }))
    .sort((left, right) =>
      right.score - left.score ||
      promptEvidenceObservedAt(right.item) -
        promptEvidenceObservedAt(left.item) ||
      compareStableText(left.item.id, right.item.id) ||
      left.index - right.index
    )
    .map((entry) => entry.item);
  const paidAssets = ranked.filter((item) =>
    firstText(item.revenueAssetRole) ===
      'current_owner_paid_conversion_asset'
  ).slice(0, MAX_PROMPT_PAID_ASSET_ITEMS);
  const commercialDiscoveryEvidence = ranked
    .filter((item) =>
      item.providerAttestedCommercialDiscovery === true
    )
    .slice(0, MAX_PROMPT_COMMERCIAL_DISCOVERY_EVIDENCE_ITEMS);
  const objectiveEvidence = ranked.slice(
    0,
    MAX_PROMPT_OBJECTIVE_EVIDENCE_ITEMS
  );
  const revenueEvidence = ranked
    .filter(promptRevenueEvidence)
    .slice(0, MAX_PROMPT_REVENUE_EVIDENCE_ITEMS);
  const attributionEvidence = ranked
    .filter((item) => promptAttributionEvidence(compactStrings([
      item.label,
      item.summary
    ]).join(' ')))
    .slice(0, MAX_PROMPT_ATTRIBUTION_EVIDENCE_ITEMS);
  const riskEvidence = ranked
    .filter((item) => promptRiskEvidence(item, referenceTime))
    .slice(0, MAX_PROMPT_RISK_EVIDENCE_ITEMS);
  const motionEvidence = ranked
    .filter((item) => promptAcquisitionEvidence(compactStrings([
      item.label,
      item.summary
    ]).join(' ')))
    .slice(0, MAX_PROMPT_MOTION_EVIDENCE_ITEMS);
  const candidateEvidence = ranked
    .filter(promptNamedCandidateEvidence)
    .slice(0, MAX_PROMPT_CANDIDATE_EVIDENCE_ITEMS);
  const contextEvidence = ranked
    .filter(promptContextEvidence)
    .slice(0, MAX_PROMPT_CONTEXT_EVIDENCE_ITEMS);
  const diverseEvidence = diversePromptEvidence(ranked);
  const selected = [];
  const selectedIDs = new Set();
  // Reserve objective, revenue, candidate, and compact identity context before
  // filling by deterministic relevance. This exact projected view is the
  // provider-output trust boundary; the full catalog remains available only
  // for post-validation provenance, caller evidence, and fallback selection.
  const explicitlySelected = compactStrings(
    options.selectedEvidenceRefs
  )
    .map((ref) => catalogByID.get(ref))
    .filter(Boolean);
  const selectionCandidates = explicitlySelected.length > 0
    ? explicitlySelected
    : [
        ...paidAssets,
        ...commercialDiscoveryEvidence,
        ...objectivePinned,
        ...objectiveEvidence,
        ...riskEvidence,
        ...attributionEvidence,
        ...motionEvidence,
        ...candidateEvidence,
        ...revenueEvidence,
        ...contextEvidence,
        ...diverseEvidence,
        ...ranked,
        ...catalog
      ];
  for (const item of selectionCandidates) {
    const id = firstText(item.id);
    if (!id || selectedIDs.has(id)) continue;
    selectedIDs.add(id);
    selected.push(item);
    if (selected.length >= maxItems) break;
  }
  return selected
    .map((itemValue) => {
      const item = asObject(itemValue);
      const url = compactPromptEvidenceURL(item.url, urlChars);
      const approvedSourceUrl = compactPromptEvidenceURL(
        item.approvedSourceUrl,
        urlChars
      );
      return compact({
        id: firstText(item.id),
        type: truncate(firstText(item.type), coreMetadataOnly ? 48 : 64),
        label: boundedEvidenceSummary(
          firstText(item.label),
          labelChars,
          compactStrings([
            item.label,
            objective.outcome,
            objective.successMetric
          ]).join(' ')
        ),
        summary: firstText(item.revenueAssetRole) ===
          'current_owner_paid_conversion_asset'
          ? boundedPaidConversionEvidenceSummary(
              firstText(item.summary),
              summaryChars,
              compactStrings([
                item.label,
                objective.outcome,
                objective.successMetric
              ]).join(' '),
              item,
              referenceTime
            )
          : boundedEvidenceSummary(
              firstText(item.summary),
              summaryChars,
              compactStrings([
                item.label,
                objective.outcome,
                objective.successMetric
              ]).join(' ')
            ),
        url,
        approvedSourceUrl: coreMetadataOnly && approvedSourceUrl === url
          ? undefined
          : approvedSourceUrl,
        sourceId: coreMetadataOnly
          ? undefined
          : truncate(firstText(item.sourceId), 96),
        observedAt: truncate(firstText(item.observedAt), 40),
        publishedAt: coreMetadataOnly
          ? undefined
          : truncate(firstText(item.publishedAt), 40),
        startDate: coreMetadataOnly
          ? undefined
          : truncate(firstText(item.startDate), 40),
        endDate: truncate(firstText(item.endDate), 40),
        current: typeof item.current === 'boolean'
          ? item.current
          : undefined,
        status: truncate(firstText(item.status), 64),
        confidence: coreMetadataOnly
          ? undefined
          : truncate(firstText(item.confidence), 16),
        approvedSourceObservation:
          item.approvedSourceObservation === true ? true : undefined,
        profileControlledSource:
          item.profileControlledSource === true ? true : undefined,
        providerAttestedCommercialDiscovery:
          item.providerAttestedCommercialDiscovery === true
            ? true
            : undefined,
        commercialDiscoveryProvider: truncate(firstText(
          item.commercialDiscoveryProvider
        ), coreMetadataOnly ? 64 : 100),
        commercialDiscoveryMotionId: truncate(firstText(
          item.commercialDiscoveryMotionId
        ), 80),
        commercialDiscoveryProvenance: truncate(firstText(
          item.commercialDiscoveryProvenance
        ), coreMetadataOnly ? 64 : 100),
        commercialDiscoveryKind: truncate(firstText(
          item.commercialDiscoveryKind
        ), coreMetadataOnly ? 64 : 100),
        commercialDiscoveryRoles: compactStrings(
          item.commercialDiscoveryRoles
        ),
        verifiedSystemCapability:
          item.verifiedSystemCapability === true ? true : undefined,
        systemCapabilitySource: truncate(firstText(
          item.systemCapabilitySource
        ), coreMetadataOnly ? 64 : 100),
        systemCapabilityProvenance: truncate(firstText(
          item.systemCapabilityProvenance
        ), coreMetadataOnly ? 64 : 100),
        systemCapabilityRoles: compactStrings(
          item.systemCapabilityRoles
        ),
        revenueAssetRole: firstText(item.revenueAssetRole)
      });
    });
}

function promptEvidencePriorityScore(itemValue, objectiveValue) {
  const item = asObject(itemValue);
  const objective = asObject(objectiveValue);
  const text = compactStrings([
    item.label,
    item.summary,
    item.type
  ]).join(' ');
  const objectiveText = compactStrings([
    objective.outcome,
    objective.successMetric
  ]).join(' ');
  let score = evidenceQuality(item) * 4;
  score += Math.round(textOverlap(text, objectiveText) * 160);
  if (firstText(item.revenueAssetRole) ===
      'current_owner_paid_conversion_asset') {
    score += 1_000;
  }
  if (firstText(item.revenueAssetRole) === 'informational_only') {
    score -= 120;
  }
  return score;
}

function promptRevenueEvidence(itemValue) {
  const item = asObject(itemValue);
  if (firstText(item.revenueAssetRole) ===
      'current_owner_paid_conversion_asset') {
    return true;
  }
  const text = comparable(compactStrings([
    item.label,
    item.summary
  ]).join(' '));
  if (/\b(?:not|never|without)\b.{0,32}\b(?:paid|payment|price|reimburs|compensat|commission|royalt|salary|wage)\b/.test(
    text
  )) {
    return false;
  }
  return /\b(?:accepts? insurance|booking (?:form|page|record)|checkout|claim record|commission|compensated|paid|payment|pricing|purchase|reimburs|retainer|royalt|salary|service page|sign ?up|sponsorship|subscription fee|wage)\b/.test(
    text
  ) ||
    /\b(?:contract|invoice|licen[cs]e|order|subscription)\b.{0,40}\b(?:paid|payment|price|purchase|reimburs|revenue|signed)\b/.test(
      text
    ) ||
    /\b(?:paid|payment|price|purchase|reimburs|revenue|signed)\b.{0,40}\b(?:contract|invoice|licen[cs]e|order|subscription)\b/.test(
      text
    );
}

function promptAttributionEvidence(value) {
  return /\b(?:attribut|booking record|campaign|channel field|claim record|crm|invoice record|order record|origin field|payment receipt|referral code|source field|utm)\b/i.test(
    firstText(value)
  );
}

function promptRiskEvidence(itemValue, referenceTime) {
  const item = asObject(itemValue);
  if (item.current === false ||
      /\b(?:archived|cancelled|canceled|closed|discontinued|ended|expired|inactive|no longer available|not accepting|obsolete|outdated|superseded|unavailable|withdrawn)\b/i.test(
        compactStrings([
          item.status,
          item.label,
          item.summary
        ]).join(' ')
      )) {
    return true;
  }
  const referenceDate = new Date(referenceTime);
  if (!Number.isFinite(referenceDate.getTime())) return false;
  const endDate = new Date(firstText(item.endDate));
  if (firstText(item.endDate) &&
      (!Number.isFinite(endDate.getTime()) ||
       endDate.getTime() < referenceDate.getTime())) {
    return true;
  }
  const publishedDate = new Date(firstText(item.publishedAt));
  return informationalAssetEvidence(item) &&
    Number.isFinite(publishedDate.getTime()) &&
    referenceDate.getTime() - publishedDate.getTime() >
      MAX_TIMING_VERIFICATION_OBSERVATION_AGE_MS;
}

function promptAcquisitionEvidence(value) {
  const text = firstText(value);
  return strategyMotions(text).length > 0 ||
    /\b(?:agent mediated discovery|app store discovery|community discovery|directory (?:discovery|listing)|earned media|existing (?:customer|client|patient) (?:referral|reactivation)|local search|marketplace (?:discovery|listing)|nonbranded search|organic search|owned audience|partner(?:ship)? (?:channel|introduction|referral)|permissioned (?:introduction|outreach)|platform discovery|professional network (?:discovery|introduction)|referral (?:channel|introduction|path)|search listing|social distribution)\b/i.test(
      text
    );
}

function promptNamedCandidateEvidence(itemValue) {
  const item = asObject(itemValue);
  const type = comparable(firstText(item.type));
  return /\b(?:company|directory|organization|person|professional record)\b/.test(
    type
  );
}

function promptContextEvidence(itemValue) {
  const type = comparable(firstText(asObject(itemValue).type));
  return /\b(?:approved source|current focus|explicit fact|profile fact|source backed timeline)\b/.test(
    type
  );
}

function diversePromptEvidence(values) {
  const selected = [];
  const seen = new Set();
  for (const itemValue of asArray(values)) {
    const item = asObject(itemValue);
    const key = compactStrings([
      item.sourceId,
      comparable(firstText(item.type))
    ]).join('|') || firstText(item.id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(item);
  }
  return selected;
}

function promptEvidenceObservedAt(itemValue) {
  const timestamp = new Date(firstText(
    asObject(itemValue).observedAt,
    asObject(itemValue).publishedAt
  )).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareStableText(leftValue, rightValue) {
  const left = firstText(leftValue);
  const right = firstText(rightValue);
  return left < right ? -1 : left > right ? 1 : 0;
}

function boundedEvidenceSummary(
  value,
  maxLength,
  salientValue = ''
) {
  const text = firstText(value).replace(/\s+/g, ' ').trim();
  if (!text || text.length <= maxLength) return text;
  const separator = ' … ';
  const salientTokens = new Set(
    compactStrings(firstText(salientValue).match(
      /[\p{L}\p{N}][\p{L}\p{N}-]*/gu
    ))
      .map(normalizeEvidenceSummaryToken)
      .filter((token) =>
        token.length >= 3 &&
        !EVIDENCE_SUMMARY_SALIENT_STOP_WORDS.has(token)
      )
  );
  const tokens = [...text.matchAll(/\S+/gu)].map((match) => ({
    value: match[0],
    start: match.index,
    end: match.index + match[0].length
  }));
  if (tokens.length < 2) return '';

  const weights = tokens.map((token) =>
    evidenceSummaryTokenWeight(token.value, salientTokens)
  );
  for (let index = 0; index < tokens.length; index += 1) {
    if (weights[index] < 100) continue;
    for (let distance = 1; distance <= 4; distance += 1) {
      const contextWeight = 12 - (distance * 2);
      if (index - distance >= 0) {
        weights[index - distance] += contextWeight;
      }
      if (index + distance < weights.length) {
        weights[index + distance] += contextWeight;
      }
    }
  }

  const prefixWeights = [0];
  for (const weight of weights) {
    prefixWeights.push(prefixWeights[prefixWeights.length - 1] + weight);
  }
  const preferredCenter =
    Math.floor((text.length - 1) * 0.62);
  let selected;
  let suffixStartIndex = 2;
  for (let startIndex = 1;
    startIndex < tokens.length - 1;
    startIndex += 1) {
    suffixStartIndex = Math.max(suffixStartIndex, startIndex + 1);
    const prefixLength = Math.max(0, tokens[startIndex].start - 1);
    while (suffixStartIndex < tokens.length &&
        prefixLength + separator.length +
          text.length - tokens[suffixStartIndex].start > maxLength) {
      suffixStartIndex += 1;
    }
    if (suffixStartIndex >= tokens.length) break;
    const endIndex = suffixStartIndex - 1;
    const candidate = {
      startIndex,
      endIndex,
      omittedWeight:
        prefixWeights[suffixStartIndex] - prefixWeights[startIndex],
      omittedCharacters:
        tokens[endIndex].end - tokens[startIndex].start,
      centerDistance: Math.abs(
        Math.floor(
          (
            tokens[startIndex].start +
            tokens[endIndex].end
          ) / 2
        ) - preferredCenter
      )
    };
    if (!selected ||
        candidate.omittedWeight < selected.omittedWeight ||
        (candidate.omittedWeight === selected.omittedWeight &&
          candidate.omittedCharacters < selected.omittedCharacters) ||
        (candidate.omittedWeight === selected.omittedWeight &&
          candidate.omittedCharacters === selected.omittedCharacters &&
          candidate.centerDistance < selected.centerDistance)) {
      selected = candidate;
    }
  }
  if (selected) {
    const prefix = text
      .slice(0, tokens[selected.startIndex].start)
      .trimEnd();
    const suffix = text
      .slice(tokens[selected.endIndex].end)
      .trimStart();
    return `${prefix}${separator}${suffix}`;
  }

  const retained = [];
  let retainedLength = 0;
  for (const token of tokens) {
    const nextLength =
      retainedLength + (retained.length > 0 ? 1 : 0) +
      token.value.length;
    if (nextLength > maxLength) break;
    retained.push(token.value);
    retainedLength = nextLength;
  }
  return retained.join(' ');
}

function boundedPaidConversionEvidenceSummary(
  value,
  maxLength,
  salientValue,
  evidenceValue,
  referenceTime
) {
  const text = firstText(value).replace(/\s+/g, ' ').trim();
  const evidence = asObject(evidenceValue);
  const supportsPaidConversion = (summary) =>
    inboundAssetEvidenceSupportsPaidConversion(
      {
        ...evidence,
        summary
      },
      referenceTime
    );
  const bounded = boundedEvidenceSummary(
    text,
    maxLength,
    salientValue
  );
  if (!text || supportsPaidConversion(bounded)) return bounded;

  // Owner pages often repeat their site navigation many times. Preserve one
  // exact compact span containing the offer, conversion, and paid signals.
  // This is deliberately extractive: no revenue wording is synthesized.
  const signalSummary = paidConversionEvidenceSignalExcerpt(
    text,
    maxLength
  );
  return signalSummary && supportsPaidConversion(signalSummary)
    ? signalSummary
    : bounded;
}

function paidConversionEvidenceSignalExcerpt(value, maxLength) {
  const text = firstText(value);
  const combination = paidConversionEvidenceSignalCombination(text);
  if (!combination) return '';
  const { matches, start, end } = combination;
  const span = text.slice(start, end).trim();
  if (span.length <= maxLength) return span;
  const exact = compactStrings(matches.map((match) => match[0]))
    .join(' … ');
  return exact.length <= maxLength ? exact : '';
}

function paidConversionEvidenceSignalCombination(value) {
  const text = firstText(value);
  const patterns = [
    /\b(?:apply|application|appointment|book now|book|booking|buy|checkout|contact|demo|download|inquiry|license|order|pay|payment|purchase|request|schedule|sign up|sign|signup|sponsorship inquiry|subscribe)\b/gi,
    /\b(?:app|audit|class|consultation|contract|course|demo|diagnostic|digital download|engagement|home visit|license|membership|package|pilot|pricing plan|product|professional role|service|session|software|sponsorship|subscription|workshop)\b/gi,
    /\b(?:covered by insurance|insurance[- ]covered|insurance (?:is )?accepted|accepts insurance|health ?care (?:is )?accepted|bill(?:s|ing)? insurance|insurance claim|reimburs(?:able|ed|ement)|claim payment|billable|commission|compensated|contract|cost|deposit|fee|invoice|license|order|paid|pay|payment|platform payout|price|purchase|referral fee|retainer|royalty|salary|sale|sponsorship|subscription|wage)\b|\$\s*\d/gi
  ];
  const groups = patterns.map((pattern) =>
    [...text.matchAll(pattern)].slice(0, 32)
  );
  if (groups.some((matches) => matches.length === 0)) return null;
  let selected = null;
  for (const conversion of groups[0]) {
    for (const offer of groups[1]) {
      for (const paid of groups[2]) {
        const matches = [conversion, offer, paid];
        if (new Set(matches.map((match) => match.index)).size !== 3) {
          continue;
        }
        const start = Math.min(...matches.map((match) => match.index));
        const end = Math.max(...matches.map((match) =>
          match.index + match[0].length
        ));
        const width = end - start;
        if (!selected || width < selected.width ||
            (width === selected.width && start < selected.start)) {
          selected = { matches, start, end, width };
        }
      }
    }
  }
  return selected;
}

const EVIDENCE_SUMMARY_SALIENT_STOP_WORDS = new Set([
  'and',
  'are',
  'for',
  'from',
  'has',
  'have',
  'one',
  'that',
  'the',
  'this',
  'through',
  'with'
]);

function normalizeEvidenceSummaryToken(value) {
  return comparable(firstText(value))
    .replace(
      /^[^\p{L}\p{N}$]+|[^\p{L}\p{N}]+$/gu,
      ''
    );
}

function evidenceSummaryTokenWeight(value, salientTokens = new Set()) {
  const token = normalizeEvidenceSummaryToken(value);
  if (!token) return 1;
  if (salientTokens.has(token)) return 1_000;
  if (/\b(?:accepts?|accepted|apply|application|attribut(?:e|ed|ion)|billable|book|booking|buy|buyer|campaign|checkout|claim|client|commission|compensated|contract|conversion|customer|deposit|destination|discover(?:y|ed)|fee|income|inquiry|invoice|license|order|organic|origin|paid|pay|payment|price|pricing|purchase|receipt|referral|reimbursable|reimbursed|reimbursement|retainer|revenue|royalty|sale|schedule|search|service|signup|source|sponsorship|subscription|utm|wage)\b/.test(
    token
  )) {
    return 1_000;
  }
  return 1;
}

function compactPromptEvidenceURL(
  value,
  maxLength = MAX_PROMPT_EVIDENCE_URL_CHARS
) {
  const safeURL = safePublicURL(firstText(value));
  if (!safeURL) return '';
  try {
    const parsed = new URL(safeURL);
    parsed.search = '';
    parsed.hash = '';
    const canonical = parsed.toString();
    if (canonical.length <= maxLength) {
      return canonical;
    }
    const origin = `${parsed.origin}/`;
    if (origin.length > maxLength) return '';
    let bounded = origin;
    for (const segment of parsed.pathname.split('/').filter(Boolean)) {
      const next = new URL(
        `${bounded.endsWith('/') ? bounded : `${bounded}/`}${segment}`
      ).toString();
      if (next.length > maxLength) break;
      bounded = next;
    }
    return bounded;
  } catch {
    return '';
  }
}

function seedAndJudgePrompt({
  objective,
  constraints,
  commercialContext,
  evidenceCatalog,
  commercialEvidenceGraph,
  proposedCommercialMotions,
  priorOutcomes,
  maxSeedsPerDimension
}) {
  const proposedMotions = asObject(proposedCommercialMotions);
  const hasProposedMotions =
    firstText(proposedMotions.status) === 'proposed_unverified' &&
    asArray(proposedMotions.motions).length > 0;
  const proposedMotionInstructions = hasProposedMotions
    ? `
proposedCommercialMotions contains unverified planner hypotheses about causal searches, never verified evidence or outside-world facts. It may suggest a buyer role, distinct counterparty role, paid offer, acquisition mechanism, conversion destination, paid conversion, and attribution signal worth evaluating. It cannot ground or raise evidence strength for any buyer, exact target, demand signal, relationship, permission, reachability, affiliation, or exact name. Every such claim still requires its own exact evidenceCatalog support.
Preserve the planner's end-buyer and counterparty role distinction when considering a motion. A proposed counterparty is only a role archetype until separate provider-attested evidence resolves an exact target; never copy a planner-only name or organization into candidates or present it as verified.`
    : '';
  const system = `You are ProfileScribe's research-only opportunity strategist and semantic judge.
Generate compact incremental-income strategy dimensions grounded only in the supplied professional evidence.
Internally compare multiple plausible evidence-grounded acquisition-to-payment paths, then emit only the strongest two coherent families. Do not expose private analysis or intermediate alternatives.
This is internal hypothesis exploration, not outreach, publishable copy, or permission to act.
Never invent accomplishments, customers, affiliations, contact details, market demand, intent, urgency, or relationships.
Treat commercialContext only as a permission and channel-capability boundary. A connected or allowed channel does not prove buyer demand, buyer fit, reachability, or revenue potential.
Treat experience with a past endDate as historical proof, never as a current role or affiliation.
Do not recommend applying for, enrolling in, or creating a capability when the evidence says that capability already exists. Treat the existing capability as proof or supporting context for a paid acquisition/conversion path. Any verification of that capability belongs only in supportingBottleneck and must never be the primary action.
Use only exact evidence IDs from evidenceCatalog. Unknown evidence IDs will be discarded.
Treat evidenceCatalog.revenueAssetRole as a deterministic eligibility signal. A current_owner_paid_conversion_asset is a current owner-controlled paid or reimbursable offer destination and must be preferred over adjacent articles or other informational evidence. informational_only evidence may support expertise but must never ground a paid offer, conversion destination, paid conversion, or evidenceExperiment asset.
Evidence with providerAttestedCommercialDiscovery=true is app-validated, read-only public professional discovery. Use it only for its exact commercialDiscoveryRoles. It may establish an exact prospective target, public professional identity, role, organization, market, channel fit, or—only for a verified live paid-demand record—the current compensated demand and application path explicitly stated in that evidence. It never proves a warm relationship, permission to contact, willingness to refer, buyer intent, private contact data, or an existing affiliation.${proposedMotionInstructions}
For a referral-partner path, keep the end buyer distinct from the prospective professional partner. Cite the discovered partner in the channel/acquisition grounding, describe it as prospective, and never put the partner's exact name in the buyer label unless that organization is actually the payer.
For a compensated-role path, a current paid-demand record may ground the employer buyer, compensated offer, platform-discovery route, and distinct application page. A public job record authorizes no application or form submission.
You may extract up to eight compact named person or organization candidates only when each exact name appears verbatim in cited evidence. Do not return contact details or URLs; return no candidate rather than infer or complete an identity.
When an exact named organization is the intended target buyer, begin the buyerSegments label with that exact evidence-backed name and return the same organization in candidates.
Keep every strategy family coherent end to end. Its family m is one acquisition mode, and its buyer, offer, channel, action, timing trigger, proof point, follow-up, and revenue path must all belong to that same acquisition-to-payment route.
Every family must trace one actual buyer and explicitly paid offer through inbound, warm, existing-customer, partner, or otherwise permissioned acquisition to an observable paid conversion and durable attribution record. A conversation, inquiry, eligibility check, scheduled consultation, profile change, post, impression, workflow improvement, or completed research task is not incremental income.
Each observable paid outcome must name one completed mechanism-specific event. Never join outcome alternatives with "or"/"either", and never treat an attempt, submission, pending/declined/failed event, or payment not received as paid conversion.
Operations, administration, visibility, content, research, and workflow improvements may appear only as auxiliary supportingBottleneck context. The singular action must itself advance permissioned acquisition or paid conversion, align with revenuePath.conversionAction, and must never merely perform the supporting bottleneck.
Monitoring, observing, measuring, reviewing, recording, researching, auditing, checking, or verifying is not an active primary revenue action. A family may use those verbs only for its bounded stop or supporting evidence; its primary action must causally create qualified discovery, present a paid offer through a permitted path, or complete a paid conversion.
For inbound acquisition, name one explicit discovery or demand origin such as organic/local search, an app store, a comparison/search listing, an owned opted-in audience, earned media/directory discovery, a marketplace, a community, social distribution, platform discovery, or agent-mediated discovery, and separately name the offer, pricing, signup, demo, application, licensing, sponsorship-inquiry, storefront, product, service, landing, booking, download, marketplace-listing, or checkout destination. A destination by itself is not an acquisition channel.
Construct each family's revenuePath first. Then derive that family's paid offer, buyer, channel, action, timing, proof, and follow-up items from the same revenue path.
For every revenue path, explicitly bind the buyer, paid offer, acquisition mechanism, conversion destination, paid conversion, and attribution signal to the exact approved evidence records that support each element. If approved evidence does not support one element, do not disguise the gap by attaching an unrelated evidence ID.
Return exactly two complete top-level family bundles named familyA and familyB. Family A is the strongest grounded path; family B is the strongest coherent alternative. They may use distinct tactics within the same business motion when the evidence does not support two different motions.
Prefer an inbound paid-conversion path for familyA when approved evidence can ground it. Use warm referral, partner channel, existing-customer, or permissioned-outreach paths when inbound is ungrounded or semantically weaker; never invent inbound demand or an inbound asset.
Within each family bundle, return exactly two grounded variants for paid offer, buyer segment, channel, action, timing trigger, proof point, and follow-up, plus exactly one family-specific revenue path. Never return global dimension arrays or cross-family compatibility tags.
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
    commercialContext,
    evidenceCatalog,
    commercialEvidenceGraph,
    ...(hasProposedMotions
      ? { proposedCommercialMotions: proposedMotions }
      : {}),
    priorOutcomes,
    outputContract: compactTournamentOutputContract(
      INITIAL_FAMILY_VARIANT_COUNT,
      maxSeedsPerDimension
    ),
    hardRules: compactTournamentHardRules({
      includeProposedMotions: hasProposedMotions
    })
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
      `o,b,c,a,t,p,f=${variantCount} each; across both ` +
      `families no multi-variant dimension exceeds ${maxSeedsPerDimension}`,
    item: '{l,e}; timing t item is {l,e,q}; e contains exact evidence IDs',
    revenuePath:
      '{l,e,v,rm,io,a,c,o,atm,ats,cd,st,g:{b,o,a,d:{l,e},c,t},sb,vm}; ' +
      `v=${REVENUE_PATH_CONTRACT_VERSION}; rm is a revenue mechanism; ` +
      'io is incremental paid outcome; a is acquisition mode; c is conversion action; ' +
      'o is observable paid outcome; atm is attribution method; ats is attribution record; ' +
      'cd is the concrete conversion destination; st is a numeric time/sample stop; ' +
      'g binds buyer/offer/acquisition/destination/conversion/attribution evidence; ' +
      'sb is optional support only and may be ""; vm is positive expected gross-income micros',
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

function compactTournamentHardRules(optionsValue = {}) {
  const options = asObject(optionsValue);
  return [
    'Return exactly two coherent families; construct each r path first, use one acquisition mode end to end, and derive every other item from it.',
    'Use only evidenceCatalog IDs. Family e contains every ID cited by its items. Each item cites only IDs in its own family, and each family includes an approved observation:* anchor.',
    'Ground the buyer, current paid offer, acquisition, distinct destination, paid conversion, and attribution record; never invent demand or an outside target.',
    'Provider-attested discovery may ground only its typed commercialDiscoveryRoles. A referral target is prospective and is not the end buyer; a person/company record never proves warmness, willingness, permission, or demand.',
    ...(options.includeProposedMotions === true
      ? ['proposedCommercialMotions are unverified hypotheses, not evidence. Preserve buyerRole versus counterpartyRole, but never use a motion to verify an outside target, demand, relationship, permission, reachability, exact name, or any causal paid-path field.']
      : []),
    'Only a verified live paid-demand record may ground compensated-role demand or an application destination, and it never authorizes application submission.',
    'Inbound names discovery separately from destination. Operations, research, scheduling, content, and verification may appear only in sb, never as the revenue action.',
    'The primary action is active, causal, and incremental. Reject monitoring, observing, measuring, reviewing, recording, auditing, checking, or verifying as the primary action.',
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
  const proposedMotions = asObject(originalTask.proposedCommercialMotions);
  const hasProposedMotions =
    firstText(proposedMotions.status) === 'proposed_unverified' &&
    asArray(proposedMotions.motions).length > 0;
  const proposedMotionInstructions = hasProposedMotions
    ? '\nPlanner-authored proposedCommercialMotions remain unverified hypotheses and are not evidence. Preserve their buyer/counterparty role distinction, but require exact evidenceCatalog support for every outside target, demand, relationship, permission, reachability, exact name, and paid-path claim.'
    : '';
  const system = `You are ProfileScribe's bounded structured-output repair strategist.
Generate a fresh compact replacement from the supplied objective and evidence. Do not reconstruct, quote, or continue the prior response.
Return exactly two complete source-grounded incremental-income families plus one review-first evidence experiment. This is research only: no outreach, publishing, advertising, form submission, or provider write.
Use exact evidence IDs only. Prefer current_owner_paid_conversion_asset for an inbound paid offer/destination; informational_only is never an offer anchor.
Provider-attested commercial discovery is usable only for its typed roles: referral targets remain prospective and distinct from the buyer, while only verified live paid-demand evidence may ground a compensated role and application path. Never infer warmness, willingness, permission, or private contact data.${proposedMotionInstructions}
An acquisition mechanism is distinct from its conversion destination. A valid path ends in a durable paid event with an attribution record.
Return only the strict compact JSON once.`;
  const user = JSON.stringify({
    task:
      'Freshly regenerate two compact complete comparison families; do not continue prior output.',
    objective: originalTask.objective,
    constraints: originalTask.constraints,
    commercialContext: originalTask.commercialContext,
    evidenceCatalog: originalTask.evidenceCatalog,
    commercialEvidenceGraph: originalTask.commercialEvidenceGraph,
    ...(hasProposedMotions
      ? { proposedCommercialMotions: proposedMotions }
      : {}),
    priorOutcomes: originalTask.priorOutcomes,
    repairIssue: issue,
    outputContract: compactTournamentOutputContract(
      REPAIR_FAMILY_VARIANT_COUNT
    ),
    hardRules: compactTournamentHardRules({
      includeProposedMotions: hasProposedMotions
    })
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
    prunedPrimaryActionVariantCount:
      nonNegativeInteger(seedSet.prunedPrimaryActionVariantCount) || 0,
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
  const injectedContextTokenReserve = Math.min(
    1_047_576,
    nonNegativeInteger(request.additionalPromptTokenReserve) || 0
  );
  const fixedToolFeeMicros = Math.min(
    1_000_000,
    nonNegativeInteger(request.fixedToolFeeMicros) || 0
  );
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
      injectedContextTokenReserve,
      serializedPromptTokenCeiling: 0,
      outputTokenCeiling: nonNegativeInteger(request.maxTokens) || 0,
      fixedRequestFeeCeilingMicros: Math.ceil(
        price.request * 1_000_000
      ),
      fixedToolFeeMicros,
      requestBodySha256: '',
      callSpendCeilingMicros: maxLLMSpendMicros + 1
    };
  }
  // GPT tokenization cannot emit more text/schema tokens than the UTF-8 bytes
  // supplied. The fixed reserve covers chat/schema framing not represented by
  // user-visible strings. Price-per-million USD multiplied by tokens is the
  // same numeric unit as micro-USD.
  const serializedPromptTokenCeiling =
    requestByteCount + OPENAI_PROMPT_FRAMING_TOKEN_RESERVE;
  // Forced web search can inject provider-owned context after serialization.
  // For the pinned GPT-4.1-mini route, use its complete native context window
  // as the absolute prompt ceiling instead of adding it to the serialized
  // request (which would claim an impossible over-context request).
  const promptTokenCeiling = Math.max(
    serializedPromptTokenCeiling,
    injectedContextTokenReserve
  );
  const outputTokenCeiling =
    nonNegativeInteger(request.maxTokens) || 0;
  const fixedRequestFeeCeilingMicros = Math.ceil(
    price.request * 1_000_000
  );
  return {
    serializationSucceeded: true,
    requestBodyByteCount: requestByteCount,
    requestBodySha256: createHash('sha256')
      .update(serializedRequest, 'utf8')
      .digest('hex'),
    injectedContextTokenReserve,
    serializedPromptTokenCeiling,
    promptTokenCeiling,
    outputTokenCeiling,
    fixedRequestFeeCeilingMicros,
    fixedToolFeeMicros,
    callSpendCeilingMicros:
      Math.ceil(promptTokenCeiling * price.prompt) +
      Math.ceil(outputTokenCeiling * price.completion) +
      fixedRequestFeeCeilingMicros +
      fixedToolFeeMicros
  };
}

function providerPromptEnvelopeIssue(preflightValue) {
  const preflight = asObject(preflightValue);
  if (preflight.serializationSucceeded !== true) {
    return 'provider_request_serialization';
  }
  if ((nonNegativeInteger(preflight.requestBodyByteCount) || 0) >
      MAX_PROVIDER_REQUEST_BODY_BYTES) {
    return 'bounded_prompt_envelope';
  }
  return '';
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
    injectedContextTokenReserve:
      nonNegativeInteger(preflight.injectedContextTokenReserve) || 0,
    serializedPromptTokenCeiling:
      nonNegativeInteger(preflight.serializedPromptTokenCeiling) || 0,
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
          t: exactItems('#/$defs/timingItem', familyVariantCount),
          p: exactItems('#/$defs/proofItem', familyVariantCount),
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
              cd: { type: 'string' },
              st: { type: 'string' },
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
              'cd',
              'st',
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

function selectCommercialCriticFinalists(finalistsValue, limitValue = 6) {
  const finalists = asArray(finalistsValue).map(asObject);
  const limit = Math.max(2, Math.min(6,
    nonNegativeInteger(limitValue) || 6
  ));
  const selected = [];
  const selectedIDs = new Set();
  const seenFamilies = new Set();
  for (const finalist of finalists) {
    const familyID = firstText(
      asObject(finalist.provenance).strategyFamilyId,
      finalist._strategyFamily
    );
    if (!familyID || seenFamilies.has(familyID)) continue;
    seenFamilies.add(familyID);
    selected.push(finalist);
    selectedIDs.add(firstText(finalist.id));
    if (selected.length >= limit) return selected;
  }
  for (const finalist of finalists) {
    const id = firstText(finalist.id);
    if (!id || selectedIDs.has(id)) continue;
    selected.push(finalist);
    selectedIDs.add(id);
    if (selected.length >= limit) break;
  }
  return selected;
}

function selectBestFamilyDiverseCriticPair(finalistsValue) {
  const ranked = asArray(finalistsValue)
    .map(asObject)
    .sort(compareHypotheses);
  const best = ranked[0];
  if (!best) return [];
  const bestFamily = firstText(
    asObject(best.provenance).strategyFamilyId,
    best._strategyFamily
  );
  const bestOtherFamily = ranked.find((finalist) => {
    const familyID = firstText(
      asObject(finalist.provenance).strategyFamilyId,
      finalist._strategyFamily
    );
    return familyID && familyID !== bestFamily;
  });
  return bestOtherFamily ? [best, bestOtherFamily] : [];
}

function commercialCriticFinalists(finalistsValue, optionsValue = {}) {
  const options = asObject(optionsValue);
  const includeEvidenceBindings =
    options.includeEvidenceBindings === true;
  const commercialEvidenceGraph = asObject(
    options.commercialEvidenceGraph
  );
  const commercialDiscoveryCandidates = asArray(
    options.commercialDiscoveryCandidates
  ).map(asObject);
  return asArray(finalistsValue)
    .map(asObject)
    .map((hypothesis) => {
      const revenuePath = asObject(hypothesis.revenuePath);
      const {
        _grounding: _privateGrounding,
        activeRevenueAction: _derivedAction,
        ...publicRevenuePath
      } = revenuePath;
      return {
        finalistId: firstText(hypothesis.id),
        familyId: firstText(
          asObject(hypothesis.provenance).strategyFamilyId,
          hypothesis._strategyFamily
        ),
        buyer: firstText(hypothesis.buyerSegment),
        paidOffer: firstText(hypothesis.offer),
        acquisitionChannel: firstText(hypothesis.channel),
        primaryAction: firstText(hypothesis.action),
        revenuePath: publicRevenuePath,
        expectedGrossIncomeMicros:
          nonNegativeInteger(hypothesis.expectedValueMicros) || 0,
        estimatedSpendMicros:
          nonNegativeInteger(hypothesis.estimatedSpendMicros) || 0,
        deterministicScore: asObject(hypothesis.score),
        evidenceRefs: compactStrings(hypothesis.evidenceRefs),
        ...(includeEvidenceBindings
          ? {
              evidenceBindings:
                commercialCriticEvidenceBindings({
                  hypothesis,
                  commercialEvidenceGraph,
                  commercialDiscoveryCandidates
                })
            }
          : {})
      };
    });
}

function commercialCriticEvidenceBindings({
  hypothesis: hypothesisValue,
  commercialEvidenceGraph: graphValue,
  commercialDiscoveryCandidates: candidatesValue
}) {
  const hypothesis = asObject(hypothesisValue);
  const graph = asObject(graphValue);
  const graphNodeByRef = new Map(
    asArray(graph.nodes)
      .map(asObject)
      .map((node) => [firstText(node.evidenceRef), node])
      .filter(([ref]) => Boolean(ref))
  );
  const tuple = asObject(hypothesis._tuple);
  const revenuePathSeed = asObject(
    asObject(tuple.revenuePaths).revenuePath
  );
  const grounding = asObject(revenuePathSeed._grounding);
  const revenuePath = asObject(hypothesis.revenuePath);
  const hypothesisRefs = new Set(
    compactStrings(hypothesis.evidenceRefs)
  );
  const target = asArray(candidatesValue)
    .map(asObject)
    .filter((candidate) =>
      candidate.identityResolved === true &&
      candidate.exactNamedCandidate === true &&
      exactTextContains(
        firstText(hypothesis.action),
        firstText(candidate.displayLabel)
      ) &&
      compactStrings(candidate.evidenceRefs).some((ref) =>
        hypothesisRefs.has(ref)
      )
    )
    .sort((left, right) =>
      Number(firstText(right.kind) === 'person') -
        Number(firstText(left.kind) === 'person') ||
      compareStableText(left.id, right.id)
    )[0];
  const roleBinding = (role, claimValue, refsValue, extraValue = {}) => {
    const evidenceRefs = compactStrings(refsValue)
      .filter((ref) => hypothesisRefs.has(ref))
      .slice(0, 6);
    const provenance = compactStrings(evidenceRefs.flatMap((ref) => {
      const node = asObject(graphNodeByRef.get(ref));
      return [node.provenance, node.provider];
    })).slice(0, 4);
    return compact({
      role,
      claim: safeCommercialCriticClaim(claimValue, 240),
      evidenceRefs,
      provenance,
      ...extraValue
    });
  };
  const targetPublicUrl = safePublicHTTPSURL(target?.publicUrl);
  const safeTargetPublicUrl = targetPublicUrl &&
      !commercialDiscoveryContainsPrivateContact(targetPublicUrl)
    ? targetPublicUrl
    : '';
  const targetEvidenceRefs = compactStrings(target?.evidenceRefs)
    .filter((ref) => hypothesisRefs.has(ref));
  return [
    roleBinding(
      'exact_outside_target',
      target?.displayLabel,
      targetEvidenceRefs,
      compact({
        kind: contractEnum(firstText(target?.kind)),
        organization: safeCommercialCriticClaim(
          target?.organization,
          160
        ),
        professionalRole: safeCommercialCriticClaim(target?.role, 120),
        market: safeCommercialCriticClaim(target?.market, 120),
        publicUrl: safeTargetPublicUrl,
        scope: 'public professional identity and prospective channel fit only'
      })
    ),
    roleBinding(
      'defined_buyer',
      hypothesis.buyerSegment,
      grounding.buyerEvidenceRefs
    ),
    roleBinding(
      'paid_offer',
      hypothesis.offer,
      grounding.paidOfferEvidenceRefs
    ),
    roleBinding(
      'acquisition',
      `${firstText(revenuePath.acquisitionMode)}: ${firstText(
        hypothesis.channel
      )}`,
      grounding.acquisitionEvidenceRefs
    ),
    roleBinding(
      'conversion_destination',
      revenuePath.conversionDestination,
      grounding.conversionDestinationEvidenceRefs
    ),
    roleBinding(
      'paid_conversion',
      revenuePath.observableRevenueOutcome,
      grounding.paidConversionEvidenceRefs
    ),
    roleBinding(
      'attribution',
      `${firstText(revenuePath.attributionMethod)}: ${firstText(
        revenuePath.attributionSignal
      )}`,
      grounding.attributionEvidenceRefs
    )
  ];
}

function safeCommercialCriticClaim(value, maxLength) {
  return truncate(
    redactCommercialDiscoveryContactTokens(firstText(value)),
    maxLength
  );
}

function commercialCriticPrompt({
  objective,
  commercialContext,
  commercialEvidenceGraph,
  proposedCommercialMotions,
  commercialDiscoveryCandidates,
  compactContingentContext,
  finalists
}) {
  const compactBoundPair = compactContingentContext === true;
  const proposedMotions = asObject(proposedCommercialMotions);
  const hasProposedMotions =
    !compactBoundPair &&
    firstText(proposedMotions.status) === 'proposed_unverified' &&
    asArray(proposedMotions.motions).length > 0;
  const proposedMotionInstructions = hasProposedMotions
    ? '\nTreat proposedCommercialMotions only as unverified planner hypotheses, never evidence. They may help compare whether a finalist preserves a proposed buyer role, distinct counterparty role, paid offer, acquisition mechanism, conversion destination, paid conversion, and attribution signal, but they cannot increase evidence strength or reachability and cannot verify an outside target, demand signal, relationship, permission, affiliation, or exact name. Reject any finalist whose exact target or causal paid path is supported only by a planner motion rather than the verified commercialEvidenceGraph.'
    : '';
  const boundPairInstructions = compactBoundPair
    ? '\nFor this v6 bound pair, each finalist has exactly seven compact evidenceBindings: exact outside target, defined buyer, paid offer, acquisition, conversion destination, paid conversion, and attribution. Deterministic code built those bindings from validated public/provider evidence and the source-grounded revenue path. Treat each binding only as proof of its stated role. In particular, an outside professional identity proves prospective channel fit only—not relationship, interest, permission, demand, or buyer status. No raw provider record or private contact data is supplied.'
    : '';
  const system = `You are ProfileScribe's independent commercial-motion critic.
Compare and rank exactly the supplied deterministically valid finalist motions. This is research only and authorizes no execution.
For every finalist, assess incremental revenue, evidence strength, buyer reachability, paid-outcome probability, a numeric 1-to-30-day time to first dollar, recurring value, cost, effort, and uncertainty. Order selectedOrdering by higher paid-outcome probability first, then higher expectedGrossIncomeMicros, recurring before repeatable before one-time value, fewer timeToFirstDollarDays, stronger reachability, stronger evidence, lower cost, lower effort, and lower uncertainty. Only an exact tie across those fields may use your remaining commercial judgment.
Accept only finalists whose primary action actively and causally creates qualified demand or advances a paid conversion, whose income is counterfactually incremental, whose buyer and paid offer are grounded, whose acquisition is distinct from destination, and whose paid outcome has durable attribution plus a numeric stop.
The deterministic pre-filter has already excluded passive and operational motions. If one appears anyway, reject it; never reward monitoring, measuring, profile work, content work, or administration.
Treat commercialContext only as permission/channel capability. A connected channel never proves buyer demand, fit, or reachability.${boundPairInstructions}${proposedMotionInstructions}
Return one complete comparison per supplied finalist plus an exact selected ordering. Do not rewrite the strategies and do not return outreach or publishing copy. Return only strict JSON.`;
  const compactCommercialContext = compactBoundPair
    ? {
        allowedChannels: compactStrings(
          asObject(commercialContext).allowedChannels
        ).slice(0, 8),
        permissionRequired: firstText(
          asObject(commercialContext).permissionRequired,
          'explicit_user_approval'
        )
      }
    : commercialContext;
  const user = JSON.stringify({
    task:
      'Independently compare, rank, and accept or reject the grounded finalist commercial motions.',
    criticContract: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
    objective,
    commercialContext: compactCommercialContext,
    ...(compactBoundPair
      ? {
          contextMode: 'bound_family_diverse_pair_v1',
          executionPolicy: {
            executionAuthorization: 'none',
            requiresReview: true,
            sideEffectsPerformed: 0
          }
        }
      : { commercialEvidenceGraph }),
    ...(hasProposedMotions
      ? { proposedCommercialMotions: proposedMotions }
      : {}),
    finalists: commercialCriticFinalists(finalists, {
      includeEvidenceBindings: compactBoundPair,
      commercialEvidenceGraph,
      commercialDiscoveryCandidates
    })
  });
  return { system, user };
}

function commercialCriticResponseFormat(finalistsValue) {
  const finalistIDs = compactStrings(
    commercialCriticFinalists(finalistsValue)
      .map((finalist) => finalist.finalistId)
  );
  const comparison = {
    type: 'object',
    properties: {
      finalistId: { type: 'string', enum: finalistIDs },
      verdict: { type: 'string', enum: ['accept', 'reject'] },
      activeRevenueAction: { type: 'boolean' },
      causalAcquisitionPath: { type: 'boolean' },
      incrementalRevenueOutcome: { type: 'boolean' },
      incrementalRevenue: {
        type: 'string',
        enum: ['strong', 'moderate', 'weak']
      },
      evidenceStrength: {
        type: 'string',
        enum: ['strong', 'moderate', 'weak']
      },
      reachability: {
        type: 'string',
        enum: ['strong', 'moderate', 'weak']
      },
      timeToFirstDollar: {
        type: 'string',
        enum: ['fast', 'moderate', 'slow']
      },
      paidOutcomeProbability: {
        type: 'number',
        minimum: 0.000001,
        maximum: 1
      },
      timeToFirstDollarDays: {
        type: 'integer',
        minimum: 1,
        maximum: 30
      },
      recurringValue: {
        type: 'string',
        enum: ['one_time', 'repeatable', 'recurring']
      },
      cost: { type: 'string', enum: ['low', 'moderate', 'high'] },
      effort: { type: 'string', enum: ['low', 'moderate', 'high'] },
      uncertainty: {
        type: 'string',
        enum: ['low', 'moderate', 'high']
      },
      reasonCode: {
        type: 'string',
        enum: [
          'active_incremental_path',
          'passive_observation',
          'operations_only',
          'unclear_causal_link',
          'nonincremental_revenue',
          'unsupported_evidence'
        ]
      },
      reason: { type: 'string' }
    },
    required: [
      'finalistId',
      'verdict',
      'activeRevenueAction',
      'causalAcquisitionPath',
      'incrementalRevenueOutcome',
      'incrementalRevenue',
      'evidenceStrength',
      'reachability',
      'timeToFirstDollar',
      'paidOutcomeProbability',
      'timeToFirstDollarDays',
      'recurringValue',
      'cost',
      'effort',
      'uncertainty',
      'reasonCode',
      'reason'
    ],
    additionalProperties: false
  };
  return {
    type: 'json_schema',
    json_schema: {
      name: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
      strict: true,
      schema: {
        type: 'object',
        properties: {
          criticContract: {
            type: 'string',
            enum: [OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT]
          },
          selectedOrdering: {
            type: 'array',
            items: { type: 'string', enum: finalistIDs },
            minItems: finalistIDs.length,
            maxItems: finalistIDs.length
          },
          selectedFinalistId: {
            type: 'string',
            enum: finalistIDs
          },
          comparisons: {
            type: 'array',
            items: comparison,
            minItems: finalistIDs.length,
            maxItems: finalistIDs.length
          },
          reason: { type: 'string' }
        },
        required: [
          'criticContract',
          'selectedOrdering',
          'selectedFinalistId',
          'comparisons',
          'reason'
        ],
        additionalProperties: false
      }
    }
  };
}

function deterministicCommercialHypothesisGate(
  hypothesisValue,
  commercialEvidenceGraphValue = {}
) {
  const hypothesis = asObject(hypothesisValue);
  const action = firstText(hypothesis.action);
  const channel = firstText(hypothesis.channel);
  const revenuePath = asObject(hypothesis.revenuePath);
  const conversionAction = firstText(revenuePath.conversionAction);
  const destination = firstText(revenuePath.conversionDestination);
  const semantic = revenuePathSemanticChecks(revenuePath);
  const constraintGate = commercialConstraintGate(
    hypothesis,
    commercialEvidenceGraphValue
  );
  const gate = {
    activeRevenueAction:
      !passiveOrObservationalPrimaryAction(action) &&
      !passiveOrObservationalPrimaryAction(conversionAction) &&
      !experimentActionClaimsCompletedExternalExecution(action) &&
      !experimentActionClaimsCompletedExternalExecution(conversionAction) &&
      !operationOnlyAction(action) &&
      revenueAdvancingAction(action) &&
      semantic.conversionAction,
    causalAcquisitionPath:
      ACQUISITION_MODES.has(firstText(revenuePath.acquisitionMode)) &&
      !prohibitedAcquisitionText(`${channel} ${conversionAction}`) &&
      semantic.conversionDestination &&
      comparable(channel) !== comparable(destination),
    incrementalRevenueOutcome:
      semantic.incrementalIncome &&
      semantic.observableRevenue &&
      semantic.numericStop,
    commercialConstraintsSatisfied: constraintGate.valid
  };
  return {
    ...gate,
    constraintReasons: constraintGate.reasons,
    valid: Object.values(gate).every(Boolean)
  };
}

function commercialConstraintGate(hypothesisValue, graphValue) {
  const hypothesis = asObject(hypothesisValue);
  const nodes = asArray(asObject(graphValue).nodes).map(asObject);
  const profileNode = nodes.find((node) =>
    firstText(node.evidenceRef) === 'commercial_context:profile'
  );
  const constraintText = compactStrings(nodes
    .filter((node) =>
      /^(?:commercial_context:profile|commercial_context:constraint:)/.test(
        firstText(node.evidenceRef)
      )
    )
    .flatMap((node) => [node.label, node.summary, node.availability])
  ).join(' ');
  const reasons = [];
  if (/\b(?:unavailable|not accepting|accepting no|zero capacity|no capacity|0 slots?|no openings?|fully booked|paused indefinitely)\b/i.test(
    constraintText
  )) {
    reasons.push('unavailable_or_zero_capacity');
  }
  if (/\b(?:expired|deadline passed|no longer available|ended|closed)\b/i.test(
    constraintText
  )) {
    reasons.push('timing_constraint_not_current');
  }
  if (/\b(?:outside (?:the )?(?:declared )?service area|not served|unsupported geography|does not serve)\b/i.test(
    `${constraintText} ${hypothesis.buyerSegment || ''}`
  )) {
    reasons.push('buyer_outside_service_area');
  }
  const serviceAreas = compactStrings(profileNode?.serviceAreas);
  const buyerLocationMatch = firstText(hypothesis.buyerSegment).match(
    /\b(?:in|near)\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,2}(?:,\s*[A-Z]{2})?)(?=\b|$)/u
  );
  if (serviceAreas.length > 0 && buyerLocationMatch?.[1]) {
    const buyerLocation = buyerLocationMatch[1];
    const withinServiceArea = serviceAreas.some((area) =>
      allowedValue(buyerLocation, [area]) || allowedValue(area, [buyerLocation])
    );
    if (!withinServiceArea) reasons.push('buyer_outside_service_area');
  }
  return {
    valid: reasons.length === 0,
    reasons: compactStrings(reasons)
  };
}

function commercialCriticNearestCashEstimate(itemValue, finalistValue) {
  const item = asObject(itemValue);
  const finalist = asObject(finalistValue);
  const paidOutcomeProbability = item.paidOutcomeProbability;
  const timeToFirstDollarDays = item.timeToFirstDollarDays;
  const recurringValue = item.recurringValue;
  const expectedGrossIncomeMicros = finalist.expectedValueMicros;
  const reachability = item.reachability;
  const evidenceStrength = item.evidenceStrength;
  const cost = item.cost;
  const effort = item.effort;
  const uncertainty = item.uncertainty;
  const valid =
    typeof paidOutcomeProbability === 'number' &&
    Number.isFinite(paidOutcomeProbability) &&
    paidOutcomeProbability > 0 &&
    paidOutcomeProbability <= 1 &&
    typeof timeToFirstDollarDays === 'number' &&
    Number.isInteger(timeToFirstDollarDays) &&
    timeToFirstDollarDays >= 1 &&
    timeToFirstDollarDays <= 30 &&
    typeof expectedGrossIncomeMicros === 'number' &&
    Number.isSafeInteger(expectedGrossIncomeMicros) &&
    expectedGrossIncomeMicros > 0 &&
    typeof recurringValue === 'string' &&
    COMMERCIAL_CRITIC_RECURRING_VALUE_PRIORITY.has(recurringValue) &&
    typeof reachability === 'string' &&
    COMMERCIAL_CRITIC_STRENGTH_PRIORITY.has(reachability) &&
    typeof evidenceStrength === 'string' &&
    COMMERCIAL_CRITIC_STRENGTH_PRIORITY.has(evidenceStrength) &&
    typeof cost === 'string' &&
    COMMERCIAL_CRITIC_BURDEN_PRIORITY.has(cost) &&
    typeof effort === 'string' &&
    COMMERCIAL_CRITIC_BURDEN_PRIORITY.has(effort) &&
    typeof uncertainty === 'string' &&
    COMMERCIAL_CRITIC_BURDEN_PRIORITY.has(uncertainty);
  return {
    valid,
    paidOutcomeProbability,
    expectedGrossIncomeMicros,
    recurringValue,
    timeToFirstDollarDays,
    reachability,
    evidenceStrength,
    cost,
    effort,
    uncertainty
  };
}

function commercialCriticNearestCashPriorityValues(estimateValue) {
  const estimate = asObject(estimateValue);
  return [
    ['paid-outcome probability', estimate.paidOutcomeProbability],
    ['expected gross value', estimate.expectedGrossIncomeMicros],
    [
      'recurring-value class',
      COMMERCIAL_CRITIC_RECURRING_VALUE_PRIORITY.get(
        estimate.recurringValue
      )
    ],
    ['time to first dollar', -estimate.timeToFirstDollarDays],
    [
      'reachability',
      COMMERCIAL_CRITIC_STRENGTH_PRIORITY.get(estimate.reachability)
    ],
    [
      'evidence strength',
      COMMERCIAL_CRITIC_STRENGTH_PRIORITY.get(
        estimate.evidenceStrength
      )
    ],
    ['cost', COMMERCIAL_CRITIC_BURDEN_PRIORITY.get(estimate.cost)],
    ['effort', COMMERCIAL_CRITIC_BURDEN_PRIORITY.get(estimate.effort)],
    [
      'uncertainty',
      COMMERCIAL_CRITIC_BURDEN_PRIORITY.get(estimate.uncertainty)
    ]
  ];
}

function compareCommercialCriticNearestCash(leftValue, rightValue) {
  const left = commercialCriticNearestCashPriorityValues(leftValue);
  const right = commercialCriticNearestCashPriorityValues(rightValue);
  for (let index = 0; index < left.length; index += 1) {
    const leftScore = left[index][1];
    const rightScore = right[index][1];
    if (leftScore === rightScore) continue;
    return leftScore > rightScore ? -1 : 1;
  }
  return 0;
}

function commercialCriticNearestCashDecisivePriority(
  winnerValue,
  runnerUpValue
) {
  const winner = commercialCriticNearestCashPriorityValues(winnerValue);
  const runnerUp = commercialCriticNearestCashPriorityValues(runnerUpValue);
  return winner.find((item, index) => item[1] !== runnerUp[index][1])
    ?.[0] || 'an exact nearest-cash tie resolved by critic judgment';
}

function normalizeCommercialCritic(
  value,
  finalistsValue,
  commercialEvidenceGraphValue = {}
) {
  const raw = asObject(value);
  const finalists = asArray(finalistsValue).map(asObject);
  const finalistByID = new Map(
    finalists.map((finalist) => [firstText(finalist.id), finalist])
  );
  const expectedIDs = [...finalistByID.keys()];
  const values = asArray(raw.comparisons).map(asObject);
  const returnedIDs = values.map((item) => firstText(item.finalistId));
  const ordering = compactStrings(raw.selectedOrdering);
  const nearestCashEstimates = values.map((item) => ({
    finalistId: firstText(item.finalistId),
    ...commercialCriticNearestCashEstimate(
      item,
      finalistByID.get(firstText(item.finalistId))
    )
  }));
  const nearestCashEstimateByID = new Map(nearestCashEstimates.map(
    (estimate) => [estimate.finalistId, estimate]
  ));
  const commercialEstimateShapeValid = nearestCashEstimates.every(
    (estimate) => estimate.valid === true
  );
  const nearestCashOrderingValid =
    ordering.length === expectedIDs.length &&
    ordering.every((id) =>
      nearestCashEstimateByID.get(id)?.valid === true
    ) &&
    ordering.every((id, index) => index === 0 ||
      compareCommercialCriticNearestCash(
        nearestCashEstimateByID.get(ordering[index - 1]),
        nearestCashEstimateByID.get(id)
      ) <= 0
    );
  const shapeValid =
    firstText(raw.criticContract) ===
      OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT &&
    values.length === expectedIDs.length &&
    new Set(returnedIDs).size === expectedIDs.length &&
    expectedIDs.every((id) => returnedIDs.includes(id)) &&
    ordering.length === expectedIDs.length &&
    new Set(ordering).size === expectedIDs.length &&
    expectedIDs.every((id) => ordering.includes(id)) &&
    firstText(raw.selectedFinalistId) === ordering[0] &&
    Boolean(firstText(raw.reason)) &&
    commercialEstimateShapeValid &&
    nearestCashOrderingValid;
  if (!shapeValid) {
    return {
      valid: false,
      acceptedFamilyIds: [],
      acceptedFinalistIds: [],
      selectedOrdering: [],
      comparisons: [],
      verdict: 'rejected',
      reason: 'The critic response did not satisfy the exact comparison contract.'
    };
  }
  const comparisons = values
    .map((item) => {
      const finalist = finalistByID.get(firstText(item.finalistId));
      const nearestCashEstimate = nearestCashEstimateByID.get(
        firstText(item.finalistId)
      );
      const deterministic = deterministicCommercialHypothesisGate(
        finalist,
        commercialEvidenceGraphValue
      );
      const modelAccepted = item.verdict === 'accept' &&
        item.activeRevenueAction === true &&
        item.causalAcquisitionPath === true &&
        item.incrementalRevenueOutcome === true &&
        item.reasonCode === 'active_incremental_path';
      const deterministicAccepted =
        deterministic.valid === true;
      return {
        finalistId: firstText(item.finalistId),
        familyId: firstText(
          asObject(finalist?.provenance).strategyFamilyId,
          finalist?._strategyFamily
        ),
        verdict: modelAccepted && deterministicAccepted
          ? 'accept'
          : 'reject',
        reasonCode: firstText(item.reasonCode),
        reason: truncate(firstText(item.reason), 280),
        incrementalRevenue: firstText(item.incrementalRevenue),
        evidenceStrength: firstText(item.evidenceStrength),
        reachability: firstText(item.reachability),
        timeToFirstDollar: firstText(item.timeToFirstDollar),
        paidOutcomeProbability:
          nearestCashEstimate.paidOutcomeProbability,
        expectedGrossIncomeMicros:
          nearestCashEstimate.expectedGrossIncomeMicros,
        timeToFirstDollarDays:
          nearestCashEstimate.timeToFirstDollarDays,
        recurringValue: nearestCashEstimate.recurringValue,
        cost: firstText(item.cost),
        effort: firstText(item.effort),
        uncertainty: firstText(item.uncertainty),
        modelAccepted,
        deterministicAccepted,
        ...deterministic
      };
    })
    .sort((left, right) =>
      ordering.indexOf(left.finalistId) - ordering.indexOf(right.finalistId)
    );
  const acceptedFinalistIds = ordering.filter((id) =>
    comparisons.some((item) =>
      item.finalistId === id && item.verdict === 'accept'
    )
  );
  const acceptedFamilyIds = compactStrings(acceptedFinalistIds.map((id) =>
    firstText(
      asObject(finalistByID.get(id)?.provenance).strategyFamilyId,
      finalistByID.get(id)?._strategyFamily
    )
  ));
  const accepted = acceptedFinalistIds.length >= 2 &&
    acceptedFinalistIds[0] === firstText(raw.selectedFinalistId);
  return {
    valid: true,
    verdict: accepted ? 'accepted' : 'rejected',
    acceptedFamilyIds,
    acceptedFinalistIds,
    selectedOrdering: ordering,
    selectedFinalistId: firstText(raw.selectedFinalistId),
    comparisons,
    reason: truncate(firstText(raw.reason), 360)
  };
}

async function runCommercialCritic({
  objective,
  commercialContext,
  commercialEvidenceGraph,
  proposedCommercialMotions,
  commercialDiscoveryCandidates,
  compactContingentContext,
  finalists,
  model,
  budget,
  usage,
  completedRequests,
  completeJSON
}) {
  const prompt = commercialCriticPrompt({
    objective,
    commercialContext,
    commercialEvidenceGraph,
    proposedCommercialMotions,
    commercialDiscoveryCandidates,
    compactContingentContext,
    finalists
  });
  const promptHash = stableHash(prompt);
  const remainingSpendMicros = remainingRepairSpendMicros(
    budget,
    usage,
    completedRequests
  );
  const request = {
    model,
    system: prompt.system,
    user: prompt.user,
    maxTokens: Math.min(
      budget.maxOutputTokens,
      MAX_CRITIC_OUTPUT_TOKENS
    ),
    responseFormat: commercialCriticResponseFormat(finalists),
    plugins: [{ id: 'response-healing' }],
    temperature: 0,
    provider: {
      ...TOURNAMENT_PROVIDER_ROUTING,
      max_price: {
        ...budget.providerMaxPrice,
        request: roundMoney(Math.min(
          budget.providerMaxPrice.request,
          remainingSpendMicros / 1_000_000
        ))
      }
    }
  };
  const preflight = providerCallSpendPreflight(request, budget);
  const envelopeIssue = providerPromptEnvelopeIssue(preflight);
  if (envelopeIssue) {
    return {
      status: 'failed',
      cause: 'commercial_critic_prompt_recovery',
      request,
      preflight,
      trace: {
        contract: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
        contractVersion: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
        attempted: false,
        valid: false,
        verdict: 'not_run',
        acceptedFamilyIds: [],
        acceptedFinalistIds: [],
        selectedOrdering: [],
        reason: 'The critic request did not fit the bounded provider prompt envelope.',
        cause: envelopeIssue,
        preflight
      }
    };
  }
  if (remainingSpendMicros <= 0 ||
      (budget.hardStop &&
       preflight.callSpendCeilingMicros > remainingSpendMicros)) {
    return {
      status: 'failed',
      cause: 'commercial_critic_budget_recovery',
      request,
      preflight,
      trace: {
        contract: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
        contractVersion: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
        attempted: false,
        valid: false,
        verdict: 'not_run',
        acceptedFamilyIds: [],
        acceptedFinalistIds: [],
        selectedOrdering: [],
        reason: 'The critic request did not fit the remaining hard spend budget.',
        cause: 'critic_budget_unavailable',
        remainingSpendMicros,
        preflight
      }
    };
  }
  let completion;
  try {
    completion = await completeJSON(request);
  } catch (error) {
    const metadata = openRouterMetadata({
      model,
      purpose: 'opportunity_tournament_commercial_critic',
      structuredOutputContract: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
      status: 'failed',
      usage: error?.openRouterUsage,
      generationId: error?.openRouterGenerationId,
      diagnostics: error?.openRouterDiagnostics,
      promptHash,
      error: openRouterFailureCode(error)
    });
    return {
      status: 'failed',
      cause: 'commercial_critic_provider_recovery',
      request,
      preflight,
      metadata,
      trace: {
        contract: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
        contractVersion: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
        attempted: true,
        valid: false,
        verdict: 'rejected',
        acceptedFamilyIds: [],
        acceptedFinalistIds: [],
        selectedOrdering: [],
        reason: 'The commercial critic provider call failed.',
        cause: 'critic_provider_failure',
        promptTokenCanary: providerPromptTokenCanary(
          preflight,
          metadata.openRouterUsage
        ),
        preflight
      }
    };
  }
  const truncated = openRouterDiagnosticsIndicateTruncation(
    completion?.diagnostics
  );
  const metadata = openRouterMetadata({
    model,
    purpose: 'opportunity_tournament_commercial_critic',
    structuredOutputContract: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
    status: truncated ? 'incomplete' : 'completed',
    usage: completion?.usage,
    generationId: completion?.generationId,
    diagnostics: completion?.diagnostics,
    promptHash,
    error: truncated
      ? 'openrouter_truncated_structured_output'
      : undefined
  });
  const promptTokenCanary = providerPromptTokenCanary(
    preflight,
    metadata.openRouterUsage
  );
  const normalized = normalizeCommercialCritic(
    completion?.data,
    finalists,
    commercialEvidenceGraph
  );
  const valid = !truncated &&
    promptTokenCanary.withinCeiling !== false &&
    normalized.valid;
  return {
    status: valid ? 'completed' : 'failed',
    cause: valid ? '' : 'commercial_critic_contract_recovery',
    request,
    preflight,
    metadata,
    trace: {
      contract: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
      contractVersion: OPPORTUNITY_TOURNAMENT_CRITIC_CONTRACT,
      attempted: true,
      valid,
      verdict: valid ? normalized.verdict : 'rejected',
      acceptedFamilyIds: valid
        ? normalized.acceptedFamilyIds
        : [],
      acceptedFinalistIds: valid
        ? normalized.acceptedFinalistIds
        : [],
      selectedOrdering: valid ? normalized.selectedOrdering : [],
      selectedFinalistId: valid ? normalized.selectedFinalistId : '',
      comparisons: valid ? normalized.comparisons : [],
      rejectedFinalistCount: valid
        ? normalized.comparisons.filter((item) => item.verdict === 'reject').length
        : commercialCriticFinalists(finalists).length,
      reason: valid
        ? normalized.reason
        : 'The critic output was incomplete, unbounded, or did not satisfy the exact comparison contract.',
      cause: valid
        ? ''
        : truncated
          ? 'critic_output_truncated'
          : promptTokenCanary.withinCeiling === false
            ? 'critic_prompt_token_ceiling_exceeded'
            : 'critic_contract_invalid',
      promptTokenCanary,
      preflight
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
    prunedPrimaryActionVariantCount: 0,
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
      if (out.seedContract === SEED_CONTRACT_VERSION &&
          name === 'actions' &&
          !viablePrimaryRevenueAction(label)) {
        out.prunedPrimaryActionVariantCount += 1;
        continue;
      }
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
          const family = asObject(strategyFamilies.get(familyID));
          const familyEvidence = new Set(
            asArray(family.evidenceRefs)
          );
          const buyerGroundedFamilyObservations =
            normalizedFamilyBuyerObservationEvidenceRefs(
              out,
              familyID,
              evidenceByID
            )
              .filter((ref) => familyEvidence.has(ref));
          // A V2 timing fallback is only a low-confidence verification step.
          // Prefer buyer-grounded evidence, but do not turn an otherwise
          // parseable typed family into a provider-shape failure solely
          // because its timing seed cited the wrong family ref. A current
          // observation from that same family may ground "Determine whether"
          // wording; the full revenue gate still rejects unsupported buyer,
          // offer, acquisition, conversion, and attribution claims later.
          const typedFamilyObservations =
            out.seedContract === SEED_CONTRACT_VERSION &&
              ACQUISITION_MODES.has(firstText(family.acquisitionMode))
              ? strategyObservationEvidenceRefs(family.evidenceRefs)
              : [];
          familyLocalTimingRepair = repairTimingAsVerification(
            compactStrings([
              ...buyerGroundedFamilyObservations,
              ...typedFamilyObservations
            ]),
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
  const contractVersion = firstText(
    seed.contractVersion,
    seed.revenueContractVersion,
    seed.v
  );
  const grounding = normalizeRevenuePathGrounding(
    seed.g ?? seed.grounding,
    evidenceRefs
  );
  return compact({
    contractVersion,
    causalWitness: normalizeRevenueCausalWitness(
      seed.k ?? seed.causalWitness
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
    conversionDestination: truncate(firstText(
      seed.conversionDestination,
      seed.cd,
      asObject(grounding).conversionDestination
    ), 240),
    stopCondition: truncate(firstText(
      seed.stopCondition,
      seed.st,
      contractVersion === PRIOR_REVENUE_PATH_CONTRACT_VERSION
        ? 'Stop after 25 qualified prospects, 1 paid outcome, or 14 calendar days.'
        : ''
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
  const normalized = firstArray(value)
    .map((raw) => {
      const item = asObject(raw);
      const attribution = asObject(item.attribution);
      return compact({
        kind: truncate(firstText(item.kind, item.outcome, item.status), 100),
        status: truncate(firstText(item.status), 60),
        verified: item.verified === true,
        offer: truncate(firstText(item.offer), 180),
        buyerSegment: truncate(firstText(item.buyerSegment, item.audience), 180),
        channel: truncate(firstText(item.channel), 100),
        action: truncate(firstText(item.action), 240),
        evidenceRefs: compactStrings(item.evidenceRefs)
          .slice(0, 8)
          .map((ref) => truncate(ref, 240)),
        attribution: compact({
          objectiveId: truncate(firstText(attribution.objectiveId), 120),
          tournamentId: truncate(firstText(attribution.tournamentId), 120),
          hypothesisId: truncate(firstText(attribution.hypothesisId), 120),
          candidateId: truncate(firstText(attribution.candidateId), 120),
          actionId: truncate(firstText(attribution.actionId), 120),
          evidenceExperimentId: truncate(firstText(
            attribution.evidenceExperimentId
          ), 120),
          algorithmVersion: truncate(firstText(attribution.algorithmVersion), 80),
          experimentArm: truncate(firstText(attribution.experimentArm), 80),
          selectionProbability: finite(attribution.selectionProbability)
        }),
        occurredAt: firstText(item.occurredAt)
      });
    })
    .filter((item) => item.verified === true);
  const seen = new Set();
  return normalized
    .filter((item) => {
      const attribution = asObject(item.attribution);
      const attributionIDs = compactStrings([
        attribution.objectiveId,
        attribution.tournamentId,
        attribution.hypothesisId,
        attribution.candidateId,
        attribution.actionId,
        attribution.evidenceExperimentId
      ]);
      const key = stableHash({
        attributionIDs,
        kind: item.kind,
        status: item.status,
        occurredAt: item.occurredAt,
        evidenceRefs: item.evidenceRefs,
        fallback: attributionIDs.length > 0
          ? ''
          : compactStrings([
              item.offer,
              item.buyerSegment,
              item.channel,
              item.action
            ]).join('|')
      });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      validDate(right.occurredAt).getTime() -
        validDate(left.occurredAt).getTime()
    )
    .slice(0, 16);
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
  if (timingIsVerificationStep(tuple.timingTriggers.label)) {
    semantic.timing = Math.min(semantic.timing, 0.25);
    semantic.risk = Math.max(semantic.risk, 0.35);
    semantic.uncertainty = Math.max(semantic.uncertainty, 0.75);
  }
  const priorAdjustment = priorOutcomeAdjustment(tuple, priorOutcomes);
  semantic.expectedValue = clamp01(
    semantic.expectedValue + priorAdjustment.value
  );
  semantic.uncertainty = clamp01(
    semantic.uncertainty + priorAdjustment.uncertainty
  );

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
    const polarity = comparable(
      `${outcome.kind || ''} ${outcome.status || ''}`
    );
    const verifiedFactor = outcome.verified ? 1 : 0.55;
    if (/\b(won|paid|accepted|qualified reply|meeting booked|referral)\b/.test(polarity)) {
      value += 0.08 * verifiedFactor;
      uncertainty -= 0.04 * verifiedFactor;
    } else if (/\b(lost|rejected|skipped|spam|complaint)\b/.test(polarity)) {
      value -= 0.08 * verifiedFactor;
      uncertainty += 0.04;
    } else if (/\b(not now|no response|unverified)\b/.test(polarity)) {
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
    compareStableText(left.id, right.id);
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
  commercialCritic,
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
      compareStableText(left.id, right.id)
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
    commercialCritic,
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
      commercialCritic,
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
  commercialCritic,
  eligibleCount,
  exploredCount
}) {
  const tuple = hypothesis._tuple;
  const candidateLabel = truncate(firstText(candidate?.displayLabel), 180);
  const isV2 =
    TYPED_REVENUE_PATH_CONTRACT_VERSIONS.has(
      firstText(hypothesis?.revenuePath?.contractVersion)
    );
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
  const unboundedAction =
    candidateCopyLabel && !actionNamesCandidate
      ? `${hypothesis.action} for ${candidateCopyLabel} through ${hypothesis.channel}; prepare only the singular, reviewable next step.`
      : `${hypothesis.action} through ${hypothesis.channel}; prepare only the singular, reviewable next step.`;
  const action = truncate(
    explicitApprovalBoundedAction(unboundedAction),
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
    ? comparisonReason(
        hypothesis,
        runnerUp,
        commercialCritic,
        objective.currency
      )
    : '';
  const criticComparison = asArray(
    asObject(commercialCritic).comparisons
  ).map(asObject).find((comparison) =>
    firstText(comparison.finalistId) === firstText(hypothesis.id)
  );
  const paidOutcomeProbability = criticComparison?.paidOutcomeProbability;
  const expectedGrossIncomeMicros =
    criticComparison?.expectedGrossIncomeMicros;
  const timeToFirstDollarDays = criticComparison?.timeToFirstDollarDays;
  const recurringValue = firstText(criticComparison?.recurringValue);
  if (typeof paidOutcomeProbability !== 'number' ||
      !Number.isFinite(paidOutcomeProbability) ||
      paidOutcomeProbability <= 0 || paidOutcomeProbability > 1 ||
      typeof expectedGrossIncomeMicros !== 'number' ||
      !Number.isSafeInteger(expectedGrossIncomeMicros) ||
      expectedGrossIncomeMicros <= 0 ||
      typeof timeToFirstDollarDays !== 'number' ||
      !Number.isInteger(timeToFirstDollarDays) ||
      timeToFirstDollarDays < 1 || timeToFirstDollarDays > 30 ||
      !['one_time', 'repeatable', 'recurring'].includes(recurringValue)) {
    return null;
  }
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
    paidOutcomeProbability,
    timeToFirstDollarDays,
    recurringValue,
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

function explicitApprovalBoundedAction(value) {
  const action = firstText(value);
  if (/^(?:after|if|once|upon) explicit (?:user )?approval\b/i.test(
    action
  )) {
    return action;
  }
  return `After explicit approval, ${action}`;
}

function commercialCriticProbabilityLabel(value) {
  const percentage = value * 100;
  return `${Number.isInteger(percentage)
    ? percentage.toFixed(0)
    : percentage.toFixed(1)}%`;
}

function commercialCriticExpectedGrossLabel(value, currencyValue) {
  const currency = firstText(currencyValue, 'USD').toUpperCase();
  return `${(value / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} ${currency}`;
}

function commercialCriticRecurringValueLabel(value) {
  return firstText(value).replaceAll('_', '-');
}

function comparisonReason(
  winner,
  runnerUp,
  commercialCriticValue = {},
  currency = 'USD'
) {
  const critic = asObject(commercialCriticValue);
  const ordering = compactStrings(critic.selectedOrdering);
  const comparisons = asArray(critic.comparisons).map(asObject);
  if (critic.valid === true &&
      firstText(critic.verdict) === 'accepted' &&
      ordering[0] === firstText(winner.id) &&
      ordering.includes(firstText(runnerUp.id))) {
    const comparison = comparisons.find((item) =>
      firstText(item.finalistId) === firstText(winner.id)
    );
    const runnerUpComparison = comparisons.find((item) =>
      firstText(item.finalistId) === firstText(runnerUp.id)
    );
    if (!comparison || !runnerUpComparison) return '';
    const decisivePriority = commercialCriticNearestCashDecisivePriority(
      comparison,
      runnerUpComparison
    );
    const nearestCashComparison =
      `paid-outcome probability ${commercialCriticProbabilityLabel(
        comparison.paidOutcomeProbability
      )} vs ${commercialCriticProbabilityLabel(
        runnerUpComparison.paidOutcomeProbability
      )}; expected gross value ${commercialCriticExpectedGrossLabel(
        comparison.expectedGrossIncomeMicros,
        currency
      )} vs ${commercialCriticExpectedGrossLabel(
        runnerUpComparison.expectedGrossIncomeMicros,
        currency
      )}; recurring class ${commercialCriticRecurringValueLabel(
        comparison.recurringValue
      )} vs ${commercialCriticRecurringValueLabel(
        runnerUpComparison.recurringValue
      )}; time to first dollar ${comparison.timeToFirstDollarDays} vs ` +
      `${runnerUpComparison.timeToFirstDollarDays} days`;
    const dimensions = [
      ['evidenceStrength', 'evidence strength'],
      ['reachability', 'reachability'],
      ['cost', 'cost'],
      ['effort', 'effort'],
      ['uncertainty', 'uncertainty']
    ].map(([field, label]) =>
      `${label}: ${firstText(comparison?.[field], 'noted')}`
    ).join('; ');
    return truncate(
      `The independent commercial critic ranked it ahead of the runner-up; the critic ordering, not that score alone, controlled final selection. Nearest-cash comparison: ${nearestCashComparison}. The decisive priority was ${decisivePriority}. Secondary assessment: ${dimensions}.`,
      600
    );
  }
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

function commercialDiscoveryCandidateValues(discoveryValue) {
  const discovery = asObject(discoveryValue);
  if (discovery.valid !== true) return [];
  return asArray(discovery.candidates).map((candidateValue) => {
    const candidate = asObject(candidateValue);
    return compact({
      ...candidate,
      providers: compactStrings([
        firstText(candidate.provider),
        'commercial_discovery_evidence'
      ]),
      providerAttestedCommercialDiscovery: true,
      discoveredAt: firstText(discovery.discoveredAt)
    });
  });
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
  const userCopy = `${title} ${paidOffer} ${action} ${successSignal}`;
  if (/\b(?:approve source|approve observation|evidence approval|evidence id|crawl|generator|validator|retained strateg|missing[_ ])\b/i.test(
    userCopy
  ) ||
      experimentActionClaimsCompletedExternalExecution(action) ||
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
      firstText(asObject(evidence).revenueAssetRole) ===
        'current_owner_paid_conversion_asset' &&
      asObject(evidence).approvedSourceObservation === true &&
      asObject(evidence).profileControlledSource === true &&
      Boolean(safePublicURL(asObject(evidence).url)) &&
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
      /\b(?:add|approve|attach|build|create|document|make|provide|publish|supply)\b[^.!?;\n]{0,100}\b(?:current\s+)?(?:public\s+)?paid[- ]offer\s+(?:link|page|url)\b/i.test(
        userCopy
      ) ||
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
    assetEvidenceRef: firstText(asset.id),
    asset: asset
      ? {
          label: truncate(firstText(asset.label), 180),
          publicUrl: safePublicURL(asset.url)
        }
      : null
  };
}

function rehydrateGeneratedExperimentAsset(
  experimentValue,
  fullEvidenceCatalog,
  referenceTime
) {
  const experiment = asObject(experimentValue);
  const {
    assetEvidenceRef,
    ...publicExperiment
  } = experiment;
  if (Object.keys(experiment).length === 0 || !experiment.asset) {
    return Object.keys(experiment).length > 0 ? publicExperiment : null;
  }
  const evidenceByID = evidenceIndex(fullEvidenceCatalog);
  const asset = evidenceByID.get(firstText(assetEvidenceRef));
  if (!asset ||
      !compactStrings(experiment.evidenceRefs).includes(asset.id) ||
      firstText(asObject(asset).revenueAssetRole) !==
        'current_owner_paid_conversion_asset' ||
      !approvedOwnedAssetEvidence(asset, evidenceByID) ||
      !inboundAssetEvidenceSupportsPaidConversion(
        asset,
        referenceTime
      )) {
    return null;
  }
  return {
    ...publicExperiment,
    asset: {
      label: truncate(firstText(asset.label), 180),
      publicUrl: safePublicURL(asset.url)
    }
  };
}

function experimentInboundAcquisitionMechanismText(value) {
  return /\b(?:agent mediated|app store|community|comparison (?:listing|site)|directory|earned media|google business profile|job board|local search|marketplace discovery|nonbranded search|organic search|platform discovery|search engine|search listing)\b/i.test(
    firstText(value)
  );
}

function experimentActionClaimsCompletedExternalExecution(value) {
  const text = firstText(value);
  return /^(?:already\s+)?(?:sent|emailed|called|messaged|shared|invited|contacted|published|posted|advertised|launched|submitted|executed)\b/i.test(
    text
  ) ||
    /\b(?:i|we|the agent|profilescribe|the system)\s+(?:already\s+|has\s+|have\s+)?(?:sent|emailed|called|messaged|shared|invited|contacted|published|posted|advertised|launched|submitted|executed)\b/i.test(
    text
  ) ||
    /\b(?:was|were|has been|have been)\s+(?:sent|emailed|called|messaged|shared|published|posted|advertised|launched|submitted|executed)\b/i.test(
      text
    );
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
  generatedExperiment,
  commercialContext,
  commercialEvidenceGraph
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
      ) &&
      (!asset || generatedExperimentHasGroundedPermittedAcquisition(
        generatedExperiment,
        commercialContext,
        commercialEvidenceGraph
      ))) {
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
        compareStableText(left.id, right.id);
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
    ? ownedAssetEvidenceExperimentPlan(asset, {
        commercialContext,
        commercialEvidenceGraph
      })
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
      ? experimentPlan.stopCondition
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
    noGroundedPath: experimentPlan.noGroundedPath === true,
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
        compareStableText(left.id, right.id);
    })[0];
}

function ownedAssetEvidenceExperimentPlan(assetValue, optionsValue = {}) {
  const asset = asObject(assetValue);
  const options = asObject(optionsValue);
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
  const destination = ownedAssetConversionDestination(label, text);
  const acquisition = groundedPermittedAcquisition(
    options.commercialEvidenceGraph,
    options.commercialContext
  );
  if (!acquisition) {
    const candidateChannel = compactStrings(
      asObject(options.commercialContext).allowedChannels
    )[0];
    const candidateMechanism = candidateChannel
      ? `connected ${candidateChannel} distribution; buyer/channel fit unverified`
      : 'no permitted acquisition channel is configured';
    return {
      title: truncate(
        `Ground one buyer-to-channel acquisition path for ${label}`,
        240
      ),
      knownFact: truncate(firstText(
        asset.summary,
        asset.label
      ), 320),
      buyer: 'not yet grounded by approved demand or channel-fit evidence',
      paidOffer,
      acquisitionMechanism: candidateMechanism,
      conversionDestination: destination,
      paidConversion: outcome.paidConversion,
      attributionSignal:
        `${outcome.record}'s source/origin field after one acquisition path is grounded`,
      action: truncate(
        candidateChannel
          ? `No immediate acquisition channel is grounded. Review first: for the candidate ${candidateChannel} channel, approve exactly 1 current existing-audience, qualified-demand, referral, partner, or attributed-outcome record that names both a reachable buyer and why that buyer already discovers offers like ${paidOffer} through ${candidateChannel}. Stop after that 1 qualifying record or 14 calendar days. Do not publish, contact anyone, assume channel fit from the connection alone, monitor traffic as the primary action, advertise, submit a form, or execute automatically.`
          : `No immediate acquisition channel is grounded or permitted. Review first: select exactly 1 candidate discovery channel the user is willing to permit and attach exactly 1 current existing-audience, qualified-demand, referral, partner, or attributed-outcome record that names a reachable buyer and supports buyer/channel fit for ${paidOffer}. Stop after that one channel decision plus one qualifying record or 14 calendar days. Do not assume organic search, contact anyone, publish, advertise, submit a form, or execute automatically.`,
        700
      ),
      successSignal: truncate(
        `One approved record names a reachable buyer, one permitted acquisition channel, ${paidOffer}, the separate ${destination}, and the ${outcome.record} source field that would attribute ${outcome.paidConversion}.`,
        360
      ),
      stopCondition:
        'Stop after 1 qualifying buyer-and-channel-fit record or 14 calendar days, whichever comes first; permit at most 1 objective-preserving rerun after relevant new approved evidence.',
      noGroundedPath: !candidateChannel
    };
  }
  const channel = acquisition.channel;
  const buyerForTest = truncate(
    firstText(acquisition.buyer, buyer),
    160
  );
  const attributionSignal =
    `${outcome.record}'s source/origin field set to ${channel}`;
  return {
    title: truncate(
      `Test one active ${channel} acquisition path for ${label}`,
      240
    ),
    knownFact: truncate(firstText(
      asset.summary,
      asset.label
    ), 320),
    buyer: buyerForTest,
    paidOffer,
    acquisitionMechanism: channel,
    conversionDestination: destination,
    paidConversion: outcome.paidConversion,
    attributionSignal,
    action: truncate(
      `Review first: run exactly 1 bounded ${channel} acquisition test for ${buyerForTest} to encounter ${paidOffer} and complete ${outcome.paidConversion} at the separate ${destination}. Store ${channel} in the ${outcome.record}'s source/origin field and stop after 10 qualified buyers, 1 attributed paid outcome, or 14 calendar days, whichever comes first. This recommendation authorizes no outreach, publishing, advertising, form submission, or automatic execution.`,
      700
    ),
    successSignal: truncate(
      `One ${outcome.paidConversion} by ${buyerForTest}, with ${channel} stored in the ${outcome.record}'s source/origin field.`,
      360
    ),
    stopCondition:
      'Stop after 10 qualified buyers, 1 attributable paid outcome, or 14 calendar days, whichever comes first; permit at most 1 objective-preserving rerun informed by the recorded result.'
  };
}

function groundedPermittedAcquisition(graphValue, contextValue) {
  const graph = asObject(graphValue);
  const context = asObject(contextValue);
  const allowedChannels = compactStrings(context.allowedChannels);
  if (allowedChannels.length === 0) return null;
  const nodes = asArray(graph.nodes).map(asObject);
  const buyerNodes = nodes.filter((node) =>
    node.approved === true && asArray(node.roles).includes('defined_buyer')
  );
  for (const channel of allowedChannels) {
    const fitNode = nodes.find((node) =>
      node.approved === true &&
      asArray(node.roles).includes('channel_fit') &&
      asArray(node.channelFitChannels).some((value) =>
        allowedValue(value, [channel]) || allowedValue(channel, [value])
      )
    );
    if (!fitNode) continue;
    const buyerNode = buyerNodes.find((node) =>
      node.evidenceRef === fitNode.evidenceRef
    ) || buyerNodes[0];
    if (!buyerNode) continue;
    return {
      channel,
      buyer: firstText(buyerNode.label, buyerNode.summary),
      evidenceRefs: compactStrings([
        fitNode.evidenceRef,
        buyerNode.evidenceRef
      ])
    };
  }
  return null;
}

function generatedExperimentHasGroundedPermittedAcquisition(
  generatedExperimentValue,
  commercialContextValue,
  commercialEvidenceGraphValue
) {
  const experiment = asObject(generatedExperimentValue);
  const grounded = groundedPermittedAcquisition(
    commercialEvidenceGraphValue,
    commercialContextValue
  );
  if (!grounded) return false;
  return allowedValue(
    firstText(experiment.acquisitionMechanism),
    [grounded.channel]
  ) || allowedValue(
    grounded.channel,
    [firstText(experiment.acquisitionMechanism)]
  );
}

function ownedAssetConversionDestination(label, evidenceText) {
  const text = comparable(firstText(evidenceText));
  let destinationType = 'service page';
  if (/\b(?:appointment|book|booking|consultation|home visit|schedule)\b/.test(text)) {
    destinationType = 'booking page';
  } else if (/\b(?:buy|checkout|order|product|purchase)\b/.test(text)) {
    destinationType = 'checkout';
  } else if (/\b(?:membership|sign up|signup|subscribe|subscription)\b/.test(text)) {
    destinationType = 'subscription page';
  } else if (/\b(?:application|apply|professional role)\b/.test(text)) {
    destinationType = 'application page';
  } else if (/\b(?:licence|license|licensing)\b/.test(text)) {
    destinationType = 'licensing page';
  } else if (/\b(?:sponsor|sponsorship)\b/.test(text)) {
    destinationType = 'sponsorship inquiry page';
  } else if (/\b(?:demo|demonstration)\b/.test(text)) {
    destinationType = 'demo request page';
  } else if (/\bdownload\b/.test(text)) {
    destinationType = 'download page';
  }
  return truncate(`${label} ${destinationType}`, 140);
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
    noGroundedPath: true,
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
  const recoveryCause = [
    'provider_request_serialization',
    'bounded_prompt_envelope',
    'usable_strategy_generation',
    'within_budget_strategy_generation',
    'structured_strategy_family_repair',
    'commercial_critic_displaced_by_repair',
    'commercial_critic_prompt_recovery',
    'commercial_critic_budget_recovery',
    'commercial_critic_provider_recovery',
    'commercial_critic_contract_recovery'
  ].find((cause) => missing.includes(cause));
  if (!recoveryCause) return null;
  const recoveryByCause = {
    provider_request_serialization: {
      kind: 'strategy_generation_request_serialization_recovery',
      title:
        'Retry once after the local provider request can be serialized',
      action:
        'Preserve the approved evidence snapshot and make no business or provider-side changes. Correct and verify the local structured-request serialization path, then retry the same bounded tournament exactly once; this is a local request-construction failure, not missing market evidence.',
      stopCondition:
        'Stop after 1 serialization-recovery retry; if local request construction fails again, surface the technical failure and do not call the provider.',
      trigger:
        'Rerun once only after the exact structured provider request serializes successfully; new business evidence is not required.'
    },
    bounded_prompt_envelope: {
      kind: 'strategy_generation_prompt_envelope_recovery',
      title:
        'Retry once after the tournament prompt fits its internal envelope',
      action:
        `Preserve the approved evidence snapshot and make no business or provider-side changes. Reduce the local structured request to at most ${MAX_PROVIDER_REQUEST_BODY_BYTES} serialized bytes while preserving its objective and exact evidence references, verify both initial and repair requests, then retry the same bounded tournament exactly once.`,
      stopCondition:
        'Stop after 1 prompt-envelope recovery retry; if the exact request still exceeds the local bound, surface the technical failure and do not call the provider.',
      trigger:
        'Rerun once only after the exact structured request fits the internal provider prompt envelope; new business evidence is not required.'
    },
    usable_strategy_generation: {
      kind: 'strategy_generation_provider_recovery',
      title: 'Retry strategy generation once after provider recovery',
      action:
        'Preserve the approved evidence snapshot and make no business or provider-side changes. After the model provider is healthy and strict structured-output support is verified, retry the same bounded tournament exactly once.',
      stopCondition:
        'Stop after 1 provider-recovery retry; if structured strategy generation fails again, surface the technical failure and do not spend again automatically.',
      trigger:
        'Rerun once only after provider health and strict structured-output support are verified; new business evidence is not required.'
    },
    within_budget_strategy_generation: {
      kind: 'strategy_generation_budget_recovery',
      title:
        'Retry strategy generation once on a budget-compatible route',
      action:
        'Preserve the approved evidence snapshot and do not raise the user budget. Select a model/provider route whose conservative prompt-token, output-token, and possible fixed per-request fee ceiling fits the existing total LLM budget, then retry the same bounded tournament exactly once. The flat request-price field is a per-request routing filter, not a total call-cost cap.',
      stopCondition:
        'Stop after 1 budget-compatible retry; if it exceeds or cannot satisfy the existing cap, surface the budget failure and do not spend again automatically.',
      trigger:
        'Rerun once only after the conservative prompt-token, output-token, and possible fixed per-request fee ceiling is verified to fit the existing total LLM budget; the flat request-price field is a per-request routing filter, not a total call-cost cap.'
    },
    structured_strategy_family_repair: {
      kind: 'strategy_generation_shape_recovery',
      title:
        'Retry once for a structurally complete strategy comparison',
      action:
        'Preserve the approved evidence snapshot and make no business, outreach, publishing, or provider-side changes. Retry the same objective exactly once only after the strict response route can return two complete comparison families; new market evidence is not required.',
      stopCondition:
        'Stop after 1 response-shape retry; if two complete comparison families still cannot be returned, surface the AI contract failure and do not spend again automatically.',
      trigger:
        'Rerun once only after strict structured-output support for two complete comparison families is verified; new business evidence is not required.'
    },
    commercial_critic_displaced_by_repair: {
      kind: 'strategy_generation_critic_displaced_by_repair',
      title:
        'Retry once when the generator can complete on call one',
      action:
        'Preserve the objective and approved evidence. Retry the same tournament once only after the generator route can return the complete strict family contract on call 1, leaving call 2 for the mandatory comparative critic. Do not treat this response-shape failure as missing market evidence or execute an uncriticized recommendation.',
      stopCondition:
        'Stop after 1 objective-preserving retry; if generator repair is still required or the critic still cannot run, surface the technical contract failure.',
      trigger:
        'Rerun once only after the strict generator response is verified to complete on call 1 so call 2 remains available for the critic.'
    },
    commercial_critic_prompt_recovery: {
      kind: 'strategy_generation_critic_prompt_recovery',
      title: 'Retry once after the commercial critic request is bounded',
      action:
        'Preserve the objective and approved evidence. Correct the local compact critic request so it serializes within the provider prompt envelope, then retry the same tournament once; do not change business evidence or execute the recommendation.',
      stopCondition:
        'Stop after 1 critic-prompt recovery retry; if the request is still invalid or oversized, surface the technical failure without a provider call.',
      trigger:
        'Rerun once only after the exact commercial critic request passes local serialization and prompt-envelope checks.'
    },
    commercial_critic_budget_recovery: {
      kind: 'strategy_generation_critic_budget_recovery',
      title: 'Retry once when the commercial critic fits the existing budget',
      action:
        'Preserve the objective, approved evidence, and total budget. Retry the same tournament once only after the generator plus compact critic conservative ceilings fit the existing spend cap; do not raise the budget or substitute an uncriticized recommendation.',
      stopCondition:
        'Stop after 1 budget-compatible critic retry; if both calls cannot fit the existing cap, surface the technical budget failure.',
      trigger:
        'Rerun once only after both bounded calls fit the unchanged total tournament budget.'
    },
    commercial_critic_provider_recovery: {
      kind: 'strategy_generation_critic_provider_recovery',
      title: 'Retry once after the commercial critic provider recovers',
      action:
        'Preserve the generated families, objective, and approved evidence. After strict critic structured-output support is healthy, retry the same tournament once; do not accept or execute an uncriticized recommendation.',
      stopCondition:
        'Stop after 1 critic-provider recovery retry; if it fails again, surface the technical failure.',
      trigger:
        'Rerun once only after the critic provider route supports the exact strict contract.'
    },
    commercial_critic_contract_recovery: {
      kind: 'strategy_generation_critic_contract_recovery',
      title: 'Retry once for a complete commercial critic verdict',
      action:
        'Preserve the objective and approved evidence. Retry the same tournament once only after the compact critic can return one complete verdict per family under its strict contract; do not treat malformed or truncated critic output as market evidence.',
      stopCondition:
        'Stop after 1 critic-contract recovery retry; if the verdict remains incomplete, surface the technical failure.',
      trigger:
        'Rerun once only after strict output support for the commercial critic contract is verified.'
    }
  };
  const recovery = recoveryByCause[recoveryCause];
  const successSignal =
    'One new attributed revenue event—a paid booking, payment, order, signed contract, reimbursed claim, license or royalty payment, commission or referral fee, sponsorship payment, platform payout, or compensated-role payment—with a stored source, referral, campaign, channel, or UTM value.';
  return {
    contractVersion: REVENUE_EVIDENCE_EXPERIMENT_CONTRACT,
    id: `experiment-${stableHash({
      kind: recovery.kind,
      evidenceHash,
      missing
    }).slice(0, 24)}`,
    kind: recovery.kind,
    title: recovery.title,
    action: recovery.action,
    missingEvidence: missing,
    paidOutcome: truncate(
      observableRevenueText(objective?.successMetric)
        ? firstText(objective?.successMetric)
        : successSignal,
      360
    ),
    successSignal,
    stopCondition: recovery.stopCondition,
    asset: null,
    evidenceRefs: [],
    requiresReview: true,
    rerunPolicy: {
      maxReruns: 1,
      trigger: recovery.trigger
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
  return Boolean(paidConversionEvidenceSignalCombination(
    compactStrings([
      evidence.label,
      evidence.summary,
      evidence.url
    ]).join(' ')
  ));
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
        compareStableText(left.id, right.id)
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
    const providerAttestedLivePaidDemandKind =
      raw.providerAttestedCommercialDiscovery === true &&
      contractEnum(firstText(raw.commercialRole)) === 'paid_demand' &&
      LIVE_PAID_DEMAND_CANDIDATE_KINDS.has(contractEnum(declaredKind));
    const candidateKind = ownedInboundAssetCandidate(raw)
      ? OWNED_INBOUND_ASSET_KIND
      : providerAttestedLivePaidDemandKind
        ? contractEnum(declaredKind)
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
      commercialRole: COMMERCIAL_DISCOVERY_CANDIDATE_ROLES.has(
        contractEnum(firstText(raw.commercialRole))
      )
        ? contractEnum(firstText(raw.commercialRole))
        : undefined,
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
      providerAttestedCommercialDiscovery:
        raw.providerAttestedCommercialDiscovery === true,
      selected: false,
      discoveredAt: validISOString(raw.discoveredAt) || timestamp
    });
  }
  const combined = combineExactCandidates(candidates);
  combined.sort((left, right) =>
    right.score.total - left.score.total ||
    compareStableText(left.id, right.id)
  );
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
      commercialRole: firstText(
        existing.commercialRole,
        candidate.commercialRole
      ),
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
      providerAttestedCommercialDiscovery:
        existing.providerAttestedCommercialDiscovery === true ||
        candidate.providerAttestedCommercialDiscovery === true,
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
    TYPED_REVENUE_PATH_CONTRACT_VERSIONS.has(
      revenuePath.contractVersion
    );
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
  const conversionAction = firstText(revenuePath.conversionAction);
  const conversionDestination = firstText(
    revenuePath.conversionDestination
  );
  const supportingBottleneck = firstText(
    revenuePath.supportingBottleneck
  );
  const semantic = revenuePathSemanticChecks(revenuePath);
  if (!paidOfferText(offer)) {
    reasons.add('missing_paid_offer');
  }
  if (!semantic.incrementalIncome) {
    reasons.add('missing_incremental_income');
  }
  if (!semantic.conversionAction) {
    reasons.add('missing_paid_conversion');
  }
  if (!semantic.observableRevenue) {
    reasons.add('missing_observable_revenue');
  }
  if (!semantic.attributionSignal) {
    reasons.add('missing_attribution_signal');
  }
  if (revenuePath.contractVersion === REVENUE_PATH_CONTRACT_VERSION) {
    if (!semantic.conversionDestination ||
        comparable(conversionDestination) === comparable(channel)) {
      reasons.add('invalid_conversion_destination');
    }
    if (!semantic.numericStop) {
      reasons.add('missing_numeric_stop');
    }
  }

  const acquisitionText =
    `${channel} ${conversionAction} ${conversionDestination}`;
  if (prohibitedAcquisitionText(acquisitionText)) {
    reasons.add('prohibited_acquisition');
  } else if (!isV2 &&
      ACQUISITION_MODES.has(revenuePath.acquisitionMode) &&
      !acquisitionModeMatchesText(
        revenuePath.acquisitionMode,
        acquisitionText
      )) {
    reasons.add('invalid_acquisition_mode');
  }

  if (revenuePath.contractVersion === REVENUE_PATH_CONTRACT_VERSION &&
      (passiveOrObservationalPrimaryAction(action) ||
       passiveOrObservationalPrimaryAction(conversionAction))) {
    reasons.add('passive_or_observational_primary_action');
  } else if (experimentActionClaimsCompletedExternalExecution(action) ||
      experimentActionClaimsCompletedExternalExecution(
        conversionAction
      )) {
    reasons.add('claimed_completed_external_execution');
  } else if (!revenueAdvancingAction(action) ||
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
  const activeRevenueAction = {
    contractVersion: ACTIVE_REVENUE_ACTION_CONTRACT,
    primaryAction: action,
    conversionAction,
    active: !passiveOrObservationalPrimaryAction(action) &&
      !passiveOrObservationalPrimaryAction(conversionAction) &&
      !experimentActionClaimsCompletedExternalExecution(action) &&
      !experimentActionClaimsCompletedExternalExecution(conversionAction) &&
      !operationOnlyAction(action) &&
      !operationOnlyAction(conversionAction) &&
      revenueAdvancingAction(action) &&
      semantic.conversionAction,
    causalAcquisitionPath:
      ACQUISITION_MODES.has(revenuePath.acquisitionMode) &&
      !prohibitedAcquisitionText(`${channel} ${conversionAction}`),
    incrementalRevenueOutcome: semantic.incrementalIncome
  };
  return {
    valid: reasons.size === 0,
    reasons: [...reasons].sort(),
    revenuePath: {
      ...publicRevenuePath,
      activeRevenueAction
    }
  };
}

function revenuePathGroundingReasons(
  tuple,
  revenuePath,
  evidenceByID,
  referenceTime
) {
  const grounding = asObject(revenuePath._grounding);
  const causalWitness = revenueCausalWitnessFieldChecks(revenuePath);
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
  const systemAttributionRefs = new Set(
    [...evidenceByID.entries()]
      .filter(([, evidence]) =>
        verifiedSystemAttributionCapabilityEvidence(evidence)
      )
      .map(([ref]) => ref)
  );
  for (const [name, refs] of Object.entries(groups)) {
    if (name !== 'attribution' && refs.some((ref) =>
      systemAttributionRefs.has(ref)
    )) {
      reasons.add(`system_attribution_capability_misused_as_${name}`);
    }
  }
  for (const [name, refs] of Object.entries(groups)) {
    if (refs.length === 0 ||
        refs.some((ref) =>
          /^source:/i.test(ref) || !evidenceByID.has(ref)
        )) {
      reasons.add(`missing_${name}_evidence`);
    }
  }
  const discoveryRoleRequirements = {
    buyer: ['defined_buyer'],
    paid_offer: ['paid_offer', 'demand_signal'],
    acquisition: ['acquisition', 'channel_fit'],
    conversion_destination: ['conversion_destination'],
    paid_conversion: ['paid_conversion'],
    attribution: []
  };
  for (const [name, refs] of Object.entries(groups)) {
    const requiredRoles = discoveryRoleRequirements[name] || [];
    for (const ref of refs) {
      const evidence = asObject(evidenceByID.get(ref));
      if (!verifiedCommercialDiscoveryEvidence(evidence)) continue;
      const roles = new Set(
        compactStrings(evidence.commercialDiscoveryRoles).map(contractEnum)
      );
      if (name === 'attribution' ||
          requiredRoles.some((role) => !roles.has(role))) {
        reasons.add(`commercial_discovery_role_misused_as_${name}`);
      }
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
      !acquisitionEvidenceRefsSupportMode(
        revenuePath.acquisitionMode,
        groups.acquisition,
        evidenceByID
      )) {
    reasons.add('unsupported_acquisition_evidence');
  }
  if (groups.acquisition.some((ref) =>
    !currentAffirmativeAcquisitionEvidence(
      evidenceByID.get(ref),
      referenceTime
    )
  )) {
    reasons.add('noncurrent_or_negative_acquisition_evidence');
  }
  const destination = firstText(
    grounding.conversionDestination
  );
  const destinationEvidence =
    evidenceText(groups.conversion_destination);
  const discoveryDestinationSupported =
    commercialDiscoveryDestinationEvidenceSupported(
      groups.conversion_destination,
      evidenceByID,
      revenuePath.revenueMechanism,
      destination,
      causalWitness.conversionDestination
    );
  if (!destination ||
      comparable(destination) === comparable(
        asObject(tuple?.channels).label
      ) ||
      (
        !conversionDestinationText(destination) &&
        !causalWitness.conversionDestination
      ) ||
      (
        groups.conversion_destination.length > 0 &&
        (
          (
            !discoveryDestinationSupported &&
            (
              !conversionDestinationEvidenceText(destinationEvidence) ||
              textOverlap(destination, destinationEvidence) <= 0 ||
              !paidConversionEvidenceText(
                destinationEvidence,
                revenuePath.revenueMechanism
              )
            )
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

function commercialDiscoveryDestinationEvidenceSupported(
  refsValue,
  evidenceByID,
  mechanism,
  destination,
  typedDestination = false
) {
  if (mechanism !== 'compensated_role' ||
      (
        !conversionDestinationText(destination) &&
        typedDestination !== true
      )) {
    return false;
  }
  return compactStrings(refsValue).some((ref) => {
    const evidence = asObject(evidenceByID.get(ref));
    if (!verifiedCommercialDiscoveryEvidence(evidence)) return false;
    const roles = new Set(
      compactStrings(evidence.commercialDiscoveryRoles).map(contractEnum)
    );
    return roles.has('conversion_destination') &&
      roles.has('paid_conversion') &&
      roles.has('paid_offer') &&
      roles.has('demand_signal') &&
      textOverlap(
        destination,
        compactStrings([
          evidence.label,
          evidence.summary,
          evidence.url
        ]).join(' ')
      ) > 0;
  });
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
  const text = primaryActionSemanticText(value);
  if (nonRevenueArtifactOrQuestionAction(text)) return false;
  if (demandSurfacePlacementAction(text)) return false;
  if (explicitlyUnpaidPrimaryAction(value)) return false;
  const advancesAcquisition =
    /\b(inbound|warm|permission(?:ed)?|opt in|introduc(?:e|tion)|refer(?:s|red|ring|ral)?|recommend(?:s|ed|ing|ation)?|partner|invite|request|offer|proposal|quote|checkout|order|purchase|sale|sell|book(?:ed)?|contract|agreement|sign(?:ed)?|close|deposit|invoice|pay(?:ment|ing)?|subscribe|subscription|retainer|pilot|licen[cs](?:e|ing)|royalt(?:y|ies)|commission|sponsor(?:ship)?|payout|compensated|salary|wage|hire|role)\b/i.test(
      text
    );
  const advancesPaidDemandResponse =
    /\b(?:apply|bid|respond|submit)\b/i.test(text) &&
    /\b(?:application|bid|proposal|request for proposal|response|rfp|solicitation)\b/i.test(
      text
    ) &&
    /\b(?:compensated|contract|paid|payment|salary|wage)\b/i.test(text);
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
  // The referral-role validator already treats a natural, review-first ask
  // such as "recommend/refer one qualified buyer to book" as the causal
  // acquisition step. Keep the generic revenue predicate aligned without
  // requiring the model to repeat the noun "referral", a partner label, or
  // "paid" in every action variant when the typed paid offer and conversion
  // remain separately grounded. The shared predicate still rejects bare
  // introductions as well as negated or explicitly free/unpaid actions.
  const advancesQualifiedReferral = qualifiedReferralCashAction(value);
  return (advancesAcquisition || advancesPaidDemandResponse) &&
    (
      namesPaidCommitment ||
      namesPermissionedDemand ||
      advancesQualifiedReferral
    );
}

function qualifiedReferralCashAction(value) {
  const text = primaryActionSemanticText(value);
  if (!text || negatedPrimaryRevenueAction(text) ||
      explicitlyUnpaidPrimaryAction(value)) {
    return false;
  }
  const namesReferralStep =
    /\b(?:introduc(?:e|es|ed|ing|tion|tions)?|refer(?:s|red|ring|ral|rals)?|recommend(?:s|ed|ing|ation|ations)?)\b/.test(
      text
    );
  const namesCashDestination =
    /\b(?:book|buy|checkout|close|contract|deposit|invoice|order|pay(?:ment|ing)?|purchase|reimburs|sale|sell|sign|subscrib)\w*\b/.test(
      text
    ) ||
    /\bpaid\s+(?:appointment|booking|consultation|contract|engagement|license|offer|order|pilot|product|service|session|subscription|visit|work)\b/.test(
      text
    );
  return namesReferralStep && namesCashDestination;
}

function explicitlyUnpaidPrimaryAction(value) {
  const raw = firstText(value).replace(
    /\b(?:ad|commission|debt|duty|gluten|interest|maintenance|risk|royalty|sugar|tax)[- ]free\b/gi,
    'attribute_included'
  );
  const text = primaryActionSemanticText(raw);
  return /\b(?:complimentary|free|pro bono|unpaid)\b/.test(text) ||
    /\b(?:at no cost|no charge|without payment)\b/.test(text);
}

function demandSurfacePlacementAction(value) {
  const text = primaryActionSemanticText(value);
  const placesListing = /\b(?:list|place|publish)\b/.test(text) ||
    (/\bsubmit\b/.test(text) &&
     /\b(?:listing|offer|package|plan|product|service|software|subscription)\b/.test(
       text
     ));
  return placesListing &&
    /\b(?:app store|comparison (?:listing|site)|demand surface|directory|marketplace|platform)\b/.test(
      text
    );
}

function passiveOrObservationalPrimaryAction(value) {
  const text = primaryActionSemanticText(value);
  if (!text) return true;
  const namesPassiveWork =
    /\b(?:analy[sz](?:e|es|ed|ing)|audit(?:s|ed|ing)?|check(?:s|ed|ing)?|count(?:s|ed|ing)?|inspect(?:s|ed|ing)?|measur(?:e|es|ed|ing)|monitor(?:s|ed|ing)?|observ(?:e|es|ed|ing)|record(?:s|ed|ing)?|research(?:es|ed|ing)?|review(?:s|ed|ing)?|stud(?:y|ies|ied|ying)|track(?:s|ed|ing)?|verif(?:y|ies|ying)|watch(?:es|ed|ing)?)\b/.test(
      text
    );
  if (!namesPassiveWork) return false;
  const namesActiveCommercialStep =
    /\b(?:activate|begin|book|buy|close|complete|convert|enroll|invite|launch|list|offer|open|place|present|propose|purchase|request|route|sell|sign|start|submit|use)\b/.test(
      text
    ) &&
    /\b(?:application|booking|buyer|checkout|contract|customer|inbound|introduction|order|organic search|paid|partner|payment|proposal|purchase|referral|revenue|sale|search|subscription)\b/.test(
      text
    );
  return !namesActiveCommercialStep;
}

function boundedRevenueStopCondition(value) {
  const text = firstText(value);
  return /\b\d+\b/.test(text) &&
    /\b(?:applications?|attempts?|bookings?|buyers?|calendar days?|conversions?|days?|hours?|inquiries|introductions?|outcomes?|proposals?|prospects?|referral requests?|referrals?|sales?|samples?|visits?|weeks?)\b/i.test(
      text
    ) &&
    /\b(?:stop|whichever comes first|at most|maximum|or)\b/i.test(text);
}

function operationOnlyAction(value) {
  const text = primaryActionSemanticText(value);
  const namesOperations =
    /\b(eligibility|coverage|schedule|scheduling|workflow|process|operations?|administration|documentation|profile|content|research|review|verify|check|map|validate|optimi[sz]e|automate|audit|diagnostic)\b/i.test(
      text
    );
  if (!namesOperations) return false;
  const namesPaidCommitment =
    /\b(?:paid|billable|reimburs(?:able|ed|ement))\s+(?:(?:[\p{L}\p{N}-]+)\s+){0,4}(?:bookings?|orders?|pilots?|consultations?|engagements?|sessions?|services?|visits?)\b/iu.test(
      text
    ) ||
    /\b(payment|purchase|sale|contract|agreement|deposit|invoice|order|checkout|subscription|retainer|reimburs(?:able|ed|ement)|licen[cs]e|royalt(?:y|ies)|commission|referral fee|sponsorship|platform payout|compensated role|salary|wage)\b/i.test(
      text
    );
  const namesBoundedAcquisitionStep =
    /\b(inbound|warm (?:introduction|referral)|permissioned|partner (?:introduction|referral|channel)|existing (?:customer|client|patient)|introduc(?:e|tion)|refer(?:s|red|ring|ral)?|recommend(?:s|ed|ing|ation)?)\b/i.test(
      text
    ) &&
    /\b(ask|offer|proposal|quote|request|invite|introduc(?:e|tion)|refer(?:s|red|ring|ral)?|recommend(?:s|ed|ing|ation)?|book(?:ing|ed)?|checkout|order|purchase|contract|agreement|pilot)\b/i.test(
      text
    );
  return !namesPaidCommitment && !namesBoundedAcquisitionStep;
}

function viablePrimaryRevenueAction(value) {
  return !passiveOrObservationalPrimaryAction(value) &&
    !operationOnlyAction(value) &&
    !negatedPrimaryRevenueAction(value) &&
    revenueAdvancingAction(value) &&
    !experimentActionClaimsCompletedExternalExecution(value);
}

function negatedPrimaryRevenueAction(value) {
  const text = primaryActionSemanticText(value);
  return /\b(?:do not|dont|never|no|not|refrain|without)\b/.test(text);
}

function primaryActionSemanticText(value) {
  return comparable(firstText(value)).replace(
    /\b(?:(?:after|following|pending) (?:explicit |human |user )?(?:approval|review)|review first|subject to (?:explicit |human |user )?(?:approval|review)|once (?:explicitly |human )?approved)\b[,:;-]?/g,
    ' '
  );
}

function nonRevenueArtifactOrQuestionAction(value) {
  const text = comparable(firstText(value));
  const namesArtifact =
    /\b(?:analysis|analytics|article|dashboard|findings|metrics|report)\b/.test(
      text
    );
  const asksOnlyForEvidence =
    /\b(?:ask whether|confirm|determine|find out)\b|\bavailability\b/.test(
      text
    );
  if (!namesArtifact && !asksOnlyForEvidence) return false;
  return !/\b(?:apply|book|buy|close|distribute|enroll|hire|introduce|invite|present|propose|purchase|recommend|refer|request|route|sell|sign|submit|subscribe)\b/.test(
    text
  );
}

function observableRevenueText(value) {
  return /\b(paid (?:booking|claim|invoice|order|pilot)|(?:paid|billable|reimbursed)\s+(?:(?:[\p{L}\p{N}-]+)\s+){0,5}(?:consultations?|engagements?|services?|sessions?|visits?)|payment(?: receipt)?|signed (?:contract|agreement)|contract signed|deposit received|invoice (?:issued|accepted|paid)|checkout|purchase|order|sale|subscription|retainer|revenue recorded|income recorded|reimbursement (?:received|paid)|claim paid|licen[cs]e (?:signed|payment received)|royalty (?:statement|payment)|commission (?:recorded|paid)|referral fee (?:recorded|paid)|sponsorship (?:contract signed|payment received)|platform payout recorded|compensation (?:offer accepted|payment recorded)|salary payment|wage payment)\b/iu.test(
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
      /\b(?:existing|current|former|past|returning) (?:customer|client|patient)\b/,
    partner_channel:
      /\b(?:partner channel|partner referral|partner introduction|affiliate|association referral)\b/
  };
  return patterns[mode]?.test(text) === true;
}

function acquisitionEvidenceRefsSupportMode(
  mode,
  refsValue,
  evidenceByID
) {
  const refs = compactStrings(refsValue);
  const ordinaryText = compactStrings(refs
    .map((ref) => asObject(evidenceByID.get(ref)))
    .filter((evidence) =>
      !verifiedCommercialDiscoveryEvidence(evidence)
    )
    .map((evidence) => {
    return compactStrings([
      evidence.label,
      evidence.summary,
      evidence.url
    ]).join(' ');
  })).join(' ');
  if (ordinaryText && acquisitionEvidenceSupportsMode(mode, ordinaryText)) {
    return true;
  }
  return refs.some((ref) => {
    const evidence = asObject(evidenceByID.get(ref));
    if (!verifiedCommercialDiscoveryEvidence(evidence)) return false;
    const roles = new Set(
      compactStrings(evidence.commercialDiscoveryRoles).map(contractEnum)
    );
    if (!roles.has('acquisition') || !roles.has('channel_fit')) {
      return false;
    }
    if (mode === 'partner_channel') {
      return roles.has('prospective_partner');
    }
    if (mode === 'inbound') {
      return roles.has('paid_offer') &&
        roles.has('conversion_destination') &&
        roles.has('demand_signal');
    }
    if (mode === 'permissioned_outreach') {
      // This supports presenting one exact, review-first buyer action only.
      // It does not prove contact permission or authorize execution; the
      // provider-attested review channel and exact candidate are checked
      // separately by the final gate.
      return roles.has('defined_buyer') &&
        firstText(evidence.commercialDiscoveryKind) ===
          'verified_external_professional_target' &&
        Boolean(safePublicHTTPSURL(evidence.url));
    }
    // Public professional identity never by itself proves warmness or an
    // existing-customer relationship.
    return false;
  });
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
  const providerDiscovery =
    verifiedCommercialDiscoveryEvidence(evidence);
  if (providerDiscovery &&
      !commercialDiscoverySupportsRevenueRole(
        evidence,
        mechanism,
        role
      )) {
    return false;
  }
  if ((!providerDiscovery &&
       evidence.approvedSourceObservation !== true) ||
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

function currentAffirmativeAcquisitionEvidence(
  evidenceValue,
  referenceTime
) {
  const evidence = asObject(evidenceValue);
  const verifiedPriorOutcome =
    firstText(evidence.type) === 'verified_prior_outcome' &&
    firstText(evidence.provenance) === 'verified_prior_outcome';
  if (verifiedPriorOutcome && !affirmativePriorOutcome(evidence)) {
    return false;
  }
  const providerDiscovery =
    verifiedCommercialDiscoveryEvidence(evidence);
  const discoveryRoles = new Set(
    compactStrings(evidence.commercialDiscoveryRoles).map(contractEnum)
  );
  if (providerDiscovery &&
      (!discoveryRoles.has('acquisition') ||
       !discoveryRoles.has('channel_fit'))) {
    return false;
  }
  if ((!verifiedPriorOutcome &&
       !providerDiscovery &&
       evidence.approvedSourceObservation !== true) ||
      evidence.current === false ||
      /\b(?:archived|cancelled|canceled|closed|discontinued|ended|expired|former|historical|inactive|not accepting|sold out|stale|unavailable|withdrawn)\b/i.test(
        firstText(evidence.status)
      )) {
    return false;
  }
  const referenceDate = new Date(referenceTime);
  const observedDate = new Date(firstText(
    evidence.observedAt,
    evidence.occurredAt
  ));
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
  const text = comparable(compactStrings([
    evidence.label,
    evidence.summary,
    evidence.status
  ]).join(' '));
  return !/\b(?:archived|cancelled|canceled|closed|discontinued|ended|expired|inactive|no longer|not (?:accepting|active|available)|sold out|stale|unavailable|withdrawn)\b/.test(
    text
  );
}

function verifiedCommercialDiscoveryEvidence(value) {
  const evidence = asObject(value);
  return evidence.providerAttestedCommercialDiscovery === true &&
    firstText(evidence.commercialDiscoveryProvider) &&
    firstText(evidence.commercialDiscoveryProvenance) &&
    compactStrings(evidence.commercialDiscoveryRoles).length > 0 &&
    /^external_discovery:/i.test(firstText(evidence.id));
}

function commercialDiscoverySupportsRevenueRole(
  evidenceValue,
  mechanism,
  role
) {
  const evidence = asObject(evidenceValue);
  const roles = new Set(
    compactStrings(evidence.commercialDiscoveryRoles).map(contractEnum)
  );
  if (!REVENUE_MECHANISMS.has(mechanism) ||
      !roles.has('demand_signal')) {
    return false;
  }
  const evidenceText = compactStrings([
    evidence.label,
    evidence.summary,
    evidence.url
  ]).join(' ');
  if (role === 'paid_offer') {
    return roles.has('paid_offer') &&
      revenueMechanismEvidenceText(mechanism, evidenceText);
  }
  if (role === 'paid_conversion') {
    return roles.has('paid_conversion') &&
      roles.has('conversion_destination') &&
      paidConversionEvidenceText(evidenceText, mechanism);
  }
  return false;
}

function affirmativePriorOutcome(value) {
  const outcome = asObject(value);
  const polarity = comparable(compactStrings([
    outcome.kind,
    outcome.label,
    outcome.status,
    outcome.summary
  ]).join(' '));
  if (!polarity ||
      /\b(?:cancelled|canceled|complaint|denied|failed|lost|no response|not now|rejected|refunded|skipped|spam|unpaid|unqualified)\b/.test(
        polarity
      )) {
    return false;
  }
  return /\b(?:accepted|booked|closed won|contract signed|converted|paid|payment received|qualified(?: reply| lead| inquiry)?|reimbursed|revenue received|sale completed|won)\b/.test(
    polarity
  );
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
    existing_customer: /\b(existing|current|former|past|returning) (?:customer|client|patient)\b/i,
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
  if (method === 'booking_record') {
    return /\b(?:booking|appointment|consultation)\b/i.test(text) &&
      /\b(?:record(?:s|ed|ing)?|field|source)\b/i.test(text);
  }
  const patterns = {
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

function providerAttestedReviewChannelAlias(value) {
  const candidate = comparable(value);
  if (!candidate) return false;
  return [...PROVIDER_ATTESTED_REVIEW_CHANNELS].some((reserved) => {
    const canonical = comparable(reserved);
    return candidate === canonical ||
      candidate.includes(canonical) ||
      canonical.includes(candidate);
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
  if (TYPED_REVENUE_PATH_CONTRACT_VERSIONS.has(firstText(
    asObject(tuple?.revenuePaths?.revenuePath).contractVersion
  ))) {
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
      // V2 already carries a typed family mode. Neutral wording is not a
      // conflict; an explicitly classified label that disagrees with that
      // mode still fails before revenue validation.
      const labelMismatch = labelModes.length > 1 ||
        (labelModes.length === 1 && labelModes[0] !== pathMode);
      return familyMismatch ||
        labelMismatch;
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
  // Approval/review is an execution-authorization state, not a commercial
  // acquisition family. Strip that wrapper before inferring channel semantics.
  const text = primaryActionSemanticText(value);
  if (!text) return [];
  const modes = [];
  if (/\binbound\b/.test(text)) modes.push('inbound');
  if (/\bwarm (?:referral|introduction)\b/.test(text)) {
    modes.push('warm_referral');
  }
  if (/\b(?:permissioned(?: [a-z0-9-]+){0,2} (?:outreach|introduction|request|contact|proposal|offer|application)|opt(?:ed)? in (?:audience|channel|contact|introduction|lead|list|outreach|request))\b/.test(
    text
  )) {
    modes.push('permissioned_outreach');
  }
  if (/\b(?:existing|current|former|past|returning) (?:customer|client|patient)\b/.test(
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
  if (TYPED_REVENUE_PATH_CONTRACT_VERSIONS.has(firstText(
    asObject(tuple?.revenuePaths?.revenuePath).contractVersion
  ))) {
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
  const evidenceByID = evidenceCatalogOrIndex instanceof Map
    ? evidenceCatalogOrIndex
    : evidenceIndex(asArray(evidenceCatalogOrIndex));
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
  const commercialRole = contractEnum(firstText(
    candidate.commercialRole
  ));
  if (candidate.providerAttestedCommercialDiscovery === true &&
      COMMERCIAL_DISCOVERY_CANDIDATE_ROLES.has(commercialRole)) {
    return commercialDiscoveryCandidateGroundsHypothesis(
      candidate,
      hypothesis,
      evidenceByID
    );
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

function commercialDiscoveryCandidateGroundsHypothesis(
  candidateValue,
  hypothesis,
  evidenceByID
) {
  const candidate = asObject(candidateValue);
  const commercialRole = contractEnum(firstText(
    candidate.commercialRole
  ));
  const tuple = asObject(hypothesis?._tuple);
  const revenuePathSeed = asObject(tuple.revenuePaths?.revenuePath);
  const grounding = asObject(revenuePathSeed._grounding);
  const revenuePath = asObject(hypothesis?.revenuePath);
  const candidateRefs = compactStrings(candidate.evidenceRefs)
    .filter((ref) =>
      verifiedCommercialDiscoveryEvidence(evidenceByID.get(ref))
    );
  if (candidateRefs.length === 0) return false;
  const candidateEvidence = candidateRefs.map((ref) =>
    asObject(evidenceByID.get(ref))
  );
  const candidateRoles = new Set(candidateEvidence.flatMap((item) =>
    compactStrings(item.commercialDiscoveryRoles).map(contractEnum)
  ));
  const intersects = (left, right) => stringsOverlap(
    compactStrings(left),
    compactStrings(right)
  );
  const buyerRefs = compactStrings(
    asObject(tuple.buyerSegments).evidenceRefs
  );
  const offerRefs = compactStrings(asObject(tuple.offers).evidenceRefs);
  const proofRefs = compactStrings(asObject(tuple.proofPoints).evidenceRefs);
  const channelRefs = compactStrings(asObject(tuple.channels).evidenceRefs);
  const revenueRefs = compactStrings(revenuePathSeed.evidenceRefs);
  const acquisitionRefs = compactStrings(
    grounding.acquisitionEvidenceRefs
  );
  const buyerGroundingRefs = compactStrings(grounding.buyerEvidenceRefs);
  const paidOfferGroundingRefs = compactStrings(
    grounding.paidOfferEvidenceRefs
  );
  const destinationGroundingRefs = compactStrings(
    grounding.conversionDestinationEvidenceRefs
  );
  const paidConversionGroundingRefs = compactStrings(
    grounding.paidConversionEvidenceRefs
  );

  if (commercialRole === 'referral_partner') {
    return firstText(revenuePath.acquisitionMode) === 'partner_channel' &&
      candidateRoles.has('acquisition') &&
      candidateRoles.has('channel_fit') &&
      candidateRoles.has('prospective_partner') &&
      intersects(candidateRefs, channelRefs) &&
      intersects(candidateRefs, acquisitionRefs) &&
      intersects(candidateRefs, revenueRefs);
  }

  const hypothesisDiscoveryEvidence = compactStrings([
    ...buyerRefs,
    ...offerRefs,
    ...proofRefs,
    ...channelRefs,
    ...revenueRefs
  ])
    .map((ref) => asObject(evidenceByID.get(ref)))
    .filter(verifiedCommercialDiscoveryEvidence);
  const paidDemandEvidence = hypothesisDiscoveryEvidence.filter((item) => {
    const roles = new Set(
      compactStrings(item.commercialDiscoveryRoles).map(contractEnum)
    );
    return roles.has('paid_offer') &&
      roles.has('demand_signal');
  });
  if (commercialRole === 'paid_demand') {
    return REVENUE_MECHANISMS.has(
      firstText(revenuePath.revenueMechanism)
    ) &&
      paidDemandEvidence.some((item) => candidateRefs.includes(item.id)) &&
      intersects(candidateRefs, buyerRefs) &&
      intersects(candidateRefs, buyerGroundingRefs) &&
      intersects(candidateRefs, [
        ...offerRefs,
        ...proofRefs,
        ...paidOfferGroundingRefs
      ]) &&
      intersects(candidateRefs, [
        ...destinationGroundingRefs,
        ...paidConversionGroundingRefs,
        ...revenueRefs
      ]);
  }
  if (commercialRole === 'hiring_manager') {
    const organization = firstText(candidate.organization);
    return firstText(revenuePath.revenueMechanism) ===
        'compensated_role' &&
      organization &&
      exactTextContains(asObject(tuple.buyerSegments).label, organization) &&
      paidDemandEvidence.some((item) =>
        evidenceSupportsExactText(item, organization)
      ) &&
      intersects(candidateRefs, buyerRefs) &&
      intersects(candidateRefs, buyerGroundingRefs);
  }
  const buyerSegmentLabel = asObject(tuple.buyerSegments).label;
  const buyerTargetNamed = exactTextContains(
    buyerSegmentLabel,
    firstText(candidate.organization)
  ) || exactTextContains(
    buyerSegmentLabel,
    firstText(candidate.displayLabel)
  );
  return commercialRole === 'buyer' &&
    firstText(revenuePath.acquisitionMode) === 'permissioned_outreach' &&
    candidateRoles.has('acquisition') &&
    candidateRoles.has('channel_fit') &&
    candidateRoles.has('defined_buyer') &&
    buyerTargetNamed &&
    intersects(candidateRefs, buyerRefs) &&
    intersects(candidateRefs, buyerGroundingRefs) &&
    intersects(candidateRefs, revenueRefs);
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
    const commercialRole = contractEnum(firstText(
      candidate.commercialRole
    ));
    const paidRoleCandidate =
      candidate.providerAttestedCommercialDiscovery === true &&
      ['paid_demand', 'hiring_manager'].includes(commercialRole) &&
      REVENUE_MECHANISMS.has(
        firstText(hypothesis?.revenuePath?.revenueMechanism)
      );
    return (
      ownedInboundAssetCandidate(candidate) || paidRoleCandidate
    ) && candidate.identityResolved === true;
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
  if (verifiedSystemAttributionCapabilityEvidence(value)) score += 4;
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
    prunedPrimaryActionVariantCount: 0,
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
  purpose,
  structuredOutputContract,
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
    purpose: firstText(purpose),
    structuredOutputContract: firstText(structuredOutputContract),
    generatorContract:
      firstText(structuredOutputContract) === TOURNAMENT_GENERATOR_CONTRACT
        ? TOURNAMENT_GENERATOR_CONTRACT
        : undefined,
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
  if (/^(source|observation|fact|profile|timeline|evidence|external_discovery):/i.test(value) ||
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
