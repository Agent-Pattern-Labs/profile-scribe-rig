#!/usr/bin/env node

import {
  buildEvidenceCatalog,
  normalizeCommercialDiscoveryEvidence,
  providerCallSpendCeilingMicros,
  runOpportunityTournament,
  serializeOpenRouterJSONRequestBody
} from '../bin/opportunity-tournament.mjs';

const now = new Date('2026-07-30T12:00:00Z');
const usage = {
  prompt_tokens: 1200,
  completion_tokens: 900,
  total_tokens: 2100,
  cost: 0.0042
};
const businessExperimentFieldNames = [
  'knownFact',
  'buyer',
  'paidOffer',
  'acquisitionMechanism',
  'conversionDestination',
  'paidConversion',
  'attributionSignal'
];

function completeBusinessExperimentFields(experimentValue) {
  const experiment = experimentValue || {};
  return businessExperimentFieldNames.every((field) =>
    typeof experiment[field] === 'string' &&
    experiment[field].trim().length > 0
  );
}

function hasBusinessExperimentField(experimentValue) {
  const experiment = experimentValue || {};
  return businessExperimentFieldNames.some((field) =>
    Object.prototype.hasOwnProperty.call(experiment, field)
  );
}

const domains = [
  {
    name: 'healthcare',
    buyer: 'New parents seeking lactation support',
    offer: 'A reimbursable same-day home visit',
    destination: 'Same-day home-visit booking page',
    mechanism: 'insurance_reimbursement',
    outcome: 'One paid claim recorded',
    attributionMethod: 'claim_record',
    attribution:
      'Claim record source field stores the organic-search campaign',
    sourceSummary:
      'New parents can book a same-day home visit on the booking page. United Healthcare is accepted for the home visit.',
    fullyGrounded: false
  },
  {
    name: 'healthcare-patient',
    buyer: 'Patients seeking reimbursable lactation care',
    offer: 'A reimbursable paid lactation consultation',
    destination: 'Patient booking page',
    mechanism: 'insurance_reimbursement',
    outcome: 'One paid claim recorded',
    attributionMethod: 'claim_record',
    attribution:
      'Claim record source field stores the organic-search campaign',
    sourceSummary:
      'Patients seeking reimbursable lactation care arrive through organic search at the Patient booking page. Insurance is accepted for the reimbursable paid lactation consultation, and the claim record source field stores the organic-search campaign.'
  },
  {
    name: 'saas',
    buyer: 'Operations teams buying workflow software',
    offer: 'A paid workflow-software subscription',
    destination: 'Workflow software pricing and signup page',
    mechanism: 'subscription_or_retainer',
    outcome: 'One subscription payment receipt',
    attributionMethod: 'payment_receipt',
    attribution:
      'Payment receipt source field stores the organic-search UTM campaign',
    sourceSummary:
      'Operations teams buying workflow software arrive through organic search at the workflow software pricing and signup page. A free trial leads to a paid subscription plan, and the payment receipt source field stores the organic-search UTM campaign.'
  },
  {
    name: 'consulting',
    buyer: 'Service-business clients buying delivery consulting',
    offer: 'A paid delivery-consulting contract',
    destination: 'Delivery consulting proposal and contract page',
    mechanism: 'signed_contract',
    outcome: 'One signed contract recorded',
    attributionMethod: 'invoice_or_contract',
    attribution:
      'Contract source field stores the organic-search UTM campaign',
    sourceSummary:
      'Service-business clients buying delivery consulting arrive through organic search at the delivery consulting proposal and contract page, where they can sign a paid contract. The contract source field stores the organic-search UTM campaign.'
  },
  {
    name: 'creator-license',
    buyer: 'Media buyers licensing original illustrations',
    offer: 'A priced $250 royalty-free illustration license',
    destination: 'Illustration licensing request page',
    mechanism: 'license_or_royalty',
    outcome: 'One license payment received',
    attributionMethod: 'license_or_royalty_record',
    attribution:
      'License contract source field stores the organic-search UTM campaign',
    sourceSummary:
      'Media buyers licensing original illustrations arrive through organic search at the illustration licensing request page, where they can purchase a priced $250 royalty-free illustration license. The license contract source field stores the organic-search UTM campaign.'
  },
  {
    name: 'commerce',
    buyer: 'Home-office shoppers buying desk organizers',
    offer: 'A paid desk-organizer product sale',
    destination: 'Desk-organizer product page and checkout',
    mechanism: 'direct_sale',
    outcome: 'One paid order recorded',
    attributionMethod: 'checkout_or_order',
    attribution:
      'Checkout order source field stores the organic-search UTM campaign',
    sourceSummary:
      'Home-office shoppers buying desk organizers arrive through organic search at the desk-organizer product page and checkout, where they can purchase the paid product. The checkout order source field stores the organic-search UTM campaign.'
  }
];

for (const domain of domains) {
  const result = await runDomain(domain);
  const sideEffects = result.gate?.sideEffects || {};
  if (domain.fullyGrounded === false) {
    const experiment = result.nextExperiment || {};
    if (result.status !== 'skipped' ||
        result.result?.resultType !== 'revenue_evidence_gap' ||
        result.result?.allowedChannel !== 'organic search' ||
        result.result?.sideEffectsPerformed !== 0 ||
        result.searchSpace?.eligibleCount !== 0 ||
        experiment.contractVersion !==
          'revenue_evidence_experiment_v1' ||
        experiment.noGroundedPath === true ||
        !/Ground one buyer-to-channel acquisition path/i.test(
          experiment.title || ''
        ) ||
        experiment.asset?.publicUrl !==
          'https://healthcare.example/offer' ||
        !completeBusinessExperimentFields(experiment) ||
        experiment.knownFact !== domain.sourceSummary ||
        !/not yet grounded/i.test(experiment.buyer || '') ||
        !experiment.paidOffer?.includes(domain.destination) ||
        !/organic search.*fit unverified/i.test(
          experiment.acquisitionMechanism || ''
        ) ||
        !experiment.action?.includes(
          'No immediate acquisition channel is grounded'
        ) ||
        !experiment.action?.includes('organic search') ||
        !experiment.action?.includes('exactly 1') ||
        !experiment.action?.includes('14') ||
        /measure (?:traffic|visits)|organic_search/i.test(
          `${experiment.title} ${experiment.action} ${experiment.attributionSignal}`
        ) ||
        !experiment.stopCondition?.includes('1 qualifying') ||
        /\b(?:approve source|approve observation|evidence id|crawl|missing_|invalid_)\b/i.test(
          `${experiment.title} ${experiment.action} ${experiment.successSignal} ${(experiment.missingEvidence || []).join(' ')}`
        ) ||
        experiment.rerunPolicy?.maxReruns !== 1) {
      throw new Error(
        `healthcare no-winner fallback was not evidence-specific: ${JSON.stringify(result)}`
      );
    }
  } else {
    const commercialCritic = result.searchSpace?.commercialCritic || {};
    const resultGate = result.result?.incrementalRevenueGate || {};
    const winnerID = result.winner?.hypothesisId;
    const winnerFamilyID = result.hypotheses?.find(
      (hypothesis) => hypothesis.id === winnerID
    )?.provenance?.strategyFamilyId;
    const positiveGateFields = [
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
      'commercialConstraintsSatisfied',
      'passed'
    ];
    if (result.status !== 'completed' ||
        result.nextExperiment !== null ||
        result.algorithmVersion !== 'cheap_tournament_v5' ||
        result.result?.resultContract !==
          'opportunity_tournament_result_v2' ||
        result.result?.resultType !== 'immediate_revenue_action' ||
        result.result?.recommendedAction !== result.winner?.action ||
        result.result?.executionAuthorization !== 'none' ||
        result.result?.requiresReview !== true ||
        result.result?.sideEffectsPerformed !== 0 ||
        !/^[a-f0-9]{64}$/.test(
          result.commercialEvidenceGraphHash || ''
        ) ||
        result.result?.allowedChannel !== 'organic search' ||
        result.result?.permissionRequired !==
          'explicit_user_approval' ||
        !/^After explicit approval,/i.test(
          result.winner?.action || ''
        ) ||
        !/independent commercial critic/i.test(
          result.winner?.whyOverRunnerUp || ''
        ) ||
        positiveGateFields.some((field) => resultGate[field] !== true) ||
        resultGate.primarilyOperationalOrObservational !== false ||
        result.searchSpace?.seedContract !==
          'revenue_family_bundle_v2' ||
        result.searchSpace?.coherenceGate !==
          'acquisition_mode_family_v3' ||
        result.searchSpace?.revenuePathContract !==
          'incremental_revenue_v3' ||
        result.searchSpace?.theoreticalCount < 100 ||
        result.searchSpace?.expandedCount < 100 ||
        result.searchSpace?.eligibleCount < 2 ||
        commercialCritic.contract !==
          'opportunity_tournament_critic_v1' ||
        commercialCritic.attempted !== true ||
        commercialCritic.enforced !== true ||
        commercialCritic.valid !== true ||
        commercialCritic.verdict !== 'accepted' ||
        !commercialCritic.reason ||
        commercialCritic.selectedOrdering?.[0] !== winnerID ||
        commercialCritic.inputFinalists?.length !==
          commercialCritic.comparisons?.length ||
        commercialCritic.inputFinalists?.some((binding, index) =>
          binding.finalistId !==
            commercialCritic.comparisons?.[index]?.finalistId ||
          binding.familyId !==
            commercialCritic.comparisons?.[index]?.familyId
        ) ||
        !commercialCritic.acceptedFinalistIds?.includes(winnerID) ||
        !commercialCritic.acceptedFamilyIds?.includes(winnerFamilyID) ||
        result.llm?.strategyGeneratorJudge?.purpose !==
          'opportunity_tournament_strategy_generation' ||
        result.llm?.strategyGeneratorJudge?.structuredOutputContract !==
          'opportunity_tournament_commercial_v2' ||
        result.llm?.commercialCritic?.purpose !==
          'opportunity_tournament_commercial_critic' ||
        result.llm?.commercialCritic?.structuredOutputContract !==
          'opportunity_tournament_critic_v1' ||
        result.llm?.commercialCritic?.generatorContract !== undefined ||
        result.winner?.revenuePath?.contractVersion !==
          'incremental_revenue_v3' ||
        result.hypotheses?.some((hypothesis) =>
          '_grounding' in (hypothesis.revenuePath || {}) ||
          hypothesis.provenance?.motionSignatures?.length !== 1 ||
          hypothesis.provenance?.motionSignatures?.[0] !== 'inbound'
        )) {
      throw new Error(
        `${domain.name} did not survive strict v2 grounding: ${JSON.stringify(result)}`
      );
    }
  }
  if (sideEffects.outreachAttempts !== 0 ||
      sideEffects.publishAttempts !== 0 ||
      sideEffects.providerWrites !== 0) {
    throw new Error(
      `${domain.name} authorized an external side effect: ${JSON.stringify(sideEffects)}`
    );
  }
}

await verifyAcquisitionFamilyMismatch();
await verifyTypedAcquisitionModeAllowsNeutralLabels();
await verifyTypedFamilyTimingFallbackPreservesBusinessGates();
await verifySaaSTimingRepair();
await verifyNoncurrentWarmReferralRejected();
await verifyFreshFormerCustomerAcquisitionAccepted();
verifyCommercialDiscoveryPDLReferralEnvelopeNormalization();
await verifyCommercialDiscoveryReferralPartnerKeepsBuyerDistinct();
await verifyCommercialDiscoveryPaidDemandGroundsCompensatedRole();
await verifyUnsafeGeneratedExperimentRejected();
await verifyCompletedExternalExecutionRejected();
await verifyInsufficientGroundedFinalistCause();
await verifyCriticReorderingControlsWinner();
await verifyPriorOutcomePolarityAndDedup();
await verifyInvalidSeedContractsRejected();
await verifyLengthFinishedStructuredRepair();
await verifyThrownLengthStructuredRepair();
await verifyProviderSpendBudgetRecovery();
await verifyMaximumTournamentSpendCeiling();
await verifyPromptEnvelopeFailsLocally();
await verifyOmittedProviderEvidenceFailsClosed();
await verifyProviderSchemaEvidenceParity();
await verifyQueryScopedOwnedAssetPreserved();
await verifySummaryCompactionPreservesRevenueTokens();
await verifyProviderProjectionOrderAndProfessionNeutrality();
await verifyFullCatalogUnicodeCapStable();
await verifyRepeatedLengthFinishFailsClosed();
await verifyBettyLongHomepageCompactionRegression();
await verifyBettyProductionTraceRegression();
await verifyBettyDistinctArticlePressureRegression();
await verifyStructuredRepairAcrossDomains();
verifyCatalogRankingBeforeFinalCap();
await verifyEmptyEvidenceFailForward();

console.log(
  'profile-scribe-rig profession-neutral opportunity tournament v2 smoke check passed.'
);

async function runDomain(domain, options = {}) {
  const ref = `observation:obs-${domain.name}`;
  const website = `https://${domain.name}.example/`;
  const sourceSnapshot = {
    profile: {
      identity: {
        fullName: `${domain.name} owner`,
        website
      }
    },
    sources: [{
      id: `src-${domain.name}`,
      kind: 'website',
      label: `${domain.name} revenue site`,
      url: website,
      status: 'monitoring',
      trustLevel: 'high'
    }],
    sourceEvidence: [{
      observationId: `obs-${domain.name}`,
      sourceId: `src-${domain.name}`,
      kind: 'service-page',
      title: domain.destination,
      summary: domain.sourceSummary,
      url: `${website}offer`,
      observedAt: '2026-07-29T12:00:00Z',
      confidence: 'high'
    }]
  };
  const response = strictV2Response(domain, ref);
  return runOpportunityTournament({
    job: {
      id: `job-${domain.name}`,
      kind: 'opportunity_tournament',
      payload: {
        tournamentId: `tournament-${domain.name}`,
        researchOnly: true,
        objective: {
          outcome: `Generate one new attributed ${domain.outcome}.`,
          successMetric: domain.outcome
        },
        budget: {
          maxHypotheses: 512,
          maxFinalists: 8,
          maxLLMCalls: 2,
          maxOutputTokens: 8000,
          ...(options.budgetOverrides || {})
        },
        commercialContext: {
          allowedChannels: ['organic search'],
          priorAttributedOutcomes:
            options.contextPriorOutcomes || []
        },
        priorOutcomes: options.priorOutcomes || [],
        evidenceSnapshot: sourceSnapshot
      }
    },
    model: 'test/v2',
    now,
    completeJSON: completionWithCritic(
      response,
      `gen-${domain.name}`,
      { reverseOrdering: options.reverseCritic === true }
    )
  });
}

function completionWithCritic(
  generatorResponse,
  generationID = 'gen-test',
  options = {}
) {
  return async (request) => {
    if (request.responseFormat?.json_schema?.name ===
        'opportunity_tournament_critic_v1') {
      const prompt = JSON.parse(request.user);
      const finalists = prompt.finalists || [];
      const orderedFinalists = options.reverseOrdering === true
        ? [...finalists].reverse()
        : finalists;
      const selectedOrdering = orderedFinalists
        .map((item) => item.finalistId);
      return {
        data: {
          criticContract: 'opportunity_tournament_critic_v1',
          selectedOrdering,
          selectedFinalistId: selectedOrdering[0],
          comparisons: finalists.map((item) => ({
            finalistId: item.finalistId,
            verdict: 'accept',
            activeRevenueAction: true,
            causalAcquisitionPath: true,
            incrementalRevenueOutcome: true,
            incrementalRevenue: 'strong',
            evidenceStrength: 'strong',
            reachability: 'moderate',
            timeToFirstDollar: 'moderate',
            cost: 'low',
            effort: 'moderate',
            uncertainty: 'moderate',
            reasonCode: 'active_incremental_path',
            reason:
              'The grounded motion actively advances an attributable paid conversion.'
          })),
          reason:
            'Ranked the grounded finalists by incremental revenue, evidence, reachability, time, cost, effort, and uncertainty.'
        },
        usage,
        generationId: `${generationID}-critic`
      };
    }
    return {
      data: generatorResponse,
      usage,
      generationId: generationID
    };
  };
}

