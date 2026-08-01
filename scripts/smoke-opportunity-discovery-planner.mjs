#!/usr/bin/env node

import {
  OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
  PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID,
  buildEvidenceCatalog,
  commercialDiscoveryAttemptLedgerHash,
  runOpportunityTournament,
  runOpportunityDiscoveryPlanner
} from '../bin/opportunity-tournament.mjs';

const now = new Date('2026-08-01T12:00:00Z');
const usage = {
  prompt_tokens: 900,
  completion_tokens: 650,
  total_tokens: 1550,
  cost: 0.0065
};
const MAX_REPRESENTATIVE_PLANNER_RESPONSE_BYTES = 18 * 1024;
let largestPlannerResponseBytes = 0;
let largestPlannerRequestBytes = 0;
let largestPlannerContractBytes = 0;

const cases = [
  {
    name: 'lactation referral reasoning',
    profile: {
      identity: {
        fullName: 'Local Care Professional',
        profession: 'IBCLC lactation consultant',
        headline: 'Paid newborn-feeding home visits',
        location: 'New York, New York, United States',
        specialties: ['newborn feeding', 'lactation home visits'],
        serviceAreas: ['Queens', 'Manhattan']
      }
    },
    evidence: 'Parents can request current paid or reimbursable lactation home visits through the owner booking page.',
    plans: (ref) => [
      plan({
        id: 'newborn_referral_authority',
        priority: 1,
        searchMode: 'professional_counterparty',
        commercialRole: 'referral_partner',
        acquisitionMode: 'partner_channel',
        buyer: 'Nearby parents who need paid newborn-feeding care',
        counterparty: 'A newborn-serving clinical referral authority',
        paidOffer: 'Paid or reimbursable lactation home visit',
        evidenceRefs: [ref],
        query: 'pediatrician newborn care Queens New York',
        market: 'Queens, New York',
        targetRoleTerms: ['pediatrician', 'practice manager', 'midwife'],
        organizationTerms: ['pediatric practice', 'birth center'],
        acquisitionMechanism: 'One review-first request for inclusion in a newborn referral resource',
        conversionDestination: 'The verified owner booking page',
        paidConversion: 'One completed paid or reimbursed consultation',
        attributionSignal: 'Booking referral source stores the selected practice and tournament id'
      }),
      plan({
        id: 'newborn_practice_channel',
        priority: 2,
        searchMode: 'local_organization',
        commercialRole: 'referral_partner',
        acquisitionMode: 'partner_channel',
        buyer: 'Nearby parents who need paid newborn-feeding care',
        counterparty: 'A current newborn-serving practice',
        paidOffer: 'Paid or reimbursable lactation home visit',
        evidenceRefs: [ref],
        query: 'newborn pediatric practice Queens New York',
        market: 'Queens, New York',
        organizationTerms: ['pediatric practice', 'birth center'],
        acquisitionMechanism: 'One reviewed practice partner-referral request',
        conversionDestination: 'The verified owner booking page',
        paidConversion: 'One completed paid or reimbursed consultation',
        attributionSignal: 'Booking referral source stores the selected practice and tournament id'
      })
    ]
  },
  {
    name: 'programmer live compensated demand',
    profile: {
      identity: {
        fullName: 'API Builder',
        profession: 'Software engineer',
        headline: 'Go and PostgreSQL production API engineer',
        location: 'United States'
      },
      skills: [{ name: 'Go' }, { name: 'PostgreSQL' }]
    },
    evidence: 'Shipped production APIs in Go backed by PostgreSQL.',
    plans: (ref) => [
      plan({
        id: 'active_backend_role',
        priority: 1,
        searchMode: 'active_job_posting',
        commercialRole: 'paid_demand',
        acquisitionMode: 'permissioned_outreach',
        buyer: 'An employer with a current compensated backend requirement',
        counterparty: 'The employer named on an active role',
        paidOffer: 'Compensated Go and PostgreSQL engineering work',
        evidenceRefs: [ref],
        query: 'active Go PostgreSQL backend engineer role',
        market: 'United States',
        jobTitle: 'Go backend engineer',
        skills: ['Go', 'PostgreSQL'],
        acquisitionMechanism: 'One tailored review-first application to the active role',
        conversionDestination: 'The official application page',
        paidConversion: 'A signed compensated contract or employment offer',
        attributionSignal: 'Application opportunity id is linked to the signed offer'
      }),
      plan({
        id: 'public_backend_contract',
        priority: 2,
        searchMode: 'public_live_demand',
        commercialRole: 'paid_demand',
        acquisitionMode: 'partner_channel',
        buyer: 'An organization publishing a current paid backend contract',
        counterparty: 'The contracting organization',
        paidOffer: 'Compensated Go and PostgreSQL implementation',
        evidenceRefs: [ref],
        query: 'Go PostgreSQL backend contract RFP open',
        market: 'United States',
        skills: ['Go', 'PostgreSQL'],
        acquisitionMechanism: 'One reviewed response to an open paid contract',
        conversionDestination: 'The official solicitation response page',
        paidConversion: 'A signed paid services contract',
        attributionSignal: 'Solicitation id is stored on the signed contract'
      })
    ]
  },
  {
    name: 'consultant open buying demand',
    profile: {
      identity: {
        fullName: 'Delivery Advisor',
        profession: 'Operations consultant',
        headline: 'Paid delivery-system consulting for service firms',
        location: 'United States'
      }
    },
    evidence: 'Offers a paid delivery-system diagnostic and implementation engagement.',
    plans: (ref) => [
      plan({
        id: 'open_operations_solicitation',
        priority: 1,
        searchMode: 'public_live_demand',
        commercialRole: 'paid_demand',
        acquisitionMode: 'permissioned_outreach',
        buyer: 'An organization with a current paid operations solicitation',
        counterparty: 'The contracting organization',
        paidOffer: 'Paid delivery-system consulting engagement',
        evidenceRefs: [ref],
        query: 'open operations consulting RFP delivery systems',
        market: 'United States',
        organizationTerms: ['contracting organization'],
        acquisitionMechanism: 'One review-first response to the open solicitation',
        conversionDestination: 'The official response destination',
        paidConversion: 'A signed paid consulting contract',
        attributionSignal: 'Solicitation id is stored on the contract and invoice'
      }),
      plan({
        id: 'service_firm_buyer',
        priority: 2,
        searchMode: 'professional_counterparty',
        commercialRole: 'buyer',
        acquisitionMode: 'partner_channel',
        buyer: 'A service firm buying delivery-system consulting',
        counterparty: 'An operations owner at a service firm',
        paidOffer: 'Paid delivery-system diagnostic',
        evidenceRefs: [ref],
        query: 'service firm operations owner delivery systems',
        market: 'United States',
        targetRoleTerms: ['chief operating officer', 'head of operations'],
        organizationTerms: ['professional services firm'],
        acquisitionMechanism: 'One reviewed partner-mediated diagnostic offer',
        conversionDestination: 'The verified proposal and contract destination',
        paidConversion: 'A signed paid diagnostic contract',
        attributionSignal: 'CRM source stores the selected organization and tournament id'
      })
    ]
  },
  {
    name: 'product founder marketplace and buyer paths',
    profile: {
      identity: {
        fullName: 'Workflow Founder',
        profession: 'SaaS founder',
        headline: 'Paid workflow software for field-service teams',
        location: 'United States'
      }
    },
    evidence: 'The owner site has current paid workflow-software pricing and signup.',
    plans: (ref) => [
      plan({
        id: 'workflow_marketplace_demand',
        priority: 1,
        searchMode: 'public_live_demand',
        commercialRole: 'paid_demand',
        acquisitionMode: 'inbound',
        buyer: 'A field-service team evaluating paid workflow software',
        counterparty: 'A marketplace or comparison surface with current category demand',
        paidOffer: 'Paid workflow-software subscription',
        evidenceRefs: [ref],
        query: 'field service workflow software marketplace request',
        market: 'United States',
        organizationTerms: ['field service software marketplace'],
        acquisitionMechanism: 'One reviewed listing or response on the discovered demand surface',
        conversionDestination: 'The verified pricing and signup page',
        paidConversion: 'One paid software subscription',
        attributionSignal: 'Signup UTM and payment receipt store the demand surface'
      }),
      plan({
        id: 'field_service_buyer',
        priority: 2,
        searchMode: 'professional_counterparty',
        commercialRole: 'buyer',
        acquisitionMode: 'permissioned_outreach',
        buyer: 'A field-service company buying workflow software',
        counterparty: 'An operations technology decision-maker',
        paidOffer: 'Paid workflow-software subscription',
        evidenceRefs: [ref],
        query: 'field service operations technology director',
        market: 'United States',
        targetRoleTerms: ['operations director', 'technology director'],
        organizationTerms: ['field service company'],
        acquisitionMechanism: 'One review-first tailored demo invitation',
        conversionDestination: 'The verified pricing and signup page',
        paidConversion: 'One paid software subscription',
        attributionSignal: 'CRM source and payment receipt store the selected company and tournament id'
      })
    ]
  }
];

