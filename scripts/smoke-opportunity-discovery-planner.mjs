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
const DISCOVERY_PLANNER_COMPACT_RESPONSE_TARGET_BYTES = 20 * 1024;
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
        serviceAreas: ['Queens, NY, USA', 'Manhattan, NY, USA']
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
        market: 'Queens, New York, United States',
        targetRoleTerms: ['pediatrician', 'pediatric physician'],
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
        market: 'Queens, New York, United States',
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
        acquisitionMode: 'permissioned_outreach',
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
        acquisitionMode: 'permissioned_outreach',
        buyer: 'A service firm buying delivery-system consulting',
        counterparty: 'An operations owner at a service firm',
        paidOffer: 'Paid delivery-system diagnostic',
        evidenceRefs: [ref],
        query: 'service firm operations owner delivery systems',
        market: 'United States',
        targetRoleTerms: ['chief operating officer', 'head of operations'],
        organizationTerms: ['professional services firm'],
        acquisitionMechanism: 'One review-first tailored diagnostic invitation',
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
        id: 'workflow_procurement_demand',
        priority: 1,
        searchMode: 'public_live_demand',
        commercialRole: 'paid_demand',
        acquisitionMode: 'permissioned_outreach',
        buyer: 'A field-service company procuring paid workflow software',
        counterparty: 'The company publishing a current software procurement notice',
        paidOffer: 'Paid workflow-software subscription',
        evidenceRefs: [ref],
        query: 'field service company workflow software procurement RFP',
        market: 'United States',
        organizationTerms: ['field service company'],
        acquisitionMechanism: 'One reviewed response to the buyer-authored procurement notice',
        conversionDestination: 'The verified pricing and signup page',
        paidConversion: 'One paid software subscription',
        attributionSignal: 'Procurement id and payment receipt store the originating buyer request'
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
        targetRoleTerms: ['operations director', 'director of operations'],
        organizationTerms: ['field service company'],
        acquisitionMechanism: 'One review-first tailored demo invitation',
        conversionDestination: 'The verified pricing and signup page',
        paidConversion: 'One paid software subscription',
        attributionSignal: 'CRM source and payment receipt store the selected company and tournament id'
      })
    ]
  }
];

