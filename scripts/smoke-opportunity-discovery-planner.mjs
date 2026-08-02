#!/usr/bin/env node

import {
  COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT,
  OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
  PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID,
  buildEvidenceCatalog,
  commercialDiscoveryAttemptLedgerHash,
  normalizeCommercialDiscoveryEvidence,
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
const MAX_DISCOVERY_PLANNER_RESPONSE_BYTES = 28 * 1024;
const DISCOVERY_PLANNER_COMPACT_RESPONSE_TARGET_BYTES = 12 * 1024;
const DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS = 9_000;
const DISCOVERY_PLANNER_CALL_SPEND_CEILING_MICROS = 558_431;
let largestPlannerResponseBytes = 0;
let largestPlannerRequestBytes = 0;
let largestPlannerContractBytes = 0;
let productionShapedPlannerRequestBytes = 0;
let largestMaterializedFixtureBytes = 0;
let largestCompactFixtureBytes = 0;
let smallestCompactResponseReduction = 1;

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
        query: 'pediatric practice serving newborn patients Queens New York',
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
        targetRoleTerms: [
          'pediatrician',
          'practice owner',
          'medical director',
          'practice manager'
        ],
        organizationTerms: ['pediatric practice', 'birth center'],
        acquisitionMechanism: 'One reviewed practice partner-referral request',
        conversionDestination: 'The verified owner booking page',
        paidConversion: 'One completed paid or reimbursed consultation',
        attributionSignal: 'Booking referral source stores the selected practice and tournament id',
        targetSlot: {
          finalTargetKind: 'person',
          resolutionStrategy: 'organization_then_decision_maker'
        }
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
      const responsePlan = scenario.plans(evidenceRef)[0];
      const materializedBytes = Buffer.byteLength(
        JSON.stringify(responsePlan.contingentFinalists),
        'utf8'
      );
      responsePlan.contingentFinalists = compactContingentFinalists(
        responsePlan.contingentFinalists
      );
      const compactBytes = Buffer.byteLength(
        JSON.stringify(responsePlan.contingentFinalists),
        'utf8'
      );
      largestMaterializedFixtureBytes = Math.max(
        largestMaterializedFixtureBytes,
        materializedBytes
      );
      largestCompactFixtureBytes = Math.max(
        largestCompactFixtureBytes,
        compactBytes
      );
      smallestCompactResponseReduction = Math.min(
        smallestCompactResponseReduction,
        1 - compactBytes / materializedBytes
      );
      const responseData = {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'This search is the closest supported path to current paid demand or a qualified commercial channel.',
        plans: [responsePlan]
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
        responseData.plans[0].contingentFinalists.pathBase.e = [
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
      if (responseBytes > DISCOVERY_PLANNER_COMPACT_RESPONSE_TARGET_BYTES) {
        throw new Error(
          `${scenario.name}: valid call-1 response is ${responseBytes} bytes, above the 12 KiB compact-response target`
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
      requestSeen.responseFormat?.json_schema?.schema?.properties?.plans
        ?.items?.properties?.evidenceRefs?.maxItems !== 14 ||
      requestSeen.plugins?.[0]?.id !== 'web' ||
      requestSeen.plugins?.[0]?.engine !== 'exa' ||
      requestSeen.plugins?.[0]?.max_results !== 5 ||
      requestSeen.maxTokens !== DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS ||
      !requestSeen.system?.includes(
        'Keep the complete JSON at or below 12 KiB.'
      ) ||
      !requestSeen.system?.includes(
        'shared pathBase plus two distinct tactic deltas'
      ) ||
      !requestSeen.system?.includes(
        'Return one minified object, concise strings, no formatting whitespace'
      ) ||
      result.status !== 'planned' ||
      result.contractVersion !== OPPORTUNITY_DISCOVERY_PLAN_CONTRACT ||
      result.plans.length !== 1 ||
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
      result.preflight?.outputTokenCeiling !==
        DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS ||
      result.preflight?.fixedRequestFeeCeilingMicros !== 120_000 ||
      result.preflight?.fixedToolFeeMicros !== 5_000 ||
      result.preflight?.callSpendCeilingMicros !==
        DISCOVERY_PLANNER_CALL_SPEND_CEILING_MICROS ||
      !(result.preflight?.responseBodyByteCount > 0) ||
      result.preflight?.responseBodyByteCount >
        DISCOVERY_PLANNER_COMPACT_RESPONSE_TARGET_BYTES ||
      result.preflight?.maxResponseBodyByteCount !==
        MAX_DISCOVERY_PLANNER_RESPONSE_BYTES ||
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
  const contingentResponseSchema = requestSeen.responseFormat?.json_schema
    ?.schema?.properties?.plans?.items?.properties?.contingentFinalists;
  const contingentProperties = contingentResponseSchema?.properties || {};
  const plannerDefinitions = requestSeen.responseFormat?.json_schema
    ?.schema?.$defs || {};
  const causalWitnessSchema = plannerDefinitions.causalWitness || {};
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
      !/exactly 1 strongest plan/i.test(
        plannerPrompt.outputContract?.plan || ''
      ) ||
      !Array.isArray(plannerPrompt.hardRules) ||
      plannerPrompt.hardRules.length < 7 ||
      !plannerPrompt.hardRules.some((rule) =>
        /exactly 1 motion.*pathBase\+2 causal tactics/i.test(
          rule
        )
      ) ||
      requestSeen.responseFormat?.json_schema?.schema?.properties
        ?.plans?.maxItems !== 1 ||
      !contingentProperties.pathBase ||
      !contingentProperties.tacticA ||
      !contingentProperties.tacticB ||
      contingentProperties.familyA ||
      contingentProperties.familyB ||
      JSON.stringify(contingentResponseSchema?.required) !== JSON.stringify([
        'seedContract',
        'pathBase',
        'tacticA',
        'tacticB',
        'w'
      ]) ||
      JSON.stringify(
        plannerDefinitions.pathBase?.required
      ) !== JSON.stringify(['e', 'r', 'o', 'b', 't', 'p']) ||
      !plannerDefinitions.revenuePath?.required?.includes('k') ||
      plannerDefinitions.revenuePath?.properties?.k?.$ref !==
        '#/$defs/causalWitness' ||
      JSON.stringify(causalWitnessSchema.required) !== JSON.stringify([
        'v',
        'i',
        'c',
        'o',
        't',
        'd',
        's',
        'n',
        'u'
      ]) ||
      causalWitnessSchema.properties?.n?.minimum !== 1 ||
      causalWitnessSchema.properties?.n?.maximum !== 100 ||
      causalWitnessSchema.properties?.c?.$ref !==
        '#/$defs/revenueMechanism' ||
      causalWitnessSchema.properties?.o?.$ref !==
        '#/$defs/revenueMechanism' ||
      causalWitnessSchema.properties?.t?.$ref !==
        '#/$defs/attributionMethod' ||
      JSON.stringify(
        plannerDefinitions.tactic?.required
      ) !== JSON.stringify([
        'l',
        'm',
        'tacticKey',
        'e',
        's',
        'c',
        'a',
        'f'
      ]) ||
      plannerDefinitions.pathBase?.properties?.o?.minItems !== 2 ||
      plannerDefinitions.tactic?.properties?.c?.minItems !== 2 ||
      plannerDefinitions.tactic?.properties?.a?.maxItems !== 2 ||
      plannerDefinitions.tactic?.properties?.f?.maxItems !== 2 ||
      !/^\^/.test(
        requestSeen.responseFormat?.json_schema?.schema?.$defs
          ?.actionItem?.properties?.l?.pattern || ''
      ) ||
      !/TARGET_NAME/.test(
        requestSeen.responseFormat?.json_schema?.schema?.$defs
          ?.actionItem?.properties?.l?.pattern || ''
      ) ||
      !/\$$/.test(
        requestSeen.responseFormat?.json_schema?.schema?.$defs
          ?.actionItem?.properties?.l?.pattern || ''
      ) ||
      !/one complete commercial ask.*never setup, support, or follow-up/is.test(
        requestSeen.responseFormat?.json_schema?.schema?.$defs
          ?.actionItem?.properties?.l?.description || ''
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /both tacticA\.a and tacticB\.a contain exactly 2 variants.*independently completes its commercial ask, never setup\/support/i.test(
          rule
        )
      )) {
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
  const materialized = result.plans[0].contingentFinalists;
  const sharedDimensions = ['r', 'o', 'b', 't', 'p'];
  if (!materialized?.familyA || !materialized?.familyB ||
      materialized.pathBase || materialized.tacticA || materialized.tacticB ||
      materialized.familyA.tacticKey === materialized.familyB.tacticKey ||
      sharedDimensions.some((dimension) =>
        JSON.stringify(materialized.familyA.d?.[dimension]) !==
          JSON.stringify(materialized.familyB.d?.[dimension])
      ) ||
      JSON.stringify(materialized.familyA.d?.a) ===
        JSON.stringify(materialized.familyB.d?.a)) {
    throw new Error(
      `${scenario.name}: compact planner bundle was not materialized into two diverse legacy families: ${JSON.stringify(materialized)}`
    );
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
  const projectedOwnerAssetNode =
    plannerPrompt.commercialEvidenceGraph?.nodes?.find((item) =>
      item.revenueAssetRole === 'current_owner_paid_conversion_asset'
    );
  if (projectedOwnerAssetNode &&
      !['paid_offer', 'conversion_destination', 'paid_conversion'].every(
        (role) => projectedOwnerAssetNode.roles?.includes(role)
      )) {
    throw new Error(
      `${scenario.name}: current owner paid-conversion asset lost its typed causal roles`
    );
  }
}

const envelopeScenario = cases[0];
const envelopeJob = plannerJob(envelopeScenario);
const envelopeCatalog = buildEvidenceCatalog(envelopeJob.payload, {}, now, {
  includeSystemAttributionCapability: true
});
const envelopeEvidenceRef = envelopeCatalog.find((item) =>
  typeof item.id === 'string' && item.id.startsWith('observation:')
)?.id;
if (!envelopeEvidenceRef) {
  throw new Error('planner response-envelope fixture produced no evidence id');
}

function plannerResponseAtByteCount(byteCount) {
  const response = {
    contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
    status: 'planned',
    reason: '',
    plans: envelopeScenario.plans(envelopeEvidenceRef).slice(0, 1)
  };
  const baseBytes = Buffer.byteLength(JSON.stringify(response), 'utf8');
  if (baseBytes > byteCount) {
    throw new Error(
      `planner response-envelope fixture exceeds target: ${baseBytes} > ${byteCount}`
    );
  }
  response.reason = 'r'.repeat(byteCount - baseBytes);
  return response;
}

async function runPlannerResponseEnvelopeCase(byteCount) {
  return runOpportunityDiscoveryPlanner({
    job: envelopeJob,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: plannerResponseAtByteCount(byteCount),
      usage,
      generationId: `generation-envelope-${byteCount}`,
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: byteCount,
        contentSha256: 'e'.repeat(64)
      },
      annotations: [{
        type: 'url_citation',
        url_citation: {
          url: 'https://market.example/response-envelope',
          title: 'Current public professional result',
          content: 'Current public professional organization for review.'
        }
      }]
    })
  });
}

const withinResponseMarginBytes = 27 * 1024;
const withinResponseMargin = await runPlannerResponseEnvelopeCase(
  withinResponseMarginBytes
);
if (withinResponseMargin.status !== 'planned' ||
    withinResponseMargin.preflight?.responseBodyByteCount !==
      withinResponseMarginBytes ||
    withinResponseMargin.preflight?.maxResponseBodyByteCount !==
      MAX_DISCOVERY_PLANNER_RESPONSE_BYTES) {
  throw new Error(
    `planner rejected its bounded response margin: ${JSON.stringify(withinResponseMargin)}`
  );
}

const overflowResponseBytes = MAX_DISCOVERY_PLANNER_RESPONSE_BYTES + 1;
const overflowResponse = await runPlannerResponseEnvelopeCase(
  overflowResponseBytes
);
if (overflowResponse.status !== 'blocked' ||
    overflowResponse.reason !==
      'Discovery planner response exceeded its bounded structured-output envelope.' ||
    overflowResponse.preflight?.responseBodyByteCount !==
      overflowResponseBytes ||
    overflowResponse.preflight?.maxResponseBodyByteCount !==
      MAX_DISCOVERY_PLANNER_RESPONSE_BYTES) {
  throw new Error(
    `planner did not enforce its 28 KiB response gate: ${JSON.stringify(overflowResponse)}`
  );
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
await verifySensitiveTargetFieldPolicy(unsafeJob, unsafeRef);
await verifyOmittedChildEvidenceCanonicalization(unsafeJob, unsafeRef);
await verifyOmittedTargetEvidenceProtocolCanonicalization(
  unsafeJob,
  unsafeRef
);
await verifyOneMotionWithTwoCausalFamilies(unsafeJob, unsafeRef);
await verifySingleOperationalVariantCanBePruned(unsafeJob, unsafeRef);
await verifyNaturalReviewFirstActionsPass(unsafeJob, unsafeRef);
await verifyOptionalSupportingBottleneckPasses(unsafeJob, unsafeRef);
await verifyServicePaymentOutcomesPass(unsafeJob, unsafeRef);
await verifyUnpaidServiceOutcomeFails(unsafeJob, unsafeRef);
await verifyRevenueStopUnits(unsafeJob, unsafeRef);
await verifyNaturalBookingAttribution(unsafeJob, unsafeRef);
await verifyCausalPathDiagnosticsAreFieldSpecific(unsafeJob, unsafeRef);
await verifyTypedCausalWitnessContract(unsafeJob, unsafeRef);
await verifyRawOverCardinalityFailsClosed(unsafeJob, unsafeRef);
await verifyTruncatedPlannerFailsOnceWithSafeReceipt(unsafeJob);
await verifyTwoStageTargetBinding();
await verifyPaidDemandTargetProtocolEndToEnd();
await verifyProductionShapedPlannerHeadroom(unsafeJob, unsafeRef);

if (smallestCompactResponseReduction < 0.25 ||
    largestCompactFixtureBytes >= largestMaterializedFixtureBytes) {
  throw new Error(
    `shared planner contract did not reduce representative response size: ${JSON.stringify({ largestMaterializedFixtureBytes, largestCompactFixtureBytes, smallestCompactResponseReduction })}`
  );
}

process.stdout.write(
  `opportunity discovery planner smoke passed (${cases.length} professions + unsafe adversary + typed referral-population safety + child evidence-index canonicalization + target-slot protocol canonicalization/role guards + shared pathBase/two-tactic materialization + legacy receipt compatibility + independent family-diverse critic + thrown-length safe receipt + natural review-first actions + optional supporting bottleneck + service-payment outcomes + unpaid-service rejection + revenue-stop units + natural booking attribution + field-specific causal diagnostics + raw-cardinality guard + two-stage target binding + production-shaped prompt headroom + 28 KiB response gate; call 1 max ${DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS} tokens / ${DISCOVERY_PLANNER_CALL_SPEND_CEILING_MICROS} micros; largest request ${largestPlannerRequestBytes} bytes / <=${36 * 1024}; production-shaped request ${productionShapedPlannerRequestBytes} bytes / <=${35 * 1024}; semantic contract +${largestPlannerContractBytes} bytes; compact finalist fixture ${largestCompactFixtureBytes} bytes vs ${largestMaterializedFixtureBytes} materialized (${Math.round(smallestCompactResponseReduction * 100)}%+ reduction); largest representative single-motion response ${largestPlannerResponseBytes} bytes / <=${DISCOVERY_PLANNER_COMPACT_RESPONSE_TARGET_BYTES} compact target)\n`
);

async function verifyOmittedChildEvidenceCanonicalization(
  baseJob,
  primaryEvidenceRef
) {
  const job = structuredClone(baseJob);
  const childFixtures = Array.from({ length: 13 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, '0');
    return {
      source: {
        id: `owner-grounding-${suffix}`,
        label: `Owner grounding page ${suffix}`,
        url: `https://owner.example/grounding/${suffix}`,
        status: 'approved',
        profileControlled: true
      },
      observation: {
        id: `separate-grounding-${suffix}`,
        observationId: `separate-grounding-${suffix}`,
        sourceId: `owner-grounding-${suffix}`,
        label: `Current commercial grounding ${suffix}`,
        summary:
          `Current approved evidence for one causal commercial field ${suffix}.`,
        url: `https://owner.example/grounding/${suffix}`,
        observedAt: now.toISOString(),
        status: 'approved'
      }
    };
  });
  job.payload.evidenceSnapshot.sources.push(
    ...childFixtures.map((item) => item.source)
  );
  job.payload.evidenceSnapshot.sourceEvidence.push(
    ...childFixtures.map((item) => item.observation)
  );
  const catalog = buildEvidenceCatalog(job.payload, {}, now, {
    includeSystemAttributionCapability: true
  });
  const childRefs = childFixtures.map((fixture) =>
    catalog.find((item) =>
      item.id === `observation:${fixture.observation.observationId}`
    )?.id
  );
  if (childRefs.some((ref) => !ref)) {
    throw new Error(
      'child-evidence fixture produced no complete approved omitted-ref set'
    );
  }
  const annotation = {
    type: 'url_citation',
    url_citation: {
      url: 'https://pediatrics.example/newborn-care',
      title: 'Pediatrics newborn care',
      content: 'A current public professional newborn-care page.'
    }
  };
  const completionFor = (candidate, generationId) => ({
    data: {
      contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
      status: 'planned',
      reason: 'The evidence-grounded referral motion is ready for target binding.',
      plans: [candidate]
    },
    usage,
    generationId,
    diagnostics: {
      finishReason: 'stop',
      nativeFinishReason: 'stop',
      contentByteCount: 900,
      contentSha256: '6'.repeat(64)
    },
    annotations: [annotation]
  });
  const childEvidenceSlots = (candidate) => [
    candidate.contingentFinalists.familyA.d.a[0].e,
    candidate.contingentFinalists.familyB.d.a[0].e,
    candidate.contingentFinalists.familyA.d.a[1].e,
    candidate.contingentFinalists.familyB.d.a[1].e,
    candidate.contingentFinalists.familyA.d.c[0].e,
    candidate.contingentFinalists.familyB.d.c[0].e,
    candidate.contingentFinalists.familyA.d.c[1].e,
    candidate.contingentFinalists.familyB.d.c[1].e,
    candidate.contingentFinalists.familyA.d.f[0].e,
    candidate.contingentFinalists.familyB.d.f[0].e,
    candidate.contingentFinalists.familyA.d.f[1].e,
    candidate.contingentFinalists.familyB.d.f[1].e,
    candidate.contingentFinalists.familyA.d.o[0].e
  ];
  const declareChildRefs = (candidate, refs) => {
    const slots = childEvidenceSlots(candidate);
    refs.forEach((ref, index) => {
      slots[index][0] = ref;
    });
  };

  for (const shape of ['materialized', 'compact']) {
    const candidate = cases[0].plans(primaryEvidenceRef)[0];
    declareChildRefs(candidate, childRefs.slice(0, 2));
    if (shape === 'compact') {
      candidate.contingentFinalists = compactContingentFinalists(
        candidate.contingentFinalists
      );
    }
    const result = await runOpportunityDiscoveryPlanner({
      job,
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => completionFor(
        candidate,
        `generation-approved-child-${shape}`
      )
    });
    const normalized = result.plans[0];
    if (result.status !== 'planned' ||
        !normalized?.evidenceRefs?.includes(childRefs[0]) ||
        !normalized?.evidenceRefs?.includes(childRefs[1]) ||
        !normalized?.contingentFinalists?.familyA?.e?.includes(childRefs[0]) ||
        normalized?.contingentFinalists?.familyA?.e?.includes(
          childRefs[1]
        ) ||
        !normalized?.contingentFinalists?.familyB?.e?.includes(
          childRefs[1]
        ) ||
        normalized?.contingentFinalists?.familyB?.e?.includes(childRefs[0]) ||
        !normalized?.contingentFinalists?.familyA?.d?.a?.[0]?.e?.includes(
          childRefs[0]
        )) {
      throw new Error(
        `approved omitted child evidence was not canonicalized from ${shape}: ${JSON.stringify(result)}`
      );
    }
  }

  for (const shape of ['materialized', 'compact']) {
    const candidate = cases[0].plans(primaryEvidenceRef)[0];
    declareChildRefs(candidate, ['observation:unapproved-child-ref']);
    if (shape === 'compact') {
      candidate.contingentFinalists = compactContingentFinalists(
        candidate.contingentFinalists
      );
    }
    const result = await runOpportunityDiscoveryPlanner({
      job,
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => completionFor(
        candidate,
        `generation-unknown-child-${shape}`
      )
    });
    if (result.status !== 'blocked' ||
        result.plans.length !== 0 ||
        result.sideEffectsPerformed !== 0 ||
        !/contingent finalist contract/i.test(result.reason)) {
      throw new Error(
        `unknown ${shape} child evidence did not fail closed: ${JSON.stringify(result)}`
      );
    }
  }

  let expandedVisibleRefs = [];
  const expandedResult = await runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      expandedVisibleRefs = request.responseFormat?.json_schema?.schema?.$defs
        ?.evidenceRef?.enum?.filter((ref) => ref !== 'target:evidence') || [];
      const candidate = cases[0].plans(primaryEvidenceRef)[0];
      if (expandedVisibleRefs.length !== 14 ||
          candidate.evidenceRefs.some((ref) =>
            !expandedVisibleRefs.includes(ref)
          )) {
        throw new Error(
          `expanded-bound fixture did not receive the exact 14-ref planner projection: ${JSON.stringify(expandedVisibleRefs)}`
        );
      }
      const childVisibleRefs = expandedVisibleRefs.filter((ref) =>
        !candidate.evidenceRefs.includes(ref)
      );
      if (childVisibleRefs.length !== 12) {
        throw new Error(
          `expanded-bound fixture did not retain twelve child-only refs: ${JSON.stringify(childVisibleRefs)}`
        );
      }
      declareChildRefs(candidate, childVisibleRefs);
      candidate.contingentFinalists = compactContingentFinalists(
        candidate.contingentFinalists
      );
      return completionFor(
        candidate,
        'generation-child-evidence-expanded-bound'
      );
    }
  });
  const expandedPlan = expandedResult.plans[0];
  if (expandedResult.status !== 'planned' ||
      expandedPlan?.evidenceRefs?.length !== 14 ||
      expandedVisibleRefs.some((ref) =>
        !expandedPlan.evidenceRefs.includes(ref)
      ) ||
      expandedResult.preflight?.requestBodyByteCount > 36 * 1024 ||
      expandedResult.preflight?.responseBodyByteCount >
        MAX_DISCOVERY_PLANNER_RESPONSE_BYTES) {
    throw new Error(
      `fourteen-ref child evidence index did not pass intact: ${JSON.stringify(expandedResult)}`
    );
  }

  const hiddenApprovedRef = childRefs.find((ref) =>
    !expandedVisibleRefs.includes(ref)
  );
  if (!hiddenApprovedRef) {
    throw new Error('expanded-bound fixture produced no model-hidden approved ref');
  }
  const hiddenCandidate = cases[0].plans(primaryEvidenceRef)[0];
  declareChildRefs(hiddenCandidate, [hiddenApprovedRef]);
  hiddenCandidate.contingentFinalists = compactContingentFinalists(
    hiddenCandidate.contingentFinalists
  );
  const hiddenResult = await runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => completionFor(
      hiddenCandidate,
      'generation-model-hidden-child-evidence'
    )
  });
  if (hiddenResult.status !== 'blocked' ||
      hiddenResult.plans.length !== 0 ||
      hiddenResult.sideEffectsPerformed !== 0 ||
      !/contingent finalist contract/i.test(hiddenResult.reason)) {
    throw new Error(
      `model-hidden approved child ref escaped the projected trust boundary: ${JSON.stringify(hiddenResult)}`
    );
  }

  const persistedEnvelope = (plan, queryHash) => ({
    contractVersion: COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT,
    status: 'not_found',
    attempted: true,
    motion: expandedPlan.id,
    buyerArchetype: expandedPlan.buyer,
    market: expandedPlan.market,
    queryHash,
    providersAttempted: ['openrouter_exa_web_search'],
    providerCalls: 1,
    paidProviderCalls: 0,
    creditsUsed: 0,
    resultCount: 0,
    patientTargetingExcluded: true,
    sideEffectsPerformed: 0,
    discoveredAt: now.toISOString(),
    plan,
    attempts: [],
    evidence: [],
    candidates: []
  });
  const persisted = normalizeCommercialDiscoveryEvidence(
    persistedEnvelope(expandedResult, '7'.repeat(64)),
    now
  );
  if (persisted.valid !== true ||
      persisted.plan?.valid !== true ||
      persisted.plan?.plans?.[0]?.evidenceRefs?.length !== 14) {
    throw new Error(
      `fourteen-ref discovery plan did not survive persistence normalization: ${JSON.stringify(persisted)}`
    );
  }

  const overflowPlan = structuredClone(expandedResult);
  const overflowRef = 'observation:persisted-overflow-ref';
  overflowPlan.plans[0].evidenceRefs.push(overflowRef);
  overflowPlan.plans[0].contingentFinalists
    .familyA.d.a[0].e[0] = overflowRef;
  const overflowResult = normalizeCommercialDiscoveryEvidence(
    persistedEnvelope(overflowPlan, '8'.repeat(64)),
    now
  );
  if (overflowResult.valid !== false ||
      overflowResult.plan?.valid !== false ||
      overflowResult.rejectedReasons?.invalid_discovery_plan !== 1 ||
      !/bounded approved evidence index/i.test(
        overflowResult.plan?.rejectedReason
      )) {
    throw new Error(
      `fifteen-ref persisted evidence overflow was silently accepted: ${JSON.stringify(overflowResult)}`
    );
  }
}