for (const scenario of cases) {
  const job = plannerJob(scenario);
  const catalog = buildEvidenceCatalog(job.payload, {}, now, {
    includeSystemAttributionCapability: true
  });
  const evidenceRef = catalog.find((item) =>
    typeof item.id === 'string' && item.id.startsWith('observation:')
  )?.id;
  if (!evidenceRef) {
    throw new Error(`${scenario.name}: fixture produced no approved evidence id`);
  }
  const systemAttributionCapability = catalog.find((item) =>
    item.id ===
      PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
  );
  if (!systemAttributionCapability ||
      systemAttributionCapability.verifiedSystemCapability !== true ||
      systemAttributionCapability.systemCapabilitySource !==
        'profilescribe_control_plane' ||
      systemAttributionCapability.systemCapabilityProvenance !==
        'verified_system_capability' ||
      JSON.stringify(systemAttributionCapability.systemCapabilityRoles) !==
        JSON.stringify(['attribution'])) {
    throw new Error(
      `${scenario.name}: missing typed system attribution capability`
    );
  }
  let requestSeen = null;
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      requestSeen = request;
      const responseData = {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'These distinct searches are the closest supported paths to current paid demand or a qualified commercial channel.',
        plans: scenario.plans(evidenceRef)
      };
      if (scenario.name === 'lactation referral reasoning') {
        // These values are individually schema-valid but contradict their
        // containing motion. They are protocol structure, not commercial
        // facts, so normalization must bind them deterministically without a
        // second model call.
        responseData.plans[0].targetSlot.commercialRole = 'buyer';
        responseData.plans[0].targetSlot.requiredEvidenceRoles = [
          'defined_buyer'
        ];
        responseData.plans[0].contingentFinalists.familyA.e = [
          'target:evidence'
        ];
      }
      const responseBytes = Buffer.byteLength(
        JSON.stringify(responseData),
        'utf8'
      );
      largestPlannerResponseBytes = Math.max(
        largestPlannerResponseBytes,
        responseBytes
      );
      if (responseBytes > MAX_REPRESENTATIVE_PLANNER_RESPONSE_BYTES) {
        throw new Error(
          `${scenario.name}: valid call-1 response is ${responseBytes} bytes, outside the conservative 6,000-token envelope`
        );
      }
      return {
        data: responseData,
        usage,
        generationId: `generation-${scenario.name.replace(/\W+/g, '-')}`,
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 800,
          contentSha256: 'a'.repeat(64)
        },
        annotations: [{
          type: 'url_citation',
          url_citation: {
            url: `https://market.example/${scenario.name.replace(/\W+/g, '-')}`,
            title: `${scenario.name} public commercial result | tel:+1-212-555-0199`,
            content: 'Current public professional organization or paid demand page for review. Call (212) 555-0199 or email intake@market.example.'
          }
        }]
      };
    }
  });
  if (!requestSeen ||
      requestSeen.responseFormat?.json_schema?.name !==
        OPPORTUNITY_DISCOVERY_PLAN_CONTRACT ||
      requestSeen.plugins?.[0]?.id !== 'web' ||
      requestSeen.plugins?.[0]?.engine !== 'exa' ||
      requestSeen.plugins?.[0]?.max_results !== 5 ||
      result.status !== 'planned' ||
      result.contractVersion !== OPPORTUNITY_DISCOVERY_PLAN_CONTRACT ||
      result.plans.length !== 2 ||
      result.plans.some((item) =>
        item.evidenceRefs.length === 0 ||
        !item.query ||
        !item.paidOffer ||
        !item.paidConversion ||
        !item.attributionSignal
      ) ||
      result.usage.calls !== 1 ||
      result.usage.successfulCalls !== 1 ||
      result.webSearchReceipt?.resultCount !== 1 ||
      !result.webSearchReceipt?.annotations?.[0]?.content?.includes(
        'Current public professional organization'
      ) ||
      /(?:@|tel:|212[ .-]?555|intake)/i.test(
        `${result.webSearchReceipt?.annotations?.[0]?.title || ''} ${result.webSearchReceipt?.annotations?.[0]?.content || ''}`
      ) ||
      result.webSearchReceipt?.requestHash !==
        result.preflight?.requestBodySha256 ||
      result.webSearchReceipt?.injectedContextTokenReserve !== 1_047_576 ||
      result.webSearchReceipt?.costIncludedInLLMReceipt !== true ||
      result.preflight?.promptTokenCeiling !== 1_047_576 ||
      result.preflight?.callSpendCeilingMicros !== 553_631 ||
      !(result.preflight?.responseBodyByteCount > 0) ||
      result.preflight?.responseBodyByteCount >
        MAX_REPRESENTATIVE_PLANNER_RESPONSE_BYTES ||
      result.preflight?.maxResponseBodyByteCount !==
        MAX_REPRESENTATIVE_PLANNER_RESPONSE_BYTES ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `${scenario.name}: generic discovery plan failed ${JSON.stringify(result)}`
    );
  }
  largestPlannerRequestBytes = Math.max(
    largestPlannerRequestBytes,
    result.preflight?.requestBodyByteCount || 0
  );
  if (result.preflight?.requestBodyByteCount > 36 * 1024) {
    throw new Error(
      `${scenario.name}: call-1 request exceeded the 36 KiB provider envelope`
    );
  }
  const plannerPrompt = JSON.parse(requestSeen.user || '{}');
  const promptWithoutContract = { ...plannerPrompt };
  delete promptWithoutContract.outputContract;
  delete promptWithoutContract.hardRules;
  const requestWithoutContract = {
    ...requestSeen,
    user: JSON.stringify(promptWithoutContract)
  };
  largestPlannerContractBytes = Math.max(
    largestPlannerContractBytes,
    Buffer.byteLength(JSON.stringify(requestSeen), 'utf8') -
      Buffer.byteLength(JSON.stringify(requestWithoutContract), 'utf8')
  );
  if (!plannerPrompt.outputContract?.targetRoleMap ||
      !plannerPrompt.outputContract?.revenuePath ||
      !Array.isArray(plannerPrompt.hardRules) ||
      plannerPrompt.hardRules.length < 7) {
    throw new Error(
      `${scenario.name}: call 1 omitted its compact semantic contract`
    );
  }
  if (scenario.name === 'lactation referral reasoning') {
    const normalizedMotion = result.plans[0];
    const expectedRoles = [
      'acquisition',
      'channel_fit',
      'prospective_partner'
    ];
    if (normalizedMotion.targetSlot?.commercialRole !==
          normalizedMotion.commercialRole ||
        JSON.stringify(normalizedMotion.targetSlot?.requiredEvidenceRoles) !==
          JSON.stringify(expectedRoles) ||
        !normalizedMotion.contingentFinalists?.familyA?.e?.includes(
          evidenceRef
        ) ||
        !normalizedMotion.contingentFinalists?.familyA?.e?.includes(
          'target:evidence'
        )) {
      throw new Error(
        `call-1 structural binding drift was not canonicalized: ${JSON.stringify(normalizedMotion)}`
      );
    }
  }
  const projectedSystemCapability = plannerPrompt.evidenceCatalog?.find(
    (item) => item.id ===
      PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
  );
  if (!projectedSystemCapability ||
      projectedSystemCapability.verifiedSystemCapability !== true ||
      projectedSystemCapability.systemCapabilityProvenance !==
        'verified_system_capability' ||
      JSON.stringify(projectedSystemCapability.systemCapabilityRoles) !==
        JSON.stringify(['attribution'])) {
    throw new Error(
      `${scenario.name}: call 1 dropped the typed attribution capability`
    );
  }
  const projectedSystemGraphNode =
    plannerPrompt.commercialEvidenceGraph?.nodes?.find((item) =>
      item.evidenceRef ===
        PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
    );
  if (!projectedSystemGraphNode ||
      projectedSystemGraphNode.provenance !==
        'verified_system_capability' ||
      projectedSystemGraphNode.verifiedSystemCapability !== true ||
      JSON.stringify(projectedSystemGraphNode.roles) !==
        JSON.stringify(['attribution'])) {
    throw new Error(
      `${scenario.name}: call 1 commercial graph broadened or dropped system attribution`
    );
  }
}

