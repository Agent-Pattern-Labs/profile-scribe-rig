#!/usr/bin/env node

import {
  buildEvidenceCatalog,
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
        result.searchSpace?.eligibleCount !== 0 ||
        experiment.contractVersion !==
          'revenue_evidence_experiment_v1' ||
        experiment.title !==
          'Measure paid home visits from organic search' ||
        experiment.asset?.publicUrl !==
          'https://healthcare.example/offer' ||
        !completeBusinessExperimentFields(experiment) ||
        experiment.knownFact !== domain.sourceSummary ||
        experiment.buyer !== domain.buyer ||
        experiment.paidOffer !== domain.offer ||
        experiment.acquisitionMechanism !== 'organic search' ||
        experiment.conversionDestination !== domain.destination ||
        experiment.paidConversion !== domain.outcome ||
        experiment.attributionSignal !== domain.attribution ||
        !experiment.action?.includes(domain.buyer) ||
        !experiment.action?.includes(domain.offer) ||
        !experiment.action?.includes('organic search') ||
        !experiment.action?.includes(domain.destination) ||
        !experiment.action?.includes('14') ||
        !experiment.action?.includes('25') ||
        !experiment.stopCondition?.includes(
          '25 qualified visits or 14 calendar days'
        ) ||
        /\b(?:approve source|approve observation|evidence id|crawl|missing_|invalid_)\b/i.test(
          `${experiment.title} ${experiment.action} ${experiment.successSignal} ${(experiment.missingEvidence || []).join(' ')}`
        ) ||
        experiment.rerunPolicy?.maxReruns !== 1) {
      throw new Error(
        `healthcare no-winner fallback was not evidence-specific: ${JSON.stringify(result)}`
      );
    }
  } else {
    if (result.status !== 'completed' ||
        result.nextExperiment !== null ||
        result.searchSpace?.seedContract !==
          'revenue_family_bundle_v2' ||
        result.searchSpace?.coherenceGate !==
          'acquisition_mode_family_v3' ||
        result.searchSpace?.revenuePathContract !==
          'incremental_revenue_v2' ||
        result.searchSpace?.eligibleCount < 2 ||
        result.winner?.revenuePath?.contractVersion !==
          'incremental_revenue_v2' ||
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
await verifySaaSTimingRepair();
await verifyNoncurrentWarmReferralRejected();
await verifyUnsafeGeneratedExperimentRejected();
await verifyInvalidSeedContractsRejected();
await verifyLengthFinishedStructuredRepair();
await verifyThrownLengthStructuredRepair();
await verifyProviderSpendBudgetRecovery();
await verifyMaximumTournamentSpendCeiling();
await verifyRepeatedLengthFinishFailsClosed();
await verifyBettyProductionTraceRegression();
await verifyStructuredRepairAcrossDomains();
verifyCatalogRankingBeforeFinalCap();
await verifyEmptyEvidenceFailForward();

console.log(
  'profile-scribe-rig profession-neutral opportunity tournament v2 smoke check passed.'
);

async function runDomain(domain) {
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
          maxLLMCalls: 1,
          maxOutputTokens: 8000
        },
        evidenceSnapshot: sourceSnapshot
      }
    },
    model: 'test/v2',
    now,
    completeJSON: async () => ({
      data: response,
      usage,
      generationId: `gen-${domain.name}`
    })
  });
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
        contractVersion: 'incremental_revenue_v2',
        revenueMechanism: domain.mechanism,
        incrementalIncomeOutcome:
          `One new ${domain.outcome} adds incremental gross income`,
        acquisitionMode: 'inbound',
        conversionAction:
          `Use one organic-search inbound path to ${domain.destination} for ${domain.offer} and complete ${domain.outcome}`,
        observableRevenueOutcome: domain.outcome,
        attributionMethod: domain.attributionMethod,
        attributionSignal: domain.attribution,
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
      }],
      proofPoints: [item(domain.sourceSummary)],
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
      result.searchSpace?.eligibleCount !== 1 ||
      result.hypotheses?.some((hypothesis) =>
        hypothesis.provenance?.strategyFamilyId !== 'family-b'
      )) {
    throw new Error(
      `family.m mismatch crossed the v2 acquisition coherence gate: ${JSON.stringify(result)}`
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
      reasons.noncurrent_or_negative_paid_conversion_evidence < 1) {
    throw new Error(
      `stale/free/negative warm-referral evidence survived v2 revenue validation: ${JSON.stringify(result)}`
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
      experiment.acquisitionMechanism !== 'organic search' ||
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
      result.status !== 'completed' ||
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
      repairSchema?.properties?.familyA?.properties?.d?.properties
        ?.o?.minItems !== 1 ||
      repairSchema?.properties?.familyA?.properties?.d?.properties
        ?.o?.maxItems !== 1 ||
      'previousResponse' in repairInput ||
      repairUser.includes('PRIOR_RESPONSE_CANARY_') ||
      repairUser.includes('PRIOR_RESPONSE_PADDING_') ||
      Buffer.byteLength(repairUser, 'utf8') > 30_000 ||
      result.winner == null ||
      result.runnerUp == null) {
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
  if (result.status !== 'completed' ||
      result.searchSpace?.structuredRepair?.initialIssue !==
        'output_length_truncated' ||
      result.searchSpace?.structuredRepair?.succeeded !== true ||
      result.llm?.strategyGeneratorJudge?.status !== 'failed' ||
      result.llm?.strategyGeneratorJudge?.error !==
        'openrouter_truncated_structured_output' ||
      result.llm?.strategyFamilyRepair?.status !== 'completed' ||
      result.usage?.calls !== 2 ||
      result.usage?.successfulCalls !== 1 ||
      result.winner == null) {
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
      validZeroCost.status !== 'completed' ||
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
  const sourceEvidence = Array.from({ length: 80 }, (_, index) => ({
    observationId: `obs-max-${index}`,
    sourceId,
    kind: index === 0 ? 'service-page' : 'case-study',
    title: index === 0
      ? domain.destination
      : `Evidence ${index} ${'T'.repeat(180)}`,
    summary: index === 0
      ? domain.sourceSummary
      : `Current source-backed commercial case study ${index} ${
          'S'.repeat(420)
        }`,
    url: index === 0
      ? `${website}offer`
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
      result.status !== 'completed' ||
      initialTask.evidenceCatalog?.length !== 64 ||
      !initialTask.evidenceCatalog?.some((item) => item.id === ref) ||
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
      initialCeiling + repairCeiling > 400_000) {
    throw new Error(
      `maximum legal tournament did not fit the exact two-call hard ceiling: ${JSON.stringify({
        status: result.status,
        evidenceCount: initialTask.evidenceCatalog?.length,
        requestCount: requests.length,
        initialBytes,
        repairBytes,
        initialCeiling,
        repairCeiling,
        totalCeiling: initialCeiling + repairCeiling,
        repairTrace
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
          maxLLMCalls: 1,
          maxOutputTokens: 8000
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
    completeJSON: async () => ({ data: response, usage, diagnostics })
  });
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
      repairedExperiment.asset?.publicUrl !==
        'https://www.breastfeedingwithlove.com/' ||
      !completeBusinessExperimentFields(repairedExperiment) ||
      repairedExperiment.knownFact !== domain.sourceSummary ||
      repairedExperiment.buyer !== domain.buyer ||
      repairedExperiment.paidOffer !== domain.offer ||
      repairedExperiment.acquisitionMechanism !== 'organic search' ||
      repairedExperiment.conversionDestination !== domain.destination ||
      repairedExperiment.paidConversion !== domain.outcome ||
      repairedExperiment.attributionSignal !== domain.attribution ||
      /Baby Friendly Initiative/i.test(
        `${repairedExperiment.title} ${repairedExperiment.action} ${repairedExperiment.successSignal}`
      ) ||
      !repairedExperiment.action?.includes(domain.buyer) ||
      !repairedExperiment.action?.includes(domain.offer) ||
      !repairedExperiment.action?.includes('organic search') ||
      !repairedExperiment.action?.includes(domain.destination) ||
      !repairedExperiment.action?.includes(domain.attribution) ||
      repairedResult.gate?.decision !==
        'needs_more_approved_evidence') {
    throw new Error(
      `Betty structured-family repair did not yield the grounded bounded experiment: ${JSON.stringify(repairedResult)}`
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
        result.status !== 'completed' ||
        result.nextExperiment !== null ||
        result.searchSpace?.completeStrategyFamilyCount !== 2 ||
        result.searchSpace?.incompleteStrategyFamilyCount !== 0 ||
        result.searchSpace?.structuredRepair?.attempted !== true ||
        result.searchSpace?.structuredRepair?.succeeded !== true ||
        result.searchSpace?.modelCalls !== 2 ||
        result.usage?.calls !== 2 ||
        result.usage?.successfulCalls !== 2 ||
        result.winner == null ||
        result.runnerUp == null ||
        !new RegExp(expectations[domain.name], 'i').test(
          result.winner?.revenuePath?.attributionSignal || ''
        ) ||
        result.llm?.strategyFamilyRepair?.status !== 'completed' ||
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
      experiment.contractVersion !==
        'revenue_evidence_experiment_v1' ||
      experiment.kind !== 'revenue_path_grounding' ||
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