async function verifyOmittedTargetEvidenceProtocolCanonicalization(
  baseJob,
  primaryEvidenceRef
) {
  const targetRef = 'target:evidence';
  const replaceExactRef = (value, from, to) => {
    if (Array.isArray(value)) {
      return value.map((item) => replaceExactRef(item, from, to));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        replaceExactRef(item, from, to)
      ]));
    }
    return value === from ? to : value;
  };
  const annotation = {
    type: 'url_citation',
    url_citation: {
      url: 'https://pediatrics.example/newborn-care',
      title: 'Pediatrics newborn care',
      content: 'A current public professional newborn-care page.'
    }
  };
  const completionFor = (candidate, generationId) => ({
    data: {
      contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
      status: 'planned',
      reason: 'The paid path is ready for deterministic target binding.',
      plans: [candidate]
    },
    usage,
    generationId,
    diagnostics: {
      finishReason: 'stop',
      nativeFinishReason: 'stop',
      contentByteCount: 900,
      contentSha256: 'd'.repeat(64)
    },
    annotations: [annotation]
  });
  const roleCases = [
    {
      label: 'referral partner',
      candidate: cases[0].plans(primaryEvidenceRef)[0],
      targetDimensions: ['c'],
      ordinaryDimensions: ['b', 'o', 't', 'p', 'f'],
      targetGrounding: ['a'],
      ordinaryGrounding: ['b', 'o', 'd', 'c', 't']
    },
    {
      label: 'direct buyer',
      candidate: cases[2].plans(primaryEvidenceRef)[1],
      targetDimensions: ['b'],
      ordinaryDimensions: ['o', 'c', 't', 'p', 'f'],
      targetGrounding: ['b'],
      ordinaryGrounding: ['o', 'a', 'd', 'c', 't']
    },
    {
      label: 'live paid demand',
      candidate: cases[1].plans(primaryEvidenceRef)[0],
      targetDimensions: ['b', 'o', 'c'],
      ordinaryDimensions: ['t', 'p', 'f'],
      targetGrounding: ['b', 'o', 'a', 'd', 'c'],
      ordinaryGrounding: ['t']
    }
  ];
  const groundingRefs = (grounding, role) => role === 'd'
    ? grounding.d?.e || []
    : grounding[role] || [];

  for (const roleCase of roleCases) {
    const candidate = structuredClone(roleCase.candidate);
    candidate.contingentFinalists = replaceExactRef(
      compactContingentFinalists(candidate.contingentFinalists),
      targetRef,
      primaryEvidenceRef
    );
    const result = await runOpportunityDiscoveryPlanner({
      job: structuredClone(baseJob),
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => completionFor(
        candidate,
        `generation-omitted-target-${roleCase.label.replace(/\W+/g, '-')}`
      )
    });
    const families = ['familyA', 'familyB'].map((familyKey) =>
      result.plans[0]?.contingentFinalists?.[familyKey]
    );
    const targetProtocolRestored = families.every((family) => {
      const revenue = family?.d?.r?.[0];
      const actions = family?.d?.a || [];
      return family?.e?.includes(targetRef) &&
        actions.length === 2 &&
        actions.every((action) =>
          action.l.includes('{{TARGET_NAME}}') &&
          action.e.includes(targetRef)
        ) &&
        roleCase.targetDimensions.every((dimension) =>
          (family?.d?.[dimension] || []).every((item) =>
            item.e.includes(targetRef)
          )
        ) &&
        roleCase.ordinaryDimensions.every((dimension) =>
          (family?.d?.[dimension] || []).every((item) =>
            !item.e.includes(targetRef)
          )
        ) &&
        roleCase.targetGrounding.every((role) =>
          groundingRefs(revenue?.g || {}, role).includes(targetRef)
        ) &&
        roleCase.ordinaryGrounding.every((role) =>
          !groundingRefs(revenue?.g || {}, role).includes(targetRef)
        );
    });
    if (result.status !== 'planned' ||
        result.plans.length !== 1 ||
        !targetProtocolRestored ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `omitted ${roleCase.label} target protocol was not safely canonicalized: ${JSON.stringify(result)}`
      );
    }
  }

  const setGroundingRef = (grounding, role, ref) => {
    if (role === 'd') {
      grounding.d.e = [ref];
      return;
    }
    grounding[role] = [ref];
  };
  const unauthorizedCases = [
    ...['b', 'o', 'd', 'c', 't'].map((role) => ({
      label: `referral ${role}`,
      candidate: cases[0].plans(primaryEvidenceRef)[0],
      role
    })),
    ...['o', 'a', 'd', 'c', 't'].map((role) => ({
      label: `buyer ${role}`,
      candidate: cases[2].plans(primaryEvidenceRef)[1],
      role
    })),
    {
      label: 'paid demand attribution',
      candidate: cases[1].plans(primaryEvidenceRef)[0],
      role: 't'
    }
  ];
  for (const unauthorized of unauthorizedCases) {
    const candidate = structuredClone(unauthorized.candidate);
    candidate.contingentFinalists = replaceExactRef(
      compactContingentFinalists(candidate.contingentFinalists),
      targetRef,
      primaryEvidenceRef
    );
    setGroundingRef(
      candidate.contingentFinalists.pathBase.r[0].g,
      unauthorized.role,
      targetRef
    );
    const result = await runOpportunityDiscoveryPlanner({
      job: structuredClone(baseJob),
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => completionFor(
        candidate,
        `generation-unauthorized-target-${unauthorized.label.replace(/\W+/g, '-')}`
      )
    });
    if (result.status !== 'blocked' ||
        result.plans.length !== 0 ||
        result.sideEffectsPerformed !== 0 ||
        !/target evidence in unauthorized/i.test(result.reason)) {
      throw new Error(
        `unauthorized ${unauthorized.label} target role did not fail closed: ${JSON.stringify(result)}`
      );
    }
  }

  const missingObservation = cases[0].plans(primaryEvidenceRef)[0];
  missingObservation.contingentFinalists = replaceExactRef(
    compactContingentFinalists(missingObservation.contingentFinalists),
    primaryEvidenceRef,
    PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
  );
  const missingObservationResult = await runOpportunityDiscoveryPlanner({
    job: structuredClone(baseJob),
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => completionFor(
      missingObservation,
      'generation-target-protocol-no-observation'
    )
  });
  if (missingObservationResult.status !== 'blocked' ||
      !/missing approved observation evidence/i.test(
        missingObservationResult.reason
      ) ||
      missingObservationResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `target canonicalization invented an observation: ${JSON.stringify(missingObservationResult)}`
    );
  }

  const forged = cases[0].plans(primaryEvidenceRef)[0];
  forged.contingentFinalists = replaceExactRef(
    compactContingentFinalists(forged.contingentFinalists),
    targetRef,
    primaryEvidenceRef
  );
  forged.contingentFinalists.tacticA.a[0].e.push(
    'observation:unapproved-target-protocol-ref'
  );
  const forgedResult = await runOpportunityDiscoveryPlanner({
    job: structuredClone(baseJob),
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => completionFor(
      forged,
      'generation-target-protocol-forged-ref'
    )
  });
  if (forgedResult.status !== 'blocked' ||
      forgedResult.plans.length !== 0 ||
      forgedResult.sideEffectsPerformed !== 0 ||
      !/contingent finalist contract/i.test(forgedResult.reason)) {
    throw new Error(
      `target canonicalization admitted an unknown ref: ${JSON.stringify(forgedResult)}`
    );
  }
}