const unsafeScenario = cases[0];
const unsafeJob = plannerJob(unsafeScenario);
const unsafeCatalog = buildEvidenceCatalog(unsafeJob.payload, {}, now, {
  includeSystemAttributionCapability: true
});
const unsafeRef = unsafeCatalog.find((item) =>
  typeof item.id === 'string' && item.id.startsWith('observation:')
)?.id;
const unsafeResult = await runOpportunityDiscoveryPlanner({
  job: unsafeJob,
  model: 'openai/gpt-4.1-mini',
  now,
  completeJSON: async () => ({
    data: {
      contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
      status: 'planned',
      reason: 'Unsafe direct consumer targeting.',
      plans: [
        plan({
          id: 'unsafe_patient_search',
          priority: 1,
          searchMode: 'professional_counterparty',
          commercialRole: 'buyer',
          acquisitionMode: 'permissioned_outreach',
          buyer: 'People seeking care',
          counterparty: 'An identifiable person',
          paidOffer: 'Paid consultation',
          evidenceRefs: [unsafeRef],
          query: 'postpartum patients private email mobile phone',
          targetRoleTerms: ['postpartum patient'],
          acquisitionMechanism: 'Direct message',
          conversionDestination: 'Booking page',
          paidConversion: 'Paid consultation',
          attributionSignal: 'Booking source'
        }),
        plan({
          id: 'unsafe_patient_search_two',
          priority: 2,
          searchMode: 'local_organization',
          commercialRole: 'buyer',
          acquisitionMode: 'inbound',
          buyer: 'People seeking care',
          counterparty: 'An identifiable person',
          paidOffer: 'Paid consultation',
          evidenceRefs: [unsafeRef],
          query: 'pregnant women home address',
          organizationTerms: ['pregnant women'],
          acquisitionMechanism: 'Direct targeting',
          conversionDestination: 'Booking page',
          paidConversion: 'Paid consultation',
          attributionSignal: 'Booking source'
        })
      ]
    },
    usage,
    generationId: 'generation-unsafe',
    diagnostics: {
      finishReason: 'stop',
      nativeFinishReason: 'stop',
      contentByteCount: 500,
      contentSha256: 'b'.repeat(64)
    }
  })
});
if (unsafeResult.status !== 'blocked' ||
    !/patient|sensitive|private-contact/i.test(unsafeResult.reason) ||
    unsafeResult.plans.length !== 0 ||
    unsafeResult.sideEffectsPerformed !== 0) {
  throw new Error(
    `unsafe discovery plan was not fail-closed: ${JSON.stringify(unsafeResult)}`
  );
}

