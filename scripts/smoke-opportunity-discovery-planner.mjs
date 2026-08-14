#!/usr/bin/env node

import { createHash } from 'node:crypto';
import Ajv from 'ajv';

import {
  COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT,
  OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
  OPPORTUNITY_DISCOVERY_PLANNER_DIAGNOSTIC_CONTRACT,
  PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID,
  buildEvidenceCatalog,
  commercialDiscoveryAttemptLedgerHash,
  diverseFinalists,
  localStructuredOutputValidatorCacheStats,
  normalizeCommercialDiscoveryEvidence,
  opportunityCommercialDiscoveryCapabilities,
  opportunityDiscoveryPlannerProjectionIssue,
  repairAndValidateOpenRouterJSONMessage,
  serializeOpenRouterJSONRequestBody,
  validateOpportunityCommercialDiscoveryNoTargetEnvelope,
  runOpportunityTournament,
  runOpportunityDiscoveryPlanner as runOpportunityDiscoveryPlannerRaw
} from '../bin/opportunity-tournament.mjs';

const now = new Date('2026-08-01T12:00:00Z');
const usage = {
  prompt_tokens: 900,
  completion_tokens: 650,
  total_tokens: 1550,
  cost: 0.0065
};
const MAX_DISCOVERY_PLANNER_RESPONSE_BYTES = 40 * 1024;
const MAX_DISCOVERY_PLANNER_RAW_STREAM_CONTENT_BYTES = 160 * 1024;
const MAX_DISCOVERY_PLANNER_CONTINGENT_BUNDLE_BYTES = 24 * 1024;
const MAX_DISCOVERY_PLANNER_SCHEMA_RESPONSE_BOUND_BYTES = 34_400;
const DISCOVERY_PLANNER_COMPACT_RESPONSE_TARGET_BYTES = 20 * 1024;
const COMPENSATED_JOB_PAID_OFFER =
  'A current compensated role matching verified professional skills';
const UNSAFE_INJECTED_GENERATION_ID_SENTINEL =
  `raw-generation-id-secret-sentinel/${'x'.repeat(400)}`;
const CURRENT_LUNA_PROVIDER_OMITTED_PATTERN_PATHS = Object.freeze([
  '#/$defs/canonicalText48/pattern',
  '#/$defs/canonicalText64/pattern',
  '#/$defs/canonicalText96/pattern',
  '#/$defs/canonicalText120/pattern',
  '#/$defs/commercialSemanticText96/pattern',
  '#/$defs/commercialSemanticText100/pattern',
  '#/$defs/commercialSemanticText120/pattern',
  '#/$defs/commercialOptionalSemanticText100/pattern',
  '#/$defs/paidOutcomeText120/pattern',
  '#/$defs/compensatedJobPaidOfferText140/pattern',
  '#/$defs/conversionDestinationText120/pattern',
  '#/$defs/attributionSignalText140/pattern',
  '#/$defs/compactChannelLabel/pattern',
  '#/$defs/compactActionLabel/pattern'
]);
const CURRENT_LUNA_PROVIDER_OMITTED_PATTERN_PATHS_SHA256 =
  'd0c9fd558f52f3a58e427efd7e0745b96e78a5bddbaa6ee7df859639de959c70';
const CURRENT_LUNA_AUTHORED_TEXT_DESCRIPTION =
  'Projected authored-text contract: organizationTerms/skills entries and authored l/q/sb/io/ats/cd/st strings are one line with single ASCII spaces, no leading/trailing/repeated whitespace or control/format characters, and no braces or colon except the exact target placeholders; commercial labels start with a letter. paidOffer.compensatedJob="Paid role". Valid forms: r.io="Paid booking"; r.cd and r.g.d.l="Booking service"; r.ats="Referral source"; every b.l has all fixed branches referral="Qualified payer for the paid opportunity", buyer="Qualified payer {{TARGET_NAME}} for the paid opportunity", paidDemand="Qualified employer {{TARGET_NAME}} for the paid role" and code selects by motionKind; c.l public="Review-first public professional profile {{TARGET_URL}}" or demand="Review-first official paid-demand page {{TARGET_URL}} for paid-role verification"; distinct a.l referral="After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to refer qualified buyers to paid service" or "After review via public professional profile {{TARGET_URL}}, invite {{TARGET_NAME}} to introduce qualified clients to paid booking", buyer="After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to book paid service" or "After review via public professional profile {{TARGET_URL}}, invite {{TARGET_NAME}} to purchase paid service", demand="After review via official paid-demand page {{TARGET_URL}}, submit one paid application to {{TARGET_NAME}}" or "After review via official paid-demand page {{TARGET_URL}}, submit one paid proposal to {{TARGET_NAME}}".';
const CURRENT_LUNA_ROLE_EXAMPLES = Object.freeze({
  referral_partner: Object.freeze({
    buyer: 'Qualified payer for the paid opportunity',
    channel: 'Review-first public professional profile {{TARGET_URL}}',
    actions: Object.freeze([
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to refer qualified buyers to paid service',
      'After review via public professional profile {{TARGET_URL}}, invite {{TARGET_NAME}} to introduce qualified clients to paid booking'
    ])
  }),
  buyer: Object.freeze({
    buyer: 'Qualified payer {{TARGET_NAME}} for the paid opportunity',
    channel: 'Review-first public professional profile {{TARGET_URL}}',
    actions: Object.freeze([
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to book paid service',
      'After review via public professional profile {{TARGET_URL}}, invite {{TARGET_NAME}} to purchase paid service'
    ])
  }),
  paid_demand: Object.freeze({
    buyer: 'Qualified employer {{TARGET_NAME}} for the paid role',
    channel:
      'Review-first official paid-demand page {{TARGET_URL}} for paid-role verification',
    actions: Object.freeze([
      'After review via official paid-demand page {{TARGET_URL}}, submit one paid application to {{TARGET_NAME}}',
      'After review via official paid-demand page {{TARGET_URL}}, submit one paid proposal to {{TARGET_NAME}}'
    ])
  })
});

function schemaSHA256(value) {
  return createHash('sha256')
    .update(JSON.stringify(value), 'utf8')
    .digest('hex');
}

function jsonDifferencePaths(leftValue, rightValue, path = '#') {
  if (Object.is(leftValue, rightValue)) return [];
  if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
    if (!Array.isArray(leftValue) || !Array.isArray(rightValue) ||
        leftValue.length !== rightValue.length) return [path];
    return leftValue.flatMap((item, index) => jsonDifferencePaths(
      item,
      rightValue[index],
      `${path}/${index}`
    ));
  }
  const leftObject = leftValue && typeof leftValue === 'object';
  const rightObject = rightValue && typeof rightValue === 'object';
  if (leftObject || rightObject) {
    if (!leftObject || !rightObject) return [path];
    return [...new Set([
      ...Object.keys(leftValue),
      ...Object.keys(rightValue)
    ])].flatMap((key) => {
      const childPath = `${path}/${key.replaceAll('~', '~0')
        .replaceAll('/', '~1')}`;
      if (!Object.prototype.hasOwnProperty.call(leftValue, key) ||
          !Object.prototype.hasOwnProperty.call(rightValue, key)) {
        return [childPath];
      }
      return jsonDifferencePaths(leftValue[key], rightValue[key], childPath);
    });
  }
  return [path];
}

function verifyProjectedPatternsRemainExactLocalAuthority({
  canonicalSchema,
  providerSchema
}) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const path of CURRENT_LUNA_PROVIDER_OMITTED_PATTERN_PATHS) {
    const definitionName = path.split('/')[2];
    const canonicalDefinition = canonicalSchema?.$defs?.[definitionName];
    const providerDefinition = providerSchema?.$defs?.[definitionName];
    if (!canonicalDefinition || !providerDefinition ||
        typeof canonicalDefinition.pattern !== 'string' ||
        Object.prototype.hasOwnProperty.call(providerDefinition, 'pattern')) {
      throw new Error(`projection pattern authority drifted at ${path}`);
    }
    const minimum = Number.isInteger(canonicalDefinition.minLength)
      ? canonicalDefinition.minLength
      : 1;
    const maximum = Number.isInteger(canonicalDefinition.maxLength)
      ? canonicalDefinition.maxLength
      : Math.max(minimum, 80);
    const adversary = ' '.repeat(Math.min(maximum, Math.max(minimum, 8)));
    const canonicalValidate = ajv.compile(canonicalDefinition);
    const providerValidate = ajv.compile(providerDefinition);
    if (canonicalValidate(adversary) || !providerValidate(adversary) ||
        canonicalValidate.errors?.[0]?.keyword !== 'pattern') {
      throw new Error(
        `projection path ${path} lost its exact local AJV adversary`
      );
    }
  }
  const canonicalDefinitionPatterns = Object.values(
    canonicalSchema?.$defs || {}
  ).filter((definition) => typeof definition?.pattern === 'string').length;
  const providerDefinitionPatterns = Object.values(
    providerSchema?.$defs || {}
  ).filter((definition) => typeof definition?.pattern === 'string').length;
  const canonicalSellerPattern = canonicalSchema?.properties?.plans?.items
    ?.properties?.paidOffer?.properties?.seller?.pattern;
  const providerSellerPattern = providerSchema?.properties?.plans?.items
    ?.properties?.paidOffer?.properties?.seller?.pattern;
  const canonicalFollowUpPattern = canonicalSchema?.$defs?.followUpItem
    ?.properties?.l?.pattern;
  const providerFollowUpPattern = providerSchema?.$defs?.followUpItem
    ?.properties?.l?.pattern;
  if (canonicalDefinitionPatterns !== 29 ||
      providerDefinitionPatterns !== 15 ||
      canonicalSellerPattern !== providerSellerPattern ||
      canonicalFollowUpPattern !== providerFollowUpPattern ||
      typeof canonicalFollowUpPattern !== 'string') {
    throw new Error(
      `projection did not retain the exact historical pattern cohort: ${JSON.stringify({ canonicalDefinitionPatterns, providerDefinitionPatterns, sellerPatternPreserved: canonicalSellerPattern === providerSellerPattern, followUpPatternPreserved: canonicalFollowUpPattern === providerFollowUpPattern })}`
    );
  }
}

function verifyAuthoredTextContractFitsCanonicalSchema({
  canonicalSchema
}) {
  if (canonicalSchema?.description !==
      CURRENT_LUNA_AUTHORED_TEXT_DESCRIPTION) {
    throw new Error('current Luna authored-text contract drifted');
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  const samples = {
    canonicalText48: ['Current paid service'],
    canonicalText64: ['Current paid service'],
    canonicalText96: ['Current paid service'],
    canonicalText120: ['Current paid service'],
    commercialSemanticText96: ['Current paid service'],
    commercialSemanticText100: ['Current paid service'],
    commercialSemanticText120: ['Current paid service'],
    commercialOptionalSemanticText100: ['Current paid service'],
    paidOutcomeText120: ['Paid booking'],
    compensatedJobPaidOfferText140: ['Paid role'],
    conversionDestinationText120: ['Booking service'],
    attributionSignalText140: ['Referral source'],
    compactChannelLabel: Object.values(CURRENT_LUNA_ROLE_EXAMPLES).map(
      (example) => example.channel
    ),
    compactActionLabel: Object.values(CURRENT_LUNA_ROLE_EXAMPLES).flatMap(
      (example) => example.actions
    )
  };
  if (JSON.stringify(Object.keys(samples).map((name) =>
    `#/$defs/${name}/pattern`
  )) !== JSON.stringify(CURRENT_LUNA_PROVIDER_OMITTED_PATTERN_PATHS)) {
    throw new Error('authored-text examples lost exact projection coverage');
  }
  const buyerLabel = canonicalSchema?.$defs?.compactBuyerLabel;
  if (buyerLabel?.type !== 'object' ||
      JSON.stringify(buyerLabel.required) !== JSON.stringify([
        'referral', 'buyer', 'paidDemand'
      ]) || buyerLabel.additionalProperties !== false ||
      JSON.stringify(buyerLabel.properties?.referral?.enum) !==
        JSON.stringify(['Qualified payer for the paid opportunity']) ||
      JSON.stringify(buyerLabel.properties?.buyer?.enum) !==
        JSON.stringify([
          'Qualified payer {{TARGET_NAME}} for the paid opportunity'
        ]) ||
      JSON.stringify(buyerLabel.properties?.paidDemand?.enum) !==
        JSON.stringify([
          'Qualified employer {{TARGET_NAME}} for the paid role'
        ])) {
    throw new Error('buyer label lost its finite role-branch contract');
  }
  for (const [name, definitionSamples] of Object.entries(samples)) {
    const validate = ajv.compile(canonicalSchema?.$defs?.[name]);
    for (const sample of definitionSamples) {
      if (!validate(sample)) {
        throw new Error(
          `authored-text example violates canonical ${name}: ${JSON.stringify(validate.errors)}`
        );
      }
    }
  }
}

// Normal planner fixtures exercise business/schema behavior, so give each
// successful injected completion the same direct-route receipt required at the
// real transport boundary. Route-negative probes call the raw export below.
async function runOpportunityDiscoveryPlanner(args) {
  const completeJSON = args.completeJSON;
  return runOpportunityDiscoveryPlannerRaw({
    ...args,
    completeJSON: async (request) => {
      const completion = await completeJSON(request);
      return {
        ...completion,
        diagnostics: {
          ...acceptedPlannerRouteDiagnostics(),
          ...(completion?.diagnostics || {})
        }
      };
    }
  });
}

verifyBoundedLocalJSONRepair();

function verifyBoundedLocalJSONRepair() {
  const responseFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'local_repair_smoke',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['plans', 'status'],
        properties: {
          plans: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: { type: 'string', minLength: 1 }
          },
          status: { type: 'string', enum: ['planned'] }
        }
      }
    }
  };
  const repaired = repairAndValidateOpenRouterJSONMessage(
    '```json\n{"plans":["buyer","referral",],"status":"planned",}\n```',
    responseFormat
  );
  if (JSON.stringify(repaired) !== JSON.stringify({
    plans: ['buyer', 'referral'],
    status: 'planned'
  })) {
    throw new Error(`bounded local JSON repair changed valid data: ${JSON.stringify(repaired)}`);
  }
  let singletonArrayIssue;
  try {
    repairAndValidateOpenRouterJSONMessage(
      '[{"plans":["buyer","referral"],"status":"planned",}]',
      responseFormat
    );
  } catch (error) {
    singletonArrayIssue = error;
  }
  if (singletonArrayIssue?.localJSONRepairRootShape?.kind !== 'array' ||
      singletonArrayIssue.localJSONRepairRootShape.arrayLength !== 1 ||
      singletonArrayIssue.localJSONRepairSchemaIssues?.[0]?.keyword !==
        'type') {
    throw new Error(
      `singleton root array was promoted or lost its exact schema diagnostic: ${JSON.stringify(singletonArrayIssue)}`
    );
  }
  for (let index = 0; index < 32; index += 1) {
    const value = `planned-${index}`;
    const churnFormat = structuredClone(responseFormat);
    churnFormat.json_schema.schema.properties.status.enum = [value];
    const churned = repairAndValidateOpenRouterJSONMessage(
      JSON.stringify({ plans: ['buyer', 'referral'], status: value }),
      churnFormat
    );
    if (churned.status !== value) {
      throw new Error('bounded local AJV cache changed validated data');
    }
  }
  const validatorCache = localStructuredOutputValidatorCacheStats();
  if (validatorCache.maximum !== 16 || validatorCache.size < 1 ||
      validatorCache.size > validatorCache.maximum) {
    throw new Error(
      `local structured-output validator cache is unbounded: ${JSON.stringify(validatorCache)}`
    );
  }
  let fragmentedRootIssue;
  try {
    repairAndValidateOpenRouterJSONMessage(
      '{"plans":["buyer","referral"],"status":"planned"}\n{}',
      {
        ...responseFormat,
        json_schema: {
          ...responseFormat.json_schema,
          name: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT
        }
      }
    );
  } catch (error) {
    fragmentedRootIssue = error;
  }
  if (fragmentedRootIssue?.localJSONRepairRootShape?.kind !== 'array') {
    throw new Error(
      `fragmented roots were promoted before exact schema validation: ${JSON.stringify(fragmentedRootIssue)}`
    );
  }
  const planPairResponseFormat = {
    type: 'json_schema',
    json_schema: {
      name: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['contractVersion', 'status', 'reason', 'plans'],
        properties: {
          contractVersion: {
            type: 'string',
            enum: [OPPORTUNITY_DISCOVERY_PLAN_CONTRACT]
          },
          status: { type: 'string', enum: ['planned'] },
          reason: { type: 'string', enum: [''] },
          plans: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label'],
              properties: { label: { type: 'string', minLength: 1 } }
            }
          }
        }
      }
    }
  };
  let projectedPlanPairIssue;
  try {
    repairAndValidateOpenRouterJSONMessage(
      '{"label":"buyer"}\n{"label":"referral"}',
      planPairResponseFormat
    );
  } catch (error) {
    projectedPlanPairIssue = error;
  }
  if (projectedPlanPairIssue?.localJSONRepairRootShape?.kind !== 'array' ||
      projectedPlanPairIssue.localJSONRepairRootShape.arrayLength !== 2 ||
      projectedPlanPairIssue.localJSONRepairSchemaIssues?.[0]?.keyword !==
        'type') {
    throw new Error(
      `two loose plans were projected into a valid root: ${JSON.stringify(projectedPlanPairIssue)}`
    );
  }
  let joinedSplitRootIssue;
  try {
    repairAndValidateOpenRouterJSONMessage(
      JSON.stringify([
        {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: [{ label: 'buyer' }]
        },
        { label: 'referral' }
      ]),
      planPairResponseFormat
    );
  } catch (error) {
    joinedSplitRootIssue = error;
  }
  if (joinedSplitRootIssue?.localJSONRepairRootShape?.kind !== 'array') {
    throw new Error(
      `split root plus plan was joined before exact validation: ${JSON.stringify(joinedSplitRootIssue)}`
    );
  }
  let unsafeSplitRejected = false;
  try {
    repairAndValidateOpenRouterJSONMessage(
      JSON.stringify([
        {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: []
        },
        { label: 'referral' }
      ]),
      planPairResponseFormat
    );
  } catch {
    unsafeSplitRejected = true;
  }
  if (!unsafeSplitRejected) {
    throw new Error('incomplete split root was synthesized into a valid plan');
  }
  let projectedPlanIssue;
  let projectedPlanShapes;
  try {
    repairAndValidateOpenRouterJSONMessage(
      '{"label":"buyer"}\n{}',
      planPairResponseFormat
    );
  } catch (error) {
    projectedPlanIssue = error.localJSONRepairSchemaIssues?.[0];
    projectedPlanShapes = error.localJSONRepairRootElementShapes;
  }
  if (JSON.stringify(projectedPlanShapes) !== JSON.stringify([
    'root:;plan:;bundle:;keys:1;unknown:1',
    'root:;plan:;bundle:;keys:0;unknown:0'
  ])) {
    throw new Error(
      `two-plan projection lost safe element shapes: ${JSON.stringify(projectedPlanShapes)}`
    );
  }
  if (JSON.stringify(projectedPlanIssue) !== JSON.stringify({
    keyword: 'type',
    instancePath: '/',
    schemaPath: '#/type'
  })) {
    throw new Error(
      `two-plan projection lost item-level schema diagnostics: ${JSON.stringify(projectedPlanIssue)}`
    );
  }
  for (const [label, raw] of [
    ['schema-invalid', '{"plans":["buyer"],"status":"planned",}'],
    ['oversized', `{"plans":["${'x'.repeat(196_609)}","referral"],"status":"planned",}`]
  ]) {
    let rejected = false;
    try {
      repairAndValidateOpenRouterJSONMessage(raw, responseFormat);
    } catch (error) {
      rejected = true;
      if (label === 'schema-invalid' &&
          JSON.stringify(error.localJSONRepairSchemaIssues) !==
            JSON.stringify([{
              keyword: 'minItems',
              instancePath: '/plans',
              schemaPath: '#/properties/plans/minItems'
            }])) {
        throw new Error(
          `schema-invalid repair lost bounded issue diagnostics: ${JSON.stringify(error.localJSONRepairSchemaIssues)}`
        );
      }
    }
    if (!rejected) {
      throw new Error(`${label} local JSON repair did not fail closed`);
    }
  }
}

function productionCitation(url, title, content) {
  const contentHash = createHash('sha256').update(content).digest('hex');
  const idHash = createHash('sha256').update(JSON.stringify([
    url.toLowerCase().replace(/\/+$/, ''),
    title,
    contentHash
  ])).digest('hex');
  return {
    id: `citation:${idHash.slice(0, 24)}`,
    url,
    title,
    content,
    contentHash
  };
}
const DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS = 42_000;
const DISCOVERY_PLANNER_CALL_SPEND_CEILING_MICROS = 59_616;
const OPPORTUNITY_TOURNAMENT_LLM_SPEND_RESERVE_MICROS = 75_533;
const DISCOVERY_PLANNER_WEB_CONTEXT_TOKEN_RESERVE = 950_000;
const DISCOVERY_PLANNER_PROMPT_TOKEN_CEILING = 45_056 + 1_024;
const PROFESSIONAL_ROLE_QUERY_CONTRACT = 'professional_role_query_v2';
const PROFESSIONAL_ROLE_QUERY_TAXONOMY_MAPPING_SHA256 =
  '295bb8bdfd9320c27530d225a401ac3dec07d915e987775413dc127f2feea033';
let largestPlannerResponseBytes = 0;
let largestPlannerRequestBytes = 0;
let largestPlannerContractBytes = 0;
let productionShapedPlannerRequestBytes = 0;
let largestMaterializedFixtureBytes = 0;
let largestCompactFixtureBytes = 0;
let smallestCompactResponseReduction = 1;
let largestCommercialCriticRequestBytes = 0;
let representativePlannerSchema = null;
let computedPlannerSchemaResponseBoundBytes = 0;
let maximumConcretePlannerResponseBytes = 0;
let maxAstralStrictPlannerResponse = null;

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
          'pediatric physician'
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
    evidence:
      'Shipped production APIs in Go backed by PostgreSQL and offers paid Go and PostgreSQL implementation work.',
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
        id: 'backend_engineering_buyer',
        priority: 2,
        searchMode: 'professional_counterparty',
        commercialRole: 'buyer',
        acquisitionMode: 'permissioned_outreach',
        buyer: 'A software company buying backend implementation work',
        counterparty: 'One exact engineering executive decision-maker',
        paidOffer: 'Compensated Go and PostgreSQL implementation',
        evidenceRefs: [ref],
        query: 'engineering executive United States',
        market: 'United States',
        targetRoleTerms: ['engineering executive'],
        targetRoleSubrole: 'executive',
        organizationTerms: ['software company'],
        acquisitionMechanism: 'One review-first professional profile route',
        conversionDestination: 'The verified proposal and contract page',
        paidConversion: 'A signed paid services contract',
        attributionSignal: 'CRM target id is stored on the signed contract'
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
        id: 'operations_buyer_organization',
        priority: 1,
        searchMode: 'local_organization',
        commercialRole: 'buyer',
        acquisitionMode: 'permissioned_outreach',
        buyer: 'A service firm buying operations consulting',
        counterparty: 'One exact operations decision-maker at a service firm',
        paidOffer: 'Paid delivery-system consulting engagement',
        evidenceRefs: [ref],
        query: 'service firm operations buyer United States',
        market: 'United States',
        targetRoleTerms: ['operations executive'],
        targetRoleSubrole: 'executive',
        organizationTerms: ['professional services firm'],
        acquisitionMechanism: 'One review-first professional profile route',
        conversionDestination: 'The verified proposal and contract page',
        paidConversion: 'A signed paid consulting contract',
        attributionSignal: 'CRM target id is stored on the contract and invoice',
        targetSlot: {
          finalTargetKind: 'person',
          resolutionStrategy: 'organization_then_decision_maker'
        }
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
        id: 'workflow_buyer_organization',
        priority: 1,
        searchMode: 'local_organization',
        commercialRole: 'buyer',
        acquisitionMode: 'permissioned_outreach',
        buyer: 'A field-service company procuring paid workflow software',
        counterparty: 'One exact operations decision-maker at a field-service company',
        paidOffer: 'Paid workflow-software subscription',
        evidenceRefs: [ref],
        query: 'field service company operations executive United States',
        market: 'United States',
        targetRoleTerms: ['operations executive'],
        targetRoleSubrole: 'executive',
        organizationTerms: ['field service company'],
        acquisitionMechanism: 'One review-first professional profile route',
        conversionDestination: 'The verified pricing and signup page',
        paidConversion: 'One paid software subscription',
        attributionSignal: 'CRM target id and payment receipt store the originating buyer',
        targetSlot: {
          finalTargetKind: 'person',
          resolutionStrategy: 'organization_then_decision_maker'
        }
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
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      requestSeen = request;
      representativePlannerSchema ||= structuredClone(
        request.responseFormat?.json_schema?.schema
      );
      const responsePlans = scenario.plans(evidenceRef).slice(0, 2);
      const exactSchemaMarket =
        request.responseFormat?.json_schema?.schema?.properties?.plans
          ?.items?.properties?.market?.enum?.[0];
      for (const responsePlan of responsePlans) {
        responsePlan.market = exactSchemaMarket;
        delete responsePlan.conversionDestination;
        delete responsePlan.paidConversion;
        delete responsePlan.attributionSignal;
        const materializedBytes = Buffer.byteLength(
          JSON.stringify(responsePlan.contingentFinalists),
          'utf8'
        );
        responsePlan.contingentFinalists = compactContingentFinalists(
          responsePlan.contingentFinalists
        );
        responsePlan.paidOffer = {
          seller: responsePlan.paidOffer,
          compensatedJob: COMPENSATED_JOB_PAID_OFFER
        };
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
        reason: '',
        plans: compactFreshPlannerPlans(responsePlans)
      };
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
        generationId: scenario === cases[0]
          ? UNSAFE_INJECTED_GENERATION_ID_SENTINEL
          : `generation-${scenario.name.replace(/\W+/g, '-')}`,
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
  if (scenario === cases[0]) {
    const plannerReceipt = result.llm?.discoveryPlanner;
    if (plannerReceipt?.generationId !== undefined ||
        JSON.stringify(result).includes(
          'raw-generation-id-secret-sentinel'
        )) {
      throw new Error(
        'injected completeJSON leaked an unsafe generation id through the durable planner receipt'
      );
    }
  }
  const initialPlannerPrompt = JSON.parse(requestSeen?.user || '{}');
  if (!requestSeen ||
      requestSeen.responseFormat?.json_schema?.name !==
        OPPORTUNITY_DISCOVERY_PLAN_CONTRACT ||
      requestSeen.responseFormat?.json_schema?.schema?.properties?.plans
        ?.items?.properties?.evidenceRefs != null ||
      requestSeen.responseFormat?.json_schema?.schema?.properties?.plans
        ?.minItems !== 2 ||
      requestSeen.responseFormat?.json_schema?.schema?.properties?.plans
        ?.maxItems !== 2 ||
      (requestSeen.model === 'openai/gpt-5.6-luna'
        ? requestSeen.responseFormat?.json_schema?.schema?.description !==
          CURRENT_LUNA_AUTHORED_TEXT_DESCRIPTION
        : requestSeen.responseFormat?.json_schema?.schema?.description !==
          undefined) ||
      JSON.stringify(
        requestSeen.responseFormat?.json_schema?.schema?.properties?.status
          ?.enum
      ) !== JSON.stringify(['planned']) ||
      requestSeen.plugins?.length !== 0 ||
      !initialPlannerPrompt.constraints?.some((constraint) =>
        /model call has no search plugin.*after plan acceptance.*separately budgeted bounded provider reads/is.test(
          constraint
        )
      ) ||
      /Forced Exa/i.test(requestSeen.user || '') ||
      requestSeen.allowLocalJSONRepair !== true ||
      requestSeen.stream !== true ||
      requestSeen.streamStartTimeoutMs !== 180_000 ||
      requestSeen.streamIdleTimeoutMs !== 60_000 ||
      requestSeen.streamTotalTimeoutMs !== 300_000 ||
      requestSeen.streamMaxContentBytes !==
        MAX_DISCOVERY_PLANNER_RAW_STREAM_CONTENT_BYTES ||
      serializeOpenRouterJSONRequestBody(requestSeen).includes(
        'allowLocalJSONRepair'
      ) ||
      !serializeOpenRouterJSONRequestBody(requestSeen).includes(
        '"stream":true'
      ) ||
      serializeOpenRouterJSONRequestBody(requestSeen).includes(
        'stream_options'
      ) ||
      serializeOpenRouterJSONRequestBody(requestSeen).includes(
        'streamStartTimeoutMs'
      ) ||
      serializeOpenRouterJSONRequestBody(requestSeen).includes(
        'streamMaxContentBytes'
      ) ||
      JSON.stringify(requestSeen.reasoning) !==
        JSON.stringify(requestSeen.model === 'openai/gpt-5.6-luna'
          ? { effort: 'none', exclude: true }
          : { enabled: false, exclude: true }) ||
      !serializeOpenRouterJSONRequestBody(requestSeen).includes(
        requestSeen.model === 'openai/gpt-5.6-luna'
          ? '"reasoning":{"effort":"none","exclude":true}'
          : '"reasoning":{"enabled":false,"exclude":true}'
      ) ||
      serializeOpenRouterJSONRequestBody(requestSeen).includes(
        'service_tier'
      ) ||
      requestSeen.maxTokens !== DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS ||
      !requestSeen.system?.includes(
        'Obey outputContract and hardRules exactly'
      ) ||
      !initialPlannerPrompt.outputContract?.plan?.includes(
        'exactly 2 ranked, economically distinct plans'
      ) ||
      !initialPlannerPrompt.outputContract?.finalists?.includes(
        'pathBase,tacticA,tacticB'
      ) ||
      !Array.isArray(initialPlannerPrompt.hardRules) ||
      initialPlannerPrompt.hardRules.length < 10 ||
      requestSeen.system?.includes('Return one plan') ||
      !requestSeen.system?.includes(
        'one concise minified JSON object'
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
      result.preflight?.routeProvenanceValidated !== true ||
      result.webSearchReceipt?.attempted !== false ||
      result.webSearchReceipt?.resultCount !== 0 ||
      result.webSearchReceipt?.annotations?.length !== 0 ||
      result.webSearchReceipt?.requestHash !==
        result.preflight?.requestBodySha256 ||
      result.webSearchReceipt?.injectedContextTokenReserve !== 0 ||
      result.webSearchReceipt?.costIncludedInLLMReceipt !== false ||
      result.preflight?.promptTokenCeiling !==
        result.preflight?.serializedPromptTokenCeiling ||
      result.preflight?.outputTokenCeiling !==
        DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS ||
      result.preflight?.fixedRequestFeeCeilingMicros !== 0 ||
      result.preflight?.fixedToolFeeMicros !== 0 ||
      !(result.preflight?.callSpendCeilingMicros > 0) ||
      result.preflight?.callSpendCeilingMicros >
        (requestSeen.model === 'openai/gpt-5.6-luna'
          ? DISCOVERY_PLANNER_CALL_SPEND_CEILING_MICROS
          : 344_160) ||
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
  if (36 * 1024 - result.preflight?.requestBodyByteCount < 512 ||
      result.preflight?.providerPromptEnvelope
        ?.minimumSoftHeadroomByteCount !== 512) {
    throw new Error(
      `${scenario.name}: call-1 request lost its 512-byte soft headroom (${result.preflight?.requestBodyByteCount} bytes)`
    );
  }
  const plannerPrompt = JSON.parse(requestSeen.user || '{}');
  const plannerPlanSchema = requestSeen.responseFormat?.json_schema
    ?.schema?.properties?.plans?.items?.properties || {};
  const contingentResponseSchema = requestSeen.responseFormat?.json_schema
    ?.schema?.properties?.plans?.items?.properties?.contingentFinalists;
  const contingentProperties = contingentResponseSchema?.properties || {};
  const plannerDefinitions = requestSeen.responseFormat?.json_schema
    ?.schema?.$defs || {};
  const causalWitnessSchema = plannerDefinitions.causalWitness || {};
  const plannerEvidenceRefSchema = plannerDefinitions.evidenceRef || {};
  const plannerObservationEvidenceRefSchema =
    plannerDefinitions.observationEvidenceRef || {};
  const plannerObservationEvidenceRefsSchema =
    plannerDefinitions.observationEvidenceRefs || {};
  const plannerCompactObservationEvidenceRefsSchema =
    plannerDefinitions.compactObservationEvidenceRefs || {};
  const terminalOutcomeEnum = plannerDefinitions.revenuePath
    ?.properties?.o?.enum || [];
  const followUpEvidenceSchema = plannerDefinitions.followUpItem
    ?.properties?.e || {};
  const followUpLabelPattern = plannerDefinitions.followUpItem
    ?.properties?.l?.pattern || '';
  const resolvePlannerSchema = (schema) => typeof schema?.$ref === 'string'
    ? plannerDefinitions[schema.$ref.split('/').at(-1)]
    : schema;
  const buyerLabelSchema = resolvePlannerSchema(
    plannerDefinitions.buyerItem?.properties?.l
  );
  const channelLabelSchema = resolvePlannerSchema(
    plannerDefinitions.channelItem?.properties?.l
  );
  const actionLabelSchema = resolvePlannerSchema(
    plannerDefinitions.actionItem?.properties?.l
  );
  const schemaAcceptsString = (schemaValue, value) => {
    const schema = resolvePlannerSchema(schemaValue);
    const length = [...String(value)].length;
    try {
      if (Array.isArray(schema?.enum)) return schema.enum.includes(value);
      return (!Number.isInteger(schema?.minLength) ||
          length >= schema.minLength) &&
        (!Number.isInteger(schema?.maxLength) ||
          length <= schema.maxLength) &&
        new RegExp(schema?.pattern || '', 'u').test(value);
    } catch {
      return false;
    }
  };
  const schemaAcceptsBlank = (schema) => {
    try {
      const resolved = typeof schema?.$ref === 'string'
        ? plannerDefinitions[schema.$ref.split('/').at(-1)]
        : schema;
      if (Array.isArray(resolved?.enum)) {
        return resolved.enum.includes('   ') || resolved.enum.includes('');
      }
      if (resolved?.type === 'object') return false;
      return new RegExp(resolved?.pattern || '').test('   ');
    } catch {
      return true;
    }
  };
  const schemaAcceptsNumber = (schema, value) =>
    Number.isFinite(value) &&
    (schema?.minimum === undefined || value >= schema.minimum) &&
    (schema?.maximum === undefined || value <= schema.maximum);
  const overflowNumber = JSON.parse('1e400');
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
      !/targetRoleSubrole=one exact schema-enumerated PDL canonical subrole.*derives targetRoleRole.*professional_role_query_v2/is.test(
        plannerPrompt.outputContract?.professionalRole || ''
      ) ||
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
        /market copies one exact response-schema enum value.*approvedMarkets\|ServiceAreas\|Location.*Remote is available only to paid_demand.*no expand\/abbreviate\/guess\/widen/is.test(
          rule
        )
      ) ||
      requestSeen.responseFormat?.json_schema?.schema?.properties
        ?.plans?.maxItems !== 2 ||
      !requestSeen.responseFormat?.json_schema?.schema?.properties
        ?.plans?.items?.required?.includes('motionKind') ||
      !requestSeen.responseFormat?.json_schema?.schema?.properties
        ?.plans?.items?.required?.includes('targetRoleSubrole') ||
      requestSeen.responseFormat?.json_schema?.schema?.properties
        ?.plans?.items?.required?.includes('rationale') ||
      [
        'id',
        'priority',
        'routeContractVersion',
        'demandArtifactKind',
        'searchMode',
        'commercialRole',
        'acquisitionMode',
        'evidenceRefs',
        'query',
        'targetRoleTerms',
        'acquisitionMechanism',
        'targetSlot',
        'professionalRoleQueryContract',
        'targetRoleRole',
        'rationale'
      ].some((field) => Object.prototype.hasOwnProperty.call(
        plannerPlanSchema,
        field
      )) ||
      plannerPlanSchema.targetRoleSubrole?.enum?.length !== 104 ||
      plannerPlanSchema.targetRoleSubrole?.enum?.includes('student') ||
      plannerPlanSchema.targetRoleSubrole?.enum?.includes('unemployed') ||
      !plannerPlanSchema.targetRoleSubrole?.enum?.includes('partnerships') ||
      plannerPlanSchema.organizationTerms?.maxItems !== 4 ||
      [
        plannerPlanSchema.paidOffer?.properties?.seller,
        plannerPlanSchema.organizationTerms?.items,
        plannerPlanSchema.jobTitle,
        plannerPlanSchema.skills?.items,
        plannerDefinitions.offerItem?.properties?.l,
        plannerDefinitions.buyerItem?.properties?.l,
        plannerDefinitions.timingItem?.properties?.l,
        plannerDefinitions.timingItem?.properties?.q,
        plannerDefinitions.proofItem?.properties?.l,
        plannerDefinitions.revenuePath?.properties?.l,
        plannerDefinitions.revenuePath?.properties?.io,
        plannerDefinitions.revenuePath?.properties?.ats,
        plannerDefinitions.revenuePath?.properties?.cd,
        plannerDefinitions.revenuePath?.properties?.st,
        plannerDefinitions.revenuePath?.properties?.g?.properties?.d
          ?.properties?.l
      ].some(schemaAcceptsBlank) ||
      ['conversionDestination', 'paidConversion', 'attributionSignal']
        .some((field) => field in plannerPlanSchema) ||
      !Array.isArray(plannerPlanSchema.market?.enum) ||
      plannerPlanSchema.market.enum.length !== 1 ||
      result.plans.some((plan) =>
        plan.market !== plannerPlanSchema.market.enum[0]
      ) ||
      !/copy one exact approved market value.*do not expand.*abbreviate.*widen/is.test(
        plannerPlanSchema.market?.description || ''
      ) ||
      buyerLabelSchema?.type !== 'object' ||
      JSON.stringify(buyerLabelSchema?.required) !== JSON.stringify([
        'referral', 'buyer', 'paidDemand'
      ]) ||
      channelLabelSchema?.maxLength !== 120 ||
      actionLabelSchema?.maxLength !== 180 ||
      JSON.stringify(buyerLabelSchema?.properties?.referral?.enum) !==
        JSON.stringify(['Qualified payer for the paid opportunity']) ||
      JSON.stringify(buyerLabelSchema?.properties?.buyer?.enum) !==
        JSON.stringify([
          'Qualified payer {{TARGET_NAME}} for the paid opportunity'
        ]) ||
      buyerLabelSchema?.properties?.referral?.enum?.includes(
        'Qualified buyer {{TARGET_NAME}} for paid service'
      ) ||
      !schemaAcceptsString(
        channelLabelSchema,
        'Review-first verified professional profile {{TARGET_URL}} for executive buyer fit'
      ) ||
      !schemaAcceptsString(
        actionLabelSchema,
        'After approval via verified professional profile {{TARGET_URL}}, request {{TARGET_NAME}} to buy the current paid advisory service'
      ) ||
      schemaAcceptsString(
        actionLabelSchema,
        'After review, inspect scheduling and write a report'
      ) ||
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
      ) !== JSON.stringify(['r', 'o', 'b', 't', 'p']) ||
      !Array.isArray(plannerEvidenceRefSchema.enum) ||
      !plannerEvidenceRefSchema.enum.includes(evidenceRef) ||
      plannerEvidenceRefSchema.enum.includes('target:evidence') ||
      !Array.isArray(plannerObservationEvidenceRefSchema.enum) ||
      !plannerObservationEvidenceRefSchema.enum.includes(evidenceRef) ||
      plannerObservationEvidenceRefSchema.enum.includes(
        'observation:invented'
      ) ||
      plannerObservationEvidenceRefSchema.enum.includes(
        PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
      ) ||
      plannerObservationEvidenceRefSchema.enum.some((ref) =>
        !/^observation:/i.test(ref)
      ) ||
      plannerObservationEvidenceRefsSchema.minItems !== 1 ||
      plannerObservationEvidenceRefsSchema.maxItems !== 2 ||
      plannerObservationEvidenceRefsSchema.items?.$ref !==
        '#/$defs/observationEvidenceRef' ||
      plannerCompactObservationEvidenceRefsSchema.minItems !== 1 ||
      plannerCompactObservationEvidenceRefsSchema.maxItems !== 1 ||
      plannerCompactObservationEvidenceRefsSchema.items?.$ref !==
        '#/$defs/observationEvidenceRef' ||
      plannerDefinitions.pathBase?.properties?.e !== undefined ||
      plannerDefinitions.tactic?.properties?.e !== undefined ||
      plannerDefinitions.tactic?.properties?.l !== undefined ||
      plannerDefinitions.timingItem?.properties?.e?.$ref !==
        '#/$defs/compactObservationEvidenceRefs' ||
      !plannerDefinitions.revenuePath?.required?.includes('k') ||
      plannerDefinitions.revenuePath?.properties?.k?.$ref !==
        '#/$defs/causalWitness' ||
      ['v', 'a', 'c', 'o'].some((field) =>
        plannerDefinitions.revenuePath?.properties?.[field] !== undefined ||
        plannerDefinitions.revenuePath?.required?.includes(field)
      ) || terminalOutcomeEnum.length !== 0 ||
      plannerDefinitions.revenuePath?.properties?.vm?.minimum !== 1 ||
      plannerDefinitions.revenuePath?.properties?.vm?.maximum !==
        1_000_000_000_000 ||
      Object.values(plannerDefinitions.scores?.properties || {}).some(
        (scoreSchema) => scoreSchema?.minimum !== 0 ||
          scoreSchema?.maximum !== 1
      ) ||
      Object.values(
        contingentProperties.w?.properties || {}
      ).some((weightSchema) => weightSchema?.minimum !== 0 ||
        weightSchema?.maximum !== 1) ||
      Object.values(plannerDefinitions.scores?.properties || {}).some(
        (scoreSchema) => schemaAcceptsNumber(scoreSchema, overflowNumber)
      ) ||
      Object.values(contingentProperties.w?.properties || {}).some(
        (weightSchema) => schemaAcceptsNumber(weightSchema, overflowNumber)
      ) ||
      schemaAcceptsNumber(
        plannerDefinitions.revenuePath?.properties?.vm,
        overflowNumber
      ) ||
      JSON.stringify(causalWitnessSchema.required) !== JSON.stringify([
        'n',
        'u'
      ]) ||
      causalWitnessSchema.properties?.n?.minimum !== 1 ||
      causalWitnessSchema.properties?.n?.maximum !== 30 ||
      ['v', 'i', 'c', 'o', 'p', 't', 'd', 's'].some((field) =>
        causalWitnessSchema.properties?.[field] !== undefined
      ) ||
      JSON.stringify(
        plannerDefinitions.tactic?.required
      ) !== JSON.stringify([
        's',
        'c',
        'a',
        'f'
      ]) || plannerDefinitions.tactic?.properties?.m !== undefined ||
      plannerDefinitions.tactic?.properties?.tacticKey !== undefined ||
      JSON.stringify(plannerDefinitions.buyerItem?.required) !==
        JSON.stringify(['l', 'e']) ||
      plannerDefinitions.buyerItem?.properties?.rp ||
      JSON.stringify(plannerDefinitions.channelItem?.required) !==
        JSON.stringify(['l', 'e']) ||
      plannerDefinitions.channelItem?.properties?.rp ||
      plannerDefinitions.pathBase?.properties?.o?.minItems !== 2 ||
      plannerDefinitions.tactic?.properties?.c?.minItems !== 2 ||
      plannerDefinitions.tactic?.properties?.a?.maxItems !== 2 ||
      plannerDefinitions.tactic?.properties?.f?.maxItems !== 2 ||
      followUpEvidenceSchema.$ref !==
        '#/$defs/compactObservationEvidenceRefs' ||
      !/no reply after.*one review-first follow-up/i.test(
        followUpLabelPattern
      ) ||
      JSON.stringify(plannerDefinitions.actionItem?.required) !==
        JSON.stringify(['l', 'e']) ||
      plannerDefinitions.actionItem?.properties?.rp ||
      !/one bounded model-authored review-first commercial action.*never composes or rewrites/is.test(
        plannerDefinitions.actionItem?.description || ''
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /a:2\/tactic.*one model-authored l\/e.*referral_partner introduces.*current paid offer.*paid booking\/payment.*buyer asks.*book\/buy\/sign.*paid_demand submits.*paid application\/proposal response.*preserves l without rewriting/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /selects r\.rm\.seller.*r\.rm\.compensatedJob.*derives r\.v\/r\.a\/r\.c\/r\.o.*positional tactic keys.*k\.v\/i\/c\/o\/p\/t\/d\/s/i.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /motionKind route is authoritative.*two different referral counterparties are valid diversity.*never invent paid demand/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /professional=person\/single.*local_org=person\/org->decision-maker.*never terminal org.*one exact canonical PDL targetRoleSubrole.*derives its PDL role.*drops role intent for non-person routes.*organizationTerms=context/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /acquisitionMechanism exact.*buyer\/referral="Review-first public professional profile".*paid_demand="Review-first official paid-demand page"/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /buyer\/referral c\+a: use that exact form.*URL=HTTPS LinkedIn \/in.*no message\/DM\/InMail\/connect\/email\/phone\/form/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /c=project_selected_tactic_action.*projects its exact selected authored tactic action/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /prefer 4 distinct actions; >=2 across both tactics must be distinct\+viable/is.test(
          rule
        )
      ) ||
      !plannerPrompt.hardRules.some((rule) =>
        /fresh paid demand requires a structured PDL employer_job_posting.*public snippets\/RFP\/RFQ\/tender\/procurement prose has no live-demand authority.*supplier offers.*marketplaces.*accepts-insurance pages are not demand/is.test(
          rule
        )
      ) ||
      /claims no email\/phone\/form\/proposal route/i.test(
        requestSeen.system || ''
      ) ||
      !/rm:\{seller,compensatedJob\}.*selects the motionKind branch.*derives v\/a\/c\/o and the complete causal witness/is.test(
        plannerPrompt.outputContract?.revenuePath || ''
      )) {
    throw new Error(
      `${scenario.name}: call 1 omitted its compact semantic contract ${JSON.stringify({ blankSchemas: [
        plannerPlanSchema.paidOffer?.properties?.seller,
        plannerPlanSchema.organizationTerms?.items,
        plannerPlanSchema.jobTitle,
        plannerPlanSchema.skills?.items,
        plannerDefinitions.offerItem?.properties?.l,
        plannerDefinitions.buyerItem?.properties?.l,
        plannerDefinitions.timingItem?.properties?.l,
        plannerDefinitions.timingItem?.properties?.q,
        plannerDefinitions.proofItem?.properties?.l,
        plannerDefinitions.revenuePath?.properties?.l,
        plannerDefinitions.revenuePath?.properties?.io,
        plannerDefinitions.revenuePath?.properties?.ats,
        plannerDefinitions.revenuePath?.properties?.cd,
        plannerDefinitions.revenuePath?.properties?.st,
        plannerDefinitions.revenuePath?.properties?.g?.properties?.d?.properties?.l
      ].map(schemaAcceptsBlank), hardRules: plannerPrompt.hardRules, systemChecks: {
        projection: /projects r\.c per tactic/is.test(requestSeen.system || ''),
        acquisition: /acquisitionMechanism is exact and structural.*buyer\/referral="Review-first public professional profile".*paid_demand="Review-first official paid-demand page"/is.test(requestSeen.system || ''),
        market: /market must copy one response-schema enum value exactly.*never expand.*abbreviate.*widen/is.test(requestSeen.system || ''),
        actions: /a:2\/tactic.*one model-authored l\/e.*referral_partner introduces.*buyer asks.*paid_demand submits/is.test(requestSeen.system || ''),
        diversity: /prefer 4 distinct selected actions; >=2 across both tactics must be distinct\+viable/is.test(requestSeen.system || ''),
        demand: /compensated_job finds an employer job posting.*public web snippets.*RFP pages.*have no fresh paid-demand authority.*two referral motions with different counterparties are valid.*diversity never requires paid_demand.*supplier\/competitor offers.*accepts insurance.*are supply, never demand/is.test(requestSeen.system || '')
      } })}`
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

verifyGeneratedPlannerSchemaResponseBound(representativePlannerSchema);
verifyPlannerNativeStructuredOutputSchemaSubset(
  representativePlannerSchema
);

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

verifyFreshPlannerStrictSchemaTotality({
  schema: representativePlannerSchema,
  observationEvidenceRef: envelopeEvidenceRef
});
verifyEvidenceReferenceEncodingBounds();
await verifyFreshAstralPlannerRoundTrip(envelopeJob);

function plannerResponseAtByteCount(byteCount) {
  const exactMarket = representativePlannerSchema?.properties?.plans
    ?.items?.properties?.market?.enum?.[0];
  const response = {
    contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
    status: 'planned',
    reason: '',
    plans: envelopeScenario.plans(envelopeEvidenceRef).slice(0, 2)
  };
  for (const motion of response.plans) {
    motion.market = exactMarket;
    motion.contingentFinalists = compactContingentFinalists(
      motion.contingentFinalists
    );
  }
  response.plans = compactFreshPlannerPlans(response.plans);
  if (Number.isInteger(byteCount) && byteCount > 0) {
    const baseBytes = Buffer.byteLength(JSON.stringify(response), 'utf8');
    if (baseBytes > byteCount) {
      throw new Error(
        `planner response-envelope fixture exceeds target: ${baseBytes} > ${byteCount}`
      );
    }
    // Oversize diagnostics are rejected before semantic/schema acceptance;
    // this deliberately invalid field is used only by the overflow case.
    response.reason = 'r'.repeat(byteCount - baseBytes);
  }
  return response;
}

async function runPlannerResponseEnvelopeCase(byteCount) {
  const response = plannerResponseAtByteCount(byteCount);
  const responseByteCount = Buffer.byteLength(
    JSON.stringify(response),
    'utf8'
  );
  return runOpportunityDiscoveryPlanner({
    job: envelopeJob,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => ({
      data: response,
      usage,
      generationId: `generation-envelope-${byteCount}`,
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: responseByteCount,
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

await verifyPlannerRouteProvenanceGate();
await verifyPlannerExactUsageGate();
await verifyPlannerFinishGate();

async function verifyPlannerFinishGate() {
  const validData = plannerResponseAtByteCount(0);
  const unsafeSentinel = 'raw-finish-reason-secret sentinel!';
  for (const scenario of [{
    label: 'missing-finish',
    diagnostics: {},
    issue: 'finish_reason_missing'
  }, {
    label: 'length-finish',
    diagnostics: {
      finishReason: 'length',
      nativeFinishReason: 'length'
    },
    issue: 'finish_reason_not_stop'
  }, {
    label: 'incompatible-native-finish',
    diagnostics: {
      finishReason: 'stop',
      nativeFinishReason: 'length'
    },
    issue: 'native_finish_reason_not_stop'
  }, {
    label: 'unsafe-finish',
    diagnostics: {
      finishReason: unsafeSentinel,
      nativeFinishReason: unsafeSentinel
    },
    issue: 'finish_reason_not_stop'
  }, {
    label: 'uppercase-finish',
    diagnostics: {
      finishReason: 'STOP',
      nativeFinishReason: 'STOP'
    },
    issue: 'finish_reason_not_stop',
    rejectedRawFinish: 'STOP'
  }, {
    label: 'padded-finish',
    diagnostics: {
      finishReason: ' stop ',
      nativeFinishReason: ' stop '
    },
    issue: 'finish_reason_not_stop',
    rejectedRawFinish: ' stop '
  }, {
    label: 'non-string-finish',
    diagnostics: {
      finishReason: 1,
      nativeFinishReason: 1
    },
    issue: 'finish_reason_not_stop'
  }]) {
    const result = await runOpportunityDiscoveryPlannerRaw({
      job: envelopeJob,
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async () => {
        const diagnostics = {
          ...acceptedPlannerRouteDiagnostics(),
          ...scenario.diagnostics,
          contentByteCount: Buffer.byteLength(
            JSON.stringify(validData),
            'utf8'
          ),
          contentSha256: '6'.repeat(64)
        };
        if (scenario.label === 'missing-finish') {
          delete diagnostics.finishReason;
          delete diagnostics.nativeFinishReason;
        }
        return {
          data: structuredClone(validData),
          usage,
          generationId: `generation-planner-finish-${scenario.label}`,
          diagnostics,
          annotations: []
        };
      }
    });
    if (result.status !== 'blocked' || result.plans.length !== 0 ||
        result.recoveryCause !==
          'commercial_discovery_planner_completion_recovery' ||
        result.failureCode !== 'planner_finish_reason_invalid' ||
        result.preflight?.finishIssue !== scenario.issue ||
        result.preflight?.routeProvenanceValidated !== false ||
        result.normalizationDiagnostic != null ||
        result.llm?.discoveryPlanner?.status !== 'completed' ||
        JSON.stringify(result).includes(unsafeSentinel) ||
        (scenario.rejectedRawFinish &&
          JSON.stringify(result).includes(scenario.rejectedRawFinish)) ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${scenario.label} planner finish reason did not fail before route/schema normalization: ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyPlannerExactUsageGate() {
  const validData = plannerResponseAtByteCount(0);
  for (const scenario of [{
    label: 'missing-token-field',
    usage: {
      prompt_tokens: 900,
      total_tokens: 1550,
      cost: 0.0065
    },
    issue: 'usage_tokens_missing_or_not_exact_positive_integers'
  }, {
    label: 'string-token-fields',
    usage: {
      prompt_tokens: '900',
      completion_tokens: '650',
      total_tokens: '1550',
      cost: 0.0065
    },
    issue: 'usage_tokens_missing_or_not_exact_positive_integers'
  }, {
    label: 'inconsistent-total',
    usage: {
      prompt_tokens: 900,
      completion_tokens: 650,
      total_tokens: 1551,
      cost: 0.0065
    },
    issue: 'usage_total_tokens_inconsistent'
  }, {
    label: 'string-cost',
    usage: {
      prompt_tokens: 900,
      completion_tokens: 650,
      total_tokens: 1550,
      cost: '0.0065'
    },
    issue: 'usage_cost_missing_or_not_exact_number'
  }]) {
    const result = await runOpportunityDiscoveryPlannerRaw({
      job: envelopeJob,
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async () => ({
        data: structuredClone(validData),
        usage: scenario.usage,
        generationId: `generation-planner-usage-${scenario.label}`,
        diagnostics: {
          ...acceptedPlannerRouteDiagnostics(),
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: Buffer.byteLength(
            JSON.stringify(validData),
            'utf8'
          ),
          contentSha256: '7'.repeat(64)
        },
        annotations: []
      })
    });
    if (result.status !== 'blocked' || result.plans.length !== 0 ||
        result.recoveryCause !==
          'commercial_discovery_planner_provider_usage_recovery' ||
        result.failureCode !== 'planner_provider_usage_invalid' ||
        result.preflight?.cause !==
          'commercial_discovery_planner_provider_usage_recovery' ||
        result.preflight?.failureCode !==
          'planner_provider_usage_invalid' ||
        result.preflight?.usageIssue !== scenario.issue ||
        result.preflight?.routeProvenanceValidated !== false ||
        result.normalizationDiagnostic != null ||
        result.usage?.calls !== 1 ||
        result.usage?.successfulCalls !== 1 ||
        result.llm?.discoveryPlanner?.status !== 'completed' ||
        result.llm?.discoveryPlanner?.generationId !==
          `generation-planner-usage-${scenario.label}` ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${scenario.label} planner usage did not fail before route/schema normalization with completed provider accounting: ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyPlannerRouteProvenanceGate() {
  const validData = plannerResponseAtByteCount(0);
  const sensitiveRawSentinel = 'planner-raw-response-must-not-persist';
  for (const scenario of [{
    label: 'missing-selected-route',
    issue: 'selected_provider_missing',
    diagnostics: {
      httpStatus: 200
    }
  }, {
    label: 'numeric-string-route-diagnostics',
    issue: 'completed_http_status_not_2xx',
    diagnostics: {
      httpStatus: '200',
      routerStrategy: 'direct',
      routerAttempt: '1',
      routerCandidateCount: '1',
      routerAttemptStatuses: ['200'],
      routerAttempts: [{
        provider: 'String Fixture Provider',
        model: 'deepseek/deepseek-v4-flash-0731',
        status: '200'
      }],
      routerAttemptSequenceSource: 'reported',
      routerSelectedEndpointEvidenced: true,
      routerSelectedProvider: 'String Fixture Provider',
      routerSelectedModel: 'deepseek/deepseek-v4-flash-0731'
    }
  }, {
    label: 'foreign-selected-model',
    issue: 'selected_model_not_requested',
    diagnostics: {
      httpStatus: 200,
      routerStrategy: 'direct',
      routerAttempt: 1,
      routerCandidateCount: 1,
      routerAttemptStatuses: [200],
      routerAttempts: [{
        provider: 'Foreign Fixture Provider',
        model: 'foreign/vendor-model',
        status: 200
      }],
      routerAttemptSequenceSource: 'reported',
      routerSelectedEndpointEvidenced: true,
      routerSelectedProvider: 'Foreign Fixture Provider',
      routerSelectedModel: 'foreign/vendor-model'
    }
  }, {
    label: 'incomplete-fallback-route',
    issue: 'attempt_sequence_incomplete',
    diagnostics: {
      httpStatus: 200,
      routerStrategy: 'fallback',
      routerAttempt: 2,
      routerCandidateCount: 2,
      routerAttemptStatuses: [502, 200],
      routerAttempts: [{
        provider: 'Final Fixture Provider',
        model: 'deepseek/deepseek-v4-flash-0731',
        status: 200
      }],
      routerAttemptSequenceSource: 'reported',
      routerSelectedEndpointEvidenced: true,
      routerFallbackUsed: true,
      routerSelectedProvider: 'Final Fixture Provider',
      routerSelectedModel: 'deepseek/deepseek-v4-flash-0731'
    }
  }, {
    label: 'malformed-filterable-fallback-route',
    issue: 'attempt_sequence_incomplete',
    diagnostics: {
      httpStatus: 200,
      routerStrategy: 'fallback',
      routerAttempt: 2,
      routerCandidateCount: 3,
      routerAttemptStatuses: [502, 200],
      routerAttempts: [{
        provider: 'First Fixture Provider',
        model: 'deepseek/deepseek-v4-flash-0731',
        status: 502
      }, {
        provider: 'Malformed Fixture Provider',
        model: 'deepseek/deepseek-v4-flash-0731',
        status: 'not-a-status'
      }, {
        provider: 'Final Fixture Provider',
        model: 'deepseek/deepseek-v4-flash-0731',
        status: 200
      }],
      routerAttemptSequenceSource: 'reported',
      routerSelectedEndpointEvidenced: true,
      routerFallbackUsed: true,
      routerSelectedProvider: 'Final Fixture Provider',
      routerSelectedModel: 'deepseek/deepseek-v4-flash-0731'
    }
  }]) {
    const result = await runOpportunityDiscoveryPlannerRaw({
      job: envelopeJob,
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async () => ({
        data: structuredClone(validData),
        usage,
        generationId: `generation-planner-route-${scenario.label}`,
        rawResponse: sensitiveRawSentinel,
        diagnostics: {
          ...scenario.diagnostics,
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: Buffer.byteLength(
            JSON.stringify(validData),
            'utf8'
          ),
          contentSha256: '9'.repeat(64)
        },
        annotations: []
      })
    });
    const receipt = result.llm?.discoveryPlanner;
    if (result.status !== 'blocked' || result.plans.length !== 0 ||
        result.recoveryCause !==
          'commercial_discovery_planner_route_provenance_recovery' ||
        result.failureCode !== 'planner_route_provenance_invalid' ||
        result.preflight?.cause !==
          'commercial_discovery_planner_route_provenance_recovery' ||
        result.preflight?.failureCode !==
          'planner_route_provenance_invalid' ||
        result.preflight?.routeProvenanceIssue !== scenario.issue ||
        result.preflight?.routeProvenanceValidated !== false ||
        result.normalizationDiagnostic != null ||
        result.usage?.calls !== 1 ||
        result.usage?.successfulCalls !== 1 ||
        result.usage?.promptTokens !== usage.prompt_tokens ||
        result.usage?.completionTokens !== usage.completion_tokens ||
        result.usage?.reportedCostMicros !== 6_500 ||
        receipt?.status !== 'completed' ||
        receipt?.generationId !==
          `generation-planner-route-${scenario.label}` ||
        receipt?.responseDiagnostics?.contentSha256 !== '9'.repeat(64) ||
        JSON.stringify(result).includes(sensitiveRawSentinel) ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${scenario.label} planner route provenance did not fail closed with exact completed accounting: ${JSON.stringify(result)}`
      );
    }
  }

  const reviewedPermaslug =
    'deepseek/deepseek-v4-flash-20260731';
  const permaslugResult = await runOpportunityDiscoveryPlannerRaw({
    job: envelopeJob,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => ({
      data: structuredClone(validData),
      usage,
      generationId: 'generation-planner-reviewed-permaslug',
      diagnostics: {
        httpStatus: 200,
        routerStrategy: 'direct',
        routerAttempt: 1,
        routerCandidateCount: 1,
        routerAttemptStatuses: [200],
        routerAttempts: [{
          provider: 'Permaslug Fixture Provider',
          model: reviewedPermaslug,
          status: 200
        }],
        routerAttemptSequenceSource: 'reported',
        routerSelectedEndpointEvidenced: true,
        routerSelectedProvider: 'Permaslug Fixture Provider',
        routerSelectedModel: reviewedPermaslug,
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: Buffer.byteLength(
          JSON.stringify(validData),
          'utf8'
        ),
        contentSha256: '8'.repeat(64)
      },
      annotations: []
    })
  });
  if (permaslugResult.status !== 'planned' ||
      permaslugResult.preflight?.routeProvenanceValidated !== true ||
      permaslugResult.llm?.discoveryPlanner?.model !== reviewedPermaslug ||
      permaslugResult.llm?.discoveryPlanner?.requestedModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      permaslugResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `reviewed planner permaslug was not bound to its exact alias: ${JSON.stringify(permaslugResult)}`
    );
  }
}

const withinResponseMarginBytes = Buffer.byteLength(
  JSON.stringify(plannerResponseAtByteCount(0)),
  'utf8'
);
const withinResponseMargin = await runPlannerResponseEnvelopeCase(
  0
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

const whitespaceHeavyRawResponse = await runOpportunityDiscoveryPlanner({
  job: envelopeJob,
  model: 'deepseek/deepseek-v4-flash-0731',
  now,
  completeJSON: async () => {
    const data = plannerResponseAtByteCount(0);
    return {
      data,
      usage,
      generationId: 'generation-raw-canonical-split',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        // The production transport counts the exact streamed content bytes;
        // insignificant JSON whitespace can make that count larger than the
        // canonical JSON.stringify(data) byte count checked by the planner.
        contentByteCount: MAX_DISCOVERY_PLANNER_RESPONSE_BYTES + 8_192,
        contentSha256: '4'.repeat(64),
        streaming: true,
        streamCompleted: true,
        responseHeadersReceived: true
      },
      annotations: []
    };
  }
});
const whitespaceHeavyCanonicalBytes = Buffer.byteLength(
  JSON.stringify(plannerResponseAtByteCount(0)),
  'utf8'
);
if (whitespaceHeavyRawResponse.status !== 'planned' ||
    whitespaceHeavyRawResponse.preflight?.responseBodyByteCount !==
      whitespaceHeavyCanonicalBytes ||
    whitespaceHeavyRawResponse.preflight?.responseBodyByteCount >=
      MAX_DISCOVERY_PLANNER_RESPONSE_BYTES ||
    whitespaceHeavyRawResponse.preflight?.maxResponseBodyByteCount !==
      MAX_DISCOVERY_PLANNER_RESPONSE_BYTES ||
    whitespaceHeavyRawResponse.preflight?.routeProvenanceValidated !== true ||
    whitespaceHeavyRawResponse.llm?.discoveryPlanner?.status !== 'completed' ||
    whitespaceHeavyRawResponse.llm?.discoveryPlanner?.responseDiagnostics
      ?.contentByteCount !== MAX_DISCOVERY_PLANNER_RESPONSE_BYTES + 8_192 ||
    whitespaceHeavyRawResponse.llm?.discoveryPlanner?.responseDiagnostics
      ?.finishReason !== 'stop' ||
    whitespaceHeavyRawResponse.llm?.discoveryPlanner?.responseDiagnostics
      ?.streamCompleted !== true ||
    whitespaceHeavyRawResponse.llm?.discoveryPlanner?.responseDiagnostics
      ?.localJSONRepairApplied !== undefined ||
    whitespaceHeavyRawResponse.normalizationDiagnostic != null ||
    whitespaceHeavyRawResponse.usage?.successfulCalls !== 1 ||
    whitespaceHeavyRawResponse.sideEffectsPerformed !== 0) {
  throw new Error(
    `planner conflated completed raw SSE bytes with its canonical parsed-response gate: ${JSON.stringify(whitespaceHeavyRawResponse)}`
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
    `planner did not enforce its 40 KiB response gate: ${JSON.stringify(overflowResponse)}`
  );
}

const zeroMotionEscape = await runOpportunityDiscoveryPlanner({
  job: envelopeJob,
  model: 'deepseek/deepseek-v4-flash-0731',
  now,
  completeJSON: async () => ({
    data: {
      contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
      status: 'insufficient_verified_supply',
      reason: 'No exact outside target was supplied.',
      plans: []
    },
    usage,
    generationId: 'generation-zero-motion-escape',
    diagnostics: {
      finishReason: 'stop',
      nativeFinishReason: 'stop',
      contentByteCount: 144,
      contentSha256: '0'.repeat(64)
    },
    annotations: []
  })
});
if (zeroMotionEscape.status !== 'blocked' ||
    zeroMotionEscape.plans.length !== 0 ||
    zeroMotionEscape.llm?.discoveryPlanner?.status !== 'completed' ||
    zeroMotionEscape.normalizationDiagnostic?.code !==
      'strict_schema_mismatch') {
  throw new Error(
    `fresh zero-motion escape was not classified as an AI contract failure: ${JSON.stringify(zeroMotionEscape)}`
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
unsafeCompanionPlan.contingentFinalists = compactContingentFinalists(
  unsafeCompanionPlan.contingentFinalists
);
const unsafeResult = await runOpportunityDiscoveryPlanner({
  job: unsafeJob,
  model: 'deepseek/deepseek-v4-flash-0731',
  now,
  completeJSON: async (request) => {
    const exactMarket =
      request.responseFormat?.json_schema?.schema?.properties?.plans
        ?.items?.properties?.market?.enum?.[0];
    const unsafePlan = plan({
      id: 'unsafe_patient_search',
      priority: 1,
      searchMode: 'professional_counterparty',
      commercialRole: 'buyer',
      acquisitionMode: 'permissioned_outreach',
      buyer: 'Patients seeking clinical care',
      counterparty: 'An identifiable person',
      paidOffer: 'Contact a patient by private email for paid consultation',
      evidenceRefs: [unsafeRef],
      query: 'postpartum patients private email mobile phone',
      targetRoleTerms: ['postpartum patient'],
      acquisitionMechanism: 'Direct message',
      conversionDestination: 'Booking page',
      paidConversion: 'Paid consultation',
      attributionSignal: 'Booking source'
    });
    unsafePlan.market = exactMarket;
    unsafeCompanionPlan.market = exactMarket;
    return {
      data: {
      contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
      status: 'planned',
      reason: '',
      plans: [unsafePlan, unsafeCompanionPlan]
    },
    usage,
    generationId: 'generation-unsafe',
    diagnostics: {
      finishReason: 'stop',
      nativeFinishReason: 'stop',
      contentByteCount: 500,
      contentSha256: 'b'.repeat(64)
    }
    };
  }
});
if (unsafeResult.status !== 'blocked' ||
    unsafeResult.plans.length !== 0 ||
    unsafeResult.llm?.discoveryPlanner?.status !== 'completed' ||
    unsafeResult.llm?.discoveryPlanner?.error ||
    unsafeResult.usage?.successfulCalls !== 1 ||
    unsafeResult.normalizationDiagnostic?.code !==
      'strict_schema_mismatch' ||
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
await verifyApprovedObservationPreflight();
await verifyForgedSurrogateCompletionFailsClosed(unsafeJob, unsafeRef);
await verifyDiscoveryRoleAndAdapterInvariants(unsafeJob, unsafeRef);
await verifyOmittedChildEvidenceCanonicalization(unsafeJob, unsafeRef);
await verifyOmittedTargetEvidenceProtocolCanonicalization(
  unsafeJob,
  unsafeRef
);
await verifyOneMotionUsesTwoTacticFallback(unsafeJob, unsafeRef);
await verifySingleOperationalVariantCanBePruned(unsafeJob, unsafeRef);
await verifyLinkedRecoveryCannotBeBusinessAction(unsafeJob, unsafeRef);
await verifySupportingBottleneckIsMissingEvidence(unsafeJob, unsafeRef);
await verifyQualifiedPartnerReferralActionsPass(unsafeJob, unsafeRef);
await verifyAuthoredTextRoleExamplesPassFullPlanner();
await verifyCompactConversionActionProjection(unsafeJob, unsafeRef);
await verifyRepeatedOptionalRoleActionsArePruned(unsafeJob, unsafeRef);
await verifyPaidDemandResponseActionVerbs(unsafeJob, unsafeRef);
await verifyRequiredSupportingBottleneckFailsClosed(unsafeJob, unsafeRef);
await verifyAuthoredTerminalOutcomeIsNonAuthoritative(unsafeJob, unsafeRef);
await verifyMechanismSpecificTerminalOutcomes(unsafeJob, unsafeRef);
await verifyRevenueStopUnits(unsafeJob, unsafeRef);
await verifyNaturalBookingAttribution(unsafeJob, unsafeRef);
await verifyCausalPathDiagnosticsAreFieldSpecific(unsafeJob, unsafeRef);
await verifyTypedCausalWitnessContract(unsafeJob, unsafeRef);
await verifyRawOverCardinalityFailsClosed(unsafeJob, unsafeRef);
await verifyMaximumFamilyEvidenceContainment();
await verifyCurrentLunaGeneratorRouteQualification(unsafeJob, unsafeRef);
await verifyCurrentLunaProductionLengthFailuresPreserveProjection(
  unsafeJob
);
await verifyTruncatedPlannerFailsOnceWithSafeReceipt(unsafeJob);
await verifySiliconFlowProductionTimeoutFailsOnce(unsafeJob);
await verifyAmbientProductionTimeoutFailsOnce(unsafeJob);
await verifyBaiduProductionStrictSchemaMismatchFailsOnce(unsafeJob);
await verifyFireworksProductionStrictSchemaMismatchFailsOnce(unsafeJob);
await verifyMorphProductionStrictSchemaMismatchFailsOnce(unsafeJob);
await verifyMancerProductionStrictRootSchemaMismatchFailsOnce(unsafeJob);
await verifyAtlasCloudProductionRawOverflowFailsOnce(unsafeJob);
await verifyParasailProductionTimeoutFailsOnce(unsafeJob);
await verifyTogetherProductionTimeoutFailsOnce(unsafeJob);
await verifyDeepInfraProductionTimeoutFailsOnce(unsafeJob);
await verifyIoNetProductionTimeoutFailsOnce(unsafeJob);
await verifyPhalaProductionTimeoutFailsOnce(unsafeJob);
await verifyWaferAndAtlasProductionPartialTracesFailOnce(unsafeJob);
await verifyObjectiveSellerFocusAndDirectoryEvidenceRoles();
await verifyUnprovenOfferRequiresLiveCompensatedDemand();
verifyCausalPairReservationSurvivesCrowding();
await verifyTwoStageTargetBinding();
await verifyProviderAttestedBuyerReviewRoute();
await verifyPaidDemandTargetProtocolEndToEnd();
await verifyProductionShapedPlannerHeadroom(unsafeJob, unsafeRef);

// The 2026-08-13 Atlas production trace reached the former 18k-token ceiling
// after 99,271 ms with 27,149 content bytes and finish=length. The strict
// schema's exact derived serialized bound is 31,552 bytes in the local
// fixture and 31,920 bytes in the Linux deployment fixture. Both generated
// schemas remain finite and below the shared 34,400-byte proof ceiling. A tokenizer with
// byte fallback cannot require more tokens than the encoded byte count, so the
// current 42k ceiling covers the entire 40,960-byte runtime cap plus 1,024
// tokens of explicit headroom. Retain the trace projection as a
// production-derived timing and compression regression: the schema projects
// to at most 21,164 native tokens and 42k projects to 231,633 ms, inside the
// 300-second deadline.
const observedPlannerCompletionTokens = 18_000;
const observedPlannerContentBytes = 27_149;
const observedPlannerDurationMs = 99_271;
const observedPlannerFinishReason = 'length';
const observedPlannerBytesPerOutputToken =
  observedPlannerContentBytes / observedPlannerCompletionTokens;
const projectedSchemaMaximumOutputTokens = Math.ceil(
  computedPlannerSchemaResponseBoundBytes / observedPlannerBytesPerOutputToken
);
const projectedRuntimeMaximumOutputTokens = Math.ceil(
  MAX_DISCOVERY_PLANNER_RESPONSE_BYTES / observedPlannerBytesPerOutputToken
);
const projectedPlannerDurationMs = Math.ceil(
  observedPlannerDurationMs * DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS /
    observedPlannerCompletionTokens
);
const supportedSchemaTokenProjection = new Map([
  [31_552, 20_920],
  [31_920, 21_164]
]);
if (!supportedSchemaTokenProjection.has(
  computedPlannerSchemaResponseBoundBytes
) ||
    DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS <
      MAX_DISCOVERY_PLANNER_RESPONSE_BYTES + 1_024 ||
    observedPlannerFinishReason !== 'length' ||
    projectedSchemaMaximumOutputTokens !==
      supportedSchemaTokenProjection.get(
        computedPlannerSchemaResponseBoundBytes
      ) ||
    projectedRuntimeMaximumOutputTokens !== 27_157 ||
    projectedPlannerDurationMs !== 231_633 ||
    projectedSchemaMaximumOutputTokens > DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS ||
    projectedRuntimeMaximumOutputTokens >
      DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS ||
    projectedPlannerDurationMs > 300_000) {
  throw new Error(
    `current planner ceiling is not supported by the production trace: ${JSON.stringify({ observedPlannerCompletionTokens, observedPlannerContentBytes, observedPlannerDurationMs, observedPlannerFinishReason, computedPlannerSchemaResponseBoundBytes, projectedSchemaMaximumOutputTokens, projectedRuntimeMaximumOutputTokens, projectedPlannerDurationMs, outputTokenCeiling: DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS })}`
  );
}

if (smallestCompactResponseReduction < 0.1 ||
    largestCompactFixtureBytes >= largestMaterializedFixtureBytes) {
  throw new Error(
    `shared planner contract did not reduce representative response size: ${JSON.stringify({ largestMaterializedFixtureBytes, largestCompactFixtureBytes, smallestCompactResponseReduction })}`
  );
}

process.stdout.write(
  `opportunity discovery planner smoke passed (${cases.length} professions + unsafe adversary + all-span referral-population/private-contact safety + target role/acquisition/adapter guards + exact buyer public-profile route + role-specific model-authored action projection + repeated optional-action pruning/typed diversity diagnostics + child evidence-index canonicalization + target-slot protocol canonicalization + two-motion/shared-path/two-tactic materialization + legacy receipt compatibility + independent family-diverse critic + pre-truncation causal-pair reservation + thrown-length safe receipt + qualified partner-referral/paid-demand response actions + peer-supplier paid-demand rejection + unqualified-introduction/artifact/untyped-listing rejection + required supporting bottleneck + mechanism-specific terminal outcomes/disjunction-attempt rejection + service-payment outcomes + unpaid-service rejection + revenue-stop units + natural booking attribution + field-specific causal diagnostics + raw-cardinality guard + two-stage target binding + production-shaped/max-cardinality prompt headroom + 160 KiB raw/40 KiB canonical response gates; call 1 max ${DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS} tokens / ${DISCOVERY_PLANNER_CALL_SPEND_CEILING_MICROS} micros; largest request ${largestPlannerRequestBytes} bytes / <=${44 * 1024}; production-shaped request ${productionShapedPlannerRequestBytes} bytes / <=${43 * 1024} 512-byte-headroom floor; joint-worst critic request ${largestCommercialCriticRequestBytes} bytes / <=${65_536 - 512} (${65_536 - largestCommercialCriticRequestBytes} bytes headroom); semantic contract +${largestPlannerContractBytes} bytes; compact finalist fixture ${largestCompactFixtureBytes} bytes vs ${largestMaterializedFixtureBytes} materialized (${Math.round(smallestCompactResponseReduction * 100)}%+ reduction); largest representative two-motion response ${largestPlannerResponseBytes} bytes / <=${DISCOVERY_PLANNER_COMPACT_RESPONSE_TARGET_BYTES} compact target; schema-derived bound ${computedPlannerSchemaResponseBoundBytes} bytes; concrete joint maximum ${maximumConcretePlannerResponseBytes} bytes)\n`
);

async function verifyApprovedObservationPreflight() {
  const job = plannerJob(cases[0]);
  job.id = 'job-planner-no-approved-observation';
  job.payload.evidenceSnapshot.sourceEvidence = [];
  let calls = 0;
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => {
      calls += 1;
      throw new Error('planner without an approved observation made a call');
    }
  });
  if (calls !== 0 || result.status !== 'blocked' ||
      result.preflight?.authorized !== false ||
      result.preflight?.cause !==
        'planner_approved_observation_unavailable' ||
      !/approved source observation/i.test(result.reason || '') ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `missing approved observation was not rejected before call 1: ${JSON.stringify({ calls, result })}`
    );
  }
}

async function verifyForgedSurrogateCompletionFailsClosed(job, evidenceRef) {
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const market = request.responseFormat?.json_schema?.schema?.properties
        ?.plans?.items?.properties?.market?.enum?.[0];
      const plans = cases[0].plans(evidenceRef).slice(0, 2);
      plans.forEach((motion, index) => {
        motion.priority = index + 1;
        motion.market = market;
        motion.contingentFinalists = compactContingentFinalists(
          motion.contingentFinalists
        );
      });
      plans[0].contingentFinalists.familyA.l = 'invalid\ud800text';
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage,
        generationId: 'generation-forged-surrogate',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 1_024,
          contentSha256: 'f'.repeat(64)
        }
      };
    }
  });
  if (result.status !== 'blocked' || result.plans.length !== 0 ||
      result.usage?.successfulCalls !== 0 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `forged lone-surrogate completion gained plan authority: ${JSON.stringify(result)}`
    );
  }
}

async function verifyMaximumFamilyEvidenceContainment() {
  const job = plannerJob(cases[0]);
  job.id = 'job-planner-maximum-family-evidence-containment';
  job.payload.evidenceSnapshot.sourceEvidence = Array.from(
    { length: 14 },
    (_, index) => ({
      id: `maximum-family-observation-${index + 1}`,
      observationId: `maximum-family-observation-${index + 1}`,
      sourceId: 'owner-site',
      label: `Current approved professional observation ${index + 1}`,
      summary:
        `Current approved evidence ${index + 1} grounds the paid professional service and reviewed referral path.`,
      url: `https://owner.example/offer/evidence-${index + 1}`,
      observedAt: now.toISOString(),
      status: 'approved'
    })
  );
  const catalog = buildEvidenceCatalog(job.payload, {}, now, {
    includeSystemAttributionCapability: true
  });
  const allObservationRefs = catalog
    .map((item) => item.id)
    .filter((ref) => /^observation:/i.test(ref));
  if (allObservationRefs.length !== 14) {
    throw new Error(
      `maximum containment fixture did not create 14 observations: ${JSON.stringify(allObservationRefs)}`
    );
  }
  job.payload.objective.evidenceRefs = [...allObservationRefs];
  let requestSeen = null;
  let visibleObservationRefsSeen = [];
  let expectedFirstFamilyEvidence = [];
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      requestSeen = request;
      const visibleObservationRefs = request.responseFormat?.json_schema
        ?.schema?.$defs?.observationEvidenceRef?.enum || [];
      visibleObservationRefsSeen = [...visibleObservationRefs];
      if (visibleObservationRefs.length === 0) {
        throw new Error(
          `adaptive planner projection lost every approved observation: ${JSON.stringify(visibleObservationRefs)}`
        );
      }
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      const motions = twoPlannerMotions(
        applyNovelTypedCausalSemantics(
          cases[0].plans(visibleObservationRefs[0])[1]
        ),
        visibleObservationRefs[0]
      ).map((motion, motionIndex) => {
        const bundle = compactContingentFinalists(
          motion.contingentFinalists
        );
        const replaceSystemRef = (value) => {
          if (Array.isArray(value)) {
            return value.map(replaceSystemRef);
          }
          if (value && typeof value === 'object') {
            return Object.fromEntries(
              Object.entries(value).map(([key, item]) => [
                key,
                replaceSystemRef(item)
              ])
            );
          }
          return value ===
              PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
            ? visibleObservationRefs[0]
            : value;
        };
        let observationIndex = 0;
        const distributeObservationRefs = (value) => {
          if (Array.isArray(value)) {
            return value.map(distributeObservationRefs);
          }
          if (value && typeof value === 'object') {
            return Object.fromEntries(
              Object.entries(value).map(([key, item]) => [
                key,
                distributeObservationRefs(item)
              ])
            );
          }
          if (/^observation:/i.test(String(value || ''))) {
            const selected = visibleObservationRefs[
              observationIndex % visibleObservationRefs.length
            ];
            observationIndex += 1;
            return selected;
          }
          return value;
        };
        const observationOnlyBundle = distributeObservationRefs(
          replaceSystemRef(bundle)
        );
        // This probe is about maximum child-evidence containment. Keep its
        // authored causal prose inside the same strict commercial grammar as
        // the normal planner fixture so unrelated text-pattern checks cannot
        // mask the containment assertion.
        const canonicalRevenue = compactContingentFinalists(
          cases[0].plans(visibleObservationRefs[0])[0]
            .contingentFinalists
        ).pathBase.r[0];
        for (const revenue of observationOnlyBundle.pathBase.r) {
          revenue.io = canonicalRevenue.io;
          revenue.cd = canonicalRevenue.cd;
          revenue.g.d.l = canonicalRevenue.g.d.l;
        }
        if (motionIndex === 0) {
          const approved = new Set([
            'target:evidence',
            ...visibleObservationRefs
          ]);
          const observed = [];
          const collectSubmittedEvidence = (value) => {
            if (Array.isArray(value)) {
              value.forEach(collectSubmittedEvidence);
              return;
            }
            if (value && typeof value === 'object') {
              Object.values(value).forEach(collectSubmittedEvidence);
              return;
            }
            if (approved.has(value) && !observed.includes(value)) {
              observed.push(value);
            }
          };
          collectSubmittedEvidence(observationOnlyBundle.pathBase);
          collectSubmittedEvidence(observationOnlyBundle.tacticA);
          expectedFirstFamilyEvidence = [
            'target:evidence',
            ...observed.filter((ref) => ref !== 'target:evidence')
          ];
        }
        const [freshMotion] = compactFreshPlannerPlans([{
          ...motion,
          contingentFinalists: observationOnlyBundle
        }]);
        freshMotion.market = exactMarket;
        return freshMotion;
      });
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: motions
        },
        usage,
        generationId: 'generation-maximum-family-containment',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 1_000,
          contentSha256: '9'.repeat(64)
        }
      };
    }
  });
  const familyEvidence = result.plans?.[0]?.contingentFinalists?.familyA?.e;
  if (!requestSeen || result.status !== 'planned' ||
      !Array.isArray(familyEvidence) ||
      familyEvidence.length !== expectedFirstFamilyEvidence.length ||
      !expectedFirstFamilyEvidence.every((ref) =>
        familyEvidence.includes(ref)
      ) ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `child-grounded family evidence was not rebuilt losslessly: ${JSON.stringify({ status: result.status, reason: result.reason, planSelection: result.planSelection, normalizationDiagnostic: result.normalizationDiagnostic, preflight: result.preflight, llm: result.llm, familyEvidence, expectedFirstFamilyEvidence, visibleObservationRefsSeen })}`
    );
  }
}

async function verifyTypedCommercialMotionSelection(
  referralJob,
  referralEvidenceRef
) {
  const run = async ({ job, plans, generationId, inspectRequest }) =>
    runOpportunityDiscoveryPlanner({
      job: structuredClone(job),
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => {
        inspectRequest?.(request);
        const freshPlans = compactFreshPlannerPlans(plans);
        const exactMarket = request.responseFormat?.json_schema?.schema
          ?.properties?.plans?.items?.properties?.market?.enum?.[0];
        for (const freshPlan of freshPlans) freshPlan.market = exactMarket;
        return {
          data: {
            contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
            status: 'planned',
            reason: '',
            plans: freshPlans
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
  compensatedMotions[1] = structuredClone(compensatedMotions[0]);
  compensatedMotions[1].id = 'active_platform_role';
  compensatedMotions[1].priority = 2;
  compensatedMotions[1].jobTitle = 'Platform engineer';
  compensatedMotions[1].skills = ['Go', 'Cloud infrastructure'];
  const authoredCompensatedJobOffer =
    'A model-authored paid platform engineering role';
  const authoredCompensatedIncome =
    'Salary payment from the accepted platform engineering role.';
  const authoredCompensatedDestination =
    'The official application page for the platform engineering role';
  const authoredCompensatedAttribution =
    'CRM source records the exact researched job posting';
  for (const motion of compensatedMotions) {
    motion.paidOffer = {
      seller: motion.paidOffer,
      compensatedJob: authoredCompensatedJobOffer
    };
    for (const familyKey of ['familyA', 'familyB']) {
      const revenue = motion.contingentFinalists[familyKey].d.r[0];
      revenue.io = authoredCompensatedIncome;
      revenue.cd = authoredCompensatedDestination;
      revenue.ats = authoredCompensatedAttribution;
      revenue.g.d.l = authoredCompensatedDestination;
    }
    motion.conversionDestination = '';
    motion.paidConversion = '';
    motion.attributionSignal = '';
  }
  compensatedMotions[0].query =
    'Go consultancy RFP services available from suppliers';
  compensatedMotions[0].searchMode = 'local_organization';
  compensatedMotions[0].commercialRole = 'buyer';
  compensatedMotions[0].acquisitionMode = 'partner_channel';
  compensatedMotions[1].professionalRoleQueryContract =
    'professional_role_query_v999';
  let compensatedOnlySchemaFields = {};
  const compensatedOnlyJob = structuredClone(programmerJob);
  compensatedOnlyJob.payload.commercialDiscoveryCapabilities = {
    braveWebSearch: false,
    pdlPersonSearch: false,
    pdlJobPostingSearch: true
  };
  const compensated = await run({
    job: compensatedOnlyJob,
    plans: compensatedMotions,
    generationId: 'generation-typed-compensated-job',
    inspectRequest: (request) => {
      const properties = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties || {};
      compensatedOnlySchemaFields = {
        conversionDestination: properties.conversionDestination,
        paidConversion: properties.paidConversion,
        attributionSignal: properties.attributionSignal
      };
    }
  });
  const compensatedJob = compensated.plans.find((item) =>
    item.motionKind === 'compensated_job'
  );
  if (compensated.status !== 'planned' ||
      compensated.plans.length !== 2 ||
      compensated.planSelection?.rejectedPlanCount !== 0 ||
      compensatedJob?.routeContractVersion !==
        'commercial_motion_route_v1' ||
      compensatedJob?.id !== 'plan_1_compensated_job' ||
      compensatedJob?.priority !== 1 ||
      compensatedJob?.motionKind !== 'compensated_job' ||
      compensatedJob?.demandArtifactKind !== 'employer_job_posting' ||
      compensatedJob?.searchMode !== 'active_job_posting' ||
      compensatedJob?.commercialRole !== 'paid_demand' ||
      compensatedJob?.acquisitionMode !== 'permissioned_outreach' ||
      compensatedJob?.professionalRoleQueryContract ||
      compensatedJob?.paidOffer !== authoredCompensatedJobOffer ||
      compensatedJob?.conversionDestination !==
        authoredCompensatedDestination ||
      compensatedJob?.paidConversion !== authoredCompensatedIncome ||
      compensatedJob?.attributionSignal !==
        authoredCompensatedAttribution ||
      ['familyA', 'familyB'].some((familyKey) => {
        const revenue = compensatedJob?.contingentFinalists?.[familyKey]
          ?.d?.r?.[0];
        return revenue?.io !== authoredCompensatedIncome ||
          revenue?.cd !== authoredCompensatedDestination ||
          revenue?.ats !== authoredCompensatedAttribution;
      }) ||
      JSON.stringify(compensatedOnlySchemaFields) !== JSON.stringify({}) ||
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
    paidConversion: 'One postpartum patient completes a paid lactation consultation',
    attributionSignal:
      'Booking source stores the selected target and tournament id'
  });
  const salvaged = await run({
    job: referralJob,
    plans: [sensitiveDirectBuyer, safeReferral],
    generationId: 'generation-one-valid-typed-motion'
  });
  if (salvaged.status !== 'planned' ||
      salvaged.plans.length !== 2 ||
      salvaged.planSelection?.acceptedPlanCount !== 2 ||
      salvaged.planSelection?.rejectedPlanCount !== 0 ||
      salvaged.plans[0]?.buyer !==
        'The validated outside target buying the current paid offer' ||
      /postpartum patient/i.test(salvaged.plans[0]?.buyer || '') ||
      /postpartum patients seeking/i.test(salvaged.plans[0]?.query || '') ||
      salvaged.sideEffectsPerformed !== 0) {
    throw new Error(
      `forged removed buyer/query authority was not discarded: ${JSON.stringify(salvaged)}`
    );
  }

  const invalidArtifactJob = cases[1].plans(programmerEvidenceRef)[0];
  invalidArtifactJob.demandArtifactKind = 'buyer_rfp';
  const invalidArtifactDirectBuyer =
    cases[1].plans(programmerEvidenceRef)[1];
  invalidArtifactDirectBuyer.demandArtifactKind = 'buyer_rfp';
  const fixedAndAuthoredArtifacts = await run({
    job: programmerJob,
    plans: [invalidArtifactJob, invalidArtifactDirectBuyer],
    generationId: 'generation-both-invalid-typed-motions'
  });
  if (fixedAndAuthoredArtifacts.status !== 'planned' ||
      fixedAndAuthoredArtifacts.plans.length !== 2 ||
      fixedAndAuthoredArtifacts.plans[0]?.id !==
        'plan_1_compensated_job' ||
      fixedAndAuthoredArtifacts.plans[0]?.demandArtifactKind !==
        'employer_job_posting' ||
      fixedAndAuthoredArtifacts.plans[1]?.id !==
        'plan_2_direct_buyer_person' ||
      fixedAndAuthoredArtifacts.plans[1]?.demandArtifactKind !==
        'not_applicable' ||
      fixedAndAuthoredArtifacts.planSelection?.acceptedPlanCount !== 2 ||
      fixedAndAuthoredArtifacts.planSelection?.rejectedPlanCount !== 0 ||
      fixedAndAuthoredArtifacts.sideEffectsPerformed !== 0) {
    throw new Error(
      `fixed versus authored artifact handling drifted: ${JSON.stringify(fixedAndAuthoredArtifacts)}`
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
      untypedFresh.planSelection?.returnedPlanCount !== 0 ||
      untypedFresh.llm?.discoveryPlanner?.status !== 'completed' ||
      untypedFresh.usage?.successfulCalls !== 1 ||
      untypedFresh.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      untypedFresh.normalizationDiagnostic?.failedMotionCount !== 2 ||
      !untypedFresh.normalizationDiagnostic?.issues?.some((issue) =>
        issue.keyword === 'required' &&
        issue.missingProperty === 'motionKind'
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
  pediatricReferral.targetRoleTerms = [
    'pediatrician',
    'pediatric physician'
  ];
  pediatricReferral.targetRoleSubrole = 'doctor';
  pediatricReferral.organizationTerms = ['pediatric practice'];
  const midwifeReferral = cases[0].plans(referralEvidenceRef)[0];
  midwifeReferral.id = 'midwife_referral_person';
  midwifeReferral.priority = 2;
  midwifeReferral.query = 'IBCLC supplier directory';
  midwifeReferral.targetRoleTerms = [
    'midwife',
    'certified midwife'
  ];
  midwifeReferral.targetRoleSubrole = 'nursing';
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
        'doctor Queens, NY, USA'
      ) ||
      !referralQueries.includes(
        'nursing Queens, NY, USA'
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
  if (pdlOnlySalvage.status !== 'blocked' ||
      pdlOnlySalvage.plans.length !== 0 ||
      pdlOnlySalvage.llm?.discoveryPlanner?.status !== 'completed' ||
      pdlOnlySalvage.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      pdlOnlySalvage.normalizationDiagnostic?.failedMotionCount !== 1 ||
      !pdlOnlySalvage.normalizationDiagnostic?.issues?.some((issue) =>
        issue.keyword === 'enum' &&
        issue.instancePath === '/plans/0/motionKind'
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
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => {
        inspectRequest?.(request);
        const freshPlans = compactFreshPlannerPlans(plans);
        const exactMarket = request.responseFormat?.json_schema?.schema
          ?.properties?.plans?.items?.properties?.market?.enum?.[0];
        for (const freshPlan of freshPlans) freshPlan.market = exactMarket;
        return {
          data: {
            contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
            status: 'planned',
            reason: '',
            plans: freshPlans
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
  const typedMarketSchema = typedMarketRequest?.responseFormat?.json_schema
    ?.schema?.properties?.plans?.items?.properties?.market;
  if (typedMarketResult.status !== 'planned' ||
      typedMarketResult.plans.length !== 2 ||
      typedMarketResult.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(typedMarketSchema?.enum) !==
        JSON.stringify([typedMarket.market]) ||
      JSON.stringify(
        typedMarketPrompt.commercialContext?.profile?.approvedMarkets
      ) !== JSON.stringify([typedMarket])) {
    throw new Error(
      `typed app-approved owner market did not bind exactly: ${JSON.stringify({ result: typedMarketResult, promptMarkets: typedMarketPrompt.commercialContext?.profile?.approvedMarkets })}`
    );
  }

  const secondTypedMarket = {
    ...typedMarket,
    market: 'Los Angeles, California, United States'
  };
  const twoMarketJob = structuredClone(typedMarketJob);
  twoMarketJob.payload.commercialContext.profile.approvedMarkets = [
    typedMarket,
    secondTypedMarket
  ];
  const twoMarketPlans = cases[0].plans(evidenceRef);
  for (const motion of twoMarketPlans) motion.market = typedMarket.market;
  let twoMarketRequest;
  const twoMarketResult = await run(
    twoMarketJob,
    twoMarketPlans,
    'generation-two-approved-markets-single-authority',
    (request) => {
      twoMarketRequest = request;
    }
  );
  const twoMarketSchema = twoMarketRequest?.responseFormat?.json_schema
    ?.schema;
  const validateTwoMarketResponse = new Ajv({
    allErrors: true,
    strict: false
  }).compile(twoMarketSchema);
  const exactMarketResponse = {
    contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
    status: 'planned',
    reason: '',
    plans: compactFreshPlannerPlans(twoMarketPlans).map((motion) => ({
      motionKind: motion.motionKind,
      paidOffer: motion.paidOffer,
      market: typedMarket.market,
      targetRoleSubrole: motion.targetRoleSubrole,
      organizationTerms: motion.organizationTerms?.length > 0
        ? motion.organizationTerms
        : ['Verified professional organization'],
      jobTitle: motion.jobTitle || 'Verified professional role',
      skills: motion.skills?.length > 0
        ? motion.skills
        : ['Verified professional skill'],
      contingentFinalists: motion.contingentFinalists
    }))
  };
  const alternateMarketResponse = structuredClone(exactMarketResponse);
  for (const motion of alternateMarketResponse.plans) {
    motion.market = secondTypedMarket.market;
  }
  if (twoMarketResult.status !== 'planned' ||
      twoMarketResult.plans.length !== 2 ||
      twoMarketResult.plans.some((motion) =>
        motion.market !== typedMarket.market
      ) ||
      JSON.stringify(
        twoMarketSchema?.properties?.plans?.items?.properties?.market?.enum
      ) !== JSON.stringify([typedMarket.market]) ||
      validateTwoMarketResponse(exactMarketResponse) !== true ||
      validateTwoMarketResponse(alternateMarketResponse) !== false) {
    throw new Error(
      `two approved markets exposed a schema-valid value that fresh normalization would silently replace: ${JSON.stringify({ result: twoMarketResult, marketEnum: twoMarketSchema?.properties?.plans?.items?.properties?.market?.enum, exactErrors: validateTwoMarketResponse.errors })}`
    );
  }

  const exactSurfaceJob = structuredClone(job);
  exactSurfaceJob.payload.commercialContext.profile.location =
    'New York, NY';
  exactSurfaceJob.payload.commercialContext.profile.serviceAreas = [];
  exactSurfaceJob.payload.commercialContext.profile.approvedMarkets = [];
  const expandedSurface = cases[0].plans(evidenceRef)[0];
  expandedSurface.id = 'expanded_new_york_surface';
  expandedSurface.priority = 1;
  expandedSurface.market = 'New York City, New York, United States';
  const exactSurface = cases[0].plans(evidenceRef)[1];
  exactSurface.id = 'exact_new_york_surface';
  exactSurface.priority = 2;
  exactSurface.market = 'New York, NY';
  let exactSurfaceRequest;
  const exactSurfaceResult = await run(
    exactSurfaceJob,
    [expandedSurface, exactSurface],
    'generation-exact-profile-market-surface',
    (request) => {
      exactSurfaceRequest = request;
    }
  );
  const exactSurfaceEnum = exactSurfaceRequest?.responseFormat?.json_schema
    ?.schema?.properties?.plans?.items?.properties?.market?.enum;
  if (exactSurfaceResult.status !== 'planned' ||
      exactSurfaceResult.plans.length !== 2 ||
      exactSurfaceResult.plans.some((motion) =>
        motion.market !== 'New York, NY'
      ) ||
      exactSurfaceResult.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(exactSurfaceEnum) !==
        JSON.stringify(['New York, NY'])) {
    throw new Error(
      `profile market surface was not schema-bound exactly: ${JSON.stringify({ result: exactSurfaceResult, marketEnum: exactSurfaceEnum })}`
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
    if (result.status !== 'planned' || result.plans.length !== 2 ||
        result.plans.some((motion) =>
          motion.market !== 'Boston, Massachusetts, United States'
        ) ||
        result.planSelection?.rejectedPlanCount !== 0 ||
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
      thirdPartyResult.plans.length !== 2 ||
      thirdPartyResult.plans.some((motion) =>
        motion.market !== 'Boston, Massachusetts, United States'
      ) ||
      thirdPartyResult.planSelection?.rejectedPlanCount !== 0) {
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
      proseOnlyResult.planSelection?.rejectedPlanCount !== 0 ||
      proseOnlyResult.preflight?.cause !==
        'planner_market_scope_unavailable' ||
      proseOnlyResult.usage?.calls !== 0) {
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
    if (result.status !== 'planned' ||
        result.plans.length !== 2 ||
        result.plans.some((motion) =>
          motion.market !== 'Queens, NY, USA'
        ) ||
        result.planSelection?.returnedPlanCount !== 2 ||
        result.planSelection?.acceptedPlanCount !== 2 ||
        result.planSelection?.rejectedPlanCount !== 0 ||
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
    if (result.status !== 'planned' || result.plans.length !== 2 ||
        result.plans.some((motion) =>
          motion.market !== 'Boston, MA, USA'
        ) ||
        result.planSelection?.acceptedPlanCount !== 2 ||
        result.planSelection?.rejectedPlanCount !== 0) {
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
    if (result.status !== 'planned' || result.plans.length !== 2 ||
        result.plans.some((motion) => motion.market !== 'Canada') ||
        result.planSelection?.rejectedPlanCount !== 0) {
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
  const secondRemoteDemand = structuredClone(remoteDemand);
  secondRemoteDemand.id = 'approved_remote_second_compensated_job';
  secondRemoteDemand.priority = 2;
  secondRemoteDemand.market = 'Remote';
  secondRemoteDemand.jobTitle = 'Distributed systems engineer';
  secondRemoteDemand.skills = ['Go', 'Distributed systems'];
  const remote = await run(
    remoteJob,
    [remoteDemand, secondRemoteDemand],
    'generation-approved-remote-market'
  );
  if (remote.status !== 'planned' || remote.plans.length !== 2 ||
      remote.plans.some((motion) =>
        motion.market !== 'Queens, NY, USA'
      ) ||
      remote.planSelection?.rejectedPlanCount !== 0 ||
      remote.sideEffectsPerformed !== 0) {
    throw new Error(
      `remote prose escaped the singleton provider-compatible market authority: ${JSON.stringify(remote)}`
    );
  }

  const qualifiedRemotePlans = [
    structuredClone(remoteDemand),
    structuredClone(secondRemoteDemand)
  ];
  qualifiedRemotePlans[0].market = 'Remote, United States';
  qualifiedRemotePlans[1].market = 'Remote, USA';
  const qualifiedRemote = await run(
    remoteJob,
    qualifiedRemotePlans,
    'generation-approved-country-qualified-remote-market'
  );
  if (qualifiedRemote.status !== 'planned' ||
      qualifiedRemote.plans.length !== 2 ||
      qualifiedRemote.plans.some((motion) =>
        motion.market !== 'Queens, NY, USA'
      ) ||
      qualifiedRemote.planSelection?.rejectedPlanCount !== 0) {
    throw new Error(
      `country-qualified Remote prose escaped the singleton provider-compatible market authority: ${JSON.stringify(qualifiedRemote)}`
    );
  }

  const conflictingRemote = cases[1].plans(evidenceRef)[0];
  conflictingRemote.id = 'conflicting_remote_country';
  conflictingRemote.priority = 1;
  conflictingRemote.market = 'Remote, Canada';
  const approvedRemoteSibling = structuredClone(secondRemoteDemand);
  approvedRemoteSibling.id = 'approved_remote_country_sibling';
  approvedRemoteSibling.priority = 2;
  approvedRemoteSibling.market = 'Remote, United States';
  const remoteConflict = await run(
    remoteJob,
    [conflictingRemote, approvedRemoteSibling],
    'generation-conflicting-remote-country-salvage'
  );
  if (remoteConflict.status !== 'planned' ||
      remoteConflict.plans.length !== 2 ||
      remoteConflict.plans.some((motion) =>
        motion.market !== 'Queens, NY, USA'
      ) ||
      remoteConflict.planSelection?.rejectedPlanCount !== 0) {
    throw new Error(
      `unreachable conflicting Remote prose escaped the singleton schema market: ${JSON.stringify(remoteConflict)}`
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
        remoteRoleSalvage.plans.length !== 2 ||
        remoteRoleSalvage.plans[0]?.market !== 'Queens, NY, USA' ||
        remoteRoleSalvage.plans[1]?.market !== 'Queens, NY, USA' ||
        remoteRoleSalvage.planSelection?.rejectedPlanCount !== 0) {
      throw new Error(
        `Remote plus local scope did not project the professional target onto an exact provider-compatible market: ${JSON.stringify(remoteRoleSalvage)}`
      );
    }
  }

  const explicitRemoteJob = structuredClone(job);
  explicitRemoteJob.payload.commercialContext.profile.availability = '';
  explicitRemoteJob.payload.commercialContext.profile.location = '';
  explicitRemoteJob.payload.commercialContext.profile.serviceAreas = [
    'Remote'
  ];
  const explicitRemotePaidDemand = [
    structuredClone(remoteDemand),
    structuredClone(secondRemoteDemand)
  ];
  for (const motion of explicitRemotePaidDemand) motion.market = 'Remote';
  let remoteOnlyMotionKinds = [];
  let remoteOnlyCalls = 0;
  const explicitRemote = await run(
    explicitRemoteJob,
    explicitRemotePaidDemand,
    'generation-explicit-remote-service-area',
    (request) => {
      remoteOnlyCalls += 1;
      remoteOnlyMotionKinds = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.motionKind?.enum || [];
    }
  );
  if (remoteOnlyCalls !== 1 ||
      explicitRemote.status !== 'planned' ||
      explicitRemote.plans.length !== 2 ||
      explicitRemote.plans.some((motion) =>
        motion.motionKind !== 'compensated_job' ||
        motion.market !== 'Remote'
      ) ||
      JSON.stringify(remoteOnlyMotionKinds) !==
        JSON.stringify(['compensated_job'])) {
    throw new Error(
      `Remote-only scope did not constrain both plans to compensated-job discovery: ${JSON.stringify({ remoteOnlyCalls, remoteOnlyMotionKinds, explicitRemote })}`
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
      negatedRemote.plans.length !== 2 ||
      negatedRemote.plans.some((motion) =>
        motion.market !== 'Queens, NY, USA'
      ) ||
      negatedRemote.planSelection?.rejectedPlanCount !== 0) {
    throw new Error(
      `negated Remote prose escaped the singleton schema market: ${JSON.stringify(negatedRemote)}`
    );
  }
}

async function verifyOmittedChildEvidenceCanonicalization(
  baseJob,
  primaryEvidenceRef
) {
  const job = structuredClone(baseJob);
  job.payload.objective.constraints = Array.from(
    { length: 10 },
    (_, index) =>
      'Approved child-evidence compaction constraint ' + (index + 1) +
      ' remains review-only and source-bound without outreach or publishing ' +
      'while the adaptive schema selects its finite evidence authority.'
  );
  const childFixtures = Array.from({ length: 18 }, (_, index) => {
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
  const completionFor = (candidate, generationId, request, shape) => {
    let motions = twoPlannerMotions(candidate, primaryEvidenceRef);
    motions = shape === 'compact'
      ? compactFreshPlannerPlans(motions)
      : [motions[0], compactFreshPlannerPlans([motions[1]])[0]];
    const exactMarket = request.responseFormat?.json_schema?.schema
      ?.properties?.plans?.items?.properties?.market?.enum?.[0];
    for (const motion of motions) motion.market = exactMarket;
    return {
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: '',
        plans: motions
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
    };
  };
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
    const candidate = shape === 'materialized'
      ? canonicalMaterializedPlannerPlans([
          cases[0].plans(primaryEvidenceRef)[0]
        ])[0]
      : cases[0].plans(primaryEvidenceRef)[0];
    const result = await runOpportunityDiscoveryPlanner({
      job,
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => {
        const visibleRefs = new Set(
          request.responseFormat?.json_schema?.schema?.$defs
            ?.evidenceRef?.enum || []
        );
        const hiddenRefs = childRefs.filter((ref) =>
          !visibleRefs.has(ref)
        ).slice(0, 2);
        if (hiddenRefs.length !== 2) {
          throw new Error(
            `adaptive ${shape} fixture retained every child ref`
          );
        }
        declareChildRefs(candidate, hiddenRefs);
        if (shape === 'compact') {
          candidate.contingentFinalists = compactContingentFinalists(
            candidate.contingentFinalists
          );
        }
        return completionFor(
          candidate,
          `generation-approved-child-${shape}`,
          request,
          shape
        );
      }
    });
    // The adaptive prompt is the complete fresh evidence authority. These
    // otherwise-approved refs were intentionally not selected into its exact
    // schema enum, so both a historical materialized shape and a compact shape
    // that forges them must lose fresh provider/materialization authority.
    const failedClosed = result.status === 'blocked' &&
      result.plans.length === 0 &&
      result.planSelection?.returnedPlanCount === 0 &&
      result.llm?.discoveryPlanner?.status === 'completed' &&
      result.usage?.successfulCalls === 1 &&
      result.normalizationDiagnostic?.code === 'strict_schema_mismatch' &&
      result.normalizationDiagnostic?.failedMotionCount === 1 &&
      result.normalizationDiagnostic?.issues?.some((issue) =>
        shape === 'materialized'
          ? issue.keyword === 'additionalProperties' ||
            issue.keyword === 'required'
          : issue.keyword === 'enum' &&
            issue.instancePath.startsWith('/plans/0/contingentFinalists/')
      );
    if (!failedClosed || result.sideEffectsPerformed !== 0) {
      throw new Error(
        `model-hidden approved child evidence regained fresh ${shape} authority: ${JSON.stringify(result)}`
      );
    }
  }

  for (const shape of ['materialized', 'compact']) {
    const candidate = shape === 'materialized'
      ? canonicalMaterializedPlannerPlans([
          cases[0].plans(primaryEvidenceRef)[0]
        ])[0]
      : cases[0].plans(primaryEvidenceRef)[0];
    declareChildRefs(candidate, ['observation:unapproved-child-ref']);
    if (shape === 'compact') {
      candidate.contingentFinalists = compactContingentFinalists(
        candidate.contingentFinalists
      );
    }
    const result = await runOpportunityDiscoveryPlanner({
      job,
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => completionFor(
        candidate,
        `generation-unknown-child-${shape}`,
        request,
        shape
      )
    });
    const failedClosed = result.status === 'blocked' &&
      result.plans.length === 0 &&
      result.planSelection?.returnedPlanCount === 0 &&
      result.llm?.discoveryPlanner?.status === 'completed' &&
      result.usage?.successfulCalls === 1 &&
      result.normalizationDiagnostic?.code === 'strict_schema_mismatch' &&
      result.normalizationDiagnostic?.failedMotionCount === 1;
    if (!failedClosed || result.sideEffectsPerformed !== 0) {
      throw new Error(
        `unknown ${shape} child evidence did not fail closed: ${JSON.stringify(result)}`
      );
    }
  }

  // The separate maximum-family-containment fixture exercises the full
  // fourteen-visible-ref + local target sentinel boundary. This fixture is
  // intentionally about omitted/model-hidden refs only; fresh authority is
  // exactly the adaptive schema enum, not the larger approved catalog.
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
  const completionFor = (candidate, generationId, request) => {
    const motions = compactFreshPlannerPlans(
      twoPlannerMotions(candidate, primaryEvidenceRef)
    );
    const exactMarket = request.responseFormat?.json_schema?.schema
      ?.properties?.plans?.items?.properties?.market?.enum?.[0];
    for (const motion of motions) motion.market = exactMarket;
    return {
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: '',
        plans: motions
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
    };
  };
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
  const assertStrictSchemaBlocked = (
    result,
    label,
    expectedPathPrefix = '/plans/0/'
  ) => {
    const issues = result.normalizationDiagnostic?.issues;
    if (result.status !== 'blocked' || result.plans.length !== 0 ||
        result.planSelection?.returnedPlanCount !== 0 ||
        result.planSelection?.acceptedPlanCount !== 0 ||
        result.planSelection?.rejectedPlanCount !== 0 ||
        result.llm?.discoveryPlanner?.status !== 'completed' ||
        result.llm?.discoveryPlanner?.error ||
        result.usage?.calls !== 1 || result.usage?.successfulCalls !== 1 ||
        result.normalizationDiagnostic?.code !==
          'strict_schema_mismatch' ||
        result.normalizationDiagnostic?.failedMotionCount !== 1 ||
        !Array.isArray(issues) || issues.length < 1 || issues.length > 8 ||
        !issues.some((issue) =>
          typeof issue.instancePath === 'string' &&
          issue.instancePath.startsWith(expectedPathPrefix)
        ) || result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${label} did not fail at the exact strict-schema boundary: ${JSON.stringify(result)}`
      );
    }
  };

  for (const roleCase of roleCases) {
    const candidate = structuredClone(roleCase.candidate);
    if (candidate.motionKind === 'compensated_job') {
      candidate.paidOffer =
        'A current compensated role matching verified professional skills';
    }
    candidate.contingentFinalists = replaceExactRef(
      compactContingentFinalists(candidate.contingentFinalists),
      targetRef,
      primaryEvidenceRef
    );
    const result = await runOpportunityDiscoveryPlanner({
      job: structuredClone(baseJob),
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => completionFor(
        candidate,
        `generation-omitted-target-${roleCase.label.replace(/\W+/g, '-')}`,
        request
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
            !item.e.includes(primaryEvidenceRef)
          )
        ) &&
        roleCase.ordinaryDimensions.every((dimension) =>
          (family?.d?.[dimension] || []).every((item) =>
            !item.e.includes(targetRef)
          )
        ) &&
        roleCase.targetGrounding.every((role) =>
          groundingRefs(revenue?.g || {}, role).includes(targetRef) &&
          !groundingRefs(revenue?.g || {}, role).includes(primaryEvidenceRef)
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
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => completionFor(
      mixedPaidOfferContamination,
      'generation-mixed-unauthorized-paid-offer-target-evidence',
      request
    )
  });
  assertStrictSchemaBlocked(
    mixedPaidOfferResult,
    'mixed owner/target paid-offer contamination',
    '/plans/0/contingentFinalists/pathBase/'
  );

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
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => completionFor(
      mixedFollowUpContamination,
      'generation-mixed-unauthorized-follow-up-target-evidence',
      request
    )
  });
  assertStrictSchemaBlocked(
    mixedFollowUpResult,
    'mixed owner/target follow-up contamination',
    '/plans/0/contingentFinalists/tactic'
  );

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
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => completionFor(
        assertedFollowUpState,
        `generation-asserted-unverified-follow-up-state-${index + 1}`,
        request
      )
    });
    assertStrictSchemaBlocked(
      assertedFollowUpResult,
      `unverified follow-up state ${assertedState}`,
      '/plans/0/contingentFinalists/tacticA/f/'
    );
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
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => completionFor(
      neutralFollowUp,
      'generation-neutral-bounded-follow-up',
      request
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
    if (candidate.motionKind === 'compensated_job') {
      candidate.paidOffer =
        'A current compensated role matching verified professional skills';
    }
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
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => completionFor(
        candidate,
        `generation-unauthorized-target-${unauthorized.label.replace(/\W+/g, '-')}`,
        request
      )
    });
    assertStrictSchemaBlocked(
      result,
      `target-only unauthorized ${unauthorized.label} grounding`,
      '/plans/0/contingentFinalists/pathBase/r/0/g/'
    );
  }

  const tacticDimensions = new Set(['c', 'a', 'f']);
  for (const roleCase of roleCases) {
    for (const dimension of roleCase.ordinaryDimensions) {
      const candidate = structuredClone(roleCase.candidate);
      if (candidate.motionKind === 'compensated_job') {
        candidate.paidOffer =
          'A current compensated role matching verified professional skills';
      }
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
        model: 'deepseek/deepseek-v4-flash-0731',
        now,
        completeJSON: async (request) => completionFor(
          candidate,
          `generation-unauthorized-target-dimension-${roleCase.label.replace(/\W+/g, '-')}-${dimension}`,
          request
        )
      });
      assertStrictSchemaBlocked(
        result,
        `target-only unauthorized ${roleCase.label} ${dimension} dimension`,
        `/plans/0/contingentFinalists/${
          tacticDimensions.has(dimension) ? 'tacticA' : 'pathBase'
        }/${dimension}/`
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
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => completionFor(
      missingObservation,
      'generation-target-protocol-no-observation',
      request
    )
  });
  assertStrictSchemaBlocked(
    missingObservationResult,
    'missing approved observation evidence',
    '/plans/0/contingentFinalists/'
  );

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
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => completionFor(
      forged,
      'generation-target-protocol-forged-ref',
      request
    )
  });
  assertStrictSchemaBlocked(
    forgedResult,
    'unknown target-protocol evidence reference',
    '/plans/0/contingentFinalists/'
  );
}

async function verifySensitiveTargetFieldPolicy(job, evidenceRef) {
  const preserveMaterialized = new WeakSet();
  const retainMaterialized = (candidate) => {
    preserveMaterialized.add(candidate);
    return candidate;
  };
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
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => {
        const motions = (() => {
          const candidates = twoPlannerMotions(candidate, evidenceRef);
          if (preserveMaterialized.has(candidate)) {
            candidates[1] = compactFreshPlannerPlans([candidates[1]])[0];
            return candidates;
          }
          return compactFreshPlannerPlans(candidates);
        })();
        const exactMarket = request.responseFormat?.json_schema?.schema
          ?.properties?.plans?.items?.properties?.market?.enum?.[0];
        for (const motion of motions) motion.market = exactMarket;
        return ({
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: motions
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
      });
      }
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

  const crossedCanonicalRoute = await run(
    baseReferral({
      id: 'crossed_canonical_public_route',
      acquisitionMechanism: 'Review-first official paid-demand page'
    }),
    'generation-crossed-canonical-public-route'
  );
  if (crossedCanonicalRoute.status !== 'planned' ||
      crossedCanonicalRoute.plans.length !== 2 ||
      crossedCanonicalRoute.plans.find(
        (item) => item.id === 'plan_1_referral_person'
      )?.acquisitionMechanism !==
        'Review-first public professional profile') {
    throw new Error(
      `canonical public-route role projection failed: ${JSON.stringify(crossedCanonicalRoute)}`
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
        'email marketing director',
        'marketing director'
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

  const allowedBoundPublicMessageMotion = retainMaterialized(
    canonicalMaterializedPlannerPlans([baseReferral({
      id: 'safe_bound_public_profile_message',
      acquisitionMechanism:
        'One review-first public-professional-profile referral request'
    })])[0]
  );
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
  if (allowedBoundPublicMessage.status !== 'blocked' ||
      allowedBoundPublicMessage.plans.length !== 0 ||
      allowedBoundPublicMessage.llm?.discoveryPlanner?.status !==
        'completed' ||
      allowedBoundPublicMessage.normalizationDiagnostic?.code !==
        'strict_schema_mismatch') {
    throw new Error(
      `a post-materialization public-message fixture bypassed exact schema validation: ${JSON.stringify(allowedBoundPublicMessage)}`
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
        'telephone triage nurse',
        'clinical triage nurse'
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
      counterparty: 'An Angular core application maintainer',
      paidOffer: 'Paid Angular core consulting and software catalog audit',
      query:
        'Angular application maintainer software catalog audit',
      targetRoleTerms: [
        'Angular software consultant',
        'Software application consultant'
      ],
      skills: ['@angular/core'],
      organizationTerms: ['software publisher'],
      acquisitionMechanism:
        'One review-first invitation through a public professional profile',
      conversionDestination: 'The verified owner proposal page',
      paidConversion: 'One signed paid catalog-audit contract',
      attributionSignal: 'Contract source stores the target and tournament ids',
      rationale:
        'The paid software catalog audit covers ISBN 9780132350884, SKU 123456789012, and GTIN 00012345600012.'
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
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const plans = compactFreshPlannerPlans(twoPlannerMotions(
        replaceEvidenceRef(numericEvidenceMotion),
        numericEvidenceRef
      ));
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const motion of plans) motion.market = exactMarket;
      return ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: '',
        plans
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
    });
    }
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
    item.id === 'plan_1_referral_person'
  );
  if (unusedSensitiveFields.status !== 'planned' ||
      unusedSensitiveFields.plans.length !== 2 ||
      !projectedReferral ||
      projectedReferral.jobTitle !== '' ||
      projectedReferral.skills.length !== 0 ||
      projectedReferral.targetRoleTerms.length !== 0 ||
      projectedReferral.organizationTerms.length !== 0) {
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
    item.id === 'plan_1_referral_org_decision_maker'
  );
  if (localResult.status !== 'planned' || !projectedLocal ||
      projectedLocal.jobTitle !== '' ||
      projectedLocal.skills.length !== 0 ||
      projectedLocal.targetRoleTerms.length !== 0 ||
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
    item.id === 'plan_1_compensated_job'
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

  const publicDemand = plan({
    ...cases[1].plans(evidenceRef)[0],
    id: 'retired_public_live_demand_route',
    motionKind: 'buyer_solicitation',
    searchMode: 'public_live_demand',
    commercialRole: 'paid_demand',
    acquisitionMode: 'permissioned_outreach',
    demandArtifactKind: 'buyer_rfp'
  });
  publicDemand.market = 'Queens, New York, United States';
  publicDemand.targetRoleTerms = ['postpartum patient'];
  publicDemand.organizationTerms = ['pregnant people'];
  publicDemand.jobTitle = 'newborn patient';
  publicDemand.skills = ['family health status'];
  const publicResult = await run(
    publicDemand,
    'generation-public-demand-unused-sensitive-filter-fields'
  );
  if (publicResult.status !== 'blocked' ||
      publicResult.plans.length !== 0 ||
      publicResult.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      !publicResult.normalizationDiagnostic?.issues?.some((issue) =>
        issue.keyword === 'enum' &&
        issue.instancePath === '/plans/0/motionKind'
      )) {
    throw new Error(
      `retired public-live-demand route regained fresh authority: ${JSON.stringify(publicResult)}`
    );
  }

  const materializedRouteCandidate = (id, label) => {
    const candidate = canonicalMaterializedPlannerPlans([
      baseReferral({ id })
    ])[0];
    candidate.contingentFinalists.familyA.d.a[0].l = label;
    candidate.contingentFinalists.familyA.d.r[0].c = label;
    return retainMaterialized(candidate);
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
        const candidate = canonicalMaterializedPlannerPlans([
          baseReferral({ id: 'materialized_family_private_route' })
        ])[0];
        candidate.contingentFinalists.familyA.l = 'Email outreach route';
        return retainMaterialized(candidate);
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
      candidate: materializedRouteCandidate(
        'literal_phone_value',
        'After approval, call 917-555-0123, then ask {{TARGET_NAME}} to refer one family through public professional profile {{TARGET_URL}}.'
      ),
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
      candidate: materializedRouteCandidate(
        'literal_unlabeled_compact_phone_value',
        'After approval, use 9175550123, then ask {{TARGET_NAME}} to refer one family through public professional profile {{TARGET_URL}}.'
      ),
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
      reason: /missing rationale|private-contact data \[private_contact_value\]/i
    },
    {
      label: 'explicit private-data retrieval outside route fields',
      candidate: baseReferral({
        id: 'ignored_rationale_retrieval',
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
        id: 'ignored_rationale_double_negative',
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
    ].map(([id, rationale], index) => ({
      label: `explicit private-data request ${id}`,
      candidate: baseReferral({
        id: `ignored_rationale_request_${index + 1}`,
        rationale
      }),
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
      reason: /complementary professional referral|sensitive care recipient/i
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
    if (preserveMaterialized.has(adversary.candidate)) {
      const encoded = JSON.stringify(result);
      if (result.status !== 'blocked' || result.plans.length !== 0 ||
          result.planSelection?.returnedPlanCount !== 0 ||
          result.planSelection?.acceptedPlanCount !== 0 ||
          result.planSelection?.rejectedPlanCount !== 0 ||
          result.usage?.calls !== 1 ||
          result.usage?.successfulCalls !== 1 ||
          result.normalizationDiagnostic?.code !==
            'strict_schema_mismatch' ||
          result.normalizationDiagnostic?.failedMotionCount !== 1 ||
          !Array.isArray(result.normalizationDiagnostic?.issues) ||
          result.normalizationDiagnostic.issues.length < 1 ||
          result.normalizationDiagnostic.issues.length > 8 ||
          encoded.includes(adversary.candidate.id) ||
          encoded.includes(adversary.candidate.contingentFinalists
            ?.familyA?.l || '__no_family_label__') ||
          result.sideEffectsPerformed !== 0) {
        throw new Error(
          `${adversary.label} materialized non-wire response was not rejected at the exact schema boundary: ${encoded}`
        );
      }
      continue;
    }
    const rationaleOnly = new Set([
      'literal email is forbidden even in descriptive prose',
      'obfuscated literal email is forbidden',
      'compact literal phone is forbidden',
      'international literal phone is forbidden',
      'parenthesized literal phone is forbidden',
      'slash-separated literal phone is forbidden',
      'unicode-dash literal phone is forbidden',
      'fullwidth literal phone is forbidden',
      'UK local literal phone is forbidden',
      'country-code literal phone without plus is forbidden',
      'fullwidth-at email literal is forbidden',
      'zero-width email literal is forbidden',
      'explicit private-data retrieval outside route fields',
      'social handle with a trailing slash is forbidden',
      'double-negative private-data retrieval'
    ]).has(adversary.label) ||
      adversary.label.startsWith('explicit private-data request ');
    const locallyCanonicalized = rationaleOnly || new Set([
      'direct sensitive role',
      'sensitive organization target',
      'private contact request',
      'two sensitive clauses cannot share one service relation',
      'patient lead-list server search',
      'contact-directory search',
      'direct pregnant-people role',
      'sensitive population as search subject',
      'non-referral patient query'
    ]).has(adversary.label) ||
      adversary.label.startsWith('bare private-contact intent:');
    if (locallyCanonicalized) {
      if (result.status !== 'planned' || result.plans.length !== 2 ||
          result.planSelection?.acceptedPlanCount !== 2 ||
          result.planSelection?.rejectedPlanCount !== 0 ||
          result.plans[0]?.targetRoleTerms?.length !== 0 ||
          result.plans[0]?.organizationTerms?.length !== 0 ||
          result.plans[0]?.acquisitionMechanism !==
            'Review-first public professional profile' ||
          result.plans[0]?.rationale !== '' ||
          /patient|pregnant|email|phone|lead list/i.test(
            result.plans[0]?.query || ''
          ) || result.sideEffectsPerformed !== 0) {
        throw new Error(
          `${adversary.label} was not discarded before safety and provider authority: ${JSON.stringify(result)}`
        );
      }
      continue;
    }
    const rejection = result.planSelection?.rejectedPlans?.[0]?.reason || '';
    if (adversary.label ===
          'literal email is forbidden even in descriptive prose' &&
        !/\[private_contact_value\] at rationale\./i.test(rejection)) {
      throw new Error(
        `private-contact rejection lost its safe field path: ${rejection}`
      );
    }
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
    if (result.status !== 'planned' ||
        result.reason !== '' ||
        result.plans.length !== 2 ||
        /person@example\.com/i.test(JSON.stringify(result)) ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `non-authoritative wrapper reason was not discarded safely: ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyDiscoveryRoleAndAdapterInvariants(job, evidenceRef) {
  const capabilities = opportunityCommercialDiscoveryCapabilities();
  const manifest = capabilities.professionalRoleQuery;
  if (manifest.contractVersion !== PROFESSIONAL_ROLE_QUERY_CONTRACT ||
      manifest.subroleField !== 'targetRoleSubrole' ||
      manifest.roleField !== 'targetRoleRole' ||
      manifest.taxonomyVersion !== 'pdl_job_title_taxonomy_v29.1' ||
      manifest.canonicalDataVersion !== '34.2' ||
      manifest.taxonomyMappingSha256 !==
        PROFESSIONAL_ROLE_QUERY_TAXONOMY_MAPPING_SHA256 ||
      manifest.supportedSubroleCount !== 104 ||
      JSON.stringify(manifest.excludedSubroles) !==
        JSON.stringify(['student', 'unemployed']) ||
      JSON.stringify(manifest.appliesTo) !== JSON.stringify([
        'professional_counterparty',
        'local_organization:organization_then_decision_maker'
      ]) ||
      JSON.stringify(manifest.providerFields) !== JSON.stringify({
        subrole: 'job_title_sub_role',
        role: 'job_title_role',
        levels: 'job_title_levels',
        requiredDataInclude: [
          'job_title_levels',
          'job_title_role',
          'job_title_sub_role'
        ],
        rejectedLevels: ['training', 'unpaid']
      }) ||
      JSON.stringify(capabilities.targetBindingLimits) !== JSON.stringify({
        targetNameMaxRunes: 180,
        targetPublicUrlMaxChars: 240,
        boundBuyerLabelMaxChars: 320,
        boundChannelLabelMaxChars: 400,
        boundActionLabelMaxChars: 700
      }) ||
      JSON.stringify(capabilities.freshExecutionRoutes) !== JSON.stringify([
        {
          motionKind: 'referral_person',
          searchMode: 'professional_counterparty',
          commercialRole: 'referral_partner',
          acquisitionMode: 'partner_channel',
          demandArtifactKinds: ['not_applicable'],
          providerSequences: [
            ['people_data_labs_person_search'],
            ['brave_web_search']
          ]
        },
        {
          motionKind: 'referral_org_decision_maker',
          searchMode: 'local_organization',
          commercialRole: 'referral_partner',
          acquisitionMode: 'partner_channel',
          demandArtifactKinds: ['not_applicable'],
          providerSequences: [
            ['brave_web_search', 'people_data_labs_person_search'],
            [
              'openrouter_exa_web_search',
              'people_data_labs_person_search'
            ]
          ]
        },
        {
          motionKind: 'direct_buyer_person',
          searchMode: 'professional_counterparty',
          commercialRole: 'buyer',
          acquisitionMode: 'permissioned_outreach',
          demandArtifactKinds: ['not_applicable'],
          providerSequences: [
            ['people_data_labs_person_search'],
            ['brave_web_search']
          ]
        },
        {
          motionKind: 'direct_buyer_org_decision_maker',
          searchMode: 'local_organization',
          commercialRole: 'buyer',
          acquisitionMode: 'permissioned_outreach',
          demandArtifactKinds: ['not_applicable'],
          providerSequences: [
            ['brave_web_search', 'people_data_labs_person_search'],
            [
              'openrouter_exa_web_search',
              'people_data_labs_person_search'
            ]
          ]
        },
        {
          motionKind: 'compensated_job',
          searchMode: 'active_job_posting',
          commercialRole: 'paid_demand',
          acquisitionMode: 'permissioned_outreach',
          demandArtifactKinds: ['employer_job_posting'],
          providerSequences: [['people_data_labs_job_posting_search']]
        }
      ]) ||
      JSON.stringify(capabilities.plannerResponseBounds) !== JSON.stringify({
        runtimeParsedResponseMaxBytes:
          MAX_DISCOVERY_PLANNER_RESPONSE_BYTES,
        rawStreamingContentMaxBytes:
          MAX_DISCOVERY_PLANNER_RAW_STREAM_CONTENT_BYTES,
        contingentBundleMaxBytes:
          MAX_DISCOVERY_PLANNER_CONTINGENT_BUNDLE_BYTES,
        computedSchemaUpperBoundBytes:
          MAX_DISCOVERY_PLANNER_SCHEMA_RESPONSE_BOUND_BYTES,
        evidenceRefMaxRunes: 64,
        evidenceRefMaxBytes: 64
      }) ||
      JSON.stringify(capabilities.plannerCallEnvelope) !== JSON.stringify({
        model: 'openai/gpt-5.6-luna',
        models: ['openai/gpt-5.6-luna'],
        modelRoutes: [
          {
            id: 'openai/gpt-5.6-luna',
            family: 'openai',
            minimumContextTokens: 1_050_000,
            minimumOutputTokens: 42_000,
            maximumPromptPrice: 0.2,
            maximumCompletionPrice: 1.2,
            requiredParameters: [
              'max_tokens',
              'reasoning',
              'response_format',
              'structured_outputs'
            ]
          }
        ],
        providerPriceCaps: {
          prompt: 0.2,
          completion: 1.2,
          request: 0
        },
        providerRouting: {
          order: ['openai'],
          only: ['openai'],
          ignore: [],
          allow_fallbacks: false,
          require_parameters: true,
          data_collection: 'deny',
          routerMetadata: 'enabled'
        },
        framingTokenReserve: 1_024,
        generator: {
          providerPriceCaps: {
            prompt: 0.2,
            completion: 1.2,
            request: 0
          },
          structuredOutputProjection: {
            contractVersion:
              'opportunity_discovery_provider_schema_projection_v1',
            omittedPatternPathsSha256:
              'd0c9fd558f52f3a58e427efd7e0745b96e78a5bddbaa6ee7df859639de959c70',
            omittedPatternCount: 14,
            localExactSchemaRequired: true
          },
          reasoning: { effort: 'none', exclude: true },
          pluginIds: [],
          requestMaxBytes: 44 * 1_024,
          promptTokenCeiling: DISCOVERY_PLANNER_PROMPT_TOKEN_CEILING,
          outputTokenCeiling: DISCOVERY_PLANNER_MAX_OUTPUT_TOKENS,
          streaming: {
            enabled: true,
            includeUsage: true,
            responseStartTimeoutMs: 180_000,
            idleTimeoutMs: 60_000,
            totalTimeoutMs: 300_000,
            wireResponseMaxBytes: 16 * 1024 * 1024
          },
          framingTokenReserve: 1_024,
          fixedToolFeeMicros: 0,
          callSpendCeilingMicros:
            DISCOVERY_PLANNER_CALL_SPEND_CEILING_MICROS
        },
        critic: {
          providerPriceCaps: {
            prompt: 0.2,
            completion: 1.2,
            request: 0
          },
          reasoning: { effort: 'none', exclude: true },
          pluginIds: ['response-healing'],
          requestMaxBytes: 64 * 1_024,
          promptTokenCeiling: 65_536 + 2_048,
          outputTokenCeiling: 2_000,
          timeoutMs: 120_000,
          runtimeParsedResponseMaxBytes: 16 * 1_024,
          bufferedWireResponseMaxBytes: 160 * 1_024,
          framingTokenReserve: 2_048,
          fixedToolFeeMicros: 0,
          callSpendCeilingMicros: 15_917
        },
        interstageCommercialDiscovery: {
          providerCalls: 2,
          perCallTimeoutMs: 6_000,
          totalAllowanceMs: 12_000
        }
      })) {
    throw new Error(
      `professional-role capability manifest drifted: ${JSON.stringify(manifest)}`
    );
  }
  const callEnvelope = capabilities.plannerCallEnvelope;
  if (capabilities.plannerResponseBounds.rawStreamingContentMaxBytes <
        capabilities.plannerResponseBounds.runtimeParsedResponseMaxBytes * 4 ||
      capabilities.plannerResponseBounds.rawStreamingContentMaxBytes >
        callEnvelope.critic.bufferedWireResponseMaxBytes ||
      callEnvelope.generator.streaming.wireResponseMaxBytes !==
        16 * 1024 * 1024 ||
      capabilities.plannerResponseBounds.rawStreamingContentMaxBytes >=
        callEnvelope.generator.streaming.wireResponseMaxBytes) {
    throw new Error('planner raw/canonical response bound relation drifted');
  }
  const recomputedPlannerCallSpendCeilingMicros =
    Math.ceil(
      callEnvelope.generator.promptTokenCeiling *
        callEnvelope.generator.providerPriceCaps.prompt
    ) +
    Math.ceil(
      callEnvelope.generator.outputTokenCeiling *
        callEnvelope.generator.providerPriceCaps.completion
    ) +
    Math.ceil(
      callEnvelope.generator.providerPriceCaps.request *
        1_000_000
    ) +
    callEnvelope.generator.fixedToolFeeMicros;
  if (recomputedPlannerCallSpendCeilingMicros !==
      callEnvelope.generator.callSpendCeilingMicros) {
    throw new Error('planner call-spend capability derivation drifted');
  }
  const recomputedCriticCallSpendCeilingMicros =
    Math.ceil(
      callEnvelope.critic.promptTokenCeiling *
        callEnvelope.critic.providerPriceCaps.prompt
    ) +
    Math.ceil(
      callEnvelope.critic.outputTokenCeiling *
        callEnvelope.critic.providerPriceCaps.completion
    ) + callEnvelope.critic.fixedToolFeeMicros;
  if (recomputedCriticCallSpendCeilingMicros !==
      callEnvelope.critic.callSpendCeilingMicros) {
    throw new Error('critic call-spend capability derivation drifted');
  }
  if (recomputedPlannerCallSpendCeilingMicros +
      recomputedCriticCallSpendCeilingMicros !==
        OPPORTUNITY_TOURNAMENT_LLM_SPEND_RESERVE_MICROS) {
    throw new Error('opportunity tournament LLM spend reserve drifted');
  }
  if (callEnvelope.generator.streaming.totalTimeoutMs +
      callEnvelope.interstageCommercialDiscovery.totalAllowanceMs +
      callEnvelope.critic.timeoutMs !== 432_000 ||
      callEnvelope.interstageCommercialDiscovery.providerCalls *
        callEnvelope.interstageCommercialDiscovery.perCallTimeoutMs !==
          callEnvelope.interstageCommercialDiscovery.totalAllowanceMs ||
      600_000 - 432_000 !== 168_000) {
    throw new Error('opportunity tournament end-to-end timing bound drifted');
  }

  const candidate = (overrides = {}) => {
    const motion = plan({
      id: 'canonical_role_query_fixture',
      priority: 77,
      motionKind: 'direct_buyer_person',
      searchMode: 'professional_counterparty',
      commercialRole: 'buyer',
      acquisitionMode: 'permissioned_outreach',
      buyer:
        'An institutional buyer purchasing a current paid advisory service',
      counterparty: 'One exact public professional decision-maker',
      paidOffer: 'Paid advisory engagement',
      evidenceRefs: [evidenceRef],
      query: 'patients private email directory Remote',
      market: 'Remote',
      targetRoleSubrole: 'executive',
      targetRoleRole: 'forged_role',
      targetRoleTerms: ['postpartum patient'],
      organizationTerms: ['Model-forged organization filter'],
      jobTitle: 'Ignored schema filler',
      skills: ['ignored'],
      professionalRoleQueryContract: 'professional_role_query_v999',
      acquisitionMechanism: 'Private email outreach',
      conversionDestination: 'The verified owner booking page',
      paidConversion: 'One signed paid advisory engagement',
      attributionSignal:
        'CRM source stores target and tournament action ids',
      ...overrides
    });
    motion.evidenceRefs = ['forged:top-level-evidence', evidenceRef];
    return motion;
  };
  const run = async (motion, generationId, inspectRequest) =>
    runOpportunityDiscoveryPlanner({
      job: structuredClone(job),
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => {
        inspectRequest?.(request);
        const motions = compactFreshPlannerPlans(
          twoPlannerMotions(motion, evidenceRef)
        );
        const exactMarket = request.responseFormat?.json_schema?.schema
          ?.properties?.plans?.items?.properties?.market?.enum?.[0];
        for (const item of motions) item.market = exactMarket;
        return {
          data: {
            contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
            status: 'planned',
            reason: '',
            plans: motions
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
        };
      }
    });

  let roleSchema;
  let roleSchemaDefinitions = {};
  const baseline = await run(
    candidate(),
    'generation-canonical-role-query-baseline',
    (request) => {
      roleSchema = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items;
      roleSchemaDefinitions = request.responseFormat?.json_schema?.schema
        ?.$defs || {};
    }
  );
  const subroles = roleSchema?.properties?.targetRoleSubrole?.enum || [];
  if (roleSchema?.properties?.targetRoleTerms !== undefined ||
      roleSchema?.properties?.professionalRoleQueryContract !== undefined ||
      roleSchema?.properties?.targetRoleRole !== undefined ||
      roleSchema?.properties?.query !== undefined ||
      roleSchema?.properties?.evidenceRefs !== undefined ||
      roleSchema?.properties?.demandArtifactKind !== undefined ||
      new RegExp(
        roleSchemaDefinitions[
          roleSchema?.properties?.jobTitle?.$ref?.split('/').at(-1)
        ]?.pattern || roleSchema?.properties?.jobTitle?.pattern || ''
      )
        .test('') ||
      subroles.length !== 104 || subroles.includes('student') ||
      subroles.includes('unemployed')) {
    throw new Error(
      `fresh role-query schema retained non-authoritative or non-total fields: ${JSON.stringify(roleSchema)}`
    );
  }
  const baselineMotion = baseline.plans.find((motion) =>
    motion.id === 'plan_1_direct_buyer_person'
  );
  if (baseline.status !== 'planned' || !baselineMotion ||
      baselineMotion.professionalRoleQueryContract !==
        PROFESSIONAL_ROLE_QUERY_CONTRACT ||
      baselineMotion.targetRoleSubrole !== 'executive' ||
      baselineMotion.targetRoleRole !== 'operations' ||
      baselineMotion.targetRoleTerms.length !== 0 ||
      baselineMotion.organizationTerms.length !== 0 ||
      baselineMotion.market !== 'Queens, NY, USA' ||
      baselineMotion.query !== 'executive Queens, NY, USA' ||
      baselineMotion.acquisitionMechanism !==
        'Review-first public professional profile' ||
      baselineMotion.evidenceRefs.includes('forged:top-level-evidence') ||
      !baselineMotion.evidenceRefs.includes(evidenceRef)) {
    throw new Error(
      `fresh role-query authority was not deterministic: ${JSON.stringify(baseline)}`
    );
  }

  const strictMotion = (motion, request) => ({
    motionKind: motion.motionKind,
    paidOffer: motion.paidOffer,
    market: request.responseFormat.json_schema.schema
      .properties.plans.items.properties.market.enum[0],
    targetRoleSubrole: motion.targetRoleSubrole,
    organizationTerms: motion.organizationTerms?.length > 0
      ? motion.organizationTerms
      : ['Verified professional organization'],
    jobTitle: motion.jobTitle || 'Verified professional role',
    skills: motion.skills?.length > 0
      ? motion.skills
      : ['Verified professional skill'],
    contingentFinalists: motion.contingentFinalists
  });
  const roleAuthoredPrimary = compactFreshPlannerPlans([candidate()])[0];
  // Buyer labels are deliberately role-neutral protocol text; use
  // non-catalogue channel and action strings to prove the substantive
  // selected values remain model-authored and byte-for-byte stable.
  for (const [tacticIndex, tacticKey] of ['tacticA', 'tacticB'].entries()) {
    const tactic = roleAuthoredPrimary.contingentFinalists[tacticKey];
    tactic.c.forEach((item, index) => {
      item.l = `Review-first verified professional profile {{TARGET_URL}} for executive purchase route ${tacticIndex + 1}${index + 1}`;
    });
    tactic.a.forEach((item, index) => {
      item.l = `After approval via verified professional profile {{TARGET_URL}}, request {{TARGET_NAME}} to buy the current paid advisory service option ${tacticIndex + 1}${index + 1}`;
    });
  }
  roleAuthoredPrimary.contingentFinalists.tacticB.a.reverse();
  const roleAuthoredExpected = {
    paidOffer: roleAuthoredPrimary.paidOffer.seller,
    mechanism:
      roleAuthoredPrimary.contingentFinalists.pathBase.r[0].rm.seller,
    buyers: roleAuthoredPrimary.contingentFinalists.pathBase.b
      .map((item) => item.l.buyer),
    channels: [
      roleAuthoredPrimary.contingentFinalists.tacticA.c
        .map((item) => item.l),
      roleAuthoredPrimary.contingentFinalists.tacticB.c
        .map((item) => item.l)
    ],
    actions: [
      roleAuthoredPrimary.contingentFinalists.tacticA.a
        .map((item) => item.l),
      roleAuthoredPrimary.contingentFinalists.tacticB.a
        .map((item) => item.l)
    ]
  };
  const roleAuthoredResult = await runOpportunityDiscoveryPlanner({
    job: structuredClone(job),
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: '',
        plans: [
          strictMotion(roleAuthoredPrimary, request),
          strictMotion(compactFreshPlannerPlans(
            twoPlannerMotions(candidate(), evidenceRef)
          )[1], request)
        ]
      },
      usage,
      generationId: 'generation-role-authored-branch-selection',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 900,
        contentSha256: '9'.repeat(64)
      },
      annotations: []
    })
  });
  const selectedMotion = roleAuthoredResult.plans.find((item) =>
    item.id === 'plan_1_direct_buyer_person'
  );
  const selectedFamilies = ['familyA', 'familyB'].map((familyKey) =>
    selectedMotion?.contingentFinalists?.[familyKey]
  );
  if (roleAuthoredResult.status !== 'planned' ||
      roleAuthoredResult.plans.length !== 2 || !selectedMotion ||
      selectedMotion.paidOffer !== roleAuthoredExpected.paidOffer ||
      selectedFamilies.some((family, familyIndex) =>
        family?.d?.r?.[0]?.rm !== roleAuthoredExpected.mechanism ||
        family?.d?.r?.[0]?.k?.v !== 'revenue_causal_witness_v2' ||
        family?.d?.r?.[0]?.k?.n !== 14 ||
        family?.d?.r?.[0]?.k?.u !== 'calendar_days' ||
        JSON.stringify(family?.d?.b?.map((item) => item.l)) !==
          JSON.stringify(roleAuthoredExpected.buyers) ||
        JSON.stringify(family?.d?.c?.map((item) => item.l)) !==
          JSON.stringify(roleAuthoredExpected.channels[familyIndex]) ||
        JSON.stringify(family?.d?.a?.map((item) => item.l)) !==
          JSON.stringify(roleAuthoredExpected.actions[familyIndex]) ||
        family?.d?.r?.[0]?.c !==
          roleAuthoredExpected.actions[familyIndex][0]
      ) || roleAuthoredResult.normalizationDiagnostic) {
    throw new Error(
      `model-authored role branch was not selected byte-for-byte: ${JSON.stringify({ roleAuthoredExpected, roleAuthoredResult })}`
    );
  }

  const invalidLabelPrimary = structuredClone(roleAuthoredPrimary);
  invalidLabelPrimary.contingentFinalists.tacticA.a[0].l =
    'After review, inspect scheduling and write an operational report.';
  const invalidLabelResult = await runOpportunityDiscoveryPlanner({
    job: structuredClone(job),
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: '',
        plans: [
          strictMotion(invalidLabelPrimary, request),
          strictMotion(compactFreshPlannerPlans(
            twoPlannerMotions(candidate(), evidenceRef)
          )[1], request)
        ]
      },
      usage,
      generationId: 'generation-strict-schema-arbitrary-action',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 900,
        contentSha256: '8'.repeat(64)
      },
      annotations: []
    })
  });
  if (invalidLabelResult.status !== 'blocked' ||
      invalidLabelResult.plans.length !== 0 ||
      invalidLabelResult.planSelection?.returnedPlanCount !== 0 ||
      invalidLabelResult.llm?.discoveryPlanner?.status !== 'completed' ||
      invalidLabelResult.llm?.discoveryPlanner?.error ||
      invalidLabelResult.usage?.successfulCalls !== 1 ||
      invalidLabelResult.normalizationDiagnostic?.contractVersion !==
        OPPORTUNITY_DISCOVERY_PLANNER_DIAGNOSTIC_CONTRACT ||
      invalidLabelResult.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      invalidLabelResult.normalizationDiagnostic?.failedMotionCount !== 1 ||
      !Array.isArray(invalidLabelResult.normalizationDiagnostic?.issues) ||
      invalidLabelResult.normalizationDiagnostic.issues.length < 1 ||
      invalidLabelResult.normalizationDiagnostic.issues.length > 8 ||
      invalidLabelResult.normalizationDiagnostic.issues.some((issue) =>
        !['required', 'additionalProperties', 'type', 'enum', 'const',
          'pattern', 'minLength', 'maxLength', 'minItems', 'maxItems',
          'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
          'format']
          .includes(issue?.keyword) ||
        typeof issue?.instancePath !== 'string' ||
        issue.instancePath.length > 160 ||
        !/^(?:\/(?:[A-Za-z0-9_-]|~0|~1)*)*$/u.test(issue.instancePath) ||
        Object.keys(issue).some((key) =>
          !['keyword', 'instancePath', 'missingProperty'].includes(key)
        ) ||
        (Object.hasOwn(issue, 'missingProperty') &&
          !/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(issue.missingProperty))
      ) ||
      JSON.stringify(invalidLabelResult.normalizationDiagnostic).includes(
        'inspect scheduling'
      ) || JSON.stringify(invalidLabelResult.normalizationDiagnostic).includes(
        'must be equal to one of the allowed values'
      ) || invalidLabelResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `arbitrary schema-invalid action reached normalization: ${JSON.stringify(invalidLabelResult)}`
    );
  }

  const derivedMappingLines = [];
  for (const subrole of subroles) {
    const result = await run(candidate({
      targetRoleSubrole: subrole
    }), `generation-canonical-subrole-${subrole}`);
    const motion = result.plans.find((item) =>
      item.id === 'plan_1_direct_buyer_person'
    );
    const label = subrole.replaceAll('_', ' ');
    if (result.status !== 'planned' || result.plans.length !== 2 ||
        result.planSelection?.rejectedPlanCount !== 0 || !motion ||
        motion.professionalRoleQueryContract !==
          PROFESSIONAL_ROLE_QUERY_CONTRACT ||
        motion.targetRoleSubrole !== subrole ||
        !motion.targetRoleRole || motion.targetRoleTerms.length !== 0 ||
        motion.organizationTerms.length !== 0 ||
        motion.query !== `${label} Queens, NY, USA`) {
      throw new Error(
        `schema-valid canonical subrole ${subrole} did not normalize without a semantic family rejection: ${JSON.stringify(result)}`
      );
    }
    derivedMappingLines.push(`${subrole}=${motion.targetRoleRole}\n`);
  }
  const derivedMappingSha256 = createHash('sha256')
    .update([...derivedMappingLines].sort().join(''))
    .digest('hex');
  if (derivedMappingSha256 !==
      PROFESSIONAL_ROLE_QUERY_TAXONOMY_MAPPING_SHA256) {
    throw new Error(
      `canonical subrole-to-role mapping fingerprint drifted: ${derivedMappingSha256}`
    );
  }

  for (const [label, mutate] of [
    ['missing', (motion) => { delete motion.targetRoleSubrole; }],
    ['unknown', (motion) => { motion.targetRoleSubrole = 'not_canonical'; }],
    ['student', (motion) => { motion.targetRoleSubrole = 'student'; }],
    ['unemployed', (motion) => { motion.targetRoleSubrole = 'unemployed'; }]
  ]) {
    const adversary = candidate();
    mutate(adversary);
    const result = await run(
      adversary,
      `generation-${label}-canonical-subrole`
    );
    if (result.status !== 'blocked' || result.plans.length !== 0 ||
        result.planSelection?.returnedPlanCount !== 0 ||
        result.llm?.discoveryPlanner?.status !== 'completed' ||
        result.usage?.successfulCalls !== 1 ||
        result.normalizationDiagnostic?.code !==
          'strict_schema_mismatch' ||
        !result.normalizationDiagnostic?.issues?.some((issue) =>
          (issue.instancePath === '/plans/0/targetRoleSubrole' &&
            issue.keyword === 'enum') ||
          (issue.instancePath === '/plans/0' &&
            issue.keyword === 'required' &&
            issue.missingProperty === 'targetRoleSubrole')
        ) || result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${label} canonical subrole escaped fresh validation: ${JSON.stringify(result)}`
      );
    }
  }

  const nonPerson = structuredClone(cases[1].plans(evidenceRef)[0]);
  nonPerson.targetRoleSubrole = 'doctor';
  nonPerson.targetRoleRole = 'health';
  nonPerson.targetRoleTerms = ['postpartum patient'];
  nonPerson.organizationTerms = ['pregnant people'];
  nonPerson.professionalRoleQueryContract =
    'professional_role_query_v999';
  nonPerson.market = 'Queens, New York, United States';
  nonPerson.query = 'patient private email directory Remote';
  const nonPersonResult = await run(
    nonPerson,
    'generation-model-forged-nonperson-role-authority'
  );
  const normalizedNonPerson = nonPersonResult.plans.find((motion) =>
    motion.id === 'plan_1_compensated_job'
  );
  if (nonPersonResult.status !== 'planned' || !normalizedNonPerson ||
      normalizedNonPerson.professionalRoleQueryContract ||
      normalizedNonPerson.targetRoleSubrole ||
      normalizedNonPerson.targetRoleRole ||
      normalizedNonPerson.targetRoleTerms.length !== 0 ||
      normalizedNonPerson.organizationTerms.length !== 0 ||
      /patient|email|remote/i.test(normalizedNonPerson.query || '')) {
    throw new Error(
      `model-forged nonperson role authority was not dropped: ${JSON.stringify(nonPersonResult)}`
    );
  }

  const localOrganization = structuredClone(
    cases[0].plans(evidenceRef)[1]
  );
  localOrganization.targetRoleSubrole = 'partnerships';
  localOrganization.organizationTerms = ['Civic Data Lab'];
  const localResult = await run(
    localOrganization,
    'generation-local-organization-role-context'
  );
  const normalizedLocal = localResult.plans.find((motion) =>
    motion.id === 'plan_1_referral_org_decision_maker'
  );
  if (!normalizedLocal || normalizedLocal.targetRoleRole !== 'partnerships' ||
      JSON.stringify(normalizedLocal.organizationTerms) !==
        JSON.stringify(['Civic Data Lab']) ||
      normalizedLocal.query !==
        'partnerships Civic Data Lab Queens, NY, USA') {
    throw new Error(
      `local organization context did not remain bound to the canonical role query: ${JSON.stringify(localResult)}`
    );
  }
  const missingOrganization = structuredClone(localOrganization);
  missingOrganization.organizationTerms = [];
  const missingOrganizationResult = await run(
    missingOrganization,
    'generation-local-organization-context-missing'
  );
  if (missingOrganizationResult.status !== 'planned' ||
      missingOrganizationResult.plans.length !== 1 ||
      !/local organization searches require bounded organization context/i.test(
        missingOrganizationResult.planSelection?.rejectedPlans?.[0]
          ?.reason || ''
      )) {
    throw new Error(
      `local organization search accepted an unbound organization seed: ${JSON.stringify(missingOrganizationResult)}`
    );
  }

  const persistedEnvelope = (planResult, suffix) => ({
    contractVersion: COMMERCIAL_DISCOVERY_EVIDENCE_CONTRACT,
    status: 'not_found',
    attempted: true,
    motion: planResult.plans[0].id,
    buyerArchetype: planResult.plans[0].buyer,
    market: planResult.plans[0].market,
    queryHash: createHash('sha256').update(suffix).digest('hex'),
    providersAttempted: ['people_data_labs_person_search'],
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
  for (const [label, mutate, expected] of [
    [
      'mismatched role',
      (planResult) => { planResult.plans[0].targetRoleRole = 'sales'; },
      /exact canonical role derived from targetRoleSubrole/i
    ],
    [
      'unknown marker',
      (planResult) => {
        planResult.plans[0].professionalRoleQueryContract =
          'professional_role_query_v999';
      },
      /unsupported professional role query contract/i
    ],
    [
      'missing marker',
      (planResult) => {
        delete planResult.plans[0].professionalRoleQueryContract;
      },
      /mixes canonical v2 role fields/i
    ]
  ]) {
    const persisted = structuredClone(baseline);
    mutate(persisted);
    const normalized = normalizeCommercialDiscoveryEvidence(
      persistedEnvelope(persisted, label),
      now
    );
    if (normalized.valid !== false || normalized.plan?.valid !== false ||
        !expected.test(normalized.plan?.rejectedReason || '')) {
      throw new Error(
        `${label} escaped durable role-query validation: ${JSON.stringify(normalized)}`
      );
    }
  }

  const historical = structuredClone(baseline);
  for (const motion of historical.plans) {
    if (!motion.professionalRoleQueryContract) continue;
    motion.professionalRoleQueryContract = 'professional_role_query_v1';
    delete motion.targetRoleSubrole;
    delete motion.targetRoleRole;
    motion.targetRoleTerms = [
      'operations director',
      'director of operations'
    ];
  }
  const readableHistorical = normalizeCommercialDiscoveryEvidence(
    persistedEnvelope(historical, 'historical-v1-readable'),
    now
  );
  if (readableHistorical.valid !== true ||
      readableHistorical.plan?.valid !== true ||
      readableHistorical.plan?.plans?.some((motion) =>
        motion.professionalRoleQueryContract ===
          PROFESSIONAL_ROLE_QUERY_CONTRACT
      )) {
    throw new Error(
      `historical v1 role-query plan lost read compatibility: ${JSON.stringify(readableHistorical)}`
    );
  }
}

async function verifyLegacyDiscoveryRoleAndAdapterInvariants(
  job,
  evidenceRef
) {
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
    targetRoleTerms: ['operations director', 'director of operations'],
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
      model: 'deepseek/deepseek-v4-flash-0731',
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

  let productionPartnershipsPlan;
  for (const [label, targetRoleTerms] of [
    [
      'sustainability',
      ['ESG Consultant', 'Sustainability Consultant', 'Climate Consultant']
    ],
    ['accounting', ['Accountant', 'Bookkeeper']],
    ['business', ['Business Advisor', 'Business Consultant']],
    ['engineering', ['Software Engineer', 'Technical Developer']],
    ['pediatric', ['Pediatrician', 'Pediatric Physician']],
    ['obstetrics', ['OBGYN', 'Obstetrician Gynecologist']],
    [
      'production partnerships',
      [
        'SLED partnerships director',
        'Public-sector partnerships director',
        'Government sales partnerships lead'
      ]
    ]
  ]) {
    const id = `coherent_${label.replace(/\W+/g, '_')}_title_family`;
    const accepted = await run(candidate({
      id,
      targetRoleTerms
    }), `generation-coherent-${label}-title-family`);
    const acceptedMotion = accepted.plans.find((motion) => motion.id === id);
    if (accepted.status !== 'planned' || accepted.plans.length !== 2 ||
        accepted.planSelection?.rejectedPlanCount !== 0 ||
        accepted.plans.some((motion) =>
          motion.professionalRoleQueryContract !==
            PROFESSIONAL_ROLE_QUERY_CONTRACT
        ) ||
        JSON.stringify(acceptedMotion?.targetRoleTerms) !==
          JSON.stringify(targetRoleTerms) || targetRoleTerms.some((term) =>
          !acceptedMotion?.query.includes(term)
        )) {
      throw new Error(
        `${label} title synonyms did not reach the exact provider query: ${JSON.stringify(accepted)}`
      );
    }
    if (label === 'production partnerships') {
      productionPartnershipsPlan = structuredClone(accepted);
    }
  }

  const persistedRoleEnvelope = (planResult, queryHash) => ({
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
  const persistedProductionPartnerships =
    normalizeCommercialDiscoveryEvidence(
      persistedRoleEnvelope(productionPartnershipsPlan, 'a'.repeat(64)),
      now
    );
  if (persistedProductionPartnerships.valid !== true ||
      persistedProductionPartnerships.plan?.valid !== true ||
      persistedProductionPartnerships.plan?.plans?.some((motion) =>
        motion.professionalRoleQueryContract !==
          PROFESSIONAL_ROLE_QUERY_CONTRACT
      )) {
    throw new Error(
      `marked production partnerships plan did not survive durable normalization: ${JSON.stringify(persistedProductionPartnerships)}`
    );
  }

  const unmarkedProductionPartnerships = structuredClone(
    productionPartnershipsPlan
  );
  for (const motion of unmarkedProductionPartnerships.plans) {
    delete motion.professionalRoleQueryContract;
  }
  const rejectedUnmarkedCurrent = normalizeCommercialDiscoveryEvidence(
    persistedRoleEnvelope(unmarkedProductionPartnerships, 'b'.repeat(64)),
    now
  );
  if (rejectedUnmarkedCurrent.valid !== false ||
      rejectedUnmarkedCurrent.plan?.valid !== false ||
      !/professional title family/i.test(
        rejectedUnmarkedCurrent.plan?.rejectedReason || ''
      )) {
    throw new Error(
      `unmarked current partnerships shape gained fresh provider authority: ${JSON.stringify(rejectedUnmarkedCurrent)}`
    );
  }

  const historicalUnmarked = structuredClone(coherentTitles);
  for (const motion of historicalUnmarked.plans) {
    delete motion.professionalRoleQueryContract;
  }
  const readableHistorical = normalizeCommercialDiscoveryEvidence(
    persistedRoleEnvelope(historicalUnmarked, 'c'.repeat(64)),
    now
  );
  if (readableHistorical.valid !== true ||
      readableHistorical.plan?.valid !== true ||
      readableHistorical.plan?.plans?.some((motion) =>
        motion.professionalRoleQueryContract
      )) {
    throw new Error(
      `unmarked historical plan lost legacy read compatibility: ${JSON.stringify(readableHistorical)}`
    );
  }

  for (const [label, mutate, reason] of [
    [
      'unknown role query contract',
      (planResult) => {
        planResult.plans[0].professionalRoleQueryContract =
          'professional_role_query_v999';
      },
      /unsupported professional role query contract/i
    ],
    [
      'marked one-term role query',
      (planResult) => {
        planResult.plans[0].targetRoleTerms =
          ['SLED partnerships director'];
      },
      /two to four distinct atomic likely-current title alternatives/i
    ],
    [
      'marked cross-family role query',
      (planResult) => {
        planResult.plans[0].targetRoleTerms = [
          'SLED partnerships director',
          'Pediatric physician'
        ];
      },
      /one coherent likely-current professional title family/i
    ]
  ]) {
    const adversary = structuredClone(productionPartnershipsPlan);
    mutate(adversary);
    const normalized = normalizeCommercialDiscoveryEvidence(
      persistedRoleEnvelope(adversary, createHash('sha256')
        .update(label).digest('hex')),
      now
    );
    if (normalized.valid !== false || normalized.plan?.valid !== false ||
        !reason.test(normalized.plan?.rejectedReason || '')) {
      throw new Error(
        `${label} escaped persisted role-query validation: ${JSON.stringify(normalized)}`
      );
    }
  }

  const forgedModelMarker = await run(candidate({
    id: 'model_authored_role_query_contract_is_ignored',
    professionalRoleQueryContract: 'professional_role_query_v999'
  }), 'generation-model-authored-role-query-contract');
  if (forgedModelMarker.status !== 'planned' ||
      forgedModelMarker.plans.some((motion) =>
        motion.professionalRoleQueryContract !==
          PROFESSIONAL_ROLE_QUERY_CONTRACT
      )) {
    throw new Error(
      `model-authored role-query marker was not deterministically replaced: ${JSON.stringify(forgedModelMarker)}`
    );
  }

  // Production regression: the planner returned one referral motion with a
  // Boolean title phrase and stray buyer-procurement metadata. Both fields
  // are deterministic adapter structure, so normalize them without spending
  // a repair/critic call or discarding the second commercial motion.
  const productionReferralFixture = structuredClone(
    cases[0].plans(evidenceRef)[0]
  );
  productionReferralFixture.id =
    'canonical_referral_route_and_atomic_titles';
  productionReferralFixture.demandArtifactKind =
    'buyer_procurement_notice';
  productionReferralFixture.counterparty =
    'One exact sustainability consulting professional';
  productionReferralFixture.targetRoleTerms = [
    'Climate consultant',
    'sustainability consultant'
  ];
  productionReferralFixture.organizationTerms = [
    'climate resilience',
    'civic data',
    'community research'
  ];
  productionReferralFixture.query =
    'Climate or sustainability consultant climate resilience civic data';
  const canonicalReferralRoute = await run(
    productionReferralFixture,
    'generation-canonical-referral-route-and-atomic-titles'
  );
  const canonicalReferralMotion = canonicalReferralRoute.plans.find(
    (motion) => motion.id ===
      'canonical_referral_route_and_atomic_titles'
  );
  if (canonicalReferralRoute.status !== 'planned' ||
      canonicalReferralRoute.plans.length !== 2 ||
      canonicalReferralRoute.planSelection?.acceptedPlanCount !== 2 ||
      canonicalReferralRoute.planSelection?.rejectedPlanCount !== 0 ||
      canonicalReferralMotion?.demandArtifactKind !== 'not_applicable' ||
      JSON.stringify(canonicalReferralMotion?.targetRoleTerms) !==
        JSON.stringify([
          'Climate consultant',
          'sustainability consultant'
        ]) ||
      !canonicalReferralMotion?.query.includes('Climate consultant') ||
      !canonicalReferralMotion?.query.includes(
        'sustainability consultant'
      ) || /\bclimate or sustainability consultant\b/i.test(
        canonicalReferralMotion?.query || ''
      )) {
    throw new Error(
      `fixed referral route/title structure was not canonicalized: ${JSON.stringify(canonicalReferralRoute)}`
    );
  }

  const localOrganizationAtomicFixture = structuredClone(
    cases[0].plans(evidenceRef)[1]
  );
  localOrganizationAtomicFixture.id =
    'local_organization_atomic_decision_maker_titles';
  localOrganizationAtomicFixture.targetRoleTerms = [
    'Climate consultant',
    'sustainability consultant'
  ];
  const localOrganizationAtomic = await run(
    localOrganizationAtomicFixture,
    'generation-local-organization-atomic-decision-maker-titles'
  );
  const localOrganizationAtomicMotion =
    localOrganizationAtomic.plans.find((motion) => motion.id ===
      'local_organization_atomic_decision_maker_titles');
  if (localOrganizationAtomic.status !== 'planned' ||
      localOrganizationAtomic.plans.length !== 2 ||
      localOrganizationAtomic.planSelection?.acceptedPlanCount !== 2 ||
      JSON.stringify(localOrganizationAtomicMotion?.targetRoleTerms) !==
        JSON.stringify([
          'Climate consultant',
          'sustainability consultant'
        ]) || /\bclimate or sustainability consultant\b/i.test(
        localOrganizationAtomicMotion?.query || ''
      )) {
    throw new Error(
      `local-organization decision-maker titles were not canonicalized: ${JSON.stringify(localOrganizationAtomic)}`
    );
  }

  const unsafeLocalOrganizationTitle = structuredClone(
    localOrganizationAtomicFixture
  );
  unsafeLocalOrganizationTitle.id =
    'unsafe_local_organization_cross_title';
  unsafeLocalOrganizationTitle.targetRoleTerms = [
    'Climate strategist or sustainability consultant'
  ];
  const rejectedLocalOrganizationTitle = await run(
    unsafeLocalOrganizationTitle,
    'generation-unsafe-local-organization-cross-title'
  );
  const localOrganizationRejection = rejectedLocalOrganizationTitle
    .planSelection?.rejectedPlans?.find((item) => item.id ===
      unsafeLocalOrganizationTitle.id)?.reason || '';
  if (rejectedLocalOrganizationTitle.status !== 'planned' ||
      rejectedLocalOrganizationTitle.plans.some((motion) => motion.id ===
        unsafeLocalOrganizationTitle.id) ||
      rejectedLocalOrganizationTitle.planSelection?.acceptedPlanCount !== 1 ||
      rejectedLocalOrganizationTitle.planSelection?.rejectedPlanCount !== 1 ||
      !/atomic current-title alternatives/i.test(
        localOrganizationRejection
      )) {
    throw new Error(
      `unsafe local-organization decision-maker title escaped validation: ${JSON.stringify(rejectedLocalOrganizationTitle)}`
    );
  }

  for (const [label, targetRoleTerms] of [
    [
      'cross-profession Boolean title',
      ['pediatrician or midwife']
    ],
    [
      'same-domain different strategist title',
      ['Climate strategist or sustainability consultant']
    ],
    [
      'same-domain different advisor title',
      ['Climate advisor or sustainability consultant']
    ],
    [
      'organization phrase cannot inherit a title',
      ['Detroit Climate Lab or sustainability consultant']
    ],
    [
      'service prose cannot inherit a title',
      ['Climate consultant services or sustainability consultant']
    ],
    [
      'and-or Boolean title prose',
      ['Climate and/or sustainability consultant']
    ],
    [
      'spaced slash Boolean title prose',
      ['Climate / sustainability consultant']
    ],
    [
      'organization-like Boolean prose',
      ['Climate or Detroit Resilience Lab']
    ],
    [
      'sentence-like Boolean prose',
      ['Consultant for climate or sustainability initiatives']
    ]
  ]) {
    const unsafeID = `unsafe_atomic_title_${label
      .toLowerCase().replace(/\W+/g, '_')}`;
    const rejected = await run(candidate({
      id: unsafeID,
      targetRoleTerms
    }), `generation-${label.replace(/\W+/g, '-')}`);
    const rejectionReason = rejected.planSelection?.rejectedPlans?.find(
      (item) => item.id === unsafeID
    )?.reason || '';
    if (rejected.status !== 'planned' ||
        rejected.plans.some((motion) => motion.id === unsafeID) ||
        rejected.planSelection?.acceptedPlanCount !== 1 ||
        rejected.planSelection?.rejectedPlanCount !== 1 ||
        !/atomic current-title alternatives/i.test(rejectionReason)) {
      throw new Error(
        `${label} escaped atomic-title validation: ${JSON.stringify(rejected)}`
      );
    }
  }

  for (const [label, targetRoleTerms, expectedReason] of [
    [
      'one title alternative',
      ['operations director'],
      /two to four distinct atomic likely-current title alternatives/i
    ],
    [
      'exact duplicate titles',
      ['operations director', 'operations director'],
      /case-insensitively distinct/i
    ],
    [
      'case-only duplicate titles',
      ['operations director', 'Operations Director'],
      /case-insensitively distinct/i
    ],
    [
      'five title alternatives',
      [
        'operations director',
        'director of operations',
        'operations manager',
        'head of operations',
        'chief operating officer'
      ],
      /two to four distinct atomic likely-current title alternatives/i
    ],
    [
      'generic unanchored titles',
      ['consultant', 'senior consultant'],
      /non-generic professional domain anchor/i
    ]
  ]) {
    const unsafeID = `unsafe_title_boundary_${label
      .toLowerCase().replace(/\W+/g, '_')}`;
    const rejected = await run(candidate({
      id: unsafeID,
      targetRoleTerms
    }), `generation-${label.replace(/\W+/g, '-')}`);
    const rejectionReason = rejected.planSelection?.rejectedPlans?.find(
      (item) => item.id === unsafeID
    )?.reason || '';
    if (rejected.status !== 'planned' ||
        rejected.plans.some((motion) => motion.id === unsafeID) ||
        rejected.planSelection?.acceptedPlanCount !== 1 ||
        rejected.planSelection?.rejectedPlanCount !== 1 ||
        !expectedReason.test(rejectionReason)) {
      throw new Error(
        `${label} escaped strict title-alternative acceptance: ${JSON.stringify(rejected)}`
      );
    }
  }

  const organizationBooleanName = await run(candidate({
    id: 'organization_boolean_name_is_not_split',
    targetRoleTerms: ['sustainability consultant', 'climate consultant'],
    organizationTerms: ['Climate or Sustainability Partners']
  }), 'generation-organization-boolean-name-is-not-split');
  const organizationBooleanMotion = organizationBooleanName.plans.find(
    (motion) => motion.id === 'organization_boolean_name_is_not_split'
  );
  if (organizationBooleanName.status !== 'planned' ||
      JSON.stringify(organizationBooleanMotion?.organizationTerms) !==
        JSON.stringify(['Climate or Sustainability Partners']) ||
      !organizationBooleanMotion?.query.includes(
        'Climate or Sustainability Partners'
      )) {
    throw new Error(
      `organization context was rewritten as a target title: ${JSON.stringify(organizationBooleanName)}`
    );
  }

  const mixedTitles = await run(candidate({
    id: 'mixed_professional_title_families',
    targetRoleTerms: [
      'pediatrician',
      'midwife',
      'doula'
    ],
    organizationTerms: ['pediatric practice', 'birth center']
  }), 'generation-mixed-professional-title-family-salvage');
  if (mixedTitles.status !== 'planned' ||
      mixedTitles.plans.some((motion) => motion.id ===
        'mixed_professional_title_families') ||
      mixedTitles.planSelection?.acceptedPlanCount !== 1 ||
      mixedTitles.planSelection?.rejectedPlanCount !== 1 ||
      !/one coherent likely-current professional title family/i.test(
        mixedTitles.planSelection?.rejectedPlans?.find((item) =>
          item.id === 'mixed_professional_title_families'
        )?.reason || ''
      )) {
    throw new Error(
      `mixed professional title families did not fail closed: ${JSON.stringify(mixedTitles)}`
    );
  }

  for (const [label, targetRoleTerms] of [
    ['pediatric-finance', ['Pediatrician', 'Finance Director']],
    ['business-accounting', ['Small Business Advisor', 'Accountant']]
  ]) {
    const id = `mixed_${label.replace(/-/g, '_')}_title_families`;
    const rejected = await run(candidate({
      id,
      targetRoleTerms
    }), `generation-mixed-${label}-title-families`);
    const reason = rejected.planSelection?.rejectedPlans?.find(
      (item) => item.id === id
    )?.reason || '';
    if (rejected.status !== 'planned' ||
        rejected.plans.some((motion) => motion.id === id) ||
        rejected.planSelection?.acceptedPlanCount !== 1 ||
        rejected.planSelection?.rejectedPlanCount !== 1 ||
        !/one coherent likely-current professional title family/i.test(
          reason
        )) {
      throw new Error(
        `${label} cross-profession titles escaped validation: ${JSON.stringify(rejected)}`
      );
    }
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

async function verifyOneMotionUsesTwoTacticFallback(job, evidenceRef) {
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const plans = compactFreshPlannerPlans(
        twoPlannerMotions(cases[0].plans(evidenceRef)[0], evidenceRef)
      );
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const plan of plans) plan.market = exactMarket;
      // Keep the wire contract exact while making only motion two
      // semantically non-diverse. Repeating the selected paid-demand action
      // across both model-authored tactics leaves the closed schema intact,
      // but must fail the local causal-diversity gate. Motion one survives
      // for the critic's two-tactic comparison.
      const repeatedAction =
        plans[1].contingentFinalists.tacticA.a[0].l;
      for (const tactic of [
        plans[1].contingentFinalists.tacticA,
        plans[1].contingentFinalists.tacticB
      ]) {
        for (const action of tactic.a) action.l = repeatedAction;
      }
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage,
        generationId: 'generation-one-motion-two-families',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 700,
          contentSha256: '1'.repeat(64)
        },
        annotations: []
      };
    }
  });
  if (result.status !== 'planned' ||
      result.plans.length !== 1 ||
      result.planSelection?.returnedPlanCount !== 2 ||
      result.planSelection?.acceptedPlanCount !== 1 ||
      result.planSelection?.rejectedPlanCount !== 1 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `one-motion two-tactic fallback was not retained: ${JSON.stringify(result)}`
    );
  }
}

async function verifySingleOperationalVariantCanBePruned(
  job,
  evidenceRef
) {
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const plans = compactFreshPlannerPlans(
        twoPlannerMotions(cases[0].plans(evidenceRef)[0], evidenceRef)
      );
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const plan of plans) plan.market = exactMarket;
      plans[0].contingentFinalists.tacticA.a[0].l =
        'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to configure scheduling.';
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage,
        generationId: 'generation-one-operational-variant',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 700,
          contentSha256: '0'.repeat(64)
        },
        annotations: []
      };
    }
  });
  if (result.status !== 'blocked' ||
      result.plans.length !== 0 ||
      result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      result.usage?.successfulCalls !== 1 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `schema-invalid operational action was not rejected before normalization: ${JSON.stringify(result)}`
    );
  }
}

async function verifyLinkedRecoveryCannotBeBusinessAction(
  job,
  evidenceRef
) {
  for (const recoveryVerb of ['retry', 'rerun']) {
    const result = await runOpportunityDiscoveryPlanner({
      job,
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => {
        const plans = compactFreshPlannerPlans(
          twoPlannerMotions(cases[0].plans(evidenceRef)[0], evidenceRef)
        );
        const exactMarket = request.responseFormat?.json_schema?.schema
          ?.properties?.plans?.items?.properties?.market?.enum?.[0];
        for (const plan of plans) plan.market = exactMarket;
        const invalidPlan = plans[0];
        for (const tacticKey of ['tacticA', 'tacticB']) {
          for (const action of
            invalidPlan.contingentFinalists[tacticKey].a) {
            action.l = action.l.endsWith(' {{TARGET_NAME}}')
              ? action.l.replace(
                  / (to|for) \{\{TARGET_NAME\}\}$/,
                  ` after ${recoveryVerb} review $1 {{TARGET_NAME}}`
                )
              : `${action.l} after ${recoveryVerb} review`;
          }
        }
        return {
          data: {
            contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
            status: 'planned',
            reason: '',
            plans
          },
          usage,
          generationId: `generation-linked-${recoveryVerb}-action`,
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
    if (result.status !== 'planned' || result.plans.length !== 1 ||
        result.normalizationDiagnostic != null ||
        result.planSelection?.acceptedPlanCount !== 1 ||
        result.planSelection?.rejectedPlanCount !== 1 ||
        !/primary_action_linked_recovery/.test(
          result.planSelection?.rejectedPlans?.[0]?.reason || ''
        ) ||
        result.usage?.successfulCalls !== 1 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${recoveryVerb} instruction became a model-authored business action: ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifySupportingBottleneckIsMissingEvidence(job, evidenceRef) {
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const plans = compactFreshPlannerPlans(
        twoPlannerMotions(cases[0].plans(evidenceRef)[0], evidenceRef)
      );
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const plan of plans) {
        plan.market = exactMarket;
        plan.contingentFinalists.pathBase.r[0].sb =
          'No paid conversion proof is known; prepare a tracking artifact.';
      }
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage,
        generationId: 'generation-operational-supporting-bottleneck',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 700,
          contentSha256: 'b'.repeat(64)
        },
        annotations: []
      };
    }
  });
  if (result.status !== 'blocked' || result.plans.length !== 0 ||
      result.normalizationDiagnostic != null ||
      result.planSelection?.rejectedPlanCount !== 2 ||
      result.planSelection?.rejectedPlans?.some((item) =>
        !/supporting_bottleneck_not_evidence_gap/.test(item.reason || '')
      ) ||
      result.usage?.successfulCalls !== 1 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `operational supporting bottleneck became experiment evidence: ${JSON.stringify(result)}`
    );
  }
}

async function verifyQualifiedPartnerReferralActionsPass(job, evidenceRef) {
  let expectedActions = [];
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const plans = compactFreshPlannerPlans(
        twoPlannerMotions(cases[0].plans(evidenceRef)[0], evidenceRef)
      );
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const plan of plans) plan.market = exactMarket;
      expectedActions = [
        ...plans[0].contingentFinalists.tacticA.a,
        ...plans[0].contingentFinalists.tacticB.a
      ].map((action) => action.l);
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage,
        generationId: 'generation-qualified-partner-referral-actions',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 800,
          contentSha256: '2'.repeat(64)
        },
        annotations: []
      };
    }
  });
  const returnedActions = ['familyA', 'familyB'].flatMap((familyKey) =>
    result.plans[0]?.contingentFinalists?.[familyKey]?.d?.a?.map(
      (action) => action.l
    ) || []
  );
  if (result.status !== 'planned' || result.plans.length !== 2 ||
      JSON.stringify(returnedActions) !== JSON.stringify(expectedActions)) {
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

  const arbitrary = cases[0].plans(evidenceRef)[0];
  arbitrary.contingentFinalists = compactContingentFinalists(
    arbitrary.contingentFinalists
  );
  arbitrary.contingentFinalists.pathBase.r[0].c =
    'Measure the booking workflow without making a commercial ask.';
  const arbitraryProjected = await plannerResultForMotion({
    job,
    motion: arbitrary,
    generationId: 'generation-compact-arbitrary-conversion-action'
  });
  if (arbitraryProjected.status !== 'blocked' ||
      arbitraryProjected.plans.length !== 0 ||
      arbitraryProjected.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      arbitraryProjected.usage?.successfulCalls !== 1 ||
      arbitraryProjected.sideEffectsPerformed !== 0) {
    throw new Error(
      `model-forged redundant compact conversion action escaped the strict schema: ${JSON.stringify(arbitraryProjected)}`
    );
  }

  const invalid = cases[0].plans(evidenceRef)[0];
  invalid.contingentFinalists = compactContingentFinalists(
    invalid.contingentFinalists
  );
  for (const action of invalid.contingentFinalists.tacticA.a) {
    action.e = ['observation:invented-conversion-evidence'];
  }
  const rejected = await plannerResultForMotion({
    job,
    motion: invalid,
    generationId: 'generation-compact-no-valid-conversion-action'
  });
  if (rejected.status !== 'blocked' || rejected.plans.length !== 0 ||
      rejected.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      rejected.usage?.successfulCalls !== 1 ||
      rejected.sideEffectsPerformed !== 0) {
    throw new Error(
      `compact conversion projection accepted out-of-catalog evidence: ${JSON.stringify(rejected)}`
    );
  }

  const materializedMarker = canonicalMaterializedPlannerPlans([
    cases[0].plans(evidenceRef)[0]
  ])[0];
  for (const familyKey of ['familyA', 'familyB']) {
    materializedMarker.contingentFinalists[familyKey].d.r[0].c =
      'project_selected_tactic_action';
  }
  const materializedRejected = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      materializedMarker.market = exactMarket;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: [materializedMarker, structuredClone(materializedMarker)]
        },
        usage,
        generationId: 'generation-materialized-conversion-marker',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 800,
          contentSha256: '4'.repeat(64)
        },
        annotations: []
      };
    }
  });
  if (materializedRejected.status !== 'blocked' ||
      materializedRejected.plans.length !== 0 ||
      materializedRejected.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      materializedRejected.usage?.successfulCalls !== 1 ||
      materializedRejected.sideEffectsPerformed !== 0) {
    throw new Error(
      `materialized conversion marker bypassed the strict wire contract: ${JSON.stringify(materializedRejected)}`
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
      !/(?:conversion_action|typed causal revenue witness|contingent finalist|compact|projected revenue action|professional role query contract)/i.test(
        persistedCompact.plan?.rejectedReason || ''
      )) {
    throw new Error(
      `persisted compact conversion marker was improperly projected: ${JSON.stringify(persistedCompact)}`
    );
  }
}

async function verifyPaidDemandResponseActionVerbs(job, evidenceRef) {
  const motion = cases[1].plans(evidenceRef)[0];
  motion.contingentFinalists = compactContingentFinalists(
    motion.contingentFinalists
  );
  const actions = [
    ...motion.contingentFinalists.tacticA.a,
    ...motion.contingentFinalists.tacticB.a
  ].map((action) => action.l);
  const accepted = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-paid-demand-response-verbs'
  });
  const paidDemandMotion = accepted.plans.find((plan) =>
    plan.motionKind === 'compensated_job'
  );
  const acceptedActions = ['familyA', 'familyB'].flatMap((familyKey) =>
    paidDemandMotion?.contingentFinalists?.[familyKey]?.d?.a?.map(
      (action) => action.l
    ) || []
  );
  if (accepted.status !== 'planned' || accepted.plans.length !== 2 ||
      JSON.stringify(acceptedActions) !== JSON.stringify(actions)) {
    throw new Error(
      `paid application/proposal/response verbs were rejected: ${JSON.stringify(accepted)}`
    );
  }

  const artifactOnly = cases[1].plans(evidenceRef)[0];
  artifactOnly.contingentFinalists = compactContingentFinalists(
    artifactOnly.contingentFinalists
  );
  artifactOnly.contingentFinalists.tacticA.a[0].l =
    'After review via official paid-demand page {{TARGET_URL}}, submit one research report to {{TARGET_NAME}}.';
  artifactOnly.contingentFinalists.tacticA.a[1].l =
    'After review via official paid-demand page {{TARGET_URL}}, submit one analytics dashboard to {{TARGET_NAME}}.';
  const rejected = await plannerResultForMotion({
    job,
    motion: artifactOnly,
    generationId: 'generation-non-revenue-artifact-submission'
  });
  if (rejected.status !== 'blocked' || rejected.plans.length !== 0 ||
      rejected.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      rejected.usage?.successfulCalls !== 1 ||
      rejected.sideEffectsPerformed !== 0) {
    throw new Error(
      `non-revenue artifact submission passed: ${JSON.stringify(rejected)}`
    );
  }
}

async function verifyRequiredSupportingBottleneckFailsClosed(
  job,
  evidenceRef
) {
  const motion = cases[0].plans(evidenceRef)[0];
  motion.contingentFinalists = compactContingentFinalists(
    motion.contingentFinalists
  );
  motion.contingentFinalists.pathBase.r[0].sb = '';
  const result = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-empty-optional-supporting-bottleneck'
  });
  if (result.status !== 'blocked' || result.plans.length !== 0 ||
      result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      result.usage?.successfulCalls !== 1 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `empty required supporting bottleneck escaped exact schema validation: ${JSON.stringify(result)}`
    );
  }
}

async function verifyAuthoredTerminalOutcomeIsNonAuthoritative(
  job,
  evidenceRef
) {
  const outcomes = [
    'One completed paid lactation consultation recorded.',
    'One completed unpaid lactation consultation recorded.'
  ];
  for (const [index, outcome] of outcomes.entries()) {
    const motion = cases[0].plans(evidenceRef)[0];
    motion.contingentFinalists = compactContingentFinalists(
      motion.contingentFinalists
    );
    const revenue = motion.contingentFinalists.pathBase.r[0];
    // o is absent from the strict fresh schema. A provider completion that
    // forges it must be rejected before deterministic materialization; code
    // derives the canonical terminal outcome solely from rm only after that
    // exact boundary passes.
    revenue.o = outcome;
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-forged-terminal-outcome-${index + 1}`
    });
    if (result.status !== 'blocked' || result.plans.length !== 0 ||
        result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
        result.usage?.successfulCalls !== 1 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `model-authored terminal outcome retained authority (${outcome}): ${JSON.stringify(result)}`
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
  const motionFor = (mechanism) => {
    const motion = mechanism === 'compensated_role'
      ? cases[1].plans(evidenceRef)[0]
      : cases[0].plans(evidenceRef)[0];
    motion.contingentFinalists = compactContingentFinalists(
      motion.contingentFinalists
    );
    const revenue = motion.contingentFinalists.pathBase.r[0];
    revenue.rm = {
      seller: mechanism === 'compensated_role'
        ? 'paid_booking'
        : mechanism,
      compensatedJob: 'compensated_role'
    };
    revenue.k = {
      n: 14,
      u: 'calendar_days'
    };
    return motion;
  };

  for (const [index, mechanism] of mechanisms.entries()) {
    const motion = motionFor(mechanism);
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-terminal-outcome-${index + 1}`
    });
    const acceptedMotion = result.plans.find((item) =>
      item.commercialRole === motion.commercialRole &&
        item.searchMode === motion.searchMode
    );
    const revenues = ['familyA', 'familyB'].map((familyKey) =>
      acceptedMotion?.contingentFinalists?.[familyKey]?.d?.r?.[0]
    );
    if (result.status !== 'planned' || result.plans.length !== 2 ||
        revenues.some((revenue) =>
          revenue?.v !== 'incremental_revenue_v3' ||
          revenue?.rm !== mechanism ||
          revenue?.a !== motion.acquisitionMode ||
          revenue?.c !== acceptedMotion?.contingentFinalists?.[
            revenues.indexOf(revenue) === 0 ? 'familyA' : 'familyB'
          ]?.d?.a?.[0]?.l ||
          revenue?.o !== canonicalTerminalPaidOutcome(mechanism) ||
          revenue?.k?.c !== mechanism ||
          revenue?.k?.o !== mechanism ||
          revenue?.k?.p !== `${mechanism}_terminal` ||
          revenue?.k?.t !== revenue?.atm
        )) {
      throw new Error(
        `deterministic ${mechanism} revenue projection failed: ${JSON.stringify(result)}`
      );
    }
  }

  const compensatedRouteWithSellerMechanism = motionFor(
    'compensated_role'
  );
  compensatedRouteWithSellerMechanism.contingentFinalists
    .pathBase.r[0].rm.compensatedJob = 'paid_booking';
  const crossedMechanismResult = await plannerResultForMotion({
    job,
    motion: compensatedRouteWithSellerMechanism,
    generationId: 'generation-compensated-route-seller-mechanism'
  });
  if (crossedMechanismResult.status !== 'blocked' ||
      crossedMechanismResult.plans.length !== 0 ||
      crossedMechanismResult.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      crossedMechanismResult.usage?.successfulCalls !== 1 ||
      crossedMechanismResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `compensated route accepted a seller mechanism: ${JSON.stringify(crossedMechanismResult)}`
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
    motion.contingentFinalists = compactContingentFinalists(
      motion.contingentFinalists
    );
    motion.contingentFinalists.pathBase.r[0].st = stopCondition;
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
    motion.contingentFinalists = compactContingentFinalists(
      motion.contingentFinalists
    );
    const revenue = motion.contingentFinalists.pathBase.r[0];
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
    if (result.status !== 'blocked' || result.plans.length !== 0 ||
        result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
        result.usage?.successfulCalls !== 1 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `invalid typed revenue stop passed (${invalid.text}): ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyNaturalBookingAttribution(job, evidenceRef) {
  const acceptedAuthoredSignals = [
    'Referral source recorded on the booking with the tournament action id.',
    'Campaign source field stored on the appointment record.',
    'Referral origin recorded with the consultation.'
  ];
  for (const [index, attributionSignal] of
    acceptedAuthoredSignals.entries()) {
    const motion = cases[0].plans(evidenceRef)[0];
    motion.contingentFinalists = compactContingentFinalists(
      motion.contingentFinalists
    );
    const revenue = motion.contingentFinalists.pathBase.r[0];
    revenue.atm = 'booking_record';
    revenue.ats = attributionSignal;
    motion.attributionSignal = attributionSignal;
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-model-authored-attribution-${index + 1}`
    });
    const selectedPlan = result.plans.find((plan) =>
      plan.motionKind === motion.motionKind &&
      plan.commercialRole === motion.commercialRole
    );
    const selectedRevenue = ['familyA', 'familyB'].map((familyKey) =>
      selectedPlan?.contingentFinalists?.[familyKey]?.d?.r?.[0]
    );
    if (result.status !== 'planned' || result.plans.length !== 2 ||
        result.planSelection?.rejectedPlanCount !== 0 ||
        selectedPlan?.attributionSignal !== attributionSignal ||
        selectedRevenue.some((path) => path?.ats !== attributionSignal) ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `model-authored attribution was rewritten (${attributionSignal}): ${JSON.stringify(result)}`
      );
    }
  }

  const rejectedAuthoredSignals = [
    {
      text: 'No attribution is recorded for the booking.',
      expectedStage: 'strict_schema'
    },
    {
      text: 'The booking has an unknown source.',
      expectedStage: 'semantic'
    }
  ];
  for (const [index, rejectedSignal] of
    rejectedAuthoredSignals.entries()) {
    const attributionSignal = rejectedSignal.text;
    const motion = cases[0].plans(evidenceRef)[0];
    motion.contingentFinalists = compactContingentFinalists(
      motion.contingentFinalists
    );
    const revenue = motion.contingentFinalists.pathBase.r[0];
    revenue.atm = 'booking_record';
    revenue.ats = attributionSignal;
    motion.attributionSignal = attributionSignal;
    const result = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-rejected-model-attribution-${index + 1}`
    });
    const rejectedAtSchema = rejectedSignal.expectedStage ===
        'strict_schema' &&
      result.status === 'blocked' &&
      result.plans.length === 0 &&
      result.normalizationDiagnostic?.code === 'strict_schema_mismatch';
    const rejectedSemantically = rejectedSignal.expectedStage ===
        'semantic' &&
      result.status === 'planned' &&
      result.plans.length === 1 &&
      result.planSelection?.returnedPlanCount === 2 &&
      result.planSelection?.acceptedPlanCount === 1 &&
      result.planSelection?.rejectedPlanCount === 1 &&
      !result.plans.some((plan) =>
        plan.attributionSignal === attributionSignal
      );
    if ((!rejectedAtSchema && !rejectedSemantically) ||
        result.usage?.successfulCalls !== 1 ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `contradictory model-authored attribution was accepted (${attributionSignal}): ${JSON.stringify(result)}`
      );
    }
  }
}

async function verifyCausalPathDiagnosticsAreFieldSpecific(
  job,
  evidenceRef
) {
  const motion = cases[0].plans(evidenceRef)[0];
  motion.contingentFinalists = compactContingentFinalists(
    motion.contingentFinalists
  );
  const revenue = motion.contingentFinalists.pathBase.r[0];
  motion.paidConversion = 'No incremental income is expected.';
  motion.conversionDestination = 'No conversion destination is available.';
  revenue.vm = 0;
  const result = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-field-specific-causal-diagnostics'
  });
  if (result.status !== 'blocked' || result.plans.length !== 0 ||
      result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      JSON.stringify(result.normalizationDiagnostic?.issues) !==
        JSON.stringify([{
          keyword: 'minimum',
          instancePath:
            '/plans/0/contingentFinalists/pathBase/r/0/vm'
        }]) ||
      result.usage?.successfulCalls !== 1 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `causal-path diagnostics were not field-specific and safe: ${JSON.stringify(result)}`
    );
  }
}

async function verifyTypedCausalWitnessContract(job, evidenceRef) {
  const motion = cases[0].plans(evidenceRef)[0];
  motion.contingentFinalists = compactContingentFinalists(
    motion.contingentFinalists
  );
  const typed = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-derived-typed-causal-witness'
  });
  const acceptedMotion = typed.plans.find((item) =>
    item.commercialRole === motion.commercialRole &&
      item.searchMode === motion.searchMode
  );
  const completeWitnesses = ['familyA', 'familyB'].every((familyKey) => {
    const family = acceptedMotion?.contingentFinalists?.[familyKey];
    const revenue = family?.d?.r?.[0];
    return revenue?.k?.v === 'revenue_causal_witness_v2' &&
      revenue.k.i === 'counterfactual_incremental_paid_income' &&
      revenue.k.c === revenue.rm &&
      revenue.k.o === revenue.rm &&
      revenue.k.p === `${revenue.rm}_terminal` &&
      revenue.k.t === revenue.atm &&
      revenue.k.d === 'separate_conversion_destination' &&
      revenue.k.s === 'stop_at_limit' &&
      revenue.k.n === 14 &&
      revenue.k.u === 'calendar_days' &&
      revenue.c === family.d.a[0].l;
  });
  if (typed.status !== 'planned' || typed.plans.length !== 2 ||
      !completeWitnesses || typed.sideEffectsPerformed !== 0) {
    throw new Error(
      `typed causal witness was not derived from fresh authority: ${JSON.stringify(typed)}`
    );
  }

  const forged = cases[0].plans(evidenceRef)[0];
  forged.contingentFinalists = compactContingentFinalists(
    forged.contingentFinalists
  );
  forged.contingentFinalists.pathBase.r[0].k = {
    n: 14,
    u: 'calendar_days',
    v: 'revenue_causal_witness_v1',
    c: 'direct_sale',
    o: 'compensated_role',
    p: 'forged_terminal',
    t: 'forged_attribution',
    d: 'forged_destination',
    s: 'forged_stop'
  };
  const projected = await plannerResultForMotion({
    job,
    motion: forged,
    generationId: 'generation-forged-witness-duplicates'
  });
  if (projected.status !== 'blocked' || projected.plans.length !== 0 ||
      projected.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      projected.usage?.successfulCalls !== 1 ||
      projected.sideEffectsPerformed !== 0) {
    throw new Error(
      `model-forged witness duplicates retained authority: ${JSON.stringify(projected)}`
    );
  }

  const collapsedSingleton = cases[0].plans(evidenceRef)[0];
  collapsedSingleton.contingentFinalists = compactContingentFinalists(
    collapsedSingleton.contingentFinalists
  );
  collapsedSingleton.contingentFinalists.pathBase.r =
    collapsedSingleton.contingentFinalists.pathBase.r[0];
  const restoredSingleton = await plannerResultForMotion({
    job,
    motion: collapsedSingleton,
    generationId: 'generation-collapsed-singleton-revenue-path'
  });
  if (restoredSingleton.status !== 'blocked' ||
      restoredSingleton.plans.length !== 0 ||
      restoredSingleton.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      restoredSingleton.usage?.successfulCalls !== 1 ||
      restoredSingleton.sideEffectsPerformed !== 0) {
    throw new Error(
      `non-schema singleton revenue wrapper was not rejected locally: ${JSON.stringify(restoredSingleton)}`
    );
  }

  const missing = cases[0].plans(evidenceRef)[0];
  missing.contingentFinalists = compactContingentFinalists(
    missing.contingentFinalists
  );
  delete missing.contingentFinalists.pathBase.r[0].k;
  const missingResult = await plannerResultForMotion({
    job,
    motion: missing,
    generationId: 'generation-missing-fresh-causal-witness'
  });
  if (missingResult.status !== 'blocked' ||
      missingResult.plans.length !== 0 ||
      missingResult.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      missingResult.usage?.successfulCalls !== 1 ||
      missingResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `fresh planner response omitted its bounded witness: ${JSON.stringify(missingResult)}`
    );
  }
}
async function plannerResultForMotion({ job, motion, generationId }) {
  const evidenceRef = motion.evidenceRefs.find((ref) =>
    /^observation:/i.test(ref)
  );
  return runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const plans = compactFreshPlannerPlans(
        twoPlannerMotions(motion, evidenceRef)
      );
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const plan of plans) plan.market = exactMarket;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage,
        generationId,
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 800,
          contentSha256: '4'.repeat(64)
        },
        annotations: []
      };
    }
  });
}

async function verifyAuthoredTextRoleExamplesPassFullPlanner() {
  const roleScenarios = [
    { scenario: cases[0], motionIndex: 0, role: 'referral_partner' },
    { scenario: cases[2], motionIndex: 1, role: 'buyer' },
    { scenario: cases[1], motionIndex: 0, role: 'paid_demand' }
  ];
  for (const { scenario, motionIndex, role } of roleScenarios) {
    const job = plannerJob(scenario);
    const catalog = buildEvidenceCatalog(job.payload, {}, now, {
      includeSystemAttributionCapability: true
    });
    const evidenceRef = catalog.find((item) =>
      typeof item.id === 'string' && item.id.startsWith('observation:')
    )?.id;
    if (!evidenceRef) {
      throw new Error(`${role} authored-text fixture lost approved evidence`);
    }
    const motion = scenario.plans(evidenceRef)[motionIndex];
    motion.contingentFinalists = compactContingentFinalists(
      motion.contingentFinalists
    );
    const examples = CURRENT_LUNA_ROLE_EXAMPLES[role];
    motion.paidOffer = {
      seller: motion.paidOffer,
      compensatedJob: 'Paid role'
    };
    const revenue = motion.contingentFinalists.pathBase.r[0];
    revenue.io = 'Paid booking';
    revenue.cd = 'Booking service';
    revenue.ats = 'Referral source';
    revenue.g.d.l = 'Booking service';
    for (const tacticKey of ['tacticA', 'tacticB']) {
      const tactic = motion.contingentFinalists[tacticKey];
      tactic.c[0].l = examples.channel;
      tactic.a[0].l = examples.actions[0];
      tactic.a[1].l = examples.actions[1];
    }
    const accepted = await plannerResultForMotion({
      job,
      motion,
      generationId: `generation-authored-text-${role}`
    });
    const matchingMotions = accepted.plans.filter((item) =>
      item.commercialRole === role &&
      item.motionKind === motion.motionKind
    );
    const acceptedMotion = matchingMotions[0];
    const families = ['familyA', 'familyB'].map((familyKey) =>
      acceptedMotion?.contingentFinalists?.[familyKey]
    );
    if (accepted.status !== 'planned' || matchingMotions.length !== 1 ||
        accepted.normalizationDiagnostic != null ||
        accepted.sideEffectsPerformed !== 0 ||
        (role === 'paid_demand' &&
          acceptedMotion?.paidOffer !== 'Paid role') ||
        families.some((family) =>
          family?.d?.r?.[0]?.io !== 'Paid booking' ||
          family?.d?.r?.[0]?.cd !== 'Booking service' ||
          family?.d?.r?.[0]?.ats !== 'Referral source' ||
          family?.d?.r?.[0]?.g?.d?.l !== 'Booking service' ||
          family?.d?.b?.[0]?.l !== examples.buyer ||
          family?.d?.c?.[0]?.l !== examples.channel ||
          JSON.stringify(family?.d?.a?.map((item) => item.l)) !==
            JSON.stringify(examples.actions)
        )) {
      throw new Error(
        `${role} authored-text examples failed full planner semantics: ${JSON.stringify(accepted)}`
      );
    }
  }
}

async function verifyRepeatedOptionalRoleActionsArePruned(
  job,
  evidenceRef
) {
  const motion = cases[0].plans(evidenceRef)[0];
  motion.contingentFinalists = compactContingentFinalists(
    motion.contingentFinalists
  );
  const familyAAction =
    motion.contingentFinalists.tacticA.a[0].l;
  const familyBAction =
    motion.contingentFinalists.tacticB.a[0].l;
  for (const action of motion.contingentFinalists.tacticA.a) {
    action.l = familyAAction;
  }
  for (const action of motion.contingentFinalists.tacticB.a) {
    action.l = familyBAction;
  }
  const accepted = await plannerResultForMotion({
    job,
    motion,
    generationId: 'generation-repeated-optional-actions'
  });
  const acceptedMotion = accepted.plans.find((item) =>
    item.commercialRole === motion.commercialRole &&
      item.searchMode === motion.searchMode
  );
  const acceptedActions = ['familyA', 'familyB'].flatMap((familyKey) =>
    acceptedMotion?.contingentFinalists?.[familyKey]?.d?.a?.map(
      (action) => action.l
    ) || []
  );
  if (accepted.status !== 'planned' || !acceptedMotion ||
      acceptedActions.length !== 4 ||
      JSON.stringify(acceptedActions) !== JSON.stringify([
        familyAAction,
        familyAAction,
        familyBAction,
        familyBAction
      ]) ||
      accepted.planSelection?.rejectedPlanCount !== 0 ||
      accepted.plannerDiagnostic) {
    throw new Error(
      `model-authored repeated actions were rewritten or rejected despite two viable tactics: ${JSON.stringify(accepted)}`
    );
  }

  const collapsedMotions = twoPlannerMotions(
    cases[0].plans(evidenceRef)[0],
    evidenceRef
  );
  const collapsedPlans = collapsedMotions.map((motionValue) => {
    const [collapsed] = compactFreshPlannerPlans([motionValue]);
    const repeated =
      collapsed.contingentFinalists.tacticA.a[0].l;
    for (const tacticKey of ['tacticA', 'tacticB']) {
      for (const action of collapsed.contingentFinalists[tacticKey].a) {
        action.l = repeated;
      }
    }
    return collapsed;
  });
  const projected = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const plan of collapsedPlans) plan.market = exactMarket;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: collapsedPlans
        },
        usage,
        generationId: 'generation-collapsed-selected-actions',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 800,
          contentSha256: '1'.repeat(64)
        },
        annotations: []
      };
    }
  });
  if (projected.status !== 'blocked' || projected.plans.length !== 0 ||
      projected.planSelection?.returnedPlanCount !== 2 ||
      projected.planSelection?.acceptedPlanCount !== 0 ||
      projected.planSelection?.rejectedPlanCount !== 2 ||
      projected.usage?.successfulCalls !== 1 ||
      projected.sideEffectsPerformed !== 0) {
    throw new Error(
      `collapsed selected-role actions were rewritten instead of rejected: ${JSON.stringify(projected)}`
    );
  }
}

async function verifyRawOverCardinalityFailsClosed(job, evidenceRef) {
  const firstThree = [
    ...cases[0].plans(evidenceRef),
    cases[1].plans(evidenceRef)[0]
  ];
  firstThree[2].priority = 3;
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
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
      result.plans.length !== 0 ||
      result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      !result.normalizationDiagnostic?.issues?.some((issue) =>
        issue.keyword === 'maxItems' && issue.instancePath === '/plans'
      ) ||
      result.usage?.successfulCalls !== 1 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `raw over-cardinality was normalized into compliance: ${JSON.stringify(result)}`
    );
  }
}

async function verifyCurrentLunaGeneratorRouteQualification(
  job,
  evidenceRef
) {
  let requestSeen;
  const result = await runOpportunityDiscoveryPlannerRaw({
    job,
    model: 'openai/gpt-5.6-luna',
    now,
    completeJSON: async (request) => {
      requestSeen = request;
      const plans = compactFreshPlannerPlans(twoPlannerMotions(
        cases[0].plans(evidenceRef)[0],
        evidenceRef
      ));
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const planValue of plans) planValue.market = exactMarket;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage: {
          prompt_tokens: 900,
          completion_tokens: 650,
          total_tokens: 1_550,
          cost: 0.001
        },
        generationId: 'generation-luna-generator-qualification',
        diagnostics: {
          ...acceptedCurrentLunaRouteDiagnostics(),
          finishReason: 'stop',
          nativeFinishReason: 'completed',
          contentByteCount: 8_000,
          contentSha256: '1'.repeat(64)
        }
      };
    }
  });
  const serialized = serializeOpenRouterJSONRequestBody(requestSeen);
  const wireRequest = JSON.parse(serialized);
  const canonicalSchema = requestSeen?.responseFormat?.json_schema?.schema;
  const providerSchema = wireRequest?.response_format?.json_schema?.schema;
  const projection = result.preflight?.structuredOutputProjection;
  verifyProjectedPatternsRemainExactLocalAuthority({
    canonicalSchema,
    providerSchema
  });
  verifyAuthoredTextContractFitsCanonicalSchema({ canonicalSchema });
  if (result.status !== 'planned' ||
      result.usage?.calls !== 1 ||
      result.usage?.successfulCalls !== 1 ||
      result.preflight?.callSpendCeilingMicros > 59_616 ||
      requestSeen?.model !== 'openai/gpt-5.6-luna' ||
      JSON.stringify(requestSeen?.models) !==
        JSON.stringify(['openai/gpt-5.6-luna']) ||
      JSON.stringify(requestSeen?.reasoning) !== JSON.stringify({
        effort: 'none',
        exclude: true
      }) ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        order: ['openai'],
        only: ['openai'],
        ignore: [],
        allow_fallbacks: false,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 0.2, completion: 1.2, request: 0 }
      }) ||
      serialized.includes('service_tier') ||
      !serialized.includes(
        '"reasoning":{"effort":"none","exclude":true}'
      ) ||
      JSON.stringify(jsonDifferencePaths(
        canonicalSchema,
        providerSchema
      )) !== JSON.stringify(CURRENT_LUNA_PROVIDER_OMITTED_PATTERN_PATHS) ||
      CURRENT_LUNA_PROVIDER_OMITTED_PATTERN_PATHS.some((path) => {
        const segments = path.slice(2).split('/');
        const canonicalParent = segments.slice(0, -1).reduce(
          (value, segment) => value?.[segment],
          canonicalSchema
        );
        const providerParent = segments.slice(0, -1).reduce(
          (value, segment) => value?.[segment],
          providerSchema
        );
        return typeof canonicalParent?.pattern !== 'string' ||
          Object.prototype.hasOwnProperty.call(
            providerParent || {},
            'pattern'
          );
      }) ||
      projection?.contractVersion !==
        'opportunity_discovery_provider_schema_projection_v1' ||
      projection?.canonicalSchemaSha256 !==
        schemaSHA256(canonicalSchema) ||
      projection?.providerSchemaSha256 !== schemaSHA256(providerSchema) ||
      projection?.canonicalSchemaSha256 ===
        projection?.providerSchemaSha256 ||
      projection?.omittedPatternPathsSha256 !==
        CURRENT_LUNA_PROVIDER_OMITTED_PATTERN_PATHS_SHA256 ||
      projection?.omittedPatternCount !== 14 ||
      projection?.localExactSchemaRequired !== true ||
      result.preflight?.requestBodyByteCount !==
        Buffer.byteLength(serialized, 'utf8') ||
      result.preflight?.requestBodySha256 !== createHash('sha256')
        .update(serialized, 'utf8').digest('hex') ||
      result.llm?.discoveryPlanner?.requestedModel !==
        'openai/gpt-5.6-luna' ||
      result.llm?.discoveryPlanner?.model !==
        'openai/gpt-5.6-luna-20260709' ||
      result.llm?.discoveryPlanner?.responseDiagnostics
        ?.routerSelectedProvider !== 'OpenAI' ||
      result.llm?.discoveryPlanner?.responseDiagnostics
        ?.routerCandidateCount !== 10 ||
      result.llm?.discoveryPlanner?.responseDiagnostics
        ?.nativeFinishReason !== 'completed' ||
      result.preflight?.routeProvenanceValidated !== true ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `current Luna generator route qualification failed: ${JSON.stringify({ requestSeen, result })}`
    );
  }

  let projectionBoundaryCalls = 0;
  const guardedProjectionDispatch = async (request, preflight) => {
    const issue = opportunityDiscoveryPlannerProjectionIssue(
      request,
      preflight
    );
    if (issue) return issue;
    projectionBoundaryCalls += 1;
    return '';
  };
  for (const [label, requestMutation, preflightMutation, expectedIssue] of [[
    'missing-schema-name',
    (request) => {
      delete request.responseFormat.json_schema.name;
    },
    () => {},
    'provider_schema_projection_contract_missing'
  ], [
    'wrong-schema-name',
    (request) => {
      request.responseFormat.json_schema.name = 'wrong_planner_contract';
    },
    () => {},
    'provider_schema_projection_contract_missing'
  ], [
    'missing-schema-description',
    (request) => {
      delete request.responseFormat.json_schema.schema.description;
    },
    () => {},
    'provider_schema_projection_request_invalid'
  ], [
    'mutated-schema-description',
    (request) => {
      request.responseFormat.json_schema.schema.description += ' drift';
    },
    () => {},
    'provider_schema_projection_request_invalid'
  ], [
    'missing-projection-marker',
    () => {},
    (preflight) => {
      delete preflight.structuredOutputProjection;
    },
    'provider_schema_projection_proof_invalid'
  ], [
    'mutated-projection-marker',
    () => {},
    (preflight) => {
      preflight.structuredOutputProjection.providerSchemaSha256 =
        '0'.repeat(64);
    },
    'provider_schema_projection_proof_invalid'
  ]]) {
    const request = structuredClone(requestSeen);
    const preflight = structuredClone(result.preflight);
    requestMutation(request);
    preflightMutation(preflight);
    const issue = await guardedProjectionDispatch(request, preflight);
    if (issue !== expectedIssue) {
      throw new Error(
        `${label} lost its pre-provider projection fence: ${issue}`
      );
    }
  }
  if (projectionBoundaryCalls !== 0) {
    throw new Error(
      'invalid projection proof reached the planner provider callback'
    );
  }

  const historicalReplayRequest = structuredClone(requestSeen);
  historicalReplayRequest.model = 'deepseek/deepseek-v4-flash-0731';
  historicalReplayRequest.models = ['deepseek/deepseek-v4-flash-0731'];
  if (opportunityDiscoveryPlannerProjectionIssue(
    historicalReplayRequest,
    {}
  ) !== '') {
    throw new Error(
      'exact injected historical planner replay lost compatibility'
    );
  }
  historicalReplayRequest.model =
    'deepseek/deepseek-v4-flash-20260731';
  historicalReplayRequest.models = [
    'deepseek/deepseek-v4-flash-20260731'
  ];
  if (opportunityDiscoveryPlannerProjectionIssue(
    historicalReplayRequest,
    {}
  ) !== 'provider_schema_projection_model_invalid') {
    throw new Error(
      'historical provider-returned identity gained planner dispatch authority'
    );
  }

  for (const [label, configuredModel] of [
    ['permaslug', 'openai/gpt-5.6-luna-20260709'],
    ['case', 'OpenAI/gpt-5.6-luna'],
    ['leading-whitespace', ' openai/gpt-5.6-luna'],
    ['trailing-whitespace', 'openai/gpt-5.6-luna ']
  ]) {
    let invalidModelProviderCalls = 0;
    const invalidModel = await runOpportunityDiscoveryPlannerRaw({
      job,
      model: configuredModel,
      now,
      completeJSON: async () => {
        invalidModelProviderCalls += 1;
        throw new Error(`${label} config reached provider`);
      }
    });
    if (invalidModelProviderCalls !== 0 ||
        invalidModel.status !== 'blocked' ||
        invalidModel.preflight?.authorized !== false ||
        invalidModel.preflight?.cause !==
          'provider_schema_projection_model_invalid' ||
        invalidModel.sideEffectsPerformed !== 0) {
      throw new Error(
        `${label} Luna config crossed the pre-provider fence: ${JSON.stringify(invalidModel)}`
      );
    }
  }

  for (const [label, mutation] of [
    ['request-model-permaslug', (request) => {
      request.model = 'openai/gpt-5.6-luna-20260709';
    }],
    ['request-model-missing', (request) => {
      request.model = '';
    }],
    ['request-model-case', (request) => {
      request.model = 'OpenAI/gpt-5.6-luna';
    }],
    ['request-models-permaslug', (request) => {
      request.models = ['openai/gpt-5.6-luna-20260709'];
    }],
    ['provider-sort', (request) => {
      request.provider.sort = 'throughput';
    }],
    ['provider-service-tier', (request) => {
      request.provider.service_tier = 'priority';
    }],
    ['request-service-tier', (request) => {
      request.service_tier = 'priority';
    }],
    ['response-format-key', (request) => {
      request.responseFormat.unreviewed = true;
    }],
    ['json-schema-key', (request) => {
      request.responseFormat.json_schema.unreviewed = true;
    }],
    ['json-schema-name-whitespace', (request) => {
      request.responseFormat.json_schema.name =
        ` ${OPPORTUNITY_DISCOVERY_PLAN_CONTRACT}`;
    }]
  ]) {
    const mutated = structuredClone(requestSeen);
    mutation(mutated);
    let rejected = false;
    try {
      serializeOpenRouterJSONRequestBody(mutated);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(`${label} escaped the exact Luna projection route`);
    }
  }

  const historicalRequest = structuredClone(requestSeen);
  historicalRequest.model = 'deepseek/deepseek-v4-flash-0731';
  historicalRequest.models = ['deepseek/deepseek-v4-flash-0731'];
  historicalRequest.reasoning = { enabled: false, exclude: true };
  const historicalWire = JSON.parse(
    serializeOpenRouterJSONRequestBody(historicalRequest)
  );
  const criticRequest = structuredClone(requestSeen);
  criticRequest.responseFormat.json_schema.name =
    'opportunity_tournament_critic_v1';
  const criticWire = JSON.parse(serializeOpenRouterJSONRequestBody(
    criticRequest
  ));
  if (JSON.stringify(historicalWire.response_format) !==
        JSON.stringify(historicalRequest.responseFormat) ||
      JSON.stringify(criticWire.response_format) !==
        JSON.stringify(criticRequest.responseFormat)) {
    throw new Error(
      'current planner projection changed a historical or critic schema'
    );
  }

  // The provider grammar omits the reviewed patterns, but acceptance never
  // does. A value admitted by that relaxed provider schema must still fail the
  // untouched local canonical schema before normalization or effects.
  const providerOnlyValid = await runOpportunityDiscoveryPlannerRaw({
    job,
    model: 'openai/gpt-5.6-luna',
    now,
    completeJSON: async (request) => {
      const plans = compactFreshPlannerPlans(twoPlannerMotions(
        cases[0].plans(evidenceRef)[0],
        evidenceRef
      ));
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const planValue of plans) planValue.market = exactMarket;
      plans[0].organizationTerms[0] = ' invalid';
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage: {
          prompt_tokens: 900,
          completion_tokens: 650,
          total_tokens: 1_550,
          cost: 0.001
        },
        generationId: 'generation-luna-provider-only-schema-valid',
        diagnostics: {
          ...acceptedCurrentLunaRouteDiagnostics(),
          finishReason: 'stop',
          nativeFinishReason: 'completed',
          contentByteCount: 8_000,
          contentSha256: '4'.repeat(64)
        }
      };
    }
  });
  if (providerOnlyValid.status !== 'blocked' ||
      providerOnlyValid.plans.length !== 0 ||
      providerOnlyValid.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      !providerOnlyValid.normalizationDiagnostic?.issues?.some((issue) =>
        issue.keyword === 'pattern' &&
        issue.instancePath === '/plans/0/organizationTerms/0'
      ) ||
      providerOnlyValid.llm?.commercialCritic !== undefined ||
      providerOnlyValid.sideEffectsPerformed !== 0) {
    throw new Error(
      `provider projection bypassed exact local AJV: ${JSON.stringify(providerOnlyValid)}`
    );
  }

  // Current direct-route acceptance requires bounded endpoint-catalog
  // metadata. It is not an allowlist cardinality, but omission, zero, or a
  // value beyond the durable diagnostic cap cannot prove the reviewed route.
  for (const [label, candidateCount] of [
    ['missing-candidate-count', undefined],
    ['zero-candidate-count', 0],
    ['oversized-candidate-count', 65]
  ]) {
    const diagnostics = {
      ...acceptedCurrentLunaRouteDiagnostics(),
      finishReason: 'stop',
      nativeFinishReason: 'completed'
    };
    if (candidateCount === undefined) {
      delete diagnostics.routerCandidateCount;
    } else {
      diagnostics.routerCandidateCount = candidateCount;
    }
    const blocked = await runOpportunityDiscoveryPlannerRaw({
      job,
      model: 'openai/gpt-5.6-luna',
      now,
      completeJSON: async (request) => {
        const plans = compactFreshPlannerPlans(twoPlannerMotions(
          cases[0].plans(evidenceRef)[0],
          evidenceRef
        ));
        const exactMarket = request.responseFormat?.json_schema?.schema
          ?.properties?.plans?.items?.properties?.market?.enum?.[0];
        for (const planValue of plans) planValue.market = exactMarket;
        return {
          data: {
            contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
            status: 'planned',
            reason: '',
            plans
          },
          usage: {
            prompt_tokens: 900,
            completion_tokens: 650,
            total_tokens: 1_550,
            cost: 0.001
          },
          generationId: `generation-${label}`,
          diagnostics: {
            ...diagnostics,
            contentByteCount: 8_000,
            contentSha256: '3'.repeat(64)
          }
        };
      }
    });
    if (blocked.status !== 'blocked' || blocked.plans.length !== 0 ||
        blocked.preflight?.routeProvenanceIssue !==
          'candidate_count_missing_or_invalid' ||
        blocked.preflight?.routeProvenanceValidated !== false ||
        blocked.sideEffectsPerformed !== 0) {
      throw new Error(
        `${label} escaped current route candidate metadata: ${JSON.stringify(blocked)}`
      );
    }
  }

  // `completed` is OpenAI Luna's reviewed native success terminal, not a
  // generic synonym for stop. A legacy model or a non-OpenAI endpoint must
  // never use it to cross the completed structured-output gate.
  for (const [label, model, diagnostics] of [[
    'legacy-native-completed',
    'deepseek/deepseek-v4-flash-0731',
    {
      ...acceptedPlannerRouteDiagnostics(),
      finishReason: 'stop',
      nativeFinishReason: 'completed'
    }
  ], [
    'foreign-provider-native-completed',
    'openai/gpt-5.6-luna',
    {
      ...acceptedCurrentLunaRouteDiagnostics(),
      routerSelectedProvider: 'Azure',
      routerEnvelopeProvider: 'Azure',
      routerAttempts: [{
        provider: 'Azure',
        model: 'openai/gpt-5.6-luna-20260709',
        status: 200
      }],
      finishReason: 'stop',
      nativeFinishReason: 'completed'
    }
  ], [
    'non-direct-native-completed',
    'openai/gpt-5.6-luna',
    {
      ...acceptedCurrentLunaRouteDiagnostics(),
      routerStrategy: 'fallback',
      finishReason: 'stop',
      nativeFinishReason: 'completed'
    }
  ]]) {
    const blocked = await runOpportunityDiscoveryPlannerRaw({
      job,
      model,
      now,
      completeJSON: async (request) => {
        const plans = compactFreshPlannerPlans(twoPlannerMotions(
          cases[0].plans(evidenceRef)[0],
          evidenceRef
        ));
        const exactMarket = request.responseFormat?.json_schema?.schema
          ?.properties?.plans?.items?.properties?.market?.enum?.[0];
        for (const planValue of plans) planValue.market = exactMarket;
        return {
          data: {
            contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
            status: 'planned',
            reason: '',
            plans
          },
          usage: {
            prompt_tokens: 900,
            completion_tokens: 650,
            total_tokens: 1_550,
            cost: 0.001
          },
          generationId: `generation-${label}`,
          diagnostics: {
            ...diagnostics,
            contentByteCount: 8_000,
            contentSha256: '2'.repeat(64)
          }
        };
      }
    });
    if (blocked.status !== 'blocked' || blocked.plans.length !== 0 ||
        blocked.preflight?.finishIssue !==
          'native_finish_reason_not_stop' ||
        blocked.sideEffectsPerformed !== 0) {
      throw new Error(
        `${label} treated native completed as a generic success: ${JSON.stringify(blocked)}`
      );
    }
  }

  for (const [label, selectedProvider, selectedModel, expectedIssue] of [
    [
      'azure-provider',
      'Azure',
      'openai/gpt-5.6-luna-20260709',
      'observed_provider_not_requested'
    ],
    [
      'priority-provider',
      'openai/priority',
      'openai/gpt-5.6-luna-20260709',
      'observed_provider_not_requested'
    ],
    [
      'priority-model',
      'OpenAI',
      'openai/gpt-5.6-luna:priority',
      'observed_model_not_requested'
    ]
  ]) {
    let calls = 0;
    let failureRequest;
    const failed = await runOpportunityDiscoveryPlannerRaw({
      job,
      model: 'openai/gpt-5.6-luna',
      now,
      completeJSON: async (request) => {
        calls += 1;
        failureRequest = request;
        const error = new Error('bounded current-route failure');
        error.openRouterFailureCode = 'openrouter_timeout';
        error.openRouterGenerationId = `generation-luna-${label}`;
        error.openRouterDiagnostics = {
          httpStatus: 200,
          routerSelectedProvider: selectedProvider,
          routerSelectedModel: selectedModel,
          routerEnvelopeProvider: selectedProvider,
          routerEnvelopeModel: selectedModel,
          streaming: true,
          streamEventCount: 1,
          streamWireByteCount: 1,
          streamFirstDataLatencyMs: 1,
          streamDurationMs: 300_001,
          streamCompleted: false,
          timeoutKind: 'total',
          timeoutOrigin: 'profilescribe_local_deadline',
          timeoutDeadlineMs: 300_000,
          timeoutElapsedMs: 300_001,
          timeoutPhase: 'response_stream',
          responseHeadersReceived: true
        };
        throw error;
      }
    });
    if (calls !== 1 ||
        failed.status !== 'blocked' ||
        failed.failureCode !== 'planner_route_provenance_invalid' ||
        failed.recoveryCause !==
          'commercial_discovery_planner_route_provenance_recovery' ||
        failed.preflight?.routeProvenanceIssue !== expectedIssue ||
        failed.preflight?.routeProvenanceValidated !== false ||
        failed.planSelection?.acceptedPlanCount !== 0 ||
        failed.llm?.commercialCritic !== undefined ||
        failed.sideEffectsPerformed !== 0 ||
        JSON.stringify(failureRequest?.provider) !== JSON.stringify({
          order: ['openai'],
          only: ['openai'],
          ignore: [],
          allow_fallbacks: false,
          require_parameters: true,
          data_collection: 'deny',
          max_price: { prompt: 0.2, completion: 1.2, request: 0 }
        }) ||
        serializeOpenRouterJSONRequestBody(failureRequest).includes(
          'service_tier'
        )) {
      throw new Error(
        `${label} escaped current Luna generator route quarantine: ${JSON.stringify(failed)}`
      );
    }
  }
}

async function verifyCurrentLunaProductionLengthFailuresPreserveProjection(
  job
) {
  const incidents = [{
    label: 'fresh',
    generationId: 'gen-1786662931-q2cJSmNYjUhXR8vgMaTy',
    promptTokens: 5_152,
    completionTokens: 261,
    totalTokens: 5_413,
    cost: 0.000800525,
    expectedCostMicros: 801,
    contentByteCount: 999,
    contentSha256:
      '63e7059b8a9ef3be05183345e65f584d8d71103eebdba66e8da61e2688180bd1',
    streamEventCount: 251,
    streamWireByteCount: 69_960,
    streamFirstDataLatencyMs: 1_083,
    streamDurationMs: 2_972
  }, {
    label: 'linked',
    generationId: 'gen-1786663919-XXDZVBMqNL0WKPTVh2pY',
    promptTokens: 5_151,
    completionTokens: 77,
    totalTokens: 5_228,
    cost: 0.000392725,
    expectedCostMicros: 393,
    contentByteCount: 318,
    contentSha256:
      '3c7a0dad0c47a6a41cfc449f1fb881767456677fa4b0c73c23c92abf0ffa36ea',
    streamEventCount: 67,
    streamWireByteCount: 19_355,
    streamFirstDataLatencyMs: 581,
    streamDurationMs: 1_565
  }];
  for (const incident of incidents) {
    let calls = 0;
    let requestSeen;
    const result = await runOpportunityDiscoveryPlannerRaw({
      job,
      model: 'openai/gpt-5.6-luna',
      now,
      completeJSON: async (request) => {
        calls += 1;
        requestSeen = request;
        const error = new Error(
          'OpenRouter ended current Luna structured output at its token limit'
        );
        error.openRouterFailureCode =
          'openrouter_truncated_structured_output';
        error.openRouterGenerationId = incident.generationId;
        error.openRouterUsage = {
          prompt_tokens: incident.promptTokens,
          completion_tokens: incident.completionTokens,
          total_tokens: incident.totalTokens,
          cost: incident.cost
        };
        error.openRouterDiagnostics = {
          ...acceptedCurrentLunaRouteDiagnostics(),
          routerCandidateCount: 4,
          finishReason: 'length',
          nativeFinishReason: 'max_output_tokens',
          contentByteCount: incident.contentByteCount,
          contentSha256: incident.contentSha256,
          streaming: true,
          streamEventCount: incident.streamEventCount,
          streamWireByteCount: incident.streamWireByteCount,
          streamFirstDataLatencyMs: incident.streamFirstDataLatencyMs,
          streamDurationMs: incident.streamDurationMs,
          streamCompleted: false,
          responseHeadersReceived: true
        };
        throw error;
      }
    });
    const receipt = result.llm?.discoveryPlanner;
    const diagnostics = receipt?.responseDiagnostics;
    const projection = result.preflight?.structuredOutputProjection;
    const serialized = serializeOpenRouterJSONRequestBody(requestSeen);
    if (calls !== 1 || result.status !== 'blocked' ||
        result.plans.length !== 0 ||
        result.usage?.calls !== 1 ||
        result.usage?.successfulCalls !== 0 ||
        result.usage?.promptTokens !== incident.promptTokens ||
        result.usage?.completionTokens !== incident.completionTokens ||
        result.usage?.totalTokens !== incident.totalTokens ||
        result.usage?.reportedCostMicros !== incident.expectedCostMicros ||
        receipt?.status !== 'incomplete' ||
        receipt?.error !== 'openrouter_truncated_structured_output' ||
        receipt?.generationId !== incident.generationId ||
        diagnostics?.routerSelectedProvider !== 'OpenAI' ||
        diagnostics?.routerCandidateCount !== 4 ||
        diagnostics?.finishReason !== 'length' ||
        diagnostics?.nativeFinishReason !== 'max_output_tokens' ||
        diagnostics?.contentByteCount !== incident.contentByteCount ||
        diagnostics?.contentSha256 !== incident.contentSha256 ||
        diagnostics?.streamEventCount !== incident.streamEventCount ||
        diagnostics?.streamWireByteCount !== incident.streamWireByteCount ||
        diagnostics?.streamFirstDataLatencyMs !==
          incident.streamFirstDataLatencyMs ||
        diagnostics?.streamDurationMs !== incident.streamDurationMs ||
        diagnostics?.streamCompleted !== false ||
        projection?.contractVersion !==
          'opportunity_discovery_provider_schema_projection_v1' ||
        projection?.omittedPatternPathsSha256 !==
          CURRENT_LUNA_PROVIDER_OMITTED_PATTERN_PATHS_SHA256 ||
        projection?.omittedPatternCount !== 14 ||
        projection?.localExactSchemaRequired !== true ||
        result.preflight?.requestBodyByteCount !==
          Buffer.byteLength(serialized, 'utf8') ||
        result.preflight?.requestBodySha256 !== createHash('sha256')
          .update(serialized, 'utf8').digest('hex') ||
        result.normalizationDiagnostic !== undefined ||
        result.llm?.commercialCritic !== undefined ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${incident.label} Luna length incident lost bounded projection proof: ${JSON.stringify({ requestSeen, result })}`
      );
    }
  }
}

async function verifyTruncatedPlannerFailsOnceWithSafeReceipt(job) {
  const liveTruncatedCompletionTokens = 16_000;
  let calls = 0;
  let requestSeen;
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
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
        total_tokens: 25_700,
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
      JSON.stringify(requestSeen?.reasoning) !==
        JSON.stringify({ enabled: false, exclude: true }) ||
      requestSeen?.responseFormat?.json_schema?.schema?.properties
        ?.plans?.maxItems !== 2 ||
      result.status !== 'blocked' ||
      result.reason !==
        'The discovery planner did not produce a complete terminal structured plan.' ||
      result.plans.length !== 0 ||
      result.usage?.calls !== 1 ||
      result.usage?.successfulCalls !== 0 ||
      result.usage?.completionTokens !==
        liveTruncatedCompletionTokens ||
      result.usage?.reportedCostMicros !== 21_680 ||
      receipt?.status !== 'incomplete' ||
      receipt?.error !== 'openrouter_truncated_structured_output' ||
      receipt?.generationId !== 'generation-live-length-regression' ||
      receipt?.responseDiagnostics?.finishReason !== 'length' ||
      receipt?.responseDiagnostics?.nativeFinishReason !==
        'max_output_tokens' ||
      receipt?.responseDiagnostics?.contentByteCount !== 21_600 ||
      receipt?.responseDiagnostics?.contentSha256 !== '7'.repeat(64) ||
      receipt?.responseDiagnostics?.localJSONRepairApplied !== undefined ||
      receipt?.responseDiagnostics?.localJSONRepairFailure !== undefined ||
      result.normalizationDiagnostic !== undefined ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.preflight?.authorized !== true ||
      result.preflight?.promptTokenCanary?.requestBodyByteCount !==
        result.preflight?.requestBodyByteCount ||
      result.preflight?.promptTokenCanary?.framingTokenReserve !== 1_024 ||
      result.preflight?.promptTokenCanary?.injectedContextTokenReserve !== 0 ||
      result.preflight?.promptTokenCanary?.serializedPromptTokenCeiling !==
        result.preflight?.serializedPromptTokenCeiling ||
      result.preflight?.promptTokenCanary?.promptTokenCeiling !==
        result.preflight?.promptTokenCeiling ||
      result.preflight?.promptTokenCanary?.reportedPromptTokens !== 9_700 ||
      result.preflight?.promptTokenCanary?.withinCeiling !== true ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `truncated planner did not fail once with a safe cause-matched receipt: ${JSON.stringify({ calls, requestMaxTokens: requestSeen?.maxTokens, result })}`
    );
  }
}

async function verifySiliconFlowProductionTimeoutFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      const error = new Error(
        'OpenRouter streaming request exceeded its bounded total deadline'
      );
      error.openRouterFailureCode = 'openrouter_timeout';
      error.openRouterGenerationId =
        'generation-siliconflow-production-timeout';
      error.openRouterDiagnostics = {
        httpStatus: 200,
        routerStrategy: 'default',
        routerAttempt: 1,
        routerCandidateCount: 15,
        routerAttemptSequenceSource: 'reported',
        routerSelectedEndpointEvidenced: true,
        routerSelectedProvider: 'SiliconFlow',
        routerSelectedModel: 'deepseek/deepseek-v4-flash-20260731',
        routerEnvelopeProvider: 'SiliconFlow',
        routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
        routerFinalAttemptProvider: 'SiliconFlow',
        routerFinalAttemptModel: 'deepseek/deepseek-v4-flash-20260731',
        routerAttemptStatuses: [200],
        routerAttempts: [{
          provider: 'SiliconFlow',
          model: 'deepseek/deepseek-v4-flash-20260731',
          status: 200
        }],
        contentByteCount: 37_767,
        contentSha256: '6'.repeat(64),
        streaming: true,
        streamEventCount: 7_457,
        streamWireByteCount: 1_776_412,
        streamFirstDataLatencyMs: 1_233,
        streamDurationMs: 300_007,
        streamCompleted: false,
        timeoutKind: 'total',
        timeoutOrigin: 'profilescribe_local_deadline',
        timeoutDeadlineMs: 300_000,
        timeoutElapsedMs: 300_007,
        timeoutPhase: 'response_stream',
        responseHeadersReceived: true
      };
      throw error;
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      requestSeen?.maxTokens !== 42_000 ||
      requestSeen?.streamTotalTimeoutMs !== 300_000 ||
      JSON.stringify(requestSeen?.provider?.ignore) !==
        JSON.stringify(expectedIgnore) ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      requestSeen?.provider?.sort !== 'throughput' ||
      requestSeen?.provider?.allow_fallbacks !== true ||
      requestSeen?.provider?.require_parameters !== true ||
      requestSeen?.provider?.data_collection !== 'deny' ||
      result.status !== 'blocked' || result.plans.length !== 0 ||
      result.usage?.calls !== 1 || result.usage?.successfulCalls !== 0 ||
      result.usage?.promptTokens !== 0 ||
      result.usage?.completionTokens !== 0 ||
      receipt?.status !== 'failed' ||
      receipt?.error !== 'openrouter_timeout' ||
      JSON.stringify(receipt?.openRouterUsage) !== '{}' ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerSelectedProvider !== 'SiliconFlow' ||
      diagnostics?.contentByteCount !== 37_767 ||
      diagnostics?.streamEventCount !== 7_457 ||
      diagnostics?.streamDurationMs !== 300_007 ||
      diagnostics?.streamCompleted !== false ||
      diagnostics?.timeoutKind !== 'total' ||
      diagnostics?.timeoutOrigin !== 'profilescribe_local_deadline' ||
      diagnostics?.timeoutDeadlineMs !== 300_000 ||
      diagnostics?.timeoutElapsedMs !== 300_007 ||
      diagnostics?.timeoutPhase !== 'response_stream' ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.finishReason !== undefined ||
      diagnostics?.nativeFinishReason !== undefined ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(
        'raw-siliconflow-timeout-secret-sentinel'
      )) {
    throw new Error(
      `SiliconFlow production timeout did not fail once with a safe receipt: ${JSON.stringify({ calls, request: requestSeen, result })}`
    );
  }
}

async function verifyAmbientProductionTimeoutFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  const rawSentinel = 'raw-ambient-timeout-secret-sentinel';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      const error = new Error(
        'OpenRouter streaming request exceeded its bounded total deadline'
      );
      error.openRouterFailureCode = 'openrouter_timeout';
      error.openRouterGenerationId =
        'gen-1786632170-nWj2gO8B2X7MDoFKgflA';
      error.openRouterDiagnostics = {
        httpStatus: 200,
        routerSelectedProvider: 'Ambient',
        routerSelectedModel: 'deepseek/deepseek-v4-flash-0731',
        routerEnvelopeProvider: 'Ambient',
        routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
        contentByteCount: 19_990,
        contentSha256:
          'b4fc80db45ba2194e2b325d3126890aa105fa8c6d8a2f6696f51503d11db24d0',
        streaming: true,
        streamEventCount: 6_235,
        streamWireByteCount: 1_796_266,
        streamFirstDataLatencyMs: 1_645,
        streamDurationMs: 300_008,
        streamCompleted: false,
        timeoutKind: 'total',
        timeoutOrigin: 'profilescribe_local_deadline',
        timeoutDeadlineMs: 300_000,
        timeoutElapsedMs: 300_008,
        timeoutPhase: 'response_stream',
        responseHeadersReceived: true,
        rawProviderBody: rawSentinel
      };
      // The production generation-detail lookup returned HTTP 404. It
      // supplied no usage or terminal evidence and cannot authorize another
      // planner, repair, or critic call.
      throw error;
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  const capabilityRouting =
    opportunityCommercialDiscoveryCapabilities()
      .plannerCallEnvelope.providerRouting;
  if (calls !== 1 ||
      requestSeen?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(requestSeen?.models) !==
        JSON.stringify(['deepseek/deepseek-v4-flash-0731']) ||
      requestSeen?.maxTokens !== 42_000 ||
      requestSeen?.stream !== true ||
      requestSeen?.streamStartTimeoutMs !== 180_000 ||
      requestSeen?.streamIdleTimeoutMs !== 60_000 ||
      requestSeen?.streamTotalTimeoutMs !== 300_000 ||
      requestSeen?.streamMaxContentBytes !==
        MAX_DISCOVERY_PLANNER_RAW_STREAM_CONTENT_BYTES ||
      JSON.stringify(requestSeen?.provider?.ignore) !==
        JSON.stringify(expectedIgnore) ||
      requestSeen?.provider?.sort !== 'throughput' ||
      requestSeen?.provider?.allow_fallbacks !== true ||
      requestSeen?.provider?.require_parameters !== true ||
      requestSeen?.provider?.data_collection !== 'deny' ||
      JSON.stringify(requestSeen?.provider?.max_price) !==
        JSON.stringify({ prompt: 2, completion: 6, request: 0 }) ||
      requestSeen?.provider?.order !== undefined ||
      requestSeen?.provider?.only !== undefined ||
      JSON.stringify(capabilityRouting) !== JSON.stringify({
        order: ['openai'],
        only: ['openai'],
        ignore: [],
        allow_fallbacks: false,
        require_parameters: true,
        data_collection: 'deny',
        routerMetadata: 'enabled'
      }) ||
      result.status !== 'blocked' || result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(result.planSelection?.rejectedPlans) !== '[]' ||
      result.webSearchReceipt !== null ||
      result.preflight?.responseBodyByteCount !== undefined ||
      result.preflight?.routeProvenanceValidated !== undefined ||
      result.usage?.calls !== 1 || result.usage?.successfulCalls !== 0 ||
      result.usage?.promptTokens !== 0 ||
      result.usage?.completionTokens !== 0 ||
      receipt?.status !== 'failed' ||
      receipt?.error !== 'openrouter_timeout' ||
      receipt?.generationId !==
        'gen-1786632170-nWj2gO8B2X7MDoFKgflA' ||
      JSON.stringify(receipt?.openRouterUsage) !== '{}' ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerSelectedProvider !== 'Ambient' ||
      diagnostics?.contentByteCount !== 19_990 ||
      diagnostics?.contentSha256 !==
        'b4fc80db45ba2194e2b325d3126890aa105fa8c6d8a2f6696f51503d11db24d0' ||
      diagnostics?.streamEventCount !== 6_235 ||
      diagnostics?.streamWireByteCount !== 1_796_266 ||
      diagnostics?.streamFirstDataLatencyMs !== 1_645 ||
      diagnostics?.streamDurationMs !== 300_008 ||
      diagnostics?.streamCompleted !== false ||
      diagnostics?.timeoutKind !== 'total' ||
      diagnostics?.timeoutOrigin !== 'profilescribe_local_deadline' ||
      diagnostics?.timeoutDeadlineMs !== 300_000 ||
      diagnostics?.timeoutElapsedMs !== 300_008 ||
      diagnostics?.timeoutPhase !== 'response_stream' ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.finishReason !== undefined ||
      diagnostics?.nativeFinishReason !== undefined ||
      diagnostics?.localJSONRepairApplied !== undefined ||
      diagnostics?.localJSONRepairFailure !== undefined ||
      result.normalizationDiagnostic !== undefined ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel)) {
    throw new Error(
      `Ambient production timeout did not fail once with exact route parity and a safe receipt: ${JSON.stringify({ calls, request: requestSeen, result })}`
    );
  }
}

async function verifyBaiduProductionStrictSchemaMismatchFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  let wireRequestSeen;
  const rawSentinel = 'raw-baidu-schema-mismatch-secret-sentinel';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      wireRequestSeen = JSON.parse(serializeOpenRouterJSONRequestBody({
        ...request,
        apiKey: 'not-serialized'
      }));
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      const evidenceRef = buildEvidenceCatalog(job.payload, {}, now, {
        includeSystemAttributionCapability: true
      }).find((item) => /^observation:/i.test(item.id || ''))?.id;
      if (!evidenceRef) {
        throw new Error('Baidu fixture has no approved observation evidence');
      }
      const plans = compactFreshPlannerPlans(
        twoPlannerMotions(
          cases[0].plans(evidenceRef)[0],
          evidenceRef
        )
      );
      for (const plan of plans) plan.market = exactMarket;
      for (const plan of plans) {
        const revenue = plan.contingentFinalists.pathBase.r[0];
        delete revenue.k;
        revenue.io = 'Operational interest without an attributable outcome';
        revenue.cd = 'A destination without a paid conversion path';
        revenue.g.b = revenue.g.b[0];
        revenue.g.o = revenue.g.o[0];
        revenue.g.a = revenue.g.a[0];
        revenue.g.d.l = 'A destination without a conversion mechanism';
        revenue.g.c = revenue.g.c[0];
      }
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage: {
          prompt_tokens: 13_004,
          completion_tokens: 4_408,
          total_tokens: 17_412,
          cost: 0.0030548
        },
        generationId: 'gen-1786633926-Al97kT5cl1a6RQL3z891',
        diagnostics: {
          httpStatus: 200,
          routerStrategy: 'direct',
          routerAttempt: 1,
          routerCandidateCount: 27,
          routerAttemptStatuses: [200],
          routerAttempts: [{
            provider: 'Baidu',
            model: 'deepseek/deepseek-v4-flash-20260731',
            status: 200
          }],
          routerAttemptSequenceSource:
            'selected_endpoint_reconstructed',
          routerSelectedEndpointEvidenced: true,
          routerSelectedProvider: 'Baidu',
          routerSelectedModel: 'deepseek/deepseek-v4-flash-20260731',
          routerEnvelopeProvider: 'Baidu',
          routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 17_653,
          contentSha256:
            '328823dbe54b49f694bf968da8a6199a957b754b9ba7d2384b91fac275f9dc14',
          streaming: true,
          streamEventCount: 4_409,
          streamWireByteCount: 1_264_222,
          streamFirstDataLatencyMs: 829,
          streamDurationMs: 44_315,
          streamCompleted: true,
          responseHeadersReceived: true,
          rawProviderBody: rawSentinel
        },
        annotations: []
      };
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIssues = [
    ['required', '/plans/0/contingentFinalists/pathBase/r/0', 'k'],
    ['pattern', '/plans/0/contingentFinalists/pathBase/r/0/io', ''],
    ['pattern', '/plans/0/contingentFinalists/pathBase/r/0/cd', ''],
    ['type', '/plans/0/contingentFinalists/pathBase/r/0/g/b', ''],
    ['type', '/plans/0/contingentFinalists/pathBase/r/0/g/o', ''],
    ['type', '/plans/0/contingentFinalists/pathBase/r/0/g/a', ''],
    ['pattern', '/plans/0/contingentFinalists/pathBase/r/0/g/d/l', ''],
    ['type', '/plans/0/contingentFinalists/pathBase/r/0/g/c', '']
  ];
  const actualIssues = result.normalizationDiagnostic?.issues?.map(
    (issue) => [
      issue.keyword,
      issue.instancePath,
      issue.missingProperty || ''
    ]
  );
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      JSON.stringify(wireRequestSeen?.response_format) !==
        JSON.stringify(requestSeen?.responseFormat) ||
      JSON.stringify(wireRequestSeen?.provider?.ignore) !==
        JSON.stringify(expectedIgnore) ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      result.status !== 'blocked' || result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      result.webSearchReceipt !== null ||
      result.usage?.calls !== 1 || result.usage?.successfulCalls !== 1 ||
      result.usage?.promptTokens !== 13_004 ||
      result.usage?.completionTokens !== 4_408 ||
      result.usage?.totalTokens !== 17_412 ||
      result.usage?.reportedCostMicros !== 3_055 ||
      receipt?.status !== 'completed' ||
      receipt?.generationId !==
        'gen-1786633926-Al97kT5cl1a6RQL3z891' ||
      receipt?.model !== 'deepseek/deepseek-v4-flash-20260731' ||
      receipt?.requestedModel !== 'deepseek/deepseek-v4-flash-0731' ||
      receipt?.openRouterUsage?.prompt_tokens !== 13_004 ||
      receipt?.openRouterUsage?.completion_tokens !== 4_408 ||
      receipt?.openRouterUsage?.total_tokens !== 17_412 ||
      receipt?.openRouterUsage?.cost !== 0.0030548 ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerSelectedProvider !== 'Baidu' ||
      diagnostics?.routerSelectedEndpointEvidenced !== true ||
      diagnostics?.finishReason !== 'stop' ||
      diagnostics?.nativeFinishReason !== 'stop' ||
      diagnostics?.contentByteCount !== 17_653 ||
      diagnostics?.contentSha256 !==
        '328823dbe54b49f694bf968da8a6199a957b754b9ba7d2384b91fac275f9dc14' ||
      diagnostics?.streamEventCount !== 4_409 ||
      diagnostics?.streamWireByteCount !== 1_264_222 ||
      diagnostics?.streamFirstDataLatencyMs !== 829 ||
      diagnostics?.streamDurationMs !== 44_315 ||
      diagnostics?.streamCompleted !== true ||
      result.preflight?.routeProvenanceValidated !== true ||
      !Number.isInteger(result.preflight?.responseBodyByteCount) ||
      result.preflight.responseBodyByteCount <= 0 ||
      result.preflight.responseBodyByteCount >
        MAX_DISCOVERY_PLANNER_RESPONSE_BYTES ||
      result.normalizationDiagnostic?.contractVersion !==
        OPPORTUNITY_DISCOVERY_PLANNER_DIAGNOSTIC_CONTRACT ||
      result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      result.normalizationDiagnostic?.failedMotionCount !== 2 ||
      JSON.stringify(actualIssues) !== JSON.stringify(expectedIssues) ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel)) {
    throw new Error(
      `Baidu production strict-schema mismatch did not fail once after exact completed accounting: ${JSON.stringify({
        calls,
        routeIgnore: requestSeen?.provider?.ignore,
        wireSchemaParity:
          JSON.stringify(wireRequestSeen?.response_format) ===
            JSON.stringify(requestSeen?.responseFormat),
        status: result.status,
        plans: result.plans?.length,
        planSelection: result.planSelection,
        usage: result.usage,
        receipt,
        preflight: result.preflight,
        normalizationDiagnostic: result.normalizationDiagnostic,
        criticPresent: result.llm?.commercialCritic !== undefined,
        repairPresent: result.llm?.strategyFamilyRepair !== undefined,
        sideEffectsPerformed: result.sideEffectsPerformed,
        rawSentinelPresent: JSON.stringify(result).includes(rawSentinel)
      })}`
    );
  }
}

async function verifyFireworksProductionStrictSchemaMismatchFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  let wireRequestSeen;
  const rawSentinel = 'raw-fireworks-schema-mismatch-secret-sentinel';
  const invalidConversionDestination =
    'A destination without a paid conversion path';
  const invalidDiscoveryLink =
    'A destination without a conversion mechanism';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      wireRequestSeen = JSON.parse(serializeOpenRouterJSONRequestBody({
        ...request,
        apiKey: 'not-serialized'
      }));
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      const evidenceRef = buildEvidenceCatalog(job.payload, {}, now, {
        includeSystemAttributionCapability: true
      }).find((item) => /^observation:/i.test(item.id || ''))?.id;
      if (!evidenceRef) {
        throw new Error(
          'Fireworks fixture has no approved observation evidence'
        );
      }
      const plans = compactFreshPlannerPlans(
        twoPlannerMotions(
          cases[0].plans(evidenceRef)[0],
          evidenceRef
        )
      );
      for (const plan of plans) plan.market = exactMarket;
      for (const plan of plans) {
        const revenue = plan.contingentFinalists.pathBase.r[0];
        revenue.cd = invalidConversionDestination;
        revenue.g.d.l = invalidDiscoveryLink;
      }
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage: {
          prompt_tokens: 13_668,
          completion_tokens: 3_856,
          total_tokens: 17_524,
          cost: 0.0029932
        },
        generationId: 'gen-1786637226-Ta0zDVPrCAGofAxY4SBK',
        diagnostics: {
          httpStatus: 200,
          routerStrategy: 'direct',
          routerAttempt: 2,
          routerCandidateCount: 27,
          routerAttemptStatuses: [504, 200],
          routerAttempts: [{
            provider: 'AtlasCloud',
            model: 'deepseek/deepseek-v4-flash-20260731',
            status: 504
          }, {
            provider: 'Fireworks',
            model: 'deepseek/deepseek-v4-flash-20260731',
            status: 200
          }],
          routerAttemptSequenceSource: 'reported',
          routerSelectedEndpointEvidenced: true,
          routerSelectedProvider: 'Fireworks',
          routerSelectedModel: 'deepseek/deepseek-v4-flash-20260731',
          routerEnvelopeProvider: 'Fireworks',
          routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
          routerFinalAttemptProvider: 'Fireworks',
          routerFinalAttemptModel: 'deepseek/deepseek-v4-flash-20260731',
          routerFallbackUsed: true,
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 10_402,
          contentSha256:
            '3c464ccf17db2912919f028c2f12e267a7f9408fedc11c6e212d0995bf8109b5',
          streaming: true,
          streamEventCount: 3_857,
          streamWireByteCount: 1_117_420,
          streamFirstDataLatencyMs: 1_230,
          streamDurationMs: 39_532,
          streamCompleted: true,
          responseHeadersReceived: true,
          rawProviderBody: rawSentinel
        },
        annotations: []
      };
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIssues = [
    ['pattern', '/plans/0/contingentFinalists/pathBase/r/0/cd', ''],
    ['pattern', '/plans/0/contingentFinalists/pathBase/r/0/g/d/l', ''],
    ['pattern', '/plans/1/contingentFinalists/pathBase/r/0/cd', ''],
    ['pattern', '/plans/1/contingentFinalists/pathBase/r/0/g/d/l', '']
  ];
  const actualIssues = result.normalizationDiagnostic?.issues?.map(
    (issue) => [
      issue.keyword,
      issue.instancePath,
      issue.missingProperty || ''
    ]
  );
  const actualIssueKeys = result.normalizationDiagnostic?.issues?.map(
    (issue) => Object.keys(issue).sort()
  );
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      JSON.stringify(wireRequestSeen?.response_format) !==
        JSON.stringify(requestSeen?.responseFormat) ||
      JSON.stringify(wireRequestSeen?.provider?.ignore) !==
        JSON.stringify(expectedIgnore) ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      result.status !== 'blocked' || result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(result.planSelection?.rejectedPlans) !== '[]' ||
      result.webSearchReceipt !== null ||
      result.usage?.calls !== 1 || result.usage?.successfulCalls !== 1 ||
      result.usage?.promptTokens !== 13_668 ||
      result.usage?.completionTokens !== 3_856 ||
      result.usage?.totalTokens !== 17_524 ||
      result.usage?.reportedCostMicros !== 2_994 ||
      receipt?.status !== 'completed' ||
      receipt?.error !== undefined ||
      receipt?.generationId !==
        'gen-1786637226-Ta0zDVPrCAGofAxY4SBK' ||
      receipt?.model !== 'deepseek/deepseek-v4-flash-20260731' ||
      receipt?.requestedModel !== 'deepseek/deepseek-v4-flash-0731' ||
      receipt?.openRouterUsage?.prompt_tokens !== 13_668 ||
      receipt?.openRouterUsage?.completion_tokens !== 3_856 ||
      receipt?.openRouterUsage?.total_tokens !== 17_524 ||
      receipt?.openRouterUsage?.cost !== 0.0029932 ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerStrategy !== 'direct' ||
      diagnostics?.routerAttempt !== 2 ||
      diagnostics?.routerCandidateCount !== 27 ||
      JSON.stringify(diagnostics?.routerAttemptStatuses) !==
        JSON.stringify([504, 200]) ||
      JSON.stringify(diagnostics?.routerAttempts) !== JSON.stringify([{
        provider: 'AtlasCloud',
        model: 'deepseek/deepseek-v4-flash-20260731',
        status: 504
      }, {
        provider: 'Fireworks',
        model: 'deepseek/deepseek-v4-flash-20260731',
        status: 200
      }]) ||
      diagnostics?.routerAttemptSequenceSource !== 'reported' ||
      diagnostics?.routerSelectedProvider !== 'Fireworks' ||
      diagnostics?.routerSelectedModel !==
        'deepseek/deepseek-v4-flash-20260731' ||
      diagnostics?.routerEnvelopeProvider !== 'Fireworks' ||
      diagnostics?.routerEnvelopeModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.routerFinalAttemptProvider !== 'Fireworks' ||
      diagnostics?.routerFinalAttemptModel !==
        'deepseek/deepseek-v4-flash-20260731' ||
      diagnostics?.routerSelectedEndpointEvidenced !== true ||
      diagnostics?.routerFallbackUsed !== true ||
      diagnostics?.finishReason !== 'stop' ||
      diagnostics?.nativeFinishReason !== 'stop' ||
      diagnostics?.contentByteCount !== 10_402 ||
      diagnostics?.contentSha256 !==
        '3c464ccf17db2912919f028c2f12e267a7f9408fedc11c6e212d0995bf8109b5' ||
      diagnostics?.streaming !== true ||
      diagnostics?.streamEventCount !== 3_857 ||
      diagnostics?.streamWireByteCount !== 1_117_420 ||
      diagnostics?.streamFirstDataLatencyMs !== 1_230 ||
      diagnostics?.streamDurationMs !== 39_532 ||
      diagnostics?.streamCompleted !== true ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.localJSONRepairApplied !== undefined ||
      diagnostics?.localJSONRepairFailure !== undefined ||
      result.preflight?.routeProvenanceValidated !== true ||
      !Number.isInteger(result.preflight?.responseBodyByteCount) ||
      result.preflight.responseBodyByteCount <= 0 ||
      result.preflight.responseBodyByteCount >
        MAX_DISCOVERY_PLANNER_RESPONSE_BYTES ||
      result.normalizationDiagnostic?.contractVersion !==
        OPPORTUNITY_DISCOVERY_PLANNER_DIAGNOSTIC_CONTRACT ||
      result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      result.normalizationDiagnostic?.failedMotionCount !== 2 ||
      JSON.stringify(actualIssues) !== JSON.stringify(expectedIssues) ||
      actualIssueKeys?.some((keys) =>
        JSON.stringify(keys) !==
          JSON.stringify(['instancePath', 'keyword'])) ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.commercialDiscoveryEvidence !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel) ||
      JSON.stringify(result).includes(invalidConversionDestination) ||
      JSON.stringify(result).includes(invalidDiscoveryLink)) {
    throw new Error(
      `Fireworks production strict-schema mismatch did not fail once after exact completed accounting: ${JSON.stringify({
        calls,
        routeIgnore: requestSeen?.provider?.ignore,
        wireSchemaParity:
          JSON.stringify(wireRequestSeen?.response_format) ===
            JSON.stringify(requestSeen?.responseFormat),
        status: result.status,
        plans: result.plans?.length,
        planSelection: result.planSelection,
        usage: result.usage,
        receipt,
        preflight: result.preflight,
        normalizationDiagnostic: result.normalizationDiagnostic,
        criticPresent: result.llm?.commercialCritic !== undefined,
        repairPresent: result.llm?.strategyFamilyRepair !== undefined,
        discoveryPresent:
          result.commercialDiscoveryEvidence !== undefined,
        sideEffectsPerformed: result.sideEffectsPerformed,
        rawSentinelPresent: JSON.stringify(result).includes(rawSentinel)
      })}`
    );
  }
}

async function verifyMorphProductionStrictSchemaMismatchFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  let wireRequestSeen;
  const rawSentinel = 'raw-morph-schema-mismatch-secret-sentinel';
  const invalidCompensatedJob =
    `Paid role ${'professional '.repeat(12)}`.trim();
  const invalidRevenueLabel = 'Paid';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      wireRequestSeen = JSON.parse(serializeOpenRouterJSONRequestBody({
        ...request,
        apiKey: 'not-serialized'
      }));
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      const evidenceRef = buildEvidenceCatalog(job.payload, {}, now, {
        includeSystemAttributionCapability: true
      }).find((item) => /^observation:/i.test(item.id || ''))?.id;
      if (!evidenceRef) {
        throw new Error(
          'Morph fixture has no approved observation evidence'
        );
      }
      const plans = compactFreshPlannerPlans(
        twoPlannerMotions(
          cases[0].plans(evidenceRef)[0],
          evidenceRef
        )
      );
      for (const plan of plans) plan.market = exactMarket;
      plans[0].paidOffer.compensatedJob = invalidCompensatedJob;
      plans[0].contingentFinalists.pathBase.r[0].l =
        invalidRevenueLabel;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage: {
          prompt_tokens: 13_339,
          completion_tokens: 4_396,
          total_tokens: 17_735,
          cost: 0.003076209
        },
        generationId: 'gen-1786638788-wg2KrrJutrbOs8xQ9n96',
        diagnostics: {
          httpStatus: 200,
          routerStrategy: 'direct',
          routerAttempt: 4,
          routerCandidateCount: 27,
          routerAttemptStatuses: [504, 429, 504, 200],
          routerAttempts: [{
            provider: 'AtlasCloud',
            model: 'deepseek/deepseek-v4-flash-20260731',
            status: 504
          }, {
            provider: 'Parasail',
            model: 'deepseek/deepseek-v4-flash-20260731',
            status: 429
          }, {
            provider: 'Together',
            model: 'deepseek/deepseek-v4-flash-20260731',
            status: 504
          }, {
            provider: 'Morph',
            model: 'deepseek/deepseek-v4-flash-20260731',
            status: 200
          }],
          routerAttemptSequenceSource: 'reported',
          routerSelectedEndpointEvidenced: true,
          routerSelectedProvider: 'Morph',
          routerSelectedModel: 'deepseek/deepseek-v4-flash-20260731',
          routerEnvelopeProvider: 'Morph',
          routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
          routerFinalAttemptProvider: 'Morph',
          routerFinalAttemptModel: 'deepseek/deepseek-v4-flash-20260731',
          routerFallbackUsed: true,
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 15_071,
          contentSha256:
            '779742adce8fdf44d981dabc3e28c356087e3b5cb54efb987c2bfd3ed1c11736',
          streaming: true,
          streamEventCount: 4_397,
          streamWireByteCount: 1_260_074,
          streamFirstDataLatencyMs: 1_402,
          streamDurationMs: 76_681,
          streamCompleted: true,
          responseHeadersReceived: true,
          rawProviderBody: rawSentinel
        },
        annotations: []
      };
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIssues = [
    ['maxLength', '/plans/0/paidOffer/compensatedJob'],
    ['minLength', '/plans/0/contingentFinalists/pathBase/r/0/l']
  ];
  const actualIssues = result.normalizationDiagnostic?.issues?.map(
    (issue) => [issue.keyword, issue.instancePath]
  );
  const actualIssueKeys = result.normalizationDiagnostic?.issues?.map(
    (issue) => Object.keys(issue).sort()
  );
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      JSON.stringify(wireRequestSeen?.response_format) !==
        JSON.stringify(requestSeen?.responseFormat) ||
      JSON.stringify(wireRequestSeen?.provider?.ignore) !==
        JSON.stringify(expectedIgnore) ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      result.status !== 'blocked' || result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(result.planSelection?.rejectedPlans) !== '[]' ||
      result.webSearchReceipt !== null ||
      result.usage?.calls !== 1 || result.usage?.successfulCalls !== 1 ||
      result.usage?.promptTokens !== 13_339 ||
      result.usage?.completionTokens !== 4_396 ||
      result.usage?.totalTokens !== 17_735 ||
      result.usage?.reportedCostMicros !== 3_077 ||
      result.usage?.costReporting !== 'complete' ||
      result.usage?.withinBudget !== true ||
      receipt?.status !== 'completed' ||
      receipt?.error !== undefined ||
      receipt?.generationId !==
        'gen-1786638788-wg2KrrJutrbOs8xQ9n96' ||
      receipt?.model !== 'deepseek/deepseek-v4-flash-20260731' ||
      receipt?.requestedModel !== 'deepseek/deepseek-v4-flash-0731' ||
      receipt?.openRouterUsage?.prompt_tokens !== 13_339 ||
      receipt?.openRouterUsage?.completion_tokens !== 4_396 ||
      receipt?.openRouterUsage?.total_tokens !== 17_735 ||
      receipt?.openRouterUsage?.cost !== 0.003076209 ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerStrategy !== 'direct' ||
      diagnostics?.routerAttempt !== 4 ||
      diagnostics?.routerCandidateCount !== 27 ||
      JSON.stringify(diagnostics?.routerAttemptStatuses) !==
        JSON.stringify([504, 429, 504, 200]) ||
      JSON.stringify(diagnostics?.routerAttempts) !== JSON.stringify([{
        provider: 'AtlasCloud',
        model: 'deepseek/deepseek-v4-flash-20260731',
        status: 504
      }, {
        provider: 'Parasail',
        model: 'deepseek/deepseek-v4-flash-20260731',
        status: 429
      }, {
        provider: 'Together',
        model: 'deepseek/deepseek-v4-flash-20260731',
        status: 504
      }, {
        provider: 'Morph',
        model: 'deepseek/deepseek-v4-flash-20260731',
        status: 200
      }]) ||
      diagnostics?.routerAttemptSequenceSource !== 'reported' ||
      diagnostics?.routerSelectedProvider !== 'Morph' ||
      diagnostics?.routerSelectedModel !==
        'deepseek/deepseek-v4-flash-20260731' ||
      diagnostics?.routerEnvelopeProvider !== 'Morph' ||
      diagnostics?.routerEnvelopeModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.routerFinalAttemptProvider !== 'Morph' ||
      diagnostics?.routerFinalAttemptModel !==
        'deepseek/deepseek-v4-flash-20260731' ||
      diagnostics?.routerSelectedEndpointEvidenced !== true ||
      diagnostics?.routerFallbackUsed !== true ||
      diagnostics?.finishReason !== 'stop' ||
      diagnostics?.nativeFinishReason !== 'stop' ||
      diagnostics?.contentByteCount !== 15_071 ||
      diagnostics?.contentSha256 !==
        '779742adce8fdf44d981dabc3e28c356087e3b5cb54efb987c2bfd3ed1c11736' ||
      diagnostics?.streaming !== true ||
      diagnostics?.streamEventCount !== 4_397 ||
      diagnostics?.streamWireByteCount !== 1_260_074 ||
      diagnostics?.streamFirstDataLatencyMs !== 1_402 ||
      diagnostics?.streamDurationMs !== 76_681 ||
      diagnostics?.streamCompleted !== true ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.localJSONRepairApplied !== undefined ||
      diagnostics?.localJSONRepairFailure !== undefined ||
      result.preflight?.routeProvenanceValidated !== true ||
      !Number.isInteger(result.preflight?.responseBodyByteCount) ||
      result.preflight.responseBodyByteCount <= 0 ||
      result.preflight.responseBodyByteCount >
        MAX_DISCOVERY_PLANNER_RESPONSE_BYTES ||
      result.normalizationDiagnostic?.contractVersion !==
        OPPORTUNITY_DISCOVERY_PLANNER_DIAGNOSTIC_CONTRACT ||
      result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      result.normalizationDiagnostic?.failedMotionCount !== 1 ||
      JSON.stringify(actualIssues) !== JSON.stringify(expectedIssues) ||
      actualIssueKeys?.some((keys) =>
        JSON.stringify(keys) !==
          JSON.stringify(['instancePath', 'keyword'])) ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.commercialDiscoveryEvidence !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel) ||
      JSON.stringify(result).includes(invalidCompensatedJob) ||
      JSON.stringify(result).includes(invalidRevenueLabel)) {
    throw new Error(
      `Morph production strict-schema mismatch did not fail once after exact completed accounting: ${JSON.stringify({
        calls,
        routeIgnore: requestSeen?.provider?.ignore,
        wireSchemaParity:
          JSON.stringify(wireRequestSeen?.response_format) ===
            JSON.stringify(requestSeen?.responseFormat),
        status: result.status,
        plans: result.plans?.length,
        planSelection: result.planSelection,
        usage: result.usage,
        receipt,
        preflight: result.preflight,
        normalizationDiagnostic: result.normalizationDiagnostic,
        criticPresent: result.llm?.commercialCritic !== undefined,
        repairPresent: result.llm?.strategyFamilyRepair !== undefined,
        discoveryPresent:
          result.commercialDiscoveryEvidence !== undefined,
        sideEffectsPerformed: result.sideEffectsPerformed,
        rawSentinelPresent: JSON.stringify(result).includes(rawSentinel)
      })}`
    );
  }
}

async function verifyMancerProductionStrictRootSchemaMismatchFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  let wireRequestSeen;
  const rawSentinel = 'raw-mancer-root-schema-secret-sentinel';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      wireRequestSeen = JSON.parse(serializeOpenRouterJSONRequestBody({
        ...request,
        apiKey: 'not-serialized'
      }));
      return {
        data: { opportunities: rawSentinel },
        usage: {
          prompt_tokens: 2_882,
          completion_tokens: 2_716,
          total_tokens: 5_598,
          cost: 0.00186
        },
        generationId: 'gen-1786646690-DHJf2t5o8HVy7R6mutRG',
        diagnostics: {
          httpStatus: 200,
          routerStrategy: 'direct',
          routerAttempt: 1,
          routerCandidateCount: 27,
          routerAttemptStatuses: [200],
          routerAttempts: [{
            provider: 'Mancer 2',
            model: 'deepseek/deepseek-v4-flash-20260731',
            status: 200
          }],
          routerAttemptSequenceSource: 'selected_endpoint_reconstructed',
          routerSelectedEndpointEvidenced: true,
          routerSelectedProvider: 'Mancer 2',
          routerSelectedModel: 'deepseek/deepseek-v4-flash-20260731',
          routerEnvelopeProvider: 'Mancer 2',
          routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 10_771,
          contentSha256:
            '93995a4273a491e94ec5b98fdc78d7394e8f3b197404324ba3278ab67e565277',
          streaming: true,
          streamEventCount: 672,
          streamWireByteCount: 204_649,
          streamFirstDataLatencyMs: 1_970,
          streamDurationMs: 69_846,
          streamCompleted: true,
          responseHeadersReceived: true,
          rawProviderBody: rawSentinel
        },
        annotations: []
      };
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIssues = [
    ['required', '', 'contractVersion'],
    ['required', '', 'status'],
    ['required', '', 'reason'],
    ['required', '', 'plans'],
    ['additionalProperties', '', '']
  ];
  const actualIssues = result.normalizationDiagnostic?.issues?.map(
    (issue) => [
      issue.keyword,
      issue.instancePath,
      issue.missingProperty || ''
    ]
  );
  const actualIssueKeys = result.normalizationDiagnostic?.issues?.map(
    (issue) => Object.keys(issue).sort()
  );
  const expectedIssueKeys = [
    ['instancePath', 'keyword', 'missingProperty'],
    ['instancePath', 'keyword', 'missingProperty'],
    ['instancePath', 'keyword', 'missingProperty'],
    ['instancePath', 'keyword', 'missingProperty'],
    ['instancePath', 'keyword']
  ];
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      JSON.stringify(wireRequestSeen?.response_format) !==
        JSON.stringify(requestSeen?.responseFormat) ||
      JSON.stringify(wireRequestSeen?.provider?.ignore) !==
        JSON.stringify(expectedIgnore) ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      result.status !== 'blocked' || result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(result.planSelection?.rejectedPlans) !== '[]' ||
      result.webSearchReceipt !== null ||
      result.usage?.calls !== 1 || result.usage?.successfulCalls !== 1 ||
      result.usage?.promptTokens !== 2_882 ||
      result.usage?.completionTokens !== 2_716 ||
      result.usage?.totalTokens !== 5_598 ||
      result.usage?.reportedCostMicros !== 1_860 ||
      result.usage?.costReporting !== 'complete' ||
      result.usage?.withinBudget !== true ||
      receipt?.status !== 'completed' || receipt?.error !== undefined ||
      receipt?.generationId !==
        'gen-1786646690-DHJf2t5o8HVy7R6mutRG' ||
      receipt?.model !== 'deepseek/deepseek-v4-flash-20260731' ||
      receipt?.requestedModel !== 'deepseek/deepseek-v4-flash-0731' ||
      receipt?.openRouterUsage?.prompt_tokens !== 2_882 ||
      receipt?.openRouterUsage?.completion_tokens !== 2_716 ||
      receipt?.openRouterUsage?.total_tokens !== 5_598 ||
      receipt?.openRouterUsage?.cost !== 0.00186 ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerStrategy !== 'direct' ||
      diagnostics?.routerAttempt !== 1 ||
      diagnostics?.routerCandidateCount !== 27 ||
      JSON.stringify(diagnostics?.routerAttemptStatuses) !== '[200]' ||
      JSON.stringify(diagnostics?.routerAttempts) !== JSON.stringify([{
        provider: 'Mancer 2',
        model: 'deepseek/deepseek-v4-flash-20260731',
        status: 200
      }]) ||
      diagnostics?.routerAttemptSequenceSource !==
        'selected_endpoint_reconstructed' ||
      diagnostics?.routerSelectedEndpointEvidenced !== true ||
      diagnostics?.routerSelectedProvider !== 'Mancer 2' ||
      diagnostics?.routerSelectedModel !==
        'deepseek/deepseek-v4-flash-20260731' ||
      diagnostics?.routerEnvelopeProvider !== 'Mancer 2' ||
      diagnostics?.routerEnvelopeModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.routerFallbackUsed !== undefined ||
      diagnostics?.routerFinalAttemptProvider !== undefined ||
      diagnostics?.routerFinalAttemptModel !== undefined ||
      diagnostics?.finishReason !== 'stop' ||
      diagnostics?.nativeFinishReason !== 'stop' ||
      diagnostics?.contentByteCount !== 10_771 ||
      diagnostics?.contentSha256 !==
        '93995a4273a491e94ec5b98fdc78d7394e8f3b197404324ba3278ab67e565277' ||
      diagnostics?.streaming !== true ||
      diagnostics?.streamEventCount !== 672 ||
      diagnostics?.streamWireByteCount !== 204_649 ||
      diagnostics?.streamFirstDataLatencyMs !== 1_970 ||
      diagnostics?.streamDurationMs !== 69_846 ||
      diagnostics?.streamCompleted !== true ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.localJSONRepairApplied !== undefined ||
      diagnostics?.localJSONRepairFailure !== undefined ||
      result.preflight?.routeProvenanceValidated !== true ||
      !Number.isInteger(result.preflight?.responseBodyByteCount) ||
      result.preflight.responseBodyByteCount <= 0 ||
      result.preflight.responseBodyByteCount >
        MAX_DISCOVERY_PLANNER_RESPONSE_BYTES ||
      result.normalizationDiagnostic?.contractVersion !==
        OPPORTUNITY_DISCOVERY_PLANNER_DIAGNOSTIC_CONTRACT ||
      result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      result.normalizationDiagnostic?.failedMotionCount !== 2 ||
      JSON.stringify(actualIssues) !== JSON.stringify(expectedIssues) ||
      JSON.stringify(actualIssueKeys) !== JSON.stringify(expectedIssueKeys) ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.commercialDiscoveryEvidence !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel)) {
    throw new Error(
      `Mancer production root-schema mismatch did not fail once after exact completed accounting: ${JSON.stringify({
        calls,
        routeIgnore: requestSeen?.provider?.ignore,
        wireSchemaParity:
          JSON.stringify(wireRequestSeen?.response_format) ===
            JSON.stringify(requestSeen?.responseFormat),
        result,
        rawSentinelPresent: JSON.stringify(result).includes(rawSentinel)
      })}`
    );
  }
}

async function verifyAtlasCloudProductionRawOverflowFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  const rawSentinel = 'raw-atlascloud-overflow-secret-sentinel';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      const error = new Error(
        'OpenRouter streaming response exceeded its bounded content envelope'
      );
      error.openRouterFailureCode =
        'openrouter_truncated_structured_output';
      error.openRouterGenerationId =
        'gen-1786640051-rFPzS5HHzyK3hLtVAlJX';
      error.openRouterDiagnostics = {
        httpStatus: 200,
        routerSelectedProvider: 'AtlasCloud',
        routerSelectedModel: 'deepseek/deepseek-v4-flash-0731',
        routerEnvelopeProvider: 'AtlasCloud',
        routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
        contentByteCount: 163_850,
        maxContentByteCount: 163_840,
        contentSha256:
          'b63153ab3afc24a65ad6863b15735660a5443d0bf64c34444652dac6182a8200',
        streaming: true,
        streamEventCount: 6_889,
        streamWireByteCount: 2_141_202,
        streamFirstDataLatencyMs: 3_203,
        streamDurationMs: 178_486,
        streamCompleted: false,
        responseHeadersReceived: true,
        structuredOutputEnvelopeExceeded: true,
        rawProviderBody: rawSentinel
      };
      throw error;
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      requestSeen?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(requestSeen?.models) !==
        JSON.stringify(['deepseek/deepseek-v4-flash-0731']) ||
      requestSeen?.maxTokens !== 42_000 ||
      requestSeen?.stream !== true ||
      requestSeen?.streamMaxContentBytes !== 163_840 ||
      requestSeen?.streamStartTimeoutMs !== 180_000 ||
      requestSeen?.streamIdleTimeoutMs !== 60_000 ||
      requestSeen?.streamTotalTimeoutMs !== 300_000 ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      result.status !== 'blocked' ||
      result.reason !==
        'The discovery planner exceeded its finite raw streaming-content ceiling before completing the structured plan.' ||
      result.recoveryCause !==
        'commercial_discovery_planner_output_envelope_recovery' ||
      result.failureCode !== 'planner_output_envelope_exceeded' ||
      result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(result.planSelection?.rejectedPlans) !== '[]' ||
      result.webSearchReceipt !== null ||
      result.usage?.calls !== 1 ||
      result.usage?.successfulCalls !== 0 ||
      result.usage?.promptTokens !== 0 ||
      result.usage?.completionTokens !== 0 ||
      result.usage?.totalTokens !== 0 ||
      result.usage?.reportedCostMicros !== 0 ||
      result.usage?.reportedCostUsd !== 0 ||
      result.usage?.costReporting !== 'unavailable' ||
      result.usage?.withinBudget !== true ||
      receipt?.status !== 'incomplete' ||
      receipt?.error !== 'openrouter_truncated_structured_output' ||
      receipt?.generationId !==
        'gen-1786640051-rFPzS5HHzyK3hLtVAlJX' ||
      receipt?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      receipt?.requestedModel !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(receipt?.openRouterUsage) !== '{}' ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerSelectedProvider !== 'AtlasCloud' ||
      diagnostics?.routerSelectedModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.routerEnvelopeProvider !== 'AtlasCloud' ||
      diagnostics?.routerEnvelopeModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.contentByteCount !== 163_850 ||
      diagnostics?.maxContentByteCount !== 163_840 ||
      diagnostics?.contentSha256 !==
        'b63153ab3afc24a65ad6863b15735660a5443d0bf64c34444652dac6182a8200' ||
      diagnostics?.streaming !== true ||
      diagnostics?.streamEventCount !== 6_889 ||
      diagnostics?.streamWireByteCount !== 2_141_202 ||
      diagnostics?.streamFirstDataLatencyMs !== 3_203 ||
      diagnostics?.streamDurationMs !== 178_486 ||
      diagnostics?.streamCompleted !== false ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.structuredOutputEnvelopeExceeded !== true ||
      diagnostics?.finishReason !== undefined ||
      diagnostics?.nativeFinishReason !== undefined ||
      diagnostics?.localJSONRepairApplied !== undefined ||
      diagnostics?.localJSONRepairFailure !== undefined ||
      result.preflight?.authorized !== true ||
      result.preflight?.cause !==
        'commercial_discovery_planner_output_envelope_recovery' ||
      result.preflight?.failureCode !==
        'planner_output_envelope_exceeded' ||
      result.preflight?.routeProvenanceValidated !== false ||
      result.preflight?.rawStreamingContentByteCount !== 163_850 ||
      result.preflight?.rawStreamingContentMaxBytes !== 163_840 ||
      result.preflight?.responseBodyByteCount !== undefined ||
      result.preflight?.maxResponseBodyByteCount !== 40_960 ||
      result.normalizationDiagnostic !== undefined ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.commercialDiscoveryEvidence !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel)) {
    throw new Error(
      `AtlasCloud production raw overflow did not fail once with bounded diagnostics: ${JSON.stringify({
        calls,
        request: requestSeen,
        result,
        rawSentinelPresent: JSON.stringify(result).includes(rawSentinel)
      })}`
    );
  }
}

async function verifyParasailProductionTimeoutFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  const rawSentinel = 'raw-parasail-timeout-secret-sentinel';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      const error = new Error(
        'OpenRouter streaming request exceeded its bounded total deadline'
      );
      error.openRouterFailureCode = 'openrouter_timeout';
      error.openRouterGenerationId =
        'gen-1786641740-BTrfgGELM1B7Ns9i2f9V';
      error.openRouterDiagnostics = {
        httpStatus: 200,
        routerSelectedProvider: 'Parasail',
        routerSelectedModel: 'deepseek/deepseek-v4-flash-0731',
        routerEnvelopeProvider: 'Parasail',
        routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
        contentByteCount: 66_008,
        contentSha256:
          '484701d874ccce8f31c1e9f9bee79c22200993ec1f3deb07c119d142842b5def',
        streaming: true,
        streamEventCount: 6_243,
        streamWireByteCount: 1_875_432,
        streamFirstDataLatencyMs: 1_208,
        streamDurationMs: 300_012,
        streamCompleted: false,
        timeoutKind: 'total',
        timeoutOrigin: 'profilescribe_local_deadline',
        timeoutDeadlineMs: 300_000,
        timeoutElapsedMs: 300_012,
        timeoutPhase: 'response_stream',
        responseHeadersReceived: true,
        rawProviderBody: rawSentinel
      };
      throw error;
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      requestSeen?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(requestSeen?.models) !==
        JSON.stringify(['deepseek/deepseek-v4-flash-0731']) ||
      requestSeen?.maxTokens !== 42_000 ||
      requestSeen?.stream !== true ||
      requestSeen?.streamMaxContentBytes !== 163_840 ||
      requestSeen?.streamStartTimeoutMs !== 180_000 ||
      requestSeen?.streamIdleTimeoutMs !== 60_000 ||
      requestSeen?.streamTotalTimeoutMs !== 300_000 ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      result.status !== 'blocked' ||
      result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(result.planSelection?.rejectedPlans) !== '[]' ||
      result.webSearchReceipt !== null ||
      result.usage?.calls !== 1 ||
      result.usage?.successfulCalls !== 0 ||
      result.usage?.promptTokens !== 0 ||
      result.usage?.completionTokens !== 0 ||
      result.usage?.totalTokens !== 0 ||
      result.usage?.reportedCostMicros !== 0 ||
      result.usage?.reportedCostUsd !== 0 ||
      result.usage?.costReporting !== 'unavailable' ||
      result.usage?.withinBudget !== true ||
      receipt?.status !== 'failed' ||
      receipt?.error !== 'openrouter_timeout' ||
      receipt?.generationId !==
        'gen-1786641740-BTrfgGELM1B7Ns9i2f9V' ||
      receipt?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      receipt?.requestedModel !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(receipt?.openRouterUsage) !== '{}' ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerSelectedProvider !== 'Parasail' ||
      diagnostics?.routerSelectedModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.routerEnvelopeProvider !== 'Parasail' ||
      diagnostics?.routerEnvelopeModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.contentByteCount !== 66_008 ||
      diagnostics?.contentSha256 !==
        '484701d874ccce8f31c1e9f9bee79c22200993ec1f3deb07c119d142842b5def' ||
      diagnostics?.streaming !== true ||
      diagnostics?.streamEventCount !== 6_243 ||
      diagnostics?.streamWireByteCount !== 1_875_432 ||
      diagnostics?.streamFirstDataLatencyMs !== 1_208 ||
      diagnostics?.streamDurationMs !== 300_012 ||
      diagnostics?.streamCompleted !== false ||
      diagnostics?.timeoutKind !== 'total' ||
      diagnostics?.timeoutOrigin !== 'profilescribe_local_deadline' ||
      diagnostics?.timeoutDeadlineMs !== 300_000 ||
      diagnostics?.timeoutElapsedMs !== 300_012 ||
      diagnostics?.timeoutPhase !== 'response_stream' ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.finishReason !== undefined ||
      diagnostics?.nativeFinishReason !== undefined ||
      diagnostics?.localJSONRepairApplied !== undefined ||
      diagnostics?.localJSONRepairFailure !== undefined ||
      result.preflight?.authorized !== true ||
      !Number.isInteger(result.preflight?.requestBodyByteCount) ||
      result.preflight.requestBodyByteCount <= 0 ||
      result.preflight.requestBodyByteCount > 45_056 ||
      !/^[a-f0-9]{64}$/.test(result.preflight?.requestBodySha256 || '') ||
      result.preflight?.serializedPromptTokenCeiling !==
        result.preflight.requestBodyByteCount + 1_024 ||
      result.preflight?.promptTokenCeiling !==
        result.preflight.serializedPromptTokenCeiling ||
      result.preflight?.responseBodyByteCount !== undefined ||
      result.preflight?.routeProvenanceValidated !== undefined ||
      result.normalizationDiagnostic !== undefined ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.commercialDiscoveryEvidence !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel)) {
    throw new Error(
      `Parasail production timeout did not fail once with bounded diagnostics: ${JSON.stringify({
        calls,
        request: requestSeen,
        result,
        rawSentinelPresent: JSON.stringify(result).includes(rawSentinel)
      })}`
    );
  }
}

async function verifyTogetherProductionTimeoutFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  const rawSentinel = 'raw-together-timeout-secret-sentinel';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      const error = new Error(
        'OpenRouter streaming request exceeded its bounded total deadline'
      );
      error.openRouterFailureCode = 'openrouter_timeout';
      error.openRouterGenerationId =
        'gen-1786643681-4biso5xGsQ2Bo2ZkHVWO';
      error.openRouterDiagnostics = {
        httpStatus: 200,
        routerSelectedProvider: 'Together',
        routerSelectedModel: 'deepseek/deepseek-v4-flash-0731',
        routerEnvelopeProvider: 'Together',
        routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
        contentByteCount: 91_338,
        contentSha256:
          'ee76c1da367408367066a7d75ebce1d367b123fda6c47a43dedf40aefd0ec01e',
        streaming: true,
        streamEventCount: 6_567,
        streamWireByteCount: 1_971_720,
        streamFirstDataLatencyMs: 607,
        streamDurationMs: 300_007,
        streamCompleted: false,
        timeoutKind: 'total',
        timeoutOrigin: 'profilescribe_local_deadline',
        timeoutDeadlineMs: 300_000,
        timeoutElapsedMs: 300_007,
        timeoutPhase: 'response_stream',
        responseHeadersReceived: true,
        rawProviderBody: rawSentinel
      };
      throw error;
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      requestSeen?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(requestSeen?.models) !==
        JSON.stringify(['deepseek/deepseek-v4-flash-0731']) ||
      requestSeen?.maxTokens !== 42_000 ||
      requestSeen?.stream !== true ||
      requestSeen?.streamMaxContentBytes !== 163_840 ||
      requestSeen?.streamStartTimeoutMs !== 180_000 ||
      requestSeen?.streamIdleTimeoutMs !== 60_000 ||
      requestSeen?.streamTotalTimeoutMs !== 300_000 ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      result.status !== 'blocked' ||
      result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(result.planSelection?.rejectedPlans) !== '[]' ||
      result.webSearchReceipt !== null ||
      result.usage?.calls !== 1 ||
      result.usage?.successfulCalls !== 0 ||
      result.usage?.promptTokens !== 0 ||
      result.usage?.completionTokens !== 0 ||
      result.usage?.totalTokens !== 0 ||
      result.usage?.reportedCostMicros !== 0 ||
      result.usage?.reportedCostUsd !== 0 ||
      result.usage?.costReporting !== 'unavailable' ||
      result.usage?.withinBudget !== true ||
      receipt?.status !== 'failed' ||
      receipt?.error !== 'openrouter_timeout' ||
      receipt?.generationId !==
        'gen-1786643681-4biso5xGsQ2Bo2ZkHVWO' ||
      receipt?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      receipt?.requestedModel !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(receipt?.openRouterUsage) !== '{}' ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerSelectedProvider !== 'Together' ||
      diagnostics?.routerSelectedModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.routerEnvelopeProvider !== 'Together' ||
      diagnostics?.routerEnvelopeModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.contentByteCount !== 91_338 ||
      diagnostics?.contentSha256 !==
        'ee76c1da367408367066a7d75ebce1d367b123fda6c47a43dedf40aefd0ec01e' ||
      diagnostics?.streaming !== true ||
      diagnostics?.streamEventCount !== 6_567 ||
      diagnostics?.streamWireByteCount !== 1_971_720 ||
      diagnostics?.streamFirstDataLatencyMs !== 607 ||
      diagnostics?.streamDurationMs !== 300_007 ||
      diagnostics?.streamCompleted !== false ||
      diagnostics?.timeoutKind !== 'total' ||
      diagnostics?.timeoutOrigin !== 'profilescribe_local_deadline' ||
      diagnostics?.timeoutDeadlineMs !== 300_000 ||
      diagnostics?.timeoutElapsedMs !== 300_007 ||
      diagnostics?.timeoutPhase !== 'response_stream' ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.finishReason !== undefined ||
      diagnostics?.nativeFinishReason !== undefined ||
      diagnostics?.localJSONRepairApplied !== undefined ||
      diagnostics?.localJSONRepairFailure !== undefined ||
      result.preflight?.authorized !== true ||
      !Number.isInteger(result.preflight?.requestBodyByteCount) ||
      result.preflight.requestBodyByteCount <= 0 ||
      result.preflight.requestBodyByteCount > 45_056 ||
      !/^[a-f0-9]{64}$/.test(result.preflight?.requestBodySha256 || '') ||
      result.preflight?.serializedPromptTokenCeiling !==
        result.preflight.requestBodyByteCount + 1_024 ||
      result.preflight?.promptTokenCeiling !==
        result.preflight.serializedPromptTokenCeiling ||
      result.preflight?.responseBodyByteCount !== undefined ||
      result.preflight?.routeProvenanceValidated !== undefined ||
      result.normalizationDiagnostic !== undefined ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.commercialDiscoveryEvidence !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel)) {
    throw new Error(
      `Together production timeout did not fail once with bounded diagnostics: ${JSON.stringify({
        calls,
        request: requestSeen,
        result,
        rawSentinelPresent: JSON.stringify(result).includes(rawSentinel)
      })}`
    );
  }
}

async function verifyDeepInfraProductionTimeoutFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  const rawSentinel = 'raw-deepinfra-timeout-secret-sentinel';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      const error = new Error(
        'OpenRouter streaming request exceeded its bounded total deadline'
      );
      error.openRouterFailureCode = 'openrouter_timeout';
      error.openRouterGenerationId =
        'gen-1786645018-bLkhzkJFE084SvoNvBWm';
      error.openRouterDiagnostics = {
        httpStatus: 200,
        routerSelectedProvider: 'DeepInfra',
        routerSelectedModel: 'deepseek/deepseek-v4-flash-0731',
        routerEnvelopeProvider: 'DeepInfra',
        routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
        contentByteCount: 44_681,
        contentSha256:
          '5712ed8cd5253512c980320b0ff6758f3f5d2b119ca739bdcd92bcde7e1d3da6',
        streaming: true,
        streamEventCount: 2_834,
        streamWireByteCount: 861_416,
        streamFirstDataLatencyMs: 528,
        streamDurationMs: 300_010,
        streamCompleted: false,
        timeoutKind: 'total',
        timeoutOrigin: 'profilescribe_local_deadline',
        timeoutDeadlineMs: 300_000,
        timeoutElapsedMs: 300_010,
        timeoutPhase: 'response_stream',
        responseHeadersReceived: true,
        rawProviderBody: rawSentinel
      };
      throw error;
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      requestSeen?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(requestSeen?.models) !==
        JSON.stringify(['deepseek/deepseek-v4-flash-0731']) ||
      requestSeen?.maxTokens !== 42_000 ||
      requestSeen?.stream !== true ||
      requestSeen?.streamMaxContentBytes !== 163_840 ||
      requestSeen?.streamStartTimeoutMs !== 180_000 ||
      requestSeen?.streamIdleTimeoutMs !== 60_000 ||
      requestSeen?.streamTotalTimeoutMs !== 300_000 ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      result.status !== 'blocked' ||
      result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(result.planSelection?.rejectedPlans) !== '[]' ||
      result.webSearchReceipt !== null ||
      result.usage?.calls !== 1 ||
      result.usage?.successfulCalls !== 0 ||
      result.usage?.promptTokens !== 0 ||
      result.usage?.completionTokens !== 0 ||
      result.usage?.totalTokens !== 0 ||
      result.usage?.reportedCostMicros !== 0 ||
      result.usage?.reportedCostUsd !== 0 ||
      result.usage?.costReporting !== 'unavailable' ||
      result.usage?.withinBudget !== true ||
      receipt?.status !== 'failed' ||
      receipt?.error !== 'openrouter_timeout' ||
      receipt?.generationId !==
        'gen-1786645018-bLkhzkJFE084SvoNvBWm' ||
      receipt?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      receipt?.requestedModel !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(receipt?.openRouterUsage) !== '{}' ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerSelectedProvider !== 'DeepInfra' ||
      diagnostics?.routerSelectedModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.routerEnvelopeProvider !== 'DeepInfra' ||
      diagnostics?.routerEnvelopeModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.contentByteCount !== 44_681 ||
      diagnostics?.contentSha256 !==
        '5712ed8cd5253512c980320b0ff6758f3f5d2b119ca739bdcd92bcde7e1d3da6' ||
      diagnostics?.streaming !== true ||
      diagnostics?.streamEventCount !== 2_834 ||
      diagnostics?.streamWireByteCount !== 861_416 ||
      diagnostics?.streamFirstDataLatencyMs !== 528 ||
      diagnostics?.streamDurationMs !== 300_010 ||
      diagnostics?.streamCompleted !== false ||
      diagnostics?.timeoutKind !== 'total' ||
      diagnostics?.timeoutOrigin !== 'profilescribe_local_deadline' ||
      diagnostics?.timeoutDeadlineMs !== 300_000 ||
      diagnostics?.timeoutElapsedMs !== 300_010 ||
      diagnostics?.timeoutPhase !== 'response_stream' ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.finishReason !== undefined ||
      diagnostics?.nativeFinishReason !== undefined ||
      diagnostics?.localJSONRepairApplied !== undefined ||
      diagnostics?.localJSONRepairFailure !== undefined ||
      result.preflight?.authorized !== true ||
      !Number.isInteger(result.preflight?.requestBodyByteCount) ||
      result.preflight.requestBodyByteCount <= 0 ||
      result.preflight.requestBodyByteCount > 45_056 ||
      !/^[a-f0-9]{64}$/.test(result.preflight?.requestBodySha256 || '') ||
      result.preflight?.serializedPromptTokenCeiling !==
        result.preflight.requestBodyByteCount + 1_024 ||
      result.preflight?.promptTokenCeiling !==
        result.preflight.serializedPromptTokenCeiling ||
      result.preflight?.responseBodyByteCount !== undefined ||
      result.preflight?.routeProvenanceValidated !== undefined ||
      result.normalizationDiagnostic !== undefined ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.commercialDiscoveryEvidence !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel)) {
    throw new Error(
      `DeepInfra production timeout did not fail once with bounded diagnostics: ${JSON.stringify({
        calls,
        request: requestSeen,
        result,
        rawSentinelPresent: JSON.stringify(result).includes(rawSentinel)
      })}`
    );
  }
}

async function verifyIoNetProductionTimeoutFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  const rawSentinel = 'raw-io-net-timeout-secret-sentinel';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      const error = new Error(
        'OpenRouter streaming request exceeded its bounded total deadline'
      );
      error.openRouterFailureCode = 'openrouter_timeout';
      error.openRouterGenerationId =
        'gen-1786648559-zOkTBWOkxN1JDTYwO7rY';
      error.openRouterDiagnostics = {
        httpStatus: 200,
        routerSelectedProvider: 'Io Net',
        routerSelectedModel: 'deepseek/deepseek-v4-flash-0731',
        routerEnvelopeProvider: 'Io Net',
        routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
        contentByteCount: 9_184,
        contentSha256:
          '78d3cf13b0ceb0b47da213f18f1a37de5510f35c15e8391e43a76bbd9da9bb1d',
        streaming: true,
        streamEventCount: 8_453,
        streamWireByteCount: 2_407_792,
        streamFirstDataLatencyMs: 6_132,
        streamDurationMs: 300_009,
        streamCompleted: false,
        timeoutKind: 'total',
        timeoutOrigin: 'profilescribe_local_deadline',
        timeoutDeadlineMs: 300_000,
        timeoutElapsedMs: 300_009,
        timeoutPhase: 'response_stream',
        responseHeadersReceived: true,
        rawProviderBody: rawSentinel
      };
      throw error;
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      requestSeen?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(requestSeen?.models) !==
        JSON.stringify(['deepseek/deepseek-v4-flash-0731']) ||
      requestSeen?.maxTokens !== 42_000 ||
      requestSeen?.stream !== true ||
      requestSeen?.streamMaxContentBytes !== 163_840 ||
      requestSeen?.streamStartTimeoutMs !== 180_000 ||
      requestSeen?.streamIdleTimeoutMs !== 60_000 ||
      requestSeen?.streamTotalTimeoutMs !== 300_000 ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      result.status !== 'blocked' ||
      result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(result.planSelection?.rejectedPlans) !== '[]' ||
      result.webSearchReceipt !== null ||
      result.usage?.calls !== 1 ||
      result.usage?.successfulCalls !== 0 ||
      result.usage?.promptTokens !== 0 ||
      result.usage?.completionTokens !== 0 ||
      result.usage?.totalTokens !== 0 ||
      result.usage?.reportedCostMicros !== 0 ||
      result.usage?.reportedCostUsd !== 0 ||
      result.usage?.costReporting !== 'unavailable' ||
      result.usage?.withinBudget !== true ||
      receipt?.status !== 'failed' ||
      receipt?.error !== 'openrouter_timeout' ||
      receipt?.generationId !==
        'gen-1786648559-zOkTBWOkxN1JDTYwO7rY' ||
      receipt?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      receipt?.requestedModel !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(receipt?.openRouterUsage) !== '{}' ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerSelectedProvider !== 'Io Net' ||
      diagnostics?.routerSelectedModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.routerEnvelopeProvider !== 'Io Net' ||
      diagnostics?.routerEnvelopeModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.contentByteCount !== 9_184 ||
      diagnostics?.contentSha256 !==
        '78d3cf13b0ceb0b47da213f18f1a37de5510f35c15e8391e43a76bbd9da9bb1d' ||
      diagnostics?.streaming !== true ||
      diagnostics?.streamEventCount !== 8_453 ||
      diagnostics?.streamWireByteCount !== 2_407_792 ||
      diagnostics?.streamFirstDataLatencyMs !== 6_132 ||
      diagnostics?.streamDurationMs !== 300_009 ||
      diagnostics?.streamCompleted !== false ||
      diagnostics?.timeoutKind !== 'total' ||
      diagnostics?.timeoutOrigin !== 'profilescribe_local_deadline' ||
      diagnostics?.timeoutDeadlineMs !== 300_000 ||
      diagnostics?.timeoutElapsedMs !== 300_009 ||
      diagnostics?.timeoutPhase !== 'response_stream' ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.finishReason !== undefined ||
      diagnostics?.nativeFinishReason !== undefined ||
      diagnostics?.localJSONRepairApplied !== undefined ||
      diagnostics?.localJSONRepairFailure !== undefined ||
      result.preflight?.authorized !== true ||
      !Number.isInteger(result.preflight?.requestBodyByteCount) ||
      result.preflight.requestBodyByteCount <= 0 ||
      result.preflight.requestBodyByteCount > 45_056 ||
      !/^[a-f0-9]{64}$/.test(result.preflight?.requestBodySha256 || '') ||
      result.preflight?.serializedPromptTokenCeiling !==
        result.preflight.requestBodyByteCount + 1_024 ||
      result.preflight?.promptTokenCeiling !==
        result.preflight.serializedPromptTokenCeiling ||
      result.preflight?.responseBodyByteCount !== undefined ||
      result.preflight?.routeProvenanceValidated !== undefined ||
      result.normalizationDiagnostic !== undefined ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.commercialDiscoveryEvidence !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel)) {
    throw new Error(
      `Io Net production timeout did not fail once with bounded diagnostics: ${JSON.stringify({
        calls,
        request: requestSeen,
        result,
        rawSentinelPresent: JSON.stringify(result).includes(rawSentinel)
      })}`
    );
  }
}

async function verifyPhalaProductionTimeoutFailsOnce(job) {
  let calls = 0;
  let requestSeen;
  const rawSentinel = 'raw-phala-timeout-secret-sentinel';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      calls += 1;
      requestSeen = request;
      const error = new Error(
        'OpenRouter streaming request exceeded its bounded total deadline'
      );
      error.openRouterFailureCode = 'openrouter_timeout';
      error.openRouterGenerationId =
        'gen-1786650660-GtChCUgjLUPtmEvvUuc5';
      error.openRouterDiagnostics = {
        httpStatus: 200,
        routerSelectedProvider: 'Phala',
        routerSelectedModel: 'deepseek/deepseek-v4-flash-0731',
        routerEnvelopeProvider: 'Phala',
        routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
        contentByteCount: 12_180,
        contentSha256:
          '2f40eed05b279dac5f4c3c85c110cf03b1f70f6b722b69062bbf7a29f669dc28',
        streaming: true,
        streamEventCount: 6_580,
        streamWireByteCount: 1_880_210,
        streamFirstDataLatencyMs: 718,
        streamDurationMs: 300_009,
        streamCompleted: false,
        timeoutKind: 'total',
        timeoutOrigin: 'profilescribe_local_deadline',
        timeoutDeadlineMs: 300_000,
        timeoutElapsedMs: 300_009,
        timeoutPhase: 'response_stream',
        responseHeadersReceived: true,
        rawProviderBody: rawSentinel
      };
      throw error;
    }
  });
  const receipt = result.llm?.discoveryPlanner;
  const diagnostics = receipt?.responseDiagnostics;
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  if (calls !== 1 ||
      requestSeen?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(requestSeen?.models) !==
        JSON.stringify(['deepseek/deepseek-v4-flash-0731']) ||
      requestSeen?.maxTokens !== 42_000 ||
      requestSeen?.stream !== true ||
      requestSeen?.streamMaxContentBytes !== 163_840 ||
      requestSeen?.streamStartTimeoutMs !== 180_000 ||
      requestSeen?.streamIdleTimeoutMs !== 60_000 ||
      requestSeen?.streamTotalTimeoutMs !== 300_000 ||
      JSON.stringify(requestSeen?.provider) !== JSON.stringify({
        ignore: expectedIgnore,
        sort: 'throughput',
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: 'deny',
        max_price: { prompt: 2, completion: 6, request: 0 }
      }) ||
      result.status !== 'blocked' ||
      result.plans.length !== 0 ||
      result.planSelection?.returnedPlanCount !== 0 ||
      result.planSelection?.acceptedPlanCount !== 0 ||
      result.planSelection?.rejectedPlanCount !== 0 ||
      JSON.stringify(result.planSelection?.rejectedPlans) !== '[]' ||
      result.webSearchReceipt !== null ||
      result.usage?.calls !== 1 ||
      result.usage?.successfulCalls !== 0 ||
      result.usage?.promptTokens !== 0 ||
      result.usage?.completionTokens !== 0 ||
      result.usage?.totalTokens !== 0 ||
      result.usage?.reportedCostMicros !== 0 ||
      result.usage?.reportedCostUsd !== 0 ||
      result.usage?.costReporting !== 'unavailable' ||
      result.usage?.withinBudget !== true ||
      receipt?.status !== 'failed' ||
      receipt?.error !== 'openrouter_timeout' ||
      receipt?.generationId !==
        'gen-1786650660-GtChCUgjLUPtmEvvUuc5' ||
      receipt?.model !== 'deepseek/deepseek-v4-flash-0731' ||
      receipt?.requestedModel !== 'deepseek/deepseek-v4-flash-0731' ||
      JSON.stringify(receipt?.openRouterUsage) !== '{}' ||
      diagnostics?.httpStatus !== 200 ||
      diagnostics?.routerSelectedProvider !== 'Phala' ||
      diagnostics?.routerSelectedModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.routerEnvelopeProvider !== 'Phala' ||
      diagnostics?.routerEnvelopeModel !==
        'deepseek/deepseek-v4-flash-0731' ||
      diagnostics?.contentByteCount !== 12_180 ||
      diagnostics?.contentSha256 !==
        '2f40eed05b279dac5f4c3c85c110cf03b1f70f6b722b69062bbf7a29f669dc28' ||
      diagnostics?.streaming !== true ||
      diagnostics?.streamEventCount !== 6_580 ||
      diagnostics?.streamWireByteCount !== 1_880_210 ||
      diagnostics?.streamFirstDataLatencyMs !== 718 ||
      diagnostics?.streamDurationMs !== 300_009 ||
      diagnostics?.streamCompleted !== false ||
      diagnostics?.timeoutKind !== 'total' ||
      diagnostics?.timeoutOrigin !== 'profilescribe_local_deadline' ||
      diagnostics?.timeoutDeadlineMs !== 300_000 ||
      diagnostics?.timeoutElapsedMs !== 300_009 ||
      diagnostics?.timeoutPhase !== 'response_stream' ||
      diagnostics?.responseHeadersReceived !== true ||
      diagnostics?.finishReason !== undefined ||
      diagnostics?.nativeFinishReason !== undefined ||
      diagnostics?.localJSONRepairApplied !== undefined ||
      diagnostics?.localJSONRepairFailure !== undefined ||
      result.preflight?.authorized !== true ||
      !Number.isInteger(result.preflight?.requestBodyByteCount) ||
      result.preflight.requestBodyByteCount <= 0 ||
      result.preflight.requestBodyByteCount > 45_056 ||
      !/^[a-f0-9]{64}$/.test(result.preflight?.requestBodySha256 || '') ||
      result.preflight?.serializedPromptTokenCeiling !==
        result.preflight.requestBodyByteCount + 1_024 ||
      result.preflight?.promptTokenCeiling !==
        result.preflight.serializedPromptTokenCeiling ||
      result.preflight?.responseBodyByteCount !== undefined ||
      result.preflight?.routeProvenanceValidated !== undefined ||
      result.normalizationDiagnostic !== undefined ||
      result.llm?.commercialCritic !== undefined ||
      result.llm?.strategyFamilyRepair !== undefined ||
      result.commercialDiscoveryEvidence !== undefined ||
      result.sideEffectsPerformed !== 0 ||
      JSON.stringify(result).includes(rawSentinel)) {
    throw new Error(
      `Phala production timeout did not fail once with bounded diagnostics: ${JSON.stringify({
        calls,
        request: requestSeen,
        result,
        rawSentinelPresent: JSON.stringify(result).includes(rawSentinel)
      })}`
    );
  }
}

async function verifyWaferAndAtlasProductionPartialTracesFailOnce(job) {
  const expectedIgnore = [
    'cloudflare',
    'open-inference',
    'decart',
    'digitalocean',
    'akashml',
    'siliconflow',
    'wafer',
    'ambient',
    'baidu',
    'fireworks',
    'morph',
    'atlas-cloud',
    'parasail',
    'together',
    'deepinfra',
    'mancer',
    'io-net',
    'phala'
  ];
  for (const scenario of [{
    provider: 'Wafer',
    generationId: 'gen-1786614275-eCHzBgip17OWBH4uqJ45',
    contentByteCount: 40_965,
    contentSha256:
      '7116e246720137715dd187dad57cf066957b2879edc2c6ea3381ec112a9cc0c0',
    streamEventCount: 4_770,
    streamWireByteCount: 1_387_049,
    streamFirstDataLatencyMs: 706,
    streamDurationMs: 59_126,
    rawSentinel: 'raw-wafer-partial-secret-sentinel'
  }, {
    provider: 'AtlasCloud',
    generationId: 'gen-atlascloud-production-partial-fixture',
    contentByteCount: 40_966,
    contentSha256: '5'.repeat(64),
    streamEventCount: 6_852,
    streamWireByteCount: 2_018_649,
    streamFirstDataLatencyMs: 712,
    streamDurationMs: 206_501,
    rawSentinel: 'raw-atlascloud-partial-secret-sentinel'
  }]) {
    let calls = 0;
    let requestSeen;
    const result = await runOpportunityDiscoveryPlanner({
      job,
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => {
        calls += 1;
        requestSeen = request;
        const error = new Error(
          'OpenRouter stream ended without a complete terminal stop, usage, and route event'
        );
        error.openRouterFailureCode =
          'openrouter_invalid_response';
        error.openRouterGenerationId = scenario.generationId;
        error.openRouterDiagnostics = {
          httpStatus: 200,
          routerSelectedProvider: scenario.provider,
          routerSelectedModel: 'deepseek/deepseek-v4-flash-0731',
          routerEnvelopeProvider: scenario.provider,
          routerEnvelopeModel: 'deepseek/deepseek-v4-flash-0731',
          contentByteCount: scenario.contentByteCount,
          contentSha256: scenario.contentSha256,
          streaming: true,
          streamEventCount: scenario.streamEventCount,
          streamWireByteCount: scenario.streamWireByteCount,
          streamFirstDataLatencyMs: scenario.streamFirstDataLatencyMs,
          streamDurationMs: scenario.streamDurationMs,
          streamCompleted: false,
          responseHeadersReceived: true,
          rawProviderBody: scenario.rawSentinel
        };
        throw error;
      }
    });
    const receipt = result.llm?.discoveryPlanner;
    const diagnostics = receipt?.responseDiagnostics;
    if (calls !== 1 ||
        requestSeen?.maxTokens !== 42_000 ||
        requestSeen?.streamMaxContentBytes !==
          MAX_DISCOVERY_PLANNER_RAW_STREAM_CONTENT_BYTES ||
        JSON.stringify(requestSeen?.provider?.ignore) !==
          JSON.stringify(expectedIgnore) ||
        requestSeen?.provider?.sort !== 'throughput' ||
        requestSeen?.provider?.allow_fallbacks !== true ||
        requestSeen?.provider?.require_parameters !== true ||
        requestSeen?.provider?.data_collection !== 'deny' ||
        result.status !== 'blocked' || result.plans.length !== 0 ||
        result.reason !==
          'The bounded discovery planner did not return a usable plan.' ||
        result.recoveryCause !== undefined ||
        result.failureCode !== undefined ||
        result.preflight?.responseBodyByteCount !== undefined ||
        result.preflight?.maxResponseBodyByteCount !== undefined ||
        result.preflight?.routeProvenanceValidated !== undefined ||
        result.usage?.calls !== 1 || result.usage?.successfulCalls !== 0 ||
        result.usage?.promptTokens !== 0 ||
        result.usage?.completionTokens !== 0 ||
        receipt?.status !== 'failed' ||
        receipt?.error !== 'openrouter_invalid_response' ||
        receipt?.generationId !== scenario.generationId ||
        JSON.stringify(receipt?.openRouterUsage) !== '{}' ||
        diagnostics?.httpStatus !== 200 ||
        diagnostics?.routerSelectedProvider !== scenario.provider ||
        diagnostics?.contentByteCount !== scenario.contentByteCount ||
        diagnostics?.structuredOutputEnvelopeExceeded !== undefined ||
        diagnostics?.maxContentByteCount !== undefined ||
        diagnostics?.streamEventCount !== scenario.streamEventCount ||
        diagnostics?.streamWireByteCount !== scenario.streamWireByteCount ||
        diagnostics?.streamFirstDataLatencyMs !==
          scenario.streamFirstDataLatencyMs ||
        diagnostics?.streamDurationMs !== scenario.streamDurationMs ||
        diagnostics?.streamCompleted !== false ||
        diagnostics?.responseHeadersReceived !== true ||
        diagnostics?.finishReason !== undefined ||
        diagnostics?.nativeFinishReason !== undefined ||
        diagnostics?.localJSONRepairApplied !== undefined ||
        result.llm?.commercialCritic !== undefined ||
        result.llm?.strategyFamilyRepair !== undefined ||
        result.sideEffectsPerformed !== 0 ||
        JSON.stringify(result).includes(scenario.rawSentinel)) {
      throw new Error(
        `${scenario.provider} production partial trace did not fail once with a safe rejected receipt: ${JSON.stringify({ calls, request: requestSeen, result })}`
      );
    }
  }
}

async function verifyObjectiveSellerFocusAndDirectoryEvidenceRoles() {
  const scenario = cases[3];
  const job = plannerJob(scenario);
  job.payload.objective.outcome =
    'Create one verifiable, attributable incremental-income outcome for ProfileScribe';
  // Legacy workers used this hint when owner-source crawls were fresh. Exact
  // outside targets are still unresolved, so call one must ignore it and
  // preserve the bounded folded search.
  job.payload.skipExaSearch = true;
  job.payload.commercialContext.profile.currentFocus = [{
    name: 'ProfileScribe',
    description:
      'Agent-managed professional profiles and source-backed updates.',
    status: 'active',
    priority: 'primary',
    evidenceRef: 'profile:focus:1'
  }];
  job.payload.commercialSellerContract = {
    requiredPrimaryFocus: 'ProfileScribe',
    requiredEvidenceRefs: ['profile:focus:1']
  };
  job.payload.evidenceSnapshot.profile.currentFocus = [
    {
      id: 'focus-empty-persisted-record',
      name: '',
      description:
        'An unnamed persisted record must not consume compact focus numbering.'
    },
    {
      // Production focus records retain an opaque store ID. The planner and
      // control plane must nevertheless share the compact profile:focus:1
      // evidence reference, rather than allowing current_focus:<opaque-id> to
      // win by catalog order.
      id: 'focus-17bb309d-5ed2-42ab-b9fe-948bb698ee3b',
      name: 'ProfileScribe',
      description:
        'Agent-managed professional profiles and source-backed updates.',
      status: 'active',
      priority: 'primary',
      evidence: ['The owner confirmed ProfileScribe is the primary business.']
    }
  ];
  job.payload.evidenceSnapshot.sources[0] = {
    id: 'profilescribe-owner-site',
    label: 'ProfileScribe',
    url: 'https://profilescribe.com',
    status: 'approved',
    profileControlled: true
  };
  job.payload.evidenceSnapshot.sourceEvidence = [
    {
      id: 'profilescribe-lactation-directory',
      observationId: 'profilescribe-lactation-directory',
      sourceId: 'profilescribe-owner-site',
      label: 'Find Lactation consultants | ProfileScribe',
      summary:
        'This SearchResultsPage contains an ItemList for finding lactation consultants.',
      url: 'https://profilescribe.com/profession/lactation-consultants',
      observedAt: now.toISOString(),
      status: 'approved'
    },
    {
      id: 'profilescribe-paid-subscription',
      observationId: 'profilescribe-paid-subscription',
      sourceId: 'profilescribe-owner-site',
      label: 'ProfileScribe paid subscription pricing',
      summary:
        'Current paid subscription with a checkout destination for professional-presence service.',
      url: 'https://profilescribe.com/pricing',
      observedAt: now.toISOString(),
      status: 'approved'
    }
  ];

  const catalog = buildEvidenceCatalog(job.payload, {}, now, {
    includeSystemAttributionCapability: true
  });
  const directoryEvidence = catalog.find((item) =>
    item.id === 'observation:profilescribe-lactation-directory'
  );
  const sellerFocusEvidence = catalog.find((item) =>
    item.id === 'profile:focus:1'
  );
  const legacyPersistedFocusEvidence = catalog.find((item) =>
    /^current_focus:focus-(?:empty|17bb)/.test(item.id || '')
  );
  if (!sellerFocusEvidence ||
      legacyPersistedFocusEvidence ||
      directoryEvidence?.revenueAssetRole !== 'informational_only') {
    throw new Error(
      `ProfileScribe seller focus or directory role was invalid: ${JSON.stringify({
        sellerFocusEvidence,
        legacyPersistedFocusEvidence,
        directoryEvidence
      })}`
    );
  }
  const evidenceRef = directoryEvidence.id;
  let requestSeen;
  const motions = compactFreshPlannerPlans(
    scenario.plans(evidenceRef).map((motion) => {
      motion.paidOffer = {
        seller: 'ProfileScribe paid professional-presence subscription',
        compensatedJob: COMPENSATED_JOB_PAID_OFFER
      };
      motion.evidenceRefs = [
        ...motion.evidenceRefs,
        sellerFocusEvidence.id
      ];
      motion.contingentFinalists = compactContingentFinalists(
        motion.contingentFinalists
      );
      return motion;
    })
  );
  motions[0].paidOffer.seller = 'Paid newborn lactation home visit';
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      requestSeen = request;
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const motion of motions) motion.market = exactMarket;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: motions
        },
        usage,
        generationId: 'generation-primary-seller-focus',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 900,
          contentSha256: '6'.repeat(64)
        },
        annotations: []
      };
    }
  });
  const prompt = JSON.parse(requestSeen?.user || '{}');
  if (prompt.sellerContract?.requiredPrimaryFocus !== 'ProfileScribe' ||
      JSON.stringify(prompt.sellerContract?.requiredEvidenceRefs) !==
        JSON.stringify([sellerFocusEvidence.id]) ||
      !prompt.evidenceCatalog?.some((item) =>
        item.id === sellerFocusEvidence.id
      ) ||
      requestSeen?.plugins?.length !== 0 ||
      result.preflight?.fixedToolFeeMicros !== 0 ||
      !prompt.hardRules?.some((rule) =>
        /Audience\/directory\/category pages can inform buyer context but cannot redefine the seller/i.test(
          rule
        )
      ) ||
      result.status !== 'blocked' ||
      result.plans.length !== 0 ||
      result.normalizationDiagnostic?.code !== 'strict_schema_mismatch' ||
      result.usage?.successfulCalls !== 1 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `primary seller focus was not enforced: ${JSON.stringify({ prompt, result })}`
    );
  }

  const projectedProfileJob = structuredClone(job);
  projectedProfileJob.payload.evidenceSnapshot.profile.currentFocus = [];
  const projectedProfileMotions = compactFreshPlannerPlans(
    scenario.plans(evidenceRef).map((motion) => {
      motion.paidOffer = {
        seller: 'ProfileScribe paid professional-presence subscription',
        compensatedJob: COMPENSATED_JOB_PAID_OFFER
      };
      motion.evidenceRefs = [
        ...motion.evidenceRefs,
        sellerFocusEvidence.id
      ];
      motion.contingentFinalists = compactContingentFinalists(
        motion.contingentFinalists
      );
      return motion;
    })
  );
  let projectedRequest;
  const projectedProfileResult = await runOpportunityDiscoveryPlanner({
    job: projectedProfileJob,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      projectedRequest = request;
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const motion of projectedProfileMotions) {
        motion.market = exactMarket;
      }
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: projectedProfileMotions
        },
        usage,
        generationId: 'generation-worker-seller-contract',
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
  const projectedPrompt = JSON.parse(projectedRequest?.user || '{}');
  if (projectedProfileResult.status !== 'planned' ||
      projectedProfileResult.plans.length !== 2 ||
      JSON.stringify(projectedPrompt.sellerContract) !== JSON.stringify({
        requiredPrimaryFocus: 'ProfileScribe',
        requiredEvidenceRefs: ['profile:focus:1'],
        offerEvidenceStatus: 'verified_current_paid_offer'
      }) ||
      !projectedPrompt.evidenceCatalog?.some((item) =>
        item.id === 'profile:focus:1' &&
        item.type === 'current_focus' &&
        item.priority === 'primary'
      )) {
    throw new Error(
      `worker seller contract did not survive a divergent MCP profile projection: ${JSON.stringify({ projectedPrompt, projectedProfileResult })}`
    );
  }

  const lateSellerFocusJob = structuredClone(projectedProfileJob);
  lateSellerFocusJob.payload.commercialContext.profile.currentFocus = [
    ...Array.from({ length: 8 }, (_unused, index) => ({
      name: `Archived focus ${index + 1}`,
      description: 'Historical focus retained for profile compatibility.',
      status: 'inactive',
      priority: 'secondary',
      evidenceRef: `profile:focus:${index + 1}`
    })),
    {
      name: 'ProfileScribe',
      description:
        'Agent-managed professional profiles and source-backed updates.',
      status: 'active',
      priority: 'primary',
      evidenceRef: 'profile:focus:9'
    }
  ];
  lateSellerFocusJob.payload.commercialSellerContract = {
    requiredPrimaryFocus: 'ProfileScribe',
    requiredEvidenceRefs: ['profile:focus:9']
  };
  const lateSellerFocusMotions = projectedProfileMotions.map((motionValue) => {
    const replaceFocusRef = (value) => {
      if (Array.isArray(value)) return value.map(replaceFocusRef);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
          key,
          replaceFocusRef(item)
        ]));
      }
      return value === 'profile:focus:1' ? 'profile:focus:9' : value;
    };
    return replaceFocusRef(structuredClone(motionValue));
  });
  let lateSellerRequest;
  const lateSellerResult = await runOpportunityDiscoveryPlanner({
    job: lateSellerFocusJob,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      lateSellerRequest = request;
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const motion of lateSellerFocusMotions) {
        motion.market = exactMarket;
      }
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: lateSellerFocusMotions
        },
        usage,
        generationId: 'generation-late-worker-seller-contract',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 900,
          contentSha256: '5'.repeat(64)
        },
        annotations: []
      };
    }
  });
  const lateSellerPrompt = JSON.parse(lateSellerRequest?.user || '{}');
  if (lateSellerResult.status !== 'planned' ||
      lateSellerResult.plans.length !== 2 ||
      lateSellerPrompt.sellerContract?.requiredPrimaryFocus !==
        'ProfileScribe' ||
      JSON.stringify(lateSellerPrompt.sellerContract?.requiredEvidenceRefs) !==
        JSON.stringify(['profile:focus:9']) ||
      !lateSellerPrompt.evidenceCatalog?.some((item) =>
        item.id === 'profile:focus:9' &&
        item.type === 'current_focus' &&
        item.priority === 'primary'
      )) {
    throw new Error(
      `control-plane seller focus positions 9-12 drifted from the rig window: ${JSON.stringify({ lateSellerPrompt, lateSellerResult })}`
    );
  }

  const colonSellerFocus = 'Consulting: Strategy & Operations';
  const colonSellerJob = structuredClone(job);
  colonSellerJob.payload.objective.outcome =
    `Create one attributable paid outcome for ${colonSellerFocus}`;
  colonSellerJob.payload.commercialContext.profile.currentFocus[0].name =
    colonSellerFocus;
  colonSellerJob.payload.commercialSellerContract.requiredPrimaryFocus =
    colonSellerFocus;
  colonSellerJob.payload.evidenceSnapshot.profile.currentFocus[1].name =
    colonSellerFocus;
  const colonPaidObservation =
    colonSellerJob.payload.evidenceSnapshot.sourceEvidence.find((item) =>
      item.id === 'profilescribe-paid-subscription'
    );
  colonPaidObservation.label = `${colonSellerFocus} paid engagement`;
  colonPaidObservation.summary =
    `Current paid ${colonSellerFocus} engagement with a checkout destination.`;
  const colonPaidOffer =
    `${colonSellerFocus} paid advisory engagement`;
  const colonSellerMotions = compactFreshPlannerPlans(scenario.plans(evidenceRef).map(
    (motion) => {
      motion.paidOffer = {
        seller: colonPaidOffer,
        compensatedJob:
          'A current compensated role matching verified professional skills'
      };
      motion.evidenceRefs = [
        ...motion.evidenceRefs,
        sellerFocusEvidence.id
      ];
      motion.contingentFinalists = compactContingentFinalists(
        motion.contingentFinalists
      );
      return motion;
    }
  ));
  let colonSellerRequest;
  const colonSellerResult = await runOpportunityDiscoveryPlanner({
    job: colonSellerJob,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      colonSellerRequest = request;
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const motion of colonSellerMotions) motion.market = exactMarket;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: colonSellerMotions
        },
        usage,
        generationId: 'generation-colon-seller-focus',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: 900,
          contentSha256: '4'.repeat(64)
        },
        annotations: []
      };
    }
  });
  const colonSellerPrompt = JSON.parse(
    colonSellerRequest?.user || '{}'
  );
  const colonOfferPattern = colonSellerRequest?.responseFormat?.json_schema
    ?.schema?.properties?.plans?.items?.properties?.paidOffer?.properties
    ?.seller?.pattern || '';
  let colonOfferMatchesSchema = false;
  try {
    colonOfferMatchesSchema = new RegExp(colonOfferPattern, 'u').test(
      colonPaidOffer
    );
  } catch {
    colonOfferMatchesSchema = false;
  }
  if (colonSellerResult.status !== 'planned' ||
      colonSellerResult.plans.length !== 2 ||
      colonSellerResult.plans.some((motion) =>
        motion.paidOffer !== colonPaidOffer
      ) ||
      colonSellerPrompt.sellerContract?.requiredPrimaryFocus !==
        colonSellerFocus ||
      !colonOfferMatchesSchema) {
    throw new Error(
      `colon-containing authoritative seller focus was rejected or widened: ${JSON.stringify({ colonOfferPattern, colonSellerPrompt, colonSellerResult })}`
    );
  }

  const mismatchedWorkerContractJob = structuredClone(job);
  mismatchedWorkerContractJob.payload.commercialSellerContract
    .requiredEvidenceRefs = ['profile:focus:2'];
  let mismatchedWorkerProviderCalls = 0;
  const mismatchedWorkerContractResult =
    await runOpportunityDiscoveryPlanner({
      job: mismatchedWorkerContractJob,
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async () => {
        mismatchedWorkerProviderCalls += 1;
        throw new Error('seller-contract preflight reached the provider');
      }
    });
  if (mismatchedWorkerProviderCalls !== 0 ||
      mismatchedWorkerContractResult.status !== 'blocked' ||
      mismatchedWorkerContractResult.usage?.calls !== 0 ||
      !/seller evidence reference is not present/i.test(
        mismatchedWorkerContractResult.reason || ''
      )) {
    throw new Error(
      `mismatched worker seller contract was not blocked before paid planning: ${JSON.stringify({ mismatchedWorkerProviderCalls, mismatchedWorkerContractResult })}`
    );
  }

  const mismatchedSellerMotions = compactFreshPlannerPlans(scenario.plans(evidenceRef).map(
    (motion) => {
      motion.paidOffer = {
        seller: 'ProfileScribe paid professional-presence subscription',
        compensatedJob: COMPENSATED_JOB_PAID_OFFER
      };
      motion.contingentFinalists = compactContingentFinalists(
        motion.contingentFinalists
      );
      return motion;
    }
  ));
  const mismatchedSellerResult = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const motion of mismatchedSellerMotions) {
        motion.market = exactMarket;
      }
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: mismatchedSellerMotions
        },
        usage,
        generationId: 'generation-mismatched-primary-seller-evidence',
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
  if (mismatchedSellerResult.status !== 'planned' ||
      mismatchedSellerResult.plans.length !== 2 ||
      mismatchedSellerResult.plans.some((motion) =>
        !motion.evidenceRefs.includes(sellerFocusEvidence.id)
      )) {
    throw new Error(
      `authoritative seller-focus evidence was not appended locally: ${JSON.stringify(mismatchedSellerResult)}`
    );
  }

  const targetTokenMotions = compactFreshPlannerPlans(scenario.plans(evidenceRef).map((motion) => {
    motion.paidOffer = {
      seller: 'ProfileScribe paid professional-presence subscription',
      compensatedJob: COMPENSATED_JOB_PAID_OFFER
    };
    motion.evidenceRefs = [
      ...motion.evidenceRefs,
      sellerFocusEvidence.id
    ];
    motion.contingentFinalists = compactContingentFinalists(
      motion.contingentFinalists
    );
    const compact = compactFreshPlannerPlans([motion])[0];
    compact.contingentFinalists.pathBase.r[0].l =
      'The payer represented by {{TARGET_NAME}}';
    return compact;
  }));
  const targetTokenResult = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const motion of targetTokenMotions) motion.market = exactMarket;
      return {
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: '',
        plans: targetTokenMotions
      },
      usage,
      generationId: 'generation-target-token-in-buyer',
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
  if (targetTokenResult.status !== 'blocked' ||
      targetTokenResult.plans.length !== 0 ||
      targetTokenResult.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      targetTokenResult.usage?.successfulCalls !== 1 ||
      targetTokenResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `removed top-level buyer authority leaked into execution: ${JSON.stringify(targetTokenResult)}`
    );
  }
}

async function verifyUnprovenOfferRequiresLiveCompensatedDemand() {
  const job = plannerJob(cases[3]);
  job.payload.objective.outcome =
    'Create one verifiable attributable incremental-income outcome for ProfileScribe';
  job.payload.commercialContext.profile.currentFocus = [{
    name: 'ProfileScribe',
    description:
      'Agent-managed professional profiles and source-backed updates.',
    status: 'active',
    priority: 'primary',
    evidenceRef: 'profile:focus:1'
  }];
  job.payload.commercialSellerContract = {
    requiredPrimaryFocus: 'ProfileScribe',
    requiredEvidenceRefs: ['profile:focus:1']
  };
  job.payload.commercialDiscoveryCapabilities = {
    braveWebSearch: true,
    pdlPersonSearch: true,
    pdlJobPostingSearch: true
  };
  job.payload.evidenceSnapshot.profile.currentFocus = [{
    id: 'focus-profilescribe',
    name: 'ProfileScribe',
    description:
      'Agent-managed professional profiles and source-backed updates.',
    status: 'active',
    priority: 'primary',
    evidence: ['The owner confirmed ProfileScribe is the primary focus.']
  }];
  job.payload.evidenceSnapshot.sources = [{
    id: 'profilescribe-owner-site',
    label: 'ProfileScribe',
    url: 'https://profilescribe.com',
    status: 'approved',
    profileControlled: true
  }];
  job.payload.evidenceSnapshot.sourceEvidence = [{
    id: 'profilescribe-capability-observation',
    observationId: 'profilescribe-capability-observation',
    sourceId: 'profilescribe-owner-site',
    label: 'ProfileScribe professional profile platform',
    summary:
      'ProfileScribe demonstrates production software, agent orchestration, professional profiles, and source-backed updates.',
    url: 'https://profilescribe.com/',
    observedAt: now.toISOString(),
    status: 'approved'
  }];

  const evidenceRef = 'observation:profilescribe-capability-observation';
  let requestSeen;
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      requestSeen = request;
      const market = request.responseFormat.json_schema.schema.properties
        .plans.items.properties.market.enum[0];
      const source = cases[1].plans(evidenceRef)[0];
      const plans = [source, structuredClone(source)].map((motion, index) => {
        motion.id = `profilescribe_paid_demand_${index + 1}`;
        motion.priority = index + 1;
        motion.market = market;
        motion.jobTitle = index === 0
          ? 'Software product engineer'
          : 'AI platform engineer';
        motion.skills = index === 0
          ? ['Software engineering', 'Product development']
          : ['AI agents', 'Platform engineering'];
        motion.contingentFinalists = compactContingentFinalists(
          motion.contingentFinalists
        );
        motion.paidOffer = {
          seller: 'Proposed paid ProfileScribe professional profile service',
          compensatedJob:
            'A current compensated software product engineering role'
        };
        return motion;
      });
      const response = {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: '',
        plans: compactFreshPlannerPlans(plans)
      };
      return {
        data: response,
        usage,
        generationId: 'generation-unproven-offer-paid-demand',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: Buffer.byteLength(JSON.stringify(response)),
          contentSha256: 'e'.repeat(64)
        },
        annotations: []
      };
    }
  });
  const prompt = JSON.parse(requestSeen?.user || '{}');
  const motionKinds = requestSeen?.responseFormat?.json_schema?.schema
    ?.properties?.plans?.items?.properties?.motionKind?.enum || [];
  if (result.status !== 'planned' ||
      result.plans.length !== 2 ||
      result.plans.some((motion) =>
        motion.motionKind !== 'compensated_job' ||
        motion.searchMode !== 'active_job_posting' ||
        motion.commercialRole !== 'paid_demand' ||
        motion.demandArtifactKind !== 'employer_job_posting' ||
        /^Proposed paid\b/.test(motion.paidOffer || '')
      ) ||
      JSON.stringify(motionKinds) !== JSON.stringify(['compensated_job']) ||
      prompt.sellerContract?.offerEvidenceStatus !==
        'unverified_offer_paid_demand_only' ||
      !prompt.outputContract?.offerAuthority?.includes(
        'select only compensated_job motions'
      ) ||
      !prompt.hardRules?.some((rule) =>
        rule.includes('Only compensated_job is authorized')
      ) ||
      result.usage?.calls !== 1 ||
      result.sideEffectsPerformed !== 0) {
    throw new Error(
      `unproven offer was not forced onto live compensated demand: ${JSON.stringify({ prompt, motionKinds, result })}`
    );
  }
}

async function verifyVerifiedCapabilityCanPlanProvisionalPaidOffer() {
  const scenario = cases[3];
  const job = plannerJob(scenario);
  job.payload.objective.outcome =
    'Create one verifiable attributable incremental-income outcome for ProfileScribe';
  job.payload.commercialContext.profile.currentFocus = [{
    name: 'ProfileScribe',
    description:
      'Agent-managed professional profiles and source-backed updates.',
    status: 'active',
    priority: 'primary',
    evidenceRef: 'profile:focus:1'
  }];
  job.payload.commercialSellerContract = {
    requiredPrimaryFocus: 'ProfileScribe',
    requiredEvidenceRefs: ['profile:focus:1']
  };
  job.payload.commercialDiscoveryCapabilities = {
    braveWebSearch: false,
    pdlPersonSearch: true,
    pdlJobPostingSearch: false
  };
  job.payload.evidenceSnapshot.profile.currentFocus = [{
    id: 'focus-profilescribe',
    name: 'ProfileScribe',
    description:
      'Agent-managed professional profiles and source-backed updates.',
    status: 'active',
    priority: 'primary',
    evidence: ['The owner confirmed ProfileScribe is the primary focus.']
  }];
  job.payload.evidenceSnapshot.sources = [{
    id: 'profilescribe-owner-site',
    label: 'ProfileScribe',
    url: 'https://profilescribe.com',
    status: 'approved',
    profileControlled: true
  }];
  job.payload.evidenceSnapshot.sourceEvidence = [{
    id: 'profilescribe-capability-observation',
    observationId: 'profilescribe-capability-observation',
    sourceId: 'profilescribe-owner-site',
    label: 'ProfileScribe professional profile platform',
    summary:
      'ProfileScribe maintains agent-managed professional profiles and source-backed professional updates.',
    url: 'https://profilescribe.com/',
    observedAt: now.toISOString(),
    status: 'approved'
  }];

  const evidenceRef = 'observation:profilescribe-capability-observation';
  const sellerRef = 'profile:focus:1';
  const directPersonTemplate = scenario.plans(evidenceRef)[1];
  const rawPlans = [
    directPersonTemplate,
    structuredClone(directPersonTemplate)
  ].map((motion, index) => {
    motion.id = `profilescribe_provisional_${index + 1}`;
    motion.searchMode = 'professional_counterparty';
    motion.motionKind = index === 0
      ? 'direct_buyer_person'
      : 'referral_person';
    motion.commercialRole = index === 0 ? 'buyer' : 'referral_partner';
    motion.acquisitionMode = index === 0
      ? 'permissioned_outreach'
      : 'partner_channel';
    motion.targetRoleSubrole = index === 0 ? 'executive' : 'partnerships';
    motion.paidOffer =
      'Proposed paid ProfileScribe professional profile service';
    motion.attributionSignal =
      'ProfileScribe source field records the tournament action';
    motion.evidenceRefs = [...new Set([
      ...motion.evidenceRefs,
      sellerRef
    ])];
    motion.contingentFinalists = compactProvisionalContingentFinalists(
      motion.contingentFinalists,
      motion.commercialRole,
      sellerRef
    );
    // Reproduce the production failure class: the model supplied a
    // schema-valid seller alternative but grounded its proposed offer,
    // destination, conversion, and attribution in a generic observation.
    // Fresh normalization must project those structural roles from the
    // authoritative seller/system refs before any provider or critic work.
    for (const revenue of motion.contingentFinalists.pathBase.r) {
      revenue.rm = {
        seller: 'paid_pilot',
        compensatedJob: 'compensated_role'
      };
      revenue.atm = 'crm_source';
      revenue.ats =
        'ProfileScribe source field records the tournament action';
      revenue.g.o = [evidenceRef];
      revenue.g.d.e = [evidenceRef];
      revenue.g.c = [evidenceRef];
      revenue.g.t = [evidenceRef];
    }
    return motion;
  });
  let requestSeen;
  let schemaErrors = [];
  const provisionalResponseForRequest = (
    request,
    {
      omitDuplicateCausalFields = false,
      reproduceUnsupportedAttribution = false
    } = {}
  ) => {
    const planProperties = request.responseFormat.json_schema.schema
      .properties.plans.items.properties;
    const response = {
      contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
      status: 'planned',
      reason: '',
      plans: rawPlans.map((motion) => Object.fromEntries(
        Object.keys(planProperties).filter((key) =>
          !omitDuplicateCausalFields || ![
            'conversionDestination',
            'paidConversion',
            'attributionSignal'
          ].includes(key)
        ).map((key) => [
          key,
          key === 'paidOffer'
            ? {
                seller: motion.paidOffer,
                compensatedJob:
                  'A model-authored compensated professional role'
              }
            : key === 'jobTitle'
              ? 'ProfileScribe product consultant'
              : motion[key]
        ])
      ))
    };
    if (reproduceUnsupportedAttribution) {
      for (const plan of response.plans) {
        plan.attributionSignal = 'Ccampaign';
        for (const revenue of plan.contingentFinalists.pathBase.r) {
          revenue.atm = 'referral_code';
          revenue.ats = 'Ccampaign';
        }
      }
    }
    return response;
  };
  const result = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      requestSeen = request;
      const response = provisionalResponseForRequest(request);
      const validate = new Ajv({ allErrors: true, strict: false }).compile(
        request.responseFormat.json_schema.schema
      );
      if (!validate(response)) {
        schemaErrors = validate.errors || [];
      }
      return {
        data: response,
        usage,
        generationId: 'generation-provisional-offer',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: Buffer.byteLength(JSON.stringify(response)),
          contentSha256: 'e'.repeat(64)
        },
        annotations: []
      };
    }
  });
  const prompt = JSON.parse(requestSeen?.user || '{}');
  const motionKinds = requestSeen?.responseFormat?.json_schema?.schema
    ?.properties?.plans?.items?.properties?.motionKind?.enum || [];
  const provisionalRevenuePaths = result.plans.flatMap((motion) => [
    motion.contingentFinalists?.familyA?.d?.r?.[0],
    motion.contingentFinalists?.familyB?.d?.r?.[0]
  ]).filter(Boolean);
  if (result.status !== 'planned' ||
      result.plans.length !== 2 ||
      result.plans.some((motion) =>
        !/^Proposed paid ProfileScribe\b/.test(motion.paidOffer)
      ) ||
      prompt.sellerContract?.offerEvidenceStatus !==
        'proposed_from_verified_capability' ||
      prompt.sellerContract?.requiredPrimaryFocus !== 'ProfileScribe' ||
      motionKinds.includes('compensated_job') ||
      !motionKinds.includes('direct_buyer_person') ||
      !motionKinds.includes('referral_person') ||
      provisionalRevenuePaths.some((revenue) =>
        revenue.rm === 'compensated_role' ||
        JSON.stringify(revenue.g?.o) !== JSON.stringify([sellerRef]) ||
        JSON.stringify(revenue.g?.d?.e) !== JSON.stringify([sellerRef]) ||
        JSON.stringify(revenue.g?.c) !== JSON.stringify([sellerRef]) ||
        JSON.stringify(revenue.g?.t) !== JSON.stringify([
          PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
        ])
      ) ||
      schemaErrors.length !== 0 ||
      result.usage?.calls !== 1) {
    throw new Error(
      `verified capability did not produce bounded provisional discovery: ${JSON.stringify({ schemaErrors, prompt, motionKinds, result })}`
    );
  }

  // Direct completions are exact-contract inputs now. A healed object that
  // adds a removed top-level causal field or an unsupported structural enum
  // must fail AJV before normalization; completed provider usage remains
  // accounted and no model prose is repaired.
  let recoveredPlannerCalls = 0;
  const recoveredResult = await runOpportunityDiscoveryPlanner({
    job,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      recoveredPlannerCalls += 1;
      const response = provisionalResponseForRequest(request, {
        omitDuplicateCausalFields: true,
        reproduceUnsupportedAttribution: true
      });
      return {
        data: response,
        usage,
        generationId: 'generation-provisional-offer-nested-recovery',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: Buffer.byteLength(JSON.stringify(response)),
          contentSha256: 'd'.repeat(64)
        },
        annotations: []
      };
    }
  });
  if (recoveredPlannerCalls !== 1 ||
      recoveredResult.status !== 'blocked' ||
      recoveredResult.plans.length !== 0 ||
      recoveredResult.normalizationDiagnostic?.code !==
        'strict_schema_mismatch' ||
      recoveredResult.usage?.successfulCalls !== 1 ||
      recoveredResult.sideEffectsPerformed !== 0) {
    throw new Error(
      `schema-invalid healed causal fields were accepted: ${JSON.stringify(recoveredResult)}`
    );
  }

  const selectedMotion = result.plans[0];
  // A schema-valid model may repeat the attribution capability in every
  // nested grounding role. Current normalization must project it to the sole
  // attribution role instead of rejecting every otherwise grounded tuple.
  for (const familyKey of ['familyA', 'familyB']) {
    const grounding = selectedMotion.contingentFinalists[familyKey]
      .d.r[0].g;
    for (const refs of [
      grounding.b,
      grounding.o,
      grounding.a,
      grounding.d.e,
      grounding.c
    ]) {
      if (!refs.includes(
        PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
      )) {
        refs.push(PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID);
      }
    }
  }
  const attempt = {
    id: 'attempt-provisional-profile-target',
    provider: 'people_data_labs_person_search',
    operation: 'planned_professional_search',
    queryHash: 'c'.repeat(64),
    status: 'succeeded',
    estimatedSpendMicros: 280_000,
    actualSpendMicros: 280_000,
    creditsUsed: 1,
    resultCount: 1,
    reservedAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-08-01T12:00:01Z',
    completedAt: '2026-08-01T12:00:01Z'
  };
  const targetEvidenceRef =
    'external_discovery:1234567890abcdef12345678';
  const targetCandidateId =
    'candidate:external:abcdef1234567890abcdef12';
  const targetURL =
    'https://linkedin.com/in/alex-rivera-partnerships';
  const targetRoles = [
    'acquisition',
    'channel_fit',
    'defined_buyer'
  ];
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
    plan: persistedSingleMotionPlan(result, selectedMotion),
    evidence: [{
      motionId: selectedMotion.id,
      evidenceRef: targetEvidenceRef,
      kind: 'verified_external_professional_target',
      label: 'Alex Rivera Executive Operations Director at Northstar Software',
      summary:
        'People Data Labs returned this current public professional identity for a review-first partner-fit check only.',
      url: targetURL,
      provider: 'people_data_labs_person_search',
      provenance: 'people_data_labs_professional_record',
      roles: targetRoles,
      verified: true,
      observedAt: '2026-08-01T12:00:01Z'
    }],
    candidates: [{
      motionId: selectedMotion.id,
      id: targetCandidateId,
      kind: 'person',
      displayLabel: 'Alex Rivera',
      organization: 'Northstar Software',
      role: 'Executive Operations Director',
      commercialRole: 'buyer',
      market: selectedMotion.market,
      publicUrl: targetURL,
      provider: 'people_data_labs_person_search',
      evidenceRefs: [targetEvidenceRef],
      contactPaths: [{
        kind: 'public_professional_url',
        available: true,
        verified: true,
        reference: targetURL
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
  if (normalizedDiscovery.valid !== true) {
    throw new Error(
      `provisional target evidence is invalid: ${JSON.stringify(normalizedDiscovery)}`
    );
  }
  let criticCalls = 0;
  let expectedWinner = null;
  const downstream = await runOpportunityTournament({
    job: {
      id: 'job-provisional-offer-validation',
      kind: 'opportunity_tournament',
      payload: {
        ...job.payload,
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
        commercialDiscoveryEvidence
      }
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      criticCalls += 1;
      if (request.responseFormat?.json_schema?.name !==
          'opportunity_tournament_critic_v1') {
        throw new Error('provisional path dispatched a generator or repair');
      }
      const task = JSON.parse(request.user || '{}');
      const finalists = task.finalists || [];
      const roles = new Set(finalists.flatMap((finalist) =>
        (finalist.evidenceBindings || []).map((binding) => binding.role)
      ));
      if (finalists.length !== 2 ||
          finalists.some((finalist) =>
            finalist.provisionalOfferExperiment !== true
          ) ||
          !roles.has('proposed_paid_offer') ||
          !roles.has('proposed_conversion_destination') ||
          !roles.has('proposed_paid_conversion') ||
          roles.has('paid_offer')) {
        throw new Error(
          `critic lost provisional authority: ${JSON.stringify(task)}`
        );
      }
      expectedWinner = finalists[0];
      return acceptedCriticCompletion(
        finalists,
        'generation-provisional-offer-critic'
      );
    }
  });
  const experiment = downstream.nextExperiment || downstream.result
    ?.nextExperiment;
  const expectedSourceFinalist = downstream.hypotheses?.find((hypothesis) =>
    hypothesis.id === expectedWinner?.finalistId
  );
  if (criticCalls !== 1 ||
      downstream.status !== 'skipped' ||
      downstream.result?.resultType !== 'revenue_evidence_gap' ||
      downstream.result?.incrementalRevenueGate?.currentPaidOffer !== false ||
      downstream.result?.incrementalRevenueGate?.passed === true ||
      experiment?.kind !== 'revenue_path_grounding' ||
      !/^Proposed paid ProfileScribe\b/.test(experiment?.paidOffer || '') ||
      !experiment?.buyer?.includes('Alex Rivera') ||
      !expectedWinner || !expectedSourceFinalist ||
      experiment?.title !== expectedWinner.paidOffer ||
      experiment?.knownFact !== expectedSourceFinalist.proofPoint ||
      experiment?.buyer !== expectedWinner.buyer ||
      experiment?.paidOffer !== expectedWinner.paidOffer ||
      experiment?.acquisitionMechanism !==
        expectedWinner.acquisitionChannel ||
      experiment?.conversionDestination !==
        expectedWinner.revenuePath?.conversionDestination ||
      experiment?.paidConversion !==
        expectedWinner.revenuePath?.incrementalIncomeOutcome ||
      experiment?.paidOutcome !==
        expectedWinner.revenuePath?.incrementalIncomeOutcome ||
      experiment?.attributionSignal !==
        expectedWinner.revenuePath?.attributionSignal ||
      experiment?.stopCondition !==
        expectedWinner.revenuePath?.stopCondition ||
      experiment?.successSignal !==
        expectedWinner.revenuePath?.incrementalIncomeOutcome ||
      experiment?.action !== expectedWinner.primaryAction ||
      JSON.stringify(experiment?.evidenceRefs) !== JSON.stringify(
        expectedSourceFinalist.evidenceRefs.filter((ref) =>
          /^observation:/i.test(ref)
        )
      ) ||
      !experiment?.action?.startsWith('After review via ') ||
      !experiment?.action?.includes('Alex Rivera') ||
      !experiment?.action?.includes('proposed paid') ||
      experiment?.requiresReview !== true ||
      experiment?.rerunPolicy?.maxReruns !== 1 ||
      downstream.gate?.sideEffects?.outreachAttempts !== 0 ||
      downstream.gate?.sideEffects?.publishAttempts !== 0 ||
      downstream.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `provisional offer did not become a safe validation experiment: ${JSON.stringify({ criticCalls, experiment, downstream })}`
    );
  }

  let failedCriticCalls = 0;
  const failedCritic = await runOpportunityTournament({
    job: {
      id: 'job-provisional-offer-critic-provider-failure',
      kind: 'opportunity_tournament',
      payload: {
        ...job.payload,
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
        commercialDiscoveryEvidence
      }
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      failedCriticCalls += 1;
      if (request.responseFormat?.json_schema?.name !==
          'opportunity_tournament_critic_v1') {
        throw new Error('provider-failure fixture dispatched a non-critic call');
      }
      const error = new Error('OpenRouter HTTP 503');
      error.openRouterFailureCode = 'openrouter_http_503';
      error.openRouterDiagnostics = {
        httpStatus: 503,
        providerErrorCode: 'upstream_unavailable',
        providerErrorType: 'upstream_error'
      };
      throw error;
    }
  });
  const failedRecovery = failedCritic.nextExperiment || {};
  const failedReceipt = failedCritic.llm?.commercialCritic || {};
  if (failedCriticCalls !== 1 ||
      failedCritic.status !== 'skipped' ||
      failedCritic.gate?.decision !== 'commercial_critic_failed' ||
      failedCritic.searchSpace?.commercialCritic?.cause !==
        'critic_provider_failure' ||
      failedCritic.searchSpace?.commercialCritic?.attempted !== true ||
      failedCritic.usage?.calls !== 1 ||
      failedCritic.usage?.successfulCalls !== 0 ||
      failedRecovery.kind !==
        'strategy_generation_critic_provider_recovery' ||
      JSON.stringify(failedRecovery.missingEvidence) !==
        JSON.stringify(['commercial_critic_provider_recovery']) ||
      failedReceipt.status !== 'failed' ||
      failedReceipt.error !== 'openrouter_http_503' ||
      failedReceipt.responseDiagnostics?.httpStatus !== 503 ||
      failedCritic.result?.resultType !== 'technical_recovery' ||
      failedCritic.result?.executionAuthorization !== 'none' ||
      failedCritic.gate?.sideEffects?.outreachAttempts !== 0 ||
      failedCritic.gate?.sideEffects?.publishAttempts !== 0 ||
      failedCritic.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `critic provider failure was not cause-matched safely: ${JSON.stringify({ failedCriticCalls, failedRecovery, failedReceipt, failedCritic })}`
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
      name: 'decision-maker canonical subrole missing',
      fixtureIndex: 1,
      mutate(plans) {
        delete plans[0].targetRoleSubrole;
      },
      reason: /supported .*targetRoleSubrole/i
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
    const scenarioPlans = canonicalMaterializedPlannerPlans(
      cases[check.caseIndex || 0].plans(evidenceRef)
    );
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
      model: 'deepseek/deepseek-v4-flash-0731',
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
    // These historical probes deliberately inject the post-materialization
    // shape at the direct transport boundary. Exact local AJV must now stop
    // every such object before any canonicalization or semantic projection;
    // lower-level semantic validators remain covered by schema-valid compact
    // fixtures elsewhere in this smoke.
    if (result.status !== 'blocked' ||
        result.plans.length !== 0 ||
        result.planSelection?.returnedPlanCount !== 0 ||
        result.llm?.discoveryPlanner?.status !== 'completed' ||
        result.usage?.successfulCalls !== 1 ||
        result.normalizationDiagnostic?.code !==
          'strict_schema_mismatch' ||
        result.sideEffectsPerformed !== 0) {
      throw new Error(
        `${check.name} bypassed exact direct-completion validation: ${JSON.stringify(result)}`
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
    return compactFreshPlannerPlans(
      twoPlannerMotions(primary, evidenceRef)
    );
  };
  const runPlanner = (annotations, generationId) =>
    runOpportunityDiscoveryPlanner({
      job: planner,
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async () => ({
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
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
    item.id === 'plan_1_direct_buyer_org_decision_maker'
  );
  if (safePlan.status !== 'planned' || !selectedMotion ||
      safePlan.webSearchReceipt?.provider !==
        'openrouter_exa_web_search' ||
      safePlan.webSearchReceipt?.operation !== 'forced_exa_web_search' ||
      safePlan.webSearchReceipt?.attempted !== false ||
      safePlan.webSearchReceipt?.costIncludedInLLMReceipt !== false ||
      safePlan.webSearchReceipt?.resultCount !== 0 ||
      safePlan.webSearchReceipt?.annotations?.length !== 0 ||
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
    plan: persistedSingleMotionPlan(safePlan, selectedMotion),
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
      model: 'deepseek/deepseek-v4-flash-0731',
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

function verifyCausalPairReservationSurvivesCrowding() {
  const duplicatePath = {
    revenueMechanism: 'paid_booking',
    acquisitionMode: 'partner_channel',
    conversionAction: 'Ask the named partner for one reviewed referral.',
    conversionDestination: 'The verified owner booking page',
    observableRevenueOutcome: 'Paid booking completed; payment received.',
    attributionMethod: 'payment_receipt',
    attributionSignal: 'Receipt stores target and tournament action ids.',
    stopCondition:
      'Stop after 10 attempts, 1 paid outcome, or 14 calendar days.'
  };
  const crowded = Array.from({ length: 24 }, (_, index) => ({
    id: `hyp-crowded-duplicate-${String(index + 1).padStart(2, '0')}`,
    _strategyFamily: index % 2 === 0 ? 'family-a' : 'family-b',
    buyerSegment: 'Nearby parents seeking paid newborn care',
    offer: 'Paid lactation home visit',
    channel: 'One named pediatric referral partner',
    action: 'Ask the named partner for one reviewed referral.',
    timingTrigger: `Current duplicate timing ${index + 1}`,
    proofPoint: `Verified seller proof ${index + 1}`,
    followUp: `No-action research follow-up ${index + 1}`,
    revenuePath: structuredClone(duplicatePath),
    score: {
      total: 0.99 - index * 0.001,
      evidenceStrength: 0.9,
      objectiveFit: 0.9
    }
  }));
  const distinctAlternative = {
    ...structuredClone(crowded[1]),
    id: 'hyp-lower-scoring-distinct-family-b',
    action:
      'Prepare one reviewed co-referral resource for the named partner.',
    score: {
      total: 0.7,
      evidenceStrength: 0.8,
      objectiveFit: 0.8
    }
  };
  crowded.push(distinctAlternative);
  const truncatedWithoutReservation = diverseFinalists(crowded, 20);
  const reserved = diverseFinalists(crowded, 20, {
    reserveDistinctCausalFamilyPair: true
  });
  const criticVisibleSignature = (finalist) => JSON.stringify([
    finalist.buyerSegment,
    finalist.offer,
    finalist.channel,
    finalist.action,
    finalist.revenuePath.revenueMechanism,
    finalist.revenuePath.acquisitionMode,
    finalist.revenuePath.conversionAction,
    finalist.revenuePath.conversionDestination,
    finalist.revenuePath.observableRevenueOutcome,
    finalist.revenuePath.attributionMethod,
    finalist.revenuePath.attributionSignal,
    finalist.revenuePath.stopCondition
  ].map((value) => String(value || '').trim().toLowerCase()));
  const reservedFamilies = new Set(
    reserved.map((finalist) => finalist._strategyFamily)
  );
  const reservedSignatures = new Set(
    reserved.map(criticVisibleSignature)
  );
  if (truncatedWithoutReservation.some((finalist) =>
        finalist.id === distinctAlternative.id
      ) ||
      reserved.length !== 20 ||
      !reserved.some((finalist) =>
        finalist.id === distinctAlternative.id
      ) ||
      reservedFamilies.size !== 2 ||
      reservedSignatures.size < 2) {
    throw new Error(
      `signature-distinct pair was not reserved before finalist truncation: ${JSON.stringify({ truncatedWithoutReservation: truncatedWithoutReservation.map((item) => item.id), reserved: reserved.map((item) => item.id) })}`
    );
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
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const plans = compactFreshPlannerPlans(twoPlannerMotions({
          ...typedScenarioMotion,
          contingentFinalists: compactContingentFinalists(
            typedScenarioMotion.contingentFinalists
          )
        }, evidenceRef));
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const plan of plans) plan.market = exactMarket;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
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
      };
    }
  });
  if (discoveryPlan.status !== 'planned' ||
      discoveryPlan.webSearchReceipt?.provider !==
        'openrouter_exa_web_search' ||
      discoveryPlan.webSearchReceipt?.operation !==
        'forced_exa_web_search' ||
      discoveryPlan.webSearchReceipt?.attempted !== false ||
      discoveryPlan.webSearchReceipt?.costIncludedInLLMReceipt !== false ||
      discoveryPlan.webSearchReceipt?.resultCount !== 0 ||
      discoveryPlan.webSearchReceipt?.annotations?.length !== 0) {
    throw new Error(
      `two-stage planner setup failed: ${JSON.stringify(discoveryPlan)}`
    );
  }
  const selectedMotion = structuredClone(discoveryPlan.plans[0]);
  if (selectedMotion.targetSlot?.finalTargetKind !== 'person' ||
      selectedMotion.targetSlot?.resolutionStrategy !==
        'organization_then_decision_maker' ||
      selectedMotion.professionalRoleQueryContract !==
        'professional_role_query_v2' ||
      selectedMotion.targetRoleSubrole !== 'doctor' ||
      selectedMotion.targetRoleRole !== 'health' ||
      selectedMotion.targetRoleTerms.length !== 0) {
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
  const oneMotionDiscoveryPlan = persistedSingleMotionPlan(
    discoveryPlan,
    selectedMotion
  );
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
  const excessCanonicalAttempts = Array.from({ length: 9 }, (_, index) => ({
    ...braveAttempt,
    id: `attempt-canonical-read-${index + 1}`,
    queryHash: (index + 1).toString(16).repeat(64),
    status: 'not_found',
    resultCount: 0
  }));
  const excessCanonicalEvidence = structuredClone(
    downstreamPayload.commercialDiscoveryEvidence
  );
  excessCanonicalEvidence.attempts = excessCanonicalAttempts;
  excessCanonicalEvidence.providersAttempted = ['brave_web_search'];
  excessCanonicalEvidence.providerCalls = 9;
  excessCanonicalEvidence.paidProviderCalls = 9;
  excessCanonicalEvidence.creditsUsed = 9;
  excessCanonicalEvidence.resultCount = 0;
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
      `nine canonical provider reads escaped the eight-read cap: ${JSON.stringify(excessCanonicalNormalized)}`
    );
  }
  const requests = [];
  const result = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-target-binding',
      kind: 'opportunity_tournament',
      payload: downstreamPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
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
          ...acceptedCriticRouteDiagnostics(),
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
        'https://linkedin.com/in/ava-rivera'
      ) ||
      !result.hypotheses?.[0]?.channel?.includes(
        'https://linkedin.com/in/ava-rivera'
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

  const applyProfessionalTargetIdentity = (
    variantPayload,
    targetName,
    targetURL,
    {
      organizationFactName = 'Riverside Pediatrics',
      targetOrganization = organizationFactName
    } = {}
  ) => {
    const evidence = variantPayload.commercialDiscoveryEvidence.evidence;
    const candidates = variantPayload.commercialDiscoveryEvidence.candidates;
    const organizationFact = evidence.find((item) =>
      item.evidenceRef === organizationEvidenceRef
    );
    const targetFact = evidence.find((item) =>
      item.evidenceRef === personEvidenceRef
    );
    const organizationCandidate = candidates.find((item) =>
      item.id === organizationCandidateId
    );
    const targetCandidate = candidates.find((item) =>
      item.id === targetCandidateId
    );
    organizationFact.label = organizationFactName;
    organizationFact.summary =
      `Brave Web Search returned ${organizationFactName} as the exact public organization from the canonical post-plan query. This independently validates the organization only.`;
    organizationCandidate.displayLabel = organizationFactName;
    organizationCandidate.organization = organizationFactName;
    targetFact.label =
      `${targetName} — Pediatrician at ${targetOrganization}`;
    targetFact.summary =
      `People Data Labs returned ${targetName} as the exact public pediatric professional at ${targetOrganization} after the scoped resume search. This proves public identity only.`;
    targetFact.url = targetURL;
    targetCandidate.displayLabel = targetName;
    targetCandidate.organization = targetOrganization;
    targetCandidate.publicUrl = targetURL;
    targetCandidate.contactPaths[0].reference = targetURL;
    return {
      evidence,
      candidates,
      organizationFact,
      organizationCandidate,
      targetFact,
      targetCandidate
    };
  };

  const padCanonicalAstral = (value, maximumRunes) => {
    const text = String(value || 'A');
    const length = [...text].length;
    if (length > maximumRunes) {
      throw new Error(
        `joint critic fixture seed exceeds ${maximumRunes} runes: ${text}`
      );
    }
    if (length === maximumRunes) return text;
    return `${text} ${'🚀'.repeat(maximumRunes - length - 1)}`;
  };

  const maximizeBoundCriticEnvelope = (variantPayload) => {
    const escapeHeavy = (label, maximumRunes) => padCanonicalAstral(
      `${label} "quoted" \\escaped`,
      maximumRunes
    );
    const boundaryEvidenceRefs = Array.from({ length: 11 }, (_, index) =>
      `observation:${'\\'.repeat(17)}${'😀'.repeat(4)}${String(index).padStart(2, '0')}`
    );
    const objectiveOnlyEvidenceRefs = Array.from(
      { length: 14 },
      (_, index) =>
        `observation:${'\\'.repeat(17)}${'🧭'.repeat(4)}${String(index).padStart(2, '0')}`
    );
    if ([...boundaryEvidenceRefs, ...objectiveOnlyEvidenceRefs].some((ref) =>
      [...ref].length !== 35 ||
      Buffer.byteLength(JSON.stringify(ref), 'utf8') - 2 !== 64
    )) {
      throw new Error('joint critic evidence-reference arithmetic drifted');
    }
    variantPayload.evidenceSnapshot.sourceEvidence.push(
      ...[...boundaryEvidenceRefs, ...objectiveOnlyEvidenceRefs]
        .map((ref, index) => ({
        id: ref,
        observationId: ref,
        evidenceRef: ref,
        sourceId: 'owner-site',
        label: padCanonicalAstral(
          `Current paid referral evidence ${index + 1}`,
          140
        ),
        summary: padCanonicalAstral(
          'Approved current owner evidence grounds the defined buyer paid service booking destination completed payment attribution and reviewed partner referral path',
          180
        ),
        url: `https://owner.example/offer/evidence-${index + 1}`,
        observedAt: now.toISOString(),
        status: 'approved'
      }))
    );
    variantPayload.evidenceSnapshot.sourceEvidence[0].label =
      'Current paid operations workflow consulting service';
    variantPayload.evidenceSnapshot.sourceEvidence[0].summary =
      'Organizations can currently buy the owner paid operations workflow consulting service through the verified owner booking page and completed payments retain attribution.';
    const observationRefs = [evidenceRef, ...boundaryEvidenceRefs];
    const allFamilyEvidence = [
      'target:evidence',
      ...observationRefs,
      PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
    ];
    if (allFamilyEvidence.length !== 14) {
      throw new Error('joint critic family evidence cardinality drifted');
    }
    variantPayload.objective = {
      ...variantPayload.objective,
      id: escapeHeavy('joint critic objective', 48),
      outcome: escapeHeavy(
        'Earn incremental paid income from one reviewed referral',
        120
      ),
      successMetric: escapeHeavy(
        'One attributable completed paid booking within thirty days',
        120
      ),
      allowedChannels: Array.from({ length: 3 }, (_, index) =>
        escapeHeavy(`OC${index + 1}`, 40)
      ),
      allowedActions: Array.from({ length: 3 }, (_, index) =>
        escapeHeavy(`OA${index + 1}`, 48)
      ),
      constraints: Array.from({ length: 3 }, (_, index) =>
        escapeHeavy(`OX${index + 1}`, 64)
      ),
      currency: 'USDXXXXXXXXX',
      targetCount: Number.MAX_SAFE_INTEGER,
      estimatedValueMicros: Number.MAX_SAFE_INTEGER,
      evidenceRefs: objectiveOnlyEvidenceRefs
    };
    variantPayload.commercialContext = {
      ...variantPayload.commercialContext,
      allowedChannels: Array.from({ length: 4 }, (_, index) =>
        escapeHeavy(`CC${index + 1}`, 48)
      ),
      distributionAccounts: Array.from({ length: 4 }, (_, index) => ({
        provider: escapeHeavy(`P${index + 1}`, 48),
        status: 'active',
        mode: escapeHeavy(`M${index + 1}`, 32),
        capabilities: Array.from({ length: 4 }, (_, capabilityIndex) =>
          escapeHeavy(
            `C${index + 1}${capabilityIndex + 1}`,
            48
          )
        )
      })),
      permissionRequired: escapeHeavy('Explicit user approval', 64)
    };
    const motion = variantPayload.commercialDiscoveryEvidence.plan.plans[0];
    const sellerOffer = 'Paid operations workflow consulting service';
    const maximumMarket = padCanonicalAstral(
      'New York professional market',
      120
    );
    motion.motionKind = 'direct_buyer_org_decision_maker';
    motion.commercialRole = 'buyer';
    motion.acquisitionMode = 'permissioned_outreach';
    motion.buyer =
      'Organizations buying paid operations workflow consulting';
    motion.counterparty = 'A professional operations decision maker';
    motion.paidOffer = sellerOffer;
    motion.query =
      `doctor pediatric practice birth center ${maximumMarket}`;
    motion.market = maximumMarket;
    motion.paidConversion = 'One completed paid consulting engagement';
    motion.targetSlot.commercialRole = 'buyer';
    motion.targetSlot.requiredEvidenceRoles = [
      'acquisition',
      'channel_fit',
      'defined_buyer'
    ];
    variantPayload.commercialDiscoveryEvidence.buyerArchetype = motion.buyer;
    variantPayload.commercialDiscoveryEvidence.market = maximumMarket;
    const contextProfile = variantPayload.commercialContext.profile ||
      (variantPayload.commercialContext.profile = {});
    contextProfile.location = maximumMarket;
    contextProfile.serviceAreas = [maximumMarket];
    const evidenceProfile = variantPayload.evidenceSnapshot.profile ||
      (variantPayload.evidenceSnapshot.profile = {});
    evidenceProfile.identity = {
      ...evidenceProfile.identity,
      location: maximumMarket,
      serviceAreas: [maximumMarket]
    };
    for (const item of variantPayload.commercialDiscoveryEvidence.evidence) {
      item.roles = ['acquisition', 'channel_fit', 'defined_buyer'];
    }
    for (const candidate of
      variantPayload.commercialDiscoveryEvidence.candidates) {
      candidate.commercialRole = 'buyer';
      candidate.market = maximumMarket;
    }
    motion.evidenceRefs = [
      ...observationRefs,
      PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
    ];
    for (const [familyIndex, familyKey] of [
      'familyA',
      'familyB'
    ].entries()) {
      const family = motion.contingentFinalists[familyKey];
      const familyLabel = familyIndex === 0 ? 'Alpha' : 'Beta';
      family.m = 'permissioned_outreach';
      family.l = padCanonicalAstral(
        `${familyLabel} paid direct buyer family`,
        140
      );
      family.e = [...allFamilyEvidence];
      for (const [index, item] of family.d.o.entries()) {
        item.l = padCanonicalAstral(
          `${sellerOffer} ${familyLabel} offer ${index + 1}`,
          140
        );
        item.e = [observationRefs[0], observationRefs[1]];
      }
      for (const [index, item] of family.d.b.entries()) {
        item.l = padCanonicalAstral(
          `{{TARGET_NAME}}: Professional buyer of the current paid operations workflow consulting service ${familyLabel} buyer ${index + 1}`,
          140
        );
        item.e = ['target:evidence', observationRefs[0]];
      }
      for (const [index, item] of family.d.c.entries()) {
        item.l = padCanonicalAstral(
          `Review first public professional profile {{TARGET_URL}} for ${familyLabel} buyer channel ${index + 1}`,
          140
        );
        item.e = ['target:evidence', observationRefs[0]];
      }
      for (const [index, item] of family.d.a.entries()) {
        item.l = padCanonicalAstral(
          `After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to buy the current paid operations workflow consulting service through ${familyLabel} action ${index + 1}`,
          260
        );
        item.e = ['target:evidence', observationRefs[0]];
      }
      for (const [index, item] of family.d.t.entries()) {
        item.l = padCanonicalAstral(
          `Current verified target timing ${familyLabel} ${index + 1}`,
          140
        );
        item.q = padCanonicalAstral(
          `Current approved professional timing ${familyLabel} ${index + 1}`,
          140
        );
        item.e = [observationRefs[0], observationRefs[3]];
      }
      for (const [index, item] of family.d.p.entries()) {
        item.l = padCanonicalAstral(
          `Verified seller proof for the current paid service ${familyLabel} ${index + 1}`,
          140
        );
        item.e = [observationRefs[0], observationRefs[4]];
      }
      for (const item of family.d.f) {
        item.e = [observationRefs[0], observationRefs[11]];
      }
      const revenue = family.d.r[0];
      revenue.l = padCanonicalAstral(
        `${sellerOffer} ${familyLabel} attributable payment`,
        140
      );
      revenue.e = [
        ...observationRefs.slice(0, 11),
        PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
      ];
      revenue.io = padCanonicalAstral(
        `One additional paid income outcome from the ${familyLabel} reviewed direct buyer path`,
        180
      );
      revenue.a = 'permissioned_outreach';
      revenue.vm = 1_000_000_000_000;
      revenue.c = family.d.a[0].l;
      revenue.ats = padCanonicalAstral(
        `Payment receipt source field stores the target tournament and ${familyLabel} action identifiers`,
        220
      );
      revenue.cd = padCanonicalAstral(
        `The verified owner booking page for ${familyLabel} paid conversion`,
        180
      );
      revenue.st = padCanonicalAstral(
        'Stop after 10 attempts 1 paid outcome or 14 calendar days whichever comes first',
        180
      );
      revenue.sb = padCanonicalAstral(
        `No attributed ${familyLabel} paid conversion has been observed for this route`,
        180
      );
      revenue.g = {
        b: ['target:evidence', observationRefs[0]],
        o: [observationRefs[0], observationRefs[2]],
        a: ['target:evidence', observationRefs[3]],
        d: {
          l: revenue.cd,
          e: [observationRefs[0], observationRefs[4]]
        },
        c: [observationRefs[0], observationRefs[5]],
        t: [
          PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID,
          observationRefs[6]
        ]
      };
    }
    return {
      boundaryEvidenceRefs,
      objectiveOnlyEvidenceRefs,
      observationRefs,
      maximumMarket
    };
  };

  const runIdentityBindingVariant = async ({
    label,
    targetName,
    targetURL,
    invalidFirst = false,
    configuredChannel = '',
    organizationFactName = 'Riverside Pediatrics',
    targetOrganization = organizationFactName,
    ownerName = '',
    ownerOrganization = '',
    maximizeCriticEnvelope = false
  }) => {
    const variantPayload = structuredClone(downstreamPayload);
    const expectedTargetURL = targetURL.replace(
      'https://www.linkedin.com/in/',
      'https://linkedin.com/in/'
    );
    if (configuredChannel) {
      variantPayload.commercialContext.allowedChannels = [
        configuredChannel
      ];
    }
    const { evidence, candidates, targetFact, targetCandidate } =
      applyProfessionalTargetIdentity(
        variantPayload,
        targetName,
        targetURL,
        { organizationFactName, targetOrganization }
      );
    const maximizedCriticFixture = maximizeCriticEnvelope
      ? maximizeBoundCriticEnvelope(variantPayload)
      : null;
    if (maximizeCriticEnvelope) {
      variantPayload.budget.maxSpendMicros = 147_168;
      variantPayload.budget.maxLLMSpendMicros = 147_168;
      variantPayload.budget.maxOutputTokens = 2_000;
      targetCandidate.role = padCanonicalAstral('Pediatrician', 120);
      const normalizedMaxDiscovery = normalizeCommercialDiscoveryEvidence(
        variantPayload.commercialDiscoveryEvidence,
        now
      );
      if (normalizedMaxDiscovery.valid !== true) {
        throw new Error(
          `joint critic direct-buyer discovery fixture is invalid: ${JSON.stringify(normalizedMaxDiscovery)}`
        );
      }
    }
    if (ownerName || ownerOrganization) {
      const ownerProfile = variantPayload.evidenceSnapshot.profile ||
        (variantPayload.evidenceSnapshot.profile = {});
      ownerProfile.identity = {
        ...ownerProfile.identity,
        ...(ownerName ? { fullName: ownerName } : {})
      };
      if (ownerOrganization) {
        ownerProfile.experience = [{
          company: ownerOrganization,
          current: true
        }];
      }
    }

    if (invalidFirst) {
      const invalidURLPrefix = 'https://www.linkedin.com/in/';
      const invalidURL = `${invalidURLPrefix}${'x'.repeat(
        241 - invalidURLPrefix.length
      )}`;
      const invalidName = `Dr. ${'X'.repeat(177)}`;
      candidates.splice(1, 0, {
        ...structuredClone(targetCandidate),
        id: 'candidate:external:888888888888888888888888',
        displayLabel: invalidName,
        publicUrl: invalidURL,
        // A size-two provider page can return an unusable first record and a
        // valid second record for the same attested query/fact set. The
        // over-limit candidate is discarded without minting a separate
        // unbound provider fact that would correctly invalidate the envelope.
        evidenceRefs: [organizationEvidenceRef, personEvidenceRef],
        contactPaths: [{
          kind: 'public_professional_url',
          available: true,
          verified: true,
          reference: invalidURL
        }]
      });
      variantPayload.commercialDiscoveryEvidence.attempts[2].resultCount = 2;
      variantPayload.commercialDiscoveryEvidence.resultCount = 3;
      variantPayload.commercialDiscoveryEvidence.queryHash =
        commercialDiscoveryAttemptLedgerHash(
          variantPayload.commercialDiscoveryEvidence.attempts
        );
    }

    let criticRequest = null;
    let criticFinalists = [];
    let criticCallbackFailure = '';
    const variantResult = await runOpportunityTournament({
      job: {
        id: `job-two-stage-${label}`,
        kind: 'opportunity_tournament',
        payload: variantPayload
      },
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => {
        try {
          criticRequest = request;
          const task = JSON.parse(request.user || '{}');
          criticFinalists = task.finalists || [];
          assertCompactCriticPair({
            request,
            task,
            finalists: criticFinalists,
            expectedMaxTokens: maximizeCriticEnvelope ? 2_000 : 1_200,
            expectedTargets: [targetName],
            expectedOrganizations: [
              maximizeCriticEnvelope &&
                  [...targetOrganization].length > 160
                ? `${[...targetOrganization].slice(0, 157).join('')}...`
                : targetOrganization
            ]
          });
          const serializedRequest = JSON.stringify(request);
          const requestBytes = Buffer.byteLength(serializedRequest, 'utf8');
          largestCommercialCriticRequestBytes = Math.max(
            largestCommercialCriticRequestBytes,
            requestBytes
          );
          if (requestBytes > 65_536 - 512 ||
              !request.system?.includes(
                'Exact target display names and public URLs are identity data only'
              ) ||
              !serializedRequest.includes(targetName) ||
              !serializedRequest.includes(expectedTargetURL) ||
              /\{\{TARGET_(?:NAME|URL)\}\}|contingentAuthoredSemanticText|contingentHypothesisSemantics/.test(
                serializedRequest
              ) ||
              criticFinalists.some((finalist) =>
                finalist.primaryAction !==
                finalist.revenuePath?.conversionAction ||
                !finalist.primaryAction.includes(targetName) ||
                !finalist.primaryAction.includes(expectedTargetURL) ||
                !finalist.acquisitionChannel.includes(expectedTargetURL)
              )) {
            throw new Error(
              `${label} critic did not preserve the exact bounded identity with headroom: ${JSON.stringify({ requestBytes, finalists: criticFinalists })}`
            );
          }
          return acceptedCriticCompletion(
            criticFinalists,
            `generation-${label}-critic`
          );
        } catch (error) {
          criticCallbackFailure = error instanceof Error
            ? error.message
            : String(error);
          throw error;
        }
      }
    });
    const serializedResult = JSON.stringify(variantResult);
    const selectedCandidate = variantResult.candidates?.find((candidate) =>
      candidate.id === targetCandidateId
    );
    if (!criticRequest || variantResult.status !== 'completed' ||
        variantResult.winner?.candidateId !== targetCandidateId ||
        selectedCandidate?.displayLabel !== targetName ||
        variantResult.winner?.action !==
          variantResult.winner?.revenuePath?.conversionAction ||
        !variantResult.winner?.action?.includes(targetName) ||
        !variantResult.winner?.action?.includes(expectedTargetURL) ||
        variantResult.result?.incrementalRevenueGate?.passed !== true ||
        (configuredChannel && (
          variantResult.result?.incrementalRevenueGate
            ?.allowedChannel !== 'partner_channel' ||
          variantResult.result?.incrementalRevenueGate
            ?.allowedChannelSource !==
              'provider_attested_review_route' ||
          variantResult.result?.incrementalRevenueGate
            ?.discoveryRouteRequiresApproval !== true
        )) ||
        /contingentAuthoredSemanticText|contingentHypothesisSemantics/.test(
          serializedResult
        )) {
      throw new Error(
        `${label} identity binding failed through final acceptance: ${JSON.stringify({ criticCallbackFailure, criticRequestBytes: criticRequest ? Buffer.byteLength(JSON.stringify(criticRequest), 'utf8') : 0, finalistCount: criticFinalists.length, status: variantResult.status, winnerCandidateId: variantResult.winner?.candidateId, selectedCandidateLabel: selectedCandidate?.displayLabel, expectedTargetName: targetName, expectedTargetURL, winnerActionMatchesConversion: variantResult.winner?.action === variantResult.winner?.revenuePath?.conversionAction, winnerNamesTarget: variantResult.winner?.action?.includes(targetName), winnerNamesURL: variantResult.winner?.action?.includes(expectedTargetURL), gate: variantResult.result?.incrementalRevenueGate, candidates: variantResult.candidates, hypotheses: variantResult.hypotheses, critic: variantResult.searchSpace?.commercialCritic, serializedLeaksHiddenState: /contingentAuthoredSemanticText|contingentHypothesisSemantics/.test(serializedResult) })}`
      );
    }
    return {
      request: criticRequest,
      requestBytes: Buffer.byteLength(JSON.stringify(criticRequest), 'utf8'),
      finalists: criticFinalists,
      result: variantResult,
      maximizedCriticFixture
    };
  };

  const linkedInPrefix = 'https://linkedin.com/in/';
  const maxLengthLinkedInURL = `${linkedInPrefix}${'a'.repeat(
    240 - linkedInPrefix.length
  )}`;
  const maxRuneAstralName = `Dr ${'🚀'.repeat(170)} Rivera`;
  if ([...maxRuneAstralName].length !== 180 ||
      maxLengthLinkedInURL.length !== 240) {
    throw new Error('maximum target-binding fixture arithmetic drifted');
  }
  await runIdentityBindingVariant({
    label: 'maximum-astral-identity',
    targetName: maxRuneAstralName,
    targetURL: maxLengthLinkedInURL,
    invalidFirst: true
  });
  const maxRuneAstralOrganization = padCanonicalAstral(
    'Riverside Pediatrics',
    180
  );
  const jointWorstCritic = await runIdentityBindingVariant({
    label: 'joint-worst-commercial-critic-envelope',
    targetName: maxRuneAstralName,
    targetURL: maxLengthLinkedInURL,
    organizationFactName: maxRuneAstralOrganization,
    targetOrganization: maxRuneAstralOrganization,
    maximizeCriticEnvelope: true
  });
  const jointWorstTask = JSON.parse(
    jointWorstCritic.request?.user || '{}'
  );
  const jointWorstFinalists = jointWorstTask.finalists || [];
  const jointWorstBindings = jointWorstFinalists.flatMap((finalist) =>
    finalist.evidenceBindings || []
  );
  const jointWorstBindingRefs = jointWorstBindings.flatMap((binding) =>
    binding.evidenceRefs || []
  );
  const jointWorstAliasRows = jointWorstTask.evidenceRefAliases || [];
  const jointWorstAliases = new Set(jointWorstAliasRows.map((item) =>
    item.alias
  ));
  const allJointWorstAliases = [
    ...(jointWorstTask.objective?.evidenceRefs || []),
    ...jointWorstFinalists.flatMap((finalist) => [
      ...(finalist.evidenceRefs || []),
      ...(finalist.revenuePath?.evidenceRefs || [])
    ]),
    ...jointWorstBindingRefs
  ];
  const exactRunes = (value, length) => [...String(value || '')].length ===
    length;
  if (jointWorstCritic.requestBytes < 45_000 ||
      jointWorstCritic.requestBytes > 65_536 - 512 ||
      65_536 - jointWorstCritic.requestBytes < 512 ||
      jointWorstCritic.request?.maxTokens !== 2_000 ||
      jointWorstFinalists.length !== 2 ||
      !exactRunes(jointWorstTask.objective?.id, 48) ||
      !exactRunes(jointWorstTask.objective?.outcome, 120) ||
      !exactRunes(jointWorstTask.objective?.successMetric, 120) ||
      jointWorstTask.objective?.currency !== 'USDXXXXXXXXX' ||
      jointWorstTask.objective?.targetCount !== Number.MAX_SAFE_INTEGER ||
      jointWorstTask.objective?.estimatedValueMicros !==
        Number.MAX_SAFE_INTEGER ||
      jointWorstTask.objective?.evidenceRefs?.length !== 14 ||
      jointWorstTask.objective?.allowedChannels?.length !== 3 ||
      jointWorstTask.objective.allowedChannels.some((item) =>
        !exactRunes(item, 40)
      ) ||
      jointWorstTask.objective?.allowedActions?.length !== 3 ||
      jointWorstTask.objective.allowedActions.some((item) =>
        !exactRunes(item, 48)
      ) ||
      jointWorstTask.objective?.constraints?.length !== 3 ||
      jointWorstTask.objective.constraints.some((item) =>
        !exactRunes(item, 64)
      ) ||
      jointWorstTask.commercialContext?.allowedChannels?.length !== 4 ||
      jointWorstTask.commercialContext.allowedChannels.some((item) =>
        !exactRunes(item, 48)
      ) ||
      jointWorstTask.commercialContext?.distributionAccounts?.length !== 4 ||
      jointWorstTask.commercialContext.distributionAccounts.some((account) =>
        !exactRunes(account.provider, 48) ||
        account.status !== 'active' ||
        !exactRunes(account.mode, 32) ||
        account.capabilities?.length !== 4 ||
        account.capabilities.some((item) => !exactRunes(item, 48))
      ) ||
      !exactRunes(
        jointWorstTask.commercialContext?.permissionRequired,
        64
      ) ||
      jointWorstFinalists.some((finalist) =>
        [...String(finalist.buyer || '')].length < 300 ||
        [...String(finalist.buyer || '')].length > 320 ||
        !exactRunes(finalist.paidOffer, 140) ||
        [...String(finalist.acquisitionChannel || '')].length < 350 ||
        [...String(finalist.primaryAction || '')].length < 630 ||
        [...String(finalist.primaryAction || '')].length > 700 ||
        finalist.primaryAction !== finalist.revenuePath?.conversionAction ||
        !exactRunes(
          finalist.revenuePath?.incrementalIncomeOutcome,
          180
        ) ||
        !exactRunes(finalist.revenuePath?.attributionSignal, 220) ||
        !exactRunes(finalist.revenuePath?.conversionDestination, 180) ||
        !exactRunes(finalist.revenuePath?.stopCondition, 180) ||
        !exactRunes(finalist.revenuePath?.supportingBottleneck, 180) ||
        finalist.expectedGrossIncomeMicros !== 1_000_000_000_000 ||
        finalist.evidenceRefs?.length !== 15 ||
        finalist.evidenceBindings?.length !== 7 ||
        !exactRunes(
          finalist.evidenceBindings.find((binding) =>
            binding.role === 'exact_outside_target'
          )?.market,
          120
        )
      ) ||
      jointWorstBindingRefs.length < 28 ||
      jointWorstAliasRows.length !== 29 ||
      new Set(jointWorstAliasRows.map((item) => item.evidenceRef)).size !==
        29 ||
      allJointWorstAliases.some((alias) => !jointWorstAliases.has(alias)) ||
      !jointWorstCritic.maximizedCriticFixture?.boundaryEvidenceRefs
        ?.every((ref) => jointWorstAliasRows.some((item) =>
          item.evidenceRef === ref
        )) ||
      !jointWorstCritic.maximizedCriticFixture?.objectiveOnlyEvidenceRefs
        ?.every((ref) => jointWorstAliasRows.some((item) =>
          item.evidenceRef === ref
        )) ||
      jointWorstCritic.maximizedCriticFixture?.boundaryEvidenceRefs
        ?.some((ref) =>
          [...ref].length !== 35 ||
          Buffer.byteLength(JSON.stringify(ref), 'utf8') - 2 !== 64
        ) ||
      /\\ud[89ab][0-9a-f]{2}|\\ud[cdef][0-9a-f]{2}/i.test(
        JSON.stringify(jointWorstCritic.request)
      )) {
    throw new Error(
      `joint-worst critic request did not exercise the complete bounded envelope: ${JSON.stringify({ requestBytes: jointWorstCritic.requestBytes, headroom: 65_536 - jointWorstCritic.requestBytes, objective: jointWorstTask.objective, commercialContext: jointWorstTask.commercialContext, aliasCount: jointWorstAliasRows.length, finalists: jointWorstFinalists.map((finalist) => ({ buyerRunes: [...String(finalist.buyer || '')].length, offerRunes: [...String(finalist.paidOffer || '')].length, channelRunes: [...String(finalist.acquisitionChannel || '')].length, actionRunes: [...String(finalist.primaryAction || '')].length, incrementalRunes: [...String(finalist.revenuePath?.incrementalIncomeOutcome || '')].length, attributionRunes: [...String(finalist.revenuePath?.attributionSignal || '')].length, destinationRunes: [...String(finalist.revenuePath?.conversionDestination || '')].length, stopRunes: [...String(finalist.revenuePath?.stopCondition || '')].length, bottleneckRunes: [...String(finalist.revenuePath?.supportingBottleneck || '')].length, evidenceRefs: finalist.evidenceRefs?.length, revenueEvidenceRefs: finalist.revenuePath?.evidenceRefs?.length, evidenceBindings: finalist.evidenceBindings?.length })), bindingRefCount: jointWorstBindingRefs.length })}`
    );
  }
  const overlimitAstralPayload = structuredClone(downstreamPayload);
  applyProfessionalTargetIdentity(
    overlimitAstralPayload,
    '🚀'.repeat(181),
    'https://www.linkedin.com/in/overlimit-astral'
  );
  let overlimitAstralCalls = 0;
  const overlimitAstralResult = await runOpportunityTournament({
    job: {
      id: 'job-overlimit-astral-provider-identity',
      kind: 'opportunity_tournament',
      payload: overlimitAstralPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => {
      overlimitAstralCalls += 1;
      throw new Error('overlimit astral identity dispatched critic');
    }
  });
  assertTechnicalRecovery(
    overlimitAstralResult,
    overlimitAstralCalls,
    '181-rune provider identity'
  );
  for (const [
    label,
    targetName,
    targetURL,
    configuredChannel = ''
  ] of [
    [
      'free-identity-semantics',
      'Jane Free',
      'https://www.linkedin.com/in/jane-free'
    ],
    [
      'negated-identity-semantics',
      'Dr No Trial',
      'https://www.linkedin.com/in/dr-no-trial'
    ],
    [
      'email-identity-semantics',
      'Email Target',
      'https://www.linkedin.com/in/email',
      'email'
    ],
    [
      'phone-identity-semantics',
      'Phone Partner',
      'https://www.linkedin.com/in/phone-partner'
    ]
  ]) {
    await runIdentityBindingVariant({
      label,
      targetName,
      targetURL,
      configuredChannel
    });
  }

  const unicode17Upper = String.fromCodePoint(0x16ea0);
  const unicode17Lower = String.fromCodePoint(0x16ebb);
  for (const variant of [
    {
      label: 'organization-punctuation-suffix-parity',
      targetName: 'Ava Rivera',
      targetURL: 'https://www.linkedin.com/in/ava-org-suffix',
      organizationFactName: 'Acme-Health Pediatrics',
      targetOrganization: 'Acme Health Pediatrics, Inc.'
    },
    {
      label: 'non-latin-person-and-organization',
      targetName: '李明',
      targetURL: 'https://www.linkedin.com/in/li-ming-public',
      organizationFactName: '青空小児科',
      targetOrganization: '青空小児科, LLC',
      ownerName: '山田太郎',
      ownerOrganization: '別会社'
    },
    {
      label: 'unicode17-one-scalar-person',
      targetName: unicode17Upper,
      targetURL: 'https://www.linkedin.com/in/unicode17-person',
      organizationFactName: '青空小児科',
      targetOrganization: '青空小児科',
      ownerName: unicode17Lower,
      ownerOrganization: '別会社'
    },
    {
      label: 'unicode17-one-scalar-organization',
      targetName: '李明',
      targetURL: 'https://www.linkedin.com/in/unicode17-organization',
      organizationFactName: unicode17Upper,
      targetOrganization: `${unicode17Upper}, LLC`,
      ownerName: '山田太郎',
      ownerOrganization: unicode17Lower
    }
  ]) {
    await runIdentityBindingVariant(variant);
  }

  const fullwidthOwnerPayload = structuredClone(downstreamPayload);
  applyProfessionalTargetIdentity(
    fullwidthOwnerPayload,
    'Acme',
    'https://www.linkedin.com/in/fullwidth-owner'
  );
  fullwidthOwnerPayload.evidenceSnapshot.profile.identity = {
    fullName: 'Ａｃｍｅ'
  };
  let fullwidthOwnerCalls = 0;
  const fullwidthOwner = await runOpportunityTournament({
    job: {
      id: 'job-fullwidth-owner-self-target',
      kind: 'opportunity_tournament',
      payload: fullwidthOwnerPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => {
      fullwidthOwnerCalls += 1;
      throw new Error('fullwidth-equivalent owner reached the critic');
    }
  });
  assertTechnicalRecovery(
    fullwidthOwner,
    fullwidthOwnerCalls,
    'fullwidth-equivalent owner self-target'
  );

  const identityBoundaryPayload = structuredClone(downstreamPayload);
  const identityBoundary = applyProfessionalTargetIdentity(
    identityBoundaryPayload,
    'No',
    'https://www.linkedin.com/in/no-boundary'
  );
  identityBoundary.targetFact.label =
    'Innovation — Pediatrician at Riverside Pediatrics';
  identityBoundary.targetFact.summary =
    'Innovation is a different public pediatric professional record.';
  let identityBoundaryCalls = 0;
  const identityBoundaryResult = await runOpportunityTournament({
    job: {
      id: 'job-ascii-identity-substring-boundary',
      kind: 'opportunity_tournament',
      payload: identityBoundaryPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => {
      identityBoundaryCalls += 1;
      throw new Error('No candidate false-bound inside Innovation');
    }
  });
  assertTechnicalRecovery(
    identityBoundaryResult,
    identityBoundaryCalls,
    'ASCII identity boundary No versus Innovation'
  );

  const privateEmailRoutePayload = structuredClone(downstreamPayload);
  privateEmailRoutePayload.commercialContext.allowedChannels = ['email'];
  applyProfessionalTargetIdentity(
    privateEmailRoutePayload,
    'Email Target',
    'https://www.linkedin.com/in/email'
  );
  for (const familyKey of ['familyA', 'familyB']) {
    const family = privateEmailRoutePayload.commercialDiscoveryEvidence
      .plan.plans[0].contingentFinalists[familyKey];
    family.d.c = family.d.c.map((item) => ({
      ...item,
      l: `${item.l} and use an email route`
    }));
    family.d.a = family.d.a.map((item) => ({
      ...item,
      l: `${item.l} then email the referral request`
    }));
    family.d.r[0].c = family.d.a[0].l;
  }
  let privateEmailRouteCalls = 0;
  const privateEmailRoute = await runOpportunityTournament({
    job: {
      id: 'job-email-identity-with-independent-private-email-route',
      kind: 'opportunity_tournament',
      payload: privateEmailRoutePayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      privateEmailRouteCalls += 1;
      const task = JSON.parse(request.user || '{}');
      return acceptedCriticCompletion(
        task.finalists || [],
        'generation-independent-private-email-route'
      );
    }
  });
  if (privateEmailRouteCalls > 1 ||
      privateEmailRoute.status === 'completed' ||
      privateEmailRoute.result?.resultType ===
        'immediate_revenue_action' ||
      privateEmailRoute.result?.incrementalRevenueGate?.passed === true ||
      privateEmailRoute.result?.incrementalRevenueGate
        ?.allowedChannelSource === 'configured_capability') {
    throw new Error(
      `Email identity erased an independently authored private email route: ${JSON.stringify({ privateEmailRouteCalls, privateEmailRoute })}`
    );
  }

  const invalidStructuralEmailPayload = structuredClone(downstreamPayload);
  invalidStructuralEmailPayload.commercialContext.allowedChannels = [
    'email'
  ];
  const invalidStructuralIdentity = applyProfessionalTargetIdentity(
    invalidStructuralEmailPayload,
    'Email Target',
    'https://www.linkedin.com/in/email'
  );
  invalidStructuralIdentity.targetCandidate.contactPaths[0].verified = false;
  let invalidStructuralEmailCalls = 0;
  const invalidStructuralEmail = await runOpportunityTournament({
    job: {
      id: 'job-invalid-structural-provider-route-with-configured-email',
      kind: 'opportunity_tournament',
      payload: invalidStructuralEmailPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => {
      invalidStructuralEmailCalls += 1;
      throw new Error(
        'invalid structural provider route reached configured-channel authority'
      );
    }
  });
  if (invalidStructuralEmailCalls !== 0 ||
      invalidStructuralEmail.status === 'completed' ||
      invalidStructuralEmail.result?.resultType ===
        'immediate_revenue_action' ||
      invalidStructuralEmail.result?.incrementalRevenueGate?.passed === true ||
      invalidStructuralEmail.result?.incrementalRevenueGate
        ?.allowedChannelSource === 'configured_capability') {
    throw new Error(
      `invalid current provider route fell back to configured email authority: ${JSON.stringify({ invalidStructuralEmailCalls, invalidStructuralEmail })}`
    );
  }

  const unmarkedFoundPayload = structuredClone(downstreamPayload);
  for (const motion of unmarkedFoundPayload.commercialDiscoveryEvidence
    .plan.plans) {
    delete motion.professionalRoleQueryContract;
  }
  let unmarkedFoundCriticCalls = 0;
  const unmarkedFound = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-unmarked-found-plan',
      kind: 'opportunity_tournament',
      payload: unmarkedFoundPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => {
      unmarkedFoundCriticCalls += 1;
      throw new Error('unmarked found plan reached the critic');
    }
  });
  assertTechnicalRecovery(
    unmarkedFound,
    unmarkedFoundCriticCalls,
    'unmarked found professional-role plan'
  );
  if (unmarkedFound.trace?.commercialDiscovery?.plan?.valid !== false ||
      unmarkedFound.searchSpace?.contingentFinalists?.materialized !== false ||
      unmarkedFound.searchSpace?.contingentFinalists?.cause !==
        'invalid_contingent_contract' ||
      !/mixes canonical v2 role fields with a historical professional role query contract/i.test(
        unmarkedFound.searchSpace?.contingentFinalists?.reason || ''
      )) {
    throw new Error(
      `unmarked historical readability leaked into execution authority: ${JSON.stringify(unmarkedFound)}`
    );
  }

  const prunedVariantPayload = structuredClone(downstreamPayload);
  prunedVariantPayload.commercialDiscoveryEvidence.plan.plans[0]
    .contingentFinalists.familyA.d.a[1].l =
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to configure scheduling for the current paid service.';
  const prunedVariantRequests = [];
  let prunedVariantCriticFinalists = [];
  const prunedVariant = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-pruned-operational-variant',
      kind: 'opportunity_tournament',
      payload: prunedVariantPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
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

  const repeatedOptionalPayload = structuredClone(downstreamPayload);
  const repeatedOptionalMotion =
    repeatedOptionalPayload.commercialDiscoveryEvidence.plan.plans[0];
  for (const familyKey of ['familyA', 'familyB']) {
    const family = repeatedOptionalMotion.contingentFinalists[familyKey];
    const retainedAction = family.d.a[0].l;
    family.d.a = family.d.a.map((action) => ({
      ...action,
      l: retainedAction
    }));
    family.d.r[0].c = retainedAction;
  }
  const repeatedOptionalRequests = [];
  let repeatedOptionalFinalists = [];
  const repeatedOptional = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-repeated-optional-actions',
      kind: 'opportunity_tournament',
      payload: repeatedOptionalPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      repeatedOptionalRequests.push(request);
      const task = JSON.parse(request.user || '{}');
      repeatedOptionalFinalists = task.finalists || [];
      assertCompactCriticPair({
        request,
        task,
        finalists: repeatedOptionalFinalists,
        expectedTargets: ['Dr. Ava Rivera']
      });
      return acceptedCriticCompletion(
        repeatedOptionalFinalists,
        'generation-repeated-optional-actions-critic'
      );
    }
  });
  if (repeatedOptionalRequests.length !== 1 ||
      repeatedOptional.status !== 'completed' ||
      repeatedOptional.searchSpace?.dimensionCounts?.actions !== 2 ||
      repeatedOptionalFinalists.length !== 2 ||
      new Set(repeatedOptionalFinalists.map((finalist) =>
        finalist.primaryAction
      )).size !== 2 ||
      repeatedOptional.searchSpace?.commercialCritic
        ?.criticInputFinalistCount !== 2) {
    throw new Error(
      `repeated optional actions did not prune to a distinct critic-visible fallback pair: ${JSON.stringify({ requests: repeatedOptionalRequests.length, finalists: repeatedOptionalFinalists, result: repeatedOptional })}`
    );
  }

  const attributionProofPayload = structuredClone(downstreamPayload);
  const attributionProofMotion =
    attributionProofPayload.commercialDiscoveryEvidence.plan.plans[0];
  for (const familyKey of ['familyA', 'familyB']) {
    const family = attributionProofMotion.contingentFinalists[familyKey];
    family.d.p = family.d.p.map((proof) => ({
      ...proof,
      e: [
        ...proof.e,
        PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
      ]
    }));
  }
  const attributionProof = await runOpportunityTournament({
    job: {
      id: 'job-system-attribution-proof-projection',
      kind: 'opportunity_tournament',
      payload: attributionProofPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const task = JSON.parse(request.user || '{}');
      return acceptedCriticCompletion(
        task.finalists || [],
        'generation-system-attribution-proof-projection'
      );
    }
  });
  if (attributionProof.status !== 'completed' ||
      attributionProof.hypotheses?.length < 2 ||
      attributionProof.hypotheses.some((hypothesis) =>
        Object.entries(hypothesis.provenance?.dimensions || {}).some(
          ([dimension, provenance]) =>
            dimension !== 'revenuePath' &&
            provenance.evidenceRefs?.includes(
              PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
            )
        )
      ) ||
      attributionProof.hypotheses.some((hypothesis) =>
        !hypothesis.provenance?.dimensions?.revenuePath?.evidenceRefs
          ?.includes(
            PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
          )
      )) {
    throw new Error(
      `system attribution was not projected exclusively into revenue-path provenance: ${JSON.stringify(attributionProof)}`
    );
  }

  const collapsedFallbackPayload = structuredClone(repeatedOptionalPayload);
  const collapsedFallbackMotion =
    collapsedFallbackPayload.commercialDiscoveryEvidence.plan.plans[0];
  const collapsedAction =
    collapsedFallbackMotion.contingentFinalists.familyA.d.a[0].l;
  for (const familyKey of ['familyA', 'familyB']) {
    const family = collapsedFallbackMotion.contingentFinalists[familyKey];
    family.d.a = family.d.a.map((action) => ({
      ...action,
      l: collapsedAction
    }));
    family.d.r[0].c = collapsedAction;
  }
  let collapsedFallbackCriticCalls = 0;
  const collapsedFallback = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-collapsed-fallback-actions',
      kind: 'opportunity_tournament',
      payload: collapsedFallbackPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => {
      collapsedFallbackCriticCalls += 1;
      throw new Error('collapsed causal fallback reached the critic');
    }
  });
  assertTechnicalRecovery(
    collapsedFallback,
    collapsedFallbackCriticCalls,
    'collapsed sole-motion causal fallback'
  );

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
    family.d.r[0].c = family.d.a[0].l;
  }
  let conflictingModeCalls = 0;
  const conflictingMode = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-explicit-acquisition-conflict',
      kind: 'opportunity_tournament',
      payload: conflictingModePayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
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
  const firstMotion = canonicalMaterializedPlannerPlans([
    scenario.plans(evidenceRef)[0]
  ])[0];
  firstMotion.priority = 1;
  firstMotion.professionalRoleQueryContract =
    PROFESSIONAL_ROLE_QUERY_CONTRACT;
  firstMotion.targetRoleSubrole = 'doctor';
  firstMotion.targetRoleRole = 'health';
  firstMotion.targetRoleTerms = [];
  firstMotion.organizationTerms = [];
  const secondMotion = structuredClone(selectedMotion);
  secondMotion.priority = 2;
  if (firstMotion.contingentFinalists.familyA.d.a[0].l !==
      secondMotion.contingentFinalists.familyA.d.a[0].l) {
    throw new Error(
      'two-motion fixture must start with the same generic placeholder action so exact target binding proves the richer causal-signature distinction'
    );
  }
  multiMotionPayload.commercialDiscoveryEvidence.plan =
    {
      ...structuredClone(discoveryPlan),
      plans: [firstMotion, secondMotion],
      planSelection: {
        returnedPlanCount: 2,
        acceptedPlanCount: 2,
        rejectedPlanCount: 0,
        rejectedPlans: []
      }
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
    // Two separately attested motions may resolve distinct public identities
    // on the same canonical provider URL. Candidate combination must retain
    // both ID/motion bindings rather than unioning their evidence.
    url: 'https://www.linkedin.com/in/ava-rivera',
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
    publicUrl: 'https://www.linkedin.com/in/ava-rivera',
    provider: 'people_data_labs_person_search',
    evidenceRefs: [firstEvidenceRef],
    contactPaths: [{
      kind: 'public_professional_url',
      available: true,
      verified: true,
      reference: 'https://www.linkedin.com/in/ava-rivera'
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
    model: 'deepseek/deepseek-v4-flash-0731',
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
          ...acceptedCriticRouteDiagnostics(),
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
    model: 'deepseek/deepseek-v4-flash-0731',
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
    model: 'deepseek/deepseek-v4-flash-0731',
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
    model: 'deepseek/deepseek-v4-flash-0731',
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
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async () => {
        calls += 1;
        throw new Error(`${check.label} dispatched an LLM call`);
      }
    });
    assertTechnicalRecovery(rejected, calls, check.label);
  }

  const noTargetPayload = structuredClone(downstreamPayload);
  const noTargetDiscovery = noTargetPayload.commercialDiscoveryEvidence;
  noTargetDiscovery.plan = structuredClone(discoveryPlan);
  const noTargetFirstMotion = noTargetDiscovery.plan.plans[0];
  noTargetFirstMotion.searchMode = 'professional_counterparty';
  noTargetFirstMotion.motionKind = 'referral_person';
  noTargetFirstMotion.professionalRoleQueryContract =
    PROFESSIONAL_ROLE_QUERY_CONTRACT;
  noTargetFirstMotion.targetRoleSubrole = 'partnerships';
  noTargetFirstMotion.targetRoleRole = 'partnerships';
  noTargetFirstMotion.targetRoleTerms = [];
  noTargetFirstMotion.organizationTerms = [];
  noTargetFirstMotion.query = 'partnerships Queens, NY, USA';
  noTargetFirstMotion.targetSlot.finalTargetKind = 'person';
  noTargetFirstMotion.targetSlot.resolutionStrategy =
    'single_exact_target';
  const noTargetSecondMotion = structuredClone(noTargetFirstMotion);
  noTargetSecondMotion.id = 'plan_2_referral_person';
  noTargetSecondMotion.priority = 2;
  noTargetSecondMotion.targetRoleSubrole = 'executive';
  noTargetSecondMotion.targetRoleRole = 'operations';
  noTargetSecondMotion.query = 'executive Queens, NY, USA';
  noTargetDiscovery.plan.plans = [
    noTargetFirstMotion,
    noTargetSecondMotion
  ];
  noTargetDiscovery.plan.planSelection = {
    returnedPlanCount: 2,
    acceptedPlanCount: 2,
    rejectedPlanCount: 0,
    rejectedPlans: []
  };
  delete noTargetDiscovery.plan.rejectedReason;
  const noTargetPlanReceipt = noTargetDiscovery.plan.webSearchReceipt;
  const noTargetPDLProfessionalAttempt = {
    ...braveAttempt,
    id: 'attempt-two-stage-pdl-professional-zero-results',
    provider: 'people_data_labs_person_search',
    operation: 'planned_professional_search',
    status: 'not_found',
    estimatedSpendMicros: 280_000,
    actualSpendMicros: 0,
    creditsUsed: 0,
    resultCount: 0
  };
  const noTargetSecondPDLProfessionalAttempt = {
    ...noTargetPDLProfessionalAttempt,
    id: 'attempt-two-stage-pdl-professional-zero-results-2',
    queryHash: '9'.repeat(64),
    status: 'not_found',
    actualSpendMicros: 0,
    creditsUsed: 0,
    resultCount: 0
  };
  const noTargetAttempts = [
    noTargetPDLProfessionalAttempt,
    noTargetSecondPDLProfessionalAttempt
  ];
  noTargetDiscovery.attempts = noTargetAttempts;
  noTargetDiscovery.providersAttempted = [
    'people_data_labs_person_search'
  ];
  noTargetDiscovery.providerCalls = 2;
  noTargetDiscovery.paidProviderCalls = 2;
  noTargetDiscovery.creditsUsed = 0;
  noTargetPayload.commercialDiscoveryEvidence.queryHash =
    commercialDiscoveryAttemptLedgerHash(noTargetAttempts);
  noTargetPayload.commercialDiscoveryEvidence.status = 'not_found';
  noTargetPayload.commercialDiscoveryEvidence.resultCount = 0;
  noTargetPayload.commercialDiscoveryEvidence.rejectedReasons = {
    provider_zero_results: 2
  };
  noTargetPayload.commercialDiscoveryEvidence.evidence = [];
  noTargetPayload.commercialDiscoveryEvidence.candidates = [];
  const rejectionCaps = {
    citation_not_source_bound: 5,
    citation_motion_ambiguous: 5,
    plan_market_not_grounded: 2,
    provider_zero_results: 2,
    missing_professional_fields: 2,
    role_mismatch: 2,
    organization_mismatch: 2,
    workplace_market_mismatch: 2,
    missing_public_person_identity: 2,
    missing_public_organization_identity: 2,
    previously_contacted: 2
  };
  const normalizedRejections = (rejectedReasons) => {
    const payload = structuredClone(
      noTargetPayload.commercialDiscoveryEvidence
    );
    payload.rejectedReasons = rejectedReasons;
    return normalizeCommercialDiscoveryEvidence(payload, now);
  };
  for (const [reason, cap] of Object.entries(rejectionCaps)) {
    const boundary = normalizedRejections({ [reason]: cap });
    if (boundary.valid !== true ||
        boundary.rejectedReasons?.[reason] !== cap) {
      throw new Error(
        `safe rejection cap drifted for ${reason}: ${JSON.stringify(boundary)}`
      );
    }
    const overflow = normalizedRejections({ [reason]: cap + 1 });
    if (overflow.valid !== false ||
        overflow.rejectedReasons?.invalid_rejection_diagnostic !== 1) {
      throw new Error(
        `rejection overflow escaped for ${reason}: ${JSON.stringify(overflow)}`
      );
    }
  }
  const aggregateBoundary = normalizedRejections({
    citation_not_source_bound: 5,
    citation_motion_ambiguous: 5,
    plan_market_not_grounded: 2
  });
  if (aggregateBoundary.valid !== true) {
    throw new Error(
      `aggregate rejection boundary drifted: ${JSON.stringify(aggregateBoundary)}`
    );
  }
  for (const [label, rejectedReasons] of Object.entries({
    unknown: { provider_raw_payload: 1 },
    fractional: { citation_not_source_bound: 1.5 },
    zero: { citation_not_source_bound: 0 },
    aggregate_overflow: {
      citation_not_source_bound: 5,
      citation_motion_ambiguous: 5,
      plan_market_not_grounded: 2,
      provider_zero_results: 1
    }
  })) {
    const rejected = normalizedRejections(rejectedReasons);
    if (rejected.valid !== false ||
        rejected.rejectedReasons?.invalid_rejection_diagnostic !== 1) {
      throw new Error(
        `${label} rejection diagnostic escaped: ${JSON.stringify(rejected)}`
      );
    }
  }
  let noTargetCalls = 0;
  const noTarget = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-no-grounded-target',
      kind: 'opportunity_tournament',
      payload: noTargetPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
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
  if (noTarget.nextExperiment?.kind !==
        'commercial_discovery_target_resolution_recovery' ||
      noTarget.nextExperiment?.missingEvidence?.[0] !==
        'commercial_discovery_exact_target_resolution' ||
      noTarget.trace?.commercialDiscovery?.status !== 'not_found' ||
      noTarget.trace?.commercialDiscovery?.resultCount !== 0 ||
      noTarget.trace?.commercialDiscovery?.valid !== true ||
      noTarget.trace?.commercialDiscovery?.rejectedReasons
        ?.provider_zero_results !== 2 ||
      noTarget.searchSpace?.contingentFinalists?.cause !==
        'exact_target_not_found') {
    throw new Error(
      `valid provider not-found did not retain its exact cause-matched recovery trace: ${JSON.stringify(noTarget)}`
    );
  }
  const noTargetCapabilityProbe =
    await validateOpportunityCommercialDiscoveryNoTargetEnvelope(
      noTargetPayload.commercialDiscoveryEvidence
    );
  if (noTargetCapabilityProbe.valid !== true ||
      noTargetCapabilityProbe.attemptCount !== 2 ||
      noTargetCapabilityProbe.cause !== 'exact_target_not_found' ||
      noTargetCapabilityProbe.criticCalls !== 0 ||
      noTargetCapabilityProbe.sideEffectsPerformed !== 0) {
    throw new Error(
      `config-free no-target capability probe drifted: ${JSON.stringify(noTargetCapabilityProbe)}`
    );
  }
  for (const [label, mutate] of [
    ['planless envelope', (fixture) => {
      delete fixture.commercialDiscoveryEvidence.plan;
    }],
    ['unmarked current role-query plan', (fixture) => {
      delete fixture.commercialDiscoveryEvidence.plan.plans[0]
        .professionalRoleQueryContract;
    }],
    ['wrong current role-query contract', (fixture) => {
      fixture.commercialDiscoveryEvidence.plan.plans[0]
        .professionalRoleQueryContract = 'professional_role_query_v999';
    }],
    ['unauthorized citation receipt', (fixture) => {
      const receipt = fixture.commercialDiscoveryEvidence.plan
        .webSearchReceipt;
      receipt.annotations = [productionCitation(
        'https://unauthorized.example/target',
        'Unauthorized folded target',
        'This annotation must never acquire authority in a current plan.'
      )];
      receipt.resultCount = 1;
    }],
    ['Brave canonical attempt', (fixture) => {
      fixture.commercialDiscoveryEvidence.attempts[1].provider =
        'brave_web_search';
      fixture.commercialDiscoveryEvidence.attempts[1].operation =
        'planned_brave_web_search';
    }]
  ]) {
    const fixture = structuredClone(noTargetPayload);
    mutate(fixture);
    let rejected = false;
    try {
      await validateOpportunityCommercialDiscoveryNoTargetEnvelope(fixture);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(
        `${label} escaped exact production no-target capability validation`
      );
    }
  }

  const receipt = {
    ...discoveryPlan.webSearchReceipt,
    injectedContextTokenReserve: 950_000,
    attempted: true,
    resultCount: 1,
    estimatedSpendMicros: 5_000,
    costIncludedInLLMReceipt: true,
    includedSpendMicros: 5_000,
    creditsUsed: 1,
    annotations: [productionCitation(
      'https://riverside-pediatrics.example/newborn-care',
      'Riverside Pediatrics newborn care',
      'Riverside Pediatrics is a current pediatric practice serving newborns in Queens.'
    )]
  };
  const historicalFoldedPlan = structuredClone(oneMotionDiscoveryPlan);
  historicalFoldedPlan.webSearchReceipt = structuredClone(receipt);
  const foldedEvidenceRef =
    'external_discovery:555555555555555555555555';
  const successfulFoldedAttempt = {
    ...foldedAttempt,
    status: 'succeeded',
    resultCount: 1
  };
  const foldedCitationEvidence = {
    contractVersion: 'commercial_discovery_evidence_v1',
    attempted: true,
    status: 'found',
    motion: selectedMotion.id,
    buyerArchetype: selectedMotion.buyer,
    queryHash: commercialDiscoveryAttemptLedgerHash([
      successfulFoldedAttempt
    ]),
    market: selectedMotion.market,
    providersAttempted: ['openrouter_exa_web_search'],
    providerCalls: 1,
    paidProviderCalls: 1,
    creditsUsed: 1,
    resultCount: 1,
    patientTargetingExcluded: true,
    sideEffectsPerformed: 0,
    attempts: [successfulFoldedAttempt],
    plan: historicalFoldedPlan,
    evidence: [{
      motionId: selectedMotion.id,
      evidenceRef: foldedEvidenceRef,
      kind: 'verified_external_professional_target',
      label: receipt.annotations[0].title,
      summary: `${receipt.annotations[0].title} is the exact public organization returned by the bounded OpenRouter Exa URL citation.`,
      url: receipt.annotations[0].url,
      provider: 'openrouter_exa_web_search',
      provenance: 'openrouter_exa_url_citation',
      roles: ['acquisition', 'channel_fit', 'prospective_partner'],
      verified: true,
      observedAt: receipt.observedAt
    }],
    candidates: [{
      motionId: selectedMotion.id,
      id: 'candidate:external:666666666666666666666666',
      kind: 'organization',
      displayLabel: receipt.annotations[0].title,
      organization: 'Riverside Pediatrics',
      role: selectedMotion.counterparty,
      commercialRole: selectedMotion.commercialRole,
      market: selectedMotion.market,
      publicUrl: receipt.annotations[0].url,
      provider: 'openrouter_exa_web_search',
      evidenceRefs: [foldedEvidenceRef],
      contactPaths: [],
      exactNamedCandidate: true,
      identityResolved: true
    }],
    discoveredAt: receipt.observedAt
  };
  const foldedDecisionMakerChain = structuredClone(
    downstreamPayload.commercialDiscoveryEvidence
  );
  foldedDecisionMakerChain.plan = structuredClone(historicalFoldedPlan);
  foldedDecisionMakerChain.attempts = [
    successfulFoldedAttempt,
    pdlAttempt
  ];
  foldedDecisionMakerChain.providersAttempted = [
    'openrouter_exa_web_search',
    'people_data_labs_person_search'
  ];
  foldedDecisionMakerChain.providerCalls = 2;
  foldedDecisionMakerChain.paidProviderCalls = 2;
  foldedDecisionMakerChain.creditsUsed = 2;
  foldedDecisionMakerChain.queryHash = commercialDiscoveryAttemptLedgerHash(
    foldedDecisionMakerChain.attempts
  );
  foldedDecisionMakerChain.evidence[0] = {
    ...foldedDecisionMakerChain.evidence[0],
    label: receipt.annotations[0].title,
    summary: `${receipt.annotations[0].title} is the exact public organization returned by the bounded OpenRouter Exa URL citation.`,
    url: receipt.annotations[0].url,
    provider: 'openrouter_exa_web_search',
    provenance: 'openrouter_exa_url_citation',
    observedAt: receipt.observedAt
  };
  foldedDecisionMakerChain.candidates[0] = {
    ...foldedDecisionMakerChain.candidates[0],
    displayLabel: receipt.annotations[0].title,
    publicUrl: receipt.annotations[0].url,
    provider: 'openrouter_exa_web_search'
  };
  const normalizedFoldedDecisionMaker =
    normalizeCommercialDiscoveryEvidence(foldedDecisionMakerChain, now);
  if (normalizedFoldedDecisionMaker.valid !== true ||
      normalizedFoldedDecisionMaker.evidence.length !== 2 ||
      normalizedFoldedDecisionMaker.candidates.length !== 2 ||
      normalizedFoldedDecisionMaker.candidates[1]?.provider !==
        'people_data_labs_person_search') {
    throw new Error(
      `folded Exa organization did not bind through the PDL decision-maker chain: ${JSON.stringify(normalizedFoldedDecisionMaker)}`
    );
  }
  const chainAdversaries = [
    {
      label: 'wrong folded organization provenance',
      mutate(value) {
        value.evidence[0].provenance =
          'read_only_professional_provider';
      }
    },
    {
      label: 'folded organization omits its required role',
      mutate(value) {
        value.evidence[0].roles = ['acquisition', 'channel_fit'];
      }
    },
    {
      label: 'folded organization URL crosses its receipt',
      mutate(value) {
        value.evidence[0].url = 'https://other.example/newborn-care';
        value.candidates[0].publicUrl =
          'https://other.example/newborn-care';
      }
    },
    {
      label: 'PDL person URL crosses its own fact',
      mutate(value) {
        value.candidates[1].publicUrl = receipt.annotations[0].url;
      }
    },
    {
      label: 'plan selection no longer matches persisted motions',
      mutate(value) {
        value.plan.planSelection.acceptedPlanCount += 1;
      }
    },
    {
      label: 'web-search receipt count no longer matches annotations',
      mutate(value) {
        value.plan.webSearchReceipt.resultCount += 1;
      }
    }
  ];
  for (const adversary of chainAdversaries) {
    const value = structuredClone(foldedDecisionMakerChain);
    adversary.mutate(value);
    const normalized = normalizeCommercialDiscoveryEvidence(value, now);
    if (normalized.valid !== false) {
      throw new Error(
        `${adversary.label} escaped the folded decision-maker chain: ${JSON.stringify(normalized)}`
      );
    }
  }
  const normalizedFoldedCitation = normalizeCommercialDiscoveryEvidence(
    foldedCitationEvidence,
    now
  );
  if (normalizedFoldedCitation.valid !== true ||
      normalizedFoldedCitation.attempts[0]?.status !== 'succeeded' ||
      normalizedFoldedCitation.attempts[0]?.resultCount !== 1 ||
      normalizedFoldedCitation.evidence[0]?.provenance !==
        'openrouter_exa_url_citation') {
    throw new Error(
      `source-bound folded Exa citation did not survive normalization: ${JSON.stringify(normalizedFoldedCitation)}`
    );
  }
  let foldedCitationCalls = 0;
  const foldedCitationResult = await runOpportunityTournament({
    job: {
      id: 'job-two-stage-folded-exa-source-binding',
      kind: 'opportunity_tournament',
      payload: {
        ...downstreamPayload,
        commercialDiscoveryEvidence: foldedCitationEvidence
      }
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => {
      foldedCitationCalls += 1;
      throw new Error('intermediate folded citation dispatched a critic');
    }
  });
  assertTechnicalRecovery(
    foldedCitationResult,
    foldedCitationCalls,
    'source-bound folded Exa organization awaiting decision-maker binding'
  );
  if (foldedCitationResult.trace?.commercialDiscovery?.valid !== true ||
      foldedCitationResult.trace?.commercialDiscovery?.status !== 'found' ||
      foldedCitationResult.trace?.commercialDiscovery?.attempts?.[0]
        ?.status !== 'succeeded' ||
      foldedCitationResult.searchSpace?.contingentFinalists?.cause !==
        'target_source_binding_failed') {
    throw new Error(
      `source-bound folded Exa result collapsed into an invalid envelope: ${JSON.stringify(foldedCitationResult)}`
    );
  }

  const foldedAdversaries = [
    {
      label: 'succeeded with zero results',
      mutate(value) {
        value.attempts[0].resultCount = 0;
        value.resultCount = 0;
      }
    },
    {
      label: 'succeeded beyond five-result receipt cap',
      mutate(value) {
        value.attempts[0].resultCount = 6;
        value.resultCount = 6;
      }
    },
    {
      label: 'not-found attempt retaining accepted binding',
      mutate(value) {
        value.attempts[0].status = 'not_found';
        value.attempts[0].resultCount = 0;
      }
    },
    {
      label: 'attempt request hash differs from receipt',
      mutate(value) {
        value.attempts[0].queryHash = 'b'.repeat(64);
      }
    },
    {
      label: 'accepted count differs from candidate count',
      mutate(value) {
        value.attempts[0].resultCount = 2;
        value.resultCount = 2;
      }
    },
    {
      label: 'fact URL absent from receipt annotations',
      mutate(value) {
        value.evidence[0].url = 'https://other.example/public-practice';
        value.candidates[0].publicUrl =
          'https://other.example/public-practice';
      }
    },
    {
      label: 'fact observation differs from receipt',
      mutate(value) {
        value.evidence[0].observedAt = '2026-08-01T12:00:01Z';
      }
    },
    {
      label: 'citation promoted directly to person target',
      mutate(value) {
        value.candidates[0].kind = 'person';
      }
    },
    {
      label: 'missing persisted web-search receipt',
      mutate(value) {
        delete value.plan.webSearchReceipt;
      }
    }
  ];
  for (const adversary of foldedAdversaries) {
    const value = structuredClone(foldedCitationEvidence);
    adversary.mutate(value);
    value.queryHash = commercialDiscoveryAttemptLedgerHash(value.attempts);
    const normalized = normalizeCommercialDiscoveryEvidence(value, now);
    if (normalized.valid !== false) {
      throw new Error(
        `${adversary.label} escaped folded Exa binding checks: ${JSON.stringify(normalized)}`
      );
    }
  }

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
    model: 'deepseek/deepseek-v4-flash-0731',
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
    model: 'deepseek/deepseek-v4-flash-0731',
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
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      const plans = compactFreshPlannerPlans(twoPlannerMotions({
          ...rawMotion,
          contingentFinalists: compactContingentFinalists(
            rawMotion.contingentFinalists
          )
        }, sellerEvidenceRef));
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const plan of plans) plan.market = exactMarket;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
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
      };
    }
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
    provider: 'brave_web_search',
    operation: 'planned_brave_web_search',
    queryHash: 'a'.repeat(64),
    status: 'succeeded',
    estimatedSpendMicros: 5_000,
    actualSpendMicros: 5_000,
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
    'https://linkedin.com/in/jordan-lee-operations';
  const canonicalBuyerPublicUrl =
    'https://linkedin.com/in/jordan-lee-operations';
  const commercialDiscoveryEvidence = {
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
    plan: persistedSingleMotionPlan(discoveryPlan, selectedMotion),
    evidence: [{
      motionId: selectedMotion.id,
      evidenceRef: buyerEvidenceRef,
      kind: 'verified_external_professional_target',
      label:
        'Jordan Lee — Operations Director at Northstar Field Services',
      summary:
        'Brave Web Search returned Jordan Lee as a current Operations Director at Northstar Field Services in the United States. This exact public professional record supports a review-first buyer route only and does not prove interest, permission, or demand.',
      url: buyerPublicUrl,
      provider: 'brave_web_search',
      provenance: 'read_only_professional_provider',
      roles: buyerRoles,
      verified: true,
      observedAt: '2026-08-01T12:00:01Z'
    }],
    candidates: [{
      motionId: selectedMotion.id,
      id: buyerCandidateId,
      kind: 'public_professional',
      displayLabel: 'Jordan Lee',
      organization: 'Northstar Field Services',
      role: 'Operations Director',
      commercialRole: 'buyer',
      market: 'United States',
      publicUrl: buyerPublicUrl,
      provider: 'brave_web_search',
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
      normalizedDiscovery.evidence.length !== 1 ||
      normalizedDiscovery.candidates[0]?.publicUrl !==
        canonicalBuyerPublicUrl) {
    throw new Error(
      `provider-attested Brave buyer evidence fixture is invalid: ${JSON.stringify(normalizedDiscovery)}`
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
    model: 'deepseek/deepseek-v4-flash-0731',
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
      const evidenceRefByAlias = new Map(
        (task.evidenceRefAliases || []).map((item) => [
          item.alias,
          item.evidenceRef
        ])
      );
      const resolvedEvidenceRefs = (refs) => (refs || []).map((ref) =>
        evidenceRefByAlias.get(ref) || ref
      );
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
          target?.kind === 'public_professional' &&
          target?.claim === 'Jordan Lee' &&
          target?.organization === 'Northstar Field Services' &&
          target?.publicUrl === canonicalBuyerPublicUrl &&
          resolvedEvidenceRefs(target?.evidenceRefs).includes(
            buyerEvidenceRef
          ) &&
          resolvedEvidenceRefs(
            byRole.get('defined_buyer')?.evidenceRefs
          ).includes(
            buyerEvidenceRef
          ) &&
          resolvedEvidenceRefs(
            byRole.get('acquisition')?.evidenceRefs
          ).includes(
            buyerEvidenceRef
          ) &&
          resolvedEvidenceRefs(
            byRole.get('paid_offer')?.evidenceRefs
          ).includes(
            sellerEvidenceRef
          ) &&
          resolvedEvidenceRefs(
            byRole.get('conversion_destination')?.evidenceRefs
          ).includes(
            sellerEvidenceRef
          ) &&
          resolvedEvidenceRefs(
            byRole.get('paid_conversion')?.evidenceRefs
          ).includes(
            sellerEvidenceRef
          ) &&
          resolvedEvidenceRefs(
            byRole.get('attribution')?.evidenceRefs
          ).includes(
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
      !result.winner?.action?.includes(canonicalBuyerPublicUrl) ||
      !result.hypotheses?.[0]?.channel?.includes(canonicalBuyerPublicUrl) ||
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
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      publicMessageCalls += 1;
      throw new Error(
        `private LinkedIn message route reached critic: ${JSON.stringify(request)}`
      );
    }
  });
  assertTechnicalRecovery(
    publicMessage,
    publicMessageCalls,
    'private LinkedIn message route on a bound public profile'
  );
  if (!/(?:reserved target syntax|private_contact_route|unsupported)/i.test(
        publicMessage.searchSpace?.contingentFinalists?.reason || ''
      ) ||
      publicMessage.result?.resultType === 'immediate_revenue_action' ||
      publicMessage.result?.incrementalRevenueGate?.passed === true ||
      publicMessage.result?.allowedChannel === 'public_professional_url') {
    throw new Error(
      `private message route escaped finite public-profile binding: ${JSON.stringify({ calls: publicMessageCalls, result: publicMessage })}`
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
    model: 'deepseek/deepseek-v4-flash-0731',
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
    ...[
      [
        'professional path with fragment',
        'https://linkedin.com/in/jordan-lee#about'
      ],
      [
        'professional path with explicit default port',
        'https://linkedin.com:443/in/jordan-lee'
      ],
      [
        'professional path with explicit nondefault port',
        'https://linkedin.com:8443/in/jordan-lee'
      ],
      [
        'professional path with extra segment',
        'https://linkedin.com/in/jordan-lee/details'
      ],
      [
        'professional path with encoded slug',
        'https://linkedin.com/in/%6aordan-lee'
      ],
      [
        'professional path with dot segment',
        'https://linkedin.com/in/ignored/../jordan-lee'
      ],
      [
        'professional path with backslash segment',
        'https://linkedin.com/in\\jordan-lee'
      ]
    ].map(([label, rawURL]) => ({
      label,
      mutate(payload) {
        payload.commercialDiscoveryEvidence.evidence[0].url = rawURL;
        payload.commercialDiscoveryEvidence.candidates[0].publicUrl =
          rawURL;
        payload.commercialDiscoveryEvidence.candidates[0]
          .contactPaths[0].reference = rawURL;
      }
    })),
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
      model: 'deepseek/deepseek-v4-flash-0731',
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
      model: 'deepseek/deepseek-v4-flash-0731',
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
    const family = paidProposalPayload.commercialDiscoveryEvidence.plan
      .plans[0].contingentFinalists[familyKey];
    family.d.a = family.d.a.map((item, index) => ({
          ...item,
          l:
            `After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to buy the current paid subscription by paid proposal route ${familyIndex + 1}-${index + 1}`
        }));
    family.d.r[0].c = family.d.a[0].l;
  }
  let paidProposalCalls = 0;
  const paidProposal = await runOpportunityTournament({
    job: {
      id: 'job-provider-attested-paid-proposal-route',
      kind: 'opportunity_tournament',
      payload: paidProposalPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
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
    acquisitionMode: 'permissioned_outreach',
    acquisitionMechanism:
      'One review-first application to a current compensated job'
  });
  for (const familyKey of ['familyA', 'familyB']) {
    const family = motion.contingentFinalists[familyKey];
    family.d.c = family.d.c.map((item, index) => ({
      ...item,
      l:
        `Review-first official job page at {{TARGET_NAME}} (route ${index + 1})`
    }));
    family.d.a = family.d.a.map((item, index) => ({
      ...item,
      l:
        `After review, submit one compensated application to {{TARGET_NAME}} (${familyKey} route ${index + 1}).`
    }));
    family.d.r[0].c =
      'After review, submit one compensated application to {{TARGET_NAME}} through the official job page.';
    family.d.r[0].cd =
      'The official job application page at {{TARGET_URL}}';
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
    'https://jobs.acme.example/software-engineer';
  const discoveryPlan = await runOpportunityDiscoveryPlanner({
    job: planner,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => ({
      data: {
        contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
        status: 'planned',
        reason: '',
        plans: compactFreshPlannerPlans(
          twoPlannerMotions(motion, evidenceRef)
        )
      },
      usage,
      generationId: 'generation-paid-demand-target-protocol-planner',
      diagnostics: {
        finishReason: 'stop',
        nativeFinishReason: 'stop',
        contentByteCount: 900,
        contentSha256: '4'.repeat(64)
      },
      annotations: []
    })
  });
  if (discoveryPlan.status !== 'planned' ||
      discoveryPlan.plans[0]?.searchMode !== 'active_job_posting' ||
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
    id: 'attempt-paid-demand-canonical-pdl-job-search',
    provider: 'people_data_labs_job_posting_search',
    operation: 'planned_job_posting_search',
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
      providersAttempted: ['people_data_labs_job_posting_search'],
      providerCalls: 1,
      paidProviderCalls: 1,
      creditsUsed: 1,
      resultCount: 1,
      patientTargetingExcluded: true,
      sideEffectsPerformed: 0,
      attempts: [attempt],
      plan: persistedSingleMotionPlan(discoveryPlan, selectedMotion),
      evidence: [{
        motionId: selectedMotion.id,
        evidenceRef: jobEvidenceRef,
        kind: 'verified_external_live_demand',
        label: 'Acme Services Software Engineer',
        summary:
          `Acme Services has a current compensated software engineering job. The official application page is ${demandURL}. One accepted offer can produce salary income.`,
        url: demandURL,
        provider: 'people_data_labs_job_posting_search',
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
        observedAt: '2026-08-01T12:00:00Z'
      }],
      candidates: [{
        motionId: selectedMotion.id,
        id: candidateID,
        kind: 'employer_job_posting',
        // The structured provider attestation fixes this as an employer job
        // posting; organization-like display text cannot retype the record.
        displayLabel: 'Acme Services',
        organization: 'Acme Services',
        role: 'Software Engineer',
        market: 'United States',
        publicUrl: demandURL,
        provider: 'people_data_labs_job_posting_search',
        commercialRole: 'paid_demand',
        evidenceRefs: [jobEvidenceRef],
        contactPaths: [{
          kind: 'application_page',
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
      `candidate-attested remote market with an implied home country was rejected: ${JSON.stringify(normalizedRemoteEvidence)}`
    );
  }

  for (const identity of ['Remote Inc', 'No Remote Inc']) {
    const identityPayload = structuredClone(remoteEvidencePayload);
    identityPayload.evidence[0].label =
      `${identity} Software Engineer`;
    identityPayload.evidence[0].summary =
      `${identity} has a current compensated software engineering job. One accepted offer can produce salary income.`;
    identityPayload.candidates[0].displayLabel = identity;
    identityPayload.candidates[0].organization = identity;
    const normalized = normalizeCommercialDiscoveryEvidence(
      identityPayload,
      now
    );
    if (normalized.valid !== true ||
        normalized.candidates[0]?.market !== 'Remote, New York') {
      throw new Error(
        `provider identity text changed identical typed remote authority for ${identity}: ${JSON.stringify(normalized)}`
      );
    }
  }

  for (const [index, mutateRemoteEvidence] of [
    (payload) => {
      payload.candidates[0].market = '';
    },
    (payload) => {
      payload.candidates[0].market = 'New York, United States';
    },
    (payload) => {
      payload.candidates[0].market = 'Remote, Ontario, Canada';
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
    model: 'deepseek/deepseek-v4-flash-0731',
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
    model: 'deepseek/deepseek-v4-flash-0731',
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
      const evidenceRefByAlias = new Map(
        (task.evidenceRefAliases || []).map((item) => [
          item.alias,
          item.evidenceRef
        ])
      );
      const resolvedEvidenceRefs = (refs) => (refs || []).map((ref) =>
        evidenceRefByAlias.get(ref) || ref
      );
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
          requestBytes > 64 * 1_024 ||
          finalists.some((finalist) =>
            finalist.evidenceBindings?.length !== 7 ||
            finalist.evidenceBindings?.find((binding) =>
              binding.role === 'exact_outside_target'
            )?.kind !== 'employer_job_posting'
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
            ? !resolvedEvidenceRefs(binding.evidenceRefs).includes(
              jobEvidenceRef
            )
            : binding.role === 'attribution' && (
                resolvedEvidenceRefs(binding.evidenceRefs).includes(
                  jobEvidenceRef
                ) ||
                !resolvedEvidenceRefs(binding.evidenceRefs).includes(
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
  const exactCurrentRecommendationProjection = (
    recommendation,
    selected
  ) => {
    const source = result.hypotheses?.find((hypothesis) =>
      hypothesis.id === recommendation?.hypothesisId
    );
    const comparison = result.searchSpace?.commercialCritic?.comparisons
      ?.find((item) =>
        item.finalistId === recommendation?.hypothesisId
      );
    return Boolean(
      recommendation && source && comparison &&
      recommendation.title === source.offer &&
      recommendation.action === source.action &&
      recommendation.why === source.proofPoint &&
      recommendation.whyNow === source.timingTrigger &&
      recommendation.uncertainty === comparison.uncertainty &&
      (selected
        ? recommendation.whyOverRunnerUp === comparison.reason
        : !recommendation.whyOverRunnerUp)
    );
  };
  if (criticIssue ||
      requests.length !== 1 ||
      result.status !== 'completed' ||
      result.usage?.calls !== 1 ||
      result.result?.incrementalRevenueGate?.passed !== true ||
      result.result?.incrementalRevenueGate?.allowedChannelSource !==
        'provider_attested_review_route' ||
      result.result?.allowedChannel !==
        'application_page' ||
      result.result?.permissionRequired !== 'explicit_user_approval' ||
      result.result?.executionAuthorization !== 'none' ||
      result.result?.sideEffectsPerformed !== 0 ||
      result.winner?.candidateId !== candidateID ||
      !exactCurrentRecommendationProjection(result.winner, true) ||
      !exactCurrentRecommendationProjection(result.runnerUp, false) ||
      result.candidates?.find((candidate) =>
        candidate.id === candidateID
      )?.kind !== 'employer_job_posting' ||
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

  const rogueCallerPayload = structuredClone(downstreamPayload);
  const rogueCandidateID =
    'candidate:external:999999999999999999999999';
  const rogueTargetName = 'Rogue Caller Target';
  const rogueTargetURL =
    'https://rogue-caller.example/open-delivery-operations';
  const rogueCollisionCandidateID =
    'candidate:external:aaaaaaaaaaaaaaaaaaaaaaaa';
  rogueCallerPayload.candidates = [{
    motionId: selectedMotion.id,
    commercialDiscoveryMotionId: selectedMotion.id,
    id: rogueCandidateID,
    kind: 'public_paid_demand_page',
    displayLabel: rogueTargetName,
    organization: rogueTargetName,
    role: 'Caller-asserted consulting RFP',
    market: 'United States',
    publicUrl: rogueTargetURL,
    provider: 'brave_web_search',
    providers: ['commercial_discovery_evidence'],
    commercialRole: 'paid_demand',
    evidenceRefs: [jobEvidenceRef],
    contactPaths: [{
      kind: 'public_professional_url',
      available: true,
      verified: true,
      reference: rogueTargetURL
    }],
    exactNamedCandidate: true,
    identityResolved: true,
    providerAttestedCommercialDiscovery: true,
    score: {
      total: 1,
      evidenceStrength: 1,
      objectiveFit: 1
    }
  }, {
    motionId: selectedMotion.id,
    commercialDiscoveryMotionId: selectedMotion.id,
    id: rogueCollisionCandidateID,
    kind: 'public_paid_demand_page',
    displayLabel: 'Rogue Same URL Target',
    organization: 'Rogue Same URL Target',
    role: 'Caller-asserted collision',
    market: 'United States',
    publicUrl: demandURL,
    provider: 'brave_web_search',
    providers: ['commercial_discovery_evidence'],
    commercialRole: 'paid_demand',
    evidenceRefs: [jobEvidenceRef],
    contactPaths: [{
      kind: 'public_professional_url',
      available: true,
      verified: true,
      reference: rogueTargetURL
    }],
    exactNamedCandidate: true,
    identityResolved: true,
    providerAttestedCommercialDiscovery: true
  }];
  let rogueCallerCriticCalls = 0;
  let rogueCallerCriticRequest = null;
  const rogueCallerResult = await runOpportunityTournament({
    job: {
      id: 'job-rogue-caller-provider-candidate',
      kind: 'opportunity_tournament',
      payload: rogueCallerPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      rogueCallerCriticCalls += 1;
      rogueCallerCriticRequest = request;
      const task = JSON.parse(request.user || '{}');
      return acceptedCriticCompletion(
        task.finalists || [],
        'generation-rogue-caller-provider-candidate'
      );
    }
  });
  if (rogueCallerCriticCalls !== 1 ||
      rogueCallerResult.status !== 'completed' ||
      rogueCallerResult.winner?.candidateId !== candidateID ||
      rogueCallerResult.candidates?.some((candidate) =>
        candidate.id === rogueCandidateID ||
        candidate.id === rogueCollisionCandidateID ||
        candidate.displayLabel === rogueTargetName
      ) ||
      JSON.stringify(rogueCallerCriticRequest).includes(rogueTargetName) ||
      JSON.stringify(rogueCallerCriticRequest).includes(rogueTargetURL)) {
    throw new Error(
      `caller-forged provider candidate escaped exact ID/motion attestation: ${JSON.stringify({ rogueCallerCriticCalls, rogueCallerResult })}`
    );
  }

  const runProviderIdentitySemanticVariant = async ({
    label,
    targetName,
    targetURL,
    targetOrganization = targetName,
    negativeSummary = '',
    summaryOverride = '',
    expectRejected = false,
    removeRoles = [],
    invalidProvenance = '',
    envelopeStatus = ''
  }) => {
    const variantPayload = structuredClone(downstreamPayload);
    const discovery = variantPayload.commercialDiscoveryEvidence;
    if (envelopeStatus) discovery.status = envelopeStatus;
    const fact = discovery.evidence[0];
    const candidate = discovery.candidates[0];
    fact.label = `${targetName} open delivery-operations RFP`;
    fact.summary = summaryOverride ||
      `${targetName} currently requests paid delivery-operations consulting proposals. Inbound platform discovery reaches the official proposal page. One accepted proposal can produce a signed paid consulting contract and invoice.${negativeSummary ? ` ${negativeSummary}` : ''}`;
    fact.url = targetURL;
    fact.roles = fact.roles.filter((role) =>
      !removeRoles.includes(role)
    );
    if (invalidProvenance) fact.provenance = invalidProvenance;
    candidate.displayLabel = targetName;
    candidate.organization = targetOrganization;
    candidate.publicUrl = targetURL;
    candidate.contactPaths[0].reference = targetURL;
    let criticCalls = 0;
    let criticRequest = null;
    const variantResult = await runOpportunityTournament({
      job: {
        id: `job-provider-identity-${label}`,
        kind: 'opportunity_tournament',
        payload: variantPayload
      },
      model: 'deepseek/deepseek-v4-flash-0731',
      now,
      completeJSON: async (request) => {
        criticCalls += 1;
        criticRequest = request;
        const task = JSON.parse(request.user || '{}');
        return acceptedCriticCompletion(
          task.finalists || [],
          `generation-provider-identity-${label}`
        );
      }
    });
    const serializedResult = JSON.stringify(variantResult);
    const serializedRequest = JSON.stringify(criticRequest || {});
    if (expectRejected) {
      if (criticCalls !== 0 ||
          variantResult.status === 'completed' ||
          variantResult.result?.resultType ===
            'immediate_revenue_action' ||
          variantResult.result?.incrementalRevenueGate?.passed === true) {
        throw new Error(
          `${label} malformed typed provider attestation reached the critic or final gate: ${JSON.stringify({ criticCalls, variantResult })}`
        );
      }
      return;
    }
    if (criticCalls !== 1 ||
        variantResult.status !== 'completed' ||
        variantResult.winner?.candidateId !== candidateID ||
        !variantResult.winner?.action?.includes(targetName) ||
        variantResult.result?.incrementalRevenueGate?.passed !== true ||
        !serializedRequest.includes(targetName) ||
        !serializedRequest.includes(targetURL) ||
        !variantResult.commercialEvidenceGraph?.nodes?.find((node) =>
          node.evidenceRef === jobEvidenceRef
        )?.label?.includes(targetName) ||
        /commercialDiscoveryEvidenceSemantics|TARGET_IDENTITY/.test(
          `${serializedRequest} ${serializedResult}`
        )) {
      throw new Error(
        `${label} exact provider identity poisoned paid/current semantics or leaked its hidden view: ${JSON.stringify({ criticCalls, variantResult })}`
      );
    }
  };

  for (const [label, targetName, targetURL] of [
    [
      'free-trial-company-name',
      'Free Trial Inc',
      'https://rfp.free-trial-inc.example/open-delivery-operations'
    ],
    [
      'closed-loop-company-name',
      'Closed Loop',
      'https://rfp.closed-loop.example/open-delivery-operations'
    ],
    [
      'inactive-labs-company-name',
      'Inactive Labs',
      'https://rfp.inactive-labs.example/open-delivery-operations'
    ],
    [
      'free-trial-url-slug',
      'Acme Services',
      'https://rfp.acme.example/free-trial/open-delivery-operations'
    ],
    [
      'colon-bearing-provider-identity',
      'Acme: AI Consulting',
      'https://rfp.acme-ai.example/open-delivery-operations'
    ],
    [
      'literal-js-replacement-metasequences',
      ['ACME', '$&', '$$', '$' + '`', "$'", 'Co'].join(' '),
      'https://jobs.example/open?q=$&-$$-$`-$%27'
    ]
  ]) {
    await runProviderIdentitySemanticVariant({
      label,
      targetName,
      targetURL
    });
  }
  await runProviderIdentitySemanticVariant({
    label: 'reserved-target-token-provider-identity',
    targetName: 'Acme {{TARGET_NAME}} Consulting',
    targetURL:
      'https://rfp.acme.example/open-delivery-operations',
    expectRejected: true
  });
  for (const [label, targetURL] of [
    [
      'reserved-name-token-provider-url-query',
      'https://jobs.example/open?q={{TARGET_NAME}}'
    ],
    [
      'reserved-url-token-provider-url-fragment',
      'https://jobs.example/open#{{TARGET_URL}}'
    ],
    [
      'reserved-evidence-token-provider-url-query',
      'https://jobs.example/open?ref=target:evidence'
    ]
  ]) {
    await runProviderIdentitySemanticVariant({
      label,
      targetName: 'Acme Services',
      targetURL,
      expectRejected: true
    });
  }
  await runProviderIdentitySemanticVariant({
    label: 'free-trial-raw-summary-is-nonauthoritative',
    targetName: 'Free Trial Inc',
    targetURL:
      'https://rfp.free-trial-inc.example/open-delivery-operations',
    negativeSummary:
      'The consulting contract is unpaid and offers no compensation.'
  });
  await runProviderIdentitySemanticVariant({
    label: 'same-token-free-raw-prose-is-nonauthoritative',
    targetName: 'Free Consulting',
    targetOrganization: 'Free',
    targetURL: 'https://free-consulting.example/open-role',
    summaryOverride:
      'Free offers a free plan only; the consulting contract has no compensation.'
  });
  await runProviderIdentitySemanticVariant({
    label: 'same-token-no-raw-prose-is-nonauthoritative',
    targetName: 'No Consulting',
    targetOrganization: 'No',
    targetURL: 'https://no-consulting.example/open-role',
    summaryOverride:
      'No has no compensation for this consulting contract.'
  });
  await runProviderIdentitySemanticVariant({
    label: 'repeated-provider-identity-does-not-change-attestation',
    targetName: 'Paid Inc',
    targetURL: 'https://salary.com/checkout',
    summaryOverride:
      'Paid Inc seeks proposals. Opportunity information repeats Paid Inc and links to Paid Inc.'
  });
  await runProviderIdentitySemanticVariant({
    label: 'provider-identity-cannot-invent-missing-paid-role',
    targetName: 'Paid Inc',
    targetURL: 'https://salary.com/checkout',
    summaryOverride:
      'Paid Inc seeks proposals. Opportunity information repeats Paid Inc and links to Paid Inc.',
    removeRoles: ['paid_offer'],
    expectRejected: true
  });
  await runProviderIdentitySemanticVariant({
    label: 'provider-identity-cannot-repair-provenance',
    targetName: 'Paid Inc',
    targetURL: 'https://salary.com/checkout',
    summaryOverride:
      'Paid Inc seeks proposals. Opportunity information repeats Paid Inc and links to Paid Inc.',
    invalidProvenance: 'caller_asserted_provider_result',
    expectRejected: true
  });
  await runProviderIdentitySemanticVariant({
    label: 'provider-identity-cannot-repair-nonfound-status',
    targetName: 'Paid Inc',
    targetURL: 'https://salary.com/checkout',
    summaryOverride:
      'Paid Inc seeks proposals. Opportunity information repeats Paid Inc and links to Paid Inc.',
    envelopeStatus: 'not_found',
    expectRejected: true
  });

  const oneAcceptedWinnerReason =
    'Exact critic rationale: current target, attributable payment, bounded stop.';
  let oneAcceptedCriticCalls = 0;
  const oneAccepted = await runOpportunityTournament({
    job: {
      id: 'job-paid-demand-one-critic-accepted',
      kind: 'opportunity_tournament',
      payload: structuredClone(downstreamPayload)
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      oneAcceptedCriticCalls += 1;
      const task = JSON.parse(request.user || '{}');
      const completion = acceptedCriticCompletion(
        task.finalists || [],
        'generation-paid-demand-one-critic-accepted'
      );
      completion.data.comparisons[0].reason =
        oneAcceptedWinnerReason;
      completion.data.comparisons[0].uncertainty = 'moderate';
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
  const oneAcceptedWinnerSource = oneAccepted.hypotheses?.find(
    (hypothesis) =>
      hypothesis.id === oneAccepted.winner?.hypothesisId
  );
  const oneAcceptedWinnerComparison =
    oneAcceptedCritic?.comparisons?.find((comparison) =>
      comparison.finalistId === oneAccepted.winner?.hypothesisId
    );
  const oneAcceptedWinnerPresentation = JSON.stringify({
    title: oneAccepted.winner?.title,
    action: oneAccepted.winner?.action,
    why: oneAccepted.winner?.why,
    whyNow: oneAccepted.winner?.whyNow,
    whyOverRunnerUp: oneAccepted.winner?.whyOverRunnerUp,
    uncertainty: oneAccepted.winner?.uncertainty
  });
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
      !oneAcceptedWinnerSource ||
      !oneAcceptedWinnerComparison ||
      oneAccepted.winner.title !== oneAcceptedWinnerSource.offer ||
      oneAccepted.winner.action !== oneAcceptedWinnerSource.action ||
      oneAccepted.winner.why !== oneAcceptedWinnerSource.proofPoint ||
      oneAccepted.winner.whyNow !==
        oneAcceptedWinnerSource.timingTrigger ||
      oneAccepted.winner.uncertainty !==
        oneAcceptedWinnerComparison.uncertainty ||
      oneAccepted.winner.uncertainty !== 'moderate' ||
      oneAccepted.winner.whyOverRunnerUp !==
        oneAcceptedWinnerComparison.reason ||
      oneAccepted.winner.whyOverRunnerUp !== oneAcceptedWinnerReason ||
      /Cited evidence:|Incremental-income target:|Timing is unverified;|Source relevance:|The timing remains a hypothesis|No real-world outcome has been observed|The independent commercial critic ranked|prepare only the singular, reviewable next step/i.test(
        oneAcceptedWinnerPresentation
      ) ||
      oneAcceptedCritic?.comparisons?.length !== 2 ||
      oneAcceptedCritic?.acceptedFinalistIds?.length !== 1 ||
      oneAcceptedCritic?.rejectedFinalistCount !== 1 ||
      oneAcceptedCritic?.verdict !== 'accepted' ||
      oneAccepted.result?.incrementalRevenueGate?.passed !== true) {
    throw new Error(
      `one accepted finalist did not preserve the exact finalist/critic recommendation projection: ${JSON.stringify({ calls: oneAcceptedCriticCalls, source: oneAcceptedWinnerSource, comparison: oneAcceptedWinnerComparison, result: oneAccepted })}`
    );
  }

  const selectedRejectedReason =
    'The selected finalist still lacks model-observed proof that this exact paid-demand route will convert.';
  const topLevelRejectedReason =
    'Both finalists remain too uncertain for acceptance.';
  let allRejectedCriticCalls = 0;
  const allRejected = await runOpportunityTournament({
    job: {
      id: 'job-paid-demand-critic-all-rejected',
      kind: 'opportunity_tournament',
      payload: structuredClone(downstreamPayload)
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      allRejectedCriticCalls += 1;
      const task = JSON.parse(request.user || '{}');
      const completion = acceptedCriticCompletion(
        task.finalists || [],
        'generation-paid-demand-critic-all-rejected'
      );
      completion.data.reason = topLevelRejectedReason;
      for (const [index, comparison] of
        completion.data.comparisons.entries()) {
        comparison.verdict = 'reject';
        comparison.activeRevenueAction = false;
        comparison.causalAcquisitionPath = false;
        comparison.incrementalRevenueOutcome = false;
        comparison.reasonCode = 'unsupported_evidence';
        comparison.reason = index === 0
          ? selectedRejectedReason
          : 'The alternate finalist also lacks sufficient exact conversion proof.';
      }
      return completion;
    }
  });
  const allRejectedSource = allRejected.hypotheses?.[0] || {};
  const allRejectedExperiment = allRejected.nextExperiment || {};
  const allRejectedBottleneck =
    allRejectedSource.revenuePath?.supportingBottleneck;
  if (allRejectedCriticCalls !== 1 ||
      allRejected.status !== 'skipped' ||
      allRejected.hypotheses?.length !== 2 ||
      allRejected.hypotheses.some((hypothesis) =>
        hypothesis.status !== 'critic_rejected'
      ) ||
      !allRejectedBottleneck ||
      allRejectedSource.judgeReason === selectedRejectedReason ||
      allRejectedExperiment.kind !== 'revenue_path_grounding' ||
      JSON.stringify(allRejectedExperiment.missingEvidence) !==
        JSON.stringify([allRejectedBottleneck]) ||
      allRejectedExperiment.missingEvidence?.includes(
        topLevelRejectedReason
      ) ||
      allRejectedExperiment.missingEvidence?.includes(
        selectedRejectedReason
      ) ||
      allRejectedExperiment.title !== allRejectedSource.offer ||
      allRejectedExperiment.knownFact !== allRejectedSource.proofPoint ||
      allRejectedExperiment.buyer !== allRejectedSource.buyerSegment ||
      allRejectedExperiment.paidOffer !== allRejectedSource.offer ||
      allRejectedExperiment.acquisitionMechanism !==
        allRejectedSource.channel ||
      allRejectedExperiment.action !== allRejectedSource.action ||
      allRejectedExperiment.paidConversion !==
        allRejectedSource.revenuePath?.incrementalIncomeOutcome ||
      allRejectedExperiment.paidOutcome !==
        allRejectedSource.revenuePath?.incrementalIncomeOutcome ||
      allRejectedExperiment.successSignal !==
        allRejectedSource.revenuePath?.incrementalIncomeOutcome ||
      allRejectedExperiment.stopCondition !==
        allRejectedSource.revenuePath?.stopCondition ||
      JSON.stringify(allRejectedExperiment.evidenceRefs) !== JSON.stringify(
        allRejectedSource.evidenceRefs?.filter((ref) =>
          /^observation:/i.test(ref)
        )
      )) {
    throw new Error(
      `all-reject critic result did not preserve the source finalist's authored revenue path: ${JSON.stringify({ calls: allRejectedCriticCalls, result: allRejected })}`
    );
  }

  const emptyBottleneckPayload = structuredClone(downstreamPayload);
  for (const familyKey of ['familyA', 'familyB']) {
    emptyBottleneckPayload.commercialDiscoveryEvidence.plan.plans[0]
      .contingentFinalists[familyKey].d.r[0].sb = '';
  }
  let emptyBottleneckCriticCalls = 0;
  const emptyBottleneck = await runOpportunityTournament({
    job: {
      id: 'job-paid-demand-no-actionable-empty-bottleneck',
      kind: 'opportunity_tournament',
      payload: emptyBottleneckPayload
    },
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      emptyBottleneckCriticCalls += 1;
      const task = JSON.parse(request.user || '{}');
      return acceptedCriticCompletion(
        task.finalists || [],
        'generation-paid-demand-no-actionable-empty-bottleneck'
      );
    }
  });
  if (emptyBottleneckCriticCalls !== 0 ||
      emptyBottleneck.status !== 'skipped' ||
      emptyBottleneck.hypotheses?.length !== 0 ||
      emptyBottleneck.nextExperiment?.kind !==
        'commercial_discovery_contract_recovery' ||
      JSON.stringify(emptyBottleneck.nextExperiment?.missingEvidence) !==
        JSON.stringify(['commercial_discovery_contract_validation']) ||
      emptyBottleneck.result?.resultType !== 'technical_recovery' ||
      emptyBottleneck.nextExperiment?.missingEvidence?.some((value) =>
        value === emptyBottleneck.searchSpace?.commercialCritic?.reason
      )) {
    throw new Error(
      `empty authored bottleneck was replaced with critic prose after no actionable target: ${JSON.stringify({ calls: emptyBottleneckCriticCalls, result: emptyBottleneck })}`
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
    model: 'openai/gpt-5.6-luna',
    now,
    completeJSON: async (request) => {
      requestSeen = request;
      const productionMotion = cases[0].plans(evidenceRef)[0];
      productionMotion.market =
        'New York, New York, United States';
      productionMotion.contingentFinalists = compactContingentFinalists(
        productionMotion.contingentFinalists
      );
      const plans = compactFreshPlannerPlans(
        twoPlannerMotions(productionMotion, evidenceRef)
      );
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const plan of plans) plan.market = exactMarket;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage,
        generationId: 'generation-production-shaped-headroom',
        diagnostics: {
          ...acceptedCurrentLunaRouteDiagnostics(),
          finishReason: 'stop',
          nativeFinishReason: 'completed',
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
      requestBytes > result.preflight?.providerPromptEnvelope
        ?.targetRequestBodyByteCount ||
      result.preflight?.providerPromptEnvelope
        ?.actualSoftHeadroomByteCount < 512 ||
      result.preflight?.maxRequestBodyByteCount !== 44 * 1_024) {
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
    model: 'openai/gpt-5.6-luna',
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
      const plans = compactFreshPlannerPlans(
        twoPlannerMotions(productionMotion, evidenceRef)
      );
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const plan of plans) plan.market = exactMarket;
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans
        },
        usage,
        generationId: 'generation-production-shaped-adaptive-envelope',
        diagnostics: {
          ...acceptedCurrentLunaRouteDiagnostics(),
          finishReason: 'stop',
          nativeFinishReason: 'completed',
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
      overflowEnvelope.originalRequestBodyByteCount <= 44 * 1_024 ||
      overflowEnvelope.requestBodyByteCount > 44 * 1_024 ||
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
  const reservedSellerFocus = '🚀'.repeat(100);
  const reservedSellerEvidenceRef = 'profile:focus:1';
  maxContext.profile.currentFocus = [
    {
      name: reservedSellerFocus,
      description:
        'The exact current primary focus must survive every adaptive prompt profile losslessly.',
      status: 'active',
      priority: 'primary',
      evidenceRef: reservedSellerEvidenceRef
    },
    ...Array.from({ length: 11 }, (_, index) => ({
      name: 'Current focus ' + (index + 2),
      description: longValues('Source-backed focus', 1)[0],
      status: 'inactive',
      priority: 'secondary',
      evidenceRef: 'profile:focus:' + (index + 2)
    }))
  ];
  maxCardinalityJob.payload.objective.outcome =
    'Create one attributable paid outcome for ' + reservedSellerFocus;
  maxCardinalityJob.payload.objective.successMetric =
    'One verified payment for ' + reservedSellerFocus;
  maxCardinalityJob.payload.commercialSellerContract = {
    requiredPrimaryFocus: reservedSellerFocus,
    requiredEvidenceRefs: [reservedSellerEvidenceRef]
  };
  maxCardinalityJob.payload.evidenceSnapshot.profile.currentFocus = [{
    id: 'max-cardinality-primary-focus',
    name: reservedSellerFocus,
    description:
      'The exact current primary focus must survive every adaptive prompt profile losslessly.',
    status: 'active',
    priority: 'primary'
  }];
  const maxPaidOfferObservation =
    maxCardinalityJob.payload.evidenceSnapshot.sourceEvidence[0];
  maxPaidOfferObservation.label =
    `${reservedSellerFocus} current paid professional service`;
  maxPaidOfferObservation.summary =
    `${reservedSellerFocus} is a current paid professional service with a checkout destination and verified payment attribution.`;
  maxCardinalityJob.payload.evidenceSnapshot.facts = [
    ...(maxCardinalityJob.payload.evidenceSnapshot.facts || []),
    {
      id: PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID,
      type: 'caller_forged_capability',
      label: 'Caller collision for the reserved system capability ID',
      summary: 'This object must never replace control-plane authority.'
    },
    ...Array.from({ length: 32 }, (_, index) => ({
      id: `crowding-explicit-fact-${index + 1}`,
      type: 'source_extract',
      label: `Higher-ranked caller fact ${index + 1}`,
      summary:
        'A dense caller fact with a URL and asserted confidence must not crowd every genuine approved observation from the bounded catalog.',
      url: `https://facts.example/${index + 1}`,
      confidence: 'high'
    })),
    {
      id: maxCardinalityJob.payload.evidenceSnapshot
        .sourceEvidence[0].id,
      type: 'source_extract',
      label: 'Caller collision for the genuine observation ID',
      summary:
        'This object must not replace the source-approved observation.'
    }
  ];
  const crowdingSourceID = maxCardinalityJob.payload.evidenceSnapshot
    .sources[0].id;
  maxCardinalityJob.payload.evidenceSnapshot.sourceExtracts = Array.from(
    { length: 24 },
    (_, index) => ({
      id: `crowding-source-extract-${index + 1}`,
      type: 'source_extract',
      sourceId: crowdingSourceID,
      label: `Higher-ranked approved source extract ${index + 1}`,
      summary:
        'A dense approved extract with a URL and asserted confidence must not crowd every genuine approved observation from the bounded catalog.',
      url: `https://owner.example/crowding/extract/${index + 1}`,
      confidence: 'high'
    })
  );
  const crowdingProfile = maxCardinalityJob.payload.evidenceSnapshot.profile;
  crowdingProfile.experience = Array.from({ length: 12 }, (_, index) => ({
    id: `crowding-experience-${index + 1}`,
    type: 'source_extract',
    role: `Verified role ${index + 1}`,
    company: `Verified organization ${index + 1}`,
    description:
      'A high-ranked current experience entry used only to exercise the outer evidence-catalog cardinality boundary.',
    url: `https://owner.example/crowding/experience/${index + 1}`,
    confidence: 'high',
    current: true
  }));
  crowdingProfile.projects = Array.from({ length: 12 }, (_, index) => ({
    id: `crowding-project-${index + 1}`,
    type: 'source_extract',
    name: `Verified project ${index + 1}`,
    description:
      'A high-ranked project entry used only to exercise the outer evidence-catalog cardinality boundary.',
    url: `https://owner.example/crowding/project/${index + 1}`,
    confidence: 'high'
  }));
  for (let index = 1; index < 3; index += 1) {
    const item = maxCardinalityJob.payload.evidenceSnapshot
      .sourceEvidence[index];
    item.label =
      'Attribution article ' + (index + 1) +
      ' with broad source-field language';
    item.summary =
      'Article ' + (index + 1) +
      ' discusses attribution, campaign source fields, CRM records, and payment receipts without being the ProfileScribe system capability.';
  }
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
  const maxOuterCatalog = buildEvidenceCatalog(
    maxCardinalityJob.payload,
    {},
    now,
    { includeSystemAttributionCapability: true }
  );
  const outerReservedObservation = maxOuterCatalog.find((item) =>
    /^observation:/i.test(item.id || '') &&
    item.approvedSourceObservation === true
  );
  if (maxOuterCatalog.length !== 64 ||
      !outerReservedObservation ||
      !outerReservedObservation.sourceId ||
      !outerReservedObservation.approvedSourceUrl ||
      maxOuterCatalog.find((item) =>
        item.id === PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
      )?.verifiedSystemCapability !== true) {
    throw new Error(
      `outer evidence catalog did not reserve genuine system and observation authority across its 64-item cap: ${JSON.stringify(maxOuterCatalog)}`
    );
  }
  let maxCardinalityRequestSeen;
  let maxCardinalityCalls = 0;
  const maxCardinalityResult = await runOpportunityDiscoveryPlanner({
    job: maxCardinalityJob,
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async (request) => {
      maxCardinalityCalls += 1;
      maxCardinalityRequestSeen = request;
      const productionMotion = cases[0].plans(
        outerReservedObservation.id
      )[0];
      productionMotion.market = 'New York, New York, United States';
      productionMotion.paidOffer =
        reservedSellerFocus + ' paid professional service';
      productionMotion.contingentFinalists = compactContingentFinalists(
        productionMotion.contingentFinalists
      );
      const responsePlans = compactFreshPlannerPlans(twoPlannerMotions(
        productionMotion,
        outerReservedObservation.id
      ));
      const exactMarket = request.responseFormat?.json_schema?.schema
        ?.properties?.plans?.items?.properties?.market?.enum?.[0];
      for (const motion of responsePlans) {
        motion.market = exactMarket;
        motion.paidOffer.seller =
          reservedSellerFocus + ' paid professional service';
      }
      return {
        data: {
          contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
          status: 'planned',
          reason: '',
          plans: responsePlans
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
  const reservedSellerPromptEvidence = maxPrompt.evidenceCatalog?.find(
    (item) => item.id === reservedSellerEvidenceRef
  );
  const reservedSystemPromptEvidence = maxPrompt.evidenceCatalog?.find(
    (item) => item.id ===
      PROFILESCRIBE_SYSTEM_ATTRIBUTION_CAPABILITY_EVIDENCE_ID
  );
  const reservedObservationPromptEvidence = maxPrompt.evidenceCatalog?.find(
    (item) => /^observation:/i.test(item.id || '') &&
      item.approvedSourceObservation === true
  );
  const attemptsStrictlyDecrease = maxAttempts.every(
    (attempt, index) => index === 0 ||
      attempt.requestBodyByteCount <
        maxAttempts[index - 1].requestBodyByteCount
  );
  if (maxCardinalityCalls !== 1 ||
      maxCardinalityResult.status !== 'planned' ||
      maxEnvelope.profile !== 'essential' ||
      maxEnvelope.originalRequestBodyByteCount <= 44 * 1_024 ||
      maxEnvelope.requestBodyByteCount > 44 * 1_024 ||
      maxAttempts.length !== 4 ||
      maxAttempts.some((attempt) =>
        attempt.authoritativeEvidenceReservationValid !== true ||
        attempt.authoritativeEvidenceReservationIssue
      ) ||
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
      maxPrompt.sellerContract?.requiredPrimaryFocus !==
        reservedSellerFocus ||
      JSON.stringify(maxPrompt.sellerContract?.requiredEvidenceRefs) !==
        JSON.stringify([reservedSellerEvidenceRef]) ||
      reservedSellerPromptEvidence?.type !== 'current_focus' ||
      reservedSellerPromptEvidence?.label !== reservedSellerFocus ||
      reservedSellerPromptEvidence?.status !== 'active' ||
      reservedSellerPromptEvidence?.priority !== 'primary' ||
      reservedSystemPromptEvidence?.type !==
        'profilescribe_system_attribution_capability' ||
      reservedSystemPromptEvidence?.verifiedSystemCapability !== true ||
      reservedSystemPromptEvidence?.systemCapabilitySource !==
        'profilescribe_control_plane' ||
      reservedSystemPromptEvidence?.systemCapabilityProvenance !==
        'verified_system_capability' ||
      JSON.stringify(
        reservedSystemPromptEvidence?.systemCapabilityRoles
      ) !== JSON.stringify(['attribution']) ||
      !reservedObservationPromptEvidence ||
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
  const experiment = result.nextExperiment || {};
  const acceptedKinds = new Set([
    'commercial_discovery_provider_recovery',
    'commercial_discovery_target_resolution_recovery',
    'commercial_discovery_target_binding_recovery',
    'commercial_discovery_contract_recovery',
    'strategy_generation_shape_recovery'
  ]);
  if (calls !== 0 ||
      result.status !== 'skipped' ||
      result.gate?.decision !== 'technical_recovery' ||
      result.result?.resultType !== 'technical_recovery' ||
      !acceptedKinds.has(experiment.kind) ||
      experiment.contractVersion !== 'revenue_evidence_experiment_v1' ||
      experiment.requiresReview !== true ||
      experiment.rerunPolicy?.maxReruns !== 1 ||
      !Array.isArray(experiment.missingEvidence) ||
      experiment.missingEvidence.length !== 1 ||
      result.result?.recommendedAction !== experiment.action ||
      result.usage?.calls !== 0 ||
      result.gate?.sideEffects?.outreachAttempts !== 0 ||
      result.gate?.sideEffects?.publishAttempts !== 0 ||
      result.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(
      `${label} did not fail closed as technical recovery: ${JSON.stringify({ calls, result })}`
    );
  }
  const finalistIssue = result.searchSpace?.commercialCritic?.cause;
  if (experiment.kind === 'strategy_generation_shape_recovery' &&
      ['insufficient_grounded_finalists',
        'insufficient_deterministic_finalists'].includes(finalistIssue) &&
      (result.searchSpace?.structuredRepair?.failure !==
        'upstream_contingent_finalists_rejected' ||
       result.searchSpace?.structuredRepair?.finalIssue !== finalistIssue ||
       result.searchSpace?.structuredRepair?.attempted !== false ||
       result.searchSpace?.commercialCritic?.attempted !== false)) {
    throw new Error(
      `${label} lost its cause-matched rejected-finalist trace: ${JSON.stringify(result)}`
    );
  }
}

function assertCompactCriticPair({
  request,
  task,
  finalists,
  expectedTargets,
  expectedMaxTokens = 1_200,
  expectedOrganizations = [
    'Riverside Pediatrics',
    'Summit Pediatrics'
  ]
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
  const causalSignatures = new Set(finalists.map((finalist) => {
    const path = finalist.revenuePath || {};
    return JSON.stringify([
      finalist.buyer,
      finalist.paidOffer,
      finalist.acquisitionChannel,
      finalist.primaryAction,
      path.revenueMechanism,
      path.acquisitionMode,
      path.conversionAction,
      path.conversionDestination,
      path.observableRevenueOutcome,
      path.attributionMethod,
      path.attributionSignal,
      path.stopCondition
    ].map((value) => String(value || '').trim().toLowerCase()));
  }));
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
    return target?.kind === 'person' &&
      expectedOrganizations.includes(target.organization);
  });
  const selectedActionsAreExactRevenueActions = finalists.every(
    (finalist) => finalist.primaryAction ===
      finalist.revenuePath?.conversionAction
  );
  const userText = request.user || '';
  const responseSchema = request.responseFormat?.json_schema?.schema;
  const privateContactLeaked =
    /(?:contactPaths|mailto:|tel:|sms:|work_email|mobile_phone|phone_numbers|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.test(
      userText
    );
  const requestBytes = Buffer.byteLength(JSON.stringify(request), 'utf8');
  if (finalists.length !== 2 ||
      families.size !== 2 ||
      causalSignatures.size !== 2 ||
      task.contextMode !== 'bound_family_diverse_pair_v1' ||
      task.executionPolicy?.executionAuthorization !== 'none' ||
      task.executionPolicy?.requiresReview !== true ||
      task.executionPolicy?.sideEffectsPerformed !== 0 ||
      request.maxTokens !== expectedMaxTokens ||
      request.timeoutMs !== 120_000 ||
      request.stream !== undefined ||
      JSON.stringify(request.plugins) !==
        JSON.stringify([{ id: 'response-healing' }]) ||
      responseSchema?.properties?.comparisons?.maxItems !== 2 ||
      responseSchema?.properties?.comparisons?.items?.properties?.reason
        ?.maxLength !== 240 ||
      responseSchema?.properties?.selectedOrdering?.maxItems !== 2 ||
      responseSchema?.properties?.reason?.maxLength !== 360 ||
      requestBytes > 64 * 1_024 ||
      !everyRoleIsBound ||
      !targetBindingsArePublic ||
      !selectedActionsAreExactRevenueActions ||
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
      ...acceptedCriticRouteDiagnostics(),
      finishReason: 'stop',
      nativeFinishReason: 'stop',
      contentByteCount: 700,
      contentSha256: '8'.repeat(64)
    }
  };
}

function acceptedCriticRouteDiagnostics() {
  return {
    httpStatus: 200,
    routerStrategy: 'direct',
    routerAttempt: 1,
    routerCandidateCount: 1,
    routerAttemptStatuses: [200],
    routerAttempts: [{
      provider: 'Fixture Provider',
      model: 'deepseek/deepseek-v4-flash-0731',
      status: 200
    }],
    routerAttemptSequenceSource: 'reported',
    routerSelectedEndpointEvidenced: true,
    routerSelectedProvider: 'Fixture Provider',
    routerSelectedModel: 'deepseek/deepseek-v4-flash-0731'
  };
}

function acceptedCurrentLunaRouteDiagnostics() {
  return {
    httpStatus: 200,
    routerStrategy: 'direct',
    routerAttempt: 1,
    // This is endpoint-catalog metadata, not an allowlist cardinality.
    routerCandidateCount: 10,
    routerAttemptStatuses: [200],
    routerAttempts: [{
      provider: 'OpenAI',
      model: 'openai/gpt-5.6-luna-20260709',
      status: 200
    }],
    routerAttemptSequenceSource: 'reported',
    routerSelectedEndpointEvidenced: true,
    routerFallbackUsed: false,
    routerSelectedProvider: 'OpenAI',
    routerSelectedModel: 'openai/gpt-5.6-luna-20260709',
    routerEnvelopeProvider: 'OpenAI',
    routerEnvelopeModel: 'openai/gpt-5.6-luna'
  };
}

function acceptedPlannerRouteDiagnostics() {
  return acceptedCriticRouteDiagnostics();
}

function verifyGeneratedPlannerSchemaResponseBound(schemaValue) {
  const root = schemaValue || {};
  const resolveRef = (ref) => {
    if (!ref.startsWith('#/')) {
      throw new Error(`planner bound walker found external ref ${ref}`);
    }
    return ref.slice(2).split('/').reduce((value, segment) =>
      value?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')], root
    );
  };
  const add = (...values) => values.reduce((total, value) => ({
    textCodepoints:
      total.textCodepoints + value.textCodepoints,
    asciiCodepoints:
      total.asciiCodepoints + value.asciiCodepoints,
    evidenceRefOccurrences:
      total.evidenceRefOccurrences + value.evidenceRefOccurrences,
    fixedBytes: total.fixedBytes + value.fixedBytes
  }), {
    textCodepoints: 0,
    asciiCodepoints: 0,
    evidenceRefOccurrences: 0,
    fixedBytes: 0
  });
  const multiply = (value, count) => ({
    textCodepoints: value.textCodepoints * count,
    asciiCodepoints: value.asciiCodepoints * count,
    evidenceRefOccurrences: value.evidenceRefOccurrences * count,
    fixedBytes: value.fixedBytes * count
  });
  const walk = (schema, refStack = []) => {
    if (!schema || typeof schema !== 'object') {
      throw new Error('planner bound walker found an empty schema node');
    }
    if (schema.$ref) {
      const ref = schema.$ref;
      if (/#\/\$defs\/compact(?:Channel|Action)Label$/.test(ref)) {
        const resolved = resolveRef(ref);
        if (Array.isArray(resolved.enum)) {
          return walk(resolved, [...refStack, ref]);
        }
        return {
          textCodepoints: 0,
          asciiCodepoints: resolved.maxLength,
          evidenceRefOccurrences: 0,
          fixedBytes: 2
        };
      }
      if (/(?:^|\/)(?:observation)?EvidenceRef$/i.test(ref)) {
        return {
          textCodepoints: 0,
          asciiCodepoints: 0,
          evidenceRefOccurrences: 1,
          fixedBytes: 2
        };
      }
      if (refStack.includes(ref)) {
        throw new Error(`planner bound walker found recursive ref ${ref}`);
      }
      return walk(resolveRef(ref), [...refStack, ref]);
    }
    if (Array.isArray(schema.enum)) {
      const serialized = schema.enum.map((value) => JSON.stringify(value));
      return {
        textCodepoints: 0,
        asciiCodepoints: 0,
        evidenceRefOccurrences: 0,
        fixedBytes: Math.max(0, ...serialized.map((value) =>
          Buffer.byteLength(value, 'utf8')
        ))
      };
    }
    if (schema.type === 'string') {
      if (!Number.isSafeInteger(schema.maxLength) ||
          schema.maxLength < 0) {
        throw new Error(
          `planner strict schema retained an unbounded string: ${JSON.stringify(schema)}`
        );
      }
      return {
        textCodepoints: schema.maxLength,
        asciiCodepoints: 0,
        evidenceRefOccurrences: 0,
        fixedBytes: 2
      };
    }
    if (schema.type === 'number' || schema.type === 'integer') {
      if (!Number.isFinite(schema.minimum) ||
          !Number.isFinite(schema.maximum)) {
        throw new Error(
          `planner strict schema retained an unbounded number: ${JSON.stringify(schema)}`
        );
      }
      // completion.data has already crossed the JSON parser. JSON.stringify
      // emits a canonical finite IEEE-754 representation of at most 24 bytes.
      return {
        textCodepoints: 0,
        asciiCodepoints: 0,
        evidenceRefOccurrences: 0,
        fixedBytes: 24
      };
    }
    if (schema.type === 'array') {
      if (!Number.isSafeInteger(schema.maxItems) || schema.maxItems < 0) {
        throw new Error(
          `planner strict schema retained an unbounded array: ${JSON.stringify(schema)}`
        );
      }
      const items = multiply(walk(schema.items, refStack), schema.maxItems);
      return add(items, {
        textCodepoints: 0,
        asciiCodepoints: 0,
        evidenceRefOccurrences: 0,
        fixedBytes: 2 + Math.max(0, schema.maxItems - 1)
      });
    }
    if (schema.type === 'object') {
      const required = schema.required || [];
      if (schema.additionalProperties !== false ||
          required.length !== Object.keys(schema.properties || {}).length) {
        throw new Error(
          `planner strict schema object is not finite/total: ${JSON.stringify(schema)}`
        );
      }
      const children = required.map((key) => add(
        {
          textCodepoints: 0,
          asciiCodepoints: 0,
          evidenceRefOccurrences: 0,
          fixedBytes: Buffer.byteLength(JSON.stringify(key), 'utf8') + 1
        },
        walk(schema.properties[key], refStack)
      ));
      return add(
        ...children,
        {
          textCodepoints: 0,
          asciiCodepoints: 0,
          evidenceRefOccurrences: 0,
          fixedBytes: 2 + Math.max(0, required.length - 1)
        }
      );
    }
    throw new Error(
      `planner bound walker found unsupported schema: ${JSON.stringify(schema)}`
    );
  };
  const stats = walk(root);
  const astralTextBytes = stats.textCodepoints * 4;
  const asciiTextBytes = stats.asciiCodepoints;
  const maximumEvidenceRefBytes =
    stats.evidenceRefOccurrences * 64;
  const derivedBound = astralTextBytes + asciiTextBytes + maximumEvidenceRefBytes +
    stats.fixedBytes;
  computedPlannerSchemaResponseBoundBytes = derivedBound;
  if (stats.textCodepoints > 5_216 ||
      stats.asciiCodepoints !== 2_400 ||
      stats.evidenceRefOccurrences !== 56 ||
      derivedBound > MAX_DISCOVERY_PLANNER_SCHEMA_RESPONSE_BOUND_BYTES ||
      MAX_DISCOVERY_PLANNER_SCHEMA_RESPONSE_BOUND_BYTES >
        MAX_DISCOVERY_PLANNER_RESPONSE_BYTES) {
    throw new Error(
      `fresh planner schema exceeded its derived response proof: ${JSON.stringify({ stats, astralTextBytes, maximumEvidenceRefBytes, derivedBound, declaredBound: MAX_DISCOVERY_PLANNER_SCHEMA_RESPONSE_BOUND_BYTES, runtimeCap: MAX_DISCOVERY_PLANNER_RESPONSE_BYTES })}`
    );
  }
}

function verifyPlannerNativeStructuredOutputSchemaSubset(schemaValue) {
  const root = schemaValue || {};
  const supportedKeywords = new Set([
    '$defs',
    '$ref',
    'additionalProperties',
    'anyOf',
    'const',
    'description',
    'enum',
    'exclusiveMaximum',
    'exclusiveMinimum',
    'format',
    'items',
    'maxItems',
    'maxLength',
    'maximum',
    'minItems',
    'minLength',
    'minimum',
    'pattern',
    'properties',
    'required',
    'type'
  ]);
  const unsupportedComposition = new Set([
    'allOf',
    'dependentRequired',
    'dependentSchemas',
    'else',
    'if',
    'not',
    'then'
  ]);
  const supportedFormats = new Set([
    'date-time',
    'time',
    'date',
    'email',
    'ipv4',
    'ipv6',
    'uuid',
    'uri'
  ]);
  let objectPropertyCount = 0;
  let enumValueCount = 0;
  let schemaStringLength = 0;
  let maximumObjectDepth = 0;
  const unsupported = [];
  const walk = (schema, objectDepth = 0, path = '#') => {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      throw new Error(`structured-output schema has invalid node ${path}`);
    }
    for (const key of Object.keys(schema)) {
      if (!supportedKeywords.has(key)) {
        unsupported.push(`${path}:${key}`);
      }
      if (unsupportedComposition.has(key)) {
        unsupported.push(`${path}:${key}`);
      }
    }
    if (schema.$ref) {
      if (Object.keys(schema).length !== 1 ||
          typeof schema.$ref !== 'string' ||
          !schema.$ref.startsWith('#/')) {
        unsupported.push(`${path}:non_local_or_sibling_ref`);
      }
      return;
    }
    if (Array.isArray(schema.enum)) {
      enumValueCount += schema.enum.length;
      schemaStringLength += schema.enum.reduce((total, value) =>
        total + (typeof value === 'string' ? value.length : 0), 0
      );
      if (schema.enum.length > 1_000) {
        unsupported.push(`${path}:enum_value_limit`);
      }
      if (schema.enum.length > 250 &&
          schema.enum.reduce((total, value) =>
            total + (typeof value === 'string' ? value.length : 0), 0
          ) > 15_000) {
        unsupported.push(`${path}:single_enum_string_limit`);
      }
    }
    if (typeof schema.const === 'string') {
      schemaStringLength += schema.const.length;
    }
    if (schema.format && !supportedFormats.has(schema.format)) {
      unsupported.push(`${path}:unsupported_format_${schema.format}`);
    }
    if (typeof schema.pattern === 'string' &&
        (/\\[1-9]/.test(schema.pattern) ||
          /\\[bBpP](?:\{|$)/.test(schema.pattern) ||
          /\(\?(?:[=!<]|[imsu-])/.test(schema.pattern) ||
          /\\u(?:d[89abAB]|d[c-fC-F])[0-9a-fA-F]{2}/.test(
            schema.pattern
          ))) {
      unsupported.push(`${path}:unsupported_native_pattern`);
    }
    if (Number.isFinite(schema.maxLength) && schema.maxLength > 2_048) {
      unsupported.push(`${path}:native_max_length_limit`);
    }
    if (Number.isFinite(schema.maxItems) && schema.maxItems > 256) {
      unsupported.push(`${path}:native_max_items_limit`);
    }
    if (schema.type === 'object') {
      const properties = schema.properties || {};
      const keys = Object.keys(properties);
      const required = Array.isArray(schema.required)
        ? schema.required
        : [];
      objectPropertyCount += keys.length;
      maximumObjectDepth = Math.max(maximumObjectDepth, objectDepth + 1);
      schemaStringLength += keys.reduce((total, key) =>
        total + key.length, 0
      );
      if (schema.additionalProperties !== false ||
          keys.length > 64 ||
          required.length !== keys.length ||
          required.some((key) => !Object.prototype.hasOwnProperty.call(
            properties,
            key
          ))) {
        unsupported.push(`${path}:non_total_object`);
      }
      for (const [key, child] of Object.entries(properties)) {
        walk(child, objectDepth + 1, `${path}/properties/${key}`);
      }
    } else if (schema.type === 'array') {
      walk(schema.items, objectDepth, `${path}/items`);
    }
    if (Array.isArray(schema.anyOf)) {
      schema.anyOf.forEach((child, index) =>
        walk(child, objectDepth, `${path}/anyOf/${index}`)
      );
    }
    if (schema.$defs && typeof schema.$defs === 'object') {
      for (const [name, child] of Object.entries(schema.$defs)) {
        schemaStringLength += name.length;
        walk(child, 0, `${path}/$defs/${name}`);
      }
    }
  };
  walk(root);
  const resolveRef = (ref) => ref.slice(2).split('/').reduce(
    (value, segment) => value?.[
      segment.replaceAll('~1', '/').replaceAll('~0', '~')
    ],
    root
  );
  const resolvedObjectDepth = (schema, objectDepth = 0, refs = []) => {
    if (schema.$ref) {
      if (refs.includes(schema.$ref)) {
        throw new Error(
          `planner schema depth proof found recursive ref ${schema.$ref}`
        );
      }
      const resolved = resolveRef(schema.$ref);
      if (!resolved) {
        throw new Error(
          `planner schema depth proof found missing ref ${schema.$ref}`
        );
      }
      return resolvedObjectDepth(
        resolved,
        objectDepth,
        [...refs, schema.$ref]
      );
    }
    let deepest = objectDepth;
    if (schema.type === 'object') {
      const nextDepth = objectDepth + 1;
      deepest = nextDepth;
      for (const child of Object.values(schema.properties || {})) {
        deepest = Math.max(
          deepest,
          resolvedObjectDepth(child, nextDepth, refs)
        );
      }
    } else if (schema.type === 'array') {
      deepest = Math.max(
        deepest,
        resolvedObjectDepth(schema.items, objectDepth, refs)
      );
    }
    if (Array.isArray(schema.anyOf)) {
      for (const child of schema.anyOf) {
        deepest = Math.max(
          deepest,
          resolvedObjectDepth(child, objectDepth, refs)
        );
      }
    }
    return deepest;
  };
  maximumObjectDepth = Math.max(
    maximumObjectDepth,
    resolvedObjectDepth(root),
    ...Object.values(root.$defs || {}).map((definition) =>
      resolvedObjectDepth(definition)
    )
  );
  if (root.type !== 'object' || root.anyOf ||
      objectPropertyCount > 5_000 ||
      maximumObjectDepth > 10 ||
      schemaStringLength > 120_000 ||
      enumValueCount > 1_000 ||
      unsupported.length > 0) {
    throw new Error(
      `planner schema exceeds the qualified native Structured Outputs subset: ${JSON.stringify({ objectPropertyCount, maximumObjectDepth, schemaStringLength, enumValueCount, unsupported })}`
    );
  }
  return {
    objectPropertyCount,
    maximumObjectDepth,
    schemaStringLength,
    enumValueCount
  };
}

function verifyFreshPlannerStrictSchemaTotality({
  schema: schemaValue,
  observationEvidenceRef
}) {
  const schema = structuredClone(schemaValue || {});
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const planSchema = schema.properties?.plans?.items;
  const market = planSchema?.properties?.market?.enum?.[0];
  const observationEnum = schema.$defs?.observationEvidenceRef?.enum || [];
  if (!market || !observationEnum.includes(observationEvidenceRef)) {
    throw new Error('strict planner schema fixture lacks market/observation');
  }
  const projectMotion = (motionValue) => {
    const motion = structuredClone(motionValue);
    const contingentFinalists = compactContingentFinalists(
      motion.contingentFinalists
    );
    for (const revenue of contingentFinalists.pathBase.r) {
      revenue.atm = 'crm_source';
      revenue.ats =
        'ProfileScribe source field records the tournament action';
    }
    return {
      motionKind: motion.motionKind,
      paidOffer: {
        seller: motion.paidOffer,
        compensatedJob: COMPENSATED_JOB_PAID_OFFER
      },
      market,
      targetRoleSubrole: motion.targetRoleSubrole,
      organizationTerms: motion.organizationTerms?.length > 0
        ? motion.organizationTerms
        : ['Verified professional organization'],
      jobTitle: motion.jobTitle || 'Verified professional role',
      skills: motion.skills?.length > 0
        ? motion.skills
        : ['Verified professional skill'],
      contingentFinalists
    };
  };
  const baseline = {
    contractVersion: OPPORTUNITY_DISCOVERY_PLAN_CONTRACT,
    status: 'planned',
    reason: '',
    plans: cases[0].plans(observationEvidenceRef).slice(0, 2)
      .map(projectMotion)
  };
  if (!validate(baseline)) {
    throw new Error(
      `strict planner baseline is not schema-valid: ${JSON.stringify(validate.errors)}`
    );
  }
  const expectInvalid = (label, mutate) => {
    const adversary = structuredClone(baseline);
    mutate(adversary);
    if (validate(adversary)) {
      throw new Error(`strict planner schema accepted ${label}`);
    }
  };
  expectInvalid('model-authored rationale outside fresh authority', (response) => {
    response.plans[0].rationale =
      'This prose is deliberately outside the fresh execution contract.';
  });
  for (const paidOffer of [
    'Unpaid job role',
    'Volunteer role',
    'Pro bono engagement'
  ]) {
    expectInvalid(`non-income compensated-job offer ${paidOffer}`, (response) => {
      response.plans[0].paidOffer.compensatedJob = paidOffer;
    });
  }
  for (const [label, value] of [
    ['leading whitespace', ' invalid'],
    ['trailing whitespace', 'invalid '],
    ['repeated whitespace', 'invalid  text'],
    ['NEL C1 control', 'invalid\u0085text'],
    ['soft hyphen', 'invalid\u00adtext'],
    ['Mongolian vowel separator', 'invalid\u180etext'],
    ['zero-width space', 'invalid\u200btext'],
    ['invisible plus', 'invalid\u2064text'],
    ['deprecated directional control', 'invalid\u206atext'],
    ['interlinear annotation control', 'invalid\ufff9text'],
    ['replacement character', 'invalid\ufffdtext'],
    ['byte order mark', 'invalid\ufefftext'],
    ['bidi override', 'invalid\u202etext']
  ]) {
    expectInvalid(label, (response) => {
      response.plans[0].buyer = value;
    });
  }
  for (const [label, mutate] of [
    ['emoji-only conversion destination', (response) => {
      response.plans[0].conversionDestination = '👥👥👥👥';
    }],
    ['emoji-only paid conversion', (response) => {
      response.plans[0].paidConversion = '💸💸💸💸';
    }],
    ['emoji-only attribution signal', (response) => {
      response.plans[0].attributionSignal = '👀👀👀👀';
    }],
    ['emoji-only revenue outcome', (response) => {
      response.plans[0].contingentFinalists.pathBase.r[0].io =
        '💰💰💰💰';
    }],
    ['emoji-only revenue destination', (response) => {
      response.plans[0].contingentFinalists.pathBase.r[0].g.d.l =
        '🔗🔗🔗🔗';
    }],
    ['emoji-only tactic label', (response) => {
      response.plans[0].contingentFinalists.tacticA.l = '🎯🎯🎯🎯';
    }],
    ['invented base observation', (response) => {
      response.plans[0].contingentFinalists.pathBase.e = [
        'observation:invented'
      ];
    }],
    ['invented tactic observation', (response) => {
      response.plans[0].contingentFinalists.tacticA.e = [
        'observation:invented'
      ];
    }],
    ['invented follow-up observation', (response) => {
      response.plans[0].contingentFinalists.tacticA.f[0].e = [
        'observation:invented'
      ];
    }],
    ['invented timing observation', (response) => {
      response.plans[0].contingentFinalists.pathBase.t[0].e = [
        'observation:invented'
      ];
    }],
    ['unknown role subrole', (response) => {
      response.plans[0].targetRoleSubrole = 'not_canonical';
    }],
    ['excluded student subrole', (response) => {
      response.plans[0].targetRoleSubrole = 'student';
    }],
    ['excluded unemployed subrole', (response) => {
      response.plans[0].targetRoleSubrole = 'unemployed';
    }],
    ['missing role subrole', (response) => {
      delete response.plans[0].targetRoleSubrole;
    }],
    ['overflow weight', (response) => {
      response.plans[0].contingentFinalists.w.of = JSON.parse('1e400');
    }],
    ['overflow expected value', (response) => {
      response.plans[0].contingentFinalists.pathBase.r[0].vm =
        JSON.parse('1e400');
    }],
    ['nonempty model reason', (response) => {
      response.reason = 'model-authored diagnostic';
    }]
  ]) {
    expectInvalid(label, mutate);
  }
  const allCanonicalSubroles =
    planSchema.properties?.targetRoleSubrole?.enum || [];
  if (allCanonicalSubroles.length !== 104) {
    throw new Error('strict planner subrole property lost canonical coverage');
  }
  for (const subrole of allCanonicalSubroles) {
    const response = structuredClone(baseline);
    response.plans[0].targetRoleSubrole = subrole;
    if (!validate(response)) {
      throw new Error(
        `strict planner rejected canonical subrole ${subrole}: ${JSON.stringify(validate.errors)}`
      );
    }
  }
  const getAtPath = (value, path) => path.reduce(
    (item, segment) => item?.[segment],
    value
  );
  const setAtPath = (value, path, replacement) => {
    const owner = path.slice(0, -1).reduce(
      (item, segment) => item[segment],
      value
    );
    owner[path.at(-1)] = replacement;
  };
  const padAstral = (value, maxCodepoints) => {
    const text = String(value || 'A');
    const length = unicodeCodepointLength(text);
    if (length > maxCodepoints) {
      throw new Error(
        `strict planner baseline already exceeds ${maxCodepoints}: ${text}`
      );
    }
    return `${text}${'😀'.repeat(maxCodepoints - length)}`;
  };
  const maxFieldPaths = [
    ['paidOffer', ['plans', 0, 'paidOffer', 'seller'], 140],
    ['organizationTerms', ['plans', 0, 'organizationTerms', 0], 48],
    ['jobTitle', ['plans', 0, 'jobTitle'], 80],
    ['skills', ['plans', 0, 'skills', 0], 48],
    ['revenue label', ['plans', 0, 'contingentFinalists', 'pathBase', 'r', 0, 'l'], 96],
    ['incremental outcome', ['plans', 0, 'contingentFinalists', 'pathBase', 'r', 0, 'io'], 120],
    ['attribution signal', ['plans', 0, 'contingentFinalists', 'pathBase', 'r', 0, 'ats'], 140],
    ['conversion destination', ['plans', 0, 'contingentFinalists', 'pathBase', 'r', 0, 'cd'], 120],
    ['revenue stop', ['plans', 0, 'contingentFinalists', 'pathBase', 'r', 0, 'st'], 120],
    ['supporting bottleneck', ['plans', 0, 'contingentFinalists', 'pathBase', 'r', 0, 'sb'], 100],
    ['grounded destination', ['plans', 0, 'contingentFinalists', 'pathBase', 'r', 0, 'g', 'd', 'l'], 120],
    ['offer item', ['plans', 0, 'contingentFinalists', 'pathBase', 'o', 0, 'l'], 96],
    ['timing label', ['plans', 0, 'contingentFinalists', 'pathBase', 't', 0, 'l'], 100],
    ['timing query', ['plans', 0, 'contingentFinalists', 'pathBase', 't', 0, 'q'], 100],
    ['proof item', ['plans', 0, 'contingentFinalists', 'pathBase', 'p', 0, 'l'], 100]
  ];
  const allMax = structuredClone(baseline);
  for (const [label, path, maxCodepoints] of maxFieldPaths) {
    const exactMax = padAstral(getAtPath(baseline, path), maxCodepoints);
    const exact = structuredClone(baseline);
    setAtPath(exact, path, exactMax);
    if (!validate(exact) ||
        getAtPath(JSON.parse(JSON.stringify(exact)), path) !== exactMax) {
      throw new Error(
        `strict planner did not preserve max-codepoint ${label}: ${JSON.stringify(validate.errors)}`
      );
    }
    const over = structuredClone(exact);
    setAtPath(over, path, `${exactMax}😀`);
    if (validate(over)) {
      throw new Error(`strict planner accepted over-max ${label}`);
    }
    setAtPath(allMax, path, exactMax);
  }
  if (!validate(allMax)) {
    throw new Error(
      `strict planner joint-max astral response is invalid: ${JSON.stringify(validate.errors)}`
    );
  }
  const serializedAllMax = JSON.stringify(allMax);
  if (/\\ud[89ab][0-9a-f]{2}|\\ud[cdef][0-9a-f]{2}/i.test(
    serializedAllMax
  )) {
    throw new Error('strict planner joint-max response split an astral scalar');
  }

  // Exercise the abstract walker proof with one concrete joint-maximum
  // response: both plans, all schema-authorized list cardinalities, and all
  // 56 evidence-ref occurrences use distinct 64-byte canonical refs.
  // Oversized or escape-heavy raw refs are normalized before reaching this
  // schema (proved separately below), so 64 encoded bytes is exact.
  const boundaryEvidenceRefs = Array.from({ length: 14 }, (_, index) =>
    `observation:${'a'.repeat(50)}${index.toString(16).padStart(2, '0')}`
  );
  if (boundaryEvidenceRefs.some((ref) =>
    unicodeCodepointLength(ref) !== 64 ||
    Buffer.byteLength(JSON.stringify(ref), 'utf8') - 2 !== 64
  )) {
    throw new Error('joint-max evidence reference arithmetic drifted');
  }
  const maximumSchema = structuredClone(schema);
  maximumSchema.$defs.evidenceRef.enum = [...boundaryEvidenceRefs];
  maximumSchema.$defs.observationEvidenceRef.enum = [
    ...boundaryEvidenceRefs
  ];
  const maximumResponse = structuredClone(allMax);
  for (let planIndex = 0; planIndex < 2; planIndex += 1) {
    for (const [, rawPath, maxCodepoints] of maxFieldPaths) {
      const path = [...rawPath];
      path[1] = planIndex;
      setAtPath(
        maximumResponse,
        path,
        padAstral(getAtPath(maximumResponse, path), maxCodepoints)
      );
    }
    maximumResponse.plans[planIndex].organizationTerms = Array.from(
      { length: 4 },
      (_, index) => padAstral(`Org${index}`, 48)
    );
    maximumResponse.plans[planIndex].skills = Array.from(
      { length: 4 },
      (_, index) => padAstral(`Skill${index}`, 48)
    );
  }
  let evidenceArrayCount = 0;
  let evidenceOccurrenceCount = 0;
  let boundaryCursor = 0;
  const dereference = (schemaValue) => {
    let candidate = schemaValue || {};
    const seenRefs = new Set();
    while (typeof candidate.$ref === 'string' &&
      !seenRefs.has(candidate.$ref)) {
      seenRefs.add(candidate.$ref);
      candidate = maximumSchema.$defs[
        candidate.$ref.split('/').at(-1)
      ] || {};
    }
    return candidate;
  };
  const fillMaximumArrays = (value, schemaValue) => {
    const nodeSchema = dereference(schemaValue);
    if (Array.isArray(value)) {
      const itemRef = nodeSchema.items?.$ref?.split('/').at(-1) || '';
      if (['evidenceRef', 'observationEvidenceRef'].includes(itemRef)) {
        const count = nodeSchema.maxItems;
        evidenceArrayCount += 1;
        evidenceOccurrenceCount += count;
        return Array.from({ length: count }, () => {
          const ref = boundaryEvidenceRefs[
            boundaryCursor % boundaryEvidenceRefs.length
          ];
          boundaryCursor += 1;
          return ref;
        });
      }
      return value.map((item) => fillMaximumArrays(
        item,
        nodeSchema.items
      ));
    }
    if (value && typeof value === 'object') {
      for (const key of nodeSchema.required || []) {
        value[key] = fillMaximumArrays(
          value[key],
          nodeSchema.properties?.[key]
        );
      }
    }
    return value;
  };
  fillMaximumArrays(maximumResponse, maximumSchema);
  let maximizedStringOccurrenceCount = 0;
  const fillMaximumStrings = (value, schemaValue) => {
    const nodeSchema = dereference(schemaValue);
    if (typeof value === 'string') {
      if (!Number.isInteger(nodeSchema.maxLength) ||
          Array.isArray(nodeSchema.enum)) return value;
      const asciiRoleSchema = [
        maximumSchema.$defs.compactBuyerLabel,
        maximumSchema.$defs.compactChannelLabel,
        maximumSchema.$defs.compactActionLabel
      ].includes(nodeSchema);
      const candidate = asciiRoleSchema
        ? `${value}${'x'.repeat(
            nodeSchema.maxLength - unicodeCodepointLength(value)
          )}`
        : padAstral(value, nodeSchema.maxLength);
      try {
        if (nodeSchema.pattern &&
            !new RegExp(nodeSchema.pattern, 'u').test(candidate)) {
          return value;
        }
      } catch {
        return value;
      }
      maximizedStringOccurrenceCount += 1;
      return candidate;
    }
    if (Array.isArray(value)) {
      return value.map((item) => fillMaximumStrings(
        item,
        nodeSchema.items
      ));
    }
    if (value && typeof value === 'object') {
      for (const key of nodeSchema.required || []) {
        value[key] = fillMaximumStrings(
          value[key],
          nodeSchema.properties?.[key]
        );
      }
    }
    return value;
  };
  fillMaximumStrings(maximumResponse, maximumSchema);
  const validateMaximum = new Ajv({ allErrors: true, strict: false })
    .compile(maximumSchema);
  if (!validateMaximum(maximumResponse) ||
      evidenceOccurrenceCount !== 56 || evidenceArrayCount === 0 ||
      // All 16 variable safe-ASCII channel/action strings plus the other 52
      // bounded authored strings must reach their individual maxima. The four
      // buyer labels are fixed enums and contribute exact serialized bytes.
      maximizedStringOccurrenceCount !== 68 ||
      maximumResponse.plans.some((planValue) =>
        planValue.organizationTerms.length !== 4 ||
        planValue.skills.length !== 4
      )) {
    throw new Error(
      `concrete joint-max planner response is not schema-total: ${JSON.stringify({ evidenceArrayCount, evidenceOccurrenceCount, maximizedStringOccurrenceCount, errors: validateMaximum.errors })}`
    );
  }
  const maximumResponseBytes = Buffer.byteLength(
    JSON.stringify(maximumResponse),
    'utf8'
  );
  maximumConcretePlannerResponseBytes = maximumResponseBytes;
  if (maximumResponseBytes >
        MAX_DISCOVERY_PLANNER_SCHEMA_RESPONSE_BOUND_BYTES ||
      maximumResponseBytes > MAX_DISCOVERY_PLANNER_RESPONSE_BYTES) {
    throw new Error(
      `concrete joint-max planner response exceeded its declared bound: ${JSON.stringify({ maximumResponseBytes, declared: MAX_DISCOVERY_PLANNER_SCHEMA_RESPONSE_BOUND_BYTES, runtime: MAX_DISCOVERY_PLANNER_RESPONSE_BYTES })}`
    );
  }
  maxAstralStrictPlannerResponse = allMax;
}

function verifyEvidenceReferenceEncodingBounds() {
  const exactBoundaryID =
    `observation:${'a'.repeat(52)}`;
  const overByteBoundaryID =
    `observation:${'😀'.repeat(14)}`;
  const escapeHeavyID =
    `observation:${'\\"'.repeat(26)}`;
  const invalidIDs = [
    ['soft-hyphen', `observation:invalid\u00adref`],
    ['Mongolian-vowel-separator', `observation:invalid\u180eref`],
    ['zero-width-space', `observation:invalid\u200bref`],
    ['invisible-operator', `observation:invalid\u2064ref`],
    ['deprecated-directional-control', `observation:invalid\u206aref`],
    ['interlinear-annotation-control', `observation:invalid\ufff9ref`],
    ['lone-surrogate', `observation:invalid\ud800ref`],
    ['replacement-character', `observation:invalid\ufffdref`],
    ['byte-order-mark', `observation:invalid\ufeffref`],
    ['bidi-control', `observation:invalid\u202eref`]
  ];
  const sourceEvidence = [
    ['exact-boundary', exactBoundaryID],
    ['over-byte-boundary', overByteBoundaryID],
    ['escape-heavy', escapeHeavyID],
    ...invalidIDs
  ].map(([label, id], index) => ({
    evidenceRef: id,
    id,
    observationId: id,
    sourceId: 'owner-site',
    label: `Encoding boundary ${label}`,
    summary:
      `Approved professional observation ${index + 1} for evidence encoding.`,
    url: `https://owner.example/encoding/${index + 1}`,
    observedAt: now.toISOString(),
    status: 'approved'
  }));
  const catalog = buildEvidenceCatalog({
    evidenceSnapshot: {
      sources: [{
        id: 'owner-site',
        label: 'Owner site',
        url: 'https://owner.example/',
        status: 'approved',
        profileControlled: true
      }],
      sourceEvidence
    }
  }, {}, now, { includeSystemAttributionCapability: true });
  const byLabel = new Map(catalog.map((item) => [item.label, item]));
  const boundary = byLabel.get('Encoding boundary exact-boundary');
  const overByte = byLabel.get('Encoding boundary over-byte-boundary');
  const escaped = byLabel.get('Encoding boundary escape-heavy');
  if (unicodeCodepointLength(exactBoundaryID) !== 64 ||
      Buffer.byteLength(exactBoundaryID, 'utf8') !== 64 ||
      Buffer.byteLength(JSON.stringify(exactBoundaryID), 'utf8') - 2 !==
        64 ||
      boundary?.id !== exactBoundaryID ||
      Buffer.byteLength(overByteBoundaryID, 'utf8') <= 64 ||
      !/^observation:[a-f0-9]{52}$/.test(overByte?.id || '') ||
      unicodeCodepointLength(escapeHeavyID) !== 64 ||
      Buffer.byteLength(escapeHeavyID, 'utf8') !== 64 ||
      Buffer.byteLength(JSON.stringify(escapeHeavyID), 'utf8') - 2 <= 64 ||
      !/^observation:[a-f0-9]{52}$/.test(escaped?.id || '') ||
      escaped?.id === escapeHeavyID) {
    throw new Error(
      `evidence reference encoded-byte boundary drifted: ${JSON.stringify({ boundary: boundary?.id, escaped: escaped?.id, exactBoundaryRunes: unicodeCodepointLength(exactBoundaryID), exactBoundaryBytes: Buffer.byteLength(exactBoundaryID, 'utf8'), escapeHeavyRunes: unicodeCodepointLength(escapeHeavyID), escapeHeavyBytes: Buffer.byteLength(escapeHeavyID, 'utf8'), escapeHeavyEncodedBytes: Buffer.byteLength(JSON.stringify(escapeHeavyID), 'utf8') - 2 })}`
    );
  }
  for (const [label, rawID] of invalidIDs) {
    const item = byLabel.get(`Encoding boundary ${label}`);
    if (catalog.some((entry) => entry.id === rawID) ||
        (item && !/^observation:[a-f0-9]{52}$/.test(item.id || ''))) {
      throw new Error(
        `unsafe evidence scalar ${label} was not hashed: ${JSON.stringify({ item, catalog: catalog.map((entry) => ({ id: entry.id, label: entry.label })) })}`
      );
    }
  }
  const retainedInvalidHashes = invalidIDs.filter(([label]) =>
    byLabel.has(`Encoding boundary ${label}`)
  );
  if (retainedInvalidHashes.length < 3) {
    throw new Error('unsafe evidence scalar hashing collapsed too much proof');
  }
  for (const item of catalog) {
    if (Buffer.byteLength(JSON.stringify(item.id), 'utf8') - 2 > 64 ||
        unicodeCodepointLength(item.id) > 64) {
      throw new Error(
        `catalog emitted an evidence ref beyond its response proof: ${JSON.stringify(item.id)}`
      );
    }
  }
}

function unicodeCodepointLength(value) {
  return [...String(value || '')].length;
}

async function verifyFreshAstralPlannerRoundTrip(jobValue) {
  const response = structuredClone(maxAstralStrictPlannerResponse);
  if (!response?.plans?.[0]) {
    throw new Error('joint-max planner response fixture was not initialized');
  }
  response.plans[0].motionKind = 'referral_org_decision_maker';
  const observationEvidenceRef =
    response.plans[0].contingentFinalists.pathBase.r[0].e.find((ref) =>
      /^observation:/i.test(ref)
    );
  const rawJobMotion = cases[1].plans(observationEvidenceRef)[0];
  const padAstral = (value, maximum) => {
    const text = String(value || 'A');
    return `${text}${'😀'.repeat(maximum - unicodeCodepointLength(text))}`;
  };
  const jobBundle = compactContingentFinalists(
    rawJobMotion.contingentFinalists
  );
  for (const revenue of jobBundle.pathBase.r) {
    revenue.atm = 'crm_source';
    revenue.ats =
      'ProfileScribe source field records the tournament action';
  }
  response.plans[1] = {
    motionKind: 'compensated_job',
    paidOffer: {
      seller: rawJobMotion.paidOffer,
      compensatedJob: COMPENSATED_JOB_PAID_OFFER
    },
    market: response.plans[0].market,
    targetRoleSubrole: 'executive',
    organizationTerms: ['Verified employer organization'],
    jobTitle: padAstral(rawJobMotion.jobTitle, 80),
    skills: [padAstral(rawJobMotion.skills[0], 48)],
    contingentFinalists: jobBundle
  };
  const validate = new Ajv({ allErrors: true, strict: false }).compile(
    representativePlannerSchema
  );
  if (!validate(response)) {
    throw new Error(
      `joint-max round-trip response lost strict schema fidelity: ${JSON.stringify(validate.errors)}`
    );
  }
  const first = response.plans[0];
  const second = response.plans[1];
  const expectedRoundTrips = [
    first.paidOffer.seller,
    first.organizationTerms[0],
    second.jobTitle,
    second.skills[0],
    first.contingentFinalists.pathBase.r[0].l,
    first.contingentFinalists.pathBase.r[0].cd,
    first.contingentFinalists.pathBase.r[0].st,
    first.contingentFinalists.pathBase.r[0].sb,
    first.contingentFinalists.pathBase.r[0].g.d.l,
    first.contingentFinalists.pathBase.o[0].l,
    first.contingentFinalists.pathBase.b[0].l.referral,
    second.contingentFinalists.pathBase.b[0].l.paidDemand,
    first.contingentFinalists.pathBase.t[0].l,
    first.contingentFinalists.pathBase.t[0].q,
    first.contingentFinalists.pathBase.p[0].l,
    first.contingentFinalists.tacticA.c[0].l,
    second.contingentFinalists.tacticA.c[0].l,
    first.contingentFinalists.tacticA.a[0].l,
    second.contingentFinalists.tacticA.a[0].l,
    first.contingentFinalists.tacticA.f[0].l
  ];
  let calls = 0;
  const result = await runOpportunityDiscoveryPlanner({
    job: structuredClone(jobValue),
    model: 'deepseek/deepseek-v4-flash-0731',
    now,
    completeJSON: async () => {
      calls += 1;
      return {
        data: response,
        usage,
        generationId: 'generation-joint-max-astral-roundtrip',
        diagnostics: {
          finishReason: 'stop',
          nativeFinishReason: 'stop',
          contentByteCount: Buffer.byteLength(
            JSON.stringify(response),
            'utf8'
          ),
          contentSha256: 'a'.repeat(64)
        },
        annotations: []
      };
    }
  });
  const serialized = JSON.stringify(result.plans || []);
  if (calls !== 1 || result.status !== 'planned' ||
      result.plans.length !== 2 ||
      expectedRoundTrips.some((value) => !serialized.includes(value)) ||
      result.plans.some((planValue) =>
        planValue.contingentFinalists?.familyA?.l !== 'Commercial path A' ||
        planValue.contingentFinalists?.familyB?.l !== 'Commercial path B'
      ) ||
      /\\ud[89ab][0-9a-f]{2}|\\ud[cdef][0-9a-f]{2}/i.test(serialized) ||
      result.preflight?.responseBodyByteCount >
        MAX_DISCOVERY_PLANNER_RESPONSE_BYTES) {
    throw new Error(
      `joint-max fresh authored fields did not round-trip losslessly: ${JSON.stringify({ calls, status: result.status, reason: result.reason, selection: result.planSelection, responseBytes: result.preflight?.responseBodyByteCount, missingIndexes: expectedRoundTrips.map((value, index) => serialized.includes(value) ? -1 : index).filter((index) => index >= 0), plans: result.plans.map((planValue) => ({ id: planValue.id, motionKind: planValue.motionKind, jobTitle: planValue.jobTitle, skills: planValue.skills, buyer: planValue.contingentFinalists?.familyA?.d?.b?.[0]?.l, channel: planValue.contingentFinalists?.familyA?.d?.c?.[0]?.l, action: planValue.contingentFinalists?.familyA?.d?.a?.[0]?.l })) })}`
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

function persistedSingleMotionPlan(plannerPlanValue, selectedMotionValue) {
  const plannerPlan = structuredClone(plannerPlanValue);
  const selectedMotion = structuredClone(selectedMotionValue);
  if (plannerPlan.plans?.length === 1 &&
      plannerPlan.planSelection?.acceptedPlanCount === 1) {
    plannerPlan.plans = [selectedMotion];
    return plannerPlan;
  }
  const omitted = (plannerPlan.plans || []).find((motion) =>
    motion.id !== selectedMotion.id
  );
  plannerPlan.plans = [selectedMotion];
  plannerPlan.planSelection = {
    returnedPlanCount: 2,
    acceptedPlanCount: 1,
    rejectedPlanCount: 1,
    rejectedPlans: [{
      id: omitted?.id || 'fixture_omitted_motion',
      reason:
        'The production-shaped fixture retained only the selected source-bound motion.'
    }]
  };
  return plannerPlan;
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
    targetRoleSubrole: 'executive',
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
    'targetRoleSubrole'
  )) {
    const roleText = `${motion.targetRoleTerms.join(' ')} ${motion.counterparty}`
      .toLowerCase();
    motion.targetRoleSubrole = /pediatr|physician|doctor/.test(roleText)
      ? 'doctor'
      : /midwi|nurs/.test(roleText)
        ? 'nursing'
        : /software|developer|programmer/.test(roleText)
          ? 'software'
          : /partner|alliance/.test(roleText)
            ? 'partnerships'
            : /consult|sustainab|climate/.test(roleText)
              ? 'consulting'
              : 'executive';
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
  // Call 1 may cite only approved profile/observation evidence. The target
  // sentinel is attached locally to the route-authorized dimensions after
  // decoding, so it cannot become the sole basis of a buyer variant.
  const buyerRef = ref;
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
      e: [ref, attributionRef],
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
        o: [ref],
        a: [ref],
        d: {
          l: conversionDestination,
          e: [ref]
        },
        c: [ref],
        t: [attributionRef]
      },
      sb: 'No attributed paid booking has been observed for this route.',
      vm: 500_000
    }],
    o: sharedVariants.map((variant) => ({
      l: `${motion.paidOffer} (${variant})`,
      e: [ref]
    })),
    b: sharedVariants.map((variant) => ({
      l: motion.commercialRole === 'referral_partner'
        ? `${motion.buyer} (${variant})`
        : `{{TARGET_NAME}}: ${motion.buyer} (${variant})`,
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
    e: [ref, attributionRef],
    s: scores,
    tacticKey: key,
    d: {
      ...structuredClone(sharedDimensions),
      c: [variantA, variantB].map((variant) => ({
        l: channel(variant),
        e: [ref]
      })),
      a: [variantA, variantB].map((variant) => ({
        l: acquisitionAction(variant),
        e: [ref]
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
      'Paid booking completed; payment received.',
    direct_sale:
      'Sale completed; payment received.',
    signed_contract:
      'Service contract signed; payment received.',
    paid_pilot:
      'Paid pilot signed; payment received.',
    subscription_or_retainer:
      'Paid subscription started; payment received.',
    insurance_reimbursement:
      'Claim paid; reimbursement received.',
    license_or_royalty:
      'License signed; payment received.',
    commission_or_referral:
      'Commission paid; payment received.',
    sponsorship:
      'Sponsorship contract signed; payment received.',
    platform_payout:
      'Platform payout received.',
    compensated_role:
      'Compensated offer accepted; salary payment received.'
  };
  return outcomes[mechanism] || '';
}

function applyNovelTypedCausalSemantics(value) {
  const motion = structuredClone(value);
  for (const familyKey of ['familyA', 'familyB']) {
    const revenue = motion.contingentFinalists[familyKey].d.r[0];
    revenue.io =
      'Expected revenue reaches the owner only because this reviewed path succeeds.';
    revenue.c =
      'Invite {{TARGET_NAME}} as the named partner to refer one suitable family to the current paid service and booking destination.';
    revenue.o = canonicalTerminalPaidOutcome(revenue.rm);
    revenue.ats =
      'Persist the originating practice beside the transaction.';
    revenue.cd = 'The owner service checkout at https://owner.example/offer';
    revenue.st = 'Conclude on the fourteenth day.';
  }
  return motion;
}

function compactContingentFinalists(value) {
  const materialized = structuredClone(value);
  const familyA = materialized.familyA;
  const familyB = materialized.familyB;
  const tokenFree = (value, fallback) => {
    const canonical = String(value || '')
      .replaceAll('{{TARGET_NAME}}', '')
      .replaceAll('{{TARGET_URL}}', '')
      .replaceAll('target:evidence', '')
      .replace(/[{}:]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[;,\s]+|[;,\s]+$/g, '');
    const text = [...canonical].slice(0, 72).join('').trim();
    return text || fallback;
  };
  const buyerLabels = {
    referral: 'Qualified payer for the paid opportunity',
    buyer: 'Qualified payer {{TARGET_NAME}} for the paid opportunity',
    paidDemand: 'Qualified employer {{TARGET_NAME}} for the paid role'
  };
  const channelLabels = {
    referral_partner: [
      'Review-first public professional profile {{TARGET_URL}} for referral fit verification',
      'Review-first public professional profile {{TARGET_URL}} for partner-channel verification'
    ],
    buyer: [
      'Review-first public professional profile {{TARGET_URL}} for buyer fit verification',
      'Review-first public professional profile {{TARGET_URL}} for purchase-authority verification'
    ],
    paid_demand: [
      'Review-first official paid-demand page {{TARGET_URL}} for compensated-role verification',
      'Review-first official paid-demand page {{TARGET_URL}} for paid-engagement verification'
    ]
  };
  const actionLabels = {
    referral_partner: [
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to refer one qualified buyer to book the current paid offer',
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to introduce one qualified buyer to purchase the current paid offer',
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to recommend one qualified buyer to buy the current paid offer',
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to refer one qualified buyer to sign up for the current paid offer'
    ],
    buyer: [
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to book the current paid consultation',
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to buy the current paid service package',
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to purchase the current paid service package',
      'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to sign the current paid service contract'
    ],
    paid_demand: [
      'After review via official paid-demand page {{TARGET_URL}}, apply a compensated application to {{TARGET_NAME}}',
      'After review via official paid-demand page {{TARGET_URL}}, submit one paid proposal to {{TARGET_NAME}}',
      'After review via official paid-demand page {{TARGET_URL}}, bid one paid proposal to {{TARGET_NAME}}',
      'After review via official paid-demand page {{TARGET_URL}}, submit a paid response to {{TARGET_NAME}}'
    ]
  };
  const selectedRole = familyA.d.a.some((item) =>
    /\b(?:application|bid|proposal|response)\b/i.test(item.l || '')
  )
    ? 'paid_demand'
    : familyA.d.a.some((item) =>
      /\b(?:introduce|recommend|refer|referral)\b/i.test(item.l || '')
    )
      ? 'referral_partner'
      : 'buyer';
  const buyerItem = (item) => ({
    l: structuredClone(buyerLabels),
    e: item.e
  });
  const channelItem = (item, index, family) => ({
    l: channelLabels[selectedRole][
      ((family === familyB ? 1 : 0) + index) % 2],
    e: item.e
  });
  const actionItem = (item, index, family) => ({
    l: actionLabels[selectedRole][
      ((family === familyB ? 2 : 0) + index) % 4],
    e: item.e
  });
  const tactic = (family) => ({
    s: family.s,
    c: family.d.c.map((item, index) => channelItem(item, index, family)),
    a: family.d.a.map((item, index) => actionItem(item, index, family)),
    f: family.d.f
  });
  const compactRevenue = (revenueValue) => {
    const revenue = structuredClone(revenueValue);
    const authoredMechanism = revenue.rm;
    delete revenue.v;
    delete revenue.a;
    delete revenue.c;
    delete revenue.o;
    revenue.rm = {
      seller: authoredMechanism === 'compensated_role'
        ? 'paid_pilot'
        : authoredMechanism,
      compensatedJob: 'compensated_role'
    };
    revenue.l = tokenFree(
      revenue.l,
      'Current attributable paid outcome'
    );
    revenue.k = {
      n: revenue.k?.n ?? 14,
      u: revenue.k?.u ?? 'calendar_days'
    };
    revenue.cd = tokenFree(
      revenue.cd,
      'The official paid conversion destination'
    );
    if (revenue.g?.d) {
      revenue.g.d.l = tokenFree(
        revenue.g.d.l,
        'The official paid conversion destination'
      );
    }
    return revenue;
  };
  return {
    seedContract: materialized.seedContract,
    pathBase: {
      r: familyA.d.r.map(compactRevenue),
      o: familyA.d.o,
      b: familyA.d.b.map(buyerItem),
      t: familyA.d.t,
      p: familyA.d.p
    },
    tacticA: tactic(familyA),
    tacticB: tactic(familyB),
    w: materialized.w
  };
}

function compactProvisionalContingentFinalists(
  value,
  commercialRole,
  sellerRef
) {
  const compact = compactContingentFinalists(value);
  const referralActions = [
    'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to refer one qualified buyer to validate the proposed paid offer',
    'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to introduce one qualified buyer to evaluate the proposed paid offer',
    'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to recommend one qualified buyer to test the proposed paid offer',
    'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to refer one qualified buyer to assess the proposed paid offer'
  ];
  const directActions = [
    'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to review one proposed paid consultation pilot',
    'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to evaluate one proposed paid service pilot',
    'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to assess one proposed paid service proposal',
    'After review via public professional profile {{TARGET_URL}}, ask {{TARGET_NAME}} to review one proposed paid service contract'
  ];
  compact.pathBase.b = compact.pathBase.b.map((item) => ({
    ...item,
    l: {
      referral: 'Qualified payer for the paid opportunity',
      buyer: 'Qualified payer {{TARGET_NAME}} for the paid opportunity',
      paidDemand: 'Qualified employer {{TARGET_NAME}} for the paid role'
    }
  }));
  compact.pathBase.o = compact.pathBase.o.map((item) => ({
    ...item,
    l: 'Proposed paid ProfileScribe professional profile service',
    e: [sellerRef]
  }));
  compact.pathBase.r = compact.pathBase.r.map((revenue) => ({
    ...revenue,
    l: 'Proposed attributable paid ProfileScribe outcome',
    io: 'One attributable payment for the proposed ProfileScribe service.',
    cd: 'Proposed ProfileScribe pricing and checkout page',
    g: {
      ...revenue.g,
      o: [sellerRef],
      d: {
        l: 'Proposed ProfileScribe pricing and checkout page',
        e: [sellerRef]
      },
      c: [sellerRef]
    }
  }));
  for (const [tacticIndex, tacticKey] of ['tacticA', 'tacticB'].entries()) {
    compact[tacticKey].a = compact[tacticKey].a.map((item, index) => {
      const variant = tacticIndex * 2 + index;
      return {
        ...item,
        l: commercialRole === 'referral_partner'
          ? referralActions[variant]
          : directActions[variant]
      };
    });
  }
  if (!['referral_partner', 'buyer'].includes(commercialRole)) {
    throw new Error('provisional buyer fixture has no role alternatives');
  }
  return compact;
}

function compactFreshPlannerPlans(values) {
  return (values || []).map((planValue) => {
    const freshPlan = structuredClone(planValue);
    if (freshPlan.contingentFinalists?.familyA &&
        freshPlan.contingentFinalists?.familyB) {
      freshPlan.contingentFinalists = compactContingentFinalists(
        freshPlan.contingentFinalists
      );
    }
    const revenues = freshPlan.contingentFinalists?.pathBase?.r;
    for (const revenue of Array.isArray(revenues) ? revenues : []) {
      revenue.atm = 'crm_source';
    }
    return {
      motionKind: freshPlan.motionKind,
      paidOffer: {
        seller: typeof freshPlan.paidOffer === 'string'
          ? freshPlan.paidOffer
          : freshPlan.paidOffer?.seller,
        compensatedJob: typeof freshPlan.paidOffer === 'object'
          ? freshPlan.paidOffer?.compensatedJob
          : COMPENSATED_JOB_PAID_OFFER
      },
      market: freshPlan.market,
      targetRoleSubrole: freshPlan.targetRoleSubrole,
      organizationTerms: freshPlan.organizationTerms || [],
      jobTitle: freshPlan.jobTitle || 'Verified professional role',
      skills: freshPlan.skills?.length > 0
        ? freshPlan.skills
        : ['Verified professional skill'],
      contingentFinalists: freshPlan.contingentFinalists
    };
  });
}

function canonicalMaterializedPlannerPlans(values) {
  return (values || []).map((planValue) => {
    const motion = structuredClone(planValue);
    if (motion.motionKind === 'compensated_job') {
      motion.paidOffer =
        'A current compensated role matching verified professional skills';
    }
    const original = motion.contingentFinalists;
    if (!original?.familyA || !original?.familyB) return motion;
    const compact = compactContingentFinalists(original);
    const selectItems = (items) => (items || []).map((item) => ({
      l: item.l,
      e: structuredClone(item.e)
    }));
    const selectBuyerItems = (items) => (items || []).map((item) => ({
      l: motion.commercialRole === 'referral_partner'
        ? item.l.referral
        : motion.commercialRole === 'paid_demand'
          ? item.l.paidDemand
          : item.l.buyer,
      e: structuredClone(item.e)
    }));
    const materializeFamily = (familyKey, tacticKey, key) => {
      const source = structuredClone(original[familyKey]);
      const tactic = compact[tacticKey];
      source.m = motion.acquisitionMode;
      source.tacticKey = key;
      source.d.b = selectBuyerItems(compact.pathBase.b);
      source.d.c = selectItems(tactic.c);
      source.d.a = selectItems(tactic.a);
      const compactRevenue = structuredClone(compact.pathBase.r[0]);
      const originalRevenue = source.d.r[0];
      source.d.r[0] = {
        ...compactRevenue,
        rm: motion.motionKind === 'compensated_job'
          ? compactRevenue.rm.compensatedJob
          : compactRevenue.rm.seller,
        v: originalRevenue.v,
        a: motion.acquisitionMode,
        c: source.d.a[0].l,
        o: originalRevenue.o,
        k: originalRevenue.k
      };
      return source;
    };
    motion.contingentFinalists = {
      seedContract: original.seedContract,
      familyA: materializeFamily('familyA', 'tacticA', 'tactic_a'),
      familyB: materializeFamily('familyB', 'tacticB', 'tactic_b'),
      w: structuredClone(original.w)
    };
    return motion;
  });
}