function strictV2Response(domain, ref) {
  const grounded = domain.fullyGrounded !== false;
  const acquisitionRefs = [ref];
  const grounding = {
    b: [ref],
    o: [ref],
    a: acquisitionRefs,
    d: { l: domain.destination, e: [ref] },
    c: [ref],
    t: [ref]
  };
  const scores = {
    of: 0.9,
    es: 0.9,
    ba: 0.75,
    ti: 0.45,
    wp: 0.35,
    re: 0.7,
    ev: 0.8,
    ef: 0.25,
    co: 0.15,
    ri: 0.2,
    un: grounded ? 0.25 : 0.7
  };
  const item = (label) => ({ l: label, e: [ref] });
  const family = (suffix, scoreOffset) => ({
    l: `${domain.name} organic-search family ${suffix}`,
    m: 'inbound',
    e: [ref],
    s: Object.fromEntries(
      Object.entries(scores).map(([key, value]) => [
        key,
        Math.max(0, value - scoreOffset)
      ])
    ),
    d: {
      revenuePaths: [{
        l: `${domain.offer} from organic search`,
        e: [ref],
        contractVersion: 'incremental_revenue_v3',
        revenueMechanism: domain.mechanism,
        incrementalIncomeOutcome:
          `One new ${domain.outcome} adds incremental gross income`,
        acquisitionMode: 'inbound',
        conversionAction:
          `Use one organic-search inbound path to ${domain.destination} for ${domain.offer} and complete ${domain.outcome}`,
        observableRevenueOutcome: domain.outcome,
        attributionMethod: domain.attributionMethod,
        attributionSignal: domain.attribution,
        conversionDestination: domain.destination,
        stopCondition:
          'Stop after 25 qualified visits, 1 paid outcome, or 14 calendar days.',
        g: grounding,
        supportingBottleneck: '',
        vm: 250000
      }],
      offers: [
        item(domain.offer),
        item(`${domain.offer} purchase option`)
      ],
      buyerSegments: [
        item(domain.buyer),
        item(`${domain.buyer} with current purchase intent`)
      ],
      channels: [
        item(
          `Organic-search inbound discovery routes buyers to ${domain.destination}`
        ),
        item(
          `Nonbranded organic-search inbound traffic reaches ${domain.destination}`
        )
      ],
      actions: [
        item(
          `Use organic-search inbound discovery to ${domain.destination} and complete ${domain.outcome}`
        ),
        item(
          `Use nonbranded-search inbound discovery to ${domain.destination} and complete ${domain.outcome}`
        )
      ],
      timingTriggers: [{
        l: `Check whether ${domain.destination} remains current`,
        e: [ref],
        q: domain.destination
      }, {
        l: `Determine whether ${domain.destination} supports acting now`,
        e: [ref],
        q: domain.destination
      }],
      proofPoints: [
        item(domain.sourceSummary),
        item(`${domain.offer}: ${domain.sourceSummary}`)
      ],
      followUps: [
        item('Review the attributed paid result before any next step'),
        item('Stop after the bounded result is recorded')
      ]
    }
  });
  const experiment = {
    l: domain.name === 'healthcare'
      ? 'Measure paid home visits from organic search'
      : `Measure ${domain.offer} from organic search`,
    k: domain.sourceSummary,
    b: domain.buyer,
    o: domain.offer,
    a: 'organic search',
    d: domain.destination,
    c: domain.outcome,
    t: domain.attribution,
    x:
      `Review first: for 14 days or 25 qualified visits, test organic search for ${domain.buyer} seeking ${domain.offer} through ${domain.destination}; count ${domain.outcome} and store ${domain.attribution}.`,
    s: domain.outcome,
    days: 14,
    n: 25,
    u: 'qualified visits',
    e: [ref]
  };
  return {
    seedContract: 'revenue_family_bundle_v2',
    familyA: family('A', 0),
    familyB: family('B', 0.05),
    evidenceExperiment: experiment,
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

function compactV2Response(domain, ref) {
  const verbose = strictV2Response(domain, ref);
  const compactFamily = (family) => {
    const revenuePath = family.d.revenuePaths[0];
    return {
      l: family.l,
      m: family.m,
      e: family.e,
      s: family.s,
      d: {
        r: [{
          l: revenuePath.l,
          e: revenuePath.e,
          v: revenuePath.contractVersion,
          rm: revenuePath.revenueMechanism,
          io: revenuePath.incrementalIncomeOutcome,
          a: revenuePath.acquisitionMode,
          c: revenuePath.conversionAction,
          o: revenuePath.observableRevenueOutcome,
          atm: revenuePath.attributionMethod,
          ats: revenuePath.attributionSignal,
          cd: revenuePath.conversionDestination,
          st: revenuePath.stopCondition,
          g: revenuePath.g,
          sb: revenuePath.supportingBottleneck,
          vm: revenuePath.vm
        }],
        o: family.d.offers.slice(0, 1),
        b: family.d.buyerSegments.slice(0, 1),
        c: family.d.channels.slice(0, 1),
        a: family.d.actions.slice(0, 1),
        t: family.d.timingTriggers,
        p: family.d.proofPoints,
        f: family.d.followUps.slice(0, 1)
      }
    };
  };
  return {
    seedContract: verbose.seedContract,
    familyA: compactFamily(verbose.familyA),
    familyB: compactFamily(verbose.familyB),
    evidenceExperiment: verbose.evidenceExperiment,
    candidates: verbose.candidates,
    w: verbose.w
  };
}

function commercialDiscoveryFixture({
  id,
  provider,
  operation,
  queryHash,
  motion,
  buyerArchetype,
  market,
  evidence,
  candidates,
  paidProviderCalls = 0
}) {
  const paidAttempts = paidProviderCalls === 1
    ? [{
        id,
        provider,
        operation,
        queryHash,
        status: 'succeeded',
        estimatedSpendMicros: 10_000,
        actualSpendMicros: 10_000,
        creditsUsed: 1,
        resultCount: evidence.length,
        reservedAt: '2026-07-30T10:59:58Z',
        updatedAt: '2026-07-30T11:00:00Z',
        completedAt: '2026-07-30T11:00:00Z'
      }]
    : [];
  return {
    contractVersion: 'commercial_discovery_evidence_v1',
    status: 'found',
    attempted: true,
    motion,
    buyerArchetype,
    market,
    queryHash,
    providersAttempted: [provider],
    providerCalls: 1,
    paidProviderCalls,
    creditsUsed: paidProviderCalls,
    resultCount: evidence.length,
    patientTargetingExcluded: true,
    sideEffectsPerformed: 0,
    discoveredAt: '2026-07-30T11:00:00Z',
    attempts: paidAttempts,
    evidence,
    candidates
  };
}

function verifyCommercialDiscoveryPDLReferralEnvelopeNormalization() {
  const evidenceRef = 'external_discovery:abababababababababababab';
  const candidateID = 'candidate:external:cdcdcdcdcdcdcdcdcdcdcdcd';
  const provider = 'people_data_labs_person_search';
  const publicUrl = 'https://www.linkedin.com/in/betty-referral-fixture';
  const envelope = commercialDiscoveryFixture({
    id: 'attempt-betty-pdl-referral',
    provider,
    operation: 'person_search',
    queryHash: 'e'.repeat(64),
    motion: 'local_service_referral',
    buyerArchetype:
      'New York parents seeking reimbursable lactation care',
    market: 'New York, NY',
    paidProviderCalls: 1,
    evidence: [{
      evidenceRef,
      kind: 'verified_external_professional_target',
      label: 'Morgan Smith — Pediatrician at Riverside Pediatrics',
      summary:
        'Morgan Smith is a current public professional at Riverside Pediatrics in New York and a prospective professional referral target. The provider record does not establish willingness, permission, a relationship, or patient demand.',
      url: publicUrl,
      provider,
      provenance: 'people_data_labs_professional_record',
      roles: ['acquisition', 'channel_fit', 'prospective_partner'],
      verified: true,
      observedAt: '2026-07-30T11:00:00Z'
    }],
    candidates: [{
      id: candidateID,
      kind: 'person',
      displayLabel: 'Morgan Smith',
      organization: 'Riverside Pediatrics',
      role: 'Pediatrician',
      market: 'New York, NY',
      publicUrl,
      provider,
      commercialRole: 'referral_partner',
      evidenceRefs: [evidenceRef],
      contactPaths: [{
        kind: 'public_professional_url',
        available: true,
        verified: true,
        reference: publicUrl
      }],
      exactNamedCandidate: true,
      identityResolved: true
    }]
  });
  const normalized = normalizeCommercialDiscoveryEvidence(envelope, now);
  const inFlight = normalizeCommercialDiscoveryEvidence({
    ...envelope,
    attempts: envelope.attempts.map((attempt) => ({
      ...attempt,
      status: 'reserved'
    }))
  }, now);
  if (normalized.valid !== true ||
      normalized.paidProviderCalls !== 1 ||
      normalized.attempts?.length !== 1 ||
      normalized.attempts?.[0]?.status !== 'succeeded' ||
      normalized.evidence?.[0]?.evidenceRef !== evidenceRef ||
      !normalized.evidence?.[0]?.roles?.includes(
        'prospective_partner'
      ) ||
      normalized.candidates?.[0]?.commercialRole !==
        'referral_partner' ||
      normalized.candidates?.[0]?.contactPaths?.some((path) =>
        path.reference
      ) ||
      inFlight.valid !== false ||
      !inFlight.rejectedReasons?.invalid_attempt_ledger) {
    throw new Error(
      `PDL referral envelope did not normalize as paid, terminal, prospective discovery: ${JSON.stringify(normalized)}`
    );
  }
}

async function verifyAcquisitionFamilyMismatch() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  const ref = `observation:obs-${domain.name}`;
  const response = strictV2Response(domain, ref);
  response.familyA.m = 'partner_channel';
  const result = await runOpportunityTournament({
    job: {
      id: 'job-family-mismatch',
      payload: {
        researchOnly: true,
        objective: {
          outcome: 'Generate one new attributed subscription payment.',
          successMetric: 'One subscription payment receipt'
        },
        budget: { maxHypotheses: 128 },
        evidenceSnapshot: {
          profile: {
            identity: {
              website: 'https://saas.example/'
            }
          },
          sources: [{
            id: 'src-saas',
            url: 'https://saas.example/',
            status: 'monitoring'
          }],
          sourceEvidence: [{
            observationId: 'obs-saas',
            sourceId: 'src-saas',
            title: domain.destination,
            summary: domain.sourceSummary,
            url: 'https://saas.example/offer',
            observedAt: '2026-07-29T12:00:00Z'
          }]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async () => ({ data: response, usage })
  });
  if (result.status !== 'skipped' ||
      result.searchSpace?.motionConflictCount < 1 ||
      result.searchSpace?.eligibleCount < 1 ||
      result.hypotheses?.some((hypothesis) =>
        hypothesis.provenance?.strategyFamilyId !== 'family-b'
      )) {
    throw new Error(
      `family.m mismatch crossed the v2 acquisition coherence gate: ${JSON.stringify(result)}`
    );
  }
}

async function verifyTypedAcquisitionModeAllowsNeutralLabels() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  const ref = `observation:obs-${domain.name}`;
  const response = compactV2Response(domain, ref);
  for (const family of [response.familyA, response.familyB]) {
    family.d.c[0].l =
      `Organic search routes buyers to ${domain.destination}`;
    family.d.a[0].l =
      `Route qualified search visitors to ${domain.destination} and complete ${domain.outcome}`;
  }
  const result = await runDomainWithResponse(
    domain,
    response,
    'saas-neutral-acquisition-labels'
  );
  if (result.status !== 'completed' ||
      result.searchSpace?.motionConflictCount !== 0 ||
      result.searchSpace?.revenueRejectedCount !== 0 ||
      result.searchSpace?.eligibleCount < 2 ||
      result.hypotheses?.some((hypothesis) =>
        hypothesis.provenance?.motionSignatures?.length !== 1 ||
        hypothesis.provenance?.motionSignatures?.[0] !== 'inbound' ||
        hypothesis.provenance?.motionDimensions?.channel?.length !== 0 ||
        hypothesis.provenance?.motionDimensions?.action?.length !== 0
      )) {
    throw new Error(
      `typed acquisition mode rejected neutral channel/action wording: ${JSON.stringify(result)}`
    );
  }

  const conflictResponse = compactV2Response(domain, ref);
  conflictResponse.familyA.d.c[0].l =
    `Warm referral introduction routes buyers to ${domain.destination}`;
  const conflictResult = await runDomainWithResponse(
    domain,
    conflictResponse,
    'saas-conflicting-acquisition-label'
  );
  if (conflictResult.status !== 'skipped' ||
      conflictResult.searchSpace?.motionConflictCount < 1 ||
      conflictResult.searchSpace?.motionConflictDimensions?.channel < 1 ||
      conflictResult.searchSpace?.eligibleCount < 1 ||
      conflictResult.hypotheses?.some((hypothesis) =>
        hypothesis.provenance?.strategyFamilyId !== 'family-b'
      )) {
    throw new Error(
      `explicit acquisition-label conflict crossed the typed family gate: ${JSON.stringify(conflictResult)}`
    );
  }
}

async function verifyTypedFamilyTimingFallbackPreservesBusinessGates() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  const ref = `observation:obs-${domain.name}`;
  const response = compactV2Response(domain, ref);
  response.familyB.d.b[0].l =
    'Department leaders evaluating an alternative';
  for (const family of [response.familyA, response.familyB]) {
    family.d.t[0].e = ['observation:not-in-approved-catalog'];
    family.d.t[0].q = 'unsupported urgency';
  }
  const result = await runDomainWithResponse(
    domain,
    response,
    'saas-typed-family-timing-fallback'
  );
  if (result.status !== 'skipped' ||
      result.searchSpace?.completeStrategyFamilyCount !== 2 ||
      result.searchSpace?.incompleteStrategyFamilyCount !== 0 ||
      result.searchSpace?.familyEvidenceMismatchSeedCount !== 2 ||
      result.searchSpace?.invalidFamilySeedCount !== 0 ||
      result.searchSpace?.unsupportedTimingSeedCount !== 0 ||
      result.searchSpace?.timingVerificationRepairCount !== 2 ||
      result.searchSpace?.revenueRejectedCount < 1 ||
      result.searchSpace?.revenueRejectionReasons
        ?.unsupported_buyer_evidence < 1 ||
      result.searchSpace?.eligibleCount < 1 ||
      result.nextExperiment?.kind !== 'inbound_revenue_evidence' ||
      result.nextExperiment?.requiresReview !== true ||
      result.nextExperiment?.rerunPolicy?.maxReruns !== 1 ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0 ||
      result.hypotheses?.some((hypothesis) =>
        hypothesis.provenance?.strategyFamilyId !== 'family-a' ||
        hypothesis.provenance?.timingVerificationRepaired !== true ||
        !hypothesis.provenance?.familyEvidenceRefs?.includes(
          hypothesis.provenance?.timingEvidenceRef
        ) ||
        !hypothesis.provenance?.dimensions?.timingTrigger
          ?.evidenceRefs?.includes(
            hypothesis.provenance?.timingEvidenceRef
          ) ||
        !/^Determine whether the cited fact /i.test(
          hypothesis.timingTrigger || ''
        ) ||
        hypothesis.score?.timing > 0.25 ||
        hypothesis.score?.risk < 0.35 ||
        hypothesis.score?.uncertainty < 0.75
      )) {
    throw new Error(
      `typed family timing fallback bypassed a business gate: ${JSON.stringify(result)}`
    );
  }

  const staleDomain = {
    ...domain,
    sourceSummary: `Previously, ${domain.sourceSummary}`
  };
  const staleResponse = compactV2Response(staleDomain, ref);
  for (const family of [staleResponse.familyA, staleResponse.familyB]) {
    family.d.t[0].e = ['observation:not-in-approved-catalog'];
    family.d.t[0].q = 'unsupported urgency';
  }
  const staleResult = await runDomainWithResponse(
    staleDomain,
    staleResponse,
    'saas-stale-typed-family-timing-fallback'
  );
  if (staleResult.status !== 'skipped' ||
      staleResult.searchSpace?.completeStrategyFamilyCount !== 0 ||
      staleResult.searchSpace?.incompleteStrategyFamilyCount !== 2 ||
      staleResult.searchSpace?.familyEvidenceMismatchSeedCount !== 2 ||
      staleResult.searchSpace?.invalidFamilySeedCount < 2 ||
      staleResult.searchSpace?.unsupportedTimingSeedCount < 1 ||
      staleResult.searchSpace?.timingVerificationRepairCount !== 0 ||
      staleResult.nextExperiment?.kind !==
        'inbound_revenue_evidence' ||
      staleResult.winner !== null ||
      staleResult.gate?.sideEffects?.pdlCalls !== 0 ||
      staleResult.gate?.sideEffects?.outreachAttempts !== 0 ||
      staleResult.gate?.sideEffects?.publishAttempts !== 0 ||
      staleResult.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `stale family evidence was repaired into a timing trigger: ${JSON.stringify(staleResult)}`
    );
  }
}

async function verifySaaSTimingRepair() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  const ref = 'observation:obs-saas';
  const response = strictV2Response(domain, ref);
  for (const family of [response.familyA, response.familyB]) {
    family.d.timingTriggers[0].e = [
      'observation:not-in-approved-catalog'
    ];
    family.d.timingTriggers[0].q = 'unsupported urgency';
  }
  const result = await runDomainWithResponse(
    domain,
    response,
    'saas-timing-repair'
  );
  if (result.status !== 'completed' ||
      result.searchSpace?.timingVerificationRepairCount !== 2 ||
      result.searchSpace?.unsupportedTimingSeedCount !== 0 ||
      result.hypotheses?.some((hypothesis) =>
        !/^Determine whether the cited fact /i.test(
          hypothesis.timingTrigger || ''
        )
      )) {
    throw new Error(
      `profession-neutral SaaS timing repair failed: ${JSON.stringify(result)}`
    );
  }
}