await verifySemanticDriftFailsClosed(unsafeJob, unsafeRef);
await verifyOneMotionWithTwoCausalFamilies(unsafeJob, unsafeRef);
await verifyTwoStageTargetBinding();

process.stdout.write(
  `opportunity discovery planner smoke passed (${cases.length} professions + unsafe adversary + one-motion/two-family tolerance + two-stage target binding; largest request ${largestPlannerRequestBytes} bytes / <=${36 * 1024}; semantic contract +${largestPlannerContractBytes} bytes; largest valid call-1 response ${largestPlannerResponseBytes} bytes / <=${Math.ceil(largestPlannerResponseBytes / 3)} conservative JSON tokens)\n`
);

async function verifyOneMotionWithTwoCausalFamilies(job, evidenceRef) {
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'One grounded motion contains two distinct causal tactics.',
        plans: [cases[0].plans(evidenceRef)[0]]
      },
      usage,
      generationId: 'generation-one-motion-two-families',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 700,
        contentSha256: '1'.repeat(64)
      },
      annotations: [{
        type: 'url_citation',
        url_citation: {
          url: 'https://riverside-pediatrics.example/newborn-care',
          title: 'Riverside Pediatrics newborn care',
          content: 'Current public newborn-care practice in Queens.'
        }
      }]
    })
  });
  if (result.status !== 'planned' ||
      result.plans.length !== 1 ||
      !result.plans[0].contingentFinalists?.familyA ||
      !result.plans[0].contingentFinalists?.familyB ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `one grounded motion with two causal families was rejected: ${JSON.stringify(result)}`
    );
  }
}

