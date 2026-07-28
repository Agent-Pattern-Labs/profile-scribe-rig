import { createHash } from 'crypto';
import { isIP } from 'net';

export const OPPORTUNITY_TOURNAMENT_ALGORITHM_VERSION = 'cheap_tournament_v2';

const MAX_HYPOTHESES = 10_000;
const MAX_FINALISTS = 20;
const MAX_EVIDENCE_ITEMS = 64;
const MAX_SEEDS_PER_DIMENSION = 8;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const MAX_TIMING_VERIFICATION_OBSERVATION_AGE_MS =
  45 * DAY_MILLISECONDS;
const MAX_TIMING_VERIFICATION_FUTURE_SKEW_MS = DAY_MILLISECONDS;
// OpenRouter prompt/completion ceilings are USD per million tokens. Request is
// the maximum total USD price for this single generation. Callers may tighten,
// but never loosen, these tournament-specific caps.
const MAX_PROVIDER_PRICE = {
  prompt: 2,
  completion: 8,
  request: 0.12
};
const RESEARCH_ONLY_CONSTRAINT =
  'Research and recommendation only; do not contact, message, publish, purchase ads, or submit forms.';
const RESEARCH_APPROVED_SOURCE_STATUSES = new Set([
  'approved',
  'connected',
  'monitoring'
]);

const DIMENSIONS = [
  ['offers', ['offers', 'offerSeeds']],
  ['buyerSegments', ['buyerSegments', 'audiences', 'buyers']],
  ['channels', ['channels']],
  ['actions', ['actions']],
  ['timingTriggers', ['timingTriggers', 'triggers']],
  ['proofPoints', ['proofPoints', 'proofAngles']],
  ['followUps', ['followUps', 'followUpPaths']]
];

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