async function verifyNoncurrentWarmReferralRejected() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  const ref = 'observation:obs-stale-warm';
  const response = strictV2Response(domain, ref);
  for (const family of [response.familyA, response.familyB]) {
    family.m = 'warm_referral';
    family.d.channels = family.d.channels.map((item) => ({
      ...item,
      l:
        `One warm referral introduction routes ${domain.buyer} to ${domain.destination}`
    }));
    family.d.actions = family.d.actions.map((item) => ({
      ...item,
      l:
        `Use one warm referral introduction to ${domain.destination} and complete ${domain.outcome}`
    }));
    const revenuePath = family.d.revenuePaths[0];
    revenuePath.acquisitionMode = 'warm_referral';
    revenuePath.conversionAction =
      `Use one warm referral introduction to ${domain.destination} for ${domain.offer} and complete ${domain.outcome}`;
    revenuePath.attributionSignal =
      'Payment receipt source field stores the warm referral';
  }
  const result = await runOpportunityTournament({
    job: {
      id: 'job-stale-warm',
      payload: {
        researchOnly: true,
        objective: {
          outcome: 'Generate one new attributed subscription payment.',
          successMetric: 'One subscription payment receipt'
        },
        budget: { maxHypotheses: 128 },
        evidenceSnapshot: {
          profile: {
            identity: { website: 'https://stale-warm.example/' }
          },
          sources: [{
            id: 'src-stale-warm',
            url: 'https://stale-warm.example/',
            status: 'monitoring'
          }],
          sourceEvidence: [{
            observationId: 'obs-stale-warm',
            sourceId: 'src-stale-warm',
            title: domain.destination,
            summary:
              `Operations teams reached ${domain.destination} through a warm referral and could previously buy ${domain.offer}; the payment receipt source field stored the warm referral. The page is now unavailable and offers a free plan only with no paid plan.`,
            url: 'https://stale-warm.example/pricing',
            observedAt: '2025-01-01T00:00:00Z',
            current: false,
            status: 'archived'
          }]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async () => ({ data: response, usage })
  });
  const reasons = result.searchSpace?.revenueRejectionReasons || {};
  if (result.status !== 'skipped' ||
      result.searchSpace?.eligibleCount !== 0 ||
      reasons.noncurrent_or_negative_paid_offer_evidence < 1 ||
      reasons.noncurrent_or_negative_paid_conversion_evidence < 1 ||
      reasons.noncurrent_or_negative_acquisition_evidence < 1 ||
      result.searchSpace?.commercialCritic?.attempted === true) {
    throw new Error(
      `stale/free/negative warm-referral evidence survived v2 revenue validation: ${JSON.stringify(result)}`
    );
  }
}

async function verifyFreshFormerCustomerAcquisitionAccepted() {
  const domain = {
    ...domains.find((item) => item.name === 'saas'),
    name: 'former-customer-reactivation',
    buyer: 'Former Customer Cohort former paying workflow customers',
    sourceSummary:
      'Former Customer Cohort is a named customer segment of former paying workflow customers observed this week. The current paid subscription pricing page accepts reactivation purchases, and the payment receipt source field stores former customer reactivation.'
  };
  const ref = 'observation:obs-former-customer-reactivation';
  const timingRef = 'observation:obs-former-customer-current-timing';
  const response = strictV2Response(domain, ref);
  for (const family of [response.familyA, response.familyB]) {
    family.e.push(timingRef);
    family.m = 'existing_customer';
    family.d.channels = family.d.channels.map((item) => ({
      ...item,
      l:
        `Former customer reactivation routes ${domain.buyer} to ${domain.destination}`
    }));
    family.d.actions = family.d.actions.map((item) => ({
      ...item,
      l:
        `Present ${domain.offer} to former customers through former customer reactivation and complete ${domain.outcome}`
    }));
    family.d.timingTriggers = [{
      l: 'Pricing page is current this week',
      e: [ref, timingRef],
      q: 'Pricing page is current this week'
    }, {
      l: 'Act while the Pricing page is current this week',
      e: [ref, timingRef],
      q: 'Pricing page is current this week'
    }];
    const revenuePath = family.d.revenuePaths[0];
    revenuePath.acquisitionMode = 'existing_customer';
    revenuePath.conversionAction =
      `Present ${domain.offer} to former customers through former customer reactivation at ${domain.destination} and complete ${domain.outcome}`;
    revenuePath.attributionSignal =
      'Payment receipt source field stores former customer reactivation';
  }
  response.candidates = [{
    k: 'organization',
    l: 'Former Customer Cohort',
    o: 'Former Customer Cohort',
    e: [ref]
  }];
  const result = await runOpportunityTournament({
    job: {
      id: 'job-former-customer-reactivation',
      payload: {
        researchOnly: true,
        objective: {
          outcome: 'Generate one new paid reactivation subscription.',
          successMetric: domain.outcome
        },
        budget: {
          maxHypotheses: 128,
          maxLLMCalls: 2
        },
        commercialContext: {
          allowedChannels: ['former customer reactivation']
        },
        evidenceSnapshot: {
          profile: {
            identity: {
              website: 'https://former-customer.example/'
            }
          },
          sources: [{
            id: 'src-former-customer-reactivation',
            url: 'https://former-customer.example/',
            status: 'monitoring'
          }],
          sourceEvidence: [{
            observationId: 'obs-former-customer-reactivation',
            sourceId: 'src-former-customer-reactivation',
            kind: 'service-page',
            title: domain.destination,
            summary: domain.sourceSummary,
            url: 'https://former-customer.example/pricing',
            observedAt: '2026-07-29T12:00:00Z',
            current: true,
            status: 'active'
          }, {
            observationId: 'obs-former-customer-current-timing',
            sourceId: 'src-former-customer-reactivation',
            kind: 'service-page',
            title: 'Current pricing availability',
            summary: 'Pricing page is current this week.',
            url: 'https://former-customer.example/pricing/availability',
            observedAt: '2026-07-29T12:00:00Z',
            current: true,
            status: 'active'
          }]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: completionWithCritic(
      response,
      'gen-former-customer-reactivation'
    )
  });
  if (result.status !== 'completed' ||
      result.winner?.revenuePath?.acquisitionMode !==
        'existing_customer' ||
      result.searchSpace?.revenueRejectionReasons
        ?.noncurrent_or_negative_acquisition_evidence ||
      result.result?.incrementalRevenueGate?.passed !== true ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `fresh former-customer evidence was mistaken for stale acquisition evidence: ${JSON.stringify(result)}`
    );
  }
}

async function verifyCommercialDiscoveryReferralPartnerKeepsBuyerDistinct() {
  const offerRef = 'observation:obs-betty-referral-offer';
  const referralRef =
    'external_discovery:bbbbbbbbbbbbbbbbbbbbbbbb';
  const candidateID =
    'candidate:external:dddddddddddddddddddddddd';
  const provider = 'google_places';
  const queryHash = 'a'.repeat(64);
  const domain = {
    name: 'betty-referral-discovery',
    buyer: 'New York parents seeking reimbursable lactation care',
    offer: 'A reimbursable paid in-home lactation consultation',
    destination: 'Home-visit booking page',
    mechanism: 'insurance_reimbursement',
    outcome: 'One paid claim recorded',
    attributionMethod: 'claim_record',
    attribution:
      'Claim record referral source field stores Riverside Pediatrics',
    sourceSummary:
      'New York parents seeking reimbursable lactation care can book a reimbursable paid in-home lactation consultation on the Home-visit booking page. Insurance is accepted, one paid claim is recorded, and the Claim record referral source field stores Riverside Pediatrics. The Home-visit booking page is current.'
  };
  const response = strictV2Response(domain, offerRef);
  for (const family of [response.familyA, response.familyB]) {
    family.l = `${domain.name} prospective partner family`;
    family.m = 'partner_channel';
    family.e = [offerRef, referralRef];
    family.d.offers = family.d.offers.map((item) => ({
      ...item,
      e: [offerRef]
    }));
    family.d.buyerSegments = family.d.buyerSegments.map((item) => ({
      ...item,
      l: domain.buyer,
      e: [offerRef]
    }));
    family.d.channels = family.d.channels.map((item) => ({
      ...item,
      l:
        `Prospective partner referral channel through Riverside Pediatrics to ${domain.destination}`,
      e: [referralRef]
    }));
    family.d.actions = family.d.actions.map((item) => ({
      ...item,
      l:
        `Request one review-first Riverside Pediatrics partner referral that presents ${domain.offer} and completes ${domain.outcome}`,
      e: [offerRef, referralRef]
    }));
    family.d.proofPoints = family.d.proofPoints.map((item) => ({
      ...item,
      e: [offerRef]
    }));
    family.d.followUps = family.d.followUps.map((item) => ({
      ...item,
      e: [offerRef, referralRef]
    }));
    const revenuePath = family.d.revenuePaths[0];
    revenuePath.l = `${domain.offer} from one prospective partner referral`;
    revenuePath.e = [offerRef, referralRef];
    revenuePath.acquisitionMode = 'partner_channel';
    revenuePath.conversionAction =
      `Request one review-first Riverside Pediatrics partner referral to ${domain.destination} for ${domain.offer} and complete ${domain.outcome}`;
    revenuePath.attributionSignal = domain.attribution;
    revenuePath.g = {
      b: [offerRef],
      o: [offerRef],
      a: [referralRef],
      d: { l: domain.destination, e: [offerRef] },
      c: [offerRef],
      t: [offerRef]
    };
  }
  response.candidates = [];
  const commercialDiscoveryEvidence = commercialDiscoveryFixture({
    id: 'attempt-betty-referral',
    provider,
    operation: 'places_text_search',
    queryHash,
    motion: 'local_service_referral',
    buyerArchetype: domain.buyer,
    market: 'New York, NY',
    evidence: [{
      evidenceRef: referralRef,
      kind: 'verified_external_professional_target',
      label: 'Riverside Pediatrics',
      summary:
        'Riverside Pediatrics is a current New York newborn-serving pediatric practice and prospective professional referral target. The public provider record supports channel fit only and does not claim an existing referral relationship, willingness, or patient demand.',
      url: 'https://riverside-pediatrics.example/',
      provider,
      provenance: 'read_only_professional_provider',
      roles: [
        'acquisition',
        'channel_fit',
        'prospective_partner'
      ],
      verified: true,
      observedAt: '2026-07-30T11:00:00Z'
    }],
    candidates: [{
      id: candidateID,
      kind: 'organization',
      displayLabel: 'Riverside Pediatrics',
      organization: 'Riverside Pediatrics',
      role: 'Newborn-serving pediatric practice',
      market: 'New York, NY',
      publicUrl: 'https://riverside-pediatrics.example/',
      provider,
      commercialRole: 'referral_partner',
      evidenceRefs: [referralRef],
      contactPaths: [{
        kind: 'public_professional_url',
        available: true,
        verified: true,
        reference: 'https://riverside-pediatrics.example/'
      }],
      exactNamedCandidate: true,
      identityResolved: true
    }]
  });
  const requests = [];
  const complete = completionWithCritic(
    response,
    'gen-betty-referral-discovery'
  );
  const result = await runOpportunityTournament({
    job: {
      id: 'job-betty-referral-discovery',
      payload: {
        researchOnly: true,
        objective: {
          outcome: 'Generate one new paid or reimbursed lactation visit.',
          successMetric: domain.outcome
        },
        budget: { maxHypotheses: 128, maxLLMCalls: 2 },
        commercialDiscoveryEvidence,
        evidenceSnapshot: {
          profile: {
            identity: {
              fullName: 'Betty Greenman',
              website: 'https://betty-lactation.example/'
            }
          },
          sources: [{
            id: 'src-betty-referral',
            url: 'https://betty-lactation.example/',
            status: 'monitoring'
          }],
          sourceEvidence: [{
            observationId: 'obs-betty-referral-offer',
            sourceId: 'src-betty-referral',
            kind: 'service-page',
            title: domain.destination,
            summary: domain.sourceSummary,
            url: 'https://betty-lactation.example/book',
            observedAt: '2026-07-29T12:00:00Z',
            current: true,
            status: 'active'
          }]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async (request) => {
      requests.push(request);
      return complete(request);
    }
  });
  const generatorPrompt = JSON.parse(requests[0]?.user || '{}');
  const promptDiscovery = generatorPrompt.evidenceCatalog?.find(
    (item) => item.id === referralRef
  );
  const graphNode = result.commercialEvidenceGraph?.nodes?.find(
    (node) => node.evidenceRef === referralRef
  );
  const candidate = result.candidates?.find((item) =>
    item.id === candidateID
  );
  if (result.status !== 'completed' ||
      result.result?.incrementalRevenueGate?.passed !== true ||
      result.searchSpace?.commercialDiscoveryEvidenceCount !== 1 ||
      result.searchSpace?.commercialDiscoveryCandidateCount !== 1 ||
      result.trace?.commercialDiscovery?.valid !== true ||
      result.trace?.commercialDiscovery?.providerCalls !== 1 ||
      result.trace?.commercialDiscovery?.paidProviderCalls !== 0 ||
      (result.trace?.commercialDiscovery?.attempts || []).length !== 0 ||
      promptDiscovery?.providerAttestedCommercialDiscovery !== true ||
      !promptDiscovery?.commercialDiscoveryRoles?.includes(
        'prospective_partner'
      ) ||
      graphNode?.provenance !==
        'provider_attested_commercial_discovery' ||
      !graphNode?.roles?.includes('prospective_partner') ||
      !graphNode?.roles?.includes('acquisition') ||
      !graphNode?.roles?.includes('channel_fit') ||
      graphNode?.roles?.includes('defined_buyer') ||
      graphNode?.roles?.includes('named_partner') ||
      graphNode?.roles?.includes('named_outside_target') ||
      result.hypotheses?.some((hypothesis) =>
        !hypothesis.evidenceRefs?.includes(referralRef) ||
        hypothesis.revenuePath?.acquisitionMode !== 'partner_channel' ||
        !/new york parents/i.test(hypothesis.buyerSegment) ||
        /riverside pediatrics/i.test(hypothesis.buyerSegment)
      ) ||
      candidate?.commercialRole !== 'referral_partner' ||
      candidate?.providerAttestedCommercialDiscovery !== true ||
      candidate?.contactPaths?.some((path) => path.reference) ||
      result.winner?.candidateId !== candidateID ||
      result.result?.incrementalRevenueGate?.allowedChannel !==
        'partner_channel' ||
      result.result?.incrementalRevenueGate
        ?.discoveryRouteRequiresApproval !== true ||
      result.gate?.sideEffects?.pdlCalls !== 0 ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `provider-attested referral partner did not remain distinct from Betty's buyer: ${JSON.stringify({ result, generatorPrompt })}`
    );
  }
}

async function verifyCommercialDiscoveryPaidDemandGroundsCompensatedRole() {
  const supplyRef = 'observation:obs-programmer-go-proof';
  const jobRef = 'external_discovery:cccccccccccccccccccccccc';
  const candidateID = 'candidate:external:eeeeeeeeeeeeeeeeeeeeeeee';
  const provider = 'people_data_labs_job_posting_search';
  const queryHash = 'c'.repeat(64);
  const jobURL = 'https://jobs.acme-systems.example/senior-go-engineer';
  const domain = {
    name: 'programmer-paid-demand-discovery',
    buyer:
      'Acme Systems engineering team buying a current backend requirement',
    offer: 'A compensated role as Senior Go Engineer with salary',
    destination: 'Acme Systems application page',
    mechanism: 'compensated_role',
    outcome: 'One compensation offer accepted',
    attributionMethod: 'employment_compensation_record',
    attribution:
      'Employment compensation record source field stores public posting ID ACME-GO-42',
    sourceSummary:
      'The programmer has verified Go, PostgreSQL, and shipped API experience and is currently available for a backend engagement.'
  };
  const response = strictV2Response(domain, supplyRef);
  for (const family of [response.familyA, response.familyB]) {
    family.l = `${domain.name} live role family`;
    family.m = 'inbound';
    family.e = [supplyRef, jobRef];
    family.d.offers = family.d.offers.map((item) => ({
      ...item,
      l: domain.offer,
      e: [jobRef]
    }));
    family.d.buyerSegments = family.d.buyerSegments.map((item) => ({
      ...item,
      l: domain.buyer,
      e: [jobRef]
    }));
    family.d.channels = family.d.channels.map((item) => ({
      ...item,
      l:
        `Inbound platform discovery routes the programmer to ${domain.destination}`,
      e: [jobRef]
    }));
    family.d.actions = family.d.actions.map((item) => ({
      ...item,
      l:
        `Submit one application through ${domain.destination} for the compensated role at Acme Systems`,
      e: [jobRef]
    }));
    family.d.timingTriggers = family.d.timingTriggers.map((item) => ({
      ...item,
      l: 'Determine whether the programmer is currently available',
      e: [supplyRef],
      q: 'currently available'
    }));
    family.d.proofPoints = family.d.proofPoints.map((item) => ({
      ...item,
      l: `${domain.sourceSummary} ${domain.offer}`,
      e: [supplyRef, jobRef]
    }));
    family.d.followUps = family.d.followUps.map((item) => ({
      ...item,
      e: [jobRef]
    }));
    const revenuePath = family.d.revenuePaths[0];
    revenuePath.l = `${domain.offer} through a current public job posting`;
    revenuePath.e = [supplyRef, jobRef];
    revenuePath.revenueMechanism = 'compensated_role';
    revenuePath.incrementalIncomeOutcome =
      'One new accepted compensation offer adds incremental gross salary income';
    revenuePath.acquisitionMode = 'inbound';
    revenuePath.conversionAction =
      `Use inbound platform discovery to ${domain.destination} and submit one application for the compensated role`;
    revenuePath.observableRevenueOutcome = domain.outcome;
    revenuePath.attributionMethod = 'employment_compensation_record';
    revenuePath.attributionSignal = domain.attribution;
    revenuePath.conversionDestination = domain.destination;
    revenuePath.g = {
      b: [jobRef],
      o: [jobRef],
      a: [jobRef],
      d: { l: domain.destination, e: [jobRef] },
      c: [jobRef],
      t: [jobRef]
    };
  }
  response.candidates = [];
  const commercialDiscoveryEvidence = commercialDiscoveryFixture({
    id: 'attempt-programmer-paid-demand',
    provider,
    operation: 'job_posting_search',
    queryHash,
    motion: 'developer_project',
    buyerArchetype: 'Engineering teams hiring Go backend developers',
    market: 'Remote United States',
    evidence: [{
      evidenceRef: jobRef,
      kind: 'verified_external_live_demand',
      label: 'Senior Go Engineer at Acme Systems',
      summary:
        'Verified active compensated-role demand: Acme Systems is hiring for a current salaried Senior Go Engineer role requiring Go, PostgreSQL, and shipped API experience. Inbound platform discovery reaches the Acme Systems application page. One accepted compensation offer is the paid conversion, and the Employment compensation record source field stores public posting ID ACME-GO-42.',
      url: jobURL,
      provider,
      provenance: 'people_data_labs_active_job_posting',
      roles: [
        'acquisition',
        'channel_fit',
        'conversion_destination',
        'defined_buyer',
        'demand_signal',
        'paid_conversion',
        'paid_offer'
      ],
      verified: true,
      observedAt: '2026-07-30T11:00:00Z'
    }],
    candidates: [{
      id: candidateID,
      kind: 'employer_job_posting',
      displayLabel: 'Acme Systems',
      organization: 'Acme Systems',
      role: 'Senior Go Engineer',
      market: 'Remote United States',
      publicUrl: jobURL,
      provider,
      commercialRole: 'paid_demand',
      evidenceRefs: [jobRef],
      contactPaths: [{
        kind: 'public_professional_url',
        available: true,
        verified: true,
        reference: jobURL
      }],
      exactNamedCandidate: true,
      identityResolved: true
    }],
    paidProviderCalls: 1
  });
  const requests = [];
  const complete = completionWithCritic(
    response,
    'gen-programmer-paid-demand-discovery'
  );
  const result = await runOpportunityTournament({
    job: {
      id: 'job-programmer-paid-demand-discovery',
      payload: {
        researchOnly: true,
        objective: {
          outcome: 'Generate one new accepted compensated backend role.',
          successMetric: domain.outcome
        },
        budget: { maxHypotheses: 128, maxLLMCalls: 2 },
        commercialDiscoveryEvidence,
        evidenceSnapshot: {
          profile: {
            identity: {
              fullName: 'Pat Programmer',
              website: 'https://pat-programmer.example/'
            }
          },
          sources: [{
            id: 'src-programmer-proof',
            url: 'https://pat-programmer.example/',
            status: 'monitoring'
          }],
          sourceEvidence: [{
            observationId: 'obs-programmer-go-proof',
            sourceId: 'src-programmer-proof',
            kind: 'portfolio',
            title: 'Go and PostgreSQL API portfolio',
            summary: domain.sourceSummary,
            url: 'https://pat-programmer.example/api-project',
            observedAt: '2026-07-29T12:00:00Z',
            current: true,
            status: 'active'
          }]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async (request) => {
      requests.push(request);
      return complete(request);
    }
  });
  const generatorPrompt = JSON.parse(requests[0]?.user || '{}');
  const promptRefs = new Set(
    generatorPrompt.evidenceCatalog?.map((item) => item.id)
  );
  const jobNode = result.commercialEvidenceGraph?.nodes?.find(
    (node) => node.evidenceRef === jobRef
  );
  const candidate = result.candidates?.find((item) =>
    item.id === candidateID
  );
  if (result.status !== 'completed' ||
      result.result?.incrementalRevenueGate?.passed !== true ||
      result.searchSpace?.commercialDiscoveryEvidenceCount !== 1 ||
      result.searchSpace?.commercialDiscoveryCandidateCount !== 1 ||
      result.trace?.commercialDiscovery?.paidProviderCalls !== 1 ||
      result.trace?.commercialDiscovery?.creditsUsed !== 1 ||
      result.trace?.commercialDiscovery?.attempts?.[0]?.status !==
        'succeeded' ||
      !promptRefs.has(jobRef) ||
      jobNode?.provenance !==
        'provider_attested_commercial_discovery' ||
      ![
        'paid_offer',
        'demand_signal',
        'defined_buyer',
        'acquisition',
        'conversion_destination',
        'paid_conversion'
      ].every((role) => jobNode?.roles?.includes(role)) ||
      result.hypotheses?.some((hypothesis) =>
        !hypothesis.evidenceRefs?.includes(jobRef) ||
        hypothesis.revenuePath?.revenueMechanism !== 'compensated_role' ||
        hypothesis.revenuePath?.acquisitionMode !== 'inbound' ||
        hypothesis.revenuePath?.attributionMethod !==
          'employment_compensation_record' ||
        !/application page/i.test(
          hypothesis.revenuePath?.conversionDestination || ''
        )
      ) ||
      candidate?.commercialRole !== 'paid_demand' ||
      candidate?.providerAttestedCommercialDiscovery !== true ||
      candidate?.contactPaths?.some((path) => path.reference) ||
      candidate?.evidenceRefs?.length !== 1 ||
      candidate?.evidenceRefs?.[0] !== jobRef ||
      result.candidates?.some((item) =>
        item.kind === 'owned_inbound_asset'
      ) ||
      result.winner?.candidateId !== candidateID ||
      result.result?.incrementalRevenueGate?.allowedChannel !==
        'application_page' ||
      result.result?.executionAuthorization !== 'none' ||
      result.gate?.sideEffects?.pdlCalls !== 0 ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `provider-attested paid demand did not ground the programmer hiring path: ${JSON.stringify({ result, generatorPrompt })}`
    );
  }
}

async function verifyCompletedExternalExecutionRejected() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  const ref = 'observation:obs-completed-execution-claim';
  const response = strictV2Response(domain, ref);
  for (const family of [response.familyA, response.familyB]) {
    family.d.actions = family.d.actions.map((item) => ({
      ...item,
      l:
        `We already sent ${domain.offer} through organic search and completed ${domain.outcome}`
    }));
    family.d.revenuePaths[0].conversionAction =
      `We already sent ${domain.offer} through organic search to ${domain.destination} and completed ${domain.outcome}`;
  }
  const result = await runDomainWithResponse(
    domain,
    response,
    'completed-execution-claim'
  );
  if (result.status !== 'skipped' ||
      result.winner !== null ||
      result.searchSpace?.revenueRejectionReasons
        ?.claimed_completed_external_execution < 1 ||
      result.searchSpace?.commercialCritic?.attempted === true ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `past-tense external execution claim reached critic or recommendation: ${JSON.stringify(result)}`
    );
  }
}

async function verifyInsufficientGroundedFinalistCause() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  const result = await runDomain(domain, {
    budgetOverrides: { maxHypotheses: 1 }
  });
  if (result.status !== 'skipped' ||
      result.searchSpace?.retainedCount !== 1 ||
      result.searchSpace?.commercialCritic?.attempted !== false ||
      result.searchSpace?.commercialCritic?.cause !==
        'insufficient_grounded_finalists' ||
      result.usage?.calls !== 1 ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `fewer than two grounded finalists received an untruthful critic cause: ${JSON.stringify(result)}`
    );
  }
}

async function verifyCriticReorderingControlsWinner() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  const result = await runDomain(domain, { reverseCritic: true });
  if (result.status !== 'completed' ||
      result.winner?.hypothesisId !==
        result.searchSpace?.commercialCritic?.selectedOrdering?.[0] ||
      !(result.winner?.score?.total < result.runnerUp?.score?.total) ||
      !/independent commercial critic ranked it ahead/i.test(
        result.winner?.whyOverRunnerUp || ''
      ) ||
      !/critic ordering, not that score alone/i.test(
        result.winner?.whyOverRunnerUp || ''
      )) {
    throw new Error(
      `critic reordering did not control the exact winner or produced a false score claim: ${JSON.stringify(result)}`
    );
  }
}

async function verifyPriorOutcomePolarityAndDedup() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  const outcome = {
    kind: 'business_progress',
    status: 'won',
    verified: true,
    offer: domain.offer,
    buyerSegment: domain.buyer,
    channel:
      `Organic-search inbound discovery routes buyers to ${domain.destination}`,
    action:
      `Use organic-search inbound discovery to ${domain.destination} and complete ${domain.outcome}`,
    occurredAt: '2026-07-29T12:00:00Z',
    evidenceRefs: ['observation:obs-saas'],
    attribution: {
      objectiveId: 'obj-prior-polarity',
      tournamentId: 'opturn-prior-polarity',
      hypothesisId: 'hyp-prior-polarity',
      actionId: 'action-prior-polarity',
      algorithmVersion: 'cheap_tournament_v5'
    }
  };
  const [baseline, won, lost, duplicateWon] = await Promise.all([
    runDomain(domain),
    runDomain(domain, { priorOutcomes: [outcome] }),
    runDomain(domain, {
      priorOutcomes: [{ ...outcome, status: 'lost' }]
    }),
    runDomain(domain, {
      priorOutcomes: [outcome],
      contextPriorOutcomes: [structuredClone(outcome)]
    })
  ]);
  const baselineScore = baseline.winner?.score || {};
  const wonScore = won.winner?.score || {};
  const lostScore = lost.winner?.score || {};
  const duplicateScore = duplicateWon.winner?.score || {};
  const wonPriorNode = won.commercialEvidenceGraph?.nodes?.find(
    (node) => node.type === 'verified_prior_outcome'
  );
  const lostPriorNode = lost.commercialEvidenceGraph?.nodes?.find(
    (node) => node.type === 'verified_prior_outcome'
  );
  const gapDomain = {
    ...domains.find((item) => item.name === 'healthcare')
  };
  const lostOnly = await runDomain(gapDomain, {
    priorOutcomes: [{
      ...outcome,
      status: 'lost',
      offer: gapDomain.offer,
      buyerSegment: gapDomain.buyer,
      channel:
        `Organic-search inbound discovery routes buyers to ${gapDomain.destination}`,
      action:
        `Use organic-search inbound discovery to ${gapDomain.destination} and complete ${gapDomain.outcome}`,
      attribution: {
        ...outcome.attribution,
        objectiveId: 'obj-lost-only-gap',
        tournamentId: 'opturn-lost-only-gap'
      }
    }]
  });
  const lostOnlyNode = lostOnly.commercialEvidenceGraph?.nodes?.find(
    (node) => node.type === 'verified_prior_outcome'
  );
  if (wonScore.expectedValue <= baselineScore.expectedValue ||
      wonScore.uncertainty >= baselineScore.uncertainty ||
      lostScore.expectedValue >= baselineScore.expectedValue ||
      lostScore.uncertainty <= baselineScore.uncertainty ||
      duplicateScore.expectedValue !== wonScore.expectedValue ||
      duplicateScore.uncertainty !== wonScore.uncertainty ||
      !wonPriorNode?.roles?.includes('channel_fit') ||
      !wonPriorNode?.roles?.includes('defined_buyer') ||
      lostPriorNode?.roles?.includes('channel_fit') ||
      lostPriorNode?.roles?.includes('defined_buyer') ||
      lostPriorNode?.roles?.includes('acquisition') ||
      lostPriorNode?.channelFitChannels?.length > 0 ||
      lostOnly.result?.resultType === 'immediate_revenue_action' ||
      lostOnly.status === 'completed' ||
      lostOnlyNode?.roles?.some((role) =>
        ['channel_fit', 'defined_buyer', 'acquisition'].includes(role)
      ) ||
      duplicateWon.commercialEvidenceGraph?.summary
        ?.priorAttributedOutcomeEvidenceRefs?.length !== 1) {
    throw new Error(
      `prior business_progress status polarity, reachability safety, or stable dedupe failed: ${JSON.stringify({ baselineScore, wonScore, lostScore, duplicateScore, wonPriorNode, lostPriorNode, lostOnly, graph: duplicateWon.commercialEvidenceGraph })}`
    );
  }
}

async function verifyUnsafeGeneratedExperimentRejected() {
  const domain = { ...domains.find((item) => item.name === 'healthcare') };
  const ref = 'observation:obs-healthcare';
  const response = strictV2Response(domain, ref);
  response.evidenceExperiment.x =
    `Review first: for 14 days or 25 qualified visits, send the owned newsletter to managers and test organic search for ${domain.buyer} seeking ${domain.offer} through ${domain.destination}; count ${domain.outcome} and store ${domain.attribution}.`;
  const result = await runDomainWithResponse(
    domain,
    response,
    'unsafe-generated-experiment'
  );
  const experiment = result.nextExperiment || {};
  if (result.status !== 'skipped' ||
      experiment.title === response.evidenceExperiment.l ||
      !completeBusinessExperimentFields(experiment) ||
      !/organic search.*fit unverified/i.test(
        experiment.acquisitionMechanism || ''
      ) ||
      experiment.knownFact !== domain.sourceSummary ||
      /\b(?:send|newsletter distribution|send the owned newsletter)\b/i.test(
        `${experiment.title} ${experiment.action}`
      )) {
    throw new Error(
      `generated experiment retained an external newsletter action: ${JSON.stringify(result)}`
    );
  }
}

async function verifyInvalidSeedContractsRejected() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  for (const [label, contract] of [
    ['missing', undefined],
    ['invalid', 'revenue_family_bundle_future']
  ]) {
    const ref = `observation:obs-${domain.name}`;
    const response = strictV2Response(domain, ref);
    if (contract === undefined) {
      delete response.seedContract;
    } else {
      response.seedContract = contract;
    }
    const result = await runDomainWithResponse(
      domain,
      response,
      `${label}-seed-contract`,
      {
        finishReason: 'stop',
        nativeFinishReason: 'stop'
      }
    );
    if (result.status !== 'skipped' ||
        result.searchSpace?.seedContract !== 'invalid' ||
        result.searchSpace?.eligibleCount !== 0 ||
        result.nextExperiment?.kind !==
          'strategy_generation_shape_recovery' ||
        result.nextExperiment?.missingEvidence?.[0] !==
          'structured_strategy_family_repair' ||
        hasBusinessExperimentField(result.nextExperiment) ||
        result.gate?.decision !==
          'strategy_generation_incomplete' ||
        result.searchSpace?.structuredRepair?.initialIssue !==
          'unsupported_seed_contract' ||
        result.llm?.strategyGeneratorJudge?.responseDiagnostics
          ?.finishReason !== 'stop' ||
        result.llm?.strategyGeneratorJudge?.error) {
      throw new Error(
        `${label} family-bundle seed contract was silently upgraded: ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyLengthFinishedStructuredRepair() {
  const domain = { ...domains.find((item) =>
    item.name === 'healthcare-patient'
  ) };
  const ref = 'observation:obs-length-repair';
  const initial = strictV2Response(domain, ref);
  initial.familyA.l = 'PRIOR_RESPONSE_CANARY_' + 'x'.repeat(100_000);
  initial.ignoredPadding = 'PRIOR_RESPONSE_PADDING_' + 'y'.repeat(100_000);
  const repaired = compactV2Response(domain, ref);
  const requests = [];
  const result = await runDomainRepairSequence({
    domain,
    ref,
    suffix: 'parseable-length-repair',
    responses: [initial, repaired],
    diagnostics: [{
      finishReason: 'length',
      nativeFinishReason: 'max_tokens',
      contentByteCount: 8000
    }, {
      finishReason: 'stop',
      nativeFinishReason: 'stop'
    }],
    onRequest: (request) => requests.push(request)
  });
  const repairUser = requests[1]?.user || '';
  const repairInput = JSON.parse(repairUser);
  const repairSchema = requests[1]?.responseFormat?.json_schema?.schema;
  if (requests.length !== 2 ||
      result.status !== 'skipped' ||
      result.result?.resultType !== 'technical_recovery' ||
      result.nextExperiment?.kind !==
        'strategy_generation_critic_displaced_by_repair' ||
      result.searchSpace?.commercialCritic?.attempted !== false ||
      result.searchSpace?.commercialCritic?.cause !==
        'commercial_critic_displaced_by_repair' ||
      result.searchSpace?.structuredRepair?.initialIssue !==
        'output_length_truncated' ||
      result.searchSpace?.structuredRepair?.initialFamilyWrapperCount !== 2 ||
      result.searchSpace?.structuredRepair?.initialValidStrategyFamilyCount !== 2 ||
      result.searchSpace?.structuredRepair?.attempted !== true ||
      result.searchSpace?.structuredRepair?.succeeded !== true ||
      result.searchSpace?.familyWrapperCount !== 2 ||
      result.searchSpace?.validStrategyFamilyCount !== 2 ||
      result.llm?.strategyGeneratorJudge?.status !== 'incomplete' ||
      result.llm?.strategyGeneratorJudge?.error !==
        'openrouter_truncated_structured_output' ||
      result.llm?.strategyFamilyRepair?.status !== 'completed' ||
      result.usage?.calls !== 2 ||
      result.usage?.successfulCalls !== 1 ||
      result.usage?.maxLLMSpendMicros !== 400_000 ||
      requests[0]?.maxTokens !== 8000 ||
      requests[1]?.maxTokens !== 4000 ||
      requests.some((request) =>
        request.model !== 'test/v2' ||
        request.temperature !== 0 ||
        JSON.stringify(request.provider?.order) !== '["openai"]' ||
        JSON.stringify(request.provider?.only) !== '["openai"]' ||
        request.provider?.allow_fallbacks !== false ||
        request.provider?.require_parameters !== true ||
        request.provider?.max_price?.prompt !== 0.4 ||
        request.provider?.max_price?.completion !== 1.6
      ) ||
      repairSchema?.properties?.familyA?.$ref !== '#/$defs/family' ||
      repairSchema?.properties?.familyB?.$ref !== '#/$defs/family' ||
      repairSchema?.$defs?.family?.properties?.d?.properties
        ?.o?.minItems !== 2 ||
      repairSchema?.$defs?.family?.properties?.d?.properties
        ?.o?.maxItems !== 2 ||
      repairSchema?.$defs?.family?.properties?.s?.$ref !==
        '#/$defs/scores' ||
      repairSchema?.properties?.candidates?.maxItems !== 8 ||
      !('w' in (repairSchema?.properties || {})) ||
      JSON.stringify(repairSchema).includes('"pattern"') ||
      JSON.stringify(repairSchema).includes('"description"') ||
      'previousResponse' in repairInput ||
      repairUser.includes('PRIOR_RESPONSE_CANARY_') ||
      repairUser.includes('PRIOR_RESPONSE_PADDING_') ||
      Buffer.byteLength(repairUser, 'utf8') > 30_000 ||
      result.winner !== null ||
      result.runnerUp !== null) {
    throw new Error(
      `parseable length-finished output was not freshly repaired with the compact contract: ${JSON.stringify({ result, requests: requests.map((request) => ({ maxTokens: request.maxTokens, userBytes: Buffer.byteLength(request.user || '', 'utf8'), responseFormat: request.responseFormat })) })}`
    );
  }
}

async function verifyRepeatedLengthFinishFailsClosed() {
  const domain = { ...domains.find((item) => item.name === 'saas') };
  const ref = 'observation:obs-repeated-length';
  const response = compactV2Response(domain, ref);
  const result = await runDomainRepairSequence({
    domain,
    ref,
    suffix: 'repeated-parseable-length',
    responses: [response, response],
    diagnostics: [{
      finishReason: 'length',
      nativeFinishReason: 'max_tokens'
    }, {
      finishReason: 'length',
      nativeFinishReason: 'max_tokens'
    }]
  });
  if (result.status !== 'skipped' ||
      result.winner !== null ||
      result.runnerUp !== null ||
      result.nextExperiment?.kind !==
        'strategy_generation_shape_recovery' ||
      result.nextExperiment?.missingEvidence?.[0] !==
        'structured_strategy_family_repair' ||
      result.searchSpace?.structuredRepair?.initialIssue !==
        'output_length_truncated' ||
      result.searchSpace?.structuredRepair?.finalIssue !==
        'output_length_truncated' ||
      result.searchSpace?.structuredRepair?.failure !==
        'structured_repair_output_truncated' ||
      result.searchSpace?.familyWrapperCount !== 2 ||
      result.searchSpace?.validStrategyFamilyCount !== 2 ||
      result.gate?.decision !== 'strategy_generation_repair_failed' ||
      result.llm?.strategyGeneratorJudge?.status !== 'incomplete' ||
      result.llm?.strategyFamilyRepair?.status !== 'incomplete' ||
      result.usage?.calls !== 2 ||
      result.usage?.successfulCalls !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `a second parseable length finish was not returned as a cause-matched terminal shape failure: ${JSON.stringify(result)}`
    );
  }
}

async function verifyThrownLengthStructuredRepair() {
  const domain = { ...domains.find((item) => item.name === 'commerce') };
  const ref = 'observation:obs-thrown-length';
  const truncation = new Error(
    'OpenRouter ended structured output at its token limit'
  );
  truncation.openRouterFailureCode =
    'openrouter_truncated_structured_output';
  truncation.openRouterUsage = usage;
  truncation.openRouterDiagnostics = {
    finishReason: 'length',
    nativeFinishReason: 'max_tokens',
    contentByteCount: 8000
  };
  const result = await runDomainRepairSequence({
    domain,
    ref,
    suffix: 'thrown-length-repair',
    responses: [truncation, compactV2Response(domain, ref)],
    diagnostics: [undefined, {
      finishReason: 'stop',
      nativeFinishReason: 'stop'
    }]
  });
  if (result.status !== 'skipped' ||
      result.result?.resultType !== 'technical_recovery' ||
      result.nextExperiment?.kind !==
        'strategy_generation_critic_displaced_by_repair' ||
      result.searchSpace?.commercialCritic?.cause !==
        'commercial_critic_displaced_by_repair' ||
      result.searchSpace?.structuredRepair?.initialIssue !==
        'output_length_truncated' ||
      result.searchSpace?.structuredRepair?.succeeded !== true ||
      result.llm?.strategyGeneratorJudge?.status !== 'failed' ||
      result.llm?.strategyGeneratorJudge?.error !==
        'openrouter_truncated_structured_output' ||
      result.llm?.strategyFamilyRepair?.status !== 'completed' ||
      result.usage?.calls !== 2 ||
      result.usage?.successfulCalls !== 1 ||
      result.winner !== null ||
      result.runnerUp !== null) {
    throw new Error(
      `a hard-rejected length response did not use the one fresh compact repair: ${JSON.stringify(result)}`
    );
  }
}

async function verifyProviderSpendBudgetRecovery() {
  const domain = { ...domains.find((item) => item.name === 'commerce') };
  const ref = 'observation:obs-provider-budget-recovery';

  let noSpendCalls = 0;
  const noSpend = await runDomainRepairSequence({
    domain,
    ref,
    suffix: 'initial-call-budget-preflight',
    responses: [compactV2Response(domain, ref)],
    diagnostics: [undefined],
    budgetOverrides: {
      maxLLMSpendMicros: 4200
    },
    onRequest: () => {
      noSpendCalls += 1;
    }
  });
  if (noSpendCalls !== 0 ||
      noSpend.status !== 'skipped' ||
      noSpend.nextExperiment?.kind !==
        'strategy_generation_budget_recovery' ||
      noSpend.nextExperiment?.missingEvidence?.[0] !==
        'within_budget_strategy_generation' ||
      noSpend.searchSpace?.providerSpendPreflight?.authorized !== false ||
      noSpend.searchSpace?.providerSpendPreflight
        ?.callSpendCeilingMicros <= 4200 ||
      noSpend.searchSpace?.modelCalls !== 0 ||
      Object.keys(noSpend.llm || {}).length !== 0 ||
      noSpend.usage?.calls !== 0 ||
      noSpend.usage?.successfulCalls !== 0 ||
      noSpend.usage?.costReporting !== 'complete' ||
      noSpend.gate?.decision !== 'block' ||
      hasBusinessExperimentField(noSpend.nextExperiment)) {
    throw new Error(
      `a truncated call with no repair spend returned a shape recovery instead of its budget cause: ${JSON.stringify(noSpend)}`
    );
  }

  const invalidProviderCosts = [
    { label: 'omitted', include: false },
    { label: 'string', include: true, value: '0.0042' },
    { label: 'negative', include: true, value: -1 },
    { label: 'null', include: true, value: null },
    { label: 'nan', include: true, value: Number.NaN },
    { label: 'infinity', include: true, value: Number.POSITIVE_INFINITY }
  ];
  for (const invalidCost of invalidProviderCosts) {
    const incomplete = compactV2Response(domain, ref);
    incomplete.seedContract = 'unsupported_seed_contract';
    const initialUsage = { ...usage };
    if (invalidCost.include) {
      initialUsage.cost = invalidCost.value;
    } else {
      delete initialUsage.cost;
    }
    let unreportedCalls = 0;
    const unreported = await runDomainRepairSequence({
      domain,
      ref,
      suffix:
        `invalid-${invalidCost.label}-usage-repair-budget-hard-stop`,
      responses: [incomplete, compactV2Response(domain, ref)],
      diagnostics: [{ finishReason: 'stop' }, { finishReason: 'stop' }],
      usages: [initialUsage, usage],
      budgetOverrides: {
        // This authorizes the initial call, but not a repair after its full
        // conservative ceiling is reserved for invalid cost accounting.
        maxLLMSpendMicros: 250_000
      },
      onRequest: () => {
        unreportedCalls += 1;
      }
    });
    if (unreportedCalls !== 1 ||
        unreported.status !== 'skipped' ||
        unreported.nextExperiment?.kind !==
          'strategy_generation_budget_recovery' ||
        unreported.nextExperiment?.missingEvidence?.[0] !==
          'within_budget_strategy_generation' ||
        unreported.searchSpace?.structuredRepair?.attempted !== false ||
        unreported.searchSpace?.structuredRepair?.succeeded !== false ||
        unreported.searchSpace?.structuredRepair?.initialIssue !==
          'unsupported_seed_contract' ||
        unreported.searchSpace?.structuredRepair?.failure !==
          'repair_budget_unavailable' ||
        unreported.searchSpace?.structuredRepair
          ?.initialCallSpendCeilingMicros <= 0 ||
        unreported.searchSpace?.structuredRepair
          ?.initialFixedRequestFeeCeilingMicros !== 120_000 ||
        unreported.searchSpace?.structuredRepair
          ?.repairCallSpendCeilingMicros <=
            unreported.searchSpace?.structuredRepair
              ?.remainingSpendMicros ||
        unreported.llm?.strategyGeneratorJudge?.status !== 'completed' ||
        unreported.llm?.strategyFamilyRepair !== undefined ||
        unreported.usage?.calls !== 1 ||
        unreported.usage?.successfulCalls !== 1 ||
        unreported.usage?.costReporting !== 'unavailable' ||
        unreported.gate?.decision !== 'block' ||
        hasBusinessExperimentField(unreported.nextExperiment)) {
      throw new Error(
        `${invalidCost.label} provider cost was not conservatively reserved before repair: ${JSON.stringify(unreported)}`
      );
    }
  }

  const incompleteZeroCost = compactV2Response(domain, ref);
  incompleteZeroCost.seedContract = 'unsupported_seed_contract';
  let zeroCostCalls = 0;
  const validZeroCost = await runDomainRepairSequence({
    domain,
    ref,
    suffix: 'valid-zero-cost-allows-bounded-repair',
    responses: [incompleteZeroCost, compactV2Response(domain, ref)],
    diagnostics: [{ finishReason: 'stop' }, { finishReason: 'stop' }],
    usages: [{ ...usage, cost: 0 }, { ...usage, cost: 0 }],
    budgetOverrides: {
      maxLLMSpendMicros: 250_000
    },
    onRequest: () => {
      zeroCostCalls += 1;
    }
  });
  if (zeroCostCalls !== 2 ||
      validZeroCost.status !== 'skipped' ||
      validZeroCost.result?.resultType !== 'technical_recovery' ||
      validZeroCost.nextExperiment?.kind !==
        'strategy_generation_critic_displaced_by_repair' ||
      validZeroCost.searchSpace?.structuredRepair?.attempted !== true ||
      validZeroCost.searchSpace?.structuredRepair?.succeeded !== true ||
      validZeroCost.usage?.calls !== 2 ||
      validZeroCost.usage?.costReporting !== 'complete' ||
      validZeroCost.usage?.reportedCostMicros !== 0) {
    throw new Error(
      `a valid numeric zero provider cost did not authorize the bounded repair: ${JSON.stringify(validZeroCost)}`
    );
  }

  let validSeedCanaryCalls = 0;
  const validSeedCanaryFailure = await runDomainRepairSequence({
    domain,
    ref,
    suffix: 'valid-seed-prompt-token-canary-hard-stop',
    responses: [compactV2Response(domain, ref)],
    diagnostics: [{ finishReason: 'stop' }],
    usages: [{
      ...usage,
      prompt_tokens: 1_000_000,
      total_tokens: 1_000_900,
      cost: 0
    }],
    budgetOverrides: {
      maxLLMCalls: 1,
      maxLLMSpendMicros: 400_000
    },
    onRequest: () => {
      validSeedCanaryCalls += 1;
    }
  });
  if (validSeedCanaryCalls !== 1 ||
      validSeedCanaryFailure.status !== 'skipped' ||
      validSeedCanaryFailure.winner !== null ||
      validSeedCanaryFailure.runnerUp !== null ||
      validSeedCanaryFailure.searchSpace?.structuredRepair?.authorized !==
        false ||
      validSeedCanaryFailure.searchSpace?.structuredRepair?.attempted !==
        false ||
      validSeedCanaryFailure.searchSpace?.structuredRepair?.succeeded !==
        false ||
      validSeedCanaryFailure.searchSpace?.structuredRepair?.initialIssue !==
        '' ||
      validSeedCanaryFailure.searchSpace?.structuredRepair?.finalIssue !==
        '' ||
      validSeedCanaryFailure.searchSpace?.structuredRepair?.failure !==
        'prompt_token_ceiling_exceeded' ||
      validSeedCanaryFailure.searchSpace?.structuredRepair
        ?.initialPromptTokenCanary?.withinCeiling !== false ||
      validSeedCanaryFailure.searchSpace?.structuredRepair
        ?.initialPromptTokenCanary?.reportedPromptTokens !== 1_000_000 ||
      validSeedCanaryFailure.nextExperiment?.kind !==
        'strategy_generation_budget_recovery' ||
      validSeedCanaryFailure.usage?.calls !== 1 ||
      validSeedCanaryFailure.usage?.successfulCalls !== 1 ||
      validSeedCanaryFailure.usage?.costReporting !== 'complete' ||
      validSeedCanaryFailure.usage?.withinBudget !== true ||
      validSeedCanaryFailure.gate?.decision !== 'block') {
    throw new Error(
      `valid strategy families bypassed the initial prompt-token canary: ${JSON.stringify(validSeedCanaryFailure)}`
    );
  }

  const canaryIncomplete = compactV2Response(domain, ref);
  canaryIncomplete.seedContract = 'unsupported_seed_contract';
  let canaryCalls = 0;
  const canaryFailure = await runDomainRepairSequence({
    domain,
    ref,
    suffix: 'prompt-token-canary-hard-stop',
    responses: [canaryIncomplete, compactV2Response(domain, ref)],
    diagnostics: [{ finishReason: 'stop' }, { finishReason: 'stop' }],
    usages: [{
      ...usage,
      prompt_tokens: 1_000_000,
      total_tokens: 1_000_900,
      cost: 0
    }, { ...usage, cost: 0 }],
    budgetOverrides: {
      maxLLMSpendMicros: 400_000
    },
    onRequest: () => {
      canaryCalls += 1;
    }
  });
  if (canaryCalls !== 1 ||
      canaryFailure.status !== 'skipped' ||
      canaryFailure.searchSpace?.structuredRepair?.attempted !== false ||
      canaryFailure.searchSpace?.structuredRepair?.failure !==
        'prompt_token_ceiling_exceeded' ||
      canaryFailure.searchSpace?.structuredRepair
        ?.initialPromptTokenCanary?.withinCeiling !== false ||
      canaryFailure.searchSpace?.structuredRepair
        ?.initialPromptTokenCanary?.reportedPromptTokens !== 1_000_000 ||
      canaryFailure.nextExperiment?.kind !==
        'strategy_generation_budget_recovery' ||
      canaryFailure.usage?.calls !== 1 ||
      canaryFailure.gate?.decision !== 'block') {
    throw new Error(
      `provider prompt-token ceiling drift did not block repair: ${JSON.stringify(canaryFailure)}`
    );
  }

  const repairCanaryIncomplete = compactV2Response(domain, ref);
  repairCanaryIncomplete.seedContract = 'unsupported_seed_contract';
  const repairCanaryInitialUsage = { ...usage };
  delete repairCanaryInitialUsage.cost;
  let repairCanaryCalls = 0;
  const repairCanaryFailure = await runDomainRepairSequence({
    domain,
    ref,
    suffix: 'repair-prompt-token-canary-hard-stop',
    responses: [
      repairCanaryIncomplete,
      compactV2Response(domain, ref)
    ],
    diagnostics: [{ finishReason: 'stop' }, { finishReason: 'stop' }],
    usages: [repairCanaryInitialUsage, {
      ...usage,
      prompt_tokens: 1_000_000,
      total_tokens: 1_000_900,
      cost: 0
    }],
    budgetOverrides: {
      maxLLMSpendMicros: 400_000
    },
    onRequest: () => {
      repairCanaryCalls += 1;
    }
  });
  if (repairCanaryCalls !== 2 ||
      repairCanaryFailure.status !== 'skipped' ||
      repairCanaryFailure.winner !== null ||
      repairCanaryFailure.searchSpace?.structuredRepair?.attempted !==
        true ||
      repairCanaryFailure.searchSpace?.structuredRepair?.succeeded !==
        false ||
      repairCanaryFailure.searchSpace?.structuredRepair?.failure !==
        'repair_prompt_token_ceiling_exceeded' ||
      repairCanaryFailure.searchSpace?.structuredRepair
        ?.repairPromptTokenCanary?.withinCeiling !== false ||
      repairCanaryFailure.searchSpace?.structuredRepair
        ?.repairPromptTokenCanary?.reportedPromptTokens !== 1_000_000 ||
      repairCanaryFailure.nextExperiment?.kind !==
        'strategy_generation_budget_recovery' ||
      repairCanaryFailure.usage?.calls !== 2 ||
      repairCanaryFailure.usage?.successfulCalls !== 2 ||
      repairCanaryFailure.usage?.costReporting !== 'partial' ||
      repairCanaryFailure.usage?.withinBudget !== true ||
      repairCanaryFailure.gate?.decision !== 'block') {
    throw new Error(
      `repair prompt-token ceiling drift did not preserve partial usage and fail closed: ${JSON.stringify(repairCanaryFailure)}`
    );
  }

  const overBudgetIncomplete = compactV2Response(domain, ref);
  overBudgetIncomplete.seedContract = 'unsupported_seed_contract';
  let overBudgetCalls = 0;
  const repairBudgetFailure = await runDomainRepairSequence({
    domain,
    ref,
    suffix: 'repair-reported-budget-precedes-canary',
    responses: [overBudgetIncomplete, compactV2Response(domain, ref)],
    diagnostics: [{ finishReason: 'stop' }, { finishReason: 'stop' }],
    usages: [{ ...usage, cost: 0 }, {
      ...usage,
      prompt_tokens: 1_000_000,
      total_tokens: 1_000_900,
      cost: 0.5
    }],
    budgetOverrides: {
      maxLLMSpendMicros: 400_000
    },
    onRequest: () => {
      overBudgetCalls += 1;
    }
  });
  if (overBudgetCalls !== 2 ||
      repairBudgetFailure.status !== 'skipped' ||
      repairBudgetFailure.winner !== null ||
      repairBudgetFailure.searchSpace?.structuredRepair?.attempted !==
        true ||
      repairBudgetFailure.searchSpace?.structuredRepair?.succeeded !==
        true ||
      repairBudgetFailure.searchSpace?.structuredRepair?.failure !==
        'repair_budget_exceeded' ||
      repairBudgetFailure.searchSpace?.structuredRepair
        ?.repairPromptTokenCanary?.withinCeiling !== false ||
      repairBudgetFailure.nextExperiment?.kind !==
        'strategy_generation_budget_recovery' ||
      repairBudgetFailure.usage?.calls !== 2 ||
      repairBudgetFailure.usage?.successfulCalls !== 2 ||
      repairBudgetFailure.usage?.costReporting !== 'complete' ||
      repairBudgetFailure.usage?.reportedCostMicros !== 500_000 ||
      repairBudgetFailure.usage?.withinBudget !== false ||
      repairBudgetFailure.gate?.decision !== 'block') {
    throw new Error(
      `reported repair spend did not take precedence over simultaneous canary drift: ${JSON.stringify(repairBudgetFailure)}`
    );
  }

  const circularProvider = {
    max_price: { prompt: 0.4, completion: 1.6, request: 0.12 }
  };
  circularProvider.circular = circularProvider;
  const serializationFailureCeiling = providerCallSpendCeilingMicros({
    model: 'test/v2',
    system: 'bounded system prompt',
    user: 'bounded user prompt',
    maxTokens: 8_000,
    temperature: 0,
    provider: circularProvider
  }, {
    maxLLMSpendMicros: 400_000,
    providerMaxPrice: {
      prompt: 0.4,
      completion: 1.6,
      request: 0.12
    }
  });
  if (serializationFailureCeiling !== 400_001) {
    throw new Error(
      `request serialization failure did not fail over budget: ${serializationFailureCeiling}`
    );
  }
}

async function verifyMaximumTournamentSpendCeiling() {
  const domain = { ...domains.find((item) => item.name === 'commerce') };
  const ref = 'observation:obs-max-0';
  const sourceId = 'src-maximum-tournament';
  const website = 'https://commerce.example/';
  const oversizedOriginURL =
    `https://${Array.from({ length: 4 }, (_, index) =>
      `${String.fromCharCode(97 + index)}${'x'.repeat(59)}`
    ).join('.')}.com/offer`;
  const sourceEvidence = Array.from({ length: 80 }, (_, index) => ({
    observationId: `obs-max-${index}`,
    sourceId,
    kind: index === 0 ? 'service-page' : 'case-study',
    title: index === 0
      ? domain.destination
      : `Evidence ${index} ${'T'.repeat(180)}`,
    summary: index === 0
      ? `${domain.sourceSummary} ${'S'.repeat(80)} ` +
        'TAIL_PROOF paid checkout; attribution source field records organic-search UTM.'
      : `Current source-backed commercial case study ${index} ${
          'S'.repeat(420)
        }`,
    url: index === 0
      ? `${website}offer?campaign=${'q'.repeat(96)}#checkout`
      : index === 1
        ? oversizedOriginURL
      : `${website}case-study/${index}/${'u'.repeat(96)}`,
    observedAt: '2026-07-29T12:00:00Z',
    confidence: 'high'
  }));
  const initial = compactV2Response(domain, ref);
  initial.seedContract = 'unsupported_seed_contract';
  const requests = [];
  const result = await runDomainRepairSequence({
    domain,
    ref,
    suffix: 'maximum-legal-tournament-spend-ceiling',
    responses: [initial, compactV2Response(domain, ref)],
    diagnostics: [{ finishReason: 'stop' }, { finishReason: 'stop' }],
    usages: [usage, usage],
    evidenceSnapshot: {
      profile: {
        identity: { website }
      },
      sources: [{
        id: sourceId,
        url: website,
        status: 'monitoring',
        trustLevel: 'high'
      }],
      sourceEvidence
    },
    budgetOverrides: {
      maxHypotheses: 10_000,
      maxFinalists: 20,
      maxLLMCalls: 2,
      maxOutputTokens: 10_000,
      maxLLMSpendMicros: 400_000
    },
    onRequest: (request) => requests.push(request)
  });
  const initialTask = JSON.parse(requests[0]?.user || '{}');
  const repairTask = JSON.parse(requests[1]?.user || '{}');
  const initialPromptIDs = (initialTask.evidenceCatalog || [])
    .map((item) => item.id);
  const repairPromptIDs = (repairTask.evidenceCatalog || [])
    .map((item) => item.id);
  const initialSchemaObject =
    requests[0]?.responseFormat?.json_schema?.schema || {};
  const repairSchemaObject =
    requests[1]?.responseFormat?.json_schema?.schema || {};
  const expectedSchemaEvidenceIDs = initialPromptIDs;
  const initialSchemaEvidenceIDs =
    initialSchemaObject.$defs?.evidenceRef?.enum || [];
  const repairSchemaEvidenceIDs =
    repairSchemaObject.$defs?.evidenceRef?.enum || [];
  const boundedPromptFields = (initialTask.evidenceCatalog || [])
    .every((item) =>
      (item.type || '').length <= 64 &&
      (item.label || '').length <= 160 &&
      (item.summary || '').length <= 320 &&
      (item.url || '').length <= 240 &&
      (item.approvedSourceUrl || '').length <= 240 &&
      (item.sourceId || '').length <= 96 &&
      (item.status || '').length <= 64 &&
      (item.confidence || '').length <= 16 &&
      (item.observedAt || '').length <= 40 &&
      (item.publishedAt || '').length <= 40 &&
      (item.startDate || '').length <= 40 &&
      (item.endDate || '').length <= 40
    );
  const compactPaidAsset = (initialTask.evidenceCatalog || [])
    .find((item) => item.id === ref);
  const budget = {
    maxLLMSpendMicros: 400_000,
    providerMaxPrice: {
      prompt: 0.4,
      completion: 1.6,
      request: 0.12
    }
  };
  const serializedInitial = serializeOpenRouterJSONRequestBody(
    requests[0]
  );
  const serializedRepair = serializeOpenRouterJSONRequestBody(
    requests[1]
  );
  const initialBytes = Buffer.byteLength(serializedInitial, 'utf8');
  const repairBytes = Buffer.byteLength(serializedRepair, 'utf8');
  const initialSchema = JSON.stringify(
    initialSchemaObject
  );
  const initialSchemaBytes = Buffer.byteLength(initialSchema, 'utf8');
  const initialCeiling = providerCallSpendCeilingMicros(
    requests[0],
    budget
  );
  const repairCeiling = providerCallSpendCeilingMicros(
    requests[1],
    budget
  );
  const repairTrace = result.searchSpace?.structuredRepair || {};
  if (requests.length !== 2 ||
      result.status !== 'skipped' ||
      result.result?.resultType !== 'technical_recovery' ||
      result.searchSpace?.commercialCritic?.cause !==
        'commercial_critic_displaced_by_repair' ||
      result.searchSpace?.evidenceCatalogCount !== 64 ||
      result.searchSpace?.promptEvidenceCount !== 16 ||
      result.searchSpace?.promptEvidenceOmittedCount !== 48 ||
      !result.searchSpace?.promptEvidenceHash ||
      initialTask.evidenceCatalog?.length !== 16 ||
      repairTask.evidenceCatalog?.length !== 16 ||
      initialPromptIDs.some((id) => /^source:/i.test(id)) ||
      initialPromptIDs[0] !== ref ||
      JSON.stringify(initialPromptIDs) !==
        JSON.stringify(repairPromptIDs) ||
      JSON.stringify(initialSchemaEvidenceIDs) !==
        JSON.stringify(expectedSchemaEvidenceIDs) ||
      JSON.stringify(repairSchemaEvidenceIDs) !==
        JSON.stringify(expectedSchemaEvidenceIDs) ||
      !boundedPromptFields ||
      compactPaidAsset?.revenueAssetRole !==
        'current_owner_paid_conversion_asset' ||
      !compactPaidAsset?.summary?.includes('TAIL_PROOF') ||
      compactPaidAsset?.url !== `${website}offer` ||
      initialTask.evidenceCatalog?.find(
        (item) => item.id === 'observation:obs-max-1'
      )?.url ||
      requests[0]?.maxTokens !== 10_000 ||
      requests[1]?.maxTokens !== 4_000 ||
      repairTrace.initialFixedRequestFeeCeilingMicros !== 120_000 ||
      repairTrace.repairFixedRequestFeeCeilingMicros !== 120_000 ||
      repairTrace.initialCallSpendCeilingMicros !== initialCeiling ||
      repairTrace.repairCallSpendCeilingMicros !== repairCeiling ||
      repairTrace.initialPromptTokenCanary?.requestBodyByteCount !==
        initialBytes ||
      repairTrace.initialPromptTokenCanary?.promptTokenCeiling !==
        initialBytes + 1_024 ||
      repairTrace.initialPromptTokenCanary?.withinCeiling !== true ||
      repairTrace.repairRequestBodyByteCount !== repairBytes ||
      repairTrace.repairPromptTokenCeiling !== repairBytes + 1_024 ||
      repairTrace.repairPromptTokenCanary?.requestBodyByteCount !==
        repairBytes ||
      repairTrace.repairPromptTokenCanary?.withinCeiling !== true ||
      initialSchemaBytes > 8_000 ||
      initialBytes > 36 * 1_024 ||
      repairBytes > 36 * 1_024 ||
      initialSchema.includes('"pattern"') ||
      initialSchema.includes('"description"') ||
      initialCeiling + repairCeiling > 400_000) {
    throw new Error(
      `maximum legal tournament did not fit the exact two-call hard ceiling: ${JSON.stringify({
        status: result.status,
        evidenceCount: initialTask.evidenceCatalog?.length,
        initialPromptIDs,
        repairPromptIDs,
        initialSchemaEvidenceIDs,
        repairSchemaEvidenceIDs,
        compactPaidAsset,
        searchSpace: result.searchSpace,
        requestCount: requests.length,
        initialBytes,
        repairBytes,
        initialSchemaBytes,
        initialCeiling,
        repairCeiling,
        totalCeiling: initialCeiling + repairCeiling,
        repairTrace
      })}`
    );
  }
}