async function verifySemanticDriftFailsClosed(job, evidenceRef) {
  const checks = [
    {
      name: 'family acquisition mode drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.m = 'inbound';
      },
      reason: /tactic families/i
    },
    {
      name: 'primary action target binding drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, request one paid partner referral without an exact target.';
      },
      reason: /primary action|target token/i
    }
  ];
  for (const check of checks) {
    const plans = cases[0].plans(evidenceRef);
    check.mutate(plans);
    const result = await runOpportunityDiscoveryPlanner({
      job,
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => ({
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: 'Schema-valid but semantically inconsistent fixture.',
          plans
        },
        usage,
        generationId: `generation-${check.name.replace(/\W+/g, '-')}`,
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 900,
          contentSha256: 'f'.repeat(64)
        }
      })
    });
    if (result.status !== 'blocked' ||
        !check.reason.test(result.reason) ||
        result.plans.length !== 0 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${check.name} did not fail closed: ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyTwoStageTargetBinding() {
  const scenario = cases[0];
  const planner = plannerJob(scenario);
  const catalog = buildEvidenceCatalog(planner.payload, {}, now, {
    includeSystemAttributionCapability: true
  });
  const evidenceRef = catalog.find((item) =>
    typeof item.id === 'string' && item.id.startsWith('observation:')
  )?.id;
  const discoveryPlan = await runOpportunityDiscoveryPlanner({
    job: planner,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'Two exact, source-bindable referral searches are warranted.',
        plans: scenario.plans(evidenceRef)
      },
      usage,
      generationId: 'generation-two-stage-planner',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 900,
        contentSha256: 'c'.repeat(64)
      },
      annotations: [{
        type: 'url_citation',
        url_citation: {
          url: 'https://riverside-pediatrics.example/newborn-care',
          title: 'Riverside Pediatrics newborn care',
          content: 'Riverside Pediatrics is a current pediatric practice serving newborns in Queens.'
        }
      }]
    })
  });
  if (discoveryPlan.status !== 'planned') {
    throw new Error(
      `two-stage planner setup failed: ${JSON.stringify(discoveryPlan)}`
    );
  }
  const selectedMotion = discoveryPlan.plans[0];
  const attempt = {
    id: 'attempt-two-stage-person-search',
    provider: 'people_data_labs_person_search',
    operation: 'planned_professional_search',
    queryHash: 'd'.repeat(64),
    status: 'succeeded',
    estimatedSpendMicros: 280_000,
    actualSpendMicros: 280_000,
    creditsUsed: 1,
    resultCount: 1,
    reservedAt: '2026-08-01T12:01:00Z',
    updatedAt: '2026-08-01T12:01:01Z',
    completedAt: '2026-08-01T12:01:01Z'
  };
  const targetEvidenceRef =
    'external_discovery:111111111111111111111111';
  const targetCandidateId =
    'candidate:external:222222222222222222222222';
  const downstreamPayload = {
    ...planner.payload,
    algorithmVersion: 'cheap_tournament_v6',
    budget: {
      currency: 'USD',
      maxSpendMicros: 1_000_000,
      maxLLMSpendMicros: 160_000,
      maxLLMCalls: 1,
      maxOutputTokens: 1_200,
      maxHypotheses: 10_000,
      maxFinalists: 8,
      hardStop: true
    },
    commercialDiscoveryEvidence: {
      contractVersion: 'commercial_discovery_evidence_v1',
      attempted: true,
      status: 'found',
      motion: selectedMotion.id,
      buyerArchetype: selectedMotion.buyer,
      queryHash: commercialDiscoveryAttemptLedgerHash([attempt]),
      market: selectedMotion.market,
      providersAttempted: ['people_data_labs_person_search'],
      providerCalls: 1,
      paidProviderCalls: 1,
      creditsUsed: 1,
      resultCount: 1,
      patientTargetingExcluded: true,
      sideEffectsPerformed: 0,
      attempts: [attempt],
      plan: discoveryPlan,
      evidence: [{
        motionId: selectedMotion.id,
        evidenceRef: targetEvidenceRef,
        kind: 'verified_external_professional_target',
        label: 'Dr. Ava Rivera at Riverside Pediatrics',
        summary: 'Dr. Ava Rivera is a current pediatrician at Riverside Pediatrics in Queens and a prospective professional partner for a newborn-care referral channel. This public professional record does not establish a warm relationship, willingness, permission, or patient demand.',
        url: 'https://riverside-pediatrics.example/ava-rivera',
        provider: 'people_data_labs_person_search',
        provenance: 'people_data_labs_professional_record',
        roles: ['acquisition', 'channel_fit', 'prospective_partner'],
        verified: true,
        observedAt: '2026-08-01T12:01:01Z'
      }],
      candidates: [{
        motionId: selectedMotion.id,
        id: targetCandidateId,
        kind: 'person',
        displayLabel: 'Dr. Ava Rivera',
        organization: 'Riverside Pediatrics',
        role: 'Pediatrician',
        commercialRole: 'referral_partner',
        market: 'Queens, New York',
        publicUrl: 'https://riverside-pediatrics.example/ava-rivera',
        provider: 'people_data_labs_person_search',
        evidenceRefs: [targetEvidenceRef],
        contactPaths: [{
          kind: 'public_professional_url',
          available: true,
          verified: true,
          reference: 'https://riverside-pediatrics.example/ava-rivera'
        }],
        exactNamedCandidate: true,
        identityResolved: true
      }],
      discoveredAt: '2026-08-01T12:01:01Z'
    }
  };
  const requests = [];
  const result = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-target-binding',
      kind: 'opportunity_tournament',
      payload: downstreamPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      requests.push(request);
      if (request.responseFormat?.json_schema?.name !==
          'opportunity_tournament_critic_v1') {
        throw new Error('two-stage path dispatched an unauthorized downstream generator or repair call');
      }
      const task = JSON.parse(request.user || '{}');
      const finalists = task.finalists || [];
      const ordering = finalists.map((item) => item.finalistId);
      return {
        data: {
          criticContract: 'opportunity_tournament_critic_v1',
          selectedOrdering: ordering,
          selectedFinalistId: ordering[0],
          comparisons: finalists.map((item, index) => ({
            finalistId: item.finalistId,
            verdict: 'accept',
            activeRevenueAction: true,
            causalAcquisitionPath: true,
            incrementalRevenueOutcome: true,
            incrementalRevenue: index === 0 ? 'strong' : 'moderate',
            evidenceStrength: index === 0 ? 'strong' : 'moderate',
            reachability: index === 0 ? 'strong' : 'moderate',
            timeToFirstDollar: index === 0 ? 'fast' : 'moderate',
            paidOutcomeProbability: Math.max(0.2, 0.8 - index * 0.08),
            timeToFirstDollarDays: Math.min(30, 7 + index),
            recurringValue: index === 0 ? 'recurring' : 'repeatable',
            cost: 'low',
            effort: index === 0 ? 'low' : 'moderate',
            uncertainty: index === 0 ? 'low' : 'moderate',
            reasonCode: 'active_incremental_path',
            reason: 'The exact target, active referral action, paid booking, attribution field, and numeric stop form a complete incremental path.'
          })),
          reason: 'The ordering follows paid-outcome probability and nearest-cash criteria.'
        },
        usage: {
          prompt_tokens: 800,
          completion_tokens: 400,
          total_tokens: 1_200,
          cost: 0.005
        },
        generationId: 'generation-two-stage-critic',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 700,
          contentSha256: 'e'.repeat(64)
        }
      };
    }
  });
  if (requests.length !== 1 ||
      result.status !== 'completed' ||
      result.usage?.calls !== 1 ||
      result.searchSpace?.modelCalls !== 1 ||
      result.searchSpace?.contingentFinalistSource !==
        'discovery_planner_call_1' ||
      result.searchSpace?.structuredRepair?.attempted !== false ||
      result.llm?.strategyGeneratorJudge ||
      result.llm?.strategyFamilyRepair ||
      !result.llm?.commercialCritic ||
      result.trace?.contingentFinalists?.materialized !== true ||
      result.trace?.contingentFinalists
        ?.exactTargetPresentInEveryPrimaryAction !== true ||
      result.commercialEvidenceGraph?.nodes?.find((node) =>
        node.evidenceRef === targetEvidenceRef
      )?.commercialDiscoveryMotionId !== selectedMotion.id ||
      !result.winner?.action?.includes('Dr. Ava Rivera') ||
      result.winner?.action?.includes('{{TARGET_NAME}}') ||
      result.winner?.candidateId !== targetCandidateId ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `two-stage target binding failed: ${JSON.stringify({ requests: requests.length, result })}`
    );
  }
  const systemNode = result.commercialEvidenceGraph?.nodes?.find((node) =>
    node.evidenceRef ===
      PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
  );
  if (!systemNode ||
      systemNode.provenance !== 'verified_system_capability' ||
      systemNode.verifiedSystemCapability !== true ||
      JSON.stringify(systemNode.roles) !== JSON.stringify(['attribution']) ||
      result.commercialEvidenceGraph?.verifiedFacts?.some((fact) =>
        fact.evidenceRef ===
          PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID &&
        fact.role !== 'attribution'
      )) {
    throw new Error(
      `system attribution capability escaped its sole role: ${JSON.stringify(systemNode)}`
    );
  }

  const multiMotionPayload = structuredClone(downstreamPayload);
  const secondMotion = discoveryPlan.plans[1];
  const secondEvidenceRef =
    'external_discovery:333333333333333333333333';
  const secondCandidateId =
    'candidate:external:444444444444444444444444';
  multiMotionPayload.commercialDiscoveryEvidence.attempts[0].resultCount = 2;
  multiMotionPayload.commercialDiscoveryEvidence.resultCount = 2;
  multiMotionPayload.commercialDiscoveryEvidence.evidence.push({
    motionId: secondMotion.id,
    evidenceRef: secondEvidenceRef,
    kind: 'verified_external_professional_target',
    label: 'Dr. Noor Patel at Summit Pediatrics',
    summary: 'Dr. Noor Patel is a current pediatrician at Summit Pediatrics in Queens and a prospective professional partner for a newborn-care referral channel. This public professional record does not establish a warm relationship, willingness, permission, or patient demand.',
    url: 'https://summit-pediatrics.example/noor-patel',
    provider: 'people_data_labs_person_search',
    provenance: 'people_data_labs_professional_record',
    roles: ['acquisition', 'channel_fit', 'prospective_partner'],
    verified: true,
    observedAt: '2026-08-01T12:01:01Z'
  });
  multiMotionPayload.commercialDiscoveryEvidence.candidates.push({
    motionId: secondMotion.id,
    id: secondCandidateId,
    kind: 'person',
    displayLabel: 'Dr. Noor Patel',
    organization: 'Summit Pediatrics',
    role: 'Pediatrician',
    commercialRole: 'referral_partner',
    market: 'Queens, New York',
    publicUrl: 'https://summit-pediatrics.example/noor-patel',
    provider: 'people_data_labs_person_search',
    evidenceRefs: [secondEvidenceRef],
    contactPaths: [{
      kind: 'public_professional_url',
      available: true,
      verified: true,
      reference: 'https://summit-pediatrics.example/noor-patel'
    }],
    exactNamedCandidate: true,
    identityResolved: true
  });
  const multiMotionRequests = [];
  const multiMotion = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-multi-motion-comparison',
      kind: 'opportunity_tournament',
      payload: multiMotionPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      multiMotionRequests.push(request);
      if (request.responseFormat?.json_schema?.name !==
          'opportunity_tournament_critic_v1') {
        throw new Error('multi-motion path dispatched a generator or repair');
      }
      const task = JSON.parse(request.user || '{}');
      const finalists = task.finalists || [];
      if (finalists.length > 6 ||
          !finalists.some((item) =>
            item.primaryAction?.includes('Dr. Ava Rivera')
          ) ||
          !finalists.some((item) =>
            item.primaryAction?.includes('Summit Pediatrics')
          )) {
        throw new Error(
          `critic did not receive both bounded motions: ${JSON.stringify(finalists)}`
        );
      }
      const ordering = finalists
        .map((item) => item.finalistId)
        .sort((left, right) => {
          const leftAction = finalists.find((item) =>
            item.finalistId === left
          )?.primaryAction || '';
          const rightAction = finalists.find((item) =>
            item.finalistId === right
          )?.primaryAction || '';
          return Number(rightAction.includes('Summit Pediatrics')) -
            Number(leftAction.includes('Summit Pediatrics'));
        });
      return {
        data: {
          criticContract: 'opportunity_tournament_critic_v1',
          selectedOrdering: ordering,
          selectedFinalistId: ordering[0],
          comparisons: finalists.map((item) => ({
            finalistId: item.finalistId,
            verdict: 'accept',
            activeRevenueAction: true,
            causalAcquisitionPath: true,
            incrementalRevenueOutcome: true,
            incrementalRevenue: item.primaryAction?.includes(
              'Summit Pediatrics'
            ) ? 'strong' : 'moderate',
            evidenceStrength: 'strong',
            reachability: 'strong',
            timeToFirstDollar: 'fast',
            paidOutcomeProbability: item.primaryAction?.includes(
              'Summit Pediatrics'
            ) ? 0.9 : 0.6,
            timeToFirstDollarDays: item.primaryAction?.includes(
              'Summit Pediatrics'
            ) ? 5 : 10,
            recurringValue: 'recurring',
            cost: 'low',
            effort: 'low',
            uncertainty: 'low',
            reasonCode: 'active_incremental_path',
            reason: 'The target-bound referral motion has an active, attributable path to paid bookings.'
          })),
          reason: 'The second motion has the stronger exact outside target and nearer paid outcome.'
        },
        usage: {
          prompt_tokens: 900,
          completion_tokens: 450,
          total_tokens: 1_350,
          cost: 0.0055
        },
        generationId: 'generation-two-stage-multi-motion-critic',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 750,
          contentSha256: 'f'.repeat(64)
        }
      };
    }
  });
  if (multiMotionRequests.length !== 1 ||
      multiMotion.status !== 'completed' ||
      multiMotion.trace?.contingentFinalists
        ?.distinctMotionComparison !== true ||
      JSON.stringify(
        multiMotion.trace?.contingentFinalists?.motionIds
      ) !== JSON.stringify([selectedMotion.id, secondMotion.id]) ||
      !multiMotion.winner?.action?.includes('Summit Pediatrics') ||
      multiMotion.winner?.candidateId !== secondCandidateId ||
      multiMotion.searchSpace?.commercialCritic
        ?.criticInputFinalistCount > 6 ||
      multiMotion.usage?.calls !== 1) {
    throw new Error(
      `two valid motions were not compared by the critic: ${JSON.stringify(multiMotion)}`
    );
  }

  const bindingFailurePayload = structuredClone(downstreamPayload);
  bindingFailurePayload.commercialDiscoveryEvidence.candidates[0].kind =
    'organization';
  let bindingFailureCalls = 0;
  const bindingFailure = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-target-binding-failure',
      kind: 'opportunity_tournament',
      payload: bindingFailurePayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => {
      bindingFailureCalls += 1;
      throw new Error('target source-binding failure dispatched an LLM call');
    }
  });
  assertTechnicalRecovery(
    bindingFailure,
    bindingFailureCalls,
    'target source-binding failure'
  );

  const organizationSlotMismatchPayload = structuredClone(
    downstreamPayload
  );
  organizationSlotMismatchPayload.commercialDiscoveryEvidence.plan
    .plans[0].targetSlot.finalTargetKind = 'organization';
  organizationSlotMismatchPayload.commercialDiscoveryEvidence
    .candidates[0].organization = 'Fabricated Pediatrics';
  let organizationSlotMismatchCalls = 0;
  const organizationSlotMismatch = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-organization-slot-mismatch',
      kind: 'opportunity_tournament',
      payload: organizationSlotMismatchPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => {
      organizationSlotMismatchCalls += 1;
      throw new Error('person record bound to an organization target slot');
    }
  });
  assertTechnicalRecovery(
    organizationSlotMismatch,
    organizationSlotMismatchCalls,
    'typed organization target-slot mismatch'
  );

  const crossMotionPayload = structuredClone(downstreamPayload);
  const otherMotionId = discoveryPlan.plans[1].id;
  crossMotionPayload.commercialDiscoveryEvidence.candidates[0].motionId =
    otherMotionId;
  let crossMotionCalls = 0;
  const crossMotion = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-cross-motion-target',
      kind: 'opportunity_tournament',
      payload: crossMotionPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => {
      crossMotionCalls += 1;
      throw new Error('cross-motion target binding dispatched an LLM call');
    }
  });
  assertTechnicalRecovery(
    crossMotion,
    crossMotionCalls,
    'cross-motion target rejection'
  );

  const noTargetPayload = structuredClone(downstreamPayload);
  const noTargetAttempt =
    noTargetPayload.commercialDiscoveryEvidence.attempts[0];
  noTargetAttempt.status = 'not_found';
  noTargetAttempt.resultCount = 0;
  noTargetPayload.commercialDiscoveryEvidence.queryHash =
    commercialDiscoveryAttemptLedgerHash([noTargetAttempt]);
  noTargetPayload.commercialDiscoveryEvidence.status = 'not_found';
  noTargetPayload.commercialDiscoveryEvidence.resultCount = 0;
  noTargetPayload.commercialDiscoveryEvidence.evidence = [];
  noTargetPayload.commercialDiscoveryEvidence.candidates = [];
  let noTargetCalls = 0;
  const noTarget = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-no-grounded-target',
      kind: 'opportunity_tournament',
      payload: noTargetPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => {
      noTargetCalls += 1;
      throw new Error('valid no-target discovery dispatched an LLM call');
    }
  });
  assertTechnicalRecovery(
    noTarget,
    noTargetCalls,
    'valid provider not-found without source-bound finalists'
  );

  const incompleteFamiliesPayload = structuredClone(downstreamPayload);
  const selectedPersistedMotion =
    incompleteFamiliesPayload.commercialDiscoveryEvidence.plan.plans[0];
  selectedPersistedMotion.contingentFinalists.familyB.d.r[0].g.t = [
    'target:evidence'
  ];
  let incompleteFamilyCalls = 0;
  const incompleteFamilies = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-incomplete-families',
      kind: 'opportunity_tournament',
      payload: incompleteFamiliesPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => {
      incompleteFamilyCalls += 1;
      throw new Error('incomplete call-1 families dispatched critic/repair');
    }
  });
  assertTechnicalRecovery(
    incompleteFamilies,
    incompleteFamilyCalls,
    'fewer than two complete call-1 families'
  );
}

