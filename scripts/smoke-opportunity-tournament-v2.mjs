#!/usr/bin/env node

import {
  buildEvidenceCatalog,
  runOpportunityTournament
} from '../bin/opportunity-tournament.mjs';

const now = new Date('2026-07-30T12:00:00Z');
const usage = {
  prompt_tokens: 1200,
  completion_tokens: 900,
  total_tokens: 2100,
  cost: 0.0042
};

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
      `${label}-seed-contract`
    );
    if (result.status !== 'skipped' ||
        result.searchSpace?.seedContract !== 'invalid' ||
        result.searchSpace?.eligibleCount !== 0 ||
        result.nextExperiment?.missingEvidence?.[0] !==
          'usable_strategy_generation' ||
        result.gate?.decision !== 'block') {
      throw new Error(
        `${label} family-bundle seed contract was silently upgraded: ${JSON.stringify(result)}`
      );
    }
  }
}

async function runDomainWithResponse(domain, response, suffix) {
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
    completeJSON: async () => ({ data: response, usage })
  });
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