async function verifySensitiveTargetFieldPolicy(job, evidenceRef) {
  const baseReferral = (overrides = {}) => plan({
    id: 'newborn_professional_referral',
    priority: 1,
    searchMode: 'professional_counterparty',
    commercialRole: 'referral_partner',
    acquisitionMode: 'partner_channel',
    buyer: 'Nearby families seeking paid newborn-feeding care',
    counterparty: 'A newborn-serving pediatric professional',
    paidOffer: 'Paid or reimbursable lactation home visit',
    evidenceRefs: [evidenceRef],
    query: 'pediatric practice serving newborn patients Queens New York',
    market: 'Queens, New York',
    targetRoleTerms: ['pediatrician', 'practice manager'],
    organizationTerms: ['pediatric practice'],
    acquisitionMechanism: 'One review-first professional referral request',
    conversionDestination: 'The verified owner booking page',
    paidConversion: 'One completed paid or reimbursed consultation',
    attributionSignal: 'Booking referral source stores the practice and tournament id',
    ...overrides
  });
  const run = async (candidate, generationId) =>
    runOpportunityDiscoveryPlanner({
      job,
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => ({
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: 'Typed professional referral search.',
          plans: [candidate]
        },
        usage,
        generationId,
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 800,
          contentSha256: '1'.repeat(64)
        },
        annotations: []
      })
    });

  const allowed = await run(
    baseReferral(),
    'generation-safe-referral-population'
  );
  if (allowed.status !== 'planned' || allowed.plans.length !== 1) {
    throw new Error(
      `professional referral population query was rejected: ${JSON.stringify(allowed)}`
    );
  }

  const adversaries = [
    {
      label: 'direct sensitive role',
      candidate: baseReferral({
        id: 'sensitive_direct_role',
        targetRoleTerms: ['postpartum patient']
      }),
      reason: /direct role, title, or skill target/i
    },
    {
      label: 'sensitive organization target',
      candidate: baseReferral({
        id: 'sensitive_organization_target',
        organizationTerms: ['pregnant women']
      }),
      reason: /organization target/i
    },
    {
      label: 'private contact request',
      candidate: baseReferral({
        id: 'private_contact_request',
        acquisitionMechanism:
          'One review-first request using the professional private email'
      }),
      reason: /private-contact data/i
    },
    {
      label: 'sensitive population as search subject',
      candidate: baseReferral({
        id: 'unbound_patient_query',
        query: 'postpartum patients seeking pediatric practices Queens New York'
      }),
      reason: /in its query/i
    },
    {
      label: 'non-referral patient query',
      candidate: plan({
        ...baseReferral(),
        id: 'buyer_patient_query',
        commercialRole: 'buyer'
      }),
      reason: /in its query/i
    }
  ];
  for (const [index, adversary] of adversaries.entries()) {
    const result = await run(
      adversary.candidate,
      `generation-sensitive-adversary-${index + 1}`
    );
    if (result.status !== 'blocked' ||
        !adversary.reason.test(result.reason) ||
        result.plans.length !== 0 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${adversary.label} did not fail closed: ${JSON.stringify(result)}`
      );
    }
  }
}

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

async function verifySingleOperationalVariantCanBePruned(
  job,
  evidenceRef
) {
  const motion = cases[0].plans(evidenceRef)[0];
  motion.contingentFinalists.familyA.d.a[1].l =
    'After review, configure scheduling for {{TARGET_NAME}}.';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason:
          'One grounded motion retains two causal families after local variant pruning.',
        plans: [motion]
      },
      usage,
      generationId: 'generation-one-operational-variant',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 700,
        contentSha256: '0'.repeat(64)
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
      result.plans[0].contingentFinalists?.familyA?.d?.a?.length !== 2 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `one invalid action variant blocked two viable causal families: ${JSON.stringify(result)}`
    );
  }
}

async function verifyNaturalReviewFirstActionsPass(job, evidenceRef) {
  const motion = cases[0].plans(evidenceRef)[0];
  const actions = [
    'After review, ask {{TARGET_NAME}} to recommend the verified paid lactation home visit through its professional referral pathway (resource card).',
    'Following human approval, ask {{TARGET_NAME}} to refer one appropriate inquiry to the verified paid lactation home visit (booking handoff).',
    "Pending user review, ask {{TARGET_NAME}} to recommend Betty's paid lactation consultations to one appropriate family through its newborn referral workflow.",
    'After explicit approval, ask {{TARGET_NAME}} to include one referral to the paid lactation booking page in its discharge process.'
  ];
  let index = 0;
  for (const familyKey of ['familyA', 'familyB']) {
    const family = motion.contingentFinalists[familyKey];
    family.d.r[0].c = actions[index];
    for (const action of family.d.a) {
      action.l = actions[index];
      index += 1;
    }
  }
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'One review-first referral motion has two active causal tactics.',
        plans: [motion]
      },
      usage,
      generationId: 'generation-natural-review-first-actions',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 800,
        contentSha256: '2'.repeat(64)
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
  const returnedActions = ['familyA', 'familyB'].flatMap((familyKey) =>
    result.plans[0]?.contingentFinalists?.[familyKey]?.d?.a?.map(
      (action) => action.l
    ) || []
  );
  if (result.status !== 'planned' || result.plans.length !== 1 ||
      JSON.stringify(returnedActions) !== JSON.stringify(actions)) {
    throw new Error(
      `natural review-first revenue actions were rejected: ${JSON.stringify(result)}`
    );
  }
}

async function verifyOptionalSupportingBottleneckPasses(job, evidenceRef) {
  const motion = cases[0].plans(evidenceRef)[0];
  for (const familyKey of ['familyA', 'familyB']) {
    motion.contingentFinalists[familyKey].d.r[0].sb = '';
  }
  const result = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-empty-optional-supporting-bottleneck'
  });
  if (result.status !== 'planned' || result.plans.length !== 1) {
    throw new Error(
      `empty optional supporting bottleneck was rejected: ${JSON.stringify(result)}`
    );
  }
}

async function verifyServicePaymentOutcomesPass(job, evidenceRef) {
  const outcomes = [
    'One completed paid lactation consultation recorded.',
    'One completed paid or reimbursed lactation home visit recorded.',
    'One paid visit recorded.',
    'One paid session recorded.',
    'One paid service recorded.',
    'One paid engagement recorded.',
    'One billable professional support session recorded.',
    'One reimbursed consultation recorded.',
    'One reimbursed visit recorded.',
    'One reimbursed session recorded.'
  ];
  for (const [index, outcome] of outcomes.entries()) {
    const motion = cases[0].plans(evidenceRef)[0];
    motion.contingentFinalists.familyA.d.r[0].o = outcome;
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-service-payment-outcome-${index + 1}`
    });
    if (result.status !== 'planned' || result.plans.length !== 1) {
      throw new Error(
        `explicit service payment outcome was rejected (${outcome}): ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyUnpaidServiceOutcomeFails(job, evidenceRef) {
  const motion = cases[0].plans(evidenceRef)[0];
  motion.contingentFinalists.familyA.d.r[0].o =
    'One completed unpaid lactation consultation recorded.';
  const result = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-unpaid-service-outcome'
  });
  if (result.status !== 'blocked' ||
      !result.reason.includes('[observable_revenue]') ||
      result.plans.length !== 0 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `unpaid service outcome passed the revenue gate: ${JSON.stringify(result)}`
    );
  }
}

async function verifyRevenueStopUnits(job, evidenceRef) {
  const validStops = [
    'Stop after 5 referrals.',
    'At most 5 referral requests.',
    'Stop after 3 bookings.',
    'Stop after 4 introductions.',
    'At most 6 applications.',
    'Stop after 7 proposals.'
  ];
  for (const [index, stopCondition] of validStops.entries()) {
    const motion = cases[0].plans(evidenceRef)[0];
    motion.contingentFinalists.familyA.d.r[0].st = stopCondition;
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-revenue-stop-unit-${index + 1}`
    });
    if (result.status !== 'planned' || result.plans.length !== 1) {
      throw new Error(
        `sound revenue stop unit was rejected (${stopCondition}): ${JSON.stringify(result)}`
      );
    }
  }

  const invalidStops = [
    {
      text: 'Conclude on the thirty-first day.',
      witness: { n: 31, u: 'calendar_days' }
    },
    {
      text: 'Conclude before any action is sampled.',
      witness: { n: 0, u: 'review_first_actions' }
    },
    {
      text: 'Conclude after five profile edits.',
      witness: { n: 5, u: 'profile_edits' }
    }
  ];
  for (const [index, invalid] of invalidStops.entries()) {
    const motion = cases[0].plans(evidenceRef)[0];
    const revenue = motion.contingentFinalists.familyA.d.r[0];
    revenue.st = invalid.text;
    revenue.k = {
      ...revenue.k,
      ...invalid.witness
    };
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-invalid-revenue-stop-${index + 1}`
    });
    if (result.status !== 'blocked' ||
        !result.reason.includes('[numeric_stop]') ||
        result.plans.length !== 0 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `invalid typed revenue stop passed (${invalid.text}): ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyNaturalBookingAttribution(job, evidenceRef) {
  const validSignals = [
    'Referral source recorded on the booking with the tournament action id.',
    'Campaign source field stored on the appointment record.',
    'Referral origin recorded with the consultation.'
  ];
  for (const [index, attributionSignal] of validSignals.entries()) {
    const motion = cases[0].plans(evidenceRef)[0];
    const revenue = motion.contingentFinalists.familyA.d.r[0];
    revenue.atm = 'booking_record';
    revenue.ats = attributionSignal;
    revenue.k.t = 'booking_record';
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-natural-booking-attribution-${index + 1}`
    });
    if (result.status !== 'planned' || result.plans.length !== 1) {
      throw new Error(
        `natural booking attribution was rejected (${attributionSignal}): ${JSON.stringify(result)}`
      );
    }
  }

  const invalidSignals = [
    'No attribution is recorded for the booking.',
    'The booking has an unknown source.'
  ];
  for (const [index, attributionSignal] of invalidSignals.entries()) {
    const motion = cases[0].plans(evidenceRef)[0];
    const revenue = motion.contingentFinalists.familyA.d.r[0];
    revenue.atm = 'booking_record';
    revenue.ats = attributionSignal;
    revenue.k.t = 'booking_record';
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-invalid-booking-attribution-${index + 1}`
    });
    if (result.status !== 'blocked' ||
        !result.reason.includes('[attribution_signal]') ||
        result.plans.length !== 0 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `incomplete booking attribution passed (${attributionSignal}): ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyCausalPathDiagnosticsAreFieldSpecific(
  job,
  evidenceRef
) {
  const motion = cases[0].plans(evidenceRef)[0];
  const revenue = motion.contingentFinalists.familyA.d.r[0];
  revenue.io = 'No incremental income is expected.';
  revenue.o = 'One unpaid consultation may occur.';
  revenue.cd = 'No conversion destination is available.';
  revenue.vm = 0;
  const result = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-field-specific-causal-diagnostics'
  });
  const expected =
    '[incremental_income,observable_revenue,conversion_destination,expected_value]';
  if (result.status !== 'blocked' ||
      !result.reason.includes(expected) ||
      result.plans.length !== 0 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `causal-path diagnostics were not field-specific and safe: ${JSON.stringify(result)}`
    );
  }
}

async function verifyTypedCausalWitnessContract(job, evidenceRef) {
  const motion = applyNovelTypedCausalSemantics(
    cases[0].plans(evidenceRef)[0]
  );
  const typed = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-typed-causal-witness-all-six'
  });
  if (typed.status !== 'planned' ||
      typed.plans.length !== 1 ||
      typed.sideEffectsPerformed !== 0 ||
      typed.plans[0]?.contingentFinalists?.familyA?.d?.r?.[0]
        ?.k?.v !== 'revenue_causal_witness_v1') {
    throw new Error(
      `typed causal witnesses did not carry through planner normalization: ${JSON.stringify(typed)}`
    );
  }

  const mismatched = cases[0].plans(evidenceRef)[0];
  mismatched.contingentFinalists.familyA.d.r[0].k.c = 'direct_sale';
  const mismatchResult = await plannerResultForMotion({
    job,
    motion: mismatched,
    generationId: 'generation-mismatched-causal-witness'
  });
  if (mismatchResult.status !== 'blocked' ||
      !/invalid typed causal revenue witness.*conversion_action/i.test(
        mismatchResult.reason
      ) ||
      mismatchResult.plans.length !== 0 ||
      mismatchResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `invalid typed witness was rescued by legacy text: ${JSON.stringify(mismatchResult)}`
    );
  }

  const missing = cases[0].plans(evidenceRef)[0];
  for (const familyKey of ['familyA', 'familyB']) {
    delete missing.contingentFinalists[familyKey].d.r[0].k;
  }
  const missingResult = await plannerResultForMotion({
    job,
    motion: missing,
    generationId: 'generation-missing-causal-witness'
  });
  if (missingResult.status !== 'blocked' ||
      !/typed causal revenue witness.*missing_witness/i.test(
        missingResult.reason
      ) ||
      missingResult.plans.length !== 0 ||
      missingResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `new planner response omitted its required typed witness: ${JSON.stringify(missingResult)}`
    );
  }

  const persistedEnvelope = (planResult, queryHash) => ({
    contractVersion: COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT,
    status: 'not_found',
    attempted: true,
    motion: planResult.plans[0].id,
    buyerArchetype: planResult.plans[0].buyer,
    market: planResult.plans[0].market,
    queryHash,
    providersAttempted: ['openrouter_exa_web_search'],
    providerCalls: 1,
    paidProviderCalls: 0,
    creditsUsed: 0,
    resultCount: 0,
    patientTargetingExcluded: true,
    sideEffectsPerformed: 0,
    discoveredAt: now.toISOString(),
    plan: planResult,
    attempts: [],
    evidence: [],
    candidates: []
  });
  const legacyValid = await plannerResultForMotion({
    job,
    motion: cases[0].plans(evidenceRef)[0],
    generationId: 'generation-legacy-text-causal-receipt'
  });
  const tamperedPersistedPlan = structuredClone(legacyValid);
  tamperedPersistedPlan.plans[0].contingentFinalists
    .familyA.d.r[0].k.c = 'direct_sale';
  const tamperedPersisted = normalizeCommercialDiscoveryEvidence(
    persistedEnvelope(tamperedPersistedPlan, '4'.repeat(64)),
    now
  );
  if (tamperedPersisted.valid !== false ||
      tamperedPersisted.plan?.valid !== false ||
      !tamperedPersisted.plan?.rejectedReason?.includes(
        'conversion_action'
      )) {
    throw new Error(
      `tampered persisted witness was rescued by legacy text: ${JSON.stringify(tamperedPersisted)}`
    );
  }
  for (const familyKey of ['familyA', 'familyB']) {
    delete legacyValid.plans[0].contingentFinalists[familyKey]
      .d.r[0].k;
  }
  const legacyPersisted = normalizeCommercialDiscoveryEvidence(
    persistedEnvelope(legacyValid, '5'.repeat(64)),
    now
  );
  if (legacyPersisted.valid !== true ||
      legacyPersisted.plan?.valid !== true) {
    throw new Error(
      `historical no-witness receipt lost legacy text compatibility: ${JSON.stringify(legacyPersisted)}`
    );
  }

  const novelWithoutWitness = structuredClone(typed);
  for (const familyKey of ['familyA', 'familyB']) {
    delete novelWithoutWitness.plans[0].contingentFinalists[familyKey]
      .d.r[0].k;
  }
  const legacyNovelPersisted = normalizeCommercialDiscoveryEvidence(
    persistedEnvelope(novelWithoutWitness, '6'.repeat(64)),
    now
  );
  const allSix = [
    'incremental_income',
    'conversion_action',
    'observable_revenue',
    'attribution_signal',
    'conversion_destination',
    'numeric_stop'
  ];
  if (legacyNovelPersisted.valid !== false ||
      legacyNovelPersisted.plan?.valid !== false ||
      !allSix.every((code) =>
        legacyNovelPersisted.plan?.rejectedReason?.includes(code)
      )) {
    throw new Error(
      `legacy regex fallback did not fail the six novel semantic claims closed: ${JSON.stringify(legacyNovelPersisted)}`
    );
  }
}

async function plannerResultForMotion({ job, motion, generationId }) {
  return runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'One review-first commercial motion has two causal tactics.',
        plans: [motion]
      },
      usage,
      generationId,
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 800,
        contentSha256: '4'.repeat(64)
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
}

async function verifyRawOverCardinalityFailsClosed(job, evidenceRef) {
  const firstTwo = cases[0].plans(evidenceRef);
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'Raw provider shape violates the single-motion envelope.',
        plans: firstTwo
      },
      usage,
      generationId: 'generation-raw-over-cardinality',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 900,
        contentSha256: '3'.repeat(64)
      }
    })
  });
  if (result.status !== 'blocked' ||
      !/exactly one grounded commercial motion with two causal families/i.test(
        result.reason
      ) ||
      result.plans.length !== 0 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `raw over-cardinality was normalized into compliance: ${JSON.stringify(result)}`
    );
  }
}

async function verifyTruncatedPlannerFailsOnceWithSafeReceipt(job) {
  const liveTruncatedCompletionTokens = 8_000;
  let calls = 0;
  let requestSeen;
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      const error = new Error(
        'OpenRouter ended structured output at its token limit'
      );
      error.openRouterFailureCode =
        'openrouter_truncated_structured_output';
      error.openRouterGenerationId = 'generation-live-length-regression';
      error.openRouterUsage = {
        prompt_tokens: 9_700,
        completion_tokens: liveTruncatedCompletionTokens,
        total_tokens: 17_700,
        cost: 0.02168
      };
      error.openRouterDiagnostics = {
        finishReason: 'length',
        nativeFinishReason: 'max_output_tokens',
        contentByteCount: 21_600,
        contentSha256: '7'.repeat(64)
      };
      throw error;
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  if (calls !== 1 ||
      requestSeen?.maxTokens !== DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS ||
      requestSeen?.responseFormat?.json_schema?.schema?.properties
        ?.plans?.maxItems !== 1 ||
      result.status !== 'blocked' ||
      result.reason !==
        'The bounded discovery planner did not return a usable plan.' ||
      result.plans.length !== 0 ||
      result.usage?.calls !== 1 ||
      result.usage?.successfulCalls !== 0 ||
      result.usage?.completionTokens !==
        liveTruncatedCompletionTokens ||
      result.usage?.reportedCostMicros !== 21_680 ||
      receipt?.status !== 'failed' ||
      receipt?.error !== 'openrouter_truncated_structured_output' ||
      receipt?.generationId !== 'generation-live-length-regression' ||
      receipt?.responseDiagnostics?.finishReason !== 'length' ||
      receipt?.responseDiagnostics?.nativeFinishReason !==
        'max_output_tokens' ||
      receipt?.responseDiagnostics?.contentByteCount !== 21_600 ||
      receipt?.responseDiagnostics?.contentSha256 !== '7'.repeat(64) ||
      result.preflight?.authorized !== true ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `truncated planner did not fail once with a safe cause-matched receipt: ${JSON.stringify({ calls, requestMaxTokens: requestSeen?.maxTokens, result })}`
    );
  }
}

async function verifySemanticDriftFailsClosed(job, evidenceRef) {
  const checks = [
    {
      name: 'non-local decision-maker chain drift',
      mutate(plans) {
        plans[0].targetSlot.resolutionStrategy =
          'organization_then_decision_maker';
      },
      reason: /only for a local-organization search/i
    },
    {
      name: 'decision-maker role terms missing',
      fixtureIndex: 1,
      mutate(plans) {
        plans[0].targetRoleTerms = [];
      },
      reason: /bounded professional role terms/i
    },
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
      reason: /primary_action|target-name token/i
    },
    {
      name: 'passive primary action drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, monitor {{TARGET_NAME}} referral traffic for 14 calendar days.';
      },
      reason: /active rather than observational/i
    },
    {
      name: 'operational primary action drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, configure scheduling for {{TARGET_NAME}}.';
      },
      reason: /commercial rather than operational/i
    },
    {
      name: 'commercial-adjacent setup variant drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[1].l =
          'After review, prepare a scheduling resource with {{TARGET_NAME}} before presenting the commercial offer.';
      },
      reason: /commercial rather than operational/i
    },
    {
      name: 'transport-only metrics action drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, email {{TARGET_NAME}} the paid-booking metrics report.';
      },
      reason: /causally advance acquisition/i
    },
    {
      name: 'transport-only article action drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, share {{TARGET_NAME}} a paid industry article.';
      },
      reason: /causally advance acquisition/i
    },
    {
      name: 'availability-check action drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After approval, contact {{TARGET_NAME}} to check paid booking availability.';
      },
      reason: /active rather than observational/i
    },
    {
      name: 'recommend tracking action drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, recommend that {{TARGET_NAME}} track paid-booking metrics.';
      },
      reason: /active rather than observational/i
    },
    {
      name: 'recommend audit action drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, recommend a referral process audit to {{TARGET_NAME}}.';
      },
      reason: /active rather than observational/i
    },
    {
      name: 'present analysis action drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, present {{TARGET_NAME}} with a paid-booking analysis.';
      },
      reason: /causally advance acquisition/i
    },
    {
      name: 'route analytics action drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          "After review, route {{TARGET_NAME}}'s paid booking data into analytics.";
      },
      reason: /causally advance acquisition/i
    },
    {
      name: 'imperative verification action drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'Once approved, verify the paid offer for {{TARGET_NAME}} before proceeding.';
      },
      reason: /commercial rather than operational/i
    },
    {
      name: 'subscription metrics artifact drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'Review first: email {{TARGET_NAME}} the paid-subscription metrics report.';
      },
      reason: /causally advance acquisition/i
    },
    {
      name: 'contract analytics artifact drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'Subject to approval, send {{TARGET_NAME}} the contract analytics dashboard.';
      },
      reason: /causally advance acquisition/i
    },
    {
      name: 'paid offer availability question drift',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'Once human approved, ask whether the paid offer is available from {{TARGET_NAME}}.';
      },
      reason: /causally advance acquisition/i
    }
  ];
  for (const [checkIndex, check] of checks.entries()) {
    const plans = [
      cases[0].plans(evidenceRef)[check.fixtureIndex || 0]
    ];
    const originalFamilyActions = plans[0].contingentFinalists
      .familyA.d.a.map((action) => action.l);
    check.mutate(plans);
    const semanticActionCheck = checkIndex >= 4;
    if (semanticActionCheck) {
      // One bad local variant is now safely pruned. Preserve the mutated
      // adversarial variant and make only the otherwise-valid sibling bad so
      // this suite still proves a family with zero viable actions fails shut.
      plans[0].contingentFinalists.familyA.d.a.forEach(
        (action, actionIndex) => {
          if (action.l === originalFamilyActions[actionIndex]) {
            action.l =
              `After review, configure scheduling for {{TARGET_NAME}} (blocked sibling ${actionIndex + 1}).`;
          }
        }
      );
    }
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
    const expectedReason = check.reason;
    if (result.status !== 'blocked' ||
        !expectedReason.test(result.reason) ||
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
  const typedScenarioMotion = applyNovelTypedCausalSemantics(
    scenario.plans(evidenceRef)[1]
  );
  const omitUnresolvedTargetEvidence = (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((item) =>
        item === 'target:evidence'
          ? []
          : [omitUnresolvedTargetEvidence(item)]
      );
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        omitUnresolvedTargetEvidence(item)
      ]));
    }
    return value;
  };
  // Reproduce the production failure: the model authors the exact target
  // tokens and a valid typed slot but omits the repeated target sentinel from
  // every finalist evidence array. Planner normalization must repair only the
  // protocol reference; the downstream provider still has to bind a real
  // cited professional before the critic can see a finalist.
  typedScenarioMotion.contingentFinalists =
    omitUnresolvedTargetEvidence(
      typedScenarioMotion.contingentFinalists
    );
  const discoveryPlan = await runOpportunityDiscoveryPlanner({
    job: planner,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'The strongest source-bindable referral search is warranted.',
        plans: [{
          ...typedScenarioMotion,
          contingentFinalists: compactContingentFinalists(
            typedScenarioMotion.contingentFinalists
          )
        }]
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
  const selectedMotion = structuredClone(discoveryPlan.plans[0]);
  if (selectedMotion.targetSlot?.finalTargetKind !== 'person' ||
      selectedMotion.targetSlot?.resolutionStrategy !==
        'organization_then_decision_maker' ||
      selectedMotion.targetRoleTerms.length === 0) {
    throw new Error(
      `planner did not persist a resolvable organization-to-decision-maker contract: ${JSON.stringify(selectedMotion)}`
    );
  }
  const exaAttempt = {
    id: 'attempt-two-stage-folded-exa-search',
    provider: 'openrouter_exa_web_search',
    operation: 'forced_exa_web_search',
    queryHash: discoveryPlan.webSearchReceipt.requestHash,
    status: 'succeeded',
    estimatedSpendMicros: 5_000,
    actualSpendMicros: 0,
    creditsUsed: 1,
    resultCount: 1,
    reservedAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
    completedAt: '2026-08-01T12:00:00Z'
  };
  const pdlAttempt = {
    id: 'attempt-two-stage-decision-maker-search',
    provider: 'people_data_labs_person_search',
    operation: 'planned_decision_maker_search',
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
  const organizationEvidenceRef =
    'external_discovery:111111111111111111111111';
  const personEvidenceRef =
    'external_discovery:333333333333333333333333';
  const organizationCandidateId =
    'candidate:external:444444444444444444444444';
  const targetCandidateId =
    'candidate:external:222222222222222222222222';
  const oneMotionDiscoveryPlan = {
    ...discoveryPlan,
    plans: [selectedMotion]
  };
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
      queryHash: commercialDiscoveryAttemptLedgerHash([
        exaAttempt,
        pdlAttempt
      ]),
      market: selectedMotion.market,
      providersAttempted: [
        'openrouter_exa_web_search',
        'people_data_labs_person_search'
      ],
      providerCalls: 2,
      paidProviderCalls: 2,
      creditsUsed: 2,
      resultCount: 2,
      patientTargetingExcluded: true,
      sideEffectsPerformed: 0,
      attempts: [exaAttempt, pdlAttempt],
      plan: oneMotionDiscoveryPlan,
      evidence: [
        {
          motionId: selectedMotion.id,
          evidenceRef: organizationEvidenceRef,
          kind: 'verified_external_professional_target',
          label: 'Riverside Pediatrics newborn care',
          summary: 'OpenRouter Exa Web Search returned Riverside Pediatrics as an exact public pediatric practice in Queens. This independently validates the organization only and does not prove a relationship or permission.',
          url: 'https://riverside-pediatrics.example/newborn-care',
          provider: 'openrouter_exa_web_search',
          provenance: 'openrouter_exa_url_citation',
          roles: ['acquisition', 'channel_fit', 'prospective_partner'],
          verified: true,
          observedAt: '2026-08-01T12:00:00Z'
        },
        {
          motionId: selectedMotion.id,
          evidenceRef: personEvidenceRef,
          kind: 'verified_external_professional_target',
          label: 'Dr. Ava Rivera — Pediatrician at Riverside Pediatrics',
          summary: 'People Data Labs returned Dr. Ava Rivera as an exact public professional identity after a resume-only search scoped to the independently validated Riverside Pediatrics organization. This does not prove a relationship, interest, or permission.',
          url: 'https://www.linkedin.com/in/ava-rivera',
          provider: 'people_data_labs_person_search',
          provenance: 'people_data_labs_resume_record_scoped_to_validated_organization',
          roles: ['acquisition', 'channel_fit', 'prospective_partner'],
          verified: true,
          observedAt: '2026-08-01T12:01:01Z'
        }
      ],
      candidates: [
        {
          motionId: selectedMotion.id,
          id: organizationCandidateId,
          kind: 'organization',
          displayLabel: 'Riverside Pediatrics newborn care',
          organization: 'Riverside Pediatrics',
          role: 'Pediatric practice',
          commercialRole: 'referral_partner',
          market: 'Queens, New York',
          publicUrl: 'https://riverside-pediatrics.example/newborn-care',
          provider: 'openrouter_exa_web_search',
          evidenceRefs: [organizationEvidenceRef],
          contactPaths: [],
          exactNamedCandidate: true,
          identityResolved: true
        },
        {
          motionId: selectedMotion.id,
          id: targetCandidateId,
          kind: 'person',
          displayLabel: 'Dr. Ava Rivera',
          organization: 'Riverside Pediatrics',
          role: 'Pediatrician',
          commercialRole: 'referral_partner',
          market: 'Queens, New York',
          publicUrl: 'https://www.linkedin.com/in/ava-rivera',
          provider: 'people_data_labs_person_search',
          evidenceRefs: [organizationEvidenceRef, personEvidenceRef],
          contactPaths: [{
            kind: 'public_professional_url',
            available: true,
            verified: true,
            reference: 'https://www.linkedin.com/in/ava-rivera'
          }],
          exactNamedCandidate: true,
          identityResolved: true
        }
      ],
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
      if (finalists.some((finalist) =>
        finalist.revenuePath?.causalWitness?.contractVersion !==
          'revenue_causal_witness_v1'
      )) {
        throw new Error(
          'typed causal witness did not reach the independent critic'
        );
      }
      assertCompactCriticPair({
        request,
        task,
        finalists,
        expectedTargets: ['Dr. Ava Rivera']
      });
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
      result.searchSpace?.motionConflictCount !== 0 ||
      result.llm?.strategyGeneratorJudge ||
      result.llm?.strategyFamilyRepair ||
      !result.llm?.commercialCritic ||
      result.trace?.contingentFinalists?.materialized !== true ||
      result.trace?.contingentFinalists
        ?.exactTargetPresentInEveryPrimaryAction !== true ||
      result.commercialEvidenceGraph?.nodes?.find((node) =>
        node.evidenceRef === personEvidenceRef
      )?.commercialDiscoveryMotionId !== selectedMotion.id ||
      result.commercialEvidenceGraph?.nodes?.find((node) =>
        node.evidenceRef === organizationEvidenceRef
      )?.provider !== 'openrouter_exa_web_search' ||
      !result.commercialEvidenceGraph?.nodes?.find((node) =>
        node.evidenceRef === evidenceRef
      )?.roles?.includes('defined_buyer') ||
      !result.winner?.action?.includes('Dr. Ava Rivera') ||
      result.winner?.action?.includes('{{TARGET_NAME}}') ||
      result.winner?.candidateId !== targetCandidateId ||
      result.winner?.revenuePath?.causalWitness?.contractVersion !==
        'revenue_causal_witness_v1' ||
      result.winner?.revenuePath?.causalWitness?.stopLimit !== 14 ||
      result.winner?.revenuePath?.causalWitness?.stopUnit !==
        'calendar_days' ||
      result.result?.incrementalRevenueGate?.passed !== true ||
      result.result?.incrementalRevenueGate?.observablePaidConversion !==
        true ||
      result.result?.incrementalRevenueGate?.attribution !== true ||
      result.result?.incrementalRevenueGate
        ?.counterfactualIncrementality !== true ||
      result.result?.incrementalRevenueGate?.numericStop !== true ||
      result.result?.allowedChannel !== 'partner_channel' ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `two-stage target binding failed: ${JSON.stringify({ requests: requests.length, result })}`
    );
  }

  const prunedVariantPayload = structuredClone(downstreamPayload);
  prunedVariantPayload.commercialDiscoveryEvidence.plan.plans[0]
    .contingentFinalists.familyA.d.a[1].l =
      'After review, configure scheduling for {{TARGET_NAME}}.';
  const prunedVariantRequests = [];
  let prunedVariantCriticFinalists = [];
  const prunedVariant = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-pruned-operational-variant',
      kind: 'opportunity_tournament',
      payload: prunedVariantPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      prunedVariantRequests.push(request);
      if (request.responseFormat?.json_schema?.name !==
          'opportunity_tournament_critic_v1') {
        throw new Error(
          'pruned-variant path dispatched an unauthorized generator or repair'
        );
      }
      const task = JSON.parse(request.user || '{}');
      prunedVariantCriticFinalists = task.finalists || [];
      assertCompactCriticPair({
        request,
        task,
        finalists: prunedVariantCriticFinalists,
        expectedTargets: ['Dr. Ava Rivera']
      });
      return acceptedCriticCompletion(
        prunedVariantCriticFinalists,
        'generation-pruned-operational-variant-critic'
      );
    }
  });
  const prunedFamilies = new Set(
    prunedVariantCriticFinalists.map((finalist) => finalist.familyId)
  );
  if (prunedVariantRequests.length !== 1 ||
      prunedVariant.status !== 'completed' ||
      prunedVariant.usage?.calls !== 1 ||
      prunedVariant.searchSpace?.modelCalls !== 1 ||
      prunedVariant.searchSpace?.structuredRepair?.attempted !== false ||
      prunedVariant.searchSpace?.dimensionCounts?.actions !== 3 ||
      prunedVariant.searchSpace?.prunedPrimaryActionVariantCount !== 1 ||
      prunedVariantCriticFinalists.length !== 2 ||
      prunedFamilies.size !== 2 ||
      prunedVariantCriticFinalists.some((finalist) =>
        /configure scheduling/i.test(finalist.primaryAction || '')
      ) ||
      /configure scheduling/i.test(prunedVariant.winner?.action || '') ||
      /configure scheduling/i.test(prunedVariant.runnerUp?.action || '') ||
      prunedVariant.searchSpace?.commercialCritic
        ?.criticInputFinalistCount !== 2 ||
      prunedVariant.result?.incrementalRevenueGate?.criticVerdict !==
        'accepted') {
    throw new Error(
      `single operational variant was not deterministically pruned before the critic: ${JSON.stringify({ requests: prunedVariantRequests.length, finalists: prunedVariantCriticFinalists, result: prunedVariant })}`
    );
  }

  const conflictingModePayload = structuredClone(downstreamPayload);
  const conflictingMotion =
    conflictingModePayload.commercialDiscoveryEvidence.plan.plans[0];
  for (const [familyName, family] of Object.entries({
    familyA: conflictingMotion.contingentFinalists.familyA,
    familyB: conflictingMotion.contingentFinalists.familyB
  })) {
    family.d.a = family.d.a.map((action, index) => ({
      ...action,
      l:
        `After review, use permissioned outreach to ask {{TARGET_NAME}} for one paid partner referral (${familyName}-${index + 1}).`
    }));
  }
  let conflictingModeCalls = 0;
  const conflictingMode = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-explicit-acquisition-conflict',
      kind: 'opportunity_tournament',
      payload: conflictingModePayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => {
      conflictingModeCalls += 1;
      throw new Error('explicit acquisition-mode conflict reached critic');
    }
  });
  assertTechnicalRecovery(
    conflictingMode,
    conflictingModeCalls,
    'explicit permissioned-outreach text in partner-channel family'
  );
  if (conflictingMode.searchSpace?.motionConflictCount < 1) {
    throw new Error(
      `explicit acquisition-mode conflict was not diagnosed: ${JSON.stringify(conflictingMode.searchSpace)}`
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
  const firstMotion = structuredClone(scenario.plans(evidenceRef)[0]);
  multiMotionPayload.commercialDiscoveryEvidence.plan =
    {
      ...structuredClone(discoveryPlan),
      plans: [firstMotion, structuredClone(selectedMotion)]
    };
  const firstEvidenceRef =
    'external_discovery:555555555555555555555555';
  const firstCandidateId =
    'candidate:external:666666666666666666666666';
  multiMotionPayload.commercialDiscoveryEvidence.attempts[1].resultCount = 2;
  multiMotionPayload.commercialDiscoveryEvidence.resultCount = 3;
  multiMotionPayload.commercialDiscoveryEvidence.queryHash =
    commercialDiscoveryAttemptLedgerHash(
      multiMotionPayload.commercialDiscoveryEvidence.attempts
    );
  multiMotionPayload.commercialDiscoveryEvidence.evidence.push({
    motionId: firstMotion.id,
    evidenceRef: firstEvidenceRef,
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
    motionId: firstMotion.id,
    id: firstCandidateId,
    kind: 'person',
    displayLabel: 'Dr. Noor Patel',
    organization: 'Summit Pediatrics',
    role: 'Pediatrician',
    commercialRole: 'referral_partner',
    market: 'Queens, New York',
    publicUrl: 'https://summit-pediatrics.example/noor-patel',
    provider: 'people_data_labs_person_search',
    evidenceRefs: [firstEvidenceRef],
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
      assertCompactCriticPair({
        request,
        task,
        finalists,
        expectedTargets: ['Dr. Ava Rivera', 'Dr. Noor Patel']
      });
      if (finalists.length !== 2 ||
          !finalists.some((item) =>
            item.primaryAction?.includes('Dr. Ava Rivera')
          ) ||
          !finalists.some((item) =>
            item.primaryAction?.includes('Dr. Noor Patel')
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
          return Number(rightAction.includes('Dr. Ava Rivera')) -
            Number(leftAction.includes('Dr. Ava Rivera'));
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
              'Dr. Ava Rivera'
            ) ? 'strong' : 'moderate',
            evidenceStrength: 'strong',
            reachability: 'strong',
            timeToFirstDollar: 'fast',
            paidOutcomeProbability: item.primaryAction?.includes(
              'Dr. Ava Rivera'
            ) ? 0.9 : 0.6,
            timeToFirstDollarDays: item.primaryAction?.includes(
              'Dr. Ava Rivera'
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
      ) !== JSON.stringify([firstMotion.id, selectedMotion.id]) ||
      !multiMotion.winner?.action?.includes('Dr. Ava Rivera') ||
      multiMotion.winner?.candidateId !== targetCandidateId ||
      multiMotion.searchSpace?.commercialCritic
        ?.criticInputFinalistCount !== 2 ||
      multiMotion.usage?.calls !== 1) {
    throw new Error(
      `two valid motions were not compared by the critic: ${JSON.stringify(multiMotion)}`
    );
  }

  const bindingFailurePayload = structuredClone(downstreamPayload);
  bindingFailurePayload.commercialDiscoveryEvidence.candidates[1].kind =
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
  organizationSlotMismatchPayload.commercialDiscoveryEvidence
    .candidates[1].organization = 'Fabricated Pediatrics';
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
  const otherMotionId = scenario.plans(evidenceRef)[0].id;
  crossMotionPayload.commercialDiscoveryEvidence.candidates[1].motionId =
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

  const chainIntegrityChecks = [
    {
      label: 'decision-maker provenance mismatch',
      mutate(payload) {
        payload.commercialDiscoveryEvidence.evidence[1].provenance =
          'people_data_labs_professional_record';
      }
    },
    {
      label: 'decision-maker public URL mismatch',
      mutate(payload) {
        payload.commercialDiscoveryEvidence.candidates[1].publicUrl =
          'https://www.linkedin.com/in/not-ava-rivera';
      }
    },
    {
      label: 'decision-maker commercial-role mismatch',
      mutate(payload) {
        payload.commercialDiscoveryEvidence.candidates[1].commercialRole =
          'buyer';
      }
    }
  ];
  for (const check of chainIntegrityChecks) {
    const payload = structuredClone(downstreamPayload);
    check.mutate(payload);
    let calls = 0;
    const rejected = await runOpportunityTournament({
      job: {
        id: `job-two-stage-${check.label.replace(/\W+/g, '-')}`,
        kind: 'opportunity_tournament',
        payload
      },
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => {
        calls += 1;
        throw new Error(`${check.label} dispatched an LLM call`);
      }
    });
    assertTechnicalRecovery(rejected, calls, check.label);
  }

  const noTargetPayload = structuredClone(downstreamPayload);
  const noTargetAttempts =
    noTargetPayload.commercialDiscoveryEvidence.attempts;
  for (const attempt of noTargetAttempts) {
    attempt.status = 'not_found';
    attempt.resultCount = 0;
  }
  noTargetPayload.commercialDiscoveryEvidence.queryHash =
    commercialDiscoveryAttemptLedgerHash(noTargetAttempts);
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

async function verifyPaidDemandTargetProtocolEndToEnd() {
  const scenario = cases[1];
  const planner = plannerJob(scenario);
  const catalog = buildEvidenceCatalog(planner.payload, {}, now, {
    includeSystemAttributionCapability: true
  });
  const evidenceRef = catalog.find((item) =>
    typeof item.id === 'string' && item.id.startsWith('observation:')
  )?.id;
  if (!evidenceRef) {
    throw new Error('paid-demand protocol fixture has no supply evidence');
  }
  const original = scenario.plans(evidenceRef)[0];
  const motion = plan({
    ...original,
    acquisitionMode: 'inbound',
    acquisitionMechanism:
      'Inbound platform discovery of one current compensated role'
  });
  for (const familyKey of ['familyA', 'familyB']) {
    const family = motion.contingentFinalists[familyKey];
    family.d.c = family.d.c.map((item, index) => ({
      ...item,
      l:
        `Inbound platform discovery at {{TARGET_NAME}} (route ${index + 1})`
    }));
    family.d.r[0].c =
      'Use inbound platform discovery at {{TARGET_NAME}} and submit one application through the official application page.';
  }
  const stripTargetRef = (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((item) =>
        item === 'target:evidence' ? [] : [stripTargetRef(item)]
      );
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        stripTargetRef(item)
      ]));
    }
    return value;
  };
  motion.contingentFinalists = stripTargetRef(
    motion.contingentFinalists
  );
  const jobURL = 'https://jobs.acme.example/senior-go-engineer';
  const discoveryPlan = await runOpportunityDiscoveryPlanner({
    job: planner,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'One current compensated role is the nearest paid path.',
        plans: [{
          ...motion,
          contingentFinalists: compactContingentFinalists(
            motion.contingentFinalists
          )
        }]
      },
      usage,
      generationId: 'generation-paid-demand-target-protocol-planner',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 900,
        contentSha256: '4'.repeat(64)
      },
      annotations: [{
        type: 'url_citation',
        url_citation: {
          url: jobURL,
          title: 'Acme Systems Senior Go Engineer role',
          content:
            'Acme Systems is currently hiring a salaried Senior Go Engineer through its official application page.'
        }
      }]
    })
  });
  if (discoveryPlan.status !== 'planned') {
    throw new Error(
      `paid-demand omitted-target planner failed: ${JSON.stringify(discoveryPlan)}`
    );
  }
  const selectedMotion = structuredClone(discoveryPlan.plans[0]);
  const attempt = {
    id: 'attempt-paid-demand-folded-exa-search',
    provider: 'openrouter_exa_web_search',
    operation: 'forced_exa_web_search',
    queryHash: discoveryPlan.webSearchReceipt.requestHash,
    status: 'succeeded',
    estimatedSpendMicros: 5_000,
    actualSpendMicros: 0,
    creditsUsed: 1,
    resultCount: 1,
    reservedAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
    completedAt: '2026-08-01T12:00:00Z'
  };
  const jobEvidenceRef =
    'external_discovery:777777777777777777777777';
  const candidateID =
    'candidate:external:888888888888888888888888';
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
      contractVersion: COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT,
      attempted: true,
      status: 'found',
      motion: selectedMotion.id,
      buyerArchetype: selectedMotion.buyer,
      queryHash: commercialDiscoveryAttemptLedgerHash([attempt]),
      market: selectedMotion.market,
      providersAttempted: ['openrouter_exa_web_search'],
      providerCalls: 1,
      paidProviderCalls: 1,
      creditsUsed: 1,
      resultCount: 1,
      patientTargetingExcluded: true,
      sideEffectsPerformed: 0,
      attempts: [attempt],
      plan: {
        ...discoveryPlan,
        plans: [selectedMotion]
      },
      evidence: [{
        motionId: selectedMotion.id,
        evidenceRef: jobEvidenceRef,
        kind: 'verified_external_live_demand',
        label: 'Acme Systems Senior Go Engineer role',
        summary:
          `Acme Systems is currently hiring for a salaried, compensated Senior Go Engineer role requiring Go and PostgreSQL. Inbound platform discovery reaches the official application page at ${jobURL}. Applying there can produce one accepted compensation offer and salary payment.`,
        url: jobURL,
        provider: 'openrouter_exa_web_search',
        provenance: 'openrouter_exa_url_citation',
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
        observedAt: '2026-08-01T12:00:00Z'
      }],
      candidates: [{
        motionId: selectedMotion.id,
        id: candidateID,
        kind: 'job_posting',
        displayLabel: 'Acme Systems Senior Go Engineer role',
        organization: 'Acme Systems',
        role: 'Senior Go Engineer',
        market: 'Remote United States',
        publicUrl: jobURL,
        provider: 'openrouter_exa_web_search',
        commercialRole: 'paid_demand',
        evidenceRefs: [jobEvidenceRef],
        contactPaths: [{
          kind: 'public_professional_url',
          available: true,
          verified: true,
          reference: jobURL
        }],
        exactNamedCandidate: true,
        identityResolved: true
      }],
      discoveredAt: '2026-08-01T12:00:00Z'
    }
  };
  const requests = [];
  let criticIssue = '';
  const result = await runOpportunityTournament({
    job: {
      id: 'job-paid-demand-target-protocol-end-to-end',
      kind: 'opportunity_tournament',
      payload: downstreamPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      requests.push(request);
      if (request.responseFormat?.json_schema?.name !==
          'opportunity_tournament_critic_v1') {
        criticIssue =
          'paid-demand target protocol dispatched a generator or repair';
      }
      const task = JSON.parse(request.user || '{}');
      const finalists = task.finalists || [];
      const finalistFamilies = new Set(
        finalists.map((finalist) => finalist.familyId)
      );
      const requestBytes = Buffer.byteLength(
        JSON.stringify(request),
        'utf8'
      );
      if (finalists.length !== 2 ||
          finalistFamilies.size !== 2 ||
          task.contextMode !== 'bound_family_diverse_pair_v1' ||
          task.executionPolicy?.executionAuthorization !== 'none' ||
          task.executionPolicy?.requiresReview !== true ||
          task.executionPolicy?.sideEffectsPerformed !== 0 ||
          request.maxTokens !== 1_200 ||
          requestBytes > 36 * 1_024 ||
          finalists.some((finalist) =>
            finalist.evidenceBindings?.length !== 7 ||
            finalist.evidenceBindings?.find((binding) =>
              binding.role === 'exact_outside_target'
            )?.kind !== 'job_posting'
          )) {
        criticIssue =
          `paid-demand critic did not receive one safe family-diverse pair: ${JSON.stringify({ finalists, task, requestBytes })}`;
      }
      const discoveryRoles = new Set([
        'exact_outside_target',
        'defined_buyer',
        'paid_offer',
        'acquisition',
        'conversion_destination',
        'paid_conversion'
      ]);
      if (finalists.some((finalist) =>
        finalist.evidenceBindings.some((binding) =>
          discoveryRoles.has(binding.role)
            ? !binding.evidenceRefs.includes(jobEvidenceRef)
            : binding.role === 'attribution' && (
                binding.evidenceRefs.includes(jobEvidenceRef) ||
                !binding.evidenceRefs.includes(
                  PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
                )
              )
        ) || JSON.stringify(finalist).includes('target:evidence')
      )) {
        criticIssue =
          `paid-demand target roles were not bound exactly: ${JSON.stringify(finalists)}`;
      }
      return acceptedCriticCompletion(
        finalists,
        'generation-paid-demand-target-protocol-critic'
      );
    }
  });
  if (criticIssue ||
      requests.length !== 1 ||
      result.status !== 'completed' ||
      result.usage?.calls !== 1 ||
      result.result?.incrementalRevenueGate?.passed !== true ||
      result.winner?.candidateId !== candidateID ||
      !result.winner?.action?.includes(
        'Acme Systems Senior Go Engineer role'
      ) ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `paid-demand target protocol did not survive provider binding and critic: ${JSON.stringify({ criticIssue, requests: requests.length, result })}`
    );
  }
}

async function verifyProductionShapedPlannerHeadroom(job, evidenceRef) {
  const productionJob = structuredClone(job);
  const snapshot = productionJob.payload.evidenceSnapshot;
  const longLabel =
    'Current source-backed professional activity and service context';
  const longSummary =
    'Approved professional evidence describing current work, geographic context, relevant expertise, public service information, and source-backed constraints without private contact data or unsupported commercial claims. ';
  productionJob.payload.commercialContext = {
    profile: {
      profession: 'Independent professional with a current paid service',
      location: 'New York, New York, United States',
      availability: 'Current availability remains bounded by approved capacity and geographic constraints.',
      specialties: Array.from({ length: 6 }, (_, index) =>
        `Source-backed professional specialty ${index + 1} ${'expertise '.repeat(7)}`
      ),
      serviceAreas: Array.from({ length: 4 }, (_, index) =>
        `Verified service area ${index + 1} ${'local market '.repeat(5)}`
      ),
      currentFocus: Array.from({ length: 2 }, (_, index) => ({
        name: `Current professional focus ${index + 1}`,
        description:
          `${longSummary} ${'bounded context '.repeat(8)}`,
        status: 'current',
        priority: 'high'
      }))
    },
    allowedChannels: ['partner_channel'],
    allowedActions: ['research', 'recommend', 'review'],
    permissionRequired: 'explicit_user_approval'
  };
  snapshot.sources.push(...Array.from({ length: 16 }, (_, index) => ({
    id: `production-shaped-source-${index + 1}`,
    label: `${longLabel} ${index + 1}`,
    url: `https://owner.example/context/${index + 1}/`,
    status: 'approved',
    profileControlled: true
  })));
  snapshot.sourceEvidence.push(...Array.from({ length: 16 }, (_, index) => ({
    id: `production-shaped-observation-${index + 1}`,
    observationId: `production-shaped-observation-${index + 1}`,
    sourceId: `production-shaped-source-${index + 1}`,
    label: `${longLabel} ${index + 1} ${'context '.repeat(15)}`,
    summary: `${longSummary.repeat(3)} Record ${index + 1}.`,
    url: `https://owner.example/context/${index + 1}/${'professional-evidence/'.repeat(10)}`,
    observedAt: now.toISOString(),
    status: 'approved'
  })));
  let requestSeen;
  const result = await runOpportunityDiscoveryPlanner({
    job: productionJob,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      requestSeen = request;
      const productionMotion = cases[0].plans(evidenceRef)[0];
      productionMotion.contingentFinalists = compactContingentFinalists(
        productionMotion.contingentFinalists
      );
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: 'One compact source-bound professional motion.',
          plans: [productionMotion]
        },
        usage,
        generationId: 'generation-production-shaped-headroom',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 900,
          contentSha256: '9'.repeat(64)
        },
        annotations: []
      };
    }
  });
  const requestBytes = result.preflight?.requestBodyByteCount || 0;
  productionShapedPlannerRequestBytes = requestBytes;
  if (!requestSeen || result.status !== 'planned' ||
      requestBytes < 32 * 1_024 ||
      requestBytes > 35 * 1_024) {
    throw new Error(
      `production-shaped planner request lacks bounded headroom: ${JSON.stringify({ requestBytes, evidenceCount: JSON.parse(requestSeen?.user || '{}').evidenceCatalog?.length, preflight: result.preflight, status: result.status, reason: result.reason })}`
    );
  }
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