function assertTechnicalRecovery(result, calls, label) {
  if (calls !== 0 ||
      result.status !== 'skipped' ||
      result.gate?.decision !== 'technical_recovery' ||
      result.result?.resultType !== 'technical_recovery' ||
      result.nextExperiment !== null ||
      result.usage?.calls !== 0 ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `${label} did not fail closed as technical recovery: ${JSON.stringify({ calls, result })}`
    );
  }
}

function plannerJob(scenario) {
  return {
    id: `job-${scenario.name.replace(/\W+/g, '-')}`,
    kind: 'opportunity_tournament',
    payload: {
      researchOnly: true,
      objective: {
        id: 'nearest-cash',
        outcome: 'Find one exact credible path to incremental payment within 30 days',
        successMetric: 'One attributable paid outcome',
        targetCount: 1,
        constraints: ['No outreach or publishing during research']
      },
      budget: {
        currency: 'USD',
        maxSpendMicros: 1_000_000,
        maxLLMSpendMicros: 560_000,
        maxLLMCalls: 1,
        maxOutputTokens: 6_000,
        hardStop: true
      },
      evidenceSnapshot: {
        profile: scenario.profile,
        sources: [
          {
            id: 'owner-site',
            label: 'Owner website',
            url: 'https://owner.example/offer',
            status: 'approved',
            profileControlled: true
          }
        ],
        sourceEvidence: [
          {
            id: 'paid-offer-observation',
            observationId: 'paid-offer-observation',
            sourceId: 'owner-site',
            label: 'Current professional evidence',
            summary: scenario.evidence,
            url: 'https://owner.example/offer',
            observedAt: now.toISOString(),
            status: 'approved'
          }
        ]
      }
    }
  };
}