async function verifyPromptEnvelopeFailsLocally() {
  const domain = { ...domains.find((item) => item.name === 'commerce') };
  const sourceID = 'src-local-prompt-envelope';
  const oversizedObservationID = `obs-envelope-${'x'.repeat(48_000)}`;
  let providerCalls = 0;
  const result = await runOpportunityTournament({
    job: {
      id: 'job-local-prompt-envelope',
      payload: {
        tournamentId: 'tournament-local-prompt-envelope',
        researchOnly: true,
        objective: {
          outcome: `Generate one new attributed ${domain.outcome}.`,
          successMetric: domain.outcome
        },
        budget: {
          maxHypotheses: 128,
          maxFinalists: 8,
          maxLLMCalls: 2,
          maxOutputTokens: 8_000,
          hardStop: false
        },
        evidenceSnapshot: {
          profile: {
            identity: {
              website: 'https://prompt-envelope.example/'
            }
          },
          sources: [{
            id: sourceID,
            url: 'https://prompt-envelope.example/',
            status: 'monitoring',
            trustLevel: 'high'
          }],
          sourceEvidence: [{
            observationId: oversizedObservationID,
            sourceId: sourceID,
            kind: 'service-page',
            title: domain.destination,
            summary: domain.sourceSummary,
            url: 'https://prompt-envelope.example/offer',
            observedAt: '2026-07-29T12:00:00Z',
            confidence: 'high'
          }]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async () => {
      providerCalls += 1;
      return {
        data: compactV2Response(
          domain,
          `observation:${oversizedObservationID}`
        ),
        usage
      };
    }
  });
  const experiment = result.nextExperiment || {};
  const envelope = result.searchSpace?.providerPromptEnvelope || {};
  const sideEffects = result.gate?.sideEffects || {};
  if (providerCalls !== 0 ||
      result.status !== 'skipped' ||
      result.usage?.calls !== 0 ||
      result.searchSpace?.modelCalls !== 0 ||
      envelope.authorized !== false ||
      envelope.cause !== 'bounded_prompt_envelope' ||
      envelope.requestBodyByteCount <= 36 * 1_024 ||
      envelope.maxRequestBodyByteCount !== 36 * 1_024 ||
      experiment.kind !==
        'strategy_generation_prompt_envelope_recovery' ||
      !/internal provider prompt envelope/i.test(
        experiment.rerunPolicy?.trigger || ''
      ) ||
      /provider (?:is|was) (?:unhealthy|down)/i.test(
        `${experiment.title} ${experiment.action}`
      ) ||
      hasBusinessExperimentField(experiment) ||
      result.gate?.decision !== 'block' ||
      sideEffects.outreachAttempts !== 0 ||
      sideEffects.publishAttempts !== 0 ||
      sideEffects.providerWrites !== 0) {
    throw new Error(
      `oversized local prompt did not fail before provider spend with a cause-matched recovery: ${JSON.stringify({
        providerCalls,
        result
      })}`
    );
  }
}

async function verifyOmittedProviderEvidenceFailsClosed() {
  const domain = { ...domains.find((item) => item.name === 'commerce') };
  const sourceID = 'src-omitted-provider-evidence';
  const website = 'https://omitted-evidence.example/';
  const candidateLabel = 'Signal Partner Company';
  const compactHiddenRole = 'Secret Revenue Director';
  const compactHiddenMarket = 'Secret Moon Market';
  const sourceEvidence = Array.from({ length: 80 }, (_, index) => ({
    observationId: `obs-omitted-provider-${index}`,
    sourceId: sourceID,
    kind: index === 0 ? 'service-page' : 'case-study',
    title: index === 0
      ? domain.destination
      : `Commercial evidence ${index}`,
    summary: index === 0
      ? `${domain.sourceSummary} ${candidateLabel} is named in the approved directory.`
      : index === 1
        ? `${candidateLabel} is named here. ${'A'.repeat(200)} ${
            compactHiddenRole
          }; ${compactHiddenMarket}. ${'B'.repeat(130)} End of visible context.`
      : `Qualified buyers at ${candidateLabel} are listed as Hidden Revenue Role ${index} in Hidden Market ${index}.`,
    url: index === 0
      ? `${website}offer`
      : `${website}proof/${index}`,
    observedAt: '2026-07-29T12:00:00Z',
    confidence: 'high'
  }));
  const payload = {
    tournamentId: 'tournament-omitted-provider-evidence',
    researchOnly: true,
    objective: {
      outcome: `Generate one new attributed ${domain.outcome}.`,
      successMetric: domain.outcome
    },
    budget: {
      maxHypotheses: 128,
      maxFinalists: 8,
      maxLLMCalls: 1,
      maxOutputTokens: 8_000
    },
    evidenceSnapshot: {
      profile: {
        identity: { website }
      },
      sources: [{
        id: sourceID,
        url: website,
        status: 'monitoring',
        trustLevel: 'high'
      }],
      sourceEvidence
    }
  };
  const localEvidence = buildEvidenceCatalog(payload, {}, now);
  let promptIDs = [];
  let omittedRef = '';
  const result = await runOpportunityTournament({
    job: {
      id: 'job-omitted-provider-evidence',
      payload
    },
    model: 'test/v2',
    now,
    completeJSON: async (request) => {
      promptIDs = (JSON.parse(request.user).evidenceCatalog || [])
        .map((item) => item.id);
      omittedRef = localEvidence
        .map((item) => item.id)
        .find((id) =>
          /^observation:/i.test(id) && !promptIDs.includes(id)
        ) || '';
      return {
        data: compactV2Response(domain, omittedRef),
        usage,
        diagnostics: { finishReason: 'stop' }
      };
    }
  });
  const experiment = result.nextExperiment || {};
  const sideEffects = result.gate?.sideEffects || {};
  const omittedGraphNode = result.commercialEvidenceGraph?.nodes?.find(
    (node) => node.evidenceRef === omittedRef
  );
  if (localEvidence.length !== 64 ||
      promptIDs.length !== 16 ||
      !omittedRef ||
      !localEvidence.some((item) => item.id === omittedRef) ||
      promptIDs.includes(omittedRef) ||
      !omittedGraphNode ||
      !omittedGraphNode.roles?.includes('defined_buyer') ||
      result.status !== 'skipped' ||
      result.winner !== null ||
      result.hypotheses?.length !== 0 ||
      result.searchSpace?.completeStrategyFamilyCount !== 0 ||
      result.searchSpace?.modelCalls !== 1 ||
      result.usage?.calls !== 1 ||
      experiment.kind !== 'strategy_generation_shape_recovery' ||
      hasBusinessExperimentField(experiment) ||
      result.gate?.decision !== 'strategy_generation_incomplete' ||
      sideEffects.outreachAttempts !== 0 ||
      sideEffects.publishAttempts !== 0 ||
      sideEffects.providerWrites !== 0) {
    throw new Error(
      `provider-omitted local evidence was not rejected at the normalization boundary: ${JSON.stringify({
        localEvidenceCount: localEvidence.length,
        promptIDs,
        omittedRef,
        result
      })}`
    );
  }

  let candidatePromptIDs = [];
  let candidateIncludedRef = '';
  const candidatePayload = {
    ...payload,
    budget: {
      ...payload.budget,
      maxLLMCalls: 2
    }
  };
  const omittedIndex = omittedRef.match(/(\d+)$/)?.[1] || '';
  const hiddenRole = `Hidden Revenue Role ${omittedIndex}`;
  const hiddenMarket = `Hidden Market ${omittedIndex}`;
  const candidateResult = await runOpportunityTournament({
    job: {
      id: 'job-omitted-provider-candidate-evidence',
      payload: {
        ...candidatePayload,
        tournamentId:
          'tournament-omitted-provider-candidate-evidence'
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async (request) => {
      if (request.responseFormat?.json_schema?.name ===
          'opportunity_tournament_critic_v1') {
        return completionWithCritic(null, 'gen-omitted-candidate')(
          request
        );
      }
      candidatePromptIDs = (
        JSON.parse(request.user).evidenceCatalog || []
      ).map((item) => item.id);
      candidateIncludedRef = candidatePromptIDs.find((id) =>
        /^observation:/i.test(id)
      ) || '';
      const response = compactV2Response(
        domain,
        candidateIncludedRef
      );
      response.familyA.d.b[0].l =
        `${candidateLabel} home-office buying team`;
      response.familyB.d.b[0].l =
        `${candidateLabel} home-office buying team`;
      response.candidates = [{
        k: 'organization',
        l: candidateLabel,
        o: candidateLabel,
        r: hiddenRole,
        m: hiddenMarket,
        e: [omittedRef, candidateIncludedRef]
      }];
      return {
        data: response,
        usage,
        diagnostics: { finishReason: 'stop' }
      };
    }
  });
  const modelCandidate = candidateResult.candidates?.find(
    (candidate) =>
      candidate.displayLabel === candidateLabel &&
      candidate.providers?.includes(
        'openrouter_evidence_extraction'
      )
  );
  if (!candidateIncludedRef ||
      candidatePromptIDs.includes(omittedRef) ||
      !modelCandidate ||
      modelCandidate.role ||
      modelCandidate.market ||
      modelCandidate.evidenceRefs?.includes(omittedRef) ||
      JSON.stringify(modelCandidate.evidenceRefs) !==
        JSON.stringify([candidateIncludedRef])) {
    throw new Error(
      `provider-omitted candidate fields leaked through the full local evidence catalog: ${JSON.stringify({
        omittedRef,
        candidateIncludedRef,
        candidatePromptIDs,
        modelCandidate,
        candidateResult
      })}`
    );
  }

  const compactHiddenRef =
    'observation:obs-omitted-provider-1';
  let compactCandidatePromptEvidence = [];
  const compactCandidateResult = await runOpportunityTournament({
    job: {
      id: 'job-compact-provider-candidate-evidence',
      payload: {
        ...candidatePayload,
        tournamentId:
          'tournament-compact-provider-candidate-evidence'
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async (request) => {
      if (request.responseFormat?.json_schema?.name ===
          'opportunity_tournament_critic_v1') {
        return completionWithCritic(null, 'gen-compact-candidate')(
          request
        );
      }
      compactCandidatePromptEvidence =
        JSON.parse(request.user).evidenceCatalog || [];
      const response = compactV2Response(
        domain,
        candidateIncludedRef
      );
      response.familyA.d.b[0].l =
        `${candidateLabel} home-office buying team`;
      response.familyB.d.b[0].l =
        `${candidateLabel} home-office buying team`;
      response.candidates = [{
        k: 'organization',
        l: candidateLabel,
        o: candidateLabel,
        r: compactHiddenRole,
        m: compactHiddenMarket,
        e: [compactHiddenRef, candidateIncludedRef]
      }];
      return {
        data: response,
        usage,
        diagnostics: { finishReason: 'stop' }
      };
    }
  });
  const compactModelCandidate =
    compactCandidateResult.candidates?.find(
      (candidate) =>
        candidate.displayLabel === candidateLabel &&
        candidate.providers?.includes(
          'openrouter_evidence_extraction'
        )
    );
  const compactHiddenEvidence =
    compactCandidatePromptEvidence.find(
      (item) => item.id === compactHiddenRef
    );
  const compactRoleVisible =
    compactHiddenEvidence?.summary?.includes(compactHiddenRole) ===
      true;
  const compactMarketVisible =
    compactHiddenEvidence?.summary?.includes(compactHiddenMarket) ===
      true;
  if (!compactHiddenEvidence ||
      !compactModelCandidate ||
      compactModelCandidate.role !==
        (compactRoleVisible ? compactHiddenRole : '') ||
      compactModelCandidate.market !==
        (compactMarketVisible ? compactHiddenMarket : '') ||
      !compactModelCandidate.evidenceRefs?.includes(
        compactHiddenRef
      ) ||
      !compactModelCandidate.evidenceRefs?.includes(
        candidateIncludedRef
      )) {
    throw new Error(
      `candidate fields hidden by the provider projection leaked from the full local record: ${JSON.stringify({
        compactHiddenEvidence,
        compactModelCandidate,
        compactCandidateResult
      })}`
    );
  }
}

async function verifyProviderSchemaEvidenceParity() {
  const domain = { ...domains.find((item) => item.name === 'commerce') };
  const sourceID = 'src-provider-schema-parity';
  const website = 'https://schema-parity.example/';
  const observationRef = 'observation:obs-provider-schema-parity';
  const evidenceSnapshot = {
    profile: {
      identity: { website }
    },
    sources: [{
      id: sourceID,
      label: 'Schema parity source',
      url: website,
      status: 'monitoring',
      trustLevel: 'high'
    }],
    sourceEvidence: [{
      observationId: 'obs-provider-schema-parity',
      sourceId: sourceID,
      kind: 'service-page',
      title: domain.destination,
      summary: domain.sourceSummary,
      url: `${website}offer`,
      observedAt: '2026-07-29T12:00:00Z',
      confidence: 'high'
    }]
  };
  for (const invalidRef of [
    `source:${sourceID}`,
    `${website}offer`
  ]) {
    let request;
    const result = await runDomainRepairSequence({
      domain,
      ref: observationRef,
      suffix:
        `provider-schema-parity-${
          invalidRef.startsWith('source:') ? 'source' : 'url'
        }`,
      responses: [compactV2Response(domain, invalidRef)],
      diagnostics: [{ finishReason: 'stop' }],
      usages: [usage],
      evidenceSnapshot,
      budgetOverrides: {
        maxLLMCalls: 1
      },
      onRequest: (value) => {
        request = value;
      }
    });
    const promptEvidence = JSON.parse(
      request?.user || '{}'
    ).evidenceCatalog || [];
    const promptIDs = promptEvidence.map((item) => item.id);
    const schemaIDs =
      request?.responseFormat?.json_schema?.schema
        ?.$defs?.evidenceRef?.enum || [];
    const experiment = result.nextExperiment || {};
    const invalidRefIsVisible = invalidRef.startsWith('source:')
      ? promptIDs.includes(invalidRef)
      : promptEvidence.some((item) => item.url === invalidRef);
    const invalidRefShouldBeVisible =
      !invalidRef.startsWith('source:');
    if (invalidRefIsVisible !== invalidRefShouldBeVisible ||
        schemaIDs.includes(invalidRef) ||
        !schemaIDs.includes(observationRef) ||
        result.status !== 'skipped' ||
        result.searchSpace?.completeStrategyFamilyCount !== 0 ||
        result.searchSpace?.modelCalls !== 1 ||
        result.usage?.calls !== 1 ||
        result.winner !== null ||
        experiment.kind !== 'strategy_generation_shape_recovery' ||
        hasBusinessExperimentField(experiment) ||
        result.gate?.decision !== 'strategy_generation_incomplete') {
      throw new Error(
        `local evidence normalization accepted a provider reference forbidden by the strict schema: ${JSON.stringify({
          invalidRef,
          promptEvidence,
          schemaIDs,
          result
        })}`
      );
    }
  }
}

async function verifyQueryScopedOwnedAssetPreserved() {
  const ref = 'observation:obs-query-scoped-booking';
  const decoyRef = 'observation:obs-retailer-product-contact';
  const sourceID = 'src-query-scoped-booking';
  const decoySourceID = 'src-retailer-product-contact';
  const bookingURL =
    'https://booking.example/schedule?provider=betty&service=lactation';
  const redactedBookingURL = 'https://booking.example/schedule';
  const decoyURL =
    'https://retailer.example/products/desk-organizer?checkout=retailer';
  const redactedDecoyURL =
    'https://retailer.example/products/desk-organizer';
  const decoySummary =
    'Retailers can ask about this paid product through the product page contact. ' +
    'Product specification context. '.repeat(6) +
    'Additional details are available for this paid product. ' +
    'Fulfillment and catalog context. '.repeat(6);
  const domain = {
    name: 'query-scoped-booking',
    buyer: 'New parents seeking lactation support',
    offer: 'A paid lactation consultation',
    destination: 'Provider-specific lactation booking page',
    mechanism: 'paid_booking',
    outcome: 'One paid booking recorded',
    attributionMethod: 'booking_record',
    attribution:
      'Booking record source field stores the organic-search campaign',
    sourceSummary:
      'New parents can purchase a paid lactation consultation through the provider-specific booking page. The booking record source field stores the organic-search campaign.',
    fullyGrounded: false
  };
  let promptEvidence = [];
  const result = await runOpportunityTournament({
    job: {
      id: 'job-query-scoped-booking',
      payload: {
        tournamentId: 'tournament-query-scoped-booking',
        researchOnly: true,
        objective: {
          outcome:
            'Generate one new attributed paid lactation consultation.',
          successMetric:
            'One paid consultation booking with a stored acquisition source.'
        },
        budget: {
          maxHypotheses: 128,
          maxFinalists: 8,
          maxLLMCalls: 1,
          maxOutputTokens: 8_000
        },
        evidenceSnapshot: {
          profile: {
            identity: {
              bookingUrl: bookingURL,
              website: decoyURL
            }
          },
          sources: [{
            id: sourceID,
            kind: 'booking',
            label: 'Provider-specific lactation booking',
            url: bookingURL,
            status: 'monitoring',
            trustLevel: 'high'
          }, {
            id: decoySourceID,
            kind: 'website',
            label: 'Retailer product contact',
            url: decoyURL,
            status: 'monitoring',
            trustLevel: 'high'
          }],
          sourceEvidence: [{
            observationId: 'obs-query-scoped-booking',
            sourceId: sourceID,
            kind: 'booking-page',
            title: domain.destination,
            summary: domain.sourceSummary,
            url: bookingURL,
            observedAt: '2026-07-29T12:00:00Z',
            current: true,
            confidence: 'high'
          }, {
            observationId: 'obs-retailer-product-contact',
            sourceId: decoySourceID,
            kind: 'product-page',
            title: 'Paid product page contact for retailers',
            summary: decoySummary,
            url: decoyURL,
            observedAt: '2026-07-29T12:00:00Z',
            current: true,
            confidence: 'high'
          }]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async (request) => {
      promptEvidence =
        JSON.parse(request.user).evidenceCatalog || [];
      const response = strictV2Response(domain, ref);
      response.evidenceExperiment.e = [decoyRef, ref];
      response.familyA.d.revenuePaths[0].observableRevenueOutcome =
        'One consultation inquiry recorded';
      response.familyB.d.revenuePaths[0].observableRevenueOutcome =
        'One consultation inquiry recorded';
      return {
        data: response,
        usage,
        diagnostics: { finishReason: 'stop' }
      };
    }
  });
  const projectedAsset = promptEvidence.find(
    (item) => item.id === ref
  );
  const projectedDecoy = promptEvidence.find(
    (item) => item.id === decoyRef
  );
  const experiment = result.nextExperiment || {};
  const sideEffects = result.gate?.sideEffects || {};
  if (!projectedAsset ||
      !projectedDecoy ||
      projectedDecoy.url !== redactedDecoyURL ||
      projectedAsset.url !== redactedBookingURL ||
      projectedAsset.approvedSourceUrl !== redactedBookingURL ||
      projectedAsset.revenueAssetRole !==
        'current_owner_paid_conversion_asset' ||
      result.status !== 'skipped' ||
      experiment.kind !== 'inbound_revenue_evidence' ||
      experiment.asset?.publicUrl !== bookingURL ||
      JSON.stringify(experiment.evidenceRefs) !==
        JSON.stringify([ref]) ||
      experiment.noGroundedPath !== true ||
      result.result?.resultContract !==
        'opportunity_tournament_result_v2' ||
      result.result?.resultType !== 'no_grounded_path' ||
      result.result?.recommendedAction !== experiment.action ||
      result.result?.allowedChannel !== 'none' ||
      result.result?.executionAuthorization !== 'none' ||
      result.result?.permissionRequired !==
        'explicit_user_approval' ||
      result.result?.sideEffectsPerformed !== 0 ||
      Object.prototype.hasOwnProperty.call(
        experiment,
        'assetEvidenceRef'
      ) ||
      !completeBusinessExperimentFields(experiment) ||
      result.gate?.decision !== 'needs_more_approved_evidence' ||
      sideEffects.outreachAttempts !== 0 ||
      sideEffects.publishAttempts !== 0 ||
      sideEffects.providerWrites !== 0 ||
      sideEffects.pdlCalls !== 0) {
    throw new Error(
      `query-scoped owned asset was broadened or lost after provider-safe URL projection: ${JSON.stringify({
        projectedAsset,
        projectedDecoy,
        experiment,
        result
      })}`
    );
  }
}

async function verifySummaryCompactionPreservesRevenueTokens() {
  const ref = 'observation:obs-summary-splice-paid-offer';
  const sourceID = 'src-summary-splice-paid-offer';
  const website = 'https://summary-splice.example/';
  const lead =
    'Engineering leaders seeking architecture advice arrive through organic search at the Architecture consultation booking page. ';
  const paidTokenIndex = 194;
  const paddingLength = paidTokenIndex - lead.length - 1;
  if (paddingLength < 1) {
    throw new Error('summary-splice fixture lead exceeded its target');
  }
  const sourceSummary =
    `${lead}${'x'.repeat(paddingLength)} ` +
    'paid architecture consultation is available to qualified buyers. ' +
    'Booking record source field stores the organic-search UTM campaign. ' +
    'Current offer details remain available for qualified buyers.';
  if (sourceSummary.indexOf('paid') !== paidTokenIndex ||
      sourceSummary.length <= 320 ||
      sourceSummary.length > 420) {
    throw new Error(
      `summary-splice fixture missed the former cut boundary: ${JSON.stringify({
        paidTokenIndex: sourceSummary.indexOf('paid'),
        summaryLength: sourceSummary.length
      })}`
    );
  }
  const domain = {
    name: 'summary-splice',
    buyer: 'Engineering leaders seeking architecture advice',
    offer: 'A paid architecture consultation',
    destination: 'Architecture consultation booking page',
    mechanism: 'paid_booking',
    outcome: 'One paid booking recorded',
    attributionMethod: 'booking_record',
    attribution:
      'Booking record source field stores the organic-search UTM campaign',
    sourceSummary
  };
  let projectedSummary = '';
  const result = await runOpportunityTournament({
    job: {
      id: 'job-summary-splice-paid-offer',
      payload: {
        researchOnly: true,
        objective: {
          outcome:
            'Generate one new attributed paid architecture consultation.',
          successMetric:
            'One paid booking with an organic-search source field.'
        },
        budget: {
          maxHypotheses: 128,
          maxLLMCalls: 2,
          maxOutputTokens: 8_000
        },
        commercialContext: {
          allowedChannels: ['organic search']
        },
        evidenceSnapshot: {
          profile: {
            identity: { website }
          },
          sources: [{
            id: sourceID,
            kind: 'website',
            label: 'Architecture consultation site',
            url: website,
            status: 'monitoring',
            trustLevel: 'high'
          }],
          sourceEvidence: [{
            observationId: 'obs-summary-splice-paid-offer',
            sourceId: sourceID,
            kind: 'service-page',
            title: domain.destination,
            summary: sourceSummary,
            url: `${website}offer`,
            observedAt: '2026-07-29T12:00:00Z',
            current: true,
            confidence: 'high'
          }]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async (request) => {
      if (request.responseFormat?.json_schema?.name !==
          'opportunity_tournament_critic_v1') {
        projectedSummary = (
          JSON.parse(request.user).evidenceCatalog || []
        ).find((item) => item.id === ref)?.summary || '';
      }
      return completionWithCritic(
        strictV2Response(domain, ref),
        'gen-summary-splice'
      )(request);
    }
  });
  const sideEffects = result.gate?.sideEffects || {};
  if (projectedSummary.length > 320 ||
      !/\bpaid\b/.test(projectedSummary) ||
      /\bpa\s*…|…\s*id\b/.test(projectedSummary) ||
      result.status !== 'completed' ||
      result.searchSpace?.eligibleCount !== 2 ||
      !result.winner ||
      !result.runnerUp ||
      sideEffects.outreachAttempts !== 0 ||
      sideEffects.publishAttempts !== 0 ||
      sideEffects.providerWrites !== 0) {
    throw new Error(
      `token-safe evidence compaction changed a grounded paid result: ${JSON.stringify({
        projectedSummary,
        result
      })}`
    );
  }

  for (const buyerCase of [{
    name: 'healthcare-buyer',
    buyer: 'Patients seeking lactation support',
    offer: 'A paid lactation consultation',
    destination: 'Lactation consultation booking page'
  }, {
    name: 'engineering-buyer',
    buyer: 'Engineering leaders seeking architecture advice',
    offer: 'A paid architecture consultation',
    destination: 'Architecture consultation booking page'
  }]) {
    const buyerRef =
      `observation:obs-summary-splice-${buyerCase.name}`;
    const buyerSourceID =
      `src-summary-splice-${buyerCase.name}`;
    const buyerWebsite =
      `https://${buyerCase.name}.summary-splice.example/`;
    const buyerLead =
      `Qualified buyers arrive through organic search at the ${
        buyerCase.destination
      }, where ${buyerCase.offer} can be booked. `;
    const buyerTokenIndex = 194;
    const buyerPaddingLength =
      buyerTokenIndex - buyerLead.length - 1;
    if (buyerPaddingLength < 1) {
      throw new Error(
        `${buyerCase.name} summary-splice lead exceeded its target`
      );
    }
    const buyerSummary =
      `${buyerLead}${'x'.repeat(buyerPaddingLength)} ` +
      `${buyerCase.buyer} use this current service. ` +
      'Booking record source field stores the organic-search UTM campaign. ' +
      'Current offer details remain available for qualified buyers.';
    const buyerDomain = {
      name: buyerCase.name,
      buyer: buyerCase.buyer,
      offer: buyerCase.offer,
      destination: buyerCase.destination,
      mechanism: 'paid_booking',
      outcome: 'One paid booking recorded',
      attributionMethod: 'booking_record',
      attribution:
        'Booking record source field stores the organic-search UTM campaign',
      sourceSummary: buyerSummary
    };
    let projectedBuyerSummary = '';
    const buyerResult = await runOpportunityTournament({
      job: {
        id: `job-summary-splice-${buyerCase.name}`,
        payload: {
          researchOnly: true,
          objective: {
            outcome:
              `Generate one new attributed ${buyerCase.offer} for ${buyerCase.buyer}.`,
            successMetric:
              'One paid booking with an organic-search source field.'
          },
          budget: {
            maxHypotheses: 128,
            maxLLMCalls: 2,
            maxOutputTokens: 8_000
          },
          commercialContext: {
            allowedChannels: ['organic search']
          },
          evidenceSnapshot: {
            profile: {
              identity: { website: buyerWebsite }
            },
            sources: [{
              id: buyerSourceID,
              kind: 'website',
              label: `${buyerCase.name} consultation site`,
              url: buyerWebsite,
              status: 'monitoring',
              trustLevel: 'high'
            }],
            sourceEvidence: [{
              observationId:
                `obs-summary-splice-${buyerCase.name}`,
              sourceId: buyerSourceID,
              kind: 'service-page',
              title: buyerCase.destination,
              summary: buyerSummary,
              url: `${buyerWebsite}offer`,
              observedAt: '2026-07-29T12:00:00Z',
              current: true,
              confidence: 'high'
            }]
          }
        }
      },
      model: 'test/v2',
      now,
      completeJSON: async (request) => {
        if (request.responseFormat?.json_schema?.name !==
            'opportunity_tournament_critic_v1') {
          projectedBuyerSummary = (
            JSON.parse(request.user).evidenceCatalog || []
          ).find((item) => item.id === buyerRef)?.summary || '';
        }
        return completionWithCritic(
          strictV2Response(buyerDomain, buyerRef),
          `gen-summary-splice-${buyerCase.name}`
        )(request);
      }
    });
    if (buyerSummary.indexOf(buyerCase.buyer) !== buyerTokenIndex ||
        buyerSummary.length <= 320 ||
        projectedBuyerSummary.length > 320 ||
        !projectedBuyerSummary.includes(buyerCase.buyer) ||
        buyerResult.status !== 'completed' ||
        buyerResult.searchSpace?.eligibleCount < 2) {
      throw new Error(
        `objective-salient buyer compaction favored one profession: ${JSON.stringify({
          buyerCase,
          buyerSummaryLength: buyerSummary.length,
          buyerTokenIndex: buyerSummary.indexOf(buyerCase.buyer),
          projectedBuyerSummary,
          buyerResult
        })}`
      );
    }
  }
}

async function verifyFullCatalogUnicodeCapStable() {
  const sourceID = 'src-full-catalog-unicode-cap';
  const website = 'https://unicode-cap.example/';
  const paidRef = 'observation:z-paid-subscription';
  const domain = {
    name: 'unicode-cap',
    buyer: 'Operations teams buying workflow software',
    offer: 'A paid workflow-software subscription',
    destination: 'Workflow software pricing and signup page',
    mechanism: 'subscription_or_retainer',
    outcome: 'One subscription payment receipt',
    attributionMethod: 'payment_receipt',
    attribution:
      'Payment receipt source field stores the organic-search UTM campaign',
    sourceSummary:
      'Operations teams buying workflow software arrive through organic search at the workflow software pricing and signup page, purchase a paid subscription, and store the organic-search UTM campaign in the payment receipt source field.'
  };
  const asciiEvidence = Array.from({ length: 62 }, (_, index) => ({
    observationId: `a-cap-${String(index).padStart(3, '0')}`,
    sourceId: sourceID,
    kind: 'case-study',
    title: `Neutral professional evidence ${index}`,
    summary:
      'Current source-backed professional evidence with equivalent quality.',
    url: `${website}evidence/ascii-${index}`,
    observedAt: '2026-07-29T12:00:00Z',
    current: true,
    confidence: 'high'
  }));
  const unicodeEvidence = [
    {
      observationId: 'café',
      sourceId: sourceID,
      kind: 'case-study',
      title: 'Precomposed Unicode professional evidence',
      summary:
        'Current source-backed professional evidence with equivalent quality.',
      url: `${website}evidence/unicode-precomposed`,
      observedAt: '2026-07-29T12:00:00Z',
      current: true,
      confidence: 'high'
    },
    {
      observationId: 'café',
      sourceId: sourceID,
      kind: 'case-study',
      title: 'Decomposed Unicode professional evidence',
      summary:
        'Current source-backed professional evidence with equivalent quality.',
      url: `${website}evidence/unicode-decomposed`,
      observedAt: '2026-07-29T12:00:00Z',
      current: true,
      confidence: 'high'
    }
  ];
  const paidEvidence = {
    observationId: 'z-paid-subscription',
    sourceId: sourceID,
    kind: 'service-page',
    title: domain.destination,
    summary: domain.sourceSummary,
    url: `${website}pricing`,
    observedAt: '2026-07-29T12:00:00Z',
    current: true,
    confidence: 'high'
  };
  const baseSnapshot = {
    profile: {
      identity: { website }
    },
    sources: [{
      id: sourceID,
      kind: 'website',
      label: 'Unicode cap source',
      url: website,
      status: 'monitoring',
      trustLevel: 'high'
    }]
  };
  const run = async (sourceEvidence, suffix) => {
    let promptIDs = [];
    const result = await runOpportunityTournament({
      job: {
        id: `job-full-catalog-unicode-cap-${suffix}`,
        payload: {
          researchOnly: true,
          objective: {
            outcome:
              'Generate one new attributed workflow-software subscription.',
            successMetric:
              'One subscription payment receipt with a stored acquisition source.'
          },
          budget: {
            maxHypotheses: 128,
            maxLLMCalls: 2,
            maxOutputTokens: 8_000
          },
          commercialContext: {
            allowedChannels: ['organic search']
          },
          evidenceSnapshot: {
            ...baseSnapshot,
            sourceEvidence
          }
        }
      },
      model: 'test/v2',
      now,
      completeJSON: async (request) => {
        if (request.responseFormat?.json_schema?.name !==
            'opportunity_tournament_critic_v1') {
          promptIDs = (
            JSON.parse(request.user).evidenceCatalog || []
          ).map((item) => item.id);
        }
        return completionWithCritic(
          strictV2Response(domain, paidRef),
          `gen-unicode-cap-${suffix}`
        )(request);
      }
    });
    return { result, promptIDs };
  };
  const forwardEvidence = [
    ...asciiEvidence,
    ...unicodeEvidence,
    paidEvidence
  ];
  const reverseEvidence = [...forwardEvidence].reverse();
  const forwardCatalog = buildEvidenceCatalog({
    evidenceSnapshot: {
      ...baseSnapshot,
      sourceEvidence: forwardEvidence
    }
  }, {}, now);
  const reverseCatalog = buildEvidenceCatalog({
    evidenceSnapshot: {
      ...baseSnapshot,
      sourceEvidence: reverseEvidence
    }
  }, {}, now);
  const forward = await run(forwardEvidence, 'forward');
  const reverse = await run(reverseEvidence, 'reverse');
  const forwardIDs = forwardCatalog.map((item) => item.id);
  const reverseIDs = reverseCatalog.map((item) => item.id);
  const decomposedID = 'observation:café';
  const precomposedID = 'observation:café';
  if (forwardCatalog.length !== 64 ||
      reverseCatalog.length !== 64 ||
      JSON.stringify(forwardIDs) !== JSON.stringify(reverseIDs) ||
      !forwardIDs.includes(decomposedID) ||
      forwardIDs.includes(precomposedID) ||
      forward.result.status !== 'completed' ||
      reverse.result.status !== 'completed' ||
      forward.result.evidenceHash !== reverse.result.evidenceHash ||
      forward.result.searchSpace?.promptEvidenceHash !==
        reverse.result.searchSpace?.promptEvidenceHash ||
      JSON.stringify(forward.promptIDs) !==
        JSON.stringify(reverse.promptIDs)) {
    throw new Error(
      `full-catalog cap changed under Unicode-equivalent input reversal: ${JSON.stringify({
        forwardIDs,
        reverseIDs,
        forward: {
          status: forward.result.status,
          evidenceHash: forward.result.evidenceHash,
          promptEvidenceHash:
            forward.result.searchSpace?.promptEvidenceHash,
          promptIDs: forward.promptIDs
        },
        reverse: {
          status: reverse.result.status,
          evidenceHash: reverse.result.evidenceHash,
          promptEvidenceHash:
            reverse.result.searchSpace?.promptEvidenceHash,
          promptIDs: reverse.promptIDs
        }
      })}`
    );
  }
}

async function verifyProviderProjectionOrderAndProfessionNeutrality() {
  const sourceID = 'src-profession-neutral-projection';
  const website = 'https://architecture-advisory.example/';
  const paidRef = 'observation:obs-architecture-paid-offer';
  const domain = {
    name: 'architecture-advisory',
    buyer: 'Engineering leaders buying software architecture advice',
    offer: 'A paid software architecture advisory engagement',
    destination: 'Software architecture advisory booking page',
    mechanism: 'signed_contract',
    outcome: 'One signed software architecture contract recorded',
    attributionMethod: 'invoice_or_contract',
    attribution:
      'Contract source field stores the organic-search UTM campaign',
    sourceSummary:
      'Engineering leaders can purchase a paid software architecture advisory engagement through organic search and the advisory booking page. The signed contract source field stores the organic-search UTM campaign.'
  };
  const paidOffer = {
    observationId: 'obs-architecture-paid-offer',
    sourceId: sourceID,
    kind: 'service-page',
    title: domain.destination,
    summary: domain.sourceSummary,
    url: `${website}advisory`,
    observedAt: '2026-07-29T12:00:00Z',
    current: true,
    confidence: 'high'
  };
  const relevantEvidence = [
    ...Array.from(
      { length: 22 },
      (_, index) => ({
        observationId: `obs-architecture-relevant-${String(index).padStart(2, '0')}`,
        sourceId: sourceID,
        kind: 'article',
        title: `Software architecture engagement evidence ${index}`,
        summary:
          'Software architecture advisory engagement patterns for engineering leaders evaluating technical strategy.',
        url: `${website}software-architecture/${index}/`,
        observedAt: '2026-07-29T12:00:00Z',
        publishedAt: '2026-07-28T12:00:00Z',
        confidence: 'high'
      })
    ),
    {
      observationId: 'obs-architecture-unicode-café',
      sourceId: sourceID,
      kind: 'article',
      title:
        'Paid software architecture advisory engagement café evidence',
      summary:
        'Software architecture advisory engagement evidence for engineering leaders evaluating technical strategy.',
      url: `${website}software-architecture/unicode-precomposed/`,
      observedAt: '2026-07-29T12:00:00Z',
      publishedAt: '2026-07-28T12:00:00Z',
      confidence: 'high'
    },
    {
      observationId: 'obs-architecture-unicode-café',
      sourceId: sourceID,
      kind: 'article',
      title:
        'Paid software architecture advisory engagement café evidence',
      summary:
        'Software architecture advisory engagement evidence for engineering leaders evaluating technical strategy.',
      url: `${website}software-architecture/unicode-decomposed/`,
      observedAt: '2026-07-29T12:00:00Z',
      publishedAt: '2026-07-28T12:00:00Z',
      confidence: 'high'
    }
  ];
  const distractorEvidence = Array.from(
    { length: 24 },
    (_, index) => ({
      observationId: `obs-medical-contract-distractor-${String(index).padStart(2, '0')}`,
      sourceId: sourceID,
      kind: 'article',
      title: `Educational patient home visit article ${index}`,
      summary:
        'Educational patient home visit article for community readers with an overview of contract concepts.',
      url: `${website}unrelated-health-article/${index}/`,
      observedAt: '2026-07-29T12:00:00Z',
      publishedAt: '2026-07-28T12:00:00Z',
      confidence: 'high'
    })
  );
  const runProjection = async (sourceEvidence, suffix) => {
    let request;
    const result = await runOpportunityTournament({
      job: {
        id: `job-profession-neutral-projection-${suffix}`,
        payload: {
          tournamentId:
            `tournament-profession-neutral-projection-${suffix}`,
          researchOnly: true,
          objective: {
            outcome:
              'Win one paid software architecture advisory engagement.',
            successMetric:
              'One signed software architecture contract with a stored acquisition source.'
          },
          budget: {
            maxHypotheses: 128,
            maxFinalists: 8,
            maxLLMCalls: 1,
            maxOutputTokens: 8_000
          },
          evidenceSnapshot: {
            profile: {
              identity: { website }
            },
            sources: [{
              id: sourceID,
              label: 'Architecture advisory source',
              url: website,
              status: 'monitoring',
              trustLevel: 'high'
            }],
            sourceEvidence
          }
        }
      },
      model: 'test/v2',
      now,
      completeJSON: async (value) => {
        request = value;
        return {
          data: compactV2Response(domain, paidRef),
          usage,
          diagnostics: { finishReason: 'stop' }
        };
      }
    });
    return {
      result,
      request,
      task: JSON.parse(request?.user || '{}')
    };
  };
  const originalEvidence = [
    ...distractorEvidence,
    ...relevantEvidence,
    paidOffer
  ];
  const forward = await runProjection(originalEvidence, 'forward');
  const reverse = await runProjection(
    [...originalEvidence].reverse(),
    'reverse'
  );
  const forwardIDs = (forward.task.evidenceCatalog || [])
    .map((item) => item.id);
  const reverseIDs = (reverse.task.evidenceCatalog || [])
    .map((item) => item.id);
  const relevantCount = forwardIDs.filter((id) =>
    id.startsWith('observation:obs-architecture-relevant-') ||
    id.startsWith('observation:obs-architecture-unicode-')
  ).length;
  const distractorCount = forwardIDs.filter((id) =>
    id.startsWith(
      'observation:obs-medical-contract-distractor-'
    )
  ).length;
  const forwardBytes = forward.request
    ? Buffer.byteLength(
      serializeOpenRouterJSONRequestBody(forward.request),
      'utf8'
    )
    : 0;
  const reverseBytes = reverse.request
    ? Buffer.byteLength(
      serializeOpenRouterJSONRequestBody(reverse.request),
      'utf8'
    )
    : 0;
  if (!forward.request ||
      !reverse.request ||
      forwardIDs.length !== 16 ||
      reverseIDs.length !== 16 ||
      forwardIDs[0] !== paidRef ||
      !forwardIDs.includes(
        'observation:obs-architecture-unicode-café'
      ) ||
      !forwardIDs.includes(
        'observation:obs-architecture-unicode-café'
      ) ||
      JSON.stringify(forwardIDs) !== JSON.stringify(reverseIDs) ||
      forward.result.searchSpace?.promptEvidenceHash !==
        reverse.result.searchSpace?.promptEvidenceHash ||
      relevantCount < 12 ||
      distractorCount > 2 ||
      forwardBytes > 36 * 1_024 ||
      reverseBytes > 36 * 1_024 ||
      forward.result.gate?.sideEffects?.outreachAttempts !== 0 ||
      forward.result.gate?.sideEffects?.publishAttempts !== 0 ||
      forward.result.gate?.sideEffects?.providerWrites !== 0 ||
      reverse.result.gate?.sideEffects?.outreachAttempts !== 0 ||
      reverse.result.gate?.sideEffects?.publishAttempts !== 0 ||
      reverse.result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `provider projection was order-sensitive or profession-biased under distractor pressure: ${JSON.stringify({
        forwardIDs,
        reverseIDs,
        forwardHash:
          forward.result.searchSpace?.promptEvidenceHash,
        reverseHash:
          reverse.result.searchSpace?.promptEvidenceHash,
        relevantCount,
        distractorCount,
        forwardBytes,
        reverseBytes,
        forwardEnvelope:
          forward.result.searchSpace?.providerPromptEnvelope,
        reverseEnvelope:
          reverse.result.searchSpace?.providerPromptEnvelope
      })}`
    );
  }
}

async function runDomainRepairSequence({
  domain,
  ref,
  suffix,
  responses,
  diagnostics,
  usages,
  evidenceSnapshot,
  budgetOverrides = {},
  onRequest = () => {}
}) {
  let calls = 0;
  return runOpportunityTournament({
    job: {
      id: `job-${suffix}`,
      payload: {
        tournamentId: `tournament-${suffix}`,
        researchOnly: true,
        objective: {
          outcome: `Generate one new attributed ${domain.outcome}.`,
          successMetric: domain.outcome
        },
        budget: {
          maxHypotheses: 128,
          maxFinalists: 8,
          maxLLMCalls: 2,
          maxOutputTokens: 8000,
          ...budgetOverrides
        },
        evidenceSnapshot: evidenceSnapshot || {
          profile: {
            identity: {
              website: `https://${domain.name}.example/`
            }
          },
          sources: [{
            id: `src-${suffix}`,
            url: `https://${domain.name}.example/`,
            status: 'monitoring',
            trustLevel: 'high'
          }],
          sourceEvidence: [{
            observationId: ref.replace(/^observation:/, ''),
            sourceId: `src-${suffix}`,
            kind: 'service-page',
            title: domain.destination,
            summary: domain.sourceSummary,
            url: `https://${domain.name}.example/offer`,
            observedAt: '2026-07-29T12:00:00Z',
            confidence: 'high'
          }]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async (request) => {
      onRequest(request);
      const index = calls;
      calls += 1;
      if (responses[index] instanceof Error) {
        throw responses[index];
      }
      return {
        data: responses[index],
        usage: usages ? usages[index] : usage,
        generationId: `gen-${suffix}-${calls}`,
        diagnostics: diagnostics[index]
      };
    }
  });
}

async function runDomainWithResponse(
  domain,
  response,
  suffix,
  diagnostics
) {
  const website = `https://${domain.name}.example/`;
  return runOpportunityTournament({
    job: {
      id: `job-${suffix}`,
      payload: {
        tournamentId: `tournament-${suffix}`,
        researchOnly: true,
        objective: {
          outcome: `Generate one new attributed ${domain.outcome}.`,
          successMetric: domain.outcome
        },
        budget: {
          maxHypotheses: 512,
          maxFinalists: 8,
          maxLLMCalls: 2,
          maxOutputTokens: 8000
        },
        commercialContext: {
          allowedChannels: ['organic search']
        },
        evidenceSnapshot: {
          profile: {
            identity: { website }
          },
          sources: [{
            id: `src-${domain.name}`,
            url: website,
            status: 'monitoring',
            trustLevel: 'high'
          }],
          sourceEvidence: [{
            observationId: `obs-${domain.name}`,
            sourceId: `src-${domain.name}`,
            kind: 'service-page',
            title: domain.destination,
            summary: domain.sourceSummary,
            url: `${website}offer`,
            observedAt: '2026-07-29T12:00:00Z',
            confidence: 'high'
          }]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async (request) => {
      const completion = completionWithCritic(
        response,
        `gen-${suffix}`
      );
      const value = await completion(request);
      return { ...value, diagnostics };
    }
  });
}

async function verifyBettyLongHomepageCompactionRegression() {
  const sourceID = 'src-betty-long-homepage';
  const homeRef = 'observation:obs-a76ca342-5ca5-44c7-8844-8facc9f69d04';
  const website = 'https://breastfeedingwithlove.com/';
  const observedURL = 'https://www.breastfeedingwithlove.com';
  const publicURL = 'https://www.breastfeedingwithlove.com/';
  const sourceSummary =
    'The page is categorized as WebSite and LocalBusiness. Headings mention Book a Same-Day Home Visit Today., United Healthcare Accepted, Helping Mothers Breastfeed with Confidence. Lactation Consultant NYC 0 Skip to Content Virtual Lactation Consultation Lactation Consultant Home Visit FAQs Blog Contact: 212-555-0147 Open Menu Close Menu Virtual Lactation Consultation Lactation Consultant Home Visit FAQs Blog Contact: 212-555-0147 Open Menu Close Menu Virtual Lactation Consultation Lactation Consultant Home Visit FAQs Blog Contact: 212-555-0147 Book a Same-Day Home Visit Today. Betty Greenman is...';
  for (const [index, ambiguousText] of [
    'Read our license.',
    'Contact us about a contract.'
  ].entries()) {
    const ambiguousCatalog = buildEvidenceCatalog({
      evidenceSnapshot: {
        profile: { identity: { website } },
        sources: [{
          id: sourceID,
          kind: 'website',
          label: 'Owner website',
          url: website,
          status: 'monitoring'
        }],
        sourceEvidence: [{
          observationId: `obs-ambiguous-${index}`,
          sourceId: sourceID,
          kind: 'website',
          title: 'Owner website',
          summary: `${'Professional overview and background. '.repeat(30)}${ambiguousText}${' Professional overview and background.'.repeat(30)}`,
          url: observedURL,
          observedAt: '2026-07-02T22:44:22.646277Z'
        }]
      }
    }, {}, now);
    if (ambiguousCatalog.some((item) =>
      item.revenueAssetRole === 'current_owner_paid_conversion_asset')) {
      throw new Error(
        `An ambiguous repeated revenue token became a paid-conversion asset: ${JSON.stringify({ ambiguousText, ambiguousCatalog })}`
      );
    }
  }
  const evidenceSnapshot = {
    profile: {
      identity: {
        fullName: 'Betty Hannah Greenman',
        website
      }
    },
    sources: [{
      id: sourceID,
      kind: 'website',
      label: 'Breastfeeding With Love',
      url: website,
      status: 'monitoring',
      trustLevel: 'high'
    }],
    sourceEvidence: [{
      observationId: homeRef.replace(/^observation:/, ''),
      sourceId: sourceID,
      kind: 'website',
      title: 'Lactation Consultant NYC',
      summary: sourceSummary,
      url: observedURL,
      observedAt: '2026-07-02T22:44:22.646277Z',
      confidence: 'high'
    }]
  };
  const catalog = buildEvidenceCatalog(
    { evidenceSnapshot },
    {},
    now
  );
  const catalogHome = catalog.find((item) => item.id === homeRef);
  if (sourceSummary.length <= 420 ||
      !catalogHome ||
      catalogHome.summary.length > 420 ||
      !catalogHome.summary.includes(
        'Book a Same-Day Home Visit Today.'
      ) ||
      !catalogHome.summary.includes('United Healthcare Accepted') ||
      catalogHome.revenueAssetRole !==
        'current_owner_paid_conversion_asset') {
    throw new Error(
      `Betty's long owner homepage lost its paid-conversion signals during catalog compaction: ${JSON.stringify({ catalogHome })}`
    );
  }

  const domain = {
    name: 'betty-long-homepage',
    buyer: 'New York parents seeking same-day lactation support',
    offer: 'A reimbursable same-day lactation home visit',
    destination: 'Same-day home-visit booking page',
    mechanism: 'insurance_reimbursement',
    outcome: 'One paid or reimbursed consultation recorded',
    attributionMethod: 'claim_record',
    attribution:
      'Claim record source field stores the organic-search campaign',
    sourceSummary
  };
  const response = compactV2Response(domain, homeRef);
  for (const family of [response.familyA, response.familyB]) {
    family.d.o[0].l = 'A lactation consultation';
  }
  response.evidenceExperiment.x =
    'Review first: attach exactly 1 current public paid-offer page.';
  let promptHome = null;
  const result = await runOpportunityTournament({
    job: {
      id: 'job-betty-long-homepage',
      payload: {
        tournamentId: 'tournament-betty-long-homepage',
        researchOnly: true,
        objective: {
          outcome:
            'Create one new paid or reimbursed lactation consultation in New York.',
          successMetric:
            'One paid or reimbursed consultation attributed by its claim record.'
        },
        budget: {
          maxHypotheses: 256,
          maxFinalists: 8,
          maxLLMCalls: 1,
          maxOutputTokens: 8000
        },
        evidenceSnapshot
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async (request) => {
      promptHome = (JSON.parse(request.user).evidenceCatalog || [])
        .find((item) => item.id === homeRef) || null;
      return {
        data: response,
        usage,
        diagnostics: { finishReason: 'stop' }
      };
    }
  });
  const experiment = result.nextExperiment || {};
  if (result.status !== 'skipped' ||
      !promptHome ||
      promptHome.summary.length > 320 ||
      !promptHome.summary.includes(
        'Book a Same-Day Home Visit Today.'
      ) ||
      !promptHome.summary.includes('United Healthcare Accepted') ||
      promptHome.revenueAssetRole !==
        'current_owner_paid_conversion_asset' ||
      result.searchSpace?.retainedCount !== 0 ||
      experiment.kind !== 'inbound_revenue_evidence' ||
      experiment.asset?.publicUrl !== publicURL ||
      !experiment.evidenceRefs?.includes(homeRef) ||
      /\b(?:attach|approve|create|document)\b.{0,80}\bpaid[- ]offer page\b/i.test(
        `${experiment.title} ${experiment.action}`
      ) ||
      experiment.missingEvidence?.some((item) =>
        /current paid offer|paid[- ]offer page/i.test(item)
      ) ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `Betty's long owner homepage did not prevent a redundant paid-offer-page experiment: ${JSON.stringify({ result, promptHome })}`
    );
  }
}

async function verifyBettyProductionTraceRegression() {
  const sourceID = 'src-betty-production-trace';
  const homeRef = 'observation:obs-betty-current-home';
  const staleArticleRef = 'observation:obs-betty-old-169';
  const staleArticleURL =
    'https://www.breastfeedingwithlove.com/baby-friendly-initiative-program-in-hospitals/';
  const repeatedArticleObservations = Array.from(
    { length: 170 },
    (_, index) => ({
      observationId: `obs-betty-old-${index}`,
      sourceId: sourceID,
      kind: 'article',
      title: 'Baby Friendly Initiative Program in Hospitals',
      summary:
        'An informational article for hospital program leaders about the Baby Friendly Initiative Program in Hospitals.',
      url: index % 2 === 0
        ? staleArticleURL
        : staleArticleURL.replace('www.', ''),
      observedAt: '2026-07-02T12:00:00Z',
      publishedAt: '2021-07-02T12:00:00Z',
      confidence: 'high'
    })
  );
  const currentHomepage = {
    observationId: 'obs-betty-current-home',
    sourceId: sourceID,
    kind: 'service-page',
    title:
      'Book a Same-Day Home Visit — Same-day home-visit booking page',
    summary:
      'New parents can book a reimbursable same-day home visit from this service page. United Healthcare Accepted.',
    url: 'https://www.breastfeedingwithlove.com/',
    observedAt: '2026-07-29T12:00:00Z',
    confidence: 'high',
    current: true
  };
  const domain = {
    name: 'betty-production-trace',
    buyer: 'New parents seeking same-day lactation support',
    offer: 'A reimbursable same-day home visit',
    destination: 'Same-day home-visit booking page',
    mechanism: 'insurance_reimbursement',
    outcome: 'One paid claim recorded',
    attributionMethod: 'claim_record',
    attribution:
      'Claim record source field stores the organic-search campaign',
    sourceSummary: currentHomepage.summary
  };
  const response = strictV2Response(domain, homeRef);
  response.familyB.e.push(staleArticleRef);
  response.familyB.d.timingTriggers = [{
    l: 'Baby Friendly Initiative Program in Hospitals',
    e: [staleArticleRef],
    q: 'Baby Friendly Initiative Program in Hospitals'
  }];
  response.evidenceExperiment = {
    l:
      'Test demand for Baby Friendly Initiative Program in Hospitals',
    k:
      currentHomepage.summary,
    b: domain.buyer,
    o: domain.offer,
    a: 'organic search',
    d: domain.destination,
    c: domain.outcome,
    t: domain.attribution,
    x:
      `Review first: for 14 days or 25 qualified visits, test organic search for ${domain.buyer} seeking ${domain.offer} through ${domain.destination}; count ${domain.outcome} and store ${domain.attribution}.`,
    s: domain.outcome,
    days: 14,
    n: 25,
    u: 'qualified visits',
    e: [homeRef, staleArticleRef]
  };
  let promptEvidence = [];
  const result = await runOpportunityTournament({
    job: {
      id: 'job-betty-production-trace',
      payload: {
        tournamentId: 'tournament-betty-production-trace',
        researchOnly: true,
        objective: {
          outcome: 'Generate one new attributed paid patient outcome.',
          successMetric: 'One paid claim recorded'
        },
        budget: {
          maxHypotheses: 512,
          maxFinalists: 8,
          maxLLMCalls: 1,
          maxOutputTokens: 8000
        },
        evidenceSnapshot: {
          profile: {
            identity: {
              fullName: 'Production trace owner',
              website: 'https://breastfeedingwithlove.com/'
            }
          },
          sources: [{
            id: sourceID,
            kind: 'website',
            label: 'Owner professional website',
            url: 'https://breastfeedingwithlove.com/',
            status: 'monitoring',
            trustLevel: 'high'
          }],
          sourceEvidence: [
            ...repeatedArticleObservations,
            currentHomepage
          ]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async (input) => {
      promptEvidence = JSON.parse(input.user).evidenceCatalog;
      return { data: response, usage };
    }
  });
  const experiment = result.nextExperiment || {};
  const homeEvidence = promptEvidence.find(
    (item) => item.id === homeRef
  );
  const articleEvidence = promptEvidence.filter((item) =>
    item.url?.includes(
      '/baby-friendly-initiative-program-in-hospitals'
    )
  );
  if (result.status !== 'skipped' ||
      result.searchSpace?.completeStrategyFamilyCount !== 1 ||
      result.searchSpace?.incompleteStrategyFamilyCount !== 1 ||
      result.searchSpace?.expandedCount !== 0 ||
      !homeEvidence ||
      homeEvidence.revenueAssetRole !==
        'current_owner_paid_conversion_asset' ||
      articleEvidence.length !== 1 ||
      articleEvidence[0]?.revenueAssetRole !== 'informational_only' ||
      experiment.kind !== 'strategy_generation_shape_recovery' ||
      hasBusinessExperimentField(experiment) ||
      experiment.asset !== null ||
      result.gate?.decision !== 'strategy_generation_incomplete' ||
      result.searchSpace?.structuredRepair?.authorized !== false ||
      /Baby Friendly Initiative/i.test(
        `${experiment.title} ${experiment.action} ${experiment.successSignal}`
      ) ||
      /\b(?:attach|approve|create|document)\b.{0,40}\bpaid[- ]offer page\b/i.test(
        experiment.action || ''
      ) ||
      result.usage?.calls !== 1 ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `Betty production trace did not fail forward from the current owned paid homepage: ${JSON.stringify({ result, promptEvidence })}`
    );
  }

  const repairedResponse = strictV2Response(domain, homeRef);
  let repairCalls = 0;
  const repairedResult = await runOpportunityTournament({
    job: {
      id: 'job-betty-production-trace-repair',
      payload: {
        tournamentId: 'tournament-betty-production-trace-repair',
        researchOnly: true,
        objective: {
          outcome: 'Generate one new attributed paid patient outcome.',
          successMetric: 'One paid claim recorded'
        },
        budget: {
          maxHypotheses: 512,
          maxFinalists: 8,
          maxLLMCalls: 2,
          maxOutputTokens: 8000
        },
        evidenceSnapshot: {
          profile: {
            identity: {
              fullName: 'Production trace owner',
              website: 'https://breastfeedingwithlove.com/'
            }
          },
          sources: [{
            id: sourceID,
            kind: 'website',
            label: 'Owner professional website',
            url: 'https://breastfeedingwithlove.com/',
            status: 'monitoring',
            trustLevel: 'high'
          }],
          sourceEvidence: [
            ...repeatedArticleObservations,
            currentHomepage
          ]
        }
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async () => {
      repairCalls += 1;
      return {
        data: repairCalls === 1 ? response : repairedResponse,
        usage
      };
    }
  });
  const repairedExperiment = repairedResult.nextExperiment || {};
  if (repairCalls !== 2 ||
      repairedResult.status !== 'skipped' ||
      repairedResult.searchSpace?.completeStrategyFamilyCount !== 2 ||
      repairedResult.searchSpace?.incompleteStrategyFamilyCount !== 0 ||
      repairedResult.searchSpace?.structuredRepair?.attempted !== true ||
      repairedResult.searchSpace?.structuredRepair?.succeeded !== true ||
      repairedResult.searchSpace?.modelCalls !== 2 ||
      repairedResult.usage?.calls !== 2 ||
      repairedExperiment.kind !== 'inbound_revenue_evidence' ||
      repairedExperiment.noGroundedPath !== true ||
      repairedExperiment.asset?.publicUrl !==
        'https://www.breastfeedingwithlove.com/' ||
      !completeBusinessExperimentFields(repairedExperiment) ||
      repairedExperiment.knownFact !== domain.sourceSummary ||
      !/not yet grounded/i.test(repairedExperiment.buyer) ||
      !/no permitted acquisition channel/i.test(
        repairedExperiment.acquisitionMechanism
      ) ||
      repairedResult.result?.resultType !== 'no_grounded_path' ||
      repairedResult.result?.allowedChannel !== 'none' ||
      repairedResult.result?.sideEffectsPerformed !== 0 ||
      /Baby Friendly Initiative/i.test(
        `${repairedExperiment.title} ${repairedExperiment.action} ${repairedExperiment.successSignal}`
      ) ||
      /organic search/i.test(repairedExperiment.acquisitionMechanism) ||
      !/do not assume organic search/i.test(repairedExperiment.action) ||
      repairedResult.gate?.decision !==
        'needs_more_approved_evidence') {
    throw new Error(
      `Betty structured-family repair did not yield the grounded bounded experiment: ${JSON.stringify(repairedResult)}`
    );
  }
}

async function verifyBettyDistinctArticlePressureRegression() {
  const sourceID = 'src-betty-distinct-pressure';
  const website = 'https://breastfeedingwithlove.com/';
  const homeRef = 'observation:obs-betty-distinct-current-home';
  const staleArticles = Array.from({ length: 80 }, (_, index) => ({
    observationId: `obs-betty-distinct-old-${index}`,
    sourceId: sourceID,
    kind: 'article',
    title: `Archived lactation information article ${index}`,
    summary:
      `Historical educational article ${index} for hospital and family audiences; ` +
      'it does not describe a current paid or reimbursable offer.',
    url: `${website}resources/archived-lactation-article-${index}/`,
    observedAt: '2026-07-29T12:00:00Z',
    publishedAt: '2021-07-02T12:00:00Z',
    current: false,
    confidence: 'high'
  }));
  const currentHomepage = {
    observationId: 'obs-betty-distinct-current-home',
    sourceId: sourceID,
    kind: 'service-page',
    title: 'Lactation Consultant NYC — Book a Same-Day Home Visit',
    summary:
      'New York parents can book a reimbursable same-day lactation home visit. United Healthcare is accepted and the booking page is current.',
    url: website,
    observedAt: '2026-07-29T12:00:00Z',
    current: true,
    confidence: 'high'
  };
  const domain = {
    name: 'betty-distinct-pressure',
    buyer: 'New York parents seeking same-day lactation support',
    offer: 'A reimbursable same-day lactation home visit',
    destination: 'Same-day home-visit booking page',
    mechanism: 'insurance_reimbursement',
    outcome: 'One paid or reimbursed consultation recorded',
    attributionMethod: 'claim_record',
    attribution:
      'Booking or claim record source field stores the organic-search campaign',
    sourceSummary: currentHomepage.summary
  };
  const invalidInitial = compactV2Response(domain, homeRef);
  invalidInitial.seedContract = 'unsupported_seed_contract';
  const requests = [];
  const result = await runDomainRepairSequence({
    domain,
    ref: homeRef,
    suffix: 'betty-distinct-article-pressure',
    responses: [
      invalidInitial,
      compactV2Response(domain, homeRef)
    ],
    diagnostics: [
      { finishReason: 'stop' },
      { finishReason: 'stop' }
    ],
    usages: [usage, usage],
    evidenceSnapshot: {
      profile: {
        identity: {
          fullName: 'Betty Hannah Greenman',
          website
        }
      },
      sources: [{
        id: sourceID,
        kind: 'website',
        label: 'Breastfeeding With Love',
        url: website,
        status: 'monitoring',
        trustLevel: 'high'
      }],
      sourceEvidence: [
        ...staleArticles,
        currentHomepage
      ]
    },
    onRequest: (request) => requests.push(request)
  });
  const initialTask = JSON.parse(requests[0]?.user || '{}');
  const repairTask = JSON.parse(requests[1]?.user || '{}');
  const initialIDs = (initialTask.evidenceCatalog || [])
    .map((item) => item.id);
  const repairIDs = (repairTask.evidenceCatalog || [])
    .map((item) => item.id);
  const expectedSchemaIDs = initialIDs;
  const initialSchemaIDs =
    requests[0]?.responseFormat?.json_schema?.schema
      ?.$defs?.evidenceRef?.enum || [];
  const repairSchemaIDs =
    requests[1]?.responseFormat?.json_schema?.schema
      ?.$defs?.evidenceRef?.enum || [];
  const homeEvidence = initialTask.evidenceCatalog?.find(
    (item) => item.id === homeRef
  );
  const stalePromptEvidence = initialTask.evidenceCatalog?.filter(
    (item) => item.url?.includes('/resources/archived-')
  ) || [];
  const initialBytes = requests[0]
    ? Buffer.byteLength(
      serializeOpenRouterJSONRequestBody(requests[0]),
      'utf8'
    )
    : 0;
  const repairBytes = requests[1]
    ? Buffer.byteLength(
      serializeOpenRouterJSONRequestBody(requests[1]),
      'utf8'
    )
    : 0;
  const experiment = result.nextExperiment || {};
  const sideEffects = result.gate?.sideEffects || {};
  if (requests.length !== 2 ||
      result.status !== 'skipped' ||
      result.searchSpace?.evidenceCatalogCount !== 64 ||
      result.searchSpace?.promptEvidenceCount !== 16 ||
      initialIDs.some((id) => /^source:/i.test(id)) ||
      result.searchSpace?.promptEvidenceOmittedCount !== 48 ||
      initialIDs.length !== 16 ||
      initialIDs[0] !== homeRef ||
      JSON.stringify(initialIDs) !== JSON.stringify(repairIDs) ||
      JSON.stringify(initialSchemaIDs) !==
        JSON.stringify(expectedSchemaIDs) ||
      JSON.stringify(repairSchemaIDs) !==
        JSON.stringify(expectedSchemaIDs) ||
      initialBytes > 36 * 1_024 ||
      repairBytes > 36 * 1_024 ||
      homeEvidence?.url !== website ||
      homeEvidence?.current !== true ||
      homeEvidence?.revenueAssetRole !==
        'current_owner_paid_conversion_asset' ||
      stalePromptEvidence.length === 0 ||
      stalePromptEvidence.some((item) =>
        item.current !== false ||
        item.revenueAssetRole !== 'informational_only'
      ) ||
      result.searchSpace?.completeStrategyFamilyCount !== 2 ||
      result.searchSpace?.incompleteStrategyFamilyCount !== 0 ||
      result.searchSpace?.structuredRepair?.attempted !== true ||
      result.searchSpace?.structuredRepair?.succeeded !== true ||
      result.searchSpace?.modelCalls !== 2 ||
      result.usage?.calls !== 2 ||
      result.winner !== null ||
      experiment.kind !== 'inbound_revenue_evidence' ||
      experiment.asset?.publicUrl !== website ||
      experiment.noGroundedPath !== true ||
      !completeBusinessExperimentFields(experiment) ||
      experiment.knownFact !== domain.sourceSummary ||
      !/no permitted acquisition channel/i.test(
        experiment.acquisitionMechanism || ''
      ) ||
      !/not yet grounded/i.test(experiment.buyer || '') ||
      !/\bpaid\b/i.test(experiment.paidOffer || '') ||
      !/\bbooking page\b/i.test(
        experiment.conversionDestination || ''
      ) ||
      /\bconversion page\b/i.test(
        experiment.conversionDestination || ''
      ) ||
      !/\bpaid (?:booking|claim|consultation)\b/i.test(
        experiment.paidConversion || ''
      ) ||
      !/\bsource\/origin field\b/i.test(
        experiment.attributionSignal || ''
      ) ||
      !/14 (?:calendar )?days/i.test(experiment.action || '') ||
      !/do not assume organic search/i.test(experiment.action || '') ||
      result.result?.resultType !== 'no_grounded_path' ||
      result.result?.allowedChannel !== 'none' ||
      result.result?.sideEffectsPerformed !== 0 ||
      /archived lactation information/i.test(
        `${experiment.title} ${experiment.action} ${experiment.successSignal}`
      ) ||
      experiment.rerunPolicy?.maxReruns !== 1 ||
      result.gate?.decision !== 'needs_more_approved_evidence' ||
      sideEffects.outreachAttempts !== 0 ||
      sideEffects.publishAttempts !== 0 ||
      sideEffects.providerWrites !== 0) {
    throw new Error(
      `Betty's distinct stale article pressure did not preserve the current paid homepage and bounded repair contract: ${JSON.stringify({
        result,
        initialIDs,
        repairIDs,
        initialSchemaIDs,
        repairSchemaIDs,
        initialBytes,
        repairBytes,
        providerPromptEnvelope:
          result.searchSpace?.providerPromptEnvelope,
        homeEvidence,
        stalePromptEvidence
      })}`
    );
  }
}

async function verifyStructuredRepairAcrossDomains() {
  const expectations = {
    'healthcare-patient': 'claim record',
    saas: 'payment receipt',
    consulting: 'contract source',
    'creator-license': 'license (?:contract|or royalty record)',
    commerce: 'order'
  };
  for (const domain of domains.filter((item) =>
    expectations[item.name]
  )) {
    const ref = `observation:obs-${domain.name}-fallback`;
    const staleRef = `observation:obs-${domain.name}-stale-article`;
    const website = `https://${domain.name}-fallback.example/`;
    const repairedResponse = strictV2Response(domain, ref);
    const incompleteResponse = structuredClone(repairedResponse);
    incompleteResponse.familyB.e.push(staleRef);
    incompleteResponse.familyB.d.timingTriggers = [{
      l: 'Archived industry overview',
      e: [staleRef],
      q: 'Archived industry overview'
    }];
    incompleteResponse.evidenceExperiment.x =
      `Review first: for 14 days or 25 qualified visits, send a newsletter and test organic search for ${domain.buyer} seeking ${domain.offer} through ${domain.destination}; count ${domain.outcome} and store ${domain.attribution}.`;
    let calls = 0;
    const result = await runOpportunityTournament({
      job: {
        id: `job-${domain.name}-owned-asset-fallback`,
        payload: {
          researchOnly: true,
          objective: {
            outcome: `Generate one new attributed ${domain.outcome}.`,
            successMetric: domain.outcome
          },
          budget: {
            maxHypotheses: 128,
            maxLLMCalls: 2
          },
          evidenceSnapshot: {
            profile: {
              identity: { website }
            },
            sources: [{
              id: `src-${domain.name}-fallback`,
              url: website,
              status: 'monitoring',
              trustLevel: 'high'
            }],
            sourceEvidence: [{
              observationId: `obs-${domain.name}-fallback`,
              sourceId: `src-${domain.name}-fallback`,
              kind: 'service-page',
              title: domain.destination,
              summary: domain.sourceSummary,
              url: `${website}offer`,
              observedAt: '2026-07-29T12:00:00Z',
              confidence: 'high'
            }, {
              observationId:
                `obs-${domain.name}-stale-article`,
              sourceId: `src-${domain.name}-fallback`,
              kind: 'article',
              title: 'Archived industry overview',
              summary:
                'An old informational overview with no current conversion destination.',
              url: `${website}blog/archived-industry-overview`,
              observedAt: '2026-07-29T12:00:00Z',
              publishedAt: '2021-01-01T00:00:00Z',
              confidence: 'high'
            }]
          }
        }
      },
      model: 'test/v2',
      now,
      completeJSON: async () => {
        calls += 1;
        return {
          data: calls === 1
            ? incompleteResponse
            : repairedResponse,
          usage
        };
      }
    });
    if (calls !== 2 ||
        result.status !== 'skipped' ||
        result.nextExperiment?.kind !==
          'strategy_generation_critic_displaced_by_repair' ||
        result.searchSpace?.completeStrategyFamilyCount !== 2 ||
        result.searchSpace?.incompleteStrategyFamilyCount !== 0 ||
        result.searchSpace?.structuredRepair?.attempted !== true ||
        result.searchSpace?.structuredRepair?.succeeded !== true ||
        result.searchSpace?.modelCalls !== 2 ||
        result.usage?.calls !== 2 ||
        result.usage?.successfulCalls !== 2 ||
        result.winner !== null ||
        result.runnerUp !== null ||
        result.result?.resultType !== 'technical_recovery' ||
        result.searchSpace?.commercialCritic?.cause !==
          'commercial_critic_displaced_by_repair' ||
        result.llm?.strategyFamilyRepair?.status !== 'completed' ||
        result.llm?.strategyFamilyRepair?.purpose !==
          'opportunity_tournament_structured_repair' ||
        result.llm?.strategyFamilyRepair?.structuredOutputContract !==
          'opportunity_tournament_commercial_v2' ||
        result.gate?.sideEffects?.outreachAttempts !== 0 ||
        result.gate?.sideEffects?.publishAttempts !== 0 ||
        result.gate?.sideEffects?.providerWrites !== 0) {
      throw new Error(
        `${domain.name} structured-family repair was not profession-neutral: ${JSON.stringify(result)}`
      );
    }
  }
}

function verifyCatalogRankingBeforeFinalCap() {
  const sourceEvidence = Array.from({ length: 130 }, (_, index) => ({
    observationId: `obs-noise-${index}`,
    sourceId: 'src-catalog',
    kind: 'source_evidence',
    title: `High-quality professional case study ${index}`,
    summary:
      'A detailed source-backed professional case study with current evidence.',
    url: `https://catalog.example/case-study-${index}`,
    observedAt: '2026-07-29T00:00:00Z',
    confidence: 'high'
  }));
  sourceEvidence[120] = {
    observationId: 'obs-late-paid-page',
    sourceId: 'src-catalog',
    kind: 'service-page',
    title: 'Paid subscription pricing and signup page',
    summary:
      'Software customers arrive through organic search, sign up for a paid subscription, and the payment receipt source field stores the UTM campaign.',
    url: 'https://catalog.example/pricing',
    observedAt: '2026-07-29T00:00:00Z',
    confidence: 'high'
  };
  const catalog = buildEvidenceCatalog({
    evidenceSnapshot: {
      profile: {
        identity: { website: 'https://catalog.example/' }
      },
      sources: [{
        id: 'src-catalog',
        url: 'https://catalog.example/',
        status: 'monitoring',
        trustLevel: 'high'
      }],
      sourceEvidence
    }
  }, {}, now);
  if (catalog.length !== 64 ||
      !catalog.some((item) =>
        item.id === 'observation:obs-late-paid-page'
      )) {
    throw new Error(
      `late owner-controlled paid page was crowded out before ranking: ${JSON.stringify(catalog.map((item) => item.id))}`
    );
  }
}

async function verifyEmptyEvidenceFailForward() {
  let calls = 0;
  const result = await runOpportunityTournament({
    job: {
      id: 'job-empty-evidence',
      payload: {
        researchOnly: true,
        objective: {
          outcome: 'Generate one new paid outcome.',
          successMetric: 'One attributed payment receipt'
        },
        evidenceSnapshot: {}
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async () => {
      calls += 1;
      throw new Error('must not call provider without evidence');
    }
  });
  const experiment = result.nextExperiment || {};
  if (calls !== 0 ||
      result.status !== 'skipped' ||
      result.result?.resultType !== 'no_grounded_path' ||
      result.result?.allowedChannel !== 'none' ||
      result.result?.recommendedAction !== experiment.action ||
      result.result?.executionAuthorization !== 'none' ||
      result.result?.sideEffectsPerformed !== 0 ||
      experiment.contractVersion !==
        'revenue_evidence_experiment_v1' ||
      experiment.kind !== 'revenue_path_grounding' ||
      experiment.noGroundedPath !== true ||
      !completeBusinessExperimentFields(experiment) ||
      !/No current approved evidence/i.test(experiment.knownFact || '') ||
      !experiment.action?.includes(
        '1 current public paid-offer page or 1 attributable revenue record'
      ) ||
      !experiment.stopCondition?.includes('14 calendar days') ||
      experiment.rerunPolicy?.maxReruns !== 1 ||
      /\b(?:approve source|approve observation|evidence id|crawl|missing_|invalid_)\b/i.test(
        `${experiment.title} ${experiment.action} ${(experiment.missingEvidence || []).join(' ')}`
      )) {
    throw new Error(
      `empty-evidence tournament ended without a plain-language experiment: ${JSON.stringify(result)}`
    );
  }
}