function assertCompactCriticPair({
  request,
  task,
  finalists,
  expectedTargets
}) {
  const expectedRoles = [
    'acquisition',
    'attribution',
    'conversion_destination',
    'defined_buyer',
    'exact_outside_target',
    'paid_conversion',
    'paid_offer'
  ];
  const families = new Set(
    finalists.map((finalist) => finalist.familyId)
  );
  const targetClaims = finalists.map((finalist) =>
    finalist.evidenceBindings?.find((binding) =>
      binding.role === 'exact_outside_target'
    )?.claim || ''
  );
  const everyRoleIsBound = finalists.every((finalist) => {
    const bindings = finalist.evidenceBindings || [];
    const roles = bindings.map((binding) => binding.role).sort();
    return JSON.stringify(roles) === JSON.stringify(expectedRoles) &&
      bindings.every((binding) =>
        typeof binding.claim === 'string' &&
        binding.claim.length > 0 &&
        Array.isArray(binding.evidenceRefs) &&
        binding.evidenceRefs.length > 0
      );
  });
  const targetBindingsArePublic = finalists.every((finalist) => {
    const target = finalist.evidenceBindings?.find((binding) =>
      binding.role === 'exact_outside_target'
    );
    return target?.kind === 'person' && [
      'Riverside Pediatrics',
      'Summit Pediatrics'
    ].includes(target.organization);
  });
  const userText = request.user || '';
  const responseSchema = request.responseFormat?.json_schema?.schema;
  const privateContactLeaked =
    /(?:contactPaths|mailto:|tel:|sms:|work_email|mobile_phone|phone_numbers|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.test(
      userText
    );
  const requestBytes = Buffer.byteLength(JSON.stringify(request), 'utf8');
  if (finalists.length !== 2 ||
      families.size !== 2 ||
      task.contextMode !== 'bound_family_diverse_pair_v1' ||
      task.executionPolicy?.executionAuthorization !== 'none' ||
      task.executionPolicy?.requiresReview !== true ||
      task.executionPolicy?.sideEffectsPerformed !== 0 ||
      request.maxTokens !== 1_200 ||
      responseSchema?.properties?.comparisons?.maxItems !== 2 ||
      responseSchema?.properties?.selectedOrdering?.maxItems !== 2 ||
      requestBytes > 36 * 1_024 ||
      !everyRoleIsBound ||
      !targetBindingsArePublic ||
      privateContactLeaked ||
      !expectedTargets.every((expected) =>
        targetClaims.includes(expected)
      )) {
    throw new Error(
      `critic did not receive one compact, safe, family-diverse pair: ${JSON.stringify({
        finalists,
        targetClaims,
        expectedTargets,
        task,
        requestBytes,
        maxTokens: request.maxTokens,
        responseSchema
      })}`
    );
  }
}

function acceptedCriticCompletion(finalists, generationId) {
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
        reason:
          'The exact target, active referral action, paid booking, attribution field, and numeric stop form a complete incremental path.'
      })),
      reason:
        'The ordering follows paid-outcome probability and nearest-cash criteria.'
    },
    usage: {
      prompt_tokens: 800,
      completion_tokens: 400,
      total_tokens: 1_200,
      cost: 0.005
    },
    generationId,
    diagnostics: {
      finishReason: 'stop',
      nativeFinishReason: 'stop',
      contentByteCount: 700,
      contentSha256: '8'.repeat(64)
    }
  };
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
        maxOutputTokens: DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS,
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
      ...motion.targetSlot,
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
      ? 'After review, make one review-first request for one partner referral'
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
  const sharedVariants = ['path option one', 'path option two'];
  const sharedDimensions = {
    r: [{
      l: `${motion.paidOffer}: attributable payment`,
      e: [ref, targetRef, attributionRef],
      v: 'incremental_revenue_v3',
      rm: mechanism,
      io: `One additional paid income outcome from ${motion.paidOffer}.`,
      a: motion.acquisitionMode,
      c: acquisitionAction('shared paid path'),
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
      k: causalWitness(mechanism, attributionMethod),
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
    o: sharedVariants.map((variant) => ({
      l: `${motion.paidOffer} (${variant})`,
      e: paidDemand ? [targetRef] : [ref]
    })),
    b: sharedVariants.map((variant) => ({
      l: `${motion.buyer} via {{TARGET_NAME}} (${variant})`,
      e: [buyerRef]
    })),
    t: sharedVariants.map((variant) => ({
      l: `Current target check (${variant})`,
      e: [ref],
      q: 'current'
    })),
    p: sharedVariants.map((variant) => ({
      l: `Verified seller and target proof (${variant})`,
      e: [ref, targetRef]
    }))
  };
  const makeFamily = (key, variantA, variantB) => ({
    l: `${motion.id} ${key}`,
    m: motion.acquisitionMode,
    e: [ref, targetRef, attributionRef],
    s: scores,
    tacticKey: key,
    d: {
      ...structuredClone(sharedDimensions),
      c: [variantA, variantB].map((variant) => ({
        l: channel(variant),
        e: [targetRef]
      })),
      a: [variantA, variantB].map((variant) => ({
        l: acquisitionAction(variant),
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

function causalWitness(
  revenueMechanism,
  attributionMethod,
  overrides = {}
) {
  return {
    v: 'revenue_causal_witness_v1',
    i: 'counterfactual_incremental_paid_income',
    c: revenueMechanism,
    o: revenueMechanism,
    t: attributionMethod,
    d: 'separate_conversion_destination',
    s: 'stop_at_limit',
    n: 14,
    u: 'calendar_days',
    ...overrides
  };
}

function applyNovelTypedCausalSemantics(value) {
  const motion = structuredClone(value);
  for (const familyKey of ['familyA', 'familyB']) {
    const revenue = motion.contingentFinalists[familyKey].d.r[0];
    revenue.io =
      'Cash reaches the owner only because this reviewed path succeeds.';
    revenue.c =
      'Invite {{TARGET_NAME}} as the named partner to route one suitable family toward the service.';
    revenue.o = 'Funds settle for one completed visit.';
    revenue.ats =
      'Persist the originating practice beside the transaction.';
    revenue.cd = 'https://owner.example/offer';
    revenue.st = 'Conclude on the fourteenth day.';
  }
  return motion;
}

function compactContingentFinalists(value) {
  const materialized = structuredClone(value);
  const familyA = materialized.familyA;
  const familyB = materialized.familyB;
  const tactic = (family) => ({
    l: family.l,
    m: family.m,
    tacticKey: family.tacticKey,
    e: family.e.slice(0, 2),
    s: family.s,
    c: family.d.c,
    a: family.d.a,
    f: family.d.f
  });
  return {
    seedContract: materialized.seedContract,
    pathBase: {
      e: familyA.e,
      r: familyA.d.r,
      o: familyA.d.o,
      b: familyA.d.b,
      t: familyA.d.t,
      p: familyA.d.p
    },
    tacticA: tactic(familyA),
    tacticB: tactic(familyB),
    w: materialized.w
  };
}