function plan(overrides) {
  const motion = {
    id: '',
    priority: 1,
    searchMode: 'professional_counterparty',
    commercialRole: 'buyer',
    acquisitionMode: 'permissioned_outreach',
    buyer: '',
    counterparty: '',
    paidOffer: '',
    evidenceRefs: [],
    query: '',
    market: '',
    targetRoleTerms: [],
    organizationTerms: [],
    jobTitle: '',
    skills: [],
    acquisitionMechanism: '',
    conversionDestination: '',
    paidConversion: '',
    attributionSignal: '',
    rationale:
      'This search could reveal one exact counterparty or live demand record closer to payment than profile maintenance.',
    ...overrides
  };
  motion.evidenceRefs = [...new Set([
    ...motion.evidenceRefs,
    PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
  ])];
  const requiredEvidenceRoles = motion.commercialRole === 'referral_partner'
    ? ['acquisition', 'channel_fit', 'prospective_partner']
    : motion.commercialRole === 'buyer'
      ? ['defined_buyer']
      : [
          'acquisition',
          'channel_fit',
          'conversion_destination',
          'defined_buyer',
          'demand_signal',
          'paid_conversion',
          'paid_offer'
        ];
  return {
    ...motion,
    targetSlot: {
      targetNameToken: '{{TARGET_NAME}}',
      targetUrlToken: '{{TARGET_URL}}',
      evidenceRefToken: 'target:evidence',
      finalTargetKind: motion.commercialRole === 'paid_demand'
        ? 'live_paid_demand'
        : motion.searchMode === 'local_organization'
          ? 'organization'
          : 'person',
      commercialRole: motion.commercialRole,
      resolutionStrategy: 'single_exact_target',
      requiredEvidenceRoles
    },
    contingentFinalists: contingentFinalists(motion)
  };
}