const COHERENCE_GATE_VERSION = 'strategy_family_motion_v2';
const SEED_CONTRACT_VERSION = 'family_bundle_v2';

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
 *   ({ model, system, user, maxTokens, provider }) =>
 *     { data, usage, generationId? }
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
  const evidenceCatalog = buildEvidenceCatalog(payload, context);
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
      gate: researchOnlyGate(
        'block',
        'No approved professional evidence was available; generating a recommendation would be ungrounded.'
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

  const prompt = seedAndJudgePrompt({
    objective,
    constraints,
    evidenceCatalog,
    priorOutcomes: normalizePriorOutcomes(payload.priorOutcomes),
    maxSeedsPerDimension: Math.min(4, MAX_SEEDS_PER_DIMENSION)
  });
  const promptHash = stableHash({ system: prompt.system, user: prompt.user });

  let completion;
  try {
    completion = await completeJSON({
      model,
      system: prompt.system,
      user: prompt.user,
      maxTokens: budget.maxOutputTokens,
      responseFormat: {
        type: 'json_object'
      },
      provider: {
        max_price: budget.providerMaxPrice
      }
    });
  } catch (error) {
    const providerMetadata = openRouterMetadata({
      model,
      status: 'failed',
      usage: error?.openRouterUsage,
      promptHash,
      error: openRouterFailureCode(error)
    });
    return {
      status: 'skipped',
      summary: 'The strategy generator did not return a usable tournament seed set.',
      ...base,
      llm: { strategyGeneratorJudge: providerMetadata },
      usage: aggregateUsage([providerMetadata], budget),
      gate: researchOnlyGate(
        'block',
        'The bounded strategy-generation call failed; no deterministic recommendation was substituted.'
      )
    };
  }

  const providerMetadata = openRouterMetadata({
    model,
    status: 'completed',
    usage: completion?.usage,
    generationId: completion?.generationId,
    promptHash
  });
  const usage = aggregateUsage([providerMetadata], budget);
  if (budget.hardStop && usage.reportedCostMicros > budget.maxLLMSpendMicros) {
    return {
      status: 'skipped',
      summary: 'The strategy-generation call exceeded the tournament LLM budget; no recommendation was selected.',
      ...base,
      llm: { strategyGeneratorJudge: providerMetadata },
      usage,
      gate: researchOnlyGate(
        'block',
        'Reported LLM cost exceeded the hard tournament LLM budget.'
      )
    };
  }

  const seedSet = normalizeSeedSet(
    completion?.data,
    evidenceCatalog,
    timestamp
  );
  const missingDimension = DIMENSIONS.find(([name]) => seedSet[name].length === 0)?.[0];
  if (missingDimension) {
    const unsupportedTiming = missingDimension === 'timingTriggers' &&
      seedSet.unsupportedTimingSeedCount > 0;
    return {
      status: 'skipped',
      summary: unsupportedTiming
        ? 'The strategy generator returned no source-backed timing trigger; urgency was not inferred.'
        : `The strategy generator returned no grounded ${missingDimension} seeds.`,
      ...base,
      llm: { strategyGeneratorJudge: providerMetadata },
      usage,
      searchSpace: {
        ...base.searchSpace,
        dimensionCounts: dimensionCounts(seedSet),
        seedContract: seedSet.seedContract,
        declaredStrategyFamilyCount: seedSet.declaredStrategyFamilyCount,
        strategyFamilyCount: seedSet.strategyFamilies.length,
        completeStrategyFamilyCount: seedSet.completeStrategyFamilyCount,
        incompleteStrategyFamilyCount: seedSet.incompleteStrategyFamilyCount,
        strategyFamilyAnchorCoverage: seedSet.strategyFamilyAnchorCoverage,
        strategyFamilyCollisionCount: seedSet.strategyFamilyCollisionCount,
        familyEvidenceMismatchSeedCount: seedSet.familyEvidenceMismatchSeedCount,
        invalidFamilySeedCount: seedSet.invalidFamilySeedCount,
        unsupportedTimingSeedCount: seedSet.unsupportedTimingSeedCount,
        timingVerificationRepairCount: seedSet.timingVerificationRepairCount,
        coherenceGate: COHERENCE_GATE_VERSION
      },
      gate: researchOnlyGate(
        'block',
        unsupportedTiming
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
      llm: { strategyGeneratorJudge: providerMetadata },
      usage,
      searchSpace: {
        ...base.searchSpace,
        dimensionCounts: dimensionCounts(seedSet),
        seedContract: seedSet.seedContract,
        declaredStrategyFamilyCount: seedSet.declaredStrategyFamilyCount,
        strategyFamilyCount: seedSet.strategyFamilies.length,
        completeStrategyFamilyCount: seedSet.completeStrategyFamilyCount,
        incompleteStrategyFamilyCount: seedSet.incompleteStrategyFamilyCount,
        strategyFamilyAnchorCoverage: seedSet.strategyFamilyAnchorCoverage,
        strategyFamilyCollisionCount: seedSet.strategyFamilyCollisionCount,
        familyEvidenceMismatchSeedCount: seedSet.familyEvidenceMismatchSeedCount,
        invalidFamilySeedCount: seedSet.invalidFamilySeedCount,
        unsupportedTimingSeedCount: seedSet.unsupportedTimingSeedCount,
        timingVerificationRepairCount: seedSet.timingVerificationRepairCount,
        coherenceGate: COHERENCE_GATE_VERSION
      },
      gate: researchOnlyGate(
        'needs_more_approved_evidence',
        'A completed tournament requires two complete strategy families where every dimension cites specific family evidence and each family uses at least one approved observation.'
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
    theoreticalCount: expanded.theoreticalCount,
    expandedCount: expanded.expandedCount,
    eligibleCount: expanded.eligibleCount,
    filteredCount: expanded.filteredCount,
    incompatibleCount: expanded.incompatibleCount,
    motionConflictCount: expanded.motionConflictCount,
    motionConflictDimensions: expanded.motionConflictDimensions,
    retainedCount: retainedHypotheses.length,
    dimensionCounts: dimensionCounts(seedSet),
    seedContract: seedSet.seedContract,
    declaredStrategyFamilyCount: seedSet.declaredStrategyFamilyCount,
    strategyFamilyCount: seedSet.strategyFamilies.length,
    completeStrategyFamilyCount: seedSet.completeStrategyFamilyCount,
    incompleteStrategyFamilyCount: seedSet.incompleteStrategyFamilyCount,
    strategyFamilyAnchorCoverage: seedSet.strategyFamilyAnchorCoverage,
    strategyFamilyCollisionCount: seedSet.strategyFamilyCollisionCount,
    familyEvidenceMismatchSeedCount: seedSet.familyEvidenceMismatchSeedCount,
    invalidFamilySeedCount: seedSet.invalidFamilySeedCount,
    unsupportedTimingSeedCount: seedSet.unsupportedTimingSeedCount,
    timingVerificationRepairCount: seedSet.timingVerificationRepairCount,
    coherenceGate: COHERENCE_GATE_VERSION,
    deterministic: true,
    modelCalls: 1,
    judgeWeights: expanded.weights
  });
  if (initialHypotheses.length < 2) {
    return {
      status: 'skipped',
      summary: 'The tournament retained fewer than two grounded strategies.',
      ...base,
      hypotheses: initialHypotheses.map(publicHypothesis),
      searchSpace: searchSpaceFor(initialHypotheses),
      llm: { strategyGeneratorJudge: providerMetadata },
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
  const primaryCandidateValues = [
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
  const ownerIdentity = ownerCandidateIdentity(
    job,
    payload,
    context,
    profileScribePublicBaseURL
  );
  const primaryCandidates = normalizeCandidates(
    primaryCandidateValues,
    initialHypotheses,
    evidenceCatalog,
    timestamp,
    profileScribePublicBaseURL,
    ownerIdentity
  );
  const hasActionablePrimaryCandidate = primaryCandidates.some(
    (candidate) => candidate.identityResolved === true
  );
  const candidateValues = hasActionablePrimaryCandidate
    ? primaryCandidateValues
    : [
        ...primaryCandidateValues,
        ...normalizeSeedMentionedOrganizationCandidates(
          seedSet,
          evidenceCatalog
        )
      ];
  const provisionalCandidates = hasActionablePrimaryCandidate
    ? primaryCandidates
    : normalizeCandidates(
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
        candidate.identityResolved === true &&
        candidateEvidenceGroundsHypothesis(candidate, hypothesis)
      )
    )
    .sort(compareHypotheses);
  const winningHypothesis = actionableHypotheses[0];
  if (!winningHypothesis) {
    return {
      status: 'skipped',
      summary: 'No named, source-backed candidate grounded a retained strategy.',
      ...base,
      hypotheses: initialHypotheses.map(publicHypothesis),
      candidates: provisionalCandidates,
      searchSpace: searchSpaceFor(initialHypotheses),
      llm: { strategyGeneratorJudge: providerMetadata },
      usage,
      gate: researchOnlyGate(
        'needs_more_approved_evidence',
        'The strategy field was explored, but completing the result requires a named person, organization, or internal profile whose approved evidence grounds the buyer segment and offer or proof.',
        {
          question: 'Which approved source can ground a specific person, organization, or internal ProfileScribe profile for this opportunity?'
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
      searchSpace: searchSpaceFor(initialHypotheses),
      llm: { strategyGeneratorJudge: providerMetadata },
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
      searchSpace,
      llm: { strategyGeneratorJudge: providerMetadata },
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
      summary: 'No named, source-backed candidate grounded the best actionable strategy.',
      ...base,
      hypotheses: publicHypotheses,
      candidates: selected.candidates,
      searchSpace,
      llm: { strategyGeneratorJudge: providerMetadata },
      usage,
      gate: researchOnlyGate(
        'needs_more_approved_evidence',
        'The strategy field was explored, but completing the result requires a named person, organization, or internal profile whose approved evidence grounds the rank-one buyer segment and offer or proof.',
        {
          question: 'Which approved source can ground a specific person, organization, or internal ProfileScribe profile for this opportunity?'
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
    llm: { strategyGeneratorJudge: providerMetadata },
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

function publicHypothesis(hypothesis) {
  const {
    _tuple,
    _strategyFamily,
    ...value
  } = asObject(hypothesis);
  return value;
}

export function buildEvidenceCatalog(payload, context = {}) {
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
  const approvedSourceIDs = new Set(
    sources
      .map(asObject)
      .filter(sourceIsResearchApproved)
      .map((source) => firstText(source.id, source.sourceId))
      .filter(Boolean)
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
      startDate: firstText(raw.startDate),
      endDate: firstText(raw.endDate),
      current: typeof raw.current === 'boolean' ? raw.current : undefined,
      status: firstText(raw.status),
      priority: firstText(raw.priority),
      confidence: normalizeConfidence(raw.confidence, raw.trustLevel),
      approvedSourceObservation:
        asObject(origin).approvedSourceObservation === true ? true : undefined,
      aliases: compactStrings([
        sourceID ? `source:${sourceID}` : '',
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
  for (const evidence of sourceEvidence.slice(0, 64)) {
    const value = asObject(evidence);
    const sourceID = firstText(value.sourceId, value.sourceID);
    if (!sourceID || !approvedSourceIDs.has(sourceID)) continue;
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
      approvedSourceObservation: true
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
  return catalog
    .sort((left, right) => {
      const leftPriority = candidateEvidencePriority.get(left.id);
      const rightPriority = candidateEvidencePriority.get(right.id);
      if (leftPriority !== undefined || rightPriority !== undefined) {
        if (leftPriority === undefined) return 1;
        if (rightPriority === undefined) return -1;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      }
      return evidenceQuality(right) - evidenceQuality(left) || left.id.localeCompare(right.id);
    })
    .slice(0, MAX_EVIDENCE_ITEMS);
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
    const expectedValueMicros = maxFinite(
      selected.map((item) => item.expectedValueMicros)
    );
    eligible.push(compact({
      id,
      offer: tuple.offers.label,
      buyerSegment: tuple.buyerSegments.label,
      channel: tuple.channels.label,
      action: tuple.actions.label,
      timingTrigger: tuple.timingTriggers.label,
      proofPoint: tuple.proofPoints.label,
      followUp: tuple.followUps.label,
      evidenceRefs,
      score,
      status: 'eligible',
      judgeReason: hypothesisJudgeReason(tuple, score),
      estimatedSpendMicros: estimatedSpendMicros > 0 ? Math.round(estimatedSpendMicros) : undefined,
      expectedValueMicros: expectedValueMicros > 0 ? Math.round(expectedValueMicros) : undefined,
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
    configuredLLMMicros || Math.min(maxSpendMicros, 300_000)
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
    maxLLMCalls: clampInteger(raw.maxLLMCalls, 0, 1, 1),
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

function seedAndJudgePrompt({
  objective,
  constraints,
  evidenceCatalog,
  priorOutcomes,
  maxSeedsPerDimension
}) {
  const system = `You are ProfileScribe's research-only opportunity strategist and semantic judge.
Generate compact strategy dimensions grounded only in the supplied professional evidence.
This is internal hypothesis exploration, not outreach, publishable copy, or permission to act.
Never invent accomplishments, customers, affiliations, contact details, market demand, intent, urgency, or relationships.
Treat experience with a past endDate as historical proof, never as a current role or affiliation.
Do not recommend applying for, enrolling in, or creating a capability when the evidence says that capability already exists; recommend a bounded way to verify or use it instead.
Use only exact evidence IDs from evidenceCatalog. Unknown evidence IDs will be discarded.
You may optionally extract a compact named person or organization candidate only when its exact name appears verbatim in the cited evidence. Do not return contact details or URLs; return no candidate rather than infer or complete an identity.
When an exact named organization is the intended target buyer, begin that buyerSegments label with the exact organization name and return the same organization in candidates.
Keep every strategy family coherent end to end. Never mix a buyer, offer, channel, action, timing trigger, proof point, or follow-up from different business motions.
Return exactly two complete top-level family bundles named familyA and familyB. Family A is the strongest grounded path; family B is the strongest coherent alternative. They may use distinct tactics within the same business motion when the evidence does not support two different motions.
Within each family bundle, return exactly two family-specific offers, buyer segments, channels, actions, and follow-ups, plus exactly one timing trigger and one proof point. Never return global dimension arrays or cross-family compatibility tags.
Return no email, direct message, post, pitch, sales script, or other outreach copy.
Reject spray-and-pray, bulk outreach, scraping, automated form submission, or high-volume behavior.
Each seed should be a short structured concept. Each reason must explain a grounded inference, not assert an unobserved fact.
Score values are semantic judgments from 0 to 1. Positive scores are better; effort, cost, risk, and uncertainty are burdens.
Return only JSON.`;
  const user = JSON.stringify({
    task: 'Generate and semantically judge the seed dimensions for one bounded opportunity tournament.',
    objective,
    constraints,
    evidenceCatalog,
    priorOutcomes,
    outputRules: {
      seedCount: `Across familyA and familyB this yields at most ${maxSeedsPerDimension} items per multi-variant dimension, two timing triggers, and two proof points.`,
      familyBundleSchema: {
        id: 'family-a for familyA or family-b for familyB',
        l: 'short internal label for one coherent end-to-end business motion',
        m: 'one semantic motion: payer_network, patient_inbound, clinical_referral, hospital_program, employer_workplace, or organization_partnership',
        e: ['one or more exact evidenceCatalog.id values grounding this family, including at least one observation:* anchor'],
        d: {
          offers: ['exactly two itemSchema objects'],
          buyerSegments: ['exactly two itemSchema objects'],
          channels: ['exactly two itemSchema objects'],
          actions: ['exactly two itemSchema objects'],
          timingTriggers: ['exactly one itemSchema object with q'],
          proofPoints: ['exactly one itemSchema object'],
          followUps: ['exactly two itemSchema objects']
        }
      },
      requiredDimensions: DIMENSIONS.map(([name]) => name),
      itemSchema: {
        id: 'short stable local label',
        l: 'concise internal strategy component; never outreach copy',
        e: ['one or more exact evidenceCatalog.id values'],
        q: 'timingTriggers only: a short exact phrase copied from cited evidence that directly proves the trigger; omit q on all other dimensions',
        s: {
          of: 'objectiveFit 0..1 when relevant',
          es: 'evidenceStrength 0..1 when relevant',
          ba: 'buyerAuthority 0..1 when relevant',
          ti: 'timing 0..1 when relevant',
          wp: 'warmPath 0..1 when relevant',
          re: 'reachability 0..1 when relevant; contact availability alone is not strategic fit',
          ev: 'expectedValue 0..1 when relevant',
          ef: 'effort 0..1 burden',
          co: 'cost 0..1 burden',
          ri: 'risk 0..1 burden',
          un: 'uncertainty 0..1 burden'
        },
        r: 'optional short grounded reason; omit when the label and scores suffice',
        u: 'optional short material unknown',
        sp: 'optional estimatedSpendMicros integer; omit rather than guess',
        vm: 'optional expectedValueMicros integer; omit rather than guess'
      },
      candidateSchema: {
        k: 'person or organization only',
        l: 'exact named person or organization copied from cited evidence',
        o: 'optional exact organization copied from cited evidence',
        r: 'optional exact role copied from cited evidence',
        m: 'optional exact market/location copied from cited evidence',
        e: ['one or more exact evidenceCatalog.id values that contain the candidate name']
      },
      w: 'Optional judge-weight object using the short score keys. Keep evidence and objective fit dominant.',
      compactness: 'Use only the compact item keys above. Do not restate the evidence or schema and do not add prose outside JSON.',
      hardRules: [
        'Offers and proofPoints must cite direct evidence.',
        'Buyer segments may be plausible inferences but must cite evidence supporting the fit.',
        'Return both familyA and familyB. Do not omit either complete bundle.',
        'Use id family-a inside familyA and family-b inside familyB.',
        'For each family, include at least one observation:* evidence anchor in family e.',
        'Every item must cite at least one exact evidence ID that also appears in its containing family e. Different dimensions may use different family evidence IDs when that is the truthful provenance.',
        'Every item belongs only to its containing family bundle. Do not add f, familyIds, wildcards, or cross-family reuse.',
        'A retained family must describe one coherent motion. Do not combine insurance-network, hospital-program, employer, clinical-referral, content-conversion, or other distinct motions in one family.',
        'Make each buyerSegments label explicitly name exactly one motion. For patient inbound use prospective or eligible patients, parents, mothers, families, caregivers, or members; do not describe the payer as the buyer.',
        'Every other item in a family must either use that same motion vocabulary or remain motion-neutral. Never mention a second motion merely as an example.',
        'Channels and actions must remain singular, bounded, and review-first.',
        'Every timing trigger must include q copied exactly from its cited evidence and q must directly support the claimed timing. A crawl timestamp alone is not a business trigger.',
        'The evidence id that contains q must be an observation:* source-evidence record so the control plane can verify the phrase against the approved stored observation.',
        'If timing is not directly observed, phrase the timing trigger as a review-first verification step beginning with Verify, Confirm, Check, Research, or Determine, and cite the exact evidence phrase that makes that verification relevant.',
        'Do not name an enrollment window, recertification period, planning cycle, deadline, quarter, month, or year unless that exact timing appears in q.',
        'Follow-ups must remain low-volume and permissioned.',
        'Return at most 8 candidates. A candidate must be a named person or organization copied exactly from approved evidence, never a generic buyer segment.',
        'Candidate names and optional details must be exact evidence text. Do not return candidate URLs or contact details. Return candidates: [] when no exact named candidate exists.',
        'A candidate evidence ID must also ground a buyerSegments seed and at least one relevant offers or proofPoints seed; do not attach a candidate using an unrelated citation.',
        'If a named organization is the intended target buyer, start the buyerSegments label with that exact organization name and include the same organization in candidates.',
        'If evidence says a provider, credential, connection, or service is already accepted, active, or available, do not recommend applying for it as though it were missing.'
      ]
    },
    responseSchema: {
      seedContract: 'family_bundle_v2',
      familyA: {
        id: 'family-a',
        l: '',
        m: '',
        e: [],
        d: {
          offers: [],
          buyerSegments: [],
          channels: [],
          actions: [],
          timingTriggers: [],
          proofPoints: [],
          followUps: []
        }
      },
      familyB: {
        id: 'family-b',
        l: '',
        m: '',
        e: [],
        d: {
          offers: [],
          buyerSegments: [],
          channels: [],
          actions: [],
          timingTriggers: [],
          proofPoints: [],
          followUps: []
        }
      },
      candidates: [],
      w: {}
    }
  });
  return { system, user };
}

function normalizeSeedSet(value, evidenceCatalog, referenceTime) {
  const raw = asObject(value);
  const evidenceByID = evidenceIndex(evidenceCatalog);
  const familyInputs = strategyFamilyInputs(raw);
  const hasFamilyBundleContract =
    Object.keys(asObject(raw.familyA)).length > 0 &&
    Object.keys(asObject(raw.familyB)).length > 0;
  const normalizedFamilies = normalizeStrategyFamilies(
    familyInputs,
    evidenceByID
  );
  const strategyFamilies = normalizedFamilies.families;
  const out = {
    seedContract: hasFamilyBundleContract
      ? SEED_CONTRACT_VERSION
      : 'legacy_flat',
    declaredStrategyFamilyCount: familyInputs.length,
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
    // The fixed family wrappers are the v2 trust boundary. Once present,
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
          const alreadyGroundedFamilyObservations =
            normalizedFamilyObservationEvidenceRefs(out, familyID)
              .filter((ref) => familyEvidence.has(ref));
          familyLocalTimingRepair = repairTimingAsVerification(
            alreadyGroundedFamilyObservations,
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
      out[name].push({
        id: normalizeSeedID(firstText(seed.id, `${name}-${index + 1}`), name, label),
        label,
        familyIds,
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
        expectedValueMicros: nonNegativeInteger(seed.vm ?? seed.expectedValueMicros)
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

function normalizedFamilyObservationEvidenceRefs(seedSet, familyID) {
  const refs = [];
  for (const [dimension] of DIMENSIONS) {
    for (const seedValue of asArray(asObject(seedSet)[dimension])) {
      const seed = asObject(seedValue);
      if (!asArray(seed.familyIds).includes(familyID)) continue;
      refs.push(...strategyObservationEvidenceRefs(seed.evidenceRefs));
    }
  }
  return compactStrings(refs)
    .filter((ref, index, values) => values.indexOf(ref) === index);
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
      ...asArray(raw.evidenceIds)
    ])
      .map((ref) => evidenceByID.get(ref)?.id)
      .filter(Boolean)
      .filter((ref, index, refs) => refs.indexOf(ref) === index)
      .slice(0, 12);
    if (evidenceRefs.length === 0 ||
        strategyObservationEvidenceRefs(evidenceRefs).length === 0) {
      continue;
    }
    const family = {
      id,
      label: truncate(firstText(raw.l, raw.label, raw.name, id), 120),
      evidenceRefs
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
  const total = clamp01(positiveNormalized * 0.82 + (1 - burdenNormalized) * 0.18);
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
      candidate.identityResolved === true &&
      candidateEvidenceGroundsHypothesis(
        candidate,
        winnerHypothesis
      )
    )
    .sort((left, right) => right.score.total - left.score.total || left.id.localeCompare(right.id))[0];
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
  const buyerMotions = strategyMotions(
    hypothesis.buyerSegment,
    'buyerSegment'
  );
  const candidateIsContextAnchor =
    organizationCandidateRequiresBuyerMatch(candidate) &&
    buyerMotions.includes('patient_inbound') &&
    !buyerMotions.includes('payer_network');
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
  const why = candidateLabel
    ? `${candidateLabel} is the exact named ${candidateIsContextAnchor ? 'evidence anchor' : 'candidate'} attached to this strategy. ${grounding} It led ${eligibleCount.toLocaleString('en-US')} coherent, evidence-grounded strategies retained from ${exploredCount.toLocaleString('en-US')} evaluated combinations on objective fit, evidence strength, buyer authority, timing, expected value, effort, cost, risk, and uncertainty.`
    : `${grounding} This was one of ${eligibleCount.toLocaleString('en-US')} coherent, evidence-grounded strategies retained from ${exploredCount.toLocaleString('en-US')} evaluated combinations.`;
  const whyOverRunnerUp = runnerUp
    ? comparisonReason(hypothesis, runnerUp)
    : '';
  const recommendationMotionSignatures = compactStrings([
    title,
    action,
    why,
    whyNow,
    whyOverRunnerUp,
    uncertainty
  ].flatMap((value) => strategyMotions(value))).sort();
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
      /\b(?:archived|cancelled|canceled|closed|discontinued|expired|historical|inactive|superseded|withdrawn)\b/i.test(
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

function sourceIsResearchApproved(source) {
  return RESEARCH_APPROVED_SOURCE_STATUSES.has(
    comparable(asObject(source).status)
  );
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
      candidateEvidenceGroundsHypothesis(groundingCandidate, hypothesis)
    );
    if (overlappingHypotheses.length === 0) continue;
    let hypothesis = hypothesisByID.get(firstText(raw.hypothesisId));
    if (!hypothesis ||
        !candidateEvidenceGroundsHypothesis(groundingCandidate, hypothesis)) {
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
    const candidateDisplayLabel = concreteCandidateLabel(displayLabel)
      ? displayLabel
      : organization;
    // Candidate kinds supplied by callers and approved-source extraction are
    // still untrusted classification hints. Normalize obvious organizations
    // here as the common output boundary so a payer brand cannot retain a
    // person-like kind and become eligible for downstream person enrichment.
    const declaredKind = firstText(raw.kind, 'public_professional');
    const candidateKind = organizationLikeCandidateLabel(candidateDisplayLabel)
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
  return `Grounded by ${tuple.proofPoints.label}; strongest dimension was ${strongest[1]} (${score[strongest[0]].toFixed(3)}).`;
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
    followUp: 'followUps'
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
      timingSeed.timingVerificationRepaired === true
  };
}

function strategyMotionSignature(tuple) {
  const dimensionNames = {
    offer: 'offers',
    buyerSegment: 'buyerSegments',
    channel: 'channels',
    action: 'actions',
    timingTrigger: 'timingTriggers',
    proofPoint: 'proofPoints',
    followUp: 'followUps'
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

function emptyMotionConflictDimensions() {
  return {
    offer: 0,
    buyerSegment: 0,
    channel: 0,
    action: 0,
    timingTrigger: 0,
    proofPoint: 0,
    followUp: 0
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

function candidateEvidenceGroundsHypothesis(candidateValue, hypothesis) {
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

function organizationCandidateRequiresBuyerMatch(candidateValue) {
  const candidate = asObject(candidateValue);
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
    retainedCount: 0,
    dimensionCounts: {},
    seedContract: '',
    declaredStrategyFamilyCount: 0,
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
  promptHash,
  error
}) {
  return compact({
    provider: 'openrouter',
    model: firstText(model),
    purpose: 'rig_opportunity_tournament',
    status,
    generationId: firstText(generationId),
    promptHash,
    error,
    openRouterUsage: normalizeUsage(usage)
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
    .map((usage) => finite(usage.cost))
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
    costReporting: 'unavailable',
    maxLLMSpendMicros: budget.maxLLMSpendMicros,
    providerMaxPrice: { ...budget.providerMaxPrice },
    withinBudget: true,
    maxOutputTokens: budget.maxOutputTokens
  };
}

function normalizeUsage(value) {
  const raw = asObject(value);
  const nested = asObject(raw.raw);
  return compact({
    prompt_tokens: positiveInteger(raw.prompt_tokens ?? nested.prompt_tokens),
    completion_tokens: positiveInteger(raw.completion_tokens ?? nested.completion_tokens),
    total_tokens: positiveInteger(raw.total_tokens ?? nested.total_tokens),
    promptTokens: positiveInteger(raw.promptTokens ?? nested.promptTokens),
    completionTokens: positiveInteger(raw.completionTokens ?? nested.completionTokens),
    totalTokens: positiveInteger(raw.totalTokens ?? nested.totalTokens),
    cost: finite(raw.cost ?? nested.cost)
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
  const message = String(error?.message || error || '').toLowerCase();
  const status = message.match(/\bhttp\s+(\d{3})\b/)?.[1];
  if (status) return `openrouter_http_${status}`;
  if (message.includes('abort') || message.includes('timeout')) return 'openrouter_transport_error';
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

function positiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : undefined;
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

function maxFinite(values) {
  return values.reduce((max, value) => {
    const number = finite(value);
    return number === null ? max : Math.max(max, number);
  }, 0);
}

function round(value) {
  return Math.round(Number(value || 0) * 1_000) / 1_000;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
}