function twoPlannerMotions(candidateValue, evidenceRef) {
  const primary = structuredClone(candidateValue);
  primary.priority = 1;
  const signature = (motion) => [
    motion.searchMode,
    motion.commercialRole,
    motion.acquisitionMode
  ].join('\x00');
  const companion = [
    cases[0].plans(evidenceRef)[0],
    cases[1].plans(evidenceRef)[0],
    cases[2].plans(evidenceRef)[1]
  ].find((motion) =>
    motion.id !== primary.id && signature(motion) !== signature(primary)
  );
  if (!companion) {
    throw new Error(`no distinct planner companion for ${primary.id}`);
  }
  const secondary = structuredClone(companion);
  secondary.priority = 2;
  secondary.market = primary.market;
  return [primary, secondary];
}

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
      const responsePlans = scenario.plans(evidenceRef).slice(0, 2);
      for (const responsePlan of responsePlans) {
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
      }
      const responseData = {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'This search is the closest supported path to current paid demand or a qualified commercial channel.',
        plans: responsePlans
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
      for (const responsePlan of responseData.plans) {
        if (responsePlan.commercialRole !== 'paid_demand') continue;
        // Paid-demand route selection uniquely implies one exact public live
        // demand target. These schema-valid slot values reproduce planner
        // protocol drift seen in production and must be normalized locally;
        // the outside target itself still requires provider evidence.
        responsePlan.targetSlot.finalTargetKind = 'person';
        responsePlan.targetSlot.resolutionStrategy =
          'organization_then_decision_maker';
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
          `${scenario.name}: valid call-1 response is ${responseBytes} bytes, above the 20 KiB compact-response target`
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
        'Keep the complete JSON at or below 20 KiB.'
      ) ||
      !requestSeen.system?.includes(
        'shared pathBase plus two tactic deltas'
      ) ||
      !requestSeen.system?.includes(
        'Return exactly two distinct plans'
      ) ||
      requestSeen.system?.includes('Return one plan') ||
      !requestSeen.system?.includes(
        'Return one minified object, concise strings, no formatting whitespace'
      ) ||
      result.status !== 'planned' ||
      result.contractVersion !== OPPORTUNITY_DISCOVERY_PLAN_CONTRACT ||
      result.plans.length !== 2 ||
      new Set(result.plans.map((item) =>
        `${item.searchMode}\x00${item.commercialRole}\x00${item.acquisitionMode}`
      )).size !== 2 ||
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
  const followUpEvidenceSchema = plannerDefinitions.followUpItem
    ?.properties?.e || {};
  const followUpLabelPattern = plannerDefinitions.followUpItem
    ?.properties?.l?.pattern || '';
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
      JSON.stringify(plannerPrompt.outputContract.targetRoleMap.buyer) !==
        JSON.stringify(['acquisition', 'channel_fit', 'defined_buyer']) ||
      !plannerPrompt.outputContract?.revenuePath ||
      !/exactly 2 ranked, economically distinct plans/i.test(
        plannerPrompt.outputContract?.plan || ''
      ) ||
      !Array.isArray(plannerPrompt.hardRules) ||
      plannerPrompt.hardRules.length < 7 ||
      !plannerPrompt.hardRules.some((rule) =>
        /2 distinct motions.*each pathBase\+2 causal tactics/i.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /approvedMarkets\|ServiceAreas\|Location.*local=region\+country.*Remote\[\+country\]=available paid_demand.*no guess\/widen/is.test(
          rule
        )
      ) ||
      requestSeen.responseFormat?.json_schema?.schema?.properties
        ?.plans?.maxItems !== 2 ||
      requestSeen.responseFormat?.json_schema?.schema?.properties
        ?.plans?.items?.properties?.market?.pattern !==
          '^[^\\r\\n]{1,120}$' ||
      !requestSeen.responseFormat?.json_schema?.schema?.properties
        ?.plans?.items?.required?.includes('routeContractVersion') ||
      !requestSeen.responseFormat?.json_schema?.schema?.properties
        ?.plans?.items?.required?.includes('motionKind') ||
      !requestSeen.responseFormat?.json_schema?.schema?.properties
        ?.plans?.items?.required?.includes('demandArtifactKind') ||
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
      JSON.stringify(
        plannerDefinitions.revenuePath?.properties?.c?.enum
      ) !== JSON.stringify(['project_first_viable_tactic_action']) ||
      JSON.stringify(causalWitnessSchema.required) !== JSON.stringify([
        'v',
        'i',
        'c',
        'o',
        'p',
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
      !causalWitnessSchema.properties?.p?.enum?.includes(
        'paid_booking_terminal'
      ) ||
      !causalWitnessSchema.properties?.p?.enum?.includes(
        'compensated_role_terminal'
      ) ||
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
      followUpEvidenceSchema.maxItems !== 2 ||
      followUpEvidenceSchema.items?.pattern !==
        '^observation:.+$' ||
      followUpEvidenceSchema.items?.$ref ||
      !/no reply after.*one review-first follow-up/i.test(
        followUpLabelPattern
      ) ||
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
      !/active cash ask:.*paid partner referral.*target purchase\/booking.*paid-demand response.*no setup\/support\/follow-up/is.test(
        requestSeen.responseFormat?.json_schema?.schema?.$defs
          ?.actionItem?.properties?.l?.description || ''
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /a:2\/tactic.*referral=partner referral\/introduction.*current paid offer.*paid booking\/payment.*buyer=ask target to book\/buy\/sign current paid offer.*paid_demand=paid application\/proposal response.*marketplace\/directory placement/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /k\.p=rm\+"_terminal"/i.test(rule)
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /motionKind route is authoritative.*two different referral counterparties are valid diversity.*never invent paid demand/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /professional=person\/single.*local_org=person\/org->decision-maker.*never terminal org.*targetRoleTerms=1 title family.*organizationTerms=context/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /buyer\/referral c\+a: use that exact form.*URL=HTTPS LinkedIn \/in.*no message\/DM\/InMail\/connect\/email\/phone\/form/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /c=project_first_viable_tactic_action.*project valid tactic a/is.test(
          rule
        )
      ) ||
      !/projects r\.c per tactic/is.test(
        requestSeen.system || ''
      ) ||
      !/referral_partner=partner referral\/introduction of defined buyer to current paid offer\+paid booking\/payment.*buyer=ask target to book\/buy\/sign current paid offer.*paid_demand=typed paid application\/proposal response.*marketplace\/directory placement are invalid/is.test(
        requestSeen.system || ''
      ) ||
      !/compensated_job finds an employer job posting.*buyer_solicitation finds a buyer-authored paid RFP\/RFQ\/tender\/procurement notice\/explicit request.*two referral motions with different counterparties are valid.*diversity never requires paid_demand.*supplier\/competitor offers.*accepts insurance.*are supply, never demand/is.test(
        requestSeen.system || ''
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /paid demand needs employer_job_posting or buyer_rfp\/rfq\/tender\/procurement_notice\/paid_request.*supplier offers.*marketplaces.*accepts-insurance pages are not demand/is.test(
          rule
        )
      ) ||
      /claims no email\/phone\/form\/proposal route/i.test(
        requestSeen.system || ''
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /r\.o describes that one terminal rm event.*not objective alternatives/is.test(
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
  if (result.plans[0].commercialRole === 'paid_demand' && (
    result.plans[0].targetSlot?.finalTargetKind !== 'live_paid_demand' ||
    result.plans[0].targetSlot?.resolutionStrategy !==
      'single_exact_target'
  )) {
    throw new Error(
      `${scenario.name}: paid-demand target-slot protocol drift was not canonicalized: ${JSON.stringify(result.plans[0].targetSlot)}`
    );
  }
  const materialized = result.plans[0].contingentFinalists;
  const sharedDimensions = ['o', 'b', 't', 'p'];
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
    plans: envelopeScenario.plans(envelopeEvidenceRef).slice(0, 2)
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
const unsafeCompanionPlan = unsafeScenario.plans(unsafeRef)[0];
unsafeCompanionPlan.priority = 2;
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
        unsafeCompanionPlan
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
if (unsafeResult.status !== 'planned' ||
    !/patient|sensitive|private-contact/i.test(
      unsafeResult.planSelection?.rejectedPlans?.[0]?.reason || ''
    ) ||
    unsafeResult.plans.length !== 1 ||
    unsafeResult.planSelection?.acceptedPlanCount !== 1 ||
    unsafeResult.planSelection?.rejectedPlanCount !== 1 ||
    unsafeResult.sideEffectsPerformed !== 0) {
  throw new Error(
    `unsafe discovery plan was not fail-closed: ${JSON.stringify(unsafeResult)}`
  );
}

await verifyTypedCommercialMotionSelection(unsafeJob, unsafeRef);
await verifyPlannerMarketGroundingAndSiblingSalvage(unsafeJob, unsafeRef);
await verifySemanticDriftFailsClosed(unsafeJob, unsafeRef);
await verifySensitiveTargetFieldPolicy(unsafeJob, unsafeRef);
await verifyPrivateContactBearingURLsFailClosed();
await verifyDiscoveryRoleAndAdapterInvariants(unsafeJob, unsafeRef);
await verifyOmittedChildEvidenceCanonicalization(unsafeJob, unsafeRef);
await verifyOmittedTargetEvidenceProtocolCanonicalization(
  unsafeJob,
  unsafeRef
);
await verifyOneMotionFailsClosed(unsafeJob, unsafeRef);
await verifySingleOperationalVariantCanBePruned(unsafeJob, unsafeRef);
await verifyQualifiedPartnerReferralActionsPass(unsafeJob, unsafeRef);
await verifyCompactConversionActionProjection(unsafeJob, unsafeRef);
await verifyPaidDemandResponseActionVerbs(unsafeJob, unsafeRef);
await verifyOptionalSupportingBottleneckPasses(unsafeJob, unsafeRef);
await verifyServicePaymentOutcomesPass(unsafeJob, unsafeRef);
await verifyUnpaidServiceOutcomeFails(unsafeJob, unsafeRef);
await verifyMechanismSpecificTerminalOutcomes(unsafeJob, unsafeRef);
await verifyRevenueStopUnits(unsafeJob, unsafeRef);
await verifyNaturalBookingAttribution(unsafeJob, unsafeRef);
await verifyCausalPathDiagnosticsAreFieldSpecific(unsafeJob, unsafeRef);
await verifyTypedCausalWitnessContract(unsafeJob, unsafeRef);
await verifyRawOverCardinalityFailsClosed(unsafeJob, unsafeRef);
await verifyTruncatedPlannerFailsOnceWithSafeReceipt(unsafeJob);
await verifyTwoStageTargetBinding();
await verifyProviderAttestedBuyerReviewRoute();
await verifyPaidDemandTargetProtocolEndToEnd();
await verifyProductionShapedPlannerHeadroom(unsafeJob, unsafeRef);

if (smallestCompactResponseReduction < 0.25 ||
    largestCompactFixtureBytes >= largestMaterializedFixtureBytes) {
  throw new Error(
    `shared planner contract did not reduce representative response size: ${JSON.stringify({ largestMaterializedFixtureBytes, largestCompactFixtureBytes, smallestCompactResponseReduction })}`
  );
}

process.stdout.write(
  `opportunity discovery planner smoke passed (${cases.length} professions + unsafe adversary + all-span referral-population/private-contact safety + target role/acquisition/adapter guards + exact buyer public-profile route + child evidence-index canonicalization + target-slot protocol canonicalization + two-motion/shared-path/two-tactic materialization + legacy receipt compatibility + independent family-diverse critic + thrown-length safe receipt + qualified partner-referral/paid-demand response actions + peer-supplier paid-demand rejection + unqualified-introduction/artifact/untyped-listing rejection + optional supporting bottleneck + mechanism-specific terminal outcomes/disjunction-attempt rejection + service-payment outcomes + unpaid-service rejection + revenue-stop units + natural booking attribution + field-specific causal diagnostics + raw-cardinality guard + two-stage target binding + production-shaped/max-cardinality prompt headroom + 28 KiB response gate; call 1 max ${DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS} tokens / ${DISCOVERY_PLANNER_CALL_SPEND_CEILING_MICROS} micros; largest request ${largestPlannerRequestBytes} bytes / <=${36 * 1024}; production-shaped request ${productionShapedPlannerRequestBytes} bytes / <=${35 * 1024}; semantic contract +${largestPlannerContractBytes} bytes; compact finalist fixture ${largestCompactFixtureBytes} bytes vs ${largestMaterializedFixtureBytes} materialized (${Math.round(smallestCompactResponseReduction * 100)}%+ reduction); largest representative two-motion response ${largestPlannerResponseBytes} bytes / <=${DISCOVERY_PLANNER_COMPACT_RESPONSE_TARGET_BYTES} compact target)\n`
);

async function verifyTypedCommercialMotionSelection(
  referralJob,
  referralEvidenceRef
) {
  const run = async ({ job, plans, generationId, inspectRequest }) =>
    runOpportunityDiscoveryPlanner({
      job: structuredClone(job),
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async (request) => {
        inspectRequest?.(request);
        return {
          data: {
            contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
            status: 'planned',
            reason: 'Two typed commercial motions for bounded research.',
            plans
          },
          usage,
          generationId,
          diagnostics: {
            finishReason: 'stop',
            nativeFinishReason: 'stop',
            contentByteCount: 800,
            contentSha256: 'd'.repeat(64)
          },
          annotations: []
        };
      }
    });

  const programmerJob = plannerJob(cases[1]);
  const programmerEvidenceRef = buildEvidenceCatalog(
    programmerJob.payload,
    {},
    now,
    { includeSystemAttributionCapability: true }
  ).find((item) => /^observation:/i.test(item.id || ''))?.id;
  if (!programmerEvidenceRef) {
    throw new Error('typed-motion fixture produced no programmer evidence');
  }

  const compensatedMotions = cases[1].plans(programmerEvidenceRef);
  compensatedMotions[0].query =
    'Go consultancy RFP services available from suppliers';
  compensatedMotions[0].searchMode = 'local_organization';
  compensatedMotions[0].commercialRole = 'buyer';
  compensatedMotions[0].acquisitionMode = 'partner_channel';
  const compensated = await run({
    job: programmerJob,
    plans: compensatedMotions,
    generationId: 'generation-typed-compensated-job'
  });
  const compensatedJob = compensated.plans.find((item) =>
    item.id === 'active_backend_role'
  );
  if (compensated.status !== 'planned' ||
      compensated.plans.length !== 2 ||
      compensated.planSelection?.rejectedPlanCount !== 0 ||
      compensatedJob?.routeContractVersion !==
        'commercial_motion_route_v1' ||
      compensatedJob?.motionKind !== 'compensated_job' ||
      compensatedJob?.demandArtifactKind !== 'employer_job_posting' ||
      compensatedJob?.searchMode !== 'active_job_posting' ||
      compensatedJob?.commercialRole !== 'paid_demand' ||
      compensatedJob?.acquisitionMode !== 'permissioned_outreach' ||
      compensatedJob?.query !==
        'current compensated job hiring Go backend engineer Go PostgreSQL United States' ||
      /consultancy|supplier|rfp services available/i.test(
        compensatedJob?.query || ''
      ) ||
      compensated.sideEffectsPerformed !== 0) {
    throw new Error(
      `typed compensated-job route was not deterministically constructed: ${JSON.stringify(compensated)}`
    );
  }

  const safeReferral = cases[0].plans(referralEvidenceRef)[0];
  safeReferral.priority = 2;
  const sensitiveDirectBuyer = plan({
    id: 'postpartum_patient_direct_buyer',
    priority: 1,
    searchMode: 'professional_counterparty',
    commercialRole: 'buyer',
    acquisitionMode: 'permissioned_outreach',
    buyer: 'Postpartum patients seeking lactation care',
    counterparty: 'One individual postpartum patient',
    paidOffer: 'Paid lactation home visit',
    evidenceRefs: [referralEvidenceRef],
    query: 'postpartum patients seeking lactation home visits',
    market: 'Queens, New York, United States',
    targetRoleTerms: ['postpartum patient'],
    acquisitionMechanism:
      'One review-first invitation to purchase a lactation home visit',
    conversionDestination: 'The verified owner booking page',
    paidConversion: 'One completed paid lactation consultation',
    attributionSignal:
      'Booking source stores the selected target and tournament id'
  });
  const salvaged = await run({
    job: referralJob,
    plans: [sensitiveDirectBuyer, safeReferral],
    generationId: 'generation-one-valid-typed-motion'
  });
  const sensitiveRejection = salvaged.planSelection?.rejectedPlans
    ?.find((item) => item.id === sensitiveDirectBuyer.id)?.reason || '';
  if (salvaged.status !== 'planned' ||
      salvaged.plans.length !== 1 ||
      salvaged.plans[0]?.id !== safeReferral.id ||
      salvaged.planSelection?.acceptedPlanCount !== 1 ||
      salvaged.planSelection?.rejectedPlanCount !== 1 ||
      !/sensitive|patient|care recipient|professional referral/i.test(
        sensitiveRejection
      ) ||
      salvaged.sideEffectsPerformed !== 0) {
    throw new Error(
      `one-valid-motion salvage or sensitive-buyer rejection failed: ${JSON.stringify(salvaged)}`
    );
  }

  const invalidArtifactJob = cases[1].plans(programmerEvidenceRef)[0];
  invalidArtifactJob.demandArtifactKind = 'buyer_rfp';
  const invalidArtifactSolicitation =
    cases[1].plans(programmerEvidenceRef)[1];
  invalidArtifactSolicitation.demandArtifactKind = 'not_applicable';
  const bothInvalid = await run({
    job: programmerJob,
    plans: [invalidArtifactJob, invalidArtifactSolicitation],
    generationId: 'generation-both-invalid-typed-motions'
  });
  const artifactRejections = bothInvalid.planSelection?.rejectedPlans
    ?.map((item) => item.reason).join(' ') || '';
  if (bothInvalid.status !== 'blocked' ||
      bothInvalid.plans.length !== 0 ||
      bothInvalid.planSelection?.acceptedPlanCount !== 0 ||
      bothInvalid.planSelection?.rejectedPlanCount !== 2 ||
      !/employer-authored job-posting artifact/i.test(
        artifactRejections
      ) ||
      !/buyer-authored solicitation artifact/i.test(
        artifactRejections
      ) ||
      bothInvalid.sideEffectsPerformed !== 0) {
    throw new Error(
      `two invalid typed motions did not block locally: ${JSON.stringify(bothInvalid)}`
    );
  }

  const untypedMotions = cases[1].plans(programmerEvidenceRef);
  for (const motion of untypedMotions) {
    delete motion.routeContractVersion;
    delete motion.motionKind;
    delete motion.demandArtifactKind;
  }
  const untypedFresh = await run({
    job: programmerJob,
    plans: untypedMotions,
    generationId: 'generation-untyped-fresh-motions'
  });
  if (untypedFresh.status !== 'blocked' ||
      untypedFresh.plans.length !== 0 ||
      untypedFresh.planSelection?.acceptedPlanCount !== 0 ||
      untypedFresh.planSelection?.rejectedPlanCount !== 2 ||
      untypedFresh.planSelection?.rejectedPlans?.some((item) =>
        !/commercial_motion_route_v1 typed route contract/i.test(
          item.reason || ''
        )
      ) ||
      untypedFresh.sideEffectsPerformed !== 0) {
    throw new Error(
      `fresh untyped motions bypassed local typed-route validation: ${JSON.stringify(untypedFresh)}`
    );
  }

  const pediatricReferral = cases[0].plans(referralEvidenceRef)[0];
  pediatricReferral.id = 'pediatrician_referral_person';
  pediatricReferral.priority = 1;
  pediatricReferral.query =
    'lactation consultants accepting UnitedHealthcare';
  pediatricReferral.targetRoleTerms = ['pediatrician'];
  pediatricReferral.organizationTerms = ['pediatric practice'];
  const midwifeReferral = cases[0].plans(referralEvidenceRef)[0];
  midwifeReferral.id = 'midwife_referral_person';
  midwifeReferral.priority = 2;
  midwifeReferral.query = 'IBCLC supplier directory';
  midwifeReferral.targetRoleTerms = ['midwife'];
  midwifeReferral.organizationTerms = ['birth center'];
  const twoReferrals = await run({
    job: referralJob,
    plans: [pediatricReferral, midwifeReferral],
    generationId: 'generation-two-distinct-referral-motions'
  });
  const referralQueries = twoReferrals.plans.map((item) => item.query);
  if (twoReferrals.status !== 'planned' ||
      twoReferrals.plans.length !== 2 ||
      twoReferrals.plans.some((item) =>
        item.motionKind !== 'referral_person' ||
        item.commercialRole !== 'referral_partner' ||
        item.acquisitionMode !== 'partner_channel'
      ) ||
      new Set(referralQueries).size !== 2 ||
      !referralQueries.includes(
        'pediatrician pediatric practice Queens, New York, United States'
      ) ||
      !referralQueries.includes(
        'midwife birth center Queens, New York, United States'
      ) ||
      /lactation consultant|unitedhealthcare|supplier directory/i.test(
        referralQueries.join(' ')
      ) ||
      twoReferrals.planSelection?.rejectedPlanCount !== 0 ||
      twoReferrals.sideEffectsPerformed !== 0) {
    throw new Error(
      `two distinct referral motions did not survive typed diversity: ${JSON.stringify(twoReferrals)}`
    );
  }

  const pdlOnlyJob = structuredClone(referralJob);
  pdlOnlyJob.payload.commercialDiscoveryCapabilities = {
    braveWebSearch: false,
    pdlPersonSearch: true,
    pdlJobPostingSearch: false
  };
  let pdlOnlyMotionKinds = [];
  const pdlOnly = await run({
    job: pdlOnlyJob,
    plans: [pediatricReferral, midwifeReferral],
    generationId: 'generation-pdl-only-referral-motions',
    inspectRequest: (request) => {
      pdlOnlyMotionKinds = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.motionKind?.enum || [];
    }
  });
  if (pdlOnly.status !== 'planned' || pdlOnly.plans.length !== 2 ||
      pdlOnly.plans.some((item) =>
        item.motionKind !== 'referral_person'
      ) ||
      new Set(pdlOnlyMotionKinds).size !== 2 ||
      !pdlOnlyMotionKinds.includes('referral_person') ||
      !pdlOnlyMotionKinds.includes('direct_buyer_person') ||
      pdlOnlyMotionKinds.some((kind) => [
        'referral_org_decision_maker',
        'direct_buyer_org_decision_maker',
        'compensated_job',
        'buyer_solicitation'
      ].includes(kind))) {
    throw new Error(
      `PDL-only planning exposed an unavailable provider route: ${JSON.stringify({ pdlOnlyMotionKinds, pdlOnly })}`
    );
  }
  const unavailableOrganizationMotion =
    cases[0].plans(referralEvidenceRef)[1];
  const pdlOnlySalvage = await run({
    job: pdlOnlyJob,
    plans: [unavailableOrganizationMotion, pediatricReferral],
    generationId: 'generation-pdl-only-salvage'
  });
  if (pdlOnlySalvage.status !== 'planned' ||
      pdlOnlySalvage.plans.length !== 1 ||
      pdlOnlySalvage.plans[0]?.id !== pediatricReferral.id ||
      pdlOnlySalvage.planSelection?.acceptedPlanCount !== 1 ||
      pdlOnlySalvage.planSelection?.rejectedPlanCount !== 1 ||
      !/unavailable read-only provider route/i.test(
        pdlOnlySalvage.planSelection?.rejectedPlans?.[0]?.reason || ''
      )) {
    throw new Error(
      `PDL-only plan salvage retained an unavailable organization route: ${JSON.stringify(pdlOnlySalvage)}`
    );
  }

  const duplicateBase = structuredClone(pediatricReferral);
  duplicateBase.id = 'pediatrician_referral_ordered';
  duplicateBase.targetRoleTerms = [
    'pediatrician',
    'pediatric physician'
  ];
  duplicateBase.organizationTerms = [
    'pediatric practice',
    'children clinic'
  ];
  const reorderedDuplicate = structuredClone(duplicateBase);
  reorderedDuplicate.id = 'pediatrician_referral_reordered';
  reorderedDuplicate.priority = 2;
  reorderedDuplicate.targetRoleTerms = [
    ...duplicateBase.targetRoleTerms
  ].reverse();
  reorderedDuplicate.organizationTerms = [
    ...duplicateBase.organizationTerms
  ].reverse();
  const duplicatePruned = await run({
    job: referralJob,
    plans: [duplicateBase, reorderedDuplicate],
    generationId: 'generation-reordered-typed-motion-duplicate'
  });
  if (duplicatePruned.status !== 'planned' ||
      duplicatePruned.plans.length !== 1 ||
      duplicatePruned.planSelection?.rejectedPlanCount !== 1 ||
      !/repeat the same economic search motion/i.test(
        duplicatePruned.planSelection?.rejectedPlans?.[0]?.reason || ''
      ) ||
      duplicatePruned.sideEffectsPerformed !== 0) {
    throw new Error(
      `reordered typed terms bypassed duplicate pruning: ${JSON.stringify(duplicatePruned)}`
    );
  }
}

async function verifyPlannerMarketGroundingAndSiblingSalvage(
  job,
  evidenceRef
) {
  const run = async (marketJob, plans, generationId, inspectRequest) =>
    runOpportunityDiscoveryPlanner({
      job: structuredClone(marketJob),
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async (request) => {
        inspectRequest?.(request);
        return {
          data: {
            contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
            status: 'planned',
            reason: 'Two bounded outside-world motions.',
            plans
          },
          usage,
          generationId,
          diagnostics: {
            finishReason: 'stop',
            nativeFinishReason: 'stop',
            contentByteCount: 800,
            contentSha256: '6'.repeat(64)
          },
          annotations: []
        };
      }
    });

  const typedMarket = {
    market: 'New York City, New York, United States',
    evidenceRef,
    basis: 'approved_owner_canonical_root_local_business'
  };
  const typedMarketJob = structuredClone(job);
  typedMarketJob.payload.commercialContext.profile.location = '';
  typedMarketJob.payload.commercialContext.profile.serviceAreas = [];
  typedMarketJob.payload.evidenceSnapshot.profile.identity.website =
    'https://owner.example/';
  typedMarketJob.payload.commercialContext.profile.approvedMarkets = [
    typedMarket
  ];
  const typedMarketPlans = cases[0].plans(evidenceRef);
  for (const motion of typedMarketPlans) {
    motion.market = typedMarket.market;
  }
  let typedMarketRequest;
  const typedMarketResult = await run(
    typedMarketJob,
    typedMarketPlans,
    'generation-app-approved-owner-market',
    (request) => {
      typedMarketRequest = request;
    }
  );
  const typedMarketPrompt = JSON.parse(typedMarketRequest?.user || '{}');
  if (typedMarketResult.status !== 'planned' ||
      typedMarketResult.plans.length !== 2 ||
      typedMarketResult.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(
        typedMarketPrompt.commercialContext?.profile?.approvedMarkets
      ) !== JSON.stringify([typedMarket])) {
    throw new Error(
      `typed app-approved owner market did not bind exactly: ${JSON.stringify({ result: typedMarketResult, promptMarkets: typedMarketPrompt.commercialContext?.profile?.approvedMarkets })}`
    );
  }

  for (const [index, invalidApprovedMarket] of [
    {
      ...typedMarket,
      basis: 'approved_owner_article_local_business'
    },
    {
      ...typedMarket,
      evidenceRef: 'observation:missing-market-observation'
    },
    {
      ...typedMarket,
      summary: 'Lactation Consultant NYC'
    }
  ].entries()) {
    const invalidTypedJob = structuredClone(typedMarketJob);
    invalidTypedJob.payload.commercialContext.profile.location =
      'Boston, Massachusetts, United States';
    invalidTypedJob.payload.commercialContext.profile.approvedMarkets = [
      invalidApprovedMarket
    ];
    const invalid = cases[0].plans(evidenceRef)[0];
    invalid.id = `invalid_typed_market_${index + 1}`;
    invalid.priority = 1;
    invalid.market = typedMarket.market;
    const valid = cases[0].plans(evidenceRef)[1];
    valid.id = `valid_declared_location_${index + 1}`;
    valid.priority = 2;
    valid.market = 'Boston, Massachusetts, United States';
    let invalidTypedRequest;
    const result = await run(
      invalidTypedJob,
      [invalid, valid],
      `generation-invalid-app-approved-owner-market-${index + 1}`,
      (request) => {
        invalidTypedRequest = request;
      }
    );
    const prompt = JSON.parse(invalidTypedRequest?.user || '{}');
    if (result.status !== 'planned' || result.plans.length !== 1 ||
        result.plans[0]?.id !== valid.id ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        prompt.commercialContext?.profile?.approvedMarkets !== undefined) {
      throw new Error(
        `invalid typed market provenance was not pruned independently: ${JSON.stringify({ invalidApprovedMarket, result, promptMarkets: prompt.commercialContext?.profile?.approvedMarkets })}`
      );
    }
  }

  const thirdPartyMarketJob = structuredClone(typedMarketJob);
  thirdPartyMarketJob.payload.commercialContext.profile.location =
    'Boston, Massachusetts, United States';
  thirdPartyMarketJob.payload.evidenceSnapshot.sources[0].url =
    'https://third-party.example/market';
  thirdPartyMarketJob.payload.evidenceSnapshot.sourceEvidence[0].url =
    'https://third-party.example/market';
  const thirdPartyInvalid = cases[0].plans(evidenceRef)[0];
  thirdPartyInvalid.market = typedMarket.market;
  const thirdPartySibling = cases[0].plans(evidenceRef)[1];
  thirdPartySibling.market = 'Boston, Massachusetts, United States';
  const thirdPartyResult = await run(
    thirdPartyMarketJob,
    [thirdPartyInvalid, thirdPartySibling],
    'generation-third-party-approved-market-rejected'
  );
  if (thirdPartyResult.status !== 'planned' ||
      thirdPartyResult.plans.length !== 1 ||
      thirdPartyResult.plans[0]?.id !== thirdPartySibling.id ||
      thirdPartyResult.planSelection?.rejectedPlanCount !== 1) {
    throw new Error(
      `third-party observation authorized a typed owner market: ${JSON.stringify(thirdPartyResult)}`
    );
  }

  const proseOnlyJob = structuredClone(typedMarketJob);
  proseOnlyJob.payload.commercialContext.profile.approvedMarkets = [];
  proseOnlyJob.payload.evidenceSnapshot.sources[0].url =
    'https://owner.example/';
  proseOnlyJob.payload.evidenceSnapshot.sourceEvidence[0].url =
    'https://owner.example/';
  proseOnlyJob.payload.evidenceSnapshot.sourceEvidence[0].label =
    'Lactation Consultant NYC';
  proseOnlyJob.payload.evidenceSnapshot.sourceEvidence[0].summary +=
    ' An older article mentions Houston.';
  const proseNYC = cases[0].plans(evidenceRef)[0];
  proseNYC.market = typedMarket.market;
  const proseHouston = cases[0].plans(evidenceRef)[1];
  proseHouston.market = 'Houston, Texas, United States';
  const proseOnlyResult = await run(
    proseOnlyJob,
    [proseNYC, proseHouston],
    'generation-owner-prose-never-authorizes-market'
  );
  if (proseOnlyResult.status !== 'blocked' ||
      proseOnlyResult.plans.length !== 0 ||
      proseOnlyResult.planSelection?.rejectedPlanCount !== 2) {
    throw new Error(
      `owner title/summary prose was treated as approved geography: ${JSON.stringify(proseOnlyResult)}`
    );
  }

  for (const [index, invalidMarket] of [
    'Queens, New York',
    'United States',
    'Queens, California, United States',
    'Remote'
  ].entries()) {
    const invalid = cases[0].plans(evidenceRef)[0];
    invalid.id = `invalid_market_${index + 1}`;
    invalid.priority = 1;
    invalid.market = invalidMarket;
    const valid = cases[0].plans(evidenceRef)[1];
    valid.id = `grounded_market_${index + 1}`;
    valid.priority = 2;
    const result = await run(
      job,
      [invalid, valid],
      `generation-market-salvage-${index + 1}`
    );
    const rejection = result.planSelection?.rejectedPlans?.find(
      (item) => item.id === invalid.id
    )?.reason || '';
    if (result.status !== 'planned' ||
        result.plans.length !== 1 ||
        result.plans[0]?.id !== valid.id ||
        result.plans[0]?.market !==
          'Queens, New York, United States' ||
        result.planSelection?.returnedPlanCount !== 2 ||
        result.planSelection?.acceptedPlanCount !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        !/exact approved service-area, location, or remote-availability scope.*guessed, widened, or under-disambiguated geography/i.test(
          rejection
        ) ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `invalid market did not preserve its grounded sibling: ${JSON.stringify({ invalidMarket, result })}`
      );
    }
  }

  for (const [index, [approvedAlias, canonicalMarket]] of [
    ['Queens', 'Queens, New York, United States'],
    ['Manhattan', 'Manhattan, New York, United States'],
    ['Brooklyn', 'Brooklyn, New York, United States'],
    ['Bronx', 'Bronx, New York, United States'],
    ['Staten Island', 'Staten Island, New York, United States'],
    ['Long Island City', 'Long Island City, New York, United States'],
    ['New York City', 'New York City, New York, United States'],
    ['NYC', 'New York City, New York, United States']
  ].entries()) {
    const nycJob = structuredClone(job);
    nycJob.payload.commercialContext.profile.location =
      'Boston, MA, USA';
    nycJob.payload.commercialContext.profile.serviceAreas = [
      approvedAlias
    ];
    const plans = cases[0].plans(evidenceRef);
    for (const motion of plans) motion.market = canonicalMarket;
    const result = await run(
      nycJob,
      plans,
      `generation-approved-nyc-alias-${index + 1}`
    );
    if (result.status !== 'planned' || result.plans.length !== 2 ||
        result.planSelection?.rejectedPlanCount !== 0) {
      throw new Error(
        `approved NYC locality alias did not bind safely: ${JSON.stringify({ approvedAlias, canonicalMarket, result })}`
      );
    }
  }

  const portlandJob = structuredClone(job);
  portlandJob.payload.commercialContext.profile.location =
    'Boston, MA, USA';
  portlandJob.payload.commercialContext.profile.serviceAreas = [
    'Portland'
  ];
  for (const [index, invalidMarket] of [
    'Portland',
    'Portland, ME, USA',
    'Portland, MA, USA'
  ].entries()) {
    const invalid = cases[0].plans(evidenceRef)[0];
    invalid.id = `unsupported_portland_parent_${index + 1}`;
    invalid.priority = 1;
    invalid.market = invalidMarket;
    const valid = cases[0].plans(evidenceRef)[1];
    valid.id = `approved_boston_location_${index + 1}`;
    valid.priority = 2;
    valid.market = 'Boston, Massachusetts, United States';
    const result = await run(
      portlandJob,
      [invalid, valid],
      `generation-portland-parent-salvage-${index + 1}`
    );
    if (result.status !== 'planned' || result.plans.length !== 1 ||
        result.plans[0]?.id !== valid.id ||
        result.planSelection?.acceptedPlanCount !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        !/guessed, widened, or under-disambiguated geography/i.test(
          result.planSelection?.rejectedPlans?.[0]?.reason || ''
        )) {
      throw new Error(
        `bare Portland inherited an unsupported parent geography: ${JSON.stringify({ invalidMarket, result })}`
      );
    }
  }

  for (const [index, invalidMarket] of [
    'Springfield, United States',
    'Toronto, Canada'
  ].entries()) {
    const missingRegionJob = structuredClone(job);
    missingRegionJob.payload.commercialContext.profile.location = 'Canada';
    missingRegionJob.payload.commercialContext.profile.serviceAreas = [
      invalidMarket
    ];
    const invalid = cases[0].plans(evidenceRef)[0];
    invalid.id = `missing_approved_region_${index + 1}`;
    invalid.priority = 1;
    invalid.market = invalidMarket;
    const valid = cases[0].plans(evidenceRef)[1];
    valid.id = `explicit_country_sibling_${index + 1}`;
    valid.priority = 2;
    valid.market = 'Canada';
    const result = await run(
      missingRegionJob,
      [invalid, valid],
      `generation-missing-region-salvage-${index + 1}`
    );
    if (result.status !== 'planned' || result.plans.length !== 1 ||
        result.plans[0]?.id !== valid.id ||
        result.planSelection?.rejectedPlanCount !== 1) {
      throw new Error(
        `US/Canada locality without an approved region was accepted: ${JSON.stringify({ invalidMarket, result })}`
      );
    }
  }

  const canadaJob = structuredClone(job);
  canadaJob.payload.commercialContext.profile.location =
    'Toronto, ON, CAN';
  canadaJob.payload.commercialContext.profile.serviceAreas = [
    'London, ON, CAN'
  ];
  const canadaPlans = cases[0].plans(evidenceRef);
  for (const motion of canadaPlans) {
    motion.market = 'London, Ontario, Canada';
  }
  const canada = await run(
    canadaJob,
    canadaPlans,
    'generation-canadian-region-country-aliases'
  );
  if (canada.status !== 'planned' || canada.plans.length !== 2 ||
      canada.planSelection?.rejectedPlanCount !== 0) {
    throw new Error(
      `Canadian province/country aliases did not bind: ${JSON.stringify(canada)}`
    );
  }

  const ukJob = structuredClone(job);
  ukJob.payload.commercialContext.profile.location =
    'London, England, UK';
  ukJob.payload.commercialContext.profile.serviceAreas = [];
  const ukPlans = cases[0].plans(evidenceRef);
  for (const motion of ukPlans) {
    motion.market = 'London, England, United Kingdom';
  }
  const uk = await run(
    ukJob,
    ukPlans,
    'generation-uk-country-alias'
  );
  if (uk.status !== 'planned' || uk.plans.length !== 2 ||
      uk.planSelection?.rejectedPlanCount !== 0) {
    throw new Error(
      `UK country alias did not bind: ${JSON.stringify(uk)}`
    );
  }

  for (const [index, [approvedCountry, canonicalCountry]] of [
    ['CAN', 'Canada'],
    ['UK', 'United Kingdom']
  ].entries()) {
    const countryJob = structuredClone(job);
    countryJob.payload.commercialContext.profile.location = approvedCountry;
    countryJob.payload.commercialContext.profile.serviceAreas = [];
    const plans = cases[0].plans(evidenceRef);
    for (const motion of plans) motion.market = canonicalCountry;
    const result = await run(
      countryJob,
      plans,
      `generation-country-only-alias-${index + 1}`
    );
    if (result.status !== 'planned' || result.plans.length !== 2 ||
        result.planSelection?.rejectedPlanCount !== 0) {
      throw new Error(
        `explicit country-only market did not bind: ${JSON.stringify({ approvedCountry, canonicalCountry, result })}`
      );
    }
  }

  const remoteJob = structuredClone(job);
  remoteJob.payload.commercialContext.profile.availability =
    'Available for remote professional work';
  const remoteDemand = cases[1].plans(evidenceRef)[0];
  remoteDemand.id = 'approved_remote_paid_demand';
  remoteDemand.priority = 1;
  remoteDemand.market = 'Remote';
  const secondRemoteDemand = cases[1].plans(evidenceRef)[1];
  secondRemoteDemand.id = 'approved_remote_solicitation';
  secondRemoteDemand.priority = 2;
  secondRemoteDemand.market = 'Remote';
  const remote = await run(
    remoteJob,
    [remoteDemand, secondRemoteDemand],
    'generation-approved-remote-market'
  );
  if (remote.status !== 'planned' || remote.plans.length !== 2 ||
      remote.plans.some((motion) => motion.market !== 'Remote') ||
      remote.planSelection?.rejectedPlanCount !== 0 ||
      remote.sideEffectsPerformed !== 0) {
    throw new Error(
      `explicit remote availability did not authorize the remote market: ${JSON.stringify(remote)}`
    );
  }

  const qualifiedRemotePlans = cases[1].plans(evidenceRef);
  qualifiedRemotePlans[0].market = 'Remote, United States';
  qualifiedRemotePlans[1].market = 'Remote, USA';
  const qualifiedRemote = await run(
    remoteJob,
    qualifiedRemotePlans,
    'generation-approved-country-qualified-remote-market'
  );
  if (qualifiedRemote.status !== 'planned' ||
      qualifiedRemote.plans.length !== 2 ||
      qualifiedRemote.planSelection?.rejectedPlanCount !== 0) {
    throw new Error(
      `approved home country did not qualify Remote paid demand: ${JSON.stringify(qualifiedRemote)}`
    );
  }

  const conflictingRemote = cases[1].plans(evidenceRef)[0];
  conflictingRemote.id = 'conflicting_remote_country';
  conflictingRemote.priority = 1;
  conflictingRemote.market = 'Remote, Canada';
  const approvedRemoteSibling = cases[1].plans(evidenceRef)[1];
  approvedRemoteSibling.id = 'approved_remote_country_sibling';
  approvedRemoteSibling.priority = 2;
  approvedRemoteSibling.market = 'Remote, United States';
  const remoteConflict = await run(
    remoteJob,
    [conflictingRemote, approvedRemoteSibling],
    'generation-conflicting-remote-country-salvage'
  );
  if (remoteConflict.status !== 'planned' ||
      remoteConflict.plans.length !== 1 ||
      remoteConflict.plans[0]?.id !== approvedRemoteSibling.id ||
      remoteConflict.planSelection?.rejectedPlanCount !== 1 ||
      !/Remote.*country outside the approved home-country scope/i.test(
        remoteConflict.planSelection?.rejectedPlans?.[0]?.reason || ''
      )) {
    throw new Error(
      `conflicting Remote country was not pruned independently: ${JSON.stringify(remoteConflict)}`
    );
  }

  for (const [index, professionalMotion] of [
    cases[0].plans(evidenceRef)[0],
    cases[2].plans(evidenceRef)[1]
  ].entries()) {
    professionalMotion.id = `forbidden_availability_remote_${index + 1}`;
    professionalMotion.priority = 1;
    professionalMotion.market = 'Remote';
    const paidDemandSibling = structuredClone(remoteDemand);
    paidDemandSibling.id = `remote_paid_demand_sibling_${index + 1}`;
    paidDemandSibling.priority = 2;
    const remoteRoleSalvage = await run(
      remoteJob,
      [professionalMotion, paidDemandSibling],
      `generation-remote-role-salvage-${index + 1}`
    );
    if (remoteRoleSalvage.status !== 'planned' ||
        remoteRoleSalvage.plans.length !== 1 ||
        remoteRoleSalvage.plans[0]?.id !== paidDemandSibling.id ||
        remoteRoleSalvage.planSelection?.rejectedPlanCount !== 1 ||
        !/availability-based Remote.*professional target.*paid-demand artifact/i.test(
          remoteRoleSalvage.planSelection?.rejectedPlans?.[0]?.reason || ''
        )) {
      throw new Error(
        `availability-based Remote authorized a professional target: ${JSON.stringify(remoteRoleSalvage)}`
      );
    }
  }

  const explicitRemoteJob = structuredClone(job);
  explicitRemoteJob.payload.commercialContext.profile.availability = '';
  explicitRemoteJob.payload.commercialContext.profile.serviceAreas = [
    'Remote'
  ];
  const explicitRemoteReferral = cases[0].plans(evidenceRef)[0];
  explicitRemoteReferral.market = 'Remote';
  const explicitRemoteBuyer = cases[2].plans(evidenceRef)[1];
  explicitRemoteBuyer.market = 'Remote';
  const explicitRemote = await run(
    explicitRemoteJob,
    [explicitRemoteReferral, explicitRemoteBuyer],
    'generation-explicit-remote-service-area'
  );
  if (explicitRemote.status !== 'planned' ||
      explicitRemote.plans.length !== 2 ||
      explicitRemote.planSelection?.rejectedPlanCount !== 0) {
    throw new Error(
      `explicit Remote service area did not authorize professional targets: ${JSON.stringify(explicitRemote)}`
    );
  }

  const negatedRemoteJob = structuredClone(job);
  negatedRemoteJob.payload.commercialContext.profile.availability =
    'Remote work is not available';
  const negatedRemoteDemand = structuredClone(remoteDemand);
  negatedRemoteDemand.id = 'negated_remote_paid_demand';
  negatedRemoteDemand.priority = 1;
  const localSibling = cases[0].plans(evidenceRef)[1];
  localSibling.id = 'local_sibling_after_negated_remote';
  localSibling.priority = 2;
  const negatedRemote = await run(
    negatedRemoteJob,
    [negatedRemoteDemand, localSibling],
    'generation-negated-remote-salvage'
  );
  if (negatedRemote.status !== 'planned' ||
      negatedRemote.plans.length !== 1 ||
      negatedRemote.plans[0]?.id !== localSibling.id ||
      negatedRemote.planSelection?.rejectedPlanCount !== 1 ||
      !/remote-availability scope.*geography is forbidden/i.test(
        negatedRemote.planSelection?.rejectedPlans?.[0]?.reason || ''
      )) {
    throw new Error(
      `negated remote availability authorized a remote market: ${JSON.stringify(negatedRemote)}`
    );
  }
}

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
      plans: twoPlannerMotions(candidate, primaryEvidenceRef)
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
    if (result.status !== 'planned' ||
        result.plans.length !== 1 ||
        result.planSelection?.acceptedPlanCount !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        result.sideEffectsPerformed !== 0 ||
        !/contingent finalist contract/i.test(
          result.planSelection?.rejectedPlans?.[0]?.reason || ''
        )) {
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
  if (hiddenResult.status !== 'planned' ||
      hiddenResult.plans.length !== 1 ||
      hiddenResult.planSelection?.acceptedPlanCount !== 1 ||
      hiddenResult.planSelection?.rejectedPlanCount !== 1 ||
      hiddenResult.sideEffectsPerformed !== 0 ||
      !/contingent finalist contract/i.test(
        hiddenResult.planSelection?.rejectedPlans?.[0]?.reason || ''
      )) {
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
      plans: twoPlannerMotions(candidate, primaryEvidenceRef)
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
      targetDimensions: ['b', 'c'],
      ordinaryDimensions: ['o', 't', 'p', 'f'],
      targetGrounding: ['b', 'a'],
      ordinaryGrounding: ['o', 'd', 'c', 't']
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
  for (const roleCase of roleCases) {
    roleCase.candidate.market = 'Queens, New York, United States';
  }
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
        family.e.includes(primaryEvidenceRef) &&
        actions.length === 2 &&
        actions.every((action) =>
          action.l.includes('{{TARGET_NAME}}') &&
          action.e.includes(targetRef) &&
          action.e.includes(primaryEvidenceRef)
        ) &&
        roleCase.targetDimensions.every((dimension) =>
          (family?.d?.[dimension] || []).every((item) =>
            item.e.includes(targetRef) &&
            item.e.includes(primaryEvidenceRef)
          )
        ) &&
        roleCase.ordinaryDimensions.every((dimension) =>
          (family?.d?.[dimension] || []).every((item) =>
            !item.e.includes(targetRef)
          )
        ) &&
        roleCase.targetGrounding.every((role) =>
          groundingRefs(revenue?.g || {}, role).includes(targetRef) &&
          groundingRefs(revenue?.g || {}, role).includes(primaryEvidenceRef)
        ) &&
        roleCase.ordinaryGrounding.every((role) =>
          !groundingRefs(revenue?.g || {}, role).includes(targetRef)
        );
    });
    if (result.status !== 'planned' ||
        result.plans.length !== 2 ||
        !targetProtocolRestored ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `omitted ${roleCase.label} target protocol was not safely canonicalized: ${JSON.stringify(result)}`
      );
    }
  }

  const mixedPaidOfferContamination = structuredClone(
    cases[0].plans(primaryEvidenceRef)[0]
  );
  mixedPaidOfferContamination.contingentFinalists = replaceExactRef(
    compactContingentFinalists(
      mixedPaidOfferContamination.contingentFinalists
    ),
    targetRef,
    primaryEvidenceRef
  );
  for (const offer of
    mixedPaidOfferContamination.contingentFinalists.pathBase.o) {
    offer.e.push(targetRef);
  }
  mixedPaidOfferContamination.contingentFinalists
    .pathBase.r[0].g.o.push(targetRef);
  const mixedPaidOfferResult = await runOpportunityDiscoveryPlanner({
    job: structuredClone(baseJob),
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => completionFor(
      mixedPaidOfferContamination,
      'generation-mixed-unauthorized-paid-offer-target-evidence'
    )
  });
  const repairedPaidOfferPlan = mixedPaidOfferResult.plans.find((item) =>
    item.id === mixedPaidOfferContamination.id
  );
  const mixedPaidOfferRepaired = ['familyA', 'familyB'].every((familyKey) => {
    const family = repairedPaidOfferPlan?.contingentFinalists?.[familyKey];
    const revenue = family?.d?.r?.[0];
    return family?.d?.o?.every((offer) =>
      offer.e.includes(primaryEvidenceRef) &&
      !offer.e.includes(targetRef)
    ) &&
      revenue?.g?.o?.includes(primaryEvidenceRef) &&
      !revenue.g.o.includes(targetRef) &&
      family.d.a.every((action) =>
        action.e.includes(primaryEvidenceRef) &&
        action.e.includes(targetRef)
      ) &&
      family.d.c.every((channel) =>
        channel.e.includes(primaryEvidenceRef) &&
        channel.e.includes(targetRef)
      ) &&
      revenue.g.a.includes(primaryEvidenceRef) &&
      revenue.g.a.includes(targetRef);
  });
  if (mixedPaidOfferResult.status !== 'planned' ||
      mixedPaidOfferResult.plans.length !== 2 ||
      !repairedPaidOfferPlan ||
      !mixedPaidOfferRepaired ||
      mixedPaidOfferResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `mixed owner/target paid-offer contamination was not structurally repaired: ${JSON.stringify(mixedPaidOfferResult)}`
    );
  }

  const mixedFollowUpContamination = structuredClone(
    cases[0].plans(primaryEvidenceRef)[0]
  );
  mixedFollowUpContamination.contingentFinalists = replaceExactRef(
    compactContingentFinalists(
      mixedFollowUpContamination.contingentFinalists
    ),
    targetRef,
    primaryEvidenceRef
  );
  for (const tacticKey of ['tacticA', 'tacticB']) {
    for (const followUp of
      mixedFollowUpContamination.contingentFinalists[tacticKey].f) {
      followUp.e.push(targetRef);
    }
  }
  const mixedFollowUpResult = await runOpportunityDiscoveryPlanner({
    job: structuredClone(baseJob),
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => completionFor(
      mixedFollowUpContamination,
      'generation-mixed-unauthorized-follow-up-target-evidence'
    )
  });
  const repairedFollowUpPlan = mixedFollowUpResult.plans.find((item) =>
    item.id === mixedFollowUpContamination.id
  );
  if (mixedFollowUpResult.status !== 'planned' ||
      mixedFollowUpResult.plans.length !== 2 ||
      !repairedFollowUpPlan ||
      !['familyA', 'familyB'].every((familyKey) =>
        repairedFollowUpPlan.contingentFinalists[familyKey].d.f.every(
          (followUp) =>
            followUp.e.includes(primaryEvidenceRef) &&
            !followUp.e.includes(targetRef)
        )
      ) ||
      mixedFollowUpResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `mixed owner/target follow-up contamination was not structurally repaired: ${JSON.stringify(mixedFollowUpResult)}`
    );
  }

  for (const [index, assertedState] of [
    'Follow up because they have already expressed interest',
    'Follow up after they expressed interest',
    'Follow up when the partner agrees',
    'Follow up after the buyer replied',
    'Follow up after permission was granted',
    'Follow up with the willing partner',
    'Follow up after the partner accepted',
    'Follow up after the partner said yes',
    'Follow up after they requested more information',
    'Follow up with our long-standing partner',
    'Follow up after a positive reaction',
    'If no reply after 31 days, one review-first follow-up'
  ].entries()) {
    const assertedFollowUpState = structuredClone(
      cases[0].plans(primaryEvidenceRef)[0]
    );
    assertedFollowUpState.contingentFinalists = replaceExactRef(
      compactContingentFinalists(
        assertedFollowUpState.contingentFinalists
      ),
      targetRef,
      primaryEvidenceRef
    );
    assertedFollowUpState.contingentFinalists.tacticA.f[0].l =
      assertedState;
    const assertedFollowUpResult = await runOpportunityDiscoveryPlanner({
      job: structuredClone(baseJob),
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => completionFor(
        assertedFollowUpState,
        `generation-asserted-unverified-follow-up-state-${index + 1}`
      )
    });
    if (assertedFollowUpResult.status !== 'planned' ||
        assertedFollowUpResult.plans.length !== 1 ||
        assertedFollowUpResult.planSelection?.acceptedPlanCount !== 1 ||
        assertedFollowUpResult.planSelection?.rejectedPlanCount !== 1 ||
        assertedFollowUpResult.sideEffectsPerformed !== 0 ||
        !/follow_up_unverified_state/i.test(
          assertedFollowUpResult.planSelection?.rejectedPlans?.[0]
            ?.reason || ''
        )) {
      throw new Error(
        `unverified follow-up state was not rejected: ${JSON.stringify({ assertedState, assertedFollowUpResult })}`
      );
    }
  }

  const neutralFollowUp = structuredClone(
    cases[0].plans(primaryEvidenceRef)[0]
  );
  neutralFollowUp.contingentFinalists = replaceExactRef(
    compactContingentFinalists(neutralFollowUp.contingentFinalists),
    targetRef,
    primaryEvidenceRef
  );
  neutralFollowUp.contingentFinalists.tacticA.f[0].l =
    'If no reply after 5 days, one review-first follow-up';
  const neutralFollowUpResult = await runOpportunityDiscoveryPlanner({
    job: structuredClone(baseJob),
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => completionFor(
      neutralFollowUp,
      'generation-neutral-bounded-follow-up'
    )
  });
  if (neutralFollowUpResult.status !== 'planned' ||
      neutralFollowUpResult.plans.length !== 2 ||
      neutralFollowUpResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `neutral bounded follow-up was rejected: ${JSON.stringify(neutralFollowUpResult)}`
    );
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
    ...['o', 'd', 'c', 't'].map((role) => ({
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
    candidate.market = 'Queens, New York, United States';
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
    const missingGroundingCode = {
      b: 'grounding_buyer',
      o: 'grounding_offer',
      d: 'grounding_destination_evidence',
      c: 'grounding_conversion',
      t: 'grounding_attribution'
    }[unauthorized.role];
    if (result.status !== 'planned' ||
        result.plans.length !== 1 ||
        result.planSelection?.acceptedPlanCount !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        result.sideEffectsPerformed !== 0 ||
        !new RegExp(
          `incomplete causal revenue path.*${missingGroundingCode}`,
          'i'
        ).test(result.planSelection?.rejectedPlans?.[0]?.reason || '')) {
      throw new Error(
        `target-only unauthorized ${unauthorized.label} grounding did not fail closed after structural repair: ${JSON.stringify(result)}`
      );
    }
  }

  const tacticDimensions = new Set(['c', 'a', 'f']);
  for (const roleCase of roleCases) {
    for (const dimension of roleCase.ordinaryDimensions) {
      const candidate = structuredClone(roleCase.candidate);
      candidate.contingentFinalists = replaceExactRef(
        compactContingentFinalists(candidate.contingentFinalists),
        targetRef,
        primaryEvidenceRef
      );
      const container = tacticDimensions.has(dimension)
        ? candidate.contingentFinalists.tacticA
        : candidate.contingentFinalists.pathBase;
      container[dimension][0].e = [targetRef];
      const result = await runOpportunityDiscoveryPlanner({
        job: structuredClone(baseJob),
        model: 'openai/gpt-4.1-mini',
        now,
        completeJSON: async () => completionFor(
          candidate,
          `generation-unauthorized-target-dimension-${roleCase.label.replace(/\W+/g, '-')}-${dimension}`
        )
      });
      if (result.status !== 'planned' ||
          result.plans.length !== 1 ||
          result.planSelection?.acceptedPlanCount !== 1 ||
          result.planSelection?.rejectedPlanCount !== 1 ||
          result.sideEffectsPerformed !== 0 ||
          !new RegExp(
            `incomplete ${dimension} finalist dimension`,
            'i'
          ).test(result.planSelection?.rejectedPlans?.[0]?.reason || '')) {
        throw new Error(
          `target-only unauthorized ${roleCase.label} ${dimension} dimension did not fail closed after structural repair: ${JSON.stringify(result)}`
        );
      }
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
  if (missingObservationResult.status !== 'planned' ||
      missingObservationResult.plans.length !== 1 ||
      missingObservationResult.planSelection?.acceptedPlanCount !== 1 ||
      missingObservationResult.planSelection?.rejectedPlanCount !== 1 ||
      !/missing approved observation evidence/i.test(
        missingObservationResult.planSelection?.rejectedPlans?.[0]
          ?.reason || ''
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
  if (forgedResult.status !== 'planned' ||
      forgedResult.plans.length !== 1 ||
      forgedResult.planSelection?.acceptedPlanCount !== 1 ||
      forgedResult.planSelection?.rejectedPlanCount !== 1 ||
      forgedResult.sideEffectsPerformed !== 0 ||
      !/contingent finalist contract/i.test(
        forgedResult.planSelection?.rejectedPlans?.[0]?.reason || ''
      )) {
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
    market: 'Queens, New York, United States',
    targetRoleTerms: ['pediatrician', 'pediatric physician'],
    organizationTerms: ['pediatric practice'],
    acquisitionMechanism: 'One review-first professional referral request',
    conversionDestination: 'The verified owner booking page',
    paidConversion: 'One completed paid or reimbursed consultation',
    attributionSignal: 'Booking referral source stores the practice and tournament id',
    ...overrides
  });
  const run = async (
    candidate,
    generationId,
    plannerReason = 'Typed professional referral search.'
  ) =>
    runOpportunityDiscoveryPlanner({
      job,
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => ({
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: plannerReason,
          plans: twoPlannerMotions(candidate, evidenceRef)
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
  if (allowed.status !== 'planned' || allowed.plans.length !== 2) {
    throw new Error(
      `professional referral population query was rejected: ${JSON.stringify(allowed)}`
    );
  }

  const allowedContactContext = await run(
    baseReferral({
      id: 'safe_contact_context',
      buyer: 'Small businesses buying paid email marketing consulting',
      counterparty: 'An email marketing director',
      paidOffer: 'Paid consultation for email marketing',
      query: 'professional technology and marketing specialists Queens New York',
      targetRoleTerms: [
        'email marketing director'
      ],
      organizationTerms: ['marketing agency'],
      acquisitionMechanism:
        'Use LinkedIn, not email outreach. Email outreach is not authorized; send an email marketing audit invitation through the public professional profile',
      conversionDestination: 'The owner public contact and booking page',
      paidConversion: 'One completed paid consultation for email marketing',
      attributionSignal:
        'Booking source records whether the inquiry began by phone',
      rationale:
        'Do not ever find or use private contact data. We do not need to find private email. Private contact data is not required.'
    }),
    'generation-safe-contact-context'
  );
  if (allowedContactContext.status !== 'planned' ||
      allowedContactContext.plans.length !== 2) {
    throw new Error(
      `descriptive contact context was mistaken for private-contact acquisition: ${JSON.stringify(allowedContactContext)}`
    );
  }

  const allowedBoundPublicMessageMotion = baseReferral({
    id: 'safe_bound_public_profile_message',
    acquisitionMechanism:
      'One review-first public-professional-profile referral request'
  });
  const boundPublicMessageActions = [
    'After review, send a LinkedIn message via {{TARGET_URL}} asking {{TARGET_NAME}} to recommend one qualified family book the current paid consultation.',
    'After approval, send one LinkedIn message through {{TARGET_URL}} asking {{TARGET_NAME}} for one partner referral to the paid consultation.',
    'Review first, then send a LinkedIn message via {{TARGET_URL}} asking {{TARGET_NAME}} to refer one qualified family to the paid booking offer.',
    'After human review, write a LinkedIn message through {{TARGET_URL}} asking {{TARGET_NAME}} for one partner introduction to the paid consultation.'
  ];
  let boundPublicMessageIndex = 0;
  for (const familyKey of ['familyA', 'familyB']) {
    const family = allowedBoundPublicMessageMotion.contingentFinalists[
      familyKey
    ];
    family.d.r[0].c = boundPublicMessageActions[
      boundPublicMessageIndex
    ];
    for (const action of family.d.a) {
      action.l = boundPublicMessageActions[boundPublicMessageIndex];
      boundPublicMessageIndex += 1;
    }
  }
  const allowedBoundPublicMessage = await run(
    allowedBoundPublicMessageMotion,
    'generation-safe-bound-public-profile-message'
  );
  if (allowedBoundPublicMessage.status !== 'planned' ||
      allowedBoundPublicMessage.plans.length !== 2) {
    throw new Error(
      `a review-first message bound to the exact public professional URL was mistaken for private-contact acquisition: ${JSON.stringify(allowedBoundPublicMessage)}`
    );
  }

  const allowedPhoneProfession = await run(
    plan({
      id: 'safe_phone_profession',
      priority: 1,
      searchMode: 'professional_counterparty',
      commercialRole: 'buyer',
      acquisitionMode: 'permissioned_outreach',
      buyer: 'A practice buying a paid phone consultation',
      counterparty: 'A telephone triage director',
      paidOffer: 'Paid phone consultation',
      evidenceRefs: [evidenceRef],
      query: 'telephone triage nurse Queens New York',
      market: 'Queens, New York, United States',
      targetRoleTerms: [
        'telephone triage nurse'
      ],
      organizationTerms: ['nurse-led health practice'],
      acquisitionMechanism:
        'One review-first invitation through a public professional profile',
      conversionDestination: 'The verified owner booking page',
      paidConversion: 'One completed paid phone consultation',
      attributionSignal:
        'Booking source stores the target and tournament action ids'
    }),
    'generation-safe-phone-profession'
  );
  if (allowedPhoneProfession.status !== 'planned' ||
      allowedPhoneProfession.plans.length !== 2) {
    throw new Error(
      `a phone-based profession or paid offer was mistaken for private-contact acquisition: ${JSON.stringify(allowedPhoneProfession)}`
    );
  }

  const allowedTechnicalAndCatalogTerms = await run(
    baseReferral({
      id: 'safe_technical_and_catalog_terms',
      commercialRole: 'buyer',
      acquisitionMode: 'permissioned_outreach',
      buyer: 'Publishers buying a paid software catalog audit',
      counterparty: 'An Angular @angular/core application maintainer',
      paidOffer: 'Paid @angular/core consulting and software catalog audit',
      query:
        'Angular application maintainer software job requisition 1234567890',
      targetRoleTerms: [
        'Angular @angular/core consultant'
      ],
      skills: ['@angular/core'],
      organizationTerms: ['software publisher'],
      acquisitionMechanism:
        'One review-first invitation through a public professional profile',
      conversionDestination: 'The verified owner proposal page',
      paidConversion: 'One signed paid catalog-audit contract',
      attributionSignal: 'Contract source stores the target and tournament ids',
      rationale:
        'RFP 1234567 closes 2026-08-15 with a $1250000 or INR 1000000 ceiling. Candidate offices include 69-27 164th Street and 110-20 73rd Road. The paid catalog audit covers support for 192.168.1.1 and 192.168.1.0/24, ISBN 9780132350884, Phone case UPC 012345678905, SKU 123456789012, GTIN 00012345600012, IMEI 490154203237518, and NPI 1234567890.'
    }),
    'generation-safe-technical-and-catalog-terms'
  );
  if (allowedTechnicalAndCatalogTerms.status !== 'planned' ||
      allowedTechnicalAndCatalogTerms.plans.length !== 2) {
    throw new Error(
      `technical package or catalog identifiers were mistaken for private contact data: ${JSON.stringify(allowedTechnicalAndCatalogTerms)}`
    );
  }

  const highValueMotion = baseReferral({ id: 'safe_high_value_motion' });
  for (const familyKey of ['familyA', 'familyB']) {
    highValueMotion.contingentFinalists[familyKey].d.r[0].vm =
      1_250_000_000;
  }
  const allowedHighValueMotion = await run(
    highValueMotion,
    'generation-safe-high-value-motion'
  );
  if (allowedHighValueMotion.status !== 'planned' ||
      allowedHighValueMotion.plans.length !== 2) {
    throw new Error(
      `high-value revenue micros were mistaken for a phone number: ${JSON.stringify(allowedHighValueMotion)}`
    );
  }

  const numericEvidenceJob = structuredClone(job);
  const numericObservationID =
    'obs-a76ca342-5ca5-44c7-8844-123456789012';
  numericEvidenceJob.payload.evidenceSnapshot.sourceEvidence[0].id =
    numericObservationID;
  numericEvidenceJob.payload.evidenceSnapshot.sourceEvidence[0]
    .observationId = numericObservationID;
  const numericEvidenceCatalog = buildEvidenceCatalog(
    numericEvidenceJob.payload,
    {},
    now,
    { includeSystemAttributionCapability: true }
  );
  const numericEvidenceRef = numericEvidenceCatalog.find((item) =>
    typeof item.id === 'string' && item.id.startsWith('observation:')
  )?.id;
  if (!numericEvidenceRef ||
      !numericEvidenceRef.includes('123456789012')) {
    throw new Error('numeric evidence-ref fixture was not preserved');
  }
  const numericEvidenceMotion = baseReferral({
    id: 'safe_numeric_evidence_ref'
  });
  const replaceEvidenceRef = (value) => {
    if (typeof value === 'string') {
      return value === evidenceRef ? numericEvidenceRef : value;
    }
    if (Array.isArray(value)) return value.map(replaceEvidenceRef);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        replaceEvidenceRef(item)
      ]));
    }
    return value;
  };
  const allowedNumericEvidenceRef = await runOpportunityDiscoveryPlanner({
    job: numericEvidenceJob,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'Typed professional referral search.',
        plans: twoPlannerMotions(
          replaceEvidenceRef(numericEvidenceMotion),
          numericEvidenceRef
        )
      },
      usage,
      generationId: 'generation-safe-numeric-evidence-ref',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 800,
        contentSha256: '1'.repeat(64)
      },
      annotations: []
    })
  });
  if (allowedNumericEvidenceRef.status !== 'planned' ||
      allowedNumericEvidenceRef.plans.length !== 2) {
    throw new Error(
      `numeric evidence ref was mistaken for a phone number: ${JSON.stringify(allowedNumericEvidenceRef)}`
    );
  }

  const unusedSensitiveFields = await run(
    baseReferral({
      id: 'unused_sensitive_job_fields',
      jobTitle: 'postpartum patient',
      skills: ['pregnant people']
    }),
    'generation-unused-sensitive-job-fields'
  );
  const projectedReferral = unusedSensitiveFields.plans.find((item) =>
    item.id === 'unused_sensitive_job_fields'
  );
  if (unusedSensitiveFields.status !== 'planned' ||
      unusedSensitiveFields.plans.length !== 2 ||
      !projectedReferral ||
      projectedReferral.jobTitle !== '' ||
      projectedReferral.skills.length !== 0 ||
      projectedReferral.targetRoleTerms.length === 0 ||
      projectedReferral.organizationTerms.length === 0) {
    throw new Error(
      `professional-counterparty projection retained unused sensitive job fields: ${JSON.stringify(unusedSensitiveFields)}`
    );
  }

  const localOrganization = baseReferral({
    id: 'local_org_unused_sensitive_job_fields',
    searchMode: 'local_organization',
    jobTitle: 'postpartum patient',
    skills: ['pregnant people'],
    targetSlot: {
      finalTargetKind: 'person',
      resolutionStrategy: 'organization_then_decision_maker'
    }
  });
  const localResult = await run(
    localOrganization,
    'generation-local-org-unused-sensitive-job-fields'
  );
  const projectedLocal = localResult.plans.find((item) =>
    item.id === localOrganization.id
  );
  if (localResult.status !== 'planned' || !projectedLocal ||
      projectedLocal.jobTitle !== '' ||
      projectedLocal.skills.length !== 0 ||
      projectedLocal.targetRoleTerms.length === 0 ||
      projectedLocal.organizationTerms.length === 0) {
    throw new Error(
      `local-organization projection retained unused job fields: ${JSON.stringify(localResult)}`
    );
  }

  const activeJob = cases[1].plans(evidenceRef)[0];
  activeJob.id = 'active_job_unused_sensitive_role_fields';
  activeJob.market = 'Queens, New York, United States';
  activeJob.targetRoleTerms = ['postpartum patient'];
  activeJob.organizationTerms = ['pregnant people'];
  const activeResult = await run(
    activeJob,
    'generation-active-job-unused-sensitive-role-fields'
  );
  const projectedActive = activeResult.plans.find((item) =>
    item.id === activeJob.id
  );
  if (activeResult.status !== 'planned' || !projectedActive ||
      projectedActive.targetRoleTerms.length !== 0 ||
      projectedActive.organizationTerms.length !== 0 ||
      projectedActive.jobTitle !== activeJob.jobTitle ||
      JSON.stringify(projectedActive.skills) !==
        JSON.stringify(activeJob.skills)) {
    throw new Error(
      `active-job projection did not retain only title and skills: ${JSON.stringify(activeResult)}`
    );
  }

  const publicDemand = cases[1].plans(evidenceRef)[1];
  publicDemand.id = 'public_demand_unused_sensitive_filter_fields';
  publicDemand.market = 'Queens, New York, United States';
  publicDemand.targetRoleTerms = ['postpartum patient'];
  publicDemand.organizationTerms = ['pregnant people'];
  publicDemand.jobTitle = 'newborn patient';
  publicDemand.skills = ['family health status'];
  const publicResult = await run(
    publicDemand,
    'generation-public-demand-unused-sensitive-filter-fields'
  );
  const projectedPublic = publicResult.plans.find((item) =>
    item.id === publicDemand.id
  );
  if (publicResult.status !== 'planned' || !projectedPublic ||
      projectedPublic.targetRoleTerms.length !== 0 ||
      projectedPublic.organizationTerms.length !== 0 ||
      projectedPublic.jobTitle !== '' ||
      projectedPublic.skills.length !== 0) {
    throw new Error(
      `public-live-demand projection retained unused target filters: ${JSON.stringify(publicResult)}`
    );
  }

  const materializedRouteCandidate = (id, label) => {
    const candidate = baseReferral({ id });
    candidate.contingentFinalists.familyA.d.a[0].l = label;
    return candidate;
  };
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
      label: 'materialized family-label private route',
      candidate: (() => {
        const candidate = baseReferral({
          id: 'materialized_family_private_route'
        });
        candidate.contingentFinalists.familyA.l = 'Email outreach route';
        return candidate;
      })(),
      reason:
        /private-contact data \[private_contact_route:acquisition\]/i
    },
    {
      label: 'materialized alternate email route',
      candidate: materializedRouteCandidate(
        'materialized_alternate_email_route',
        'After approval, invite {{TARGET_NAME}} over email to refer one qualified family to book the paid consultation through {{TARGET_URL}}.'
      ),
      reason:
        /private-contact data \[private_contact_route:acquisition\]/i
    },
    {
      label: 'bounded email-object alternate route',
      candidate: materializedRouteCandidate(
        'bounded_email_object_route',
        'After approval, email a reviewed referral request to {{TARGET_NAME}} through {{TARGET_URL}}, asking them to refer one family to book the paid consultation.'
      ),
      reason:
        /private-contact data \[private_contact_route:acquisition\]/i
    },
    {
      label: 'possessive email alternate route',
      candidate: materializedRouteCandidate(
        'possessive_email_route',
        'After approval, reach {{TARGET_NAME}} at their email to request one referral to the paid consultation through {{TARGET_URL}}.'
      ),
      reason:
        /private-contact data \[private_contact_route:acquisition\]/i
    },
    ...[
      ['electronic_mail_route', 'send electronic mail'],
      ['gmail_route', 'send via Gmail'],
      ['outlook_route', 'use Outlook inbox'],
      ['sms_route', 'SMS {{TARGET_NAME}}'],
      [
        'communicate_using_sms_route',
        'communicate with {{TARGET_NAME}} using SMS'
      ],
      [
        'message_using_sms_route',
        'message {{TARGET_NAME}} using SMS'
      ],
      ['send_target_email_route', 'send {{TARGET_NAME}} an email'],
      ['send_target_sms_route', 'send {{TARGET_NAME}} an SMS'],
      [
        'send_target_whatsapp_note_route',
        'send {{TARGET_NAME}} a WhatsApp note'
      ],
      ['whatsapp_route', 'message {{TARGET_NAME}} on WhatsApp'],
      ['telegram_route', 'contact {{TARGET_NAME}} on Telegram'],
      ['signal_route', 'reach {{TARGET_NAME}} on Signal'],
      ['signal_dm_route', 'DM {{TARGET_NAME}} on Signal'],
      ['slack_route', 'message {{TARGET_NAME}} on Slack'],
      ['slack_in_route', 'message {{TARGET_NAME}} in Slack'],
      ['slack_ping_route', 'ping {{TARGET_NAME}} in Slack'],
      ['linkedin_inmail_route', 'send LinkedIn InMail'],
      ['linkedin_message_route', 'send LinkedIn message'],
      ['linkedin_note_route', 'send LinkedIn note'],
      [
        'linkedin_connection_request_route',
        'send LinkedIn connection request'
      ],
      ['linkedin_dm_route', 'send {{TARGET_NAME}} a LinkedIn DM'],
      [
        'linkedin_note_through_route',
        'send {{TARGET_NAME}} a note through LinkedIn'
      ],
      [
        'linkedin_connect_route',
        'invite {{TARGET_NAME}} to connect on LinkedIn'
      ],
      [
        'linkedin_connect_with_route',
        'connect with {{TARGET_NAME}} on LinkedIn'
      ],
      [
        'linkedin_public_profile_connect_route',
        'connect with {{TARGET_NAME}} on LinkedIn public professional profile {{TARGET_URL}}'
      ],
      [
        'linkedin_connection_invite_route',
        'send {{TARGET_NAME}} a LinkedIn connection invite'
      ],
      [
        'linkedin_chat_route',
        'start a LinkedIn chat with {{TARGET_NAME}}'
      ],
      [
        'linkedin_reach_out_route',
        'reach out to {{TARGET_NAME}} on LinkedIn'
      ],
      ['linkedin_inbox_route', 'inbox {{TARGET_NAME}} on LinkedIn'],
      ['direct_inmail_route', 'InMail {{TARGET_NAME}}'],
      ['direct_dm_route', 'DM {{TARGET_NAME}}'],
      ['ring_target_route', 'ring {{TARGET_NAME}}'],
      ['ring_up_target_route', 'ring up {{TARGET_NAME}}'],
      ['phone_up_target_route', 'phone up {{TARGET_NAME}}'],
      ['wechat_target_route', 'WeChat {{TARGET_NAME}}'],
      ['give_target_call_route', 'give {{TARGET_NAME}} a call'],
      ['give_target_ring_route', 'give {{TARGET_NAME}} a ring'],
      [
        'ask_target_on_call_route',
        'ask {{TARGET_NAME}} on a call for one referral'
      ],
      [
        'call_target_practice_route',
        'ask {{TARGET_NAME}} for a referral then call their practice'
      ],
      [
        'phone_target_practice_route',
        'ask {{TARGET_NAME}} for a referral then phone their practice'
      ],
      [
        'call_target_clinic_route',
        'ask {{TARGET_NAME}} for a referral then call their clinic'
      ],
      [
        'calling_target_practice_route',
        'reach {{TARGET_NAME}} by calling their practice'
      ],
      ['fax_target_route', 'fax {{TARGET_NAME}}'],
      ['page_target_route', 'page {{TARGET_NAME}}'],
      ['mail_target_route', 'mail {{TARGET_NAME}}'],
      ['send_target_note_route', 'send {{TARGET_NAME}} a note'],
      [
        'patient_portal_route',
        'ask {{TARGET_NAME}} for a referral then message their patient portal'
      ],
      [
        'epic_route',
        'message {{TARGET_NAME}} through Epic'
      ],
      [
        'doximity_route',
        'message {{TARGET_NAME}} through Doximity'
      ],
      [
        'mychart_route',
        'message {{TARGET_NAME}} through MyChart'
      ],
      [
        'teams_chat_route',
        'start a Teams chat with {{TARGET_NAME}}'
      ],
      ['slack_chat_route', 'chat with {{TARGET_NAME}} in Slack'],
      [
        'voicemail_route',
        'leave {{TARGET_NAME}} a voicemail asking them to recommend one qualified family'
      ],
      [
        'voice_message_route',
        'leave {{TARGET_NAME}} a voice message asking them to recommend one qualified family'
      ],
      [
        'drop_voicemail_route',
        'drop {{TARGET_NAME}} a voicemail asking them to recommend one qualified family'
      ],
      ['drop_email_route', 'drop {{TARGET_NAME}} an email'],
      ['shoot_email_route', 'shoot {{TARGET_NAME}} an email'],
      [
        'note_by_mail_route',
        'send {{TARGET_NAME}} a note by mail'
      ],
      [
        'note_to_inbox_route',
        'send {{TARGET_NAME}} a note to their inbox'
      ],
      [
        'postal_letter_route',
        'write {{TARGET_NAME}} a postal letter asking them to recommend one qualified family'
      ],
      [
        'mail_letter_route',
        'mail a letter to {{TARGET_NAME}} asking them to recommend one qualified family'
      ],
      [
        'mail_target_letter_route',
        'mail {{TARGET_NAME}} a letter asking them to recommend one qualified family'
      ],
      [
        'deliver_letter_route',
        'deliver a letter to {{TARGET_NAME}} asking them to recommend one qualified family'
      ],
      ['text_message_route', 'text-message {{TARGET_NAME}}'],
      ['office_line_route', 'dial the office line'],
      ['target_email_list_route', 'use target email list']
    ].map(([id, route]) => ({
      label: `alternate contact route ${id}`,
      candidate: materializedRouteCandidate(
        id,
        `After approval, ${route} and ask {{TARGET_NAME}} to refer one family to book the paid consultation through public professional profile {{TARGET_URL}}.`
      ),
      reason:
        /private-contact data \[private_contact_route:acquisition\]/i
    })),
    {
      label: 'scoped-looking handle in an acquisition route',
      candidate: materializedRouteCandidate(
        'scoped_handle_route',
        'After approval, use @john/profile and ask {{TARGET_NAME}} to refer one family to book the paid consultation through public professional profile {{TARGET_URL}}.'
      ),
      reason:
        /private-contact data \[private_contact_(?:value|route:acquisition)\]/i
    },
    {
      label: 'labeled phone literal in an acquisition route',
      candidate: materializedRouteCandidate(
        'labeled_phone_literal_route',
        'After approval, call NPI 9175550123, then ask {{TARGET_NAME}} to refer one family through public professional profile {{TARGET_URL}}.'
      ),
      reason:
        /private-contact data \[private_contact_route:acquisition\]/i
    },
    {
      label: 'literal email is forbidden even in descriptive prose',
      candidate: baseReferral({
        id: 'literal_email_value',
        rationale: 'No outreach is authorized to person@example.com.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'obfuscated literal email is forbidden',
      candidate: baseReferral({
        id: 'obfuscated_literal_email_value',
        rationale:
          'No outreach is authorized to person [at] example [dot] com.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'literal phone is forbidden even in descriptive prose',
      candidate: baseReferral({
        id: 'literal_phone_value',
        conversionDestination: 'Owner booking page or 917-555-0123'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'compact literal phone is forbidden',
      candidate: baseReferral({
        id: 'literal_compact_phone_value',
        rationale: 'No outreach is authorized to 9175550123.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'unlabeled compact literal phone is forbidden',
      candidate: baseReferral({
        id: 'literal_unlabeled_compact_phone_value',
        conversionDestination: 'Owner booking page 9175550123'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'international literal phone is forbidden',
      candidate: baseReferral({
        id: 'literal_international_phone_value',
        rationale: 'No outreach is authorized to +44 20 7123 4567.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'parenthesized literal phone is forbidden',
      candidate: baseReferral({
        id: 'literal_parenthesized_phone_value',
        rationale: 'No outreach is authorized to (917)538-1564.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'slash-separated literal phone is forbidden',
      candidate: baseReferral({
        id: 'literal_slash_phone_value',
        rationale: 'No outreach is authorized to 917/538/1564.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'unicode-dash literal phone is forbidden',
      candidate: baseReferral({
        id: 'literal_unicode_dash_phone_value',
        rationale: 'No outreach is authorized to 917–538–1564.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'fullwidth literal phone is forbidden',
      candidate: baseReferral({
        id: 'literal_fullwidth_phone_value',
        rationale: 'No outreach is authorized to ９１７５５５０１２３.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'UK local literal phone is forbidden',
      candidate: baseReferral({
        id: 'literal_uk_local_phone_value',
        rationale: 'No outreach is authorized to 020 7123 4567.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'country-code literal phone without plus is forbidden',
      candidate: baseReferral({
        id: 'literal_country_code_phone_value',
        rationale: 'No outreach is authorized to 44 20 7123 4567.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'fullwidth-at email literal is forbidden',
      candidate: baseReferral({
        id: 'literal_fullwidth_at_email_value',
        rationale: 'No outreach is authorized to person＠example.com.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'zero-width email literal is forbidden',
      candidate: baseReferral({
        id: 'literal_zero_width_email_value',
        rationale: 'No outreach is authorized to person@\u200Bexample.com.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'explicit private-data retrieval outside route fields',
      candidate: baseReferral({
        id: 'private_contact_retrieval',
        rationale: 'Find the target private email before review.'
      }),
      reason: /private-contact data \[private_contact_request\]/i
    },
    {
      label: 'social handle with a trailing slash is forbidden',
      candidate: baseReferral({
        id: 'literal_social_handle_trailing_slash',
        rationale: 'Contact @privatehandle/ after review.'
      }),
      reason: /private-contact data \[private_contact_value\]/i
    },
    {
      label: 'double-negative private-data retrieval',
      candidate: baseReferral({
        id: 'double_negative_private_contact',
        rationale:
          'There is no reason not to find the target private email before review.'
      }),
      reason: /private-contact data \[private_contact_request\]/i
    },
    ...[
      ['find_private_route', 'Find target email address before review.'],
      ['need_private_route', 'Need target phone number before review.'],
      ['collecting_private_routes', 'Collecting phone numbers before review.'],
      ['retrieve_private_routes', 'Retrieve private emails before review.'],
      ['use_private_directory', 'Use target contact directory before review.']
    ].map(([id, rationale]) => ({
      label: `explicit private-data request ${id}`,
      candidate: baseReferral({ id, rationale }),
      reason: /private-contact data \[private_contact_request\]/i
    })),
    {
      label: 'two sensitive clauses cannot share one service relation',
      candidate: baseReferral({
        id: 'second_sensitive_clause',
        query:
          'pediatric practice serving newborn patients; pregnant people looking for lactation help Queens New York'
      }),
      reason: /in its query/i
    },
    {
      label: 'patient lead-list server search',
      candidate: baseReferral({
        id: 'patient_lead_list_servers',
        query: 'pediatrician servers containing patient lead lists'
      }),
      reason: /private-contact data/i
    },
    {
      label: 'contact-directory search',
      candidate: baseReferral({
        id: 'contact_directory_search',
        query: 'pediatrician email directory Queens New York'
      }),
      reason: /private-contact data \[private_contact_request\]/i
    },
    {
      label: 'direct pregnant-people role',
      candidate: baseReferral({
        id: 'pregnant_people_role',
        targetRoleTerms: ['pregnant people']
      }),
      reason: /direct role, title, or skill target/i
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
        motionKind: 'direct_buyer_person',
        demandArtifactKind: 'not_applicable',
        commercialRole: 'buyer',
        acquisitionMode: 'permissioned_outreach'
      }),
      reason: /in its query/i
    }
  ];
  for (const [index, privateContactTerm] of [
    'email', 'emails', 'e-mail', 'e-mails', 'e-mail addresses',
    'phone', 'phones', 'telephone', 'telephones', 'contacts',
    'lead lists'
  ].entries()) {
    adversaries.push({
      label: `bare private-contact intent: ${privateContactTerm}`,
      candidate: baseReferral({
        id: `bare_private_contact_${index + 1}`,
        acquisitionMechanism:
          `Use ${privateContactTerm} for one review-first referral request`
      }),
      reason: /private-contact data/i
    });
  }
  for (const [index, adversary] of adversaries.entries()) {
    const result = await run(
      adversary.candidate,
      `generation-sensitive-adversary-${index + 1}`
    );
    const rejection = result.planSelection?.rejectedPlans?.[0]?.reason || '';
    if (result.status !== 'planned' ||
        !adversary.reason.test(rejection) ||
        /person@example\.com|917-555-0123|9175550123|44 20 7123 4567|\(917\)538-1564|917\/538\/1564/i.test(
          rejection
        ) ||
        result.plans.length !== 1 ||
        result.planSelection?.acceptedPlanCount !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${adversary.label} did not fail closed: ${JSON.stringify(result)}`
      );
    }
  }

  for (const [index, wrapperReason] of [
    'No outreach is authorized to person@example.com.',
    'Find the target private email before review.'
  ].entries()) {
    const result = await run(
      baseReferral({ id: `wrapper_reason_private_contact_${index + 1}` }),
      `generation-wrapper-reason-private-contact-${index + 1}`,
      wrapperReason
    );
    if (result.status !== 'blocked' ||
        !/planner reason (?:contains|requests) private-contact data/i.test(
          result.reason
        ) ||
        /person@example\.com/i.test(result.reason) ||
        result.plans.length !== 0 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `wrapper reason private-contact data was not safely rejected: ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyDiscoveryRoleAndAdapterInvariants(job, evidenceRef) {
  const candidate = (overrides = {}) => plan({
    id: 'typed_route_invariant',
    priority: 1,
    searchMode: 'professional_counterparty',
    commercialRole: 'buyer',
    acquisitionMode: 'permissioned_outreach',
    buyer: 'A business buying a current paid advisory service',
    counterparty: 'One exact public professional decision-maker',
    paidOffer: 'Paid advisory engagement',
    evidenceRefs: [evidenceRef],
    query: 'operations decision maker professional services firm',
    market: 'Queens, New York, United States',
    targetRoleTerms: ['operations director'],
    organizationTerms: ['professional services firm'],
    acquisitionMechanism: 'One review-first tailored paid-service invitation',
    conversionDestination: 'The verified owner booking page',
    paidConversion: 'One signed paid advisory engagement',
    attributionSignal: 'CRM source stores target and tournament action ids',
    ...overrides
  });
  const run = async (motion, generationId) =>
    runOpportunityDiscoveryPlanner({
      job: structuredClone(job),
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => ({
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: 'One typed outside commercial motion.',
          plans: twoPlannerMotions(motion, evidenceRef)
        },
        usage,
        generationId,
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 800,
          contentSha256: '7'.repeat(64)
        },
        annotations: []
      })
    });

  const coherentTitles = await run(candidate({
    id: 'coherent_operations_title_family',
    targetRoleTerms: [
      'chief operating officer',
      'head of operations'
    ]
  }), 'generation-coherent-professional-title-family');
  if (coherentTitles.status !== 'planned' ||
      coherentTitles.plans.length !== 2 ||
      coherentTitles.planSelection?.rejectedPlanCount !== 0) {
    throw new Error(
      `coherent professional title synonyms were rejected: ${JSON.stringify(coherentTitles)}`
    );
  }

  const mixedTitles = await run(candidate({
    id: 'mixed_professional_title_families',
    targetRoleTerms: [
      'pediatrician',
      'practice manager',
      'midwife'
    ],
    organizationTerms: ['pediatric practice', 'birth center']
  }), 'generation-mixed-professional-title-family-salvage');
  if (mixedTitles.status !== 'planned' ||
      mixedTitles.plans.length !== 2 ||
      mixedTitles.planSelection?.acceptedPlanCount !== 2 ||
      mixedTitles.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(mixedTitles.plans[0].targetRoleTerms) !==
        JSON.stringify(['pediatrician']) ||
      !mixedTitles.plans[0].query.includes('pediatrician') ||
      mixedTitles.plans[0].query.includes('practice manager') ||
      mixedTitles.plans[0].query.includes('midwife')) {
    throw new Error(
      `mixed professional title ORs were not narrowed to the first coherent provider family: ${JSON.stringify(mixedTitles)}`
    );
  }

  const rejectedRoutes = [
    ['referral_partner', 'inbound'],
    ['referral_partner', 'permissioned_outreach'],
    ['referral_partner', 'warm_referral'],
    ['referral_partner', 'existing_customer'],
    ['buyer', 'inbound'],
    ['buyer', 'partner_channel'],
    ['buyer', 'warm_referral'],
    ['buyer', 'existing_customer'],
    ['paid_demand', 'warm_referral'],
    ['paid_demand', 'existing_customer']
  ];
  for (const [index, [commercialRole, acquisitionMode]] of
    rejectedRoutes.entries()) {
    const paidDemand = commercialRole === 'paid_demand';
    const motion = candidate({
      id: `invalid_route_${index + 1}`,
      searchMode: paidDemand ? 'public_live_demand' :
        'professional_counterparty',
      commercialRole,
      acquisitionMode,
      jobTitle: paidDemand ? 'Paid advisory contract' : '',
      skills: paidDemand ? ['operations consulting'] : [],
      targetSlot: paidDemand ? {
        finalTargetKind: 'live_paid_demand',
        resolutionStrategy: 'single_exact_target'
      } : undefined
    });
    const result = await run(
      motion,
      `generation-invalid-role-route-${index + 1}`
    );
    if (result.status !== 'planned' ||
        result.plans.length !== 1 ||
        result.planSelection?.acceptedPlanCount !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        result.sideEffectsPerformed !== 0 ||
        !result.planSelection?.rejectedPlans?.[0]?.reason) {
      throw new Error(
        `invalid ${commercialRole}/${acquisitionMode} route did not fail closed: ${JSON.stringify(result)}`
      );
    }
  }

  const rejectedAdapters = [
    {
      label: 'professional counterparty decision-maker chain',
      searchMode: 'professional_counterparty',
      finalTargetKind: 'person',
      resolutionStrategy: 'organization_then_decision_maker',
      reason: /only for a local-organization search/i
    },
    {
      label: 'terminal professional organization',
      searchMode: 'professional_counterparty',
      finalTargetKind: 'organization',
      resolutionStrategy: 'single_exact_target',
      reason: /exact decision-maker person/i
    },
    {
      label: 'local person without organization chain',
      searchMode: 'local_organization',
      finalTargetKind: 'person',
      resolutionStrategy: 'single_exact_target',
      reason: /intermediate seed.*decision-maker person/i
    },
    {
      label: 'terminal local organization',
      searchMode: 'local_organization',
      finalTargetKind: 'organization',
      resolutionStrategy: 'single_exact_target',
      reason: /intermediate seed.*decision-maker person/i
    },
    {
      label: 'local organization through person chain',
      searchMode: 'local_organization',
      finalTargetKind: 'organization',
      resolutionStrategy: 'organization_then_decision_maker',
      reason: /resolve a person after the intermediate organization/i
    }
  ];
  for (const [index, adapter] of rejectedAdapters.entries()) {
    const result = await run(candidate({
      id: `invalid_adapter_${index + 1}`,
      searchMode: adapter.searchMode,
      targetSlot: {
        finalTargetKind: adapter.finalTargetKind,
        resolutionStrategy: adapter.resolutionStrategy
      }
    }), `generation-invalid-adapter-${index + 1}`);
    if (result.status !== 'planned' ||
        result.plans.length !== 2 ||
        result.planSelection?.rejectedPlanCount !== 0 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${adapter.label} was not structurally canonicalized: ${JSON.stringify(result)}`
      );
    }
  }

  const acceptedAdapters = [
    candidate({ id: 'valid_professional_person' }),
    candidate({
      id: 'valid_local_decision_maker',
      searchMode: 'local_organization',
      targetSlot: {
        finalTargetKind: 'person',
        resolutionStrategy: 'organization_then_decision_maker'
      }
    })
  ];
  for (const [index, motion] of acceptedAdapters.entries()) {
    const result = await run(
      motion,
      `generation-valid-adapter-${index + 1}`
    );
    if (result.status !== 'planned' ||
        result.plans.length !== 2 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `valid adapter route was rejected: ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyOneMotionFailsClosed(job, evidenceRef) {
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
  if (result.status !== 'blocked' ||
      !/exactly two grounded, economically distinct commercial motions/i.test(
        result.reason
      ) ||
      result.plans.length !== 0 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `one-motion planner output did not fail closed: ${JSON.stringify(result)}`
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
        plans: twoPlannerMotions(motion, evidenceRef)
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
      result.plans.length !== 2 ||
      result.plans[0].contingentFinalists?.familyA?.d?.a?.length !== 2 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `one invalid action variant blocked two viable causal families: ${JSON.stringify(result)}`
    );
  }
}

async function verifyQualifiedPartnerReferralActionsPass(job, evidenceRef) {
  const motion = cases[0].plans(evidenceRef)[0];
  const actions = [
    'Review first: via verified professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to recommend that one qualified family book the current consultation.',
    'After review, via LinkedIn {{TARGET_URL}}, ask {{TARGET_NAME}} to refer one qualified family to book the current consultation.',
    'After review, via LinkedIn {{TARGET_URL}}, ask {{TARGET_NAME}} for a partner referral to the paid booking offer.',
    'After approval, via LinkedIn {{TARGET_URL}}, ask {{TARGET_NAME}} for a partner introduction to the paid offer.'
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
        plans: twoPlannerMotions(motion, evidenceRef)
      },
      usage,
      generationId: 'generation-qualified-partner-referral-actions',
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
  if (result.status !== 'planned' || result.plans.length !== 2 ||
      JSON.stringify(returnedActions) !== JSON.stringify(actions)) {
    throw new Error(
      `qualified partner-referral revenue actions were rejected: ${JSON.stringify(result)}`
    );
  }
}

async function verifyCompactConversionActionProjection(job, evidenceRef) {
  const motion = cases[0].plans(evidenceRef)[0];
  motion.contingentFinalists = compactContingentFinalists(
    motion.contingentFinalists
  );
  const projected = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-compact-conversion-action-projection'
  });
  const projectedFamilies = ['familyA', 'familyB'].map((familyKey) =>
    projected.plans[0]?.contingentFinalists?.[familyKey]
  );
  if (projected.status !== 'planned' || projected.plans.length !== 2 ||
      projectedFamilies.some((family) =>
        !family || family.d?.r?.[0]?.c !== family.d?.a?.[0]?.l
      ) ||
      projected.sideEffectsPerformed !== 0) {
    throw new Error(
      `compact redundant conversion action was not projected from a locally valid tactic: ${JSON.stringify(projected)}`
    );
  }

  const secondAction = cases[0].plans(evidenceRef)[0];
  secondAction.contingentFinalists = compactContingentFinalists(
    secondAction.contingentFinalists
  );
  secondAction.contingentFinalists.tacticA.a[0].l =
    'After review, monitor {{TARGET_NAME}} without making a paid referral request.';
  const selectedSecond = await plannerResultForMotion({
    job,
    motion: secondAction,
    generationId: 'generation-compact-second-conversion-action-projection'
  });
  if (selectedSecond.status !== 'planned' ||
      selectedSecond.plans[0]?.contingentFinalists?.familyA?.d?.r?.[0]?.c !==
        selectedSecond.plans[0]?.contingentFinalists?.familyA?.d?.a?.[1]?.l) {
    throw new Error(
      `compact projection did not select the first locally valid same-family action: ${JSON.stringify(selectedSecond)}`
    );
  }

  const arbitrary = cases[0].plans(evidenceRef)[0];
  arbitrary.contingentFinalists = compactContingentFinalists(
    arbitrary.contingentFinalists
  );
  arbitrary.contingentFinalists.pathBase.r[0].c =
    'Measure the booking workflow without making a commercial ask.';
  const arbitraryRejected = await plannerResultForMotion({
    job,
    motion: arbitrary,
    generationId: 'generation-compact-arbitrary-conversion-action'
  });
  if (arbitraryRejected.status !== 'planned' ||
      arbitraryRejected.plans.length !== 1 ||
      arbitraryRejected.planSelection?.rejectedPlanCount !== 1 ||
      !/conversion_action/i.test(
        arbitraryRejected.planSelection?.rejectedPlans?.[0]?.reason || ''
      )) {
    throw new Error(
      `arbitrary compact conversion action was improperly healed: ${JSON.stringify(arbitraryRejected)}`
    );
  }

  const invalid = cases[0].plans(evidenceRef)[0];
  invalid.contingentFinalists = compactContingentFinalists(
    invalid.contingentFinalists
  );
  for (const action of invalid.contingentFinalists.tacticA.a) {
    action.l =
      'After review, monitor {{TARGET_NAME}} without making a paid referral request.';
  }
  const rejected = await plannerResultForMotion({
    job,
    motion: invalid,
    generationId: 'generation-compact-no-valid-conversion-action'
  });
  if (rejected.status !== 'planned' || rejected.plans.length !== 1 ||
      rejected.planSelection?.rejectedPlanCount !== 1 ||
      !/primary_action_(?:passive|negated|non_revenue|partner_referral)/i.test(
        rejected.planSelection?.rejectedPlans?.[0]?.reason || ''
      ) ||
      rejected.sideEffectsPerformed !== 0) {
    throw new Error(
      `compact conversion projection rescued an invalid tactic: ${JSON.stringify(rejected)}`
    );
  }

  const materializedMarker = cases[0].plans(evidenceRef)[0];
  for (const familyKey of ['familyA', 'familyB']) {
    materializedMarker.contingentFinalists[familyKey].d.r[0].c =
      'project_first_viable_tactic_action';
  }
  const materializedRejected = await plannerResultForMotion({
    job,
    motion: materializedMarker,
    generationId: 'generation-materialized-conversion-marker'
  });
  if (materializedRejected.status !== 'planned' ||
      materializedRejected.plans.length !== 1 ||
      materializedRejected.planSelection?.rejectedPlanCount !== 1 ||
      !/conversion_action/i.test(
        materializedRejected.planSelection?.rejectedPlans?.[0]?.reason || ''
      )) {
    throw new Error(
      `materialized conversion marker was improperly projected: ${JSON.stringify(materializedRejected)}`
    );
  }

  const persistedCompact = normalizeCommercialDiscoveryEvidence({
    contractVersion: COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT,
    status: 'not_found',
    attempted: true,
    motion: motion.id,
    buyerArchetype: motion.buyer,
    market: motion.market,
    queryHash: '9'.repeat(64),
    providersAttempted: ['openrouter_exa_web_search'],
    providerCalls: 1,
    paidProviderCalls: 0,
    creditsUsed: 0,
    resultCount: 0,
    patientTargetingExcluded: true,
    sideEffectsPerformed: 0,
    discoveredAt: now.toISOString(),
    plan: {
      contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
      status: 'planned',
      reason: 'Persisted compact marker must not be projected.',
      evidenceHash: projected.evidenceHash,
      plans: twoPlannerMotions(motion, evidenceRef),
      webSearchReceipt: projected.webSearchReceipt,
      sideEffectsPerformed: 0
    },
    attempts: [],
    evidence: [],
    candidates: []
  }, now);
  if (persistedCompact.valid !== false ||
      persistedCompact.plan?.valid !== false ||
      !/conversion_action/i.test(
        persistedCompact.plan?.rejectedReason || ''
      )) {
    throw new Error(
      `persisted compact conversion marker was improperly projected: ${JSON.stringify(persistedCompact)}`
    );
  }
}

async function verifyPaidDemandResponseActionVerbs(job, evidenceRef) {
  const motion = cases[2].plans(evidenceRef)[0];
  motion.market = 'Queens, New York, United States';
  const actions = [
    'After review, submit one paid application to {{TARGET_NAME}} through the official response page.',
    'After review, apply to {{TARGET_NAME}} through one paid-role application.',
    'After review, respond to {{TARGET_NAME}} with one paid contract proposal.',
    'After review, bid on {{TARGET_NAME}} through one paid contract response.'
  ];
  let index = 0;
  for (const familyKey of ['familyA', 'familyB']) {
    for (const action of
      motion.contingentFinalists[familyKey].d.a) {
      action.l = actions[index];
      index += 1;
    }
  }
  const accepted = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-paid-demand-response-verbs'
  });
  if (accepted.status !== 'planned' || accepted.plans.length !== 2) {
    throw new Error(
      `paid application/proposal/response verbs were rejected: ${JSON.stringify(accepted)}`
    );
  }

  const artifactOnly = cases[2].plans(evidenceRef)[0];
  artifactOnly.market = 'Queens, New York, United States';
  artifactOnly.contingentFinalists.familyA.d.a[0].l =
    'After review, submit one research report to {{TARGET_NAME}}.';
  artifactOnly.contingentFinalists.familyA.d.a[1].l =
    'After review, submit one analytics dashboard to {{TARGET_NAME}}.';
  const rejected = await plannerResultForMotion({
    job,
    motion: artifactOnly,
    generationId: 'generation-non-revenue-artifact-submission'
  });
  if (rejected.status !== 'planned' ||
      !/primary_action_(?:non_revenue|passive)/i.test(
        rejected.planSelection?.rejectedPlans?.[0]?.reason || ''
      ) ||
      rejected.plans.length !== 1 ||
      rejected.planSelection?.rejectedPlanCount !== 1 ||
      rejected.sideEffectsPerformed !== 0) {
    throw new Error(
      `non-revenue artifact submission passed: ${JSON.stringify(rejected)}`
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
  if (result.status !== 'planned' || result.plans.length !== 2) {
    throw new Error(
      `empty optional supporting bottleneck was rejected: ${JSON.stringify(result)}`
    );
  }
}

async function verifyServicePaymentOutcomesPass(job, evidenceRef) {
  const outcomes = [
    'One completed paid lactation consultation recorded.',
    'One completed reimbursed lactation home visit recorded.',
    'One paid visit recorded.',
    'One paid session recorded.',
    'One paid service recorded.',
    'One paid engagement recorded.',
    'One reimbursed consultation recorded.',
    'One reimbursed visit recorded.',
    'One reimbursed session recorded.'
  ];
  for (const [index, outcome] of outcomes.entries()) {
    const motion = cases[0].plans(evidenceRef)[0];
    const revenue = motion.contingentFinalists.familyA.d.r[0];
    revenue.o = outcome;
    if (/\breimbursed\b/i.test(outcome)) {
      revenue.rm = 'insurance_reimbursement';
      revenue.k.c = 'insurance_reimbursement';
      revenue.k.o = 'insurance_reimbursement';
      revenue.k.p = 'insurance_reimbursement_terminal';
    }
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-service-payment-outcome-${index + 1}`
    });
    if (result.status !== 'planned' || result.plans.length !== 2) {
      throw new Error(
        `explicit service payment outcome was rejected (${outcome}): ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyUnpaidServiceOutcomeFails(job, evidenceRef) {
  const outcomes = [
    'One completed unpaid lactation consultation recorded.',
    'One billable professional support session recorded.'
  ];
  for (const [index, outcome] of outcomes.entries()) {
    const motion = cases[0].plans(evidenceRef)[0];
    motion.contingentFinalists.familyA.d.r[0].o = outcome;
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-unpaid-service-outcome-${index + 1}`
    });
    if (result.status !== 'planned' ||
        !(result.planSelection?.rejectedPlans?.[0]?.reason || '')
          .includes('[observable_revenue]') ||
        result.plans.length !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `unsettled service outcome passed the revenue gate (${outcome}): ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyMechanismSpecificTerminalOutcomes(job, evidenceRef) {
  const mechanisms = [
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
  ];
  const motionFor = (mechanism, outcome) => {
    const motion = cases[0].plans(evidenceRef)[0];
    for (const familyKey of ['familyA', 'familyB']) {
      const revenue = motion.contingentFinalists[familyKey].d.r[0];
      revenue.rm = mechanism;
      revenue.o = outcome;
      revenue.k.c = mechanism;
      revenue.k.o = mechanism;
      revenue.k.p = `${mechanism}_terminal`;
    }
    return motion;
  };

  for (const [index, mechanism] of mechanisms.entries()) {
    const outcome = canonicalTerminalPaidOutcome(mechanism);
    const result = await plannerResultForMotion({
      job,
      motion: motionFor(mechanism, outcome),
      generationId: `generation-terminal-outcome-${index + 1}`
    });
    if (result.status !== 'planned' || result.plans.length !== 2) {
      throw new Error(
        `canonical ${mechanism} terminal outcome was rejected: ${JSON.stringify(result)}`
      );
    }
  }

  for (const [mechanismIndex, mechanism] of mechanisms.entries()) {
    for (const [otherIndex, otherMechanism] of mechanisms.entries()) {
      if (mechanism === otherMechanism) continue;
      const motion = motionFor(
        mechanism,
        canonicalTerminalPaidOutcome(mechanism)
      );
      motion.contingentFinalists.familyA.d.r[0].o =
        canonicalTerminalPaidOutcome(otherMechanism);
      const result = await plannerResultForMotion({
        job,
        motion,
        generationId:
          `generation-cross-mechanism-prose-${mechanismIndex + 1}-${otherIndex + 1}`
      });
      if (result.status !== 'planned' ||
          !(result.planSelection?.rejectedPlans?.[0]?.reason || '')
            .includes('[observable_revenue]') ||
          result.plans.length !== 1 ||
          result.planSelection?.rejectedPlanCount !== 1 ||
          result.sideEffectsPerformed !== 0) {
        throw new Error(
          `${otherMechanism} prose passed for ${mechanism} typed terminal outcome: ${JSON.stringify(result)}`
        );
      }
    }
  }

  const crossRuntimeVariants = [
    ['paid_booking', 'One paid lactation visit was completed and recorded.'],
    ['direct_sale', 'One paid checkout was completed.'],
    ['direct_sale', 'One paid order was confirmed.'],
    ['signed_contract', 'One signed paid agreement and payment received.'],
    ['paid_pilot', 'One paid pilot was completed and its funds received.'],
    ['paid_pilot', 'One paid pilot payment was received.'],
    ['subscription_or_retainer', 'One subscription was signed and its funds received.'],
    ['insurance_reimbursement', 'One claim was paid.'],
    ['insurance_reimbursement', 'One reimbursed consultation was completed and recorded.'],
    ['license_or_royalty', 'One licensing payment was received.'],
    ['license_or_royalty', 'One royalties statement shows payment received.'],
    ['commission_or_referral', 'One commission invoice was paid.'],
    ['sponsorship', 'One sponsored placement was awarded and payment received.'],
    ['platform_payout', 'One marketplace payment was received.'],
    ['platform_payout', 'One ad revenue payment was received.'],
    ['compensated_role', 'One compensated offer was accepted.']
  ];
  for (const [index, [mechanism, outcome]] of
    crossRuntimeVariants.entries()) {
    const result = await plannerResultForMotion({
      job,
      motion: motionFor(mechanism, outcome),
      generationId: `generation-cross-runtime-terminal-${index + 1}`
    });
    if (result.status !== 'planned' || result.plans.length !== 2) {
      throw new Error(
        `cross-runtime ${mechanism} terminal outcome was rejected (${outcome}): ${JSON.stringify(result)}`
      );
    }
  }

  const adversaries = [
    {
      mechanism: 'paid_booking',
      outcome: 'One paid booking or payment receipt is recorded.',
      name: 'paid-booking disjunction'
    },
    {
      mechanism: 'compensated_role',
      outcome:
        'One compensation offer is accepted or salary payment is recorded.',
      name: 'compensated-role disjunction'
    },
    {
      mechanism: 'direct_sale',
      outcome: 'One order payment attempt is recorded.',
      name: 'direct-sale payment attempt'
    },
    {
      mechanism: 'signed_contract',
      outcome: 'One paid-services proposal was submitted.',
      name: 'proposal submission without a paid conversion'
    },
    {
      mechanism: 'signed_contract',
      outcome:
        'One contract proposal is accepted and a payment attempt is recorded.',
      name: 'contract payment attempt'
    },
    {
      mechanism: 'subscription_or_retainer',
      outcome: 'One subscription payment is pending.',
      name: 'pending subscription payment'
    },
    {
      mechanism: 'platform_payout',
      outcome: 'One marketplace payout failed and is not received.',
      name: 'failed payout'
    },
    {
      mechanism: 'subscription_or_retainer',
      outcome: 'Two subscription payment attempts were recorded.',
      name: 'plural payment attempts'
    },
    {
      mechanism: 'direct_sale',
      outcome: 'One order payment authorization was recorded.',
      name: 'payment authorization'
    },
    {
      mechanism: 'direct_sale',
      outcome: 'One order payment was initiated and recorded.',
      name: 'initiated payment'
    },
    {
      mechanism: 'subscription_or_retainer',
      outcome: 'One subscription payment is processing.',
      name: 'processing payment'
    },
    {
      mechanism: 'signed_contract',
      outcome: 'One signed contract has an invoice payment due and recorded.',
      name: 'payment due'
    },
    {
      mechanism: 'signed_contract',
      outcome: 'One signed contract has an invoice payment owed and recorded.',
      name: 'payment owed'
    },
    {
      mechanism: 'signed_contract',
      outcome: 'One signed contract has an outstanding invoice payment recorded.',
      name: 'payment outstanding'
    },
    {
      mechanism: 'signed_contract',
      outcome: 'One signed contract has its invoice payment recorded.',
      name: 'recorded-only payment'
    },
    {
      mechanism: 'paid_booking',
      outcome: 'One billable visit was confirmed.',
      name: 'uncompleted billable visit'
    },
    {
      mechanism: 'compensated_role',
      outcome: 'One compensated job offer was issued.',
      name: 'issued offer'
    },
    {
      mechanism: 'compensated_role',
      outcome: 'One application was accepted.',
      name: 'accepted application without a compensated offer'
    },
    {
      mechanism: 'compensated_role',
      outcome: 'One compensated job offer was received.',
      name: 'unaccepted received offer'
    }
  ];
  for (const [index, adversary] of adversaries.entries()) {
    const motion = motionFor(
      adversary.mechanism,
      canonicalTerminalPaidOutcome(adversary.mechanism)
    );
    motion.contingentFinalists.familyA.d.r[0].o = adversary.outcome;
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-terminal-adversary-${index + 1}`
    });
    if (result.status !== 'planned' ||
        !(result.planSelection?.rejectedPlans?.[0]?.reason || '')
          .includes('[observable_revenue]') ||
        result.plans.length !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${adversary.name} passed the terminal revenue gate: ${JSON.stringify(result)}`
      );
    }
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
    if (result.status !== 'planned' || result.plans.length !== 2) {
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
    if (result.status !== 'planned' ||
        !(result.planSelection?.rejectedPlans?.[0]?.reason || '')
          .includes('[numeric_stop]') ||
        result.plans.length !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
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
    if (result.status !== 'planned' || result.plans.length !== 2) {
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
    if (result.status !== 'planned' ||
        !(result.planSelection?.rejectedPlans?.[0]?.reason || '')
          .includes('[attribution_signal]') ||
        result.plans.length !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
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
  if (result.status !== 'planned' ||
      !(result.planSelection?.rejectedPlans?.[0]?.reason || '')
        .includes(expected) ||
      result.plans.length !== 1 ||
      result.planSelection?.rejectedPlanCount !== 1 ||
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
      typed.plans.length !== 2 ||
      typed.sideEffectsPerformed !== 0 ||
      typed.plans[0]?.contingentFinalists?.familyA?.d?.r?.[0]
        ?.k?.v !== 'revenue_causal_witness_v2' ||
      typed.plans[0]?.contingentFinalists?.familyA?.d?.r?.[0]
        ?.k?.p !== 'paid_booking_terminal') {
    throw new Error(
      `typed causal witnesses did not carry through planner normalization: ${JSON.stringify(typed)}`
    );
  }

  const legacyWitnessMotion = cases[0].plans(evidenceRef)[0];
  for (const familyKey of ['familyA', 'familyB']) {
    const witness = legacyWitnessMotion.contingentFinalists[familyKey]
      .d.r[0].k;
    witness.v = 'revenue_causal_witness_v1';
    delete witness.p;
  }
  const legacyWitness = await plannerResultForMotion({
    job,
    motion: legacyWitnessMotion,
    generationId: 'generation-legacy-v1-causal-witness'
  });
  if (legacyWitness.status !== 'planned' ||
      !/invalid typed causal revenue witness.*contract_version/i.test(
        legacyWitness.planSelection?.rejectedPlans?.[0]?.reason || ''
      ) ||
      legacyWitness.plans.length !== 1 ||
      legacyWitness.planSelection?.rejectedPlanCount !== 1 ||
      legacyWitness.sideEffectsPerformed !== 0) {
    throw new Error(
      `new planner completion accepted a legacy v1 witness: ${JSON.stringify(legacyWitness)}`
    );
  }

  const mismatched = cases[0].plans(evidenceRef)[0];
  mismatched.contingentFinalists.familyA.d.r[0].k.c = 'direct_sale';
  const mismatchResult = await plannerResultForMotion({
    job,
    motion: mismatched,
    generationId: 'generation-mismatched-causal-witness'
  });
  if (mismatchResult.status !== 'planned' ||
      !/invalid typed causal revenue witness.*conversion_action/i.test(
        mismatchResult.planSelection?.rejectedPlans?.[0]?.reason || ''
      ) ||
      mismatchResult.plans.length !== 1 ||
      mismatchResult.planSelection?.rejectedPlanCount !== 1 ||
      mismatchResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `invalid typed witness was rescued by legacy text: ${JSON.stringify(mismatchResult)}`
    );
  }

  const mechanisms = [
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
  ];
  for (const [index, mechanism] of mechanisms.entries()) {
    const terminalMismatch = cases[0].plans(evidenceRef)[0];
    for (const familyKey of ['familyA', 'familyB']) {
      const revenue = terminalMismatch.contingentFinalists[familyKey]
        .d.r[0];
      revenue.rm = mechanism;
      revenue.o = canonicalTerminalPaidOutcome(mechanism);
      revenue.k.c = mechanism;
      revenue.k.o = mechanism;
      revenue.k.p = `${mechanism}_terminal`;
    }
    terminalMismatch.contingentFinalists.familyA.d.r[0].k.p =
      index === mechanisms.length - 1
        ? 'unknown_terminal'
        : `${mechanisms[index + 1]}_terminal`;
    const terminalMismatchResult = await plannerResultForMotion({
      job,
      motion: terminalMismatch,
      generationId: `generation-mismatched-terminal-outcome-witness-${index + 1}`
    });
    if (terminalMismatchResult.status !== 'planned' ||
        !/invalid typed causal revenue witness.*observable_revenue/i.test(
          terminalMismatchResult.planSelection?.rejectedPlans?.[0]?.reason || ''
        ) ||
        terminalMismatchResult.plans.length !== 1 ||
        terminalMismatchResult.planSelection?.rejectedPlanCount !== 1 ||
        terminalMismatchResult.sideEffectsPerformed !== 0) {
      throw new Error(
        `mismatched ${mechanism} terminal outcome witness passed: ${JSON.stringify(terminalMismatchResult)}`
      );
    }
  }

  const missingTerminalState = cases[0].plans(evidenceRef)[0];
  delete missingTerminalState.contingentFinalists.familyA.d.r[0].k.p;
  const missingTerminalStateResult = await plannerResultForMotion({
    job,
    motion: missingTerminalState,
    generationId: 'generation-missing-terminal-outcome-witness'
  });
  if (missingTerminalStateResult.status !== 'planned' ||
      !/invalid typed causal revenue witness.*observable_revenue/i.test(
        missingTerminalStateResult.planSelection?.rejectedPlans?.[0]?.reason || ''
      ) ||
      missingTerminalStateResult.plans.length !== 1 ||
      missingTerminalStateResult.planSelection?.rejectedPlanCount !== 1 ||
      missingTerminalStateResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `missing terminal outcome witness passed: ${JSON.stringify(missingTerminalStateResult)}`
    );
  }

  const proseMismatch = cases[0].plans(evidenceRef)[0];
  proseMismatch.contingentFinalists.familyA.d.r[0].o =
    'One paid order was completed.';
  const proseMismatchResult = await plannerResultForMotion({
    job,
    motion: proseMismatch,
    generationId: 'generation-cross-mechanism-terminal-prose'
  });
  if (proseMismatchResult.status !== 'planned' ||
      !(proseMismatchResult.planSelection?.rejectedPlans?.[0]?.reason || '')
        .includes('[observable_revenue]') ||
      proseMismatchResult.plans.length !== 1 ||
      proseMismatchResult.planSelection?.rejectedPlanCount !== 1 ||
      proseMismatchResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `cross-mechanism terminal prose passed: ${JSON.stringify(proseMismatchResult)}`
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
  if (missingResult.status !== 'planned' ||
      !/typed causal revenue witness.*missing_witness/i.test(
        missingResult.planSelection?.rejectedPlans?.[0]?.reason || ''
      ) ||
      missingResult.plans.length !== 1 ||
      missingResult.planSelection?.rejectedPlanCount !== 1 ||
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
  const legacyV1PersistedPlan = structuredClone(legacyValid);
  for (const familyKey of ['familyA', 'familyB']) {
    const witness = legacyV1PersistedPlan.plans[0]
      .contingentFinalists[familyKey].d.r[0].k;
    witness.v = 'revenue_causal_witness_v1';
    delete witness.p;
  }
  const legacyV1Persisted = normalizeCommercialDiscoveryEvidence(
    persistedEnvelope(legacyV1PersistedPlan, '7'.repeat(64)),
    now
  );
  if (legacyV1Persisted.valid !== true ||
      legacyV1Persisted.plan?.valid !== true) {
    throw new Error(
      `historical v1 receipt lost strict-text read compatibility: ${JSON.stringify(legacyV1Persisted)}`
    );
  }
  const legacyV1NegatedPlan = structuredClone(legacyV1PersistedPlan);
  for (const familyKey of ['familyA', 'familyB']) {
    legacyV1NegatedPlan.plans[0].contingentFinalists[familyKey]
      .d.r[0].c =
        'Do not ask {{TARGET_NAME}} to refer buyers to the paid booking.';
  }
  const legacyV1Negated = normalizeCommercialDiscoveryEvidence(
    persistedEnvelope(legacyV1NegatedPlan, '8'.repeat(64)),
    now
  );
  if (legacyV1Negated.valid !== false ||
      legacyV1Negated.plan?.valid !== false ||
      !legacyV1Negated.plan?.rejectedReason?.includes(
        'conversion_action'
      )) {
    throw new Error(
      `historical witness compatibility accepted a negated conversion action: ${JSON.stringify(legacyV1Negated)}`
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
  const legacyUnsupportedClaims = [
    'incremental_income',
    'observable_revenue',
    'attribution_signal',
    'conversion_destination',
    'numeric_stop'
  ];
  if (legacyNovelPersisted.valid !== false ||
      legacyNovelPersisted.plan?.valid !== false ||
      !legacyUnsupportedClaims.every((code) =>
        legacyNovelPersisted.plan?.rejectedReason?.includes(code)
      )) {
    throw new Error(
      `legacy regex fallback did not fail the unsupported novel semantic claims closed: ${JSON.stringify(legacyNovelPersisted)}`
    );
  }
}

async function plannerResultForMotion({ job, motion, generationId }) {
  const evidenceRef = motion.evidenceRefs.find((ref) =>
    /^observation:/i.test(ref)
  );
  return runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'Two review-first commercial motions retain causal tactics.',
        plans: twoPlannerMotions(motion, evidenceRef)
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
  const firstThree = [
    ...cases[0].plans(evidenceRef),
    cases[1].plans(evidenceRef)[0]
  ];
  firstThree[2].priority = 3;
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'Raw provider shape violates the two-motion envelope.',
        plans: firstThree
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
      !/exactly two grounded, economically distinct commercial motions/i.test(
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
        ?.plans?.maxItems !== 2 ||
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
      name: 'live-demand search with referral role',
      canonicalized: true,
      mutate(plans) {
        plans[0].searchMode = 'public_live_demand';
      },
      reason: /live-demand searches require paid-demand role/i
    },
    {
      name: 'referral route with live-demand target kind',
      canonicalized: true,
      mutate(plans) {
        plans[0].query = 'pediatric referral authority Queens New York';
        plans[0].targetSlot.finalTargetKind = 'live_paid_demand';
        plans[0].targetSlot.resolutionStrategy = 'single_exact_target';
      },
      reason: /exact decision-maker person|live paid demand only for a typed paid-demand search/i
    },
    {
      name: 'non-local decision-maker chain drift',
      canonicalized: true,
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
      name: 'peer supplier availability is not paid demand',
      canonicalized: true,
      caseIndex: 2,
      mutate(plans) {
        plans[0].query =
          'lactation consultant in New York accepting United Healthcare insurance';
      },
      reason: /buyer- or employer-authored compensated job, RFP, solicitation, contract, or explicit buying request rather than another supplier/i
    },
    {
      name: 'marketplace category request is not buyer-authored paid demand',
      canonicalized: true,
      caseIndex: 3,
      mutate(plans) {
        plans[0].query =
          'field service workflow software marketplace request';
      },
      reason: /buyer- or employer-authored compensated job, RFP, solicitation, contract, or explicit buying request rather than another supplier/i
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
      name: 'negated referral language is not a cash action',
      mutate(plans) {
        for (const action of plans[0].contingentFinalists.familyA.d.a) {
          action.l =
            'After review, do not ask {{TARGET_NAME}} to refer buyers to the paid booking.';
        }
      },
      reason: /primary_action_negated/i
    },
    {
      name: 'free referral booking is not a cash action',
      mutate(plans) {
        for (const action of plans[0].contingentFinalists.familyA.d.a) {
          action.l =
            'After review, ask {{TARGET_NAME}} to recommend one qualified family book a free consultation.';
        }
      },
      reason: /primary_action_(?:non_revenue|partner_referral)/i
    },
    {
      name: 'free workshop and class referrals are not cash actions',
      mutate(plans) {
        const actions = plans[0].contingentFinalists.familyA.d.a;
        actions[0].l =
          'After review via {{TARGET_URL}}, ask {{TARGET_NAME}} to recommend one family book a free workshop.';
        actions[1].l =
          'After review via {{TARGET_URL}}, ask {{TARGET_NAME}} to refer one family to book a free class.';
      },
      reason: /primary_action_non_revenue/i
    },
    {
      name: 'paid introduction without a paid offer or conversion is not a cash action',
      mutate(plans) {
        for (const action of plans[0].contingentFinalists.familyA.d.a) {
          action.l =
            'After review, ask {{TARGET_NAME}} for a paid introduction through {{TARGET_URL}}.';
        }
      },
      reason: /primary_action_(?:non_revenue|partner_referral)/i
    },
    {
      name: 'negated shared conversion action is not a causal cash path',
      mutate(plans) {
        for (const familyKey of ['familyA', 'familyB']) {
          plans[0].contingentFinalists[familyKey].d.r[0].c =
            'After review, do not ask {{TARGET_NAME}} to refer buyers to the paid booking.';
        }
      },
      reason: /conversion_action/i
    },
    {
      name: 'negated paid-demand response is not a cash action',
      caseIndex: 1,
      mutate(plans) {
        for (const action of plans[0].contingentFinalists.familyA.d.a) {
          action.l =
            'After review, submit to {{TARGET_NAME}} but not as a paid response to the RFP.';
        }
      },
      reason: /primary_action_negated/i
    },
    {
      name: 'negated buyer commitment is not a cash action',
      caseIndex: 3,
      mutate(plans) {
        for (const action of plans[1].contingentFinalists.familyA.d.a) {
          action.l =
            'After review, ask {{TARGET_NAME}} not to buy the paid subscription.';
        }
      },
      reason: /primary_action_negated/i
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
      reason: /private-contact data|causally advance acquisition/i
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
      name: 'unqualified introduction production regression',
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, ask {{TARGET_NAME}} for an introduction through {{TARGET_URL}}.';
      },
      reason: /primary_action_non_revenue.*causally advance acquisition/i
    },
    {
      name: 'article listing is not paid demand',
      caseIndex: 3,
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, list a paid industry article for {{TARGET_NAME}} on a marketplace.';
      },
      reason: /primary_action_non_revenue.*causally advance acquisition/i
    },
    {
      name: 'metrics listing is not paid demand',
      caseIndex: 3,
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, publish paid-booking metrics for {{TARGET_NAME}} on a platform.';
      },
      reason: /primary_action_non_revenue.*causally advance acquisition/i
    },
    {
      name: 'profile listing is not paid demand',
      caseIndex: 3,
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, list {{TARGET_NAME}} professional profile on a paid marketplace.';
      },
      reason: /primary_action_(?:non_revenue|operational)/i
    },
    {
      name: 'untyped paid listing target remains unsupported',
      caseIndex: 3,
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, list the current paid workflow-software subscription on {{TARGET_NAME}} marketplace.';
      },
      reason: /primary_action_non_revenue.*causally advance acquisition/i
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
      reason: /private-contact data|causally advance acquisition/i
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
    },
    {
      name: 'seller booking is not a paid-demand response',
      caseIndex: 2,
      mutate(plans) {
        plans[0].contingentFinalists.familyA.d.a[0].l =
          'After review, book one paid consultation with {{TARGET_NAME}}.';
      },
      reason: /primary_action_paid_demand_response/i
    }
  ];
  const semanticActionStartIndex = checks.findIndex((check) =>
    check.name === 'passive primary action drift'
  );
  for (const [checkIndex, check] of checks.entries()) {
    const scenarioPlans = cases[check.caseIndex || 0].plans(evidenceRef);
    const primaryIndex = check.fixtureIndex || 0;
    const plans = [
      scenarioPlans[primaryIndex],
      scenarioPlans.find((_, index) => index !== primaryIndex)
    ];
    for (const motion of plans) {
      motion.market = 'Queens, New York, United States';
    }
    const originalFamilyActions = plans[0].contingentFinalists
      .familyA.d.a.map((action) => action.l);
    check.mutate(plans);
    const semanticActionCheck = checkIndex >= semanticActionStartIndex;
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
    if (check.canonicalized) {
      if (result.status !== 'planned' ||
          result.plans.length !== 2 ||
          result.planSelection?.rejectedPlanCount !== 0 ||
          result.sideEffectsPerformed !== 0) {
        throw new Error(
          `${check.name} was not structurally canonicalized: ${JSON.stringify(result)}`
        );
      }
      continue;
    }
    const rejectedReasons = result.planSelection?.rejectedPlans
      ?.map((item) => item.reason).join(' ') || '';
    if (result.status !== 'planned' ||
        !expectedReason.test(rejectedReasons) ||
        result.plans.length !== 1 ||
        result.planSelection?.acceptedPlanCount !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${check.name} did not prune only the invalid motion: ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyPrivateContactBearingURLsFailClosed() {
  const variants = [
    {
      name: 'literal email',
      slug: 'literal-email',
      url: 'https://rfp.safe-example.com/open/person@example.com',
      privateValue: 'person@example.com'
    },
    {
      name: 'percent-encoded email',
      slug: 'encoded-email',
      url: 'https://rfp.safe-example.com/open/person%40example.com',
      privateValue: 'person@example.com'
    },
    {
      name: 'literal phone',
      slug: 'literal-phone',
      url: 'https://rfp.safe-example.com/open/917-555-0123',
      privateValue: '917-555-0123'
    },
    {
      name: 'percent-encoded phone',
      slug: 'encoded-phone',
      url:
        'https://rfp.safe-example.com/open/%39%31%37%2D%35%35%35%2D%30%31%32%33',
      privateValue: '917-555-0123'
    }
  ];
  const assertScrubbed = (value, variant, surface) => {
    const serialized = JSON.stringify(value).toLowerCase();
    const decodedURL = decodeURIComponent(variant.url);
    const forbiddenTokens = new Set([
      variant.url,
      decodedURL,
      variant.privateValue,
      variant.privateValue.replace(/\D/g, ''),
      variant.url.split('/').at(-1)
    ].filter((item) => item && item.length >= 7));
    for (const token of forbiddenTokens) {
      if (serialized.includes(token.toLowerCase())) {
        throw new Error(
          `${surface} retained ${variant.name} private contact URL data: ${serialized}`
        );
      }
    }
  };

  const scenario = cases[2];
  const planner = plannerJob(scenario);
  const catalog = buildEvidenceCatalog(planner.payload, {}, now, {
    includeSystemAttributionCapability: true
  });
  const evidenceRef = catalog.find((item) =>
    typeof item.id === 'string' && item.id.startsWith('observation:')
  )?.id;
  if (!evidenceRef) {
    throw new Error(
      'private-contact URL fixture produced no approved evidence id'
    );
  }
  const plannerPlans = () => {
    const primary = scenario.plans(evidenceRef)[0];
    primary.contingentFinalists = compactContingentFinalists(
      primary.contingentFinalists
    );
    return twoPlannerMotions(primary, evidenceRef);
  };
  const runPlanner = (annotations, generationId) =>
    runOpportunityDiscoveryPlanner({
      job: planner,
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => ({
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason:
            'Two bounded commercial motions grounded in approved evidence.',
          plans: plannerPlans()
        },
        usage,
        generationId,
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 900,
          contentSha256: '6'.repeat(64)
        },
        annotations
      })
    });

  const unsafeCitationPlan = await runPlanner(
    variants.map((variant) => ({
      type: 'url_citation',
      url_citation: {
        url: variant.url,
        title: 'Current public consulting request',
        content:
          'A current public request invites paid operations-consulting proposals.'
      }
    })),
    'generation-private-contact-url-citations'
  );
  if (unsafeCitationPlan.status !== 'planned' ||
      unsafeCitationPlan.plans.length !== 2 ||
      unsafeCitationPlan.webSearchReceipt?.annotations?.length !== 0 ||
      unsafeCitationPlan.webSearchReceipt?.resultCount !== 0 ||
      unsafeCitationPlan.sideEffectsPerformed !== 0) {
    throw new Error(
      `private-contact-bearing citations were not discarded: ${JSON.stringify(unsafeCitationPlan)}`
    );
  }
  for (const variant of variants) {
    assertScrubbed(unsafeCitationPlan, variant, 'citation normalization');
  }

  const safeURL =
    'https://rfp.safe-example.com/open-delivery-operations';
  const safePlan = await runPlanner([{
    type: 'url_citation',
    url_citation: {
      url: safeURL,
      title: 'Acme Services open delivery-operations RFP',
      content:
        'Acme Services currently invites paid delivery-operations consulting proposals through its official RFP page.'
    }
  }], 'generation-private-contact-url-safe-control');
  const selectedMotion = safePlan.plans.find((item) =>
    item.id === 'open_operations_solicitation'
  );
  if (safePlan.status !== 'planned' || !selectedMotion ||
      safePlan.webSearchReceipt?.provider !==
        'openrouter_exa_web_search' ||
      safePlan.webSearchReceipt?.operation !== 'forced_exa_web_search' ||
      safePlan.webSearchReceipt?.costIncludedInLLMReceipt !== true ||
      safePlan.webSearchReceipt?.annotations?.length !== 1 ||
      safePlan.webSearchReceipt?.annotations?.[0]?.url !== safeURL ||
      safePlan.sideEffectsPerformed !== 0) {
    throw new Error(
      `private-contact URL safe control did not plan: ${JSON.stringify(safePlan)}`
    );
  }

  const attempt = {
    id: 'attempt-private-contact-url-canonical-brave-search',
    provider: 'brave_web_search',
    operation: 'planned_brave_web_search',
    queryHash: 'b'.repeat(64),
    status: 'succeeded',
    estimatedSpendMicros: 5_000,
    actualSpendMicros: 5_000,
    creditsUsed: 1,
    resultCount: 1,
    reservedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: now.toISOString()
  };
  const discoveryEvidenceRef =
    'external_discovery:919191919191919191919191';
  const candidateID =
    'candidate:external:929292929292929292929292';
  const baseDiscoveryEvidence = {
    contractVersion: COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT,
    attempted: true,
    status: 'found',
    motion: selectedMotion.id,
    buyerArchetype: selectedMotion.buyer,
    queryHash: commercialDiscoveryAttemptLedgerHash([attempt]),
    market: selectedMotion.market,
    providersAttempted: ['brave_web_search'],
    providerCalls: 1,
    paidProviderCalls: 1,
    creditsUsed: 1,
    resultCount: 1,
    patientTargetingExcluded: true,
    sideEffectsPerformed: 0,
    attempts: [attempt],
    plan: {
      ...safePlan,
      plans: [selectedMotion]
    },
    evidence: [{
      motionId: selectedMotion.id,
      evidenceRef: discoveryEvidenceRef,
      kind: 'verified_external_live_demand',
      label: 'Acme Services open delivery-operations RFP',
      summary:
        `Acme Services currently requests paid delivery-operations consulting proposals through the official page at ${safeURL}.`,
      url: safeURL,
      provider: 'brave_web_search',
      provenance: 'read_only_professional_provider',
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
      observedAt: now.toISOString()
    }],
    candidates: [{
      motionId: selectedMotion.id,
      id: candidateID,
      kind: 'public_paid_demand_page',
      displayLabel: 'Acme Services',
      organization: 'Acme Services',
      role: 'Open delivery-operations consulting RFP',
      market: 'United States',
      publicUrl: safeURL,
      provider: 'brave_web_search',
      commercialRole: 'paid_demand',
      evidenceRefs: [discoveryEvidenceRef],
      contactPaths: [{
        kind: 'public_professional_url',
        available: true,
        verified: true,
        reference: safeURL
      }],
      exactNamedCandidate: true,
      identityResolved: true
    }],
    discoveredAt: now.toISOString()
  };
  const safeNormalized = normalizeCommercialDiscoveryEvidence(
    baseDiscoveryEvidence,
    now
  );
  if (safeNormalized.valid !== true ||
      safeNormalized.evidence.length !== 1 ||
      safeNormalized.candidates.length !== 1) {
    throw new Error(
      `private-contact URL safe discovery control was invalid: ${JSON.stringify(safeNormalized)}`
    );
  }

  for (const variant of variants) {
    const factValue = structuredClone(baseDiscoveryEvidence);
    factValue.evidence[0].url = variant.url;
    const normalizedFact = normalizeCommercialDiscoveryEvidence(
      factValue,
      now
    );
    if (normalizedFact.valid !== false ||
        normalizedFact.evidence.length !== 0 ||
        normalizedFact.candidates.length !== 0 ||
        !normalizedFact.rejectedReasons?.invalid_evidence) {
      throw new Error(
        `${variant.name} fact URL did not fail closed: ${JSON.stringify(normalizedFact)}`
      );
    }
    assertScrubbed(normalizedFact, variant, 'discovery fact normalization');

    const candidateValue = structuredClone(baseDiscoveryEvidence);
    candidateValue.candidates[0].publicUrl = variant.url;
    const normalizedCandidate = normalizeCommercialDiscoveryEvidence(
      candidateValue,
      now
    );
    if (normalizedCandidate.valid !== false ||
        normalizedCandidate.evidence.length !== 1 ||
        normalizedCandidate.candidates.length !== 0 ||
        !normalizedCandidate.rejectedReasons?.invalid_candidate) {
      throw new Error(
        `${variant.name} candidate URL did not fail closed: ${JSON.stringify(normalizedCandidate)}`
      );
    }
    assertScrubbed(
      normalizedCandidate,
      variant,
      'discovery candidate normalization'
    );

    const contactPathValue = structuredClone(baseDiscoveryEvidence);
    contactPathValue.candidates[0].contactPaths[0].reference =
      variant.url;
    const normalizedContactPath = normalizeCommercialDiscoveryEvidence(
      contactPathValue,
      now
    );
    if (normalizedContactPath.valid !== false ||
        normalizedContactPath.evidence.length !== 1 ||
        normalizedContactPath.candidates.length !== 0 ||
        !normalizedContactPath.rejectedReasons?.invalid_candidate) {
      throw new Error(
        `${variant.name} contact-path URL did not fail closed: ${JSON.stringify(normalizedContactPath)}`
      );
    }
    assertScrubbed(
      normalizedContactPath,
      variant,
      'contact-path normalization'
    );

    const bindingValue = structuredClone(baseDiscoveryEvidence);
    bindingValue.evidence[0].url = variant.url;
    bindingValue.candidates[0].publicUrl = variant.url;
    bindingValue.candidates[0].contactPaths[0].reference = variant.url;
    let criticCalls = 0;
    const result = await runOpportunityTournament({
      job: {
        id: `job-private-contact-binding-${variant.slug}`,
        kind: 'opportunity_tournament',
        payload: {
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
          commercialDiscoveryEvidence: bindingValue
        }
      },
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => {
        criticCalls += 1;
        throw new Error(
          `${variant.name} private-contact URL reached final binding`
        );
      }
    });
    assertTechnicalRecovery(
      result,
      criticCalls,
      `${variant.name} final-binding URL`
    );
    if (result.result?.resultType === 'immediate_revenue_action' ||
        result.status === 'completed') {
      throw new Error(
        `${variant.name} final-binding URL produced a revenue winner: ${JSON.stringify(result)}`
      );
    }
    assertScrubbed(result, variant, 'final binding');
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
        plans: twoPlannerMotions({
          ...typedScenarioMotion,
          contingentFinalists: compactContingentFinalists(
            typedScenarioMotion.contingentFinalists
          )
        }, evidenceRef)
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
  if (discoveryPlan.status !== 'planned' ||
      discoveryPlan.webSearchReceipt?.provider !==
        'openrouter_exa_web_search' ||
      discoveryPlan.webSearchReceipt?.operation !==
        'forced_exa_web_search' ||
      discoveryPlan.webSearchReceipt?.costIncludedInLLMReceipt !== true) {
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
  const foldedAttempt = {
    id: `discovery-openrouter-${discoveryPlan.webSearchReceipt.requestHash.slice(0, 20)}`,
    provider: 'openrouter_exa_web_search',
    operation: 'forced_exa_web_search',
    queryHash: discoveryPlan.webSearchReceipt.requestHash,
    status: 'not_found',
    estimatedSpendMicros: 5_000,
    actualSpendMicros: 0,
    costIncludedInLLMReceipt: true,
    includedSpendMicros: 5_000,
    creditsUsed: 1,
    resultCount: 0,
    reservedAt: discoveryPlan.webSearchReceipt.observedAt,
    updatedAt: discoveryPlan.webSearchReceipt.observedAt,
    completedAt: discoveryPlan.webSearchReceipt.observedAt
  };
  const braveAttempt = {
    id: 'attempt-two-stage-canonical-brave-search',
    provider: 'brave_web_search',
    operation: 'planned_brave_web_search',
    queryHash: 'c'.repeat(64),
    status: 'succeeded',
    estimatedSpendMicros: 5_000,
    actualSpendMicros: 5_000,
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
    commercialContext: {
      // Internal provider-attested review routes must never be accepted as a
      // configured user capability, even if a forged payload names one.
      allowedChannels: [
        'public_paid_demand_response',
        'forged public paid demand response capability',
        'public paid demand'
      ]
    },
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
        foldedAttempt,
        braveAttempt,
        pdlAttempt
      ]),
      market: selectedMotion.market,
      providersAttempted: [
        'openrouter_exa_web_search',
        'brave_web_search',
        'people_data_labs_person_search'
      ],
      providerCalls: 3,
      paidProviderCalls: 3,
      creditsUsed: 3,
      resultCount: 2,
      patientTargetingExcluded: true,
      sideEffectsPerformed: 0,
      attempts: [foldedAttempt, braveAttempt, pdlAttempt],
      plan: oneMotionDiscoveryPlan,
      evidence: [
        {
          motionId: selectedMotion.id,
          evidenceRef: organizationEvidenceRef,
          kind: 'verified_external_professional_target',
          label: 'Riverside Pediatrics newborn care',
          summary: 'Brave Web Search returned Riverside Pediatrics as an exact public pediatric practice in Queens from the canonical post-plan query. This independently validates the organization only and does not prove a relationship or permission.',
          url: 'https://riverside-pediatrics.example/newborn-care',
          provider: 'brave_web_search',
          provenance: 'read_only_professional_provider',
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
          provider: 'brave_web_search',
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
  const normalizedThreeAttemptEvidence =
    normalizeCommercialDiscoveryEvidence(
      downstreamPayload.commercialDiscoveryEvidence,
      now
    );
  if (normalizedThreeAttemptEvidence.valid !== true ||
      normalizedThreeAttemptEvidence.attempts.length !== 3 ||
      normalizedThreeAttemptEvidence.attempts.filter((attempt) =>
        attempt.costIncludedInLLMReceipt === true
      ).length !== 1) {
    throw new Error(
      `accounting-only Exa plus two canonical reads did not survive normalization: ${JSON.stringify(normalizedThreeAttemptEvidence)}`
    );
  }
  const thirdCanonicalAttempt = {
    ...braveAttempt,
    id: 'attempt-third-canonical-read-must-fail',
    queryHash: 'e'.repeat(64),
    status: 'not_found',
    resultCount: 0
  };
  const excessCanonicalEvidence = structuredClone(
    downstreamPayload.commercialDiscoveryEvidence
  );
  excessCanonicalEvidence.attempts = [
    thirdCanonicalAttempt,
    braveAttempt,
    pdlAttempt
  ];
  excessCanonicalEvidence.providersAttempted = [
    'brave_web_search',
    'people_data_labs_person_search'
  ];
  excessCanonicalEvidence.queryHash =
    commercialDiscoveryAttemptLedgerHash(
      excessCanonicalEvidence.attempts
    );
  const excessCanonicalNormalized = normalizeCommercialDiscoveryEvidence(
    excessCanonicalEvidence,
    now
  );
  if (excessCanonicalNormalized.valid !== false ||
      excessCanonicalNormalized.rejectedReasons
        ?.invalid_attempt_ledger !== 1) {
    throw new Error(
      `three canonical provider reads escaped the two-read cap: ${JSON.stringify(excessCanonicalNormalized)}`
    );
  }
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
          'revenue_causal_witness_v2' ||
        finalist.revenuePath?.causalWitness?.terminalOutcomeKind !==
          'paid_booking_terminal'
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
      )?.provider !== 'brave_web_search' ||
      !result.commercialEvidenceGraph?.nodes?.find((node) =>
        node.evidenceRef === evidenceRef
      )?.roles?.includes('defined_buyer') ||
      !result.winner?.action?.includes('Dr. Ava Rivera') ||
      !result.winner?.action?.includes(
        'https://www.linkedin.com/in/ava-rivera'
      ) ||
      !result.hypotheses?.[0]?.channel?.includes(
        'https://www.linkedin.com/in/ava-rivera'
      ) ||
      result.winner?.action?.includes('{{TARGET_NAME}}') ||
      result.winner?.candidateId !== targetCandidateId ||
      result.winner?.revenuePath?.causalWitness?.contractVersion !==
        'revenue_causal_witness_v2' ||
      result.winner?.revenuePath?.causalWitness?.terminalOutcomeKind !==
        'paid_booking_terminal' ||
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
        `After review via public professional profile {{TARGET_URL}}, use permissioned outreach to ask {{TARGET_NAME}} to refer one buyer to a paid booking (${familyName}-${index + 1}).`
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
  if (conflictingMode.searchSpace?.motionConflictCount < 1 &&
      !/primary_action_acquisition_mode/i.test(
        conflictingMode.searchSpace?.contingentFinalists?.reason || ''
      )) {
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
  firstMotion.priority = 1;
  const secondMotion = structuredClone(selectedMotion);
  secondMotion.priority = 2;
  multiMotionPayload.commercialDiscoveryEvidence.plan =
    {
      ...structuredClone(discoveryPlan),
      plans: [firstMotion, secondMotion]
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
    url: 'https://www.linkedin.com/in/noor-patel-pediatrics',
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
    publicUrl: 'https://www.linkedin.com/in/noor-patel-pediatrics',
    provider: 'people_data_labs_person_search',
    evidenceRefs: [firstEvidenceRef],
    contactPaths: [{
      kind: 'public_professional_url',
      available: true,
      verified: true,
      reference: 'https://www.linkedin.com/in/noor-patel-pediatrics'
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

  const referralRouteMismatchPayload = structuredClone(downstreamPayload);
  for (const [familyIndex, familyKey] of
    ['familyA', 'familyB'].entries()) {
    const family = referralRouteMismatchPayload
      .commercialDiscoveryEvidence.plan.plans[0]
      .contingentFinalists[familyKey];
    family.d.c = family.d.c.map((item, index) => ({
      ...item,
      l:
        `Partner referral via {{TARGET_NAME}} (${familyIndex + 1}-${index + 1})`
    }));
  }
  let referralRouteMismatchCalls = 0;
  const referralRouteMismatch = await runOpportunityTournament({
    job: {
      id: 'job-referral-route-omits-verified-profile',
      kind: 'opportunity_tournament',
      payload: referralRouteMismatchPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      referralRouteMismatchCalls += 1;
      const task = JSON.parse(request.user || '{}');
      return acceptedCriticCompletion(
        task.finalists || [],
        'generation-referral-route-omits-verified-profile'
      );
    }
  });
  if (referralRouteMismatchCalls > 1 ||
      referralRouteMismatch.status === 'completed' ||
      referralRouteMismatch.result?.resultType ===
        'immediate_revenue_action' ||
      referralRouteMismatch.result?.allowedChannel === 'partner_channel' ||
      referralRouteMismatch.result?.incrementalRevenueGate?.passed === true) {
    throw new Error(
      `referral route without the verified profile became actionable: ${JSON.stringify({ calls: referralRouteMismatchCalls, result: referralRouteMismatch })}`
    );
  }
}

async function verifyProviderAttestedBuyerReviewRoute() {
  const scenario = cases[3];
  const planner = plannerJob(scenario);
  planner.payload.evidenceSnapshot.profile.identity.website =
    'https://owner.example/';
  planner.payload.evidenceSnapshot.sourceEvidence[0].summary =
    'The owner website offers a current paid email-marketing and phone-consultation subscription with pricing and a signup page where field-service teams can subscribe and pay.';
  const catalog = buildEvidenceCatalog(planner.payload, {}, now, {
    includeSystemAttributionCapability: true
  });
  const sellerEvidenceRef = catalog.find((item) =>
    typeof item.id === 'string' && item.id.startsWith('observation:')
  )?.id;
  if (!sellerEvidenceRef) {
    throw new Error('provider-attested buyer fixture has no seller evidence');
  }
  const stripTargetEvidence = (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => item === 'target:evidence'
        ? []
        : [stripTargetEvidence(item)]);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        stripTargetEvidence(item)
      ]));
    }
    return value;
  };
  const replaceOfferText = (value) => {
    if (typeof value === 'string') {
      return value.replaceAll(
        'Paid workflow-software subscription',
        'Paid email-marketing and phone-consultation subscription'
      );
    }
    if (Array.isArray(value)) return value.map(replaceOfferText);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        replaceOfferText(item)
      ]));
    }
    return value;
  };
  const rawMotion = replaceOfferText(
    scenario.plans(sellerEvidenceRef)[1]
  );
  rawMotion.targetSlot.requiredEvidenceRoles = ['defined_buyer'];
  rawMotion.contingentFinalists = stripTargetEvidence(
    rawMotion.contingentFinalists
  );
  const discoveryPlan = await runOpportunityDiscoveryPlanner({
    job: planner,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'One exact outside buyer search is source-bindable.',
        plans: twoPlannerMotions({
          ...rawMotion,
          contingentFinalists: compactContingentFinalists(
            rawMotion.contingentFinalists
          )
        }, sellerEvidenceRef)
      },
      usage,
      generationId: 'generation-provider-attested-buyer-planner',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 900,
        contentSha256: '4'.repeat(64)
      },
      annotations: []
    })
  });
  const selectedMotion = discoveryPlan.plans[0];
  const buyerRoles = ['acquisition', 'channel_fit', 'defined_buyer'];
  const buyerProtocolRestored = ['familyA', 'familyB'].every((familyKey) => {
    const family = selectedMotion?.contingentFinalists?.[familyKey];
    const revenue = family?.d?.r?.[0];
    return family?.e?.includes('target:evidence') &&
      family.d.b.every((item) => item.e.includes('target:evidence')) &&
      family.d.c.every((item) => item.e.includes('target:evidence')) &&
      family.d.o.every((item) => !item.e.includes('target:evidence')) &&
      revenue.g.b.includes('target:evidence') &&
      revenue.g.a.includes('target:evidence') &&
      !revenue.g.o.includes('target:evidence') &&
      !revenue.g.d.e.includes('target:evidence') &&
      !revenue.g.c.includes('target:evidence');
  });
  if (discoveryPlan.status !== 'planned' ||
      !selectedMotion ||
      selectedMotion.commercialRole !== 'buyer' ||
      selectedMotion.acquisitionMode !== 'permissioned_outreach' ||
      JSON.stringify(selectedMotion.targetSlot?.requiredEvidenceRoles) !==
        JSON.stringify(buyerRoles) ||
      !buyerProtocolRestored) {
    throw new Error(
      `buyer target protocol was not restored: ${JSON.stringify(discoveryPlan)}`
    );
  }

  const attempt = {
    id: 'attempt-provider-attested-buyer-search',
    provider: 'people_data_labs_person_search',
    operation: 'planned_professional_search',
    queryHash: 'a'.repeat(64),
    status: 'succeeded',
    estimatedSpendMicros: 280_000,
    actualSpendMicros: 280_000,
    creditsUsed: 1,
    resultCount: 1,
    reservedAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-08-01T12:00:01Z',
    completedAt: '2026-08-01T12:00:01Z'
  };
  const buyerEvidenceRef =
    'external_discovery:777777777777777777777777';
  const buyerCandidateId =
    'candidate:external:888888888888888888888888';
  const buyerPublicUrl =
    'https://www.linkedin.com/in/jordan-lee-operations';
  const commercialDiscoveryEvidence = {
    contractVersion: COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT,
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
    plan: {
      ...discoveryPlan,
      plans: [selectedMotion]
    },
    evidence: [{
      motionId: selectedMotion.id,
      evidenceRef: buyerEvidenceRef,
      kind: 'verified_external_professional_target',
      label:
        'Jordan Lee — Operations Director at Northstar Field Services',
      summary:
        'People Data Labs returned Jordan Lee as a current Operations Director at Northstar Field Services in the United States. This exact public professional record supports a review-first buyer route only and does not prove interest, permission, or demand.',
      url: buyerPublicUrl,
      provider: 'people_data_labs_person_search',
      provenance: 'people_data_labs_professional_record',
      roles: buyerRoles,
      verified: true,
      observedAt: '2026-08-01T12:00:01Z'
    }],
    candidates: [{
      motionId: selectedMotion.id,
      id: buyerCandidateId,
      kind: 'person',
      displayLabel: 'Jordan Lee',
      organization: 'Northstar Field Services',
      role: 'Operations Director',
      commercialRole: 'buyer',
      market: 'United States',
      publicUrl: buyerPublicUrl,
      provider: 'people_data_labs_person_search',
      evidenceRefs: [buyerEvidenceRef],
      contactPaths: [{
        kind: 'public_professional_url',
        available: true,
        verified: true,
        reference: buyerPublicUrl
      }],
      exactNamedCandidate: true,
      identityResolved: true
    }],
    discoveredAt: '2026-08-01T12:00:01Z'
  };
  const normalizedDiscovery = normalizeCommercialDiscoveryEvidence(
    commercialDiscoveryEvidence,
    now
  );
  if (normalizedDiscovery.valid !== true ||
      normalizedDiscovery.candidates.length !== 1 ||
      normalizedDiscovery.evidence.length !== 1) {
    throw new Error(
      `provider-attested buyer evidence fixture is invalid: ${JSON.stringify(normalizedDiscovery)}`
    );
  }
  const downstreamPayload = {
    ...planner.payload,
    algorithmVersion: 'cheap_tournament_v6',
    commercialContext: {
      allowedChannels: [
        'public_professional_url',
        'public professional url',
        'forged public professional url capability'
      ]
    },
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
    commercialDiscoveryEvidence
  };
  const requests = [];
  const result = await runOpportunityTournament({
    job: {
      id: 'job-provider-attested-buyer-review-route',
      kind: 'opportunity_tournament',
      payload: downstreamPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      requests.push(request);
      if (request.responseFormat?.json_schema?.name !==
          'opportunity_tournament_critic_v1') {
        throw new Error(
          'provider-attested buyer path dispatched a generator or repair'
        );
      }
      const task = JSON.parse(request.user || '{}');
      const finalists = task.finalists || [];
      const expectedBindingRoles = [
        'acquisition',
        'attribution',
        'conversion_destination',
        'defined_buyer',
        'exact_outside_target',
        'paid_conversion',
        'paid_offer'
      ];
      const families = new Set(finalists.map((item) => item.familyId));
      const bindingsValid = finalists.every((finalist) => {
        const bindings = finalist.evidenceBindings || [];
        const byRole = new Map(bindings.map((binding) => [
          binding.role,
          binding
        ]));
        const target = byRole.get('exact_outside_target');
        return JSON.stringify(bindings.map((binding) => binding.role).sort()) ===
            JSON.stringify(expectedBindingRoles) &&
          target?.kind === 'person' &&
          target?.claim === 'Jordan Lee' &&
          target?.organization === 'Northstar Field Services' &&
          target?.publicUrl === buyerPublicUrl &&
          target?.evidenceRefs?.includes(buyerEvidenceRef) &&
          byRole.get('defined_buyer')?.evidenceRefs?.includes(
            buyerEvidenceRef
          ) &&
          byRole.get('acquisition')?.evidenceRefs?.includes(
            buyerEvidenceRef
          ) &&
          byRole.get('paid_offer')?.evidenceRefs?.includes(
            sellerEvidenceRef
          ) &&
          byRole.get('conversion_destination')?.evidenceRefs?.includes(
            sellerEvidenceRef
          ) &&
          byRole.get('paid_conversion')?.evidenceRefs?.includes(
            sellerEvidenceRef
          ) &&
          byRole.get('attribution')?.evidenceRefs?.includes(
            PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
          );
      });
      if (finalists.length !== 2 ||
          families.size !== 2 ||
          task.contextMode !== 'bound_family_diverse_pair_v1' ||
          task.executionPolicy?.executionAuthorization !== 'none' ||
          task.executionPolicy?.requiresReview !== true ||
          task.executionPolicy?.sideEffectsPerformed !== 0 ||
          task.commercialContext?.allowedChannels?.length !== 0 ||
          !bindingsValid) {
        throw new Error(
          `critic received an unsafe or incomplete buyer route: ${JSON.stringify(task)}`
        );
      }
      return acceptedCriticCompletion(
        finalists,
        'generation-provider-attested-buyer-critic'
      );
    }
  });
  if (requests.length !== 1 ||
      result.status !== 'completed' ||
      result.usage?.calls !== 1 ||
      result.searchSpace?.modelCalls !== 1 ||
      result.winner?.candidateId !== buyerCandidateId ||
      !result.winner?.action?.includes('Jordan Lee') ||
      !result.winner?.action?.includes(buyerPublicUrl) ||
      !result.hypotheses?.[0]?.channel?.includes(buyerPublicUrl) ||
      result.result?.resultType !== 'immediate_revenue_action' ||
      result.result?.incrementalRevenueGate?.passed !== true ||
      result.result?.incrementalRevenueGate?.allowedChannelSource !==
        'provider_attested_review_route' ||
      result.result?.allowedChannel !== 'public_professional_url' ||
      result.result?.incrementalRevenueGate
        ?.discoveryRouteRequiresApproval !== true ||
      result.result?.permissionRequired !== 'explicit_user_approval' ||
      result.result?.executionAuthorization !== 'none' ||
      result.result?.requiresReview !== true ||
      result.result?.sideEffectsPerformed !== 0 ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `provider-attested buyer route did not complete safely: ${JSON.stringify({ requests: requests.length, result })}`
    );
  }

  const publicMessagePayload = structuredClone(downstreamPayload);
  const publicMessageMotion =
    publicMessagePayload.commercialDiscoveryEvidence.plan.plans[0];
  for (const [familyIndex, familyKey] of
    ['familyA', 'familyB'].entries()) {
    for (const dimension of ['c', 'a']) {
      publicMessageMotion.contingentFinalists[familyKey].d[dimension] =
        publicMessageMotion.contingentFinalists[familyKey].d[dimension]
          .map((item, index) => ({
            ...item,
            l:
              `After review, send a LinkedIn message via {{TARGET_URL}} asking {{TARGET_NAME}} to buy the paid workflow subscription (${familyIndex + 1}-${index + 1}).`
          }));
    }
  }
  let publicMessageCalls = 0;
  const publicMessage = await runOpportunityTournament({
    job: {
      id: 'job-bound-public-profile-message-route',
      kind: 'opportunity_tournament',
      payload: publicMessagePayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      publicMessageCalls += 1;
      const task = JSON.parse(request.user || '{}');
      return acceptedCriticCompletion(
        task.finalists || [],
        'generation-bound-public-profile-message-critic'
      );
    }
  });
  if (publicMessageCalls !== 1 ||
      publicMessage.status !== 'completed' ||
      publicMessage.result?.resultType !== 'immediate_revenue_action' ||
      publicMessage.result?.incrementalRevenueGate?.passed !== true ||
      publicMessage.result?.allowedChannel !== 'public_professional_url' ||
      publicMessage.result?.executionAuthorization !== 'none' ||
      publicMessage.result?.requiresReview !== true ||
      publicMessage.result?.sideEffectsPerformed !== 0 ||
      !publicMessage.winner?.action?.includes(buyerPublicUrl) ||
      publicMessage.gate?.sideEffects?.outreachAttempts !== 0 ||
      publicMessage.gate?.sideEffects?.publishAttempts !== 0 ||
      publicMessage.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `review-first message failed after exact public-profile binding: ${JSON.stringify({ calls: publicMessageCalls, result: publicMessage })}`
    );
  }

  const incompletePayload = structuredClone(downstreamPayload);
  incompletePayload.commercialDiscoveryEvidence.evidence[0].roles = [
    'acquisition',
    'defined_buyer'
  ];
  const incompleteDiscovery = normalizeCommercialDiscoveryEvidence(
    incompletePayload.commercialDiscoveryEvidence,
    now
  );
  if (incompleteDiscovery.valid !== false ||
      incompleteDiscovery.candidates.length !== 0) {
    throw new Error(
      `incomplete buyer route was unexpectedly provider-bound: ${JSON.stringify(incompleteDiscovery)}`
    );
  }
  let incompleteCalls = 0;
  const incomplete = await runOpportunityTournament({
    job: {
      id: 'job-forged-configured-buyer-route',
      kind: 'opportunity_tournament',
      payload: incompletePayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => {
      incompleteCalls += 1;
      throw new Error('incomplete buyer route dispatched the critic');
    }
  });
  assertTechnicalRecovery(
    incomplete,
    incompleteCalls,
    'configured buyer route without complete provider roles'
  );
  if (incomplete.result?.allowedChannel === 'public_professional_url') {
    throw new Error(
      `configured buyer-route alias minted provider authority: ${JSON.stringify(incomplete.result)}`
    );
  }

  const routeAttestationChecks = [
    {
      label: 'company article URL',
      mutate(payload) {
        const companyURL =
          'https://northstar.example/company/jordan-lee-article';
        payload.commercialDiscoveryEvidence.evidence[0].url = companyURL;
        payload.commercialDiscoveryEvidence.candidates[0].publicUrl =
          companyURL;
        payload.commercialDiscoveryEvidence.candidates[0]
          .contactPaths[0].reference = companyURL;
      }
    },
    {
      label: 'missing professional path',
      mutate(payload) {
        payload.commercialDiscoveryEvidence.candidates[0].contactPaths = [];
      }
    },
    {
      label: 'unavailable professional path',
      mutate(payload) {
        payload.commercialDiscoveryEvidence.candidates[0]
          .contactPaths[0].available = false;
      }
    },
    {
      label: 'unverified professional path',
      mutate(payload) {
        payload.commercialDiscoveryEvidence.candidates[0]
          .contactPaths[0].verified = false;
      }
    },
    {
      label: 'mismatched professional path',
      mutate(payload) {
        payload.commercialDiscoveryEvidence.candidates[0]
          .contactPaths[0].reference =
            'https://www.linkedin.com/in/not-jordan-lee';
      }
    },
    {
      label: 'professional path with query collision',
      mutate(payload) {
        const queryURL = `${buyerPublicUrl}?trk=forged`;
        payload.commercialDiscoveryEvidence.evidence[0].url = queryURL;
        payload.commercialDiscoveryEvidence.candidates[0].publicUrl =
          queryURL;
        payload.commercialDiscoveryEvidence.candidates[0]
          .contactPaths[0].reference = queryURL;
      }
    },
    {
      label: 'non-person buyer target',
      mutate(payload) {
        payload.commercialDiscoveryEvidence.candidates[0].kind =
          'organization';
      }
    }
  ];
  for (const check of routeAttestationChecks) {
    const payload = structuredClone(downstreamPayload);
    check.mutate(payload);
    const normalized = normalizeCommercialDiscoveryEvidence(
      payload.commercialDiscoveryEvidence,
      now
    );
    if (normalized.valid !== false ||
        normalized.candidates.length !== 0) {
      throw new Error(
        `${check.label} buyer route retained reachability: ${JSON.stringify(normalized)}`
      );
    }
    let calls = 0;
    const rejected = await runOpportunityTournament({
      job: {
        id: `job-buyer-route-${check.label.replace(/\W+/g, '-')}`,
        kind: 'opportunity_tournament',
        payload
      },
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async () => {
        calls += 1;
        throw new Error(`${check.label} dispatched the critic`);
      }
    });
    assertTechnicalRecovery(rejected, calls, check.label);
  }

  const routeTextChecks = [
    {
      label: 'channel omits verified profile route',
      mutate(motion) {
        for (const [familyIndex, familyKey] of
          ['familyA', 'familyB'].entries()) {
          motion.contingentFinalists[familyKey].d.c =
            motion.contingentFinalists[familyKey].d.c.map(
              (item, index) => ({
                ...item,
                l: `Permissioned outreach to {{TARGET_NAME}} (${familyIndex + 1}-${index + 1})`
              })
            );
        }
      }
    },
    {
      label: 'action omits verified profile route',
      mutate(motion) {
        for (const [familyIndex, familyKey] of
          ['familyA', 'familyB'].entries()) {
          motion.contingentFinalists[familyKey].d.a =
            motion.contingentFinalists[familyKey].d.a.map(
              (item, index) => ({
                ...item,
                l: `After review, route ${familyIndex + 1}-${index + 1}: use permissioned outreach to offer a paid workflow subscription to {{TARGET_NAME}}.`
              })
            );
        }
      }
    },
    {
      label: 'action invents email proposal route',
      mutate(motion) {
        for (const [familyIndex, familyKey] of
          ['familyA', 'familyB'].entries()) {
          motion.contingentFinalists[familyKey].d.a =
            motion.contingentFinalists[familyKey].d.a.map(
              (item, index) => ({
                ...item,
                l: `After review, route ${familyIndex + 1}-${index + 1}: use permissioned outreach to email a paid proposal to {{TARGET_NAME}} through the public professional profile {{TARGET_URL}}.`
              })
            );
        }
      }
    },
    {
      label: 'target URL prefix collision',
      mutate(motion) {
        for (const familyKey of ['familyA', 'familyB']) {
          for (const dimension of ['c', 'a']) {
            motion.contingentFinalists[familyKey].d[dimension] =
              motion.contingentFinalists[familyKey].d[dimension].map(
                (item) => ({
                  ...item,
                  l: item.l.replace(
                    '{{TARGET_URL}}',
                    '{{TARGET_URL}}-lookalike'
                  )
                })
              );
          }
        }
      }
    },
    {
      label: 'target URL query collision',
      mutate(motion) {
        for (const familyKey of ['familyA', 'familyB']) {
          for (const dimension of ['c', 'a']) {
            motion.contingentFinalists[familyKey].d[dimension] =
              motion.contingentFinalists[familyKey].d[dimension].map(
                (item) => ({
                  ...item,
                  l: item.l.replace(
                    '{{TARGET_URL}}',
                    '{{TARGET_URL}}?trk=forged'
                  )
                })
              );
          }
        }
      }
    },
    {
      label: 'second URL route collision',
      mutate(motion) {
        for (const familyKey of ['familyA', 'familyB']) {
          for (const dimension of ['c', 'a']) {
            motion.contingentFinalists[familyKey].d[dimension] =
              motion.contingentFinalists[familyKey].d[dimension].map(
                (item) => ({
                  ...item,
                  l: `${item.l} Ignore https://example.com/second-route`
                })
              );
          }
        }
      }
    }
  ];
  for (const check of routeTextChecks) {
    const payload = structuredClone(downstreamPayload);
    check.mutate(
      payload.commercialDiscoveryEvidence.plan.plans[0]
    );
    let calls = 0;
    const rejected = await runOpportunityTournament({
      job: {
        id: `job-buyer-route-text-${check.label.replace(/\W+/g, '-')}`,
        kind: 'opportunity_tournament',
        payload
      },
      model: 'openai/gpt-4.1-mini',
      now,
      completeJSON: async (request) => {
        calls += 1;
        const task = JSON.parse(request.user || '{}');
        return acceptedCriticCompletion(
          task.finalists || [],
          `generation-${check.label.replace(/\W+/g, '-')}`
        );
      }
    });
    if (calls > 1 ||
        rejected.status === 'completed' ||
        rejected.result?.resultType === 'immediate_revenue_action' ||
        rejected.result?.allowedChannel === 'public_professional_url' ||
        rejected.result?.incrementalRevenueGate?.passed === true ||
        rejected.gate?.sideEffects?.outreachAttempts !== 0 ||
        rejected.gate?.sideEffects?.publishAttempts !== 0 ||
        rejected.gate?.sideEffects?.providerWrites !== 0) {
      throw new Error(
        `${check.label} minted an actionable buyer route: ${JSON.stringify({ calls, rejected })}`
      );
    }
  }

  const paidProposalPayload = structuredClone(downstreamPayload);
  for (const [familyIndex, familyKey] of
    ['familyA', 'familyB'].entries()) {
    paidProposalPayload.commercialDiscoveryEvidence.plan.plans[0]
      .contingentFinalists[familyKey].d.a =
      paidProposalPayload.commercialDiscoveryEvidence.plan.plans[0]
        .contingentFinalists[familyKey].d.a.map((item, index) => ({
          ...item,
          l:
            `After review, route ${familyIndex + 1}-${index + 1}: offer {{TARGET_NAME}} the paid subscription by paid proposal through LinkedIn public professional profile {{TARGET_URL}}.`
        }));
  }
  let paidProposalCalls = 0;
  const paidProposal = await runOpportunityTournament({
    job: {
      id: 'job-provider-attested-paid-proposal-route',
      kind: 'opportunity_tournament',
      payload: paidProposalPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      paidProposalCalls += 1;
      const task = JSON.parse(request.user || '{}');
      return acceptedCriticCompletion(
        task.finalists || [],
        'generation-provider-attested-paid-proposal-critic'
      );
    }
  });
  if (paidProposalCalls !== 1 ||
      paidProposal.status !== 'completed' ||
      paidProposal.result?.resultType !== 'immediate_revenue_action' ||
      paidProposal.result?.incrementalRevenueGate?.passed !== true ||
      paidProposal.result?.allowedChannel !== 'public_professional_url' ||
      paidProposal.result?.executionAuthorization !== 'none' ||
      paidProposal.result?.requiresReview !== true ||
      paidProposal.result?.sideEffectsPerformed !== 0 ||
      !paidProposal.winner?.action?.includes('paid proposal') ||
      paidProposal.gate?.sideEffects?.outreachAttempts !== 0 ||
      paidProposal.gate?.sideEffects?.publishAttempts !== 0 ||
      paidProposal.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `legitimate public-profile paid proposal did not complete safely: ${JSON.stringify({ calls: paidProposalCalls, result: paidProposal })}`
    );
  }
}

async function verifyPaidDemandTargetProtocolEndToEnd() {
  const scenario = cases[2];
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
    acquisitionMode: 'permissioned_outreach',
    acquisitionMechanism:
      'One review-first response to a current paid consulting RFP'
  });
  for (const familyKey of ['familyA', 'familyB']) {
    const family = motion.contingentFinalists[familyKey];
    family.d.c = family.d.c.map((item, index) => ({
      ...item,
      l:
        `Permissioned proposal to the public RFP at {{TARGET_NAME}} (route ${index + 1})`
    }));
    family.d.a = family.d.a.map((item, index) => ({
      ...item,
      l:
        `After review, submit one paid consulting proposal to {{TARGET_NAME}} (${familyKey} route ${index + 1}).`
    }));
    family.d.r[0].c =
      'After review, submit one permissioned paid consulting proposal to the public RFP at {{TARGET_NAME}} through the official proposal page.';
    family.d.r[0].cd =
      'The official RFP proposal page at {{TARGET_URL}}';
    family.d.r[0].g.d.l = family.d.r[0].cd;
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
  motion.targetSlot.finalTargetKind = 'person';
  motion.targetSlot.resolutionStrategy =
    'organization_then_decision_maker';
  const demandURL =
    'https://rfp.acme.example/open-delivery-operations';
  const discoveryPlan = await runOpportunityDiscoveryPlanner({
    job: planner,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: 'One current paid consulting RFP is the nearest paid path.',
        plans: twoPlannerMotions({
          ...motion,
          contingentFinalists: compactContingentFinalists(
            motion.contingentFinalists
          )
        }, evidenceRef)
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
          url: demandURL,
          title: 'Acme Services open delivery-operations RFP',
          content:
            'Acme Services currently invites paid delivery-operations consulting proposals through its official RFP proposal page.'
        }
      }]
    })
  });
  if (discoveryPlan.status !== 'planned' ||
      discoveryPlan.webSearchReceipt?.provider !==
        'openrouter_exa_web_search' ||
      discoveryPlan.webSearchReceipt?.operation !==
        'forced_exa_web_search' ||
      discoveryPlan.webSearchReceipt?.costIncludedInLLMReceipt !== true ||
      discoveryPlan.plans[0]?.searchMode !== 'public_live_demand' ||
      discoveryPlan.plans[0]?.targetSlot?.finalTargetKind !==
        'live_paid_demand' ||
      discoveryPlan.plans[0]?.targetSlot?.resolutionStrategy !==
        'single_exact_target') {
    throw new Error(
      `paid-demand omitted-target planner failed: ${JSON.stringify(discoveryPlan)}`
    );
  }
  const selectedMotion = structuredClone(discoveryPlan.plans[0]);
  const attempt = {
    id: 'attempt-paid-demand-canonical-brave-search',
    provider: 'brave_web_search',
    operation: 'planned_brave_web_search',
    queryHash: 'e'.repeat(64),
    status: 'succeeded',
    estimatedSpendMicros: 5_000,
    actualSpendMicros: 5_000,
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
      providersAttempted: ['brave_web_search'],
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
        label: 'Acme Services open delivery-operations RFP',
        summary:
          `Acme Services currently requests paid delivery-operations consulting proposals. Inbound platform discovery reaches the official proposal page at ${demandURL}. One accepted proposal can produce a signed paid consulting contract and invoice.`,
        url: demandURL,
        provider: 'brave_web_search',
        provenance: 'read_only_professional_provider',
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
        kind: 'public_paid_demand_page',
        // The organization suffix exercises the generic kind-normalization
        // heuristic. Provider-attested paid demand must retain its canonical
        // page kind instead of being retyped as an organization.
        displayLabel: 'Acme Services',
        organization: 'Acme Services',
        role: 'Open delivery-operations consulting RFP',
        market: 'United States',
        publicUrl: demandURL,
        provider: 'brave_web_search',
        commercialRole: 'paid_demand',
        evidenceRefs: [jobEvidenceRef],
        contactPaths: [{
          kind: 'public_professional_url',
          available: true,
          verified: true,
          reference: demandURL
        }],
        exactNamedCandidate: true,
        identityResolved: true
      }],
      discoveredAt: '2026-08-01T12:00:00Z'
    }
  };

  const remoteEvidencePayload = structuredClone(
    downstreamPayload.commercialDiscoveryEvidence
  );
  remoteEvidencePayload.market = 'Remote, United States';
  remoteEvidencePayload.plan.plans[0].market =
    'Remote, United States';
  remoteEvidencePayload.candidates[0].market = 'Remote, New York';
  remoteEvidencePayload.evidence[0].summary +=
    ' This is a fully remote engagement open to consultants located in New York.';
  const normalizedRemoteEvidence = normalizeCommercialDiscoveryEvidence(
    remoteEvidencePayload,
    now
  );
  if (normalizedRemoteEvidence.valid !== true ||
      normalizedRemoteEvidence.candidates.length !== 1) {
    throw new Error(
      `affirmative remote provider evidence with an implied home country was rejected: ${JSON.stringify(normalizedRemoteEvidence)}`
    );
  }

  for (const [index, mutateRemoteEvidence] of [
    (payload) => {
      payload.evidence[0].summary =
        downstreamPayload.commercialDiscoveryEvidence.evidence[0].summary;
    },
    (payload) => {
      payload.evidence[0].summary +=
        ' This role is not remote and virtual work is unavailable in the United States.';
    },
    (payload) => {
      payload.candidates[0].market = 'Remote, Ontario, Canada';
      payload.evidence[0].summary =
        `${downstreamPayload.commercialDiscoveryEvidence.evidence[0].summary} This is a remote engagement open only in Ontario, Canada.`;
    }
  ].entries()) {
    const invalidRemoteEvidence = structuredClone(remoteEvidencePayload);
    mutateRemoteEvidence(invalidRemoteEvidence);
    const normalized = normalizeCommercialDiscoveryEvidence(
      invalidRemoteEvidence,
      now
    );
    if (normalized.valid !== false ||
        normalized.rejectedReasons?.invalid_candidate !== 1) {
      throw new Error(
        `unsupported remote provider binding ${index + 1} was accepted: ${JSON.stringify(normalized)}`
      );
    }
  }

  const unverifiedLiveDemandPayload = structuredClone(downstreamPayload);
  unverifiedLiveDemandPayload.commercialDiscoveryEvidence.evidence[0].kind =
    'verified_external_professional_identity';
  let unverifiedLiveDemandCalls = 0;
  const unverifiedLiveDemand = await runOpportunityTournament({
    job: {
      id: 'job-paid-demand-without-live-demand-fact',
      kind: 'opportunity_tournament',
      payload: unverifiedLiveDemandPayload
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async () => {
      unverifiedLiveDemandCalls += 1;
      throw new Error(
        'unverified live-demand candidate dispatched the critic'
      );
    }
  });
  assertTechnicalRecovery(
    unverifiedLiveDemand,
    unverifiedLiveDemandCalls,
    'paid-demand target without a verified external live-demand fact'
  );
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
          task.commercialContext?.allowedChannels?.length !== 0 ||
          request.maxTokens !== 1_200 ||
          requestBytes > 36 * 1_024 ||
          finalists.some((finalist) =>
            finalist.evidenceBindings?.length !== 7 ||
            finalist.evidenceBindings?.find((binding) =>
              binding.role === 'exact_outside_target'
            )?.kind !== 'public_paid_demand_page'
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
      result.result?.incrementalRevenueGate?.allowedChannelSource !==
        'provider_attested_review_route' ||
      result.result?.allowedChannel !==
        'public_paid_demand_response' ||
      result.result?.permissionRequired !== 'explicit_user_approval' ||
      result.result?.executionAuthorization !== 'none' ||
      result.result?.sideEffectsPerformed !== 0 ||
      result.winner?.candidateId !== candidateID ||
      result.candidates?.find((candidate) =>
        candidate.id === candidateID
      )?.kind !== 'public_paid_demand_page' ||
      !result.winner?.action?.includes(
        'Acme Services'
      ) ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `paid-demand target protocol did not survive provider binding and critic: ${JSON.stringify({ criticIssue, requests: requests.length, result })}`
    );
  }

  let oneAcceptedCriticCalls = 0;
  const oneAccepted = await runOpportunityTournament({
    job: {
      id: 'job-paid-demand-one-critic-accepted',
      kind: 'opportunity_tournament',
      payload: structuredClone(downstreamPayload)
    },
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      oneAcceptedCriticCalls += 1;
      const task = JSON.parse(request.user || '{}');
      const completion = acceptedCriticCompletion(
        task.finalists || [],
        'generation-paid-demand-one-critic-accepted'
      );
      const rejected = completion.data.comparisons[1];
      rejected.verdict = 'reject';
      rejected.activeRevenueAction = false;
      rejected.causalAcquisitionPath = false;
      rejected.incrementalRevenueOutcome = false;
      rejected.reasonCode = 'unsupported_evidence';
      rejected.reason =
        'The runner-up is weaker and is not accepted as actionable.';
      return completion;
    }
  });
  const oneAcceptedCritic = oneAccepted.searchSpace?.commercialCritic;
  if (oneAcceptedCriticCalls !== 1 ||
      oneAccepted.status !== 'completed' ||
      oneAccepted.result?.resultType !== 'immediate_revenue_action' ||
      oneAccepted.hypotheses?.length !== 2 ||
      oneAccepted.searchSpace?.retainedCount !==
        oneAccepted.hypotheses?.length ||
      oneAccepted.hypotheses?.[0]?.status !== 'winner' ||
      oneAccepted.hypotheses?.[1]?.status !== 'critic_rejected' ||
      oneAccepted.runnerUp !== null ||
      !oneAccepted.winner ||
      !/independent commercial critic/i.test(
        oneAccepted.winner?.whyOverRunnerUp || ''
      ) ||
      oneAcceptedCritic?.comparisons?.length !== 2 ||
      oneAcceptedCritic?.acceptedFinalistIds?.length !== 1 ||
      oneAcceptedCritic?.rejectedFinalistCount !== 1 ||
      oneAcceptedCritic?.verdict !== 'accepted' ||
      oneAccepted.result?.incrementalRevenueGate?.passed !== true) {
    throw new Error(
      `one accepted finalist did not complete after the critic compared two: ${JSON.stringify({ calls: oneAcceptedCriticCalls, result: oneAccepted })}`
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
      productionMotion.market =
        'New York, New York, United States';
      productionMotion.contingentFinalists = compactContingentFinalists(
        productionMotion.contingentFinalists
      );
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: 'Two compact source-bound professional motions.',
          plans: twoPlannerMotions(productionMotion, evidenceRef)
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
      requestBytes > 35 * 1_024 ||
      result.preflight?.maxRequestBodyByteCount !== 36 * 1_024) {
    throw new Error(
      `production-shaped planner request lacks bounded headroom: ${JSON.stringify({ requestBytes, evidenceCount: JSON.parse(requestSeen?.user || '{}').evidenceCatalog?.length, preflight: result.preflight, status: result.status, reason: result.reason })}`
    );
  }

  const overflowJob = structuredClone(productionJob);
  const overflowEvidence = overflowJob.payload.evidenceSnapshot.sourceEvidence;
  overflowEvidence.forEach((item, index) => {
    item.approvedSourceUrl = item.url;
    item.publishedAt = new Date(now.getTime() - index * 60_000).toISOString();
    item.startDate = '2026-01-01T00:00:00.000Z';
    item.confidence = 'verified_current';
  });
  overflowJob.payload.objective.evidenceRefs = overflowEvidence
    .slice(0, 20)
    .map((item) => item.id);
  overflowJob.payload.objective.allowedActions = Array.from(
    { length: 8 },
    (_, index) =>
      `Review-only professional research permission ${index + 1} with no outreach, publishing, or provider writes`
  );
  let overflowRequestSeen;
  let overflowCalls = 0;
  const overflowResult = await runOpportunityDiscoveryPlanner({
    job: overflowJob,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      overflowCalls += 1;
      overflowRequestSeen = request;
      const productionMotion = cases[0].plans(evidenceRef)[0];
      productionMotion.market =
        'New York, New York, United States';
      productionMotion.contingentFinalists = compactContingentFinalists(
        productionMotion.contingentFinalists
      );
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: 'Two compact source-bound professional motions.',
          plans: twoPlannerMotions(productionMotion, evidenceRef)
        },
        usage,
        generationId: 'generation-production-shaped-adaptive-envelope',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 900,
          contentSha256: '8'.repeat(64)
        },
        annotations: []
      };
    }
  });
  const overflowEnvelope =
    overflowResult.preflight?.providerPromptEnvelope || {};
  const overflowUser = JSON.parse(overflowRequestSeen?.user || '{}');
  const visibleOverflowRefs = new Set(
    (overflowUser.evidenceCatalog || []).map((item) => item.id)
  );
  if (overflowCalls !== 1 ||
      overflowResult.status !== 'planned' ||
      overflowEnvelope.adaptiveCompactionAttempted !== true ||
      overflowEnvelope.adaptiveCompactionApplied !== true ||
      overflowEnvelope.originalRequestBodyByteCount <= 36 * 1_024 ||
      overflowEnvelope.requestBodyByteCount > 36 * 1_024 ||
      overflowEnvelope.profile === 'standard' ||
      !(overflowUser.objective?.evidenceRefs || []).every((ref) =>
        visibleOverflowRefs.has(ref)
      )) {
    throw new Error(
      `production-shaped planner request did not compact adaptively: ${JSON.stringify({ overflowCalls, status: overflowResult.status, reason: overflowResult.reason, envelope: overflowEnvelope, promptEvidenceCount: visibleOverflowRefs.size, objectiveEvidenceRefs: overflowUser.objective?.evidenceRefs })}`
    );
  }

  const maxCardinalityJob = structuredClone(productionJob);
  const longValues = (label, count, repeat = 40) => Array.from(
    { length: count },
    (_, index) =>
      `${label} ${index + 1} ${'bounded professional context '.repeat(repeat)}`
  );
  maxCardinalityJob.payload.objective.allowedChannels = [
    'partner_channel',
    ...longValues('Allowed research channel', 63)
  ];
  maxCardinalityJob.payload.objective.allowedActions = [
    'research',
    'recommend',
    'review',
    ...longValues('Review-only action', 61)
  ];
  maxCardinalityJob.payload.objective.constraints = [
    'No outreach or publishing during research',
    ...longValues('Approved commercial constraint', 63)
  ];
  const maxContext = maxCardinalityJob.payload.commercialContext;
  maxContext.allowedChannels = [
    'partner_channel',
    ...longValues('Configured context channel', 31)
  ];
  maxContext.allowedActions = [
    'research',
    'recommend',
    'review',
    ...longValues('Configured context action', 29)
  ];
  maxContext.constraints = [
    'No outreach or publishing during research',
    ...longValues('Context constraint', 31)
  ];
  maxContext.profile.specialties = longValues('Verified specialty', 32);
  maxContext.profile.serviceAreas = longValues('Verified service area', 32);
  maxContext.profile.currentFocus = Array.from(
    { length: 12 },
    (_, index) => ({
      name: `Current focus ${index + 1}`,
      description: longValues('Source-backed focus', 1)[0],
      status: 'current',
      priority: 'high'
    })
  );
  maxContext.distributionAccounts = Array.from(
    { length: 20 },
    (_, index) => ({
      provider: `connected-provider-${index + 1}`,
      status: 'connected',
      mode: 'review',
      capabilities: longValues('Capability', 12, 8)
    })
  );
  maxContext.priorAttributedOutcomes = Array.from(
    { length: 16 },
    (_, index) => ({
      kind: `paid_booking_${index + 1}`,
      status: 'completed',
      verified: true,
      offer: longValues('Verified paid professional offer', 1, 8)[0],
      buyerSegment: longValues('Verified professional buyer', 1, 8)[0],
      channel: 'partner_channel',
      action: longValues('Attributed review-first action', 1, 10)[0],
      evidenceRefs: [evidenceRef],
      attribution: {
        objectiveId: `prior-objective-${index + 1}`,
        tournamentId: `prior-tournament-${index + 1}`,
        hypothesisId: `prior-hypothesis-${index + 1}`,
        candidateId: `prior-candidate-${index + 1}`,
        actionId: `prior-action-${index + 1}`,
        evidenceExperimentId: `prior-experiment-${index + 1}`,
        algorithmVersion: 'opportunity_tournament_v5',
        experimentArm: 'treatment',
        selectionProbability: 0.5
      },
      occurredAt: new Date(
        now.getTime() - index * 60_000
      ).toISOString()
    })
  );
  let maxCardinalityRequestSeen;
  let maxCardinalityCalls = 0;
  const maxCardinalityResult = await runOpportunityDiscoveryPlanner({
    job: maxCardinalityJob,
    model: 'openai/gpt-4.1-mini',
    now,
    completeJSON: async (request) => {
      maxCardinalityCalls += 1;
      maxCardinalityRequestSeen = request;
      const productionMotion = cases[0].plans(evidenceRef)[0];
      productionMotion.market = 'New York, New York, United States';
      productionMotion.contingentFinalists = compactContingentFinalists(
        productionMotion.contingentFinalists
      );
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: 'Two compact source-bound professional motions.',
          plans: twoPlannerMotions(productionMotion, evidenceRef)
        },
        usage,
        generationId: 'generation-max-cardinality-envelope',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 900,
          contentSha256: '7'.repeat(64)
        },
        annotations: []
      };
    }
  });
  const maxEnvelope =
    maxCardinalityResult.preflight?.providerPromptEnvelope || {};
  const maxAttempts = maxEnvelope.attempts || [];
  const maxPrompt = JSON.parse(maxCardinalityRequestSeen?.user || '{}');
  const maxVisibleRefs = new Set(
    (maxPrompt.evidenceCatalog || []).map((item) => item.id)
  );
  const maxContextNodes =
    maxPrompt.commercialEvidenceGraph?.nodes || [];
  const attemptsStrictlyDecrease = maxAttempts.every(
    (attempt, index) => index === 0 ||
      attempt.requestBodyByteCount <
        maxAttempts[index - 1].requestBodyByteCount
  );
  if (maxCardinalityCalls !== 1 ||
      maxCardinalityResult.status !== 'planned' ||
      maxEnvelope.profile !== 'essential' ||
      maxEnvelope.originalRequestBodyByteCount <= 36 * 1_024 ||
      maxEnvelope.requestBodyByteCount > 36 * 1_024 ||
      maxAttempts.length !== 4 ||
      !attemptsStrictlyDecrease ||
      maxPrompt.objective?.outcome !==
        maxCardinalityJob.payload.objective.outcome ||
      maxPrompt.objective?.successMetric !==
        maxCardinalityJob.payload.objective.successMetric ||
      maxPrompt.objective?.allowedChannels?.length > 4 ||
      JSON.stringify(maxPrompt.objective?.allowedActions) !==
        JSON.stringify(['research', 'recommend', 'review']) ||
      maxPrompt.objective?.constraints?.[0] !==
        'No outreach or publishing during research' ||
      maxPrompt.commercialContext?.profile?.profession !==
        maxContext.profile.profession ||
      maxPrompt.commercialContext?.profile?.location !==
        maxContext.profile.location ||
      maxPrompt.commercialContext?.priorAttributedOutcomes?.length !== 1 ||
      maxPrompt.commercialContext?.priorAttributedOutcomes?.[0]
        ?.attribution?.tournamentId !== 'prior-tournament-1' ||
      maxPrompt.commercialContext?.permissionRequired !==
        'explicit_user_approval' ||
      !(maxPrompt.objective?.evidenceRefs || []).every((ref) =>
        maxVisibleRefs.has(ref)
      ) ||
      !(maxPrompt.commercialContext?.priorAttributedOutcomes?.[0]
        ?.evidenceRefs || []).every((ref) => maxVisibleRefs.has(ref)) ||
      maxContextNodes.filter((node) =>
        /^commercial_context:constraint:/i.test(node.evidenceRef)
      ).length > 4 ||
      maxContextNodes.filter((node) =>
        /^commercial_context:allowed_channel:/i.test(node.evidenceRef)
      ).length > 4 ||
      maxContextNodes.filter((node) =>
        /^commercial_context:prior_outcome:/i.test(node.evidenceRef)
      ).length !== 1 ||
      !maxContextNodes.some((node) =>
        node.evidenceRef === 'commercial_context:profile' &&
        node.provenance === 'user_declared'
      ) ||
      !maxContextNodes.some((node) =>
        node.evidenceRef === 'commercial_context:prior_outcome:1' &&
        node.provenance === 'verified_prior_outcome'
      )) {
    throw new Error(
      `max-cardinality planner prompt was not bounded semantically: ${JSON.stringify({ calls: maxCardinalityCalls, status: maxCardinalityResult.status, reason: maxCardinalityResult.reason, envelope: maxEnvelope, objective: maxPrompt.objective, commercialContext: maxPrompt.commercialContext, contextNodes: maxContextNodes })}`
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
      commercialContext: {
        profile: {
          profession: scenario.profile?.identity?.profession,
          location: scenario.profile?.identity?.location,
          availability: scenario.profile?.identity?.availability,
          specialties: scenario.profile?.identity?.specialties,
          serviceAreas: scenario.profile?.identity?.serviceAreas
        }
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
  if (!Object.prototype.hasOwnProperty.call(
    overrides,
    'routeContractVersion'
  )) {
    motion.routeContractVersion = 'commercial_motion_route_v1';
  }
  if (!Object.prototype.hasOwnProperty.call(overrides, 'motionKind')) {
    motion.motionKind = motion.commercialRole === 'paid_demand'
      ? motion.searchMode === 'active_job_posting'
        ? 'compensated_job'
        : 'buyer_solicitation'
      : motion.commercialRole === 'referral_partner'
        ? motion.searchMode === 'local_organization'
          ? 'referral_org_decision_maker'
          : 'referral_person'
        : motion.searchMode === 'local_organization'
          ? 'direct_buyer_org_decision_maker'
          : 'direct_buyer_person';
  }
  if (!Object.prototype.hasOwnProperty.call(
    overrides,
    'demandArtifactKind'
  )) {
    motion.demandArtifactKind = motion.motionKind === 'compensated_job'
      ? 'employer_job_posting'
      : motion.motionKind === 'buyer_solicitation'
        ? 'buyer_rfp'
        : 'not_applicable';
  }
  motion.evidenceRefs = [...new Set([
    ...motion.evidenceRefs,
    PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
  ])];
  const requiredEvidenceRoles = motion.commercialRole === 'referral_partner'
    ? ['acquisition', 'channel_fit', 'prospective_partner']
    : motion.commercialRole === 'buyer'
      ? ['acquisition', 'channel_fit', 'defined_buyer']
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
          ? 'person'
          : 'person',
      commercialRole: motion.commercialRole,
      resolutionStrategy: motion.searchMode === 'local_organization'
        ? 'organization_then_decision_maker'
        : 'single_exact_target',
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
    if (motion.commercialRole === 'referral_partner') {
      return `After review, ${variant}: request a paid referral from {{TARGET_NAME}} via public professional profile {{TARGET_URL}} for ${motion.paidOffer}.`;
    }
    if (motion.commercialRole === 'buyer') {
      return `After review, ${variant}: use permissioned outreach via {{TARGET_NAME}}'s public professional profile {{TARGET_URL}} to offer ${motion.paidOffer}.`;
    }
    const prefix = motion.acquisitionMode === 'warm_referral'
        ? 'After review, request one warm referral introduction'
        : motion.acquisitionMode === 'inbound'
          ? 'After review, submit one inbound paid application'
          : motion.acquisitionMode === 'partner_channel'
            ? 'After review, submit one paid proposal through the partner channel'
          : 'After review, submit one permissioned paid proposal';
    return `${prefix} to {{TARGET_NAME}} for ${motion.paidOffer} (${variant}).`;
  };
  const channel = (variant) => motion.commercialRole === 'referral_partner'
    ? `Partner referral via {{TARGET_NAME}}'s public professional profile {{TARGET_URL}} (${variant})`
    : motion.commercialRole === 'buyer'
      ? `Permissioned outreach via {{TARGET_NAME}}'s public professional profile {{TARGET_URL}} (${variant})`
      : motion.acquisitionMode === 'warm_referral'
      ? `Warm introduction via {{TARGET_NAME}} (${variant})`
      : motion.acquisitionMode === 'inbound'
        ? `Inbound discovery at {{TARGET_NAME}} (${variant})`
        : motion.acquisitionMode === 'partner_channel'
          ? `Partner channel response to {{TARGET_NAME}} (${variant})`
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
      o: canonicalTerminalPaidOutcome(mechanism),
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
      l: `Verified seller proof (${variant})`,
      e: [ref]
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
        l: 'If no reply after 5 days, one review-first follow-up',
        e: [ref]
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
    v: 'revenue_causal_witness_v2',
    i: 'counterfactual_incremental_paid_income',
    c: revenueMechanism,
    o: revenueMechanism,
    p: `${revenueMechanism}_terminal`,
    t: attributionMethod,
    d: 'separate_conversion_destination',
    s: 'stop_at_limit',
    n: 14,
    u: 'calendar_days',
    ...overrides
  };
}

function canonicalTerminalPaidOutcome(mechanism) {
  const outcomes = {
    paid_booking:
      'One paid consultation booking is completed and its payment receipt is recorded.',
    direct_sale:
      'One paid order is completed and its payment receipt is recorded.',
    signed_contract:
      'One paid services contract is signed and its first invoice payment is received and recorded.',
    paid_pilot:
      'One paid pilot agreement is signed and its deposit payment is received and recorded.',
    subscription_or_retainer:
      'One paid subscription is activated and its first payment receipt is recorded.',
    insurance_reimbursement:
      'One completed reimbursable consultation has a paid claim and reimbursement payment received.',
    license_or_royalty:
      'One paid license agreement is signed and its license payment is received and recorded.',
    commission_or_referral:
      'One attributed sale produces a commission payment that is received and recorded.',
    sponsorship:
      'One sponsorship agreement is signed and its first sponsorship payment is received and recorded.',
    platform_payout:
      'One marketplace payout is received and its payout record is recorded.',
    compensated_role:
      'One compensated job offer is accepted and its employment source record is recorded.'
  };
  return outcomes[mechanism] || '';
}

function applyNovelTypedCausalSemantics(value) {
  const motion = structuredClone(value);
  for (const familyKey of ['familyA', 'familyB']) {
    const revenue = motion.contingentFinalists[familyKey].d.r[0];
    revenue.io =
      'Cash reaches the owner only because this reviewed path succeeds.';
    revenue.c =
      'Invite {{TARGET_NAME}} as the named partner to refer one suitable family to the current paid service and booking destination.';
    revenue.o = 'Funds are received and recorded for one completed visit.';
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
      r: familyA.d.r.map((revenue) => ({
        ...revenue,
        c: 'project_first_viable_tactic_action'
      })),
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