function contingentFinalists(motion) {
  const ref = motion.evidenceRefs[0];
  const attributionRef =
    PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID;
  const targetRef = 'target:evidence';
  const buyerRef = motion.commercialRole === 'referral_partner'
    ? ref
    : targetRef;
  const paidDemand = motion.commercialRole === 'paid_demand';
  const mechanism = motion.searchMode === 'active_job_posting'
    ? 'compensated_role'
    : /subscription/i.test(motion.paidOffer)
      ? 'subscription_or_retainer'
      : /contract|consult/i.test(motion.paidOffer)
        ? 'signed_contract'
        : 'paid_booking';
  const attributionMethod = 'payment_receipt';
  const attributionSignal =
    'Payment receipt source field stores target and tournament action ids.';
  const conversionDestination = paidDemand
    ? 'The official application page at {{TARGET_URL}}'
    : 'The verified owner booking page';
  const scores = {
    of: 0.82,
    es: 0.76,
    ba: 0.72,
    ti: 0.64,
    wp: 0.62,
    re: 0.66,
    ev: 0.74,
    ef: 0.32,
    co: 0.2,
    ri: 0.28,
    un: 0.34
  };
  const acquisitionAction = (variant) => {
    const prefix = motion.acquisitionMode === 'partner_channel'
      ? 'After review, request one partner referral'
      : motion.acquisitionMode === 'warm_referral'
        ? 'After review, request one warm referral introduction'
        : motion.acquisitionMode === 'inbound'
          ? 'After review, submit one inbound paid application'
          : 'After review, submit one permissioned paid proposal';
    return `${prefix} to {{TARGET_NAME}} for ${motion.paidOffer} (${variant}).`;
  };
  const channel = (variant) => motion.acquisitionMode === 'partner_channel'
    ? `Partner referral via {{TARGET_NAME}} (${variant})`
    : motion.acquisitionMode === 'warm_referral'
      ? `Warm introduction via {{TARGET_NAME}} (${variant})`
      : motion.acquisitionMode === 'inbound'
        ? `Inbound discovery at {{TARGET_NAME}} (${variant})`
        : `Review-first application to {{TARGET_NAME}} (${variant})`;
  const makeFamily = (key, variantA, variantB) => ({
    l: `${motion.id} ${key}`,
    m: motion.acquisitionMode,
    e: [ref, targetRef, attributionRef],
    s: scores,
    tacticKey: key,
    d: {
      r: [{
        l: `${motion.paidOffer}: attributable payment`,
        e: [ref, targetRef, attributionRef],
        v: 'incremental_revenue_v3',
        rm: mechanism,
        io: `One additional paid income outcome from ${motion.paidOffer}.`,
        a: motion.acquisitionMode,
        c: acquisitionAction(variantA),
        o: mechanism === 'compensated_role'
          ? 'One compensation offer accepted or salary payment recorded.'
          : mechanism === 'subscription_or_retainer'
            ? 'One paid subscription order recorded.'
            : mechanism === 'signed_contract'
              ? 'One signed contract and paid invoice recorded.'
          : 'One paid booking or payment receipt recorded.',
        atm: attributionMethod,
        ats: attributionSignal,
        cd: conversionDestination,
        st: 'Stop after 10 attempts, 1 paid outcome, or 14 calendar days, whichever comes first.',
        g: {
          b: [buyerRef],
          o: paidDemand ? [targetRef] : [ref],
          a: [targetRef],
          d: {
            l: conversionDestination,
            e: paidDemand ? [targetRef] : [ref]
          },
          c: paidDemand ? [targetRef] : [ref],
          t: [attributionRef]
        },
        sb: 'Prepare only the evidence-backed action artifact.',
        vm: 500_000
      }],
      o: [variantA, variantB].map((variant) => ({
        l: `${motion.paidOffer} (${variant})`,
        e: paidDemand ? [targetRef] : [ref]
      })),
      b: [variantA, variantB].map((variant) => ({
        l: `${motion.buyer} via {{TARGET_NAME}} (${variant})`,
        e: [buyerRef]
      })),
      c: [variantA, variantB].map((variant) => ({
        l: channel(variant),
        e: [targetRef]
      })),
      a: [variantA, variantB].map((variant) => ({
        l: acquisitionAction(variant),
        e: [ref, targetRef]
      })),
      t: [variantA, variantB].map((variant) => ({
        l: `Current target check (${variant})`,
        e: [ref],
        q: 'current'
      })),
      p: [variantA, variantB].map((variant) => ({
        l: `Verified seller and target proof (${variant})`,
        e: [ref, targetRef]
      })),
      f: [variantA, variantB].map((variant) => ({
        l: `One approved follow-up (${variant})`,
        e: [ref, targetRef]
      }))
    }
  });
  return {
    seedContract: 'revenue_family_bundle_v2',
    familyA: makeFamily('direct_referral_tactic', 'route alpha', 'route beta'),
    familyB: makeFamily('artifact_led_tactic', 'route gamma', 'route delta'),
    w: scores
  };
}
