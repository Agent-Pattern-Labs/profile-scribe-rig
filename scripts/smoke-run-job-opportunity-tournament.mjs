#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'profilescribe-rig-opportunity-tournament-'));
const openRouterCalls = [];
const openRouterInputs = [];
const mcpCalls = [];
const unexpectedRequests = [];
const usage = {
  prompt_tokens: 3100,
  completion_tokens: 1250,
  total_tokens: 4350,
  cost: 0.01875
};

const server = createServer(async (request, response) => {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  if (request.url === '/mcp') {
    const envelope = JSON.parse(raw || '{}');
    const toolName = envelope.params?.name || '';
    mcpCalls.push(toolName);
    const port = server.address().port;
    const values = {
      read_profile: {
        identity: {
          fullName: 'Context Owner',
          slug: 'context-owner',
          headline: 'Builds evidence-backed operating systems'
        },
        skills: ['operations', 'workflow systems']
      },
      read_sources: [
        {
          id: 'src-context-safe',
          kind: 'website',
          label: 'Persisted safe buyer evidence',
          url: 'https://example.com/context-safe',
          status: 'monitoring',
          trustLevel: 'high'
        },
        {
          id: 'src-context-localhost',
          kind: 'website',
          label: 'Localhost source must never be fetched',
          url: `http://127.0.0.1:${port}/ssrf-probe`,
          status: 'approved'
        },
        {
          id: 'src-context-rfc1918',
          kind: 'website',
          label: 'RFC1918 source must never be fetched',
          url: 'http://10.0.0.1/internal',
          status: 'approved'
        },
        {
          id: 'src-context-metadata',
          kind: 'website',
          label: 'Cloud metadata source must never be fetched',
          url: 'http://169.254.169.254/latest/meta-data',
          status: 'approved'
        }
      ],
      read_source_evidence: [
        {
          observationId: 'obs-context-candidate',
          sourceId: 'src-context-safe',
          kind: 'professional-directory',
          title: 'Context Buyer Co',
          summary: 'Context Buyer Co is a named operations organization in Philadelphia, Pennsylvania.',
          url: 'https://example.com/context-buyer-co',
          observedAt: '2026-07-23T12:00:00Z',
          confidence: 'high'
        }
      ],
      search_timeline_posts: { results: [] },
      discover_timeline_posts: { results: [] }
    };
    if (!(toolName in values)) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        jsonrpc: '2.0',
        id: envelope.id,
        error: { code: -32601, message: `unexpected MCP tool ${toolName}` }
      }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      jsonrpc: '2.0',
      id: envelope.id,
      result: {
        content: [{
          type: 'text',
          text: JSON.stringify(values[toolName])
        }]
      }
    }));
    return;
  }
  if (request.url !== '/openrouter') {
    unexpectedRequests.push({ method: request.method, url: request.url, raw });
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { message: 'unexpected non-OpenRouter request' } }));
    return;
  }

  const envelope = JSON.parse(raw || '{}');
  openRouterCalls.push(envelope);
  const userMessage = envelope.messages?.find((message) => message.role === 'user')?.content || '{}';
  const input = JSON.parse(userMessage);
  openRouterInputs.push(input);
  const evidenceIDs = (input.evidenceCatalog || []).map((item) => item.id);
  const sourceRef = evidenceIDs.find((id) => id.startsWith('source:')) || evidenceIDs[0];
  const proofRef = evidenceIDs.find(
    (id) => id === 'observation:obs-delivery-proof'
  ) || evidenceIDs.find((id) => id.startsWith('observation:')) || evidenceIDs[1] || sourceRef;
  const timingEvidenceRef = evidenceIDs.find(
    (id) => id === 'observation:obs-delivery-proof'
  ) || proofRef;
  const timelineRef = evidenceIDs.find((id) => id === 'timeline:peer-post-smoke');
  const structuredPersonRef = evidenceIDs.find((id) => id === 'observation:obs-structured-person');
  const modelCandidateRef = evidenceIDs.find((id) =>
    id === 'observation:obs-model-candidate' ||
    id === 'observation:obs-context-candidate' ||
    id === 'observation:obs-org-binding' ||
    id === 'observation:obs-patient-inbound'
  );
  const promotableCandidateRef = evidenceIDs.find(
    (id) => id === 'observation:obs-promotable-candidate'
  );
  const ownerOrganizationRef = evidenceIDs.find(
    (id) => id === 'observation:obs-owner-organization'
  );
  const proofOnlyOrganizationRef = evidenceIDs.find(
    (id) => id === 'observation:obs-proof-only-organization'
  );
  const genericOrganizationRef = evidenceIDs.find(
    (id) => id === 'observation:obs-generic-organization'
  );
  const unsupportedTimingRef = evidenceIDs.find(
    (id) => id === 'observation:obs-unsupported-timing'
  );
  const forgedTimingRef = input.evidenceCatalog?.find((item) =>
    item.label === 'Forged current demand signal'
  )?.id;
  const inactiveTimingRef = evidenceIDs.find(
    (id) => id === 'observation:obs-inactive-timing'
  );
  const oldTimingRef = evidenceIDs.find(
    (id) => id === 'observation:obs-old-timing'
  );
  const endedTimingRef = evidenceIDs.find(
    (id) => id === 'observation:obs-ended-timing'
  );
  const unknownFamilyRef = evidenceIDs.find(
    (id) => id === 'observation:obs-unknown-family'
  );
  const familyUHCEvidenceRef = evidenceIDs.find(
    (id) => id === 'observation:obs-family-uhc'
  );
  const familyBabyEvidenceRef = evidenceIDs.find(
    (id) => id === 'observation:obs-family-baby'
  );
  const mixedMotionEvidenceRef = evidenceIDs.find(
    (id) => id === 'observation:obs-mixed-motion'
  );
  const proofMotionConflictEvidenceRef = evidenceIDs.find(
    (id) => id === 'observation:obs-proof-motion-conflict'
  );
  const companyKindEvidenceRef = evidenceIDs.find(
    (id) => id === 'observation:obs-company-kind'
  );
  const staleUrgencyEvidenceRef = evidenceIDs.find(
    (id) => id === 'observation:obs-stale-urgency'
  );
  const familyCollisionEvidenceRef = evidenceIDs.find(
    (id) => id === 'observation:obs-family-collision'
  );
  const patientInboundEvidenceRef = evidenceIDs.find(
    (id) => id === 'observation:obs-patient-inbound'
  );
  const crossMotionTimingEvidenceRef = evidenceIDs.find(
    (id) => id === 'observation:obs-cross-motion-timing'
  );
  const profileIdentityRef = evidenceIDs.find((id) => id === 'profile:identity');
  const candidateFitRefs = [
    sourceRef,
    timelineRef,
    structuredPersonRef,
    modelCandidateRef,
    companyKindEvidenceRef,
    proofRef,
    profileIdentityRef
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const groundingRefs = [
    ...candidateFitRefs,
    proofRef,
    promotableCandidateRef,
    ownerOrganizationRef,
    proofOnlyOrganizationRef,
    genericOrganizationRef,
    unsupportedTimingRef,
    forgedTimingRef,
    inactiveTimingRef,
    oldTimingRef,
    unknownFamilyRef,
    mixedMotionEvidenceRef,
    proofMotionConflictEvidenceRef,
    staleUrgencyEvidenceRef,
    familyCollisionEvidenceRef,
    patientInboundEvidenceRef
  ]
    .filter((value, index, values) => value && values.indexOf(value) === index);
  const strategyFamilies = [
    {
      id: 'workflow-audit',
      l: 'Workflow audit motion',
      e: groundingRefs
    },
    {
      id: 'implementation-diagnostic',
      l: 'Implementation diagnostic motion',
      e: groundingRefs
    },
    {
      id: 'pilot-plan',
      l: 'Pilot plan motion',
      e: groundingRefs
    },
    {
      id: 'operating-review',
      l: 'Operating review motion',
      e: groundingRefs
    }
  ];
  const timingSupportPhrases = timingEvidenceRef === 'observation:obs-delivery-proof'
    ? [
        'review-gated client delivery workflow',
        'handoff bottlenecks',
        'one prioritized operating change',
        'workflow identifies handoff bottlenecks'
      ]
    : Array(4).fill(
        input.evidenceCatalog?.find((item) => item.id === timingEvidenceRef)?.label ||
        'approved evidence'
      );
  const timingLabels = timingEvidenceRef === 'observation:obs-delivery-proof'
    ? [
        'Determine whether the review-gated client delivery workflow supports acting',
        'Determine whether the observed handoff bottlenecks support acting',
        'Determine whether one prioritized operating change supports acting',
        'Determine whether the workflow identifies handoff bottlenecks before acting'
      ]
    : timingSupportPhrases.map((phrase, index) =>
        `Determine whether ${phrase} supports acting on the ${strategyFamilies[index].l}`
      );
  const scoreKeys = {
    objectiveFit: 'of',
    evidenceStrength: 'es',
    buyerAuthority: 'ba',
    timing: 'ti',
    warmPath: 'wp',
    reachability: 're',
    expectedValue: 'ev',
    effort: 'ef',
    cost: 'co',
    risk: 'ri',
    uncertainty: 'un'
  };
  const compactScores = (scores) => Object.fromEntries(
    Object.entries(scores).map(([key, value]) => [scoreKeys[key] || key, value])
  );
  const make = (prefix, labels, scores, refs = [sourceRef, proofRef]) => labels.map((label, index) => ({
    id: `${prefix}-${index + 1}`,
    l: label,
    f: [strategyFamilies[index % strategyFamilies.length].id],
    e: refs,
    r: `${label} is a bounded interpretation of the supplied evidence.`,
    u: 'The buyer response and timing have not yet been observed.',
    s: compactScores(scores)
  }));
  const buyerSeeds = make('buyer', [
    'Founder-led professional service businesses',
    'Small agency operations leaders',
    'Independent consultants with repeatable delivery',
    'Boutique service founders improving client workflows'
  ], {
    objectiveFit: 0.82,
    buyerAuthority: 0.78,
    expectedValue: 0.74,
    uncertainty: 0.45
  }, candidateFitRefs);
  if (promotableCandidateRef) {
    const promotableIndex = modelCandidateRef ? 1 : 0;
    buyerSeeds[0].e = [modelCandidateRef || promotableCandidateRef, proofRef];
    buyerSeeds[promotableIndex].l = 'Promotable Buyer Co operations leaders';
    buyerSeeds[promotableIndex].e = [promotableCandidateRef, proofRef];
    buyerSeeds[promotableIndex].s.of = 0.81;
    buyerSeeds[promotableIndex].s.ba = 0.77;
  } else if (modelCandidateRef === 'observation:obs-context-candidate') {
    buyerSeeds[0].l = 'Context Buyer Co operations leaders';
    buyerSeeds[0].e = [modelCandidateRef, proofRef];
    buyerSeeds[0].s.of = 1;
    buyerSeeds[0].s.ba = 1;
    buyerSeeds[0].s.ev = 1;
  } else if (ownerOrganizationRef) {
    buyerSeeds[1].l = 'Owner Services Co operations leaders';
    buyerSeeds[1].e = [ownerOrganizationRef, proofRef];
  } else if (proofOnlyOrganizationRef) {
    buyerSeeds[1].e = [proofOnlyOrganizationRef, proofRef];
  } else if (genericOrganizationRef) {
    buyerSeeds[1].l = 'Digital Health Network operations leaders';
    buyerSeeds[1].e = [genericOrganizationRef, proofRef];
  }
  const seedSet = {
    families: strategyFamilies,
    offers: make('offer', [
      'A paid focused workflow audit',
      'A paid implementation diagnostic',
      'A paid proof-backed pilot',
      'A paid narrow operating-system review'
    ], {
      objectiveFit: 0.9,
      evidenceStrength: 0.9,
      expectedValue: 0.82,
      effort: 0.32,
      cost: 0.18,
      risk: 0.2,
      uncertainty: 0.38
    }, groundingRefs),
    buyerSegments: buyerSeeds,
    channels: make('channel', [
      'One warm referral introduction',
      'One permissioned professional-network introduction request',
      'One inbound paid-offer discovery path',
      'One existing-customer referral path'
    ], {
      warmPath: 0.78,
      reachability: 0.52,
      effort: 0.3,
      cost: 0.1,
      risk: 0.18,
      uncertainty: 0.4
    }),
    actions: make('action', [
      'Prepare one paid workflow-audit offer and booking request for a warm introduction',
      'Prepare one paid implementation-diagnostic proposal and permissioned contract request',
      'Prepare one paid pilot offer and inbound checkout request',
      'Prepare one paid operating-system review offer and existing-customer referral booking request'
    ], {
      objectiveFit: 0.84,
      expectedValue: 0.7,
      effort: 0.3,
      cost: 0.12,
      risk: 0.16,
      uncertainty: 0.36
    }),
    timingTriggers: make('timing', timingLabels, {
      evidenceStrength: 0.72,
      timing: 0.68,
      risk: 0.22,
      uncertainty: 0.48
    }, [timingEvidenceRef, proofRef]).map((item, index) => ({
      ...item,
      q: timingSupportPhrases[index]
    })),
    proofPoints: make('proof', [
      'The documented client workflow',
      'The source-backed operating method',
      'The demonstrated implementation capability',
      'The concrete professional-service evidence'
    ], {
      objectiveFit: 0.8,
      evidenceStrength: 0.94,
      risk: 0.14,
      uncertainty: 0.28
    }, [sourceRef, proofRef]),
    followUps: make('followup', [
      'Stop after one unanswered review-gated attempt',
      'Request human review before any follow-up',
      'Record the outcome before selecting another strategy',
      'Use one permissioned clarification only'
    ], {
      objectiveFit: 0.76,
      effort: 0.22,
      cost: 0.08,
      risk: 0.12,
      uncertainty: 0.3
    }),
    revenuePaths: [
      {
        id: 'revenue-path-1',
        l: 'One new paid workflow-audit booking through a warm referral',
        f: [strategyFamilies[0].id],
        e: groundingRefs,
        contractVersion: 'incremental_revenue_v1',
        revenueMechanism: 'paid_booking',
        incrementalIncomeOutcome: 'One new paid workflow-audit booking adds incremental gross income',
        acquisitionMode: 'warm_referral',
        conversionAction: 'Prepare one paid workflow-audit offer and booking request for a warm introduction',
        observableRevenueOutcome: 'One paid booking recorded',
        attributionMethod: 'booking_record',
        attributionSignal: 'Booking record source field stores the warm referral',
        vm: 250000,
        s: compactScores({
          objectiveFit: 0.88,
          evidenceStrength: 0.86,
          expectedValue: 0.8,
          risk: 0.22,
          uncertainty: 0.42
        })
      },
      {
        id: 'revenue-path-2',
        l: 'One new paid implementation contract through permissioned outreach',
        f: [strategyFamilies[1].id],
        e: groundingRefs,
        contractVersion: 'incremental_revenue_v1',
        revenueMechanism: 'signed_contract',
        incrementalIncomeOutcome: 'One new paid implementation contract adds incremental gross income',
        acquisitionMode: 'permissioned_outreach',
        conversionAction: 'Prepare one paid implementation-diagnostic proposal and permissioned contract request',
        observableRevenueOutcome: 'One signed contract recorded',
        attributionMethod: 'invoice_or_contract',
        attributionSignal: 'Contract source field records the permissioned professional-network introduction',
        vm: 500000,
        s: compactScores({
          objectiveFit: 0.86,
          evidenceStrength: 0.84,
          expectedValue: 0.84,
          risk: 0.24,
          uncertainty: 0.44
        })
      },
      {
        id: 'revenue-path-3',
        l: 'One new paid pilot order through inbound offer discovery',
        f: [strategyFamilies[2].id],
        e: groundingRefs,
        contractVersion: 'incremental_revenue_v1',
        revenueMechanism: 'paid_pilot',
        incrementalIncomeOutcome: 'One new paid pilot order adds incremental gross income',
        acquisitionMode: 'inbound',
        conversionAction: 'Prepare one paid pilot offer and inbound checkout request',
        observableRevenueOutcome: 'One paid pilot order recorded at checkout',
        attributionMethod: 'checkout_or_order',
        attributionSignal: 'Checkout order record stores the inbound UTM source',
        vm: 750000,
        s: compactScores({
          objectiveFit: 0.84,
          evidenceStrength: 0.82,
          expectedValue: 0.86,
          risk: 0.26,
          uncertainty: 0.46
        })
      },
      {
        id: 'revenue-path-4',
        l: 'One new paid operating review through an existing-customer referral',
        f: [strategyFamilies[3].id],
        e: groundingRefs,
        contractVersion: 'incremental_revenue_v1',
        revenueMechanism: 'paid_booking',
        incrementalIncomeOutcome: 'One new paid operating review adds incremental gross income',
        acquisitionMode: 'existing_customer',
        conversionAction: 'Prepare one paid operating-system review offer and existing-customer referral booking request',
        observableRevenueOutcome: 'One paid booking recorded',
        attributionMethod: 'booking_record',
        attributionSignal: 'Booking record source field stores the existing-customer referral',
        vm: 350000,
        s: compactScores({
          objectiveFit: 0.82,
          evidenceStrength: 0.8,
          expectedValue: 0.78,
          risk: 0.2,
          uncertainty: 0.4
        })
      }
    ],
    candidates: modelCandidateRef === 'observation:obs-model-candidate' ? [
      {
        k: 'person',
        l: 'Avery Decisionmaker',
        o: 'Exact Buyer Co',
        r: 'Operations Director',
        m: 'Boston, Massachusetts',
        u: 'https://example.com/avery-decisionmaker',
        e: [modelCandidateRef]
      },
      {
        k: 'person',
        l: 'Invented Person Must Not Appear',
        u: 'https://example.com/invented-person',
        e: [modelCandidateRef]
      },
      {
        k: 'person',
        l: 'Avery Decisionmaker',
        u: 'https://example.com/invented-avery-url',
        e: [modelCandidateRef]
      }
    ] : modelCandidateRef === 'observation:obs-context-candidate' ? [{
      k: 'organization',
      l: 'Context Buyer Co',
      m: 'Philadelphia, Pennsylvania',
      u: 'https://example.com/context-buyer-co',
      e: [modelCandidateRef]
    }] : modelCandidateRef === 'observation:obs-org-binding' ? [{
      // Deliberately misclassify an obvious organization as a person. The
      // candidate gate must derive the buyer-binding requirement from the
      // evidence/name too, rather than trusting the model-declared kind.
      k: 'person',
      l: 'United Healthcare',
      e: [modelCandidateRef]
    }, {
      k: 'person',
      l: 'UnitedHealthcare',
      e: [modelCandidateRef]
    }, {
      k: 'person',
      l: 'UHC',
      e: [modelCandidateRef]
    }] : modelCandidateRef === 'observation:obs-patient-inbound' ? [{
      k: 'organization',
      l: 'United Healthcare',
      e: [modelCandidateRef]
    }] : [],
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
  if (promotableCandidateRef) {
    seedSet.offers[0].l = 'Paid focused workflow audit for Promotable Buyer Co';
  } else if (ownerOrganizationRef) {
    seedSet.offers[0].l = 'Paid focused workflow audit for Owner Services Co';
  } else if (proofOnlyOrganizationRef) {
    seedSet.offers[0].l = 'Paid focused workflow audit for Proof Only Co';
  } else if (genericOrganizationRef) {
    seedSet.offers[0].l = 'Paid focused workflow audit for Digital Health Network';
  }
  if (promotableCandidateRef ||
      ownerOrganizationRef ||
      proofOnlyOrganizationRef ||
      genericOrganizationRef) {
    seedSet.families = seedSet.families.slice(0, 2);
    for (const key of [
      'offers',
      'buyerSegments',
      'channels',
      'actions',
      'timingTriggers',
      'proofPoints',
      'followUps',
      'revenuePaths'
    ]) {
      seedSet[key] = seedSet[key].slice(0, 2);
    }
    for (const key of [
      'offers',
      'channels',
      'actions',
      'timingTriggers',
      'proofPoints',
      'followUps',
      'revenuePaths'
    ]) {
      for (const scoreKey of Object.keys(seedSet[key][1].s || {})) {
        seedSet[key][1].s[scoreKey] = ['ef', 'co', 'ri', 'un'].includes(scoreKey)
          ? 0.55
          : 0.45;
      }
    }
  }
  if (unsupportedTimingRef) {
    for (const [index, timing] of seedSet.timingTriggers.entries()) {
      timing.l = index === 0
        ? 'Enrollment window'
        : index === 1
          ? '2026 enrollment window'
          : 'Act now on the United Healthcare provider network';
      timing.e = [unsupportedTimingRef];
      timing.q = index === 0
        ? 'enrollment window'
        : index === 1 ? '2026 enrollment window' : 'United Healthcare';
    }
  }
  if (forgedTimingRef) {
    for (const family of seedSet.families) {
      // The explicit fact may be family context, but it cannot mint an
      // observation:* identity or become eligible for timing repair.
      family.e = [proofRef, forgedTimingRef];
    }
    for (const dimension of [
      'offers',
      'buyerSegments',
      'channels',
      'actions',
      'timingTriggers',
      'proofPoints',
      'followUps',
      'revenuePaths'
    ]) {
      for (const item of seedSet[dimension]) {
        item.e = [forgedTimingRef];
        if (dimension === 'timingTriggers') {
          item.l = 'Determine whether forged current demand supports acting';
          item.q = 'forged current demand';
        }
      }
    }
  }
  const metadataBlockedTimingRef =
    inactiveTimingRef || oldTimingRef || endedTimingRef;
  if (metadataBlockedTimingRef) {
    for (const family of seedSet.families) {
      family.e = [metadataBlockedTimingRef];
    }
    for (const dimension of [
      'offers',
      'buyerSegments',
      'channels',
      'actions',
      'timingTriggers',
      'proofPoints',
      'followUps',
      'revenuePaths'
    ]) {
      for (const item of seedSet[dimension]) {
        item.e = [metadataBlockedTimingRef];
        if (dimension === 'timingTriggers') {
          item.l = oldTimingRef
            ? 'Book today'
            : 'Determine whether current booking availability supports acting';
          item.q = oldTimingRef
            ? 'Book today'
            : 'current booking availability';
        }
      }
    }
  }
  if (familyUHCEvidenceRef && familyBabyEvidenceRef) {
    seedSet.families[0].e = [
      ...groundingRefs,
      familyUHCEvidenceRef
    ];
    seedSet.actions.push({
      id: 'action-mistagged-baby-friendly',
      l: 'Submit a Baby-Friendly hospital program proposal',
      f: [seedSet.families[0].id],
      e: [familyBabyEvidenceRef],
      r: 'Deliberately mistagged regression fixture.',
      s: compactScores({
        objectiveFit: 1,
        evidenceStrength: 1,
        expectedValue: 1,
        effort: 0,
        cost: 0,
        risk: 0,
        uncertainty: 0
      })
    });
    seedSet.channels.push({
      id: 'channel-mistagged-baby-friendly',
      l: 'Baby-Friendly hospital coordinators',
      f: [seedSet.families[0].id],
      e: [familyBabyEvidenceRef],
      r: 'Deliberately mistagged regression fixture.',
      s: compactScores({
        warmPath: 1,
        reachability: 1,
        effort: 0,
        cost: 0,
        risk: 0,
        uncertainty: 0
      })
    });
  }
  if (mixedMotionEvidenceRef) {
    for (const family of seedSet.families) {
      family.e = [mixedMotionEvidenceRef];
    }
    const mixedLabels = {
      offers: 'A relationship review for United Healthcare partnership executives',
      buyerSegments: 'United Healthcare partnership executives',
      channels: 'One institutional introduction',
      actions: 'Prepare a birth-center accreditation plan',
      timingTriggers: 'Determine whether United Healthcare partnership executives support acting',
      proofPoints: 'IBCLC credential',
      followUps: 'Review one relationship outcome before another action'
    };
    for (const [dimension, label] of Object.entries(mixedLabels)) {
      for (const item of seedSet[dimension]) {
        item.l = label;
        item.e = [mixedMotionEvidenceRef];
        if (dimension === 'timingTriggers') {
          item.q = 'United Healthcare partnership executives';
        }
      }
    }
  }
  if (proofMotionConflictEvidenceRef) {
    for (const family of seedSet.families) {
      family.e = [proofMotionConflictEvidenceRef];
    }
    const proofConflictLabels = {
      offers: 'United Healthcare-covered patient consultation booking path',
      buyerSegments: 'United Healthcare-covered prospective patients',
      channels: 'Existing patient service-page',
      actions: 'Prepare one patient-facing booking-path review',
      timingTriggers: 'Determine whether United Healthcare acceptance supports acting',
      proofPoints: 'Baby-Friendly hospital accreditation expertise',
      followUps: 'Review one patient inquiry outcome before another action'
    };
    for (const [dimension, label] of Object.entries(proofConflictLabels)) {
      for (const item of seedSet[dimension]) {
        item.l = label;
        item.e = [proofMotionConflictEvidenceRef];
        if (dimension === 'timingTriggers') {
          item.q = 'accepts United Healthcare';
        }
      }
    }
  }
  if (staleUrgencyEvidenceRef) {
    for (const family of seedSet.families) {
      family.e = [staleUrgencyEvidenceRef];
    }
    const staleLabels = [
      'Urgent opportunity',
      'Act soon',
      'Imminent deadline',
      'Deadline this week'
    ];
    for (const dimension of [
      'offers',
      'buyerSegments',
      'channels',
      'actions',
      'timingTriggers',
      'proofPoints',
      'followUps',
      'revenuePaths'
    ]) {
      for (const [index, item] of seedSet[dimension].entries()) {
        item.e = [staleUrgencyEvidenceRef];
        if (dimension === 'timingTriggers') {
          item.l = staleLabels[index];
          item.q = staleLabels[index];
        }
      }
    }
  }
  if (patientInboundEvidenceRef) {
    seedSet.families = seedSet.families.slice(0, 2);
    for (const family of seedSet.families) {
      family.e = [patientInboundEvidenceRef];
    }
    const patientLabels = {
      offers: [
        'A reimbursable United Healthcare-covered patient consultation',
        'A billable United Healthcare patient consultation'
      ],
      buyerSegments: [
        'United Healthcare-covered prospective patients',
        'United Healthcare-covered parents seeking lactation consultations'
      ],
      channels: [
        'Existing patient service-page',
        'Existing consultation booking page'
      ],
      actions: [
        'Prepare one reimbursable consultation offer and inbound paid-booking request',
        'Prepare one billable consultation offer and inbound service-page booking request'
      ],
      timingTriggers: [
        'Determine whether United Healthcare acceptance supports acting',
        'Determine whether United Healthcare acceptance remains valid'
      ],
      proofPoints: [
        'The practice accepts United Healthcare for eligible lactation consultations',
        'The existing service supports United Healthcare-covered consultations'
      ],
      followUps: [
        'Review one patient inquiry outcome before another action',
        'Review one consultation booking outcome before another action'
      ]
    };
    for (const [dimension, labels] of Object.entries(patientLabels)) {
      seedSet[dimension] = seedSet[dimension].slice(0, 2);
      for (const [index, item] of seedSet[dimension].entries()) {
        item.l = labels[index];
        item.e = [patientInboundEvidenceRef];
        item.f = [seedSet.families[index].id];
        if (dimension === 'timingTriggers') {
          // Exercise the production-shaped repair: the model paraphrases the
          // source ("accepts" -> "acceptance"), so the parser must replace
          // this with a conservative exact-evidence verification checkpoint.
          item.q = 'United Healthcare acceptance';
        }
      }
    }
    seedSet.revenuePaths = seedSet.revenuePaths.slice(0, 2);
    const patientRevenuePaths = [
      {
        l: 'One new reimbursed patient consultation through an inbound service page',
        incrementalIncomeOutcome: 'One new reimbursed patient consultation adds incremental gross income',
        conversionAction: 'Prepare one reimbursable consultation offer and inbound paid-booking request',
        observableRevenueOutcome: 'One claim paid and reimbursement received',
        attributionSignal: 'Claim record acquisition source field stores the inbound service page'
      },
      {
        l: 'One new billable patient consultation through an inbound booking page',
        incrementalIncomeOutcome: 'One new paid patient consultation adds incremental gross income',
        conversionAction: 'Prepare one billable consultation offer and inbound service-page booking request',
        observableRevenueOutcome: 'One paid booking recorded',
        attributionSignal: 'Booking record source field stores the inbound service page'
      }
    ];
    for (const [index, item] of seedSet.revenuePaths.entries()) {
      Object.assign(item, patientRevenuePaths[index], {
        e: [patientInboundEvidenceRef],
        f: [seedSet.families[index].id],
        contractVersion: 'incremental_revenue_v1',
        revenueMechanism: index === 0
          ? 'insurance_reimbursement'
          : 'paid_booking',
        acquisitionMode: 'inbound',
        attributionMethod: index === 0
          ? 'claim_record'
          : 'booking_record',
        vm: index === 0 ? 180000 : 160000
      });
    }
    if (input.objective?.id === 'obj-uhc-eligibility-scheduling-no-revenue') {
      for (const [index, offer] of seedSet.offers.entries()) {
        offer.l = index === 0
          ? 'United Healthcare eligibility and scheduling workflow'
          : 'United Healthcare coverage verification workflow';
      }
      for (const [index, action] of seedSet.actions.entries()) {
        action.l = index === 0
          ? 'Verify eligibility and coverage, then book a consultation'
          : 'Prepare one inbound content post about eligibility and scheduling';
        action.s = compactScores({
          objectiveFit: 1,
          evidenceStrength: 1,
          expectedValue: 1,
          effort: 0,
          cost: 0,
          risk: 0,
          uncertainty: 0
        });
      }
      for (const [index, revenuePath] of seedSet.revenuePaths.entries()) {
        Object.assign(revenuePath, {
          l: 'Eligibility verification and consultation scheduling',
          incrementalIncomeOutcome:
            'Verify eligibility and schedule one consultation',
          conversionAction: index === 0
            ? 'Verify eligibility and coverage, then book a consultation'
            : 'Prepare one inbound content post about eligibility and scheduling',
          observableRevenueOutcome:
            'One eligible consultation scheduled',
          attributionSignal:
            'Eligibility record stores coverage status',
          vm: 9_999_999,
          s: compactScores({
            objectiveFit: 1,
            evidenceStrength: 1,
            expectedValue: 1,
            effort: 0,
            cost: 0,
            risk: 0,
            uncertainty: 0
          })
        });
      }
    }
  }
  if (familyCollisionEvidenceRef) {
    seedSet.families = [
      {
        id: 'hospital.program',
        l: 'Hospital program motion',
        e: [familyCollisionEvidenceRef]
      },
      {
        id: 'hospital-program',
        l: 'Employer program motion',
        e: [familyCollisionEvidenceRef]
      }
    ];
    for (const dimension of [
      'offers',
      'buyerSegments',
      'channels',
      'actions',
      'timingTriggers',
      'proofPoints',
      'followUps',
      'revenuePaths'
    ]) {
      for (const [index, item] of seedSet[dimension].entries()) {
        item.f = [index % 2 === 0 ? 'hospital.program' : 'hospital-program'];
        item.e = [familyCollisionEvidenceRef];
        if (dimension === 'timingTriggers') {
          item.l = 'Determine whether family collision evidence supports acting';
          item.q = 'family collision evidence';
        }
      }
    }
  }
  if (unknownFamilyRef) {
    for (const key of [
      'offers',
      'buyerSegments',
      'channels',
      'actions',
      'timingTriggers',
      'proofPoints',
      'followUps',
      'revenuePaths'
    ]) {
      for (const item of seedSet[key]) item.f = ['undeclared-family'];
    }
  }
  let responseSeedSet = seedSet;
  if ([
    'obj-nested-family-bundles',
    'obj-persisted-context-family-bundles',
    'obj-incomplete-family-bundles',
    'obj-forged-timing-family-bundles',
    'obj-inactive-timing-family-bundles',
    'obj-old-timing-family-bundles',
    'obj-ended-timing-family-bundles'
  ].includes(input.objective?.id)) {
    const multiVariantDimensions = new Set([
      'offers',
      'buyerSegments',
      'channels',
      'actions',
      'followUps'
    ]);
    const nestedFamilies = seedSet.families.slice(0, 2).map((family, familyIndex) => {
      const familyIndexes = familyIndex === 0 ? [0, 2] : [1, 3];
      const distributedFamilyEvidenceRef = familyIndex === 0
        ? modelCandidateRef
        : structuredPersonRef;
      const exerciseDistributedEvidence =
        input.objective?.id === 'obj-nested-family-bundles' &&
        distributedFamilyEvidenceRef &&
        proofRef &&
        distributedFamilyEvidenceRef !== proofRef;
      const dimensions = {};
      for (const dimension of [
        'offers',
        'buyerSegments',
        'channels',
        'actions',
        'timingTriggers',
        'proofPoints',
        'followUps',
        'revenuePaths'
      ]) {
        const indexes = multiVariantDimensions.has(dimension)
          ? familyIndexes
          : [familyIndex];
        dimensions[dimension] = indexes.map((index) => {
          const { f: _familyIds, ...item } = seedSet[dimension][index];
          const nestedItem = {
            ...structuredClone(item),
            // Models commonly restart local ids inside each bundle. The
            // parser must namespace them by the fixed parent family.
            id: `${dimension}-${indexes.indexOf(index) + 1}`
          };
          if (exerciseDistributedEvidence) {
            nestedItem.e = dimension === 'revenuePaths'
              ? [distributedFamilyEvidenceRef, proofRef]
              : ['offers', 'buyerSegments'].includes(dimension)
                ? [distributedFamilyEvidenceRef]
                : [proofRef];
          }
          if (dimension === 'timingTriggers') {
            nestedItem.q = 'model paraphrase absent from the cited observation';
          }
          return nestedItem;
        });
      }
      return {
        ...structuredClone(family),
        e: exerciseDistributedEvidence
          ? [distributedFamilyEvidenceRef, proofRef]
          : structuredClone(family.e),
        // The fixed top-level wrapper is the trusted namespace boundary; a
        // duplicated model-supplied id must not collapse the two bundles.
        id: 'model-duplicated-id',
        m: 'organization_partnership',
        d: dimensions
      };
    });
    if (input.objective?.id === 'obj-nested-family-bundles') {
      const omittedRevenueCoreRef =
        nestedFamilies[0].d.offers[0]?.e?.[0];
      nestedFamilies[0].e = nestedFamilies[0].e.filter(
        (ref) => ref !== omittedRevenueCoreRef
      );
      // A fixed family wrapper is the namespace boundary. The normalizer must
      // derive its canonical evidence union from the nested revenue-bearing
      // items instead of discarding an otherwise valid family because the
      // model forgot to repeat one approved ref in the redundant family list.
      const foreignTimingRef = nestedFamilies[1].e.find((ref) =>
        !nestedFamilies[0].e.includes(ref)
      );
      if (foreignTimingRef) {
        // Exercise the production-shaped one-call failure: the model placed
        // family B evidence on family A's only timing item. Normalization may
        // salvage timing only by using a safe observation already accepted by
        // family A and rewriting the item as a conservative verification.
        nestedFamilies[0].d.timingTriggers[0].e = [foreignTimingRef];
      }
    }
    if (input.objective?.id === 'obj-incomplete-family-bundles') {
      nestedFamilies[1].d.timingTriggers = [];
    }
    responseSeedSet = {
      seedContract: 'revenue_family_bundle_v1',
      familyA: nestedFamilies[0],
      familyB: nestedFamilies[1],
      // A fixed-bundle response must ignore this legacy/global injection even
      // though it self-declares both families and cites their evidence.
      offers: [{
        id: 'forbidden-global-offer',
        l: 'Forbidden cross-family global offer',
        f: ['family-a', 'family-b'],
        e: [
          ...nestedFamilies[0].e,
          ...nestedFamilies[1].e
        ]
      }],
      candidates: structuredClone(seedSet.candidates),
      w: structuredClone(seedSet.w)
    };
  }
  if (crossMotionTimingEvidenceRef && patientInboundEvidenceRef) {
    const dimensions = {};
    for (const dimension of [
      'offers',
      'buyerSegments',
      'channels',
      'actions',
      'timingTriggers',
      'proofPoints',
      'followUps',
      'revenuePaths'
    ]) {
      const { f: _familyIds, ...familyAItem } =
        structuredClone(seedSet[dimension][0]);
      const { f: _otherFamilyIds, ...familyBItem } =
        structuredClone(seedSet[dimension][1]);
      familyAItem.e = [crossMotionTimingEvidenceRef];
      familyBItem.e = [patientInboundEvidenceRef];
      if (dimension === 'timingTriggers') {
        familyAItem.e = [patientInboundEvidenceRef];
        familyAItem.l =
          'Determine whether applications are accepted today';
        familyAItem.q = 'applications are accepted today';
      }
      dimensions[dimension] = {
        familyA: [familyAItem],
        familyB: [familyBItem]
      };
    }
    responseSeedSet = {
      familyA: {
        id: 'family-a',
        l: 'Patient inbound family with a cross-motion evidence trap',
        m: 'patient_inbound',
        e: [crossMotionTimingEvidenceRef],
        d: Object.fromEntries(Object.entries(dimensions).map(
          ([dimension, values]) => [dimension, values.familyA]
        ))
      },
      familyB: {
        id: 'family-b',
        l: 'Grounded patient inbound control family',
        m: 'patient_inbound',
        e: [patientInboundEvidenceRef],
        d: Object.fromEntries(Object.entries(dimensions).map(
          ([dimension, values]) => [dimension, values.familyB]
        ))
      },
      candidates: [],
      w: structuredClone(seedSet.w)
    };
  }

  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({
    id: `gen-tournament-${openRouterCalls.length}`,
    choices: [{ message: { content: JSON.stringify(responseSeedSet) } }],
    usage
  }));
});

try {
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  const job = {
    id: 'job-opportunity-tournament-smoke',
    kind: 'opportunity_tournament',
    tenantId: 'tenant-smoke',
    userId: 'user-smoke',
    payload: {
      tournamentId: 'opturn-smoke',
      algorithmVersion: 'cheap_tournament_v3',
      researchOnly: true,
      objective: {
        id: 'obj-smoke',
        outcome: 'Generate one new paid professional-service engagement.',
        successMetric: 'One payment receipt, paid booking, or signed contract attributed to the recommendation.',
        targetCount: 1,
        deadline: '2026-08-31T00:00:00Z',
        estimatedValueMicros: 5_000_000,
        currency: 'USD',
        allowedActions: ['research', 'recommend', 'review'],
        constraints: [
          'Research and recommendation only; do not contact, message, publish, purchase ads, or submit forms.'
        ]
      },
      budget: {
        currency: 'USD',
        maxSpendMicros: 1_000_000,
        maxLLMSpendMicros: 300_000,
        maxHypotheses: 10_000,
        maxFinalists: 20,
        maxLLMCalls: 1,
        hardStop: true
      },
      evidenceSnapshot: {
        profile: {
          identity: {
            fullName: 'Casey Founder',
            slug: 'casey-founder',
            headline: 'Improves delivery systems for professional-service businesses'
          },
          currentFocus: [{
            id: 'focus-workflow',
            name: 'A focused client-delivery diagnostic',
            description: 'Maps recurring delivery bottlenecks into reviewable operating changes.'
          }],
          projects: [{
            id: 'project-delivery-map',
            name: 'Delivery Map',
            description: 'A structured method for diagnosing handoff and review bottlenecks.'
          }],
          skills: ['workflow diagnostics', 'professional services', 'operations']
        },
        sources: [
          {
            id: 'src-delivery-map',
            kind: 'website',
            label: 'Delivery Map',
            url: 'https://example.com/delivery-map',
            status: 'monitoring',
            trustLevel: 'high',
            summary: 'Documents the delivery diagnostic and its review-gated workflow.'
          },
          {
            id: 'src-queued',
            kind: 'website',
            label: 'Queued source must not ground the tournament',
            url: 'https://example.com/queued',
            status: 'queued'
          },
          {
            id: 'src-rejected',
            kind: 'website',
            label: 'Rejected source must not ground the tournament',
            url: 'https://example.com/rejected',
            status: 'rejected'
          },
          {
            id: 'src-disabled',
            kind: 'website',
            label: 'Disabled source must not ground the tournament',
            url: 'https://example.com/disabled',
            status: 'disabled'
          },
          {
            id: 'src-unknown-status',
            kind: 'website',
            label: 'Unknown-status source must not ground the tournament',
            url: 'https://example.com/unknown',
            status: 'mystery'
          },
          ...Array.from({ length: 27 }, (_, index) => ({
            id: `src-approved-noise-${String(index + 1).padStart(2, '0')}`,
            kind: 'website',
            label: `Approved catalog pressure source ${index + 1}`,
            url: `https://example.com/catalog-pressure/source-${index + 1}`,
            status: 'approved',
            trustLevel: 'high',
            summary: `Approved catalog pressure record ${index + 1}.`
          }))
        ],
        sourceEvidence: [
          {
            observationId: 'obs-delivery-proof',
            sourceId: 'src-delivery-map',
            kind: 'case-study',
            title: 'A review-gated client delivery workflow',
            summary: 'The workflow identifies handoff bottlenecks and produces one prioritized operating change.',
            url: 'https://example.com/delivery-map/case-study',
            observedAt: '2026-07-20T12:00:00Z',
            confidence: 'high'
          },
          {
            observationId: 'obs-structured-person',
            sourceId: 'src-delivery-map',
            kind: 'professional-directory',
            title: 'Structured professional record',
            summary: 'A source record with an exact structured professional candidate.',
            observedAt: '2026-07-21T12:00:00Z',
            candidate: {
              id: 'candidate-source-person',
              fullName: 'Morgan Operator',
              role: 'Operations lead',
              organization: 'Morgan Service Co',
              market: 'Professional services',
              publicUrl: 'https://example.com/morgan-operator'
            }
          },
          {
            observationId: 'obs-model-candidate',
            sourceId: 'src-delivery-map',
            kind: 'professional-directory',
            title: 'Avery Decisionmaker at Exact Buyer Co',
            summary: 'Avery Decisionmaker is the Operations Director at Exact Buyer Co in Boston, Massachusetts.',
            url: 'https://example.com/avery-decisionmaker',
            observedAt: '2026-07-21T13:00:00Z',
            confidence: 'high'
          },
          {
            observationId: 'obs-queued-person',
            sourceId: 'src-queued',
            kind: 'professional-directory',
            title: 'QUEUED SOURCE LEAK MARKER',
            summary: 'This evidence and person must not enter the prompt or candidates.',
            candidate: {
              id: 'candidate-queued-person',
              fullName: 'Queued Candidate Must Not Appear',
              publicUrl: 'https://example.com/queued-candidate'
            }
          },
          {
            observationId: 'obs-rejected',
            sourceId: 'src-rejected',
            title: 'REJECTED SOURCE LEAK MARKER',
            summary: 'This evidence must not enter the tournament.'
          },
          {
            observationId: 'obs-disabled',
            sourceId: 'src-disabled',
            title: 'DISABLED SOURCE LEAK MARKER',
            summary: 'This evidence must not enter the tournament.'
          },
          {
            observationId: 'obs-unknown-status',
            sourceId: 'src-unknown-status',
            title: 'UNKNOWN STATUS SOURCE LEAK MARKER',
            summary: 'This evidence must not enter the tournament.'
          },
          {
            observationId: 'obs-unknown-source',
            sourceId: 'src-not-in-snapshot',
            title: 'UNKNOWN SOURCE ID LEAK MARKER',
            summary: 'This evidence must not enter the tournament.'
          },
          {
            observationId: 'obs-missing-source-id',
            title: 'MISSING SOURCE ID LEAK MARKER',
            summary: 'This evidence must not enter the tournament.'
          },
          ...Array.from({ length: 55 }, (_, index) => ({
            observationId: `obs-catalog-pressure-${String(index + 1).padStart(2, '0')}`,
            sourceId: 'src-delivery-map',
            kind: 'case-study',
            title: `Approved catalog pressure observation ${index + 1}`,
            summary: `A concrete approved evidence record used to exercise deterministic catalog capacity ${index + 1}.`,
            url: `https://example.com/catalog-pressure/evidence-${index + 1}`,
            observedAt: '2026-07-21T14:00:00Z',
            confidence: 'high'
          }))
        ],
        sourceExtracts: [
          {
            id: 'extract-approved',
            sourceId: 'src-delivery-map',
            title: 'Approved delivery-map extract',
            summary: 'An approved extract remains eligible for grounding.'
          },
          {
            id: 'extract-queued',
            sourceId: 'src-queued',
            title: 'QUEUED EXTRACT LEAK MARKER',
            summary: 'This extract must not enter the tournament.'
          },
          {
            id: 'extract-unknown',
            sourceId: 'src-not-in-snapshot',
            title: 'UNKNOWN EXTRACT LEAK MARKER',
            summary: 'This extract must not enter the tournament.'
          }
        ],
        recentTimelinePosts: [{
          id: 'peer-post-smoke',
          topic: 'Improving client delivery handoffs',
          body: 'A peer described a concrete review bottleneck in a client delivery workflow.',
          publishedAt: '2026-07-22T12:00:00Z',
          ownerTenantId: 'peer-tenant',
          ownerUserId: 'peer-user',
          authorSlug: 'peer-builder',
          authorName: 'Peer Builder',
          authorHeadline: 'Founder improving professional-service operations',
          authorCompany: 'Peer Studio',
          authorLocation: 'New York, NY'
        }],
        candidates: [
          {
            id: 'candidate-public-smoke',
            kind: 'organization',
            displayLabel: 'Example Service Studio',
            organization: 'Example Service Studio',
            role: 'Founder-led professional service organization',
            market: 'Professional services',
            publicUrl: 'https://example.com/example-service-studio',
            email: 'private-candidate@example.com',
            phone: '+1 (212) 555-0199',
            providers: ['public_web'],
            evidenceRefs: ['source:src-delivery-map'],
            selected: true,
            contactPaths: [
              {
                kind: 'public_profile',
                available: true,
                verified: false,
                reference: 'https://example.com/example-service-studio'
              },
              {
                kind: 'email',
                available: true,
                verified: true,
                reference: 'private-candidate@example.com'
              },
              {
                kind: 'phone',
                available: true,
                verified: true,
                reference: '+1 (212) 555-0199'
              },
              {
                kind: 'profile_record',
                available: true,
                verified: true,
                reference: 'candidate-record-smoke'
              },
              {
                kind: 'public_http_fixture',
                available: true,
                verified: false,
                reference: 'http://example.com/public-profile'
              },
              {
                kind: 'unsafe_loopback',
                available: true,
                verified: false,
                reference: 'http://127.0.0.1:9999/internal'
              },
              {
                kind: 'unsafe_metadata',
                available: true,
                verified: false,
                reference: 'http://169.254.169.254/latest/meta-data'
              },
              {
                kind: 'unsafe_ipv6_loopback',
                available: true,
                verified: false,
                reference: 'http://[::1]/internal'
              },
              {
                kind: 'unsafe_credentials',
                available: true,
                verified: false,
                reference: 'https://user:password@example.com/private'
              }
            ],
            identityResolved: false
          },
          {
            id: 'candidate-ungrounded-exact-person',
            kind: 'person',
            fullName: 'Ungrounded Exact Person',
            organization: 'Missing Evidence Co',
            publicUrl: 'https://example.com/ungrounded-exact-person',
            evidenceRefs: ['observation:obs-does-not-exist'],
            identityResolved: true
          },
          {
            id: 'candidate-self-smoke',
            kind: 'profilescribe_profile',
            fullName: 'Casey Founder',
            authorSlug: 'casey-founder',
            publicUrl: 'https://profilescribe.test/u/casey-founder',
            evidenceRefs: ['profile:identity'],
            identityResolved: true
          }
        ]
      },
      priorOutcomes: [{
        kind: 'qualified_reply',
        verified: true,
        buyerSegment: 'founder-led professional service businesses',
        channel: 'warm introduction'
      }]
    }
  };
  const jobFile = join(tmp, 'job.json');
  writeFileSync(jobFile, `${JSON.stringify(job)}\n`, 'utf8');

  const first = await runJob(jobFile, port);
  const second = await runJob(jobFile, port);
  const candidateFreeJob = structuredClone(job);
  candidateFreeJob.id = 'job-opportunity-tournament-candidate-free-smoke';
  candidateFreeJob.payload.tournamentId = 'opturn-candidate-free-smoke';
  candidateFreeJob.payload.budget.maxHypotheses = 128;
  candidateFreeJob.payload.budget.maxFinalists = 10;
  delete candidateFreeJob.payload.evidenceSnapshot.candidates;
  delete candidateFreeJob.payload.evidenceSnapshot.recentTimelinePosts;
  candidateFreeJob.payload.evidenceSnapshot.sourceEvidence =
    candidateFreeJob.payload.evidenceSnapshot.sourceEvidence
      .filter((item) =>
        !item.candidate &&
        item.observationId !== 'obs-model-candidate'
      );
  const candidateFreeJobFile = join(tmp, 'candidate-free-job.json');
  writeFileSync(candidateFreeJobFile, `${JSON.stringify(candidateFreeJob)}\n`, 'utf8');
  const candidateFree = await runJob(candidateFreeJobFile, port);
  const contextJob = structuredClone(job);
  contextJob.id = 'job-opportunity-tournament-persisted-context-smoke';
  contextJob.payload.tournamentId = 'opturn-persisted-context-smoke';
  contextJob.payload.objective.id =
    'obj-persisted-context-family-bundles';
  contextJob.payload.budget.maxHypotheses = 256;
  contextJob.payload.budget.maxFinalists = 10;
  delete contextJob.payload.evidenceSnapshot;
  const contextJobFile = join(tmp, 'context-job.json');
  writeFileSync(contextJobFile, `${JSON.stringify(contextJob)}\n`, 'utf8');
  const contextResult = await runJob(contextJobFile, port, '/mcp');
  const nestedFamilyJob = structuredClone(job);
  nestedFamilyJob.id = 'job-opportunity-tournament-nested-family-smoke';
  nestedFamilyJob.payload.tournamentId = 'opturn-nested-family-smoke';
  nestedFamilyJob.payload.objective.id = 'obj-nested-family-bundles';
  const nestedFamilyJobFile = join(tmp, 'nested-family-job.json');
  writeFileSync(
    nestedFamilyJobFile,
    `${JSON.stringify(nestedFamilyJob)}\n`,
    'utf8'
  );
  const nestedFamily = await runJob(nestedFamilyJobFile, port);
  const cappedNestedFamilyJob = structuredClone(nestedFamilyJob);
  cappedNestedFamilyJob.id =
    'job-opportunity-tournament-capped-nested-family-smoke';
  cappedNestedFamilyJob.payload.tournamentId =
    'opturn-capped-nested-family-smoke';
  cappedNestedFamilyJob.payload.budget.maxHypotheses = 2;
  cappedNestedFamilyJob.payload.budget.maxFinalists = 2;
  const cappedNestedFamilyJobFile = join(
    tmp,
    'capped-nested-family-job.json'
  );
  writeFileSync(
    cappedNestedFamilyJobFile,
    `${JSON.stringify(cappedNestedFamilyJob)}\n`,
    'utf8'
  );
  const cappedNestedFamily = await runJob(
    cappedNestedFamilyJobFile,
    port
  );
  const incompleteFamilyJob = structuredClone(nestedFamilyJob);
  incompleteFamilyJob.id =
    'job-opportunity-tournament-incomplete-family-smoke';
  incompleteFamilyJob.payload.tournamentId =
    'opturn-incomplete-family-smoke';
  incompleteFamilyJob.payload.objective.id =
    'obj-incomplete-family-bundles';
  const incompleteFamilyJobFile = join(tmp, 'incomplete-family-job.json');
  writeFileSync(
    incompleteFamilyJobFile,
    `${JSON.stringify(incompleteFamilyJob)}\n`,
    'utf8'
  );
  const incompleteFamily = await runJob(incompleteFamilyJobFile, port);
  const unrelatedCandidateJob = structuredClone(job);
  unrelatedCandidateJob.id = 'job-opportunity-tournament-unrelated-candidate-smoke';
  unrelatedCandidateJob.payload.tournamentId = 'opturn-unrelated-candidate-smoke';
  unrelatedCandidateJob.payload.budget.maxHypotheses = 128;
  unrelatedCandidateJob.payload.budget.maxFinalists = 10;
  delete unrelatedCandidateJob.payload.evidenceSnapshot.recentTimelinePosts;
  unrelatedCandidateJob.payload.evidenceSnapshot.candidates = [{
    id: 'candidate-unrelated-proof-only',
    kind: 'person',
    fullName: 'Proof-Only Person',
    organization: 'Unrelated Citation Co',
    publicUrl: 'https://example.com/proof-only-person',
    evidenceRefs: ['observation:obs-unrelated-proof-only'],
    identityResolved: true
  }];
  unrelatedCandidateJob.payload.evidenceSnapshot.sourceEvidence = [
    ...unrelatedCandidateJob.payload.evidenceSnapshot.sourceEvidence
      .filter((item) =>
        !item.candidate &&
        item.observationId !== 'obs-model-candidate'
      ),
    {
      observationId: 'obs-unrelated-proof-only',
      sourceId: 'src-delivery-map',
      kind: 'case-study',
      title: 'Proof-Only Person in an unrelated citation',
      summary: 'Proof-Only Person is named here, but this record does not support the buyer segment.',
      url: 'https://example.com/proof-only-person',
      observedAt: '2026-07-24T12:00:00Z',
      confidence: 'high'
    }
  ];
  const unrelatedCandidateJobFile = join(tmp, 'unrelated-candidate-job.json');
  writeFileSync(unrelatedCandidateJobFile, `${JSON.stringify(unrelatedCandidateJob)}\n`, 'utf8');
  const unrelatedCandidate = await runJob(unrelatedCandidateJobFile, port);
  const promotableCandidateJob = structuredClone(job);
  promotableCandidateJob.id = 'job-opportunity-tournament-promote-actionable-smoke';
  promotableCandidateJob.payload.tournamentId = 'opturn-promote-actionable-smoke';
  promotableCandidateJob.payload.budget.maxHypotheses = 128;
  promotableCandidateJob.payload.budget.maxFinalists = 20;
  delete promotableCandidateJob.payload.evidenceSnapshot.recentTimelinePosts;
  promotableCandidateJob.payload.evidenceSnapshot.candidates = [];
  promotableCandidateJob.payload.evidenceSnapshot.sourceEvidence = [
    ...promotableCandidateJob.payload.evidenceSnapshot.sourceEvidence
      .filter((item) =>
        !item.candidate &&
        item.observationId !== 'obs-model-candidate'
      ),
    {
      observationId: 'obs-promotable-candidate',
      sourceId: 'src-delivery-map',
      kind: 'professional-directory',
      title: 'Promotable Buyer Co',
      summary: 'Promotable Buyer Co is a named small agency operations organization in Chicago, Illinois.',
      url: 'https://example.com/promotable-buyer-co',
      observedAt: '2026-07-25T12:00:00Z',
      confidence: 'high'
    }
  ];
  const promotableCandidateJobFile = join(tmp, 'promotable-candidate-job.json');
  writeFileSync(promotableCandidateJobFile, `${JSON.stringify(promotableCandidateJob)}\n`, 'utf8');
  const promotableCandidate = await runJob(promotableCandidateJobFile, port);
  const explicitCandidatePrecedenceJob = structuredClone(promotableCandidateJob);
  explicitCandidatePrecedenceJob.id = 'job-opportunity-tournament-explicit-candidate-precedence-smoke';
  explicitCandidatePrecedenceJob.payload.tournamentId = 'opturn-explicit-candidate-precedence-smoke';
  explicitCandidatePrecedenceJob.payload.evidenceSnapshot.sourceEvidence.push(
    structuredClone(
      job.payload.evidenceSnapshot.sourceEvidence.find(
        (item) => item.observationId === 'obs-model-candidate'
      )
    )
  );
  const explicitCandidatePrecedenceJobFile = join(tmp, 'explicit-candidate-precedence-job.json');
  writeFileSync(
    explicitCandidatePrecedenceJobFile,
    `${JSON.stringify(explicitCandidatePrecedenceJob)}\n`,
    'utf8'
  );
  const explicitCandidatePrecedence = await runJob(
    explicitCandidatePrecedenceJobFile,
    port
  );
  const ownerOrganizationJob = structuredClone(candidateFreeJob);
  ownerOrganizationJob.id = 'job-opportunity-tournament-owner-organization-smoke';
  ownerOrganizationJob.payload.tournamentId = 'opturn-owner-organization-smoke';
  ownerOrganizationJob.payload.evidenceSnapshot.profile.experience = [{
    id: 'experience-owner-services',
    company: 'Owner Services Co',
    role: 'Founder',
    startDate: '2024-01',
    endDate: ''
  }];
  ownerOrganizationJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-owner-organization',
    sourceId: 'src-delivery-map',
    kind: 'company-page',
    title: 'Owner Services Co',
    summary: 'Owner Services Co is the profile owner’s own professional-services company.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high'
  });
  const ownerOrganizationJobFile = join(tmp, 'owner-organization-job.json');
  writeFileSync(ownerOrganizationJobFile, `${JSON.stringify(ownerOrganizationJob)}\n`, 'utf8');
  const ownerOrganization = await runJob(ownerOrganizationJobFile, port);
  const proofOnlyOrganizationJob = structuredClone(candidateFreeJob);
  proofOnlyOrganizationJob.id = 'job-opportunity-tournament-proof-only-organization-smoke';
  proofOnlyOrganizationJob.payload.tournamentId = 'opturn-proof-only-organization-smoke';
  proofOnlyOrganizationJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-proof-only-organization',
    sourceId: 'src-delivery-map',
    kind: 'case-study',
    title: 'Proof Only Co',
    summary: 'Proof Only Co is mentioned only as evidence for an offer, not as the target buyer.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high'
  });
  const proofOnlyOrganizationJobFile = join(tmp, 'proof-only-organization-job.json');
  writeFileSync(
    proofOnlyOrganizationJobFile,
    `${JSON.stringify(proofOnlyOrganizationJob)}\n`,
    'utf8'
  );
  const proofOnlyOrganization = await runJob(
    proofOnlyOrganizationJobFile,
    port
  );
  const genericOrganizationJob = structuredClone(candidateFreeJob);
  genericOrganizationJob.id = 'job-opportunity-tournament-generic-organization-smoke';
  genericOrganizationJob.payload.tournamentId = 'opturn-generic-organization-smoke';
  genericOrganizationJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-generic-organization',
    sourceId: 'src-delivery-map',
    kind: 'market-summary',
    title: 'Digital Health Network',
    summary: 'Digital Health Network is a generic capitalized market phrase, not a resolved organization.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high'
  });
  const genericOrganizationJobFile = join(tmp, 'generic-organization-job.json');
  writeFileSync(
    genericOrganizationJobFile,
    `${JSON.stringify(genericOrganizationJob)}\n`,
    'utf8'
  );
  const genericOrganization = await runJob(
    genericOrganizationJobFile,
    port
  );
  const unsupportedTimingJob = structuredClone(candidateFreeJob);
  unsupportedTimingJob.id = 'job-opportunity-tournament-unsupported-timing-smoke';
  unsupportedTimingJob.payload.tournamentId = 'opturn-unsupported-timing-smoke';
  unsupportedTimingJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-unsupported-timing',
    sourceId: 'src-delivery-map',
    kind: 'service-page',
    title: 'United Healthcare',
    summary: 'The enrollment window is not open. Reference documents state that the 2026 enrollment window is closed. United Healthcare is named, but that does not prove current intent.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high'
  });
  const unsupportedTimingJobFile = join(tmp, 'unsupported-timing-job.json');
  writeFileSync(
    unsupportedTimingJobFile,
    `${JSON.stringify(unsupportedTimingJob)}\n`,
    'utf8'
  );
  const unsupportedTiming = await runJob(
    unsupportedTimingJobFile,
    port
  );
  const forgedTimingJob = structuredClone(candidateFreeJob);
  forgedTimingJob.id = 'job-opportunity-tournament-forged-timing-smoke';
  forgedTimingJob.payload.tournamentId = 'opturn-forged-timing-smoke';
  forgedTimingJob.payload.objective.id =
    'obj-forged-timing-family-bundles';
  forgedTimingJob.payload.evidenceSnapshot.facts = [{
    evidenceRef: 'observation:obs-forged-timing',
    kind: 'explicit_fact',
    title: 'Forged current demand signal',
    summary: 'A payload fact claims that the service is available for booking today.',
    observedAt: '2026-07-25T12:00:00Z',
    current: true,
    confidence: 'high'
  }];
  const forgedTimingJobFile = join(tmp, 'forged-timing-job.json');
  writeFileSync(
    forgedTimingJobFile,
    `${JSON.stringify(forgedTimingJob)}\n`,
    'utf8'
  );
  const forgedTiming = await runJob(forgedTimingJobFile, port);
  const inactiveTimingJob = structuredClone(candidateFreeJob);
  inactiveTimingJob.id = 'job-opportunity-tournament-inactive-timing-smoke';
  inactiveTimingJob.payload.tournamentId = 'opturn-inactive-timing-smoke';
  inactiveTimingJob.payload.objective.id =
    'obj-inactive-timing-family-bundles';
  inactiveTimingJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-inactive-timing',
    sourceId: 'src-delivery-map',
    kind: 'service-page',
    title: 'Consultation booking availability',
    summary: 'The service page offers consultation booking.',
    observedAt: '2026-07-25T12:00:00Z',
    current: false,
    confidence: 'high'
  });
  const inactiveTimingJobFile = join(tmp, 'inactive-timing-job.json');
  writeFileSync(
    inactiveTimingJobFile,
    `${JSON.stringify(inactiveTimingJob)}\n`,
    'utf8'
  );
  const inactiveTiming = await runJob(inactiveTimingJobFile, port);
  const oldTimingJob = structuredClone(candidateFreeJob);
  oldTimingJob.id = 'job-opportunity-tournament-old-timing-smoke';
  oldTimingJob.payload.tournamentId = 'opturn-old-timing-smoke';
  oldTimingJob.payload.objective.id = 'obj-old-timing-family-bundles';
  oldTimingJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-old-timing',
    sourceId: 'src-delivery-map',
    kind: 'service-page',
    title: 'Consultation booking availability',
    summary: 'The service page says Book today.',
    observedAt: '2026-04-01T12:00:00Z',
    current: true,
    confidence: 'high'
  });
  const oldTimingJobFile = join(tmp, 'old-timing-job.json');
  writeFileSync(
    oldTimingJobFile,
    `${JSON.stringify(oldTimingJob)}\n`,
    'utf8'
  );
  const oldTiming = await runJob(oldTimingJobFile, port);
  const endedTimingJob = structuredClone(candidateFreeJob);
  endedTimingJob.id = 'job-opportunity-tournament-ended-timing-smoke';
  endedTimingJob.payload.tournamentId = 'opturn-ended-timing-smoke';
  endedTimingJob.payload.objective.id =
    'obj-ended-timing-family-bundles';
  endedTimingJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-ended-timing',
    sourceId: 'src-delivery-map',
    kind: 'service-page',
    title: 'Consultation booking availability',
    summary: 'The service page offers consultation booking.',
    observedAt: '2026-07-25T12:00:00Z',
    current: true,
    status: 'ended',
    confidence: 'high'
  });
  const endedTimingJobFile = join(tmp, 'ended-timing-job.json');
  writeFileSync(
    endedTimingJobFile,
    `${JSON.stringify(endedTimingJob)}\n`,
    'utf8'
  );
  const endedTiming = await runJob(endedTimingJobFile, port);
  const unknownFamilyJob = structuredClone(candidateFreeJob);
  unknownFamilyJob.id = 'job-opportunity-tournament-unknown-family-smoke';
  unknownFamilyJob.payload.tournamentId = 'opturn-unknown-family-smoke';
  unknownFamilyJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-unknown-family',
    sourceId: 'src-delivery-map',
    kind: 'case-study',
    title: 'Unknown family fixture',
    summary: 'This evidence must not turn an undeclared family into a wildcard.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high'
  });
  const unknownFamilyJobFile = join(tmp, 'unknown-family-job.json');
  writeFileSync(
    unknownFamilyJobFile,
    `${JSON.stringify(unknownFamilyJob)}\n`,
    'utf8'
  );
  const unknownFamily = await runJob(
    unknownFamilyJobFile,
    port
  );
  const familyEvidenceMismatchJob = structuredClone(candidateFreeJob);
  familyEvidenceMismatchJob.id = 'job-opportunity-tournament-family-evidence-mismatch-smoke';
  familyEvidenceMismatchJob.payload.tournamentId = 'opturn-family-evidence-mismatch-smoke';
  familyEvidenceMismatchJob.payload.evidenceSnapshot.sourceEvidence = [
    structuredClone(
      job.payload.evidenceSnapshot.sourceEvidence.find(
        (item) => item.observationId === 'obs-delivery-proof'
      )
    ),
    {
      observationId: 'obs-family-uhc',
      sourceId: 'src-delivery-map',
      kind: 'service-page',
      title: 'United Healthcare consultation coverage',
      summary: 'The practice accepts United Healthcare for eligible lactation consultations.',
      observedAt: '2026-07-25T12:00:00Z',
      confidence: 'high'
    },
    {
      observationId: 'obs-family-baby',
      sourceId: 'src-delivery-map',
      kind: 'hospital-program',
      title: 'Baby-Friendly hospital program',
      summary: 'A separate article describes the Baby-Friendly hospital designation.',
      observedAt: '2026-07-25T12:00:00Z',
      confidence: 'high'
    }
  ];
  const familyEvidenceMismatchJobFile = join(
    tmp,
    'family-evidence-mismatch-job.json'
  );
  writeFileSync(
    familyEvidenceMismatchJobFile,
    `${JSON.stringify(familyEvidenceMismatchJob)}\n`,
    'utf8'
  );
  const familyEvidenceMismatch = await runJob(
    familyEvidenceMismatchJobFile,
    port
  );
  const mixedMotionJob = structuredClone(candidateFreeJob);
  mixedMotionJob.id = 'job-opportunity-tournament-mixed-motion-smoke';
  mixedMotionJob.payload.tournamentId = 'opturn-mixed-motion-smoke';
  mixedMotionJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-mixed-motion',
    sourceId: 'src-delivery-map',
    kind: 'service-page',
    title: 'United Healthcare',
    summary: 'Betty is an IBCLC who accepts United Healthcare. United Healthcare partnership executives are a separate organization-level route from her writing about Baby-Friendly hospitals and workplace lactation.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high'
  });
  const mixedMotionJobFile = join(tmp, 'mixed-motion-job.json');
  writeFileSync(
    mixedMotionJobFile,
    `${JSON.stringify(mixedMotionJob)}\n`,
    'utf8'
  );
  const mixedMotion = await runJob(mixedMotionJobFile, port);
  const proofMotionConflictJob = structuredClone(candidateFreeJob);
  proofMotionConflictJob.id = 'job-opportunity-tournament-proof-motion-conflict-smoke';
  proofMotionConflictJob.payload.tournamentId = 'opturn-proof-motion-conflict-smoke';
  proofMotionConflictJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-proof-motion-conflict',
    sourceId: 'src-delivery-map',
    kind: 'service-page',
    title: 'United Healthcare patient access and Baby-Friendly evidence',
    summary: 'The practice accepts United Healthcare for consultations. A separate proof point describes Baby-Friendly hospital accreditation expertise.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high'
  });
  const proofMotionConflictJobFile = join(
    tmp,
    'proof-motion-conflict-job.json'
  );
  writeFileSync(
    proofMotionConflictJobFile,
    `${JSON.stringify(proofMotionConflictJob)}\n`,
    'utf8'
  );
  const proofMotionConflict = await runJob(
    proofMotionConflictJobFile,
    port
  );
  const companyKindBindingJob = structuredClone(candidateFreeJob);
  companyKindBindingJob.id = 'job-opportunity-tournament-company-kind-binding-smoke';
  companyKindBindingJob.payload.tournamentId = 'opturn-company-kind-binding-smoke';
  companyKindBindingJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-company-kind',
    sourceId: 'src-delivery-map',
    kind: 'service-page',
    title: 'United Healthcare',
    summary: 'United Healthcare is accepted by the practice, but this record does not make the company the buyer for an unrelated workflow strategy.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high',
    candidate: {
      id: 'candidate-company-kind-uhc',
      kind: 'company',
      name: 'United Healthcare',
      organization: 'United Healthcare'
    }
  });
  const companyKindBindingJobFile = join(
    tmp,
    'company-kind-binding-job.json'
  );
  writeFileSync(
    companyKindBindingJobFile,
    `${JSON.stringify(companyKindBindingJob)}\n`,
    'utf8'
  );
  const companyKindBinding = await runJob(
    companyKindBindingJobFile,
    port
  );
  const staleUrgencyJob = structuredClone(candidateFreeJob);
  staleUrgencyJob.id = 'job-opportunity-tournament-stale-urgency-smoke';
  staleUrgencyJob.payload.tournamentId = 'opturn-stale-urgency-smoke';
  staleUrgencyJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-stale-urgency',
    sourceId: 'src-delivery-map',
    kind: 'archived-announcement',
    title: 'Archived opportunity announcement',
    summary: 'A historical announcement called this an urgent opportunity. The former page said act soon and described an imminent deadline and a deadline this week; all of those notices expired.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high'
  });
  const staleUrgencyJobFile = join(tmp, 'stale-urgency-job.json');
  writeFileSync(
    staleUrgencyJobFile,
    `${JSON.stringify(staleUrgencyJob)}\n`,
    'utf8'
  );
  const staleUrgency = await runJob(staleUrgencyJobFile, port);
  const organizationBindingJob = structuredClone(candidateFreeJob);
  organizationBindingJob.id = 'job-opportunity-tournament-org-binding-smoke';
  organizationBindingJob.payload.tournamentId = 'opturn-org-binding-smoke';
  organizationBindingJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-org-binding',
    sourceId: 'src-delivery-map',
    kind: 'service-page',
    title: 'United Healthcare',
    summary: 'United Healthcare is accepted by the practice, but the evidence does not make it the buyer for an unrelated strategy.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high'
  });
  const organizationBindingJobFile = join(tmp, 'org-binding-job.json');
  writeFileSync(
    organizationBindingJobFile,
    `${JSON.stringify(organizationBindingJob)}\n`,
    'utf8'
  );
  const organizationBinding = await runJob(
    organizationBindingJobFile,
    port
  );
  const patientInboundJob = structuredClone(candidateFreeJob);
  patientInboundJob.id = 'job-opportunity-tournament-patient-inbound-smoke';
  patientInboundJob.payload.tournamentId = 'opturn-patient-inbound-smoke';
  patientInboundJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-patient-inbound',
    sourceId: 'src-delivery-map',
    kind: 'service-page',
    title: 'United Healthcare lactation consultations',
    summary: 'The practice accepts United Healthcare for eligible in-home lactation consultations and provides an existing booking path.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high',
    candidate: {
      // Approved-source extraction can still misclassify a payer as a
      // person. The common candidate output boundary must correct the kind
      // even when the organization legitimately appears in the buyer seed.
      id: 'candidate-source-person-uhc',
      kind: 'source_evidence_person',
      name: 'United Healthcare',
      organization: 'United Healthcare',
      market: 'New York, New York'
    }
  });
  const patientInboundJobFile = join(tmp, 'patient-inbound-job.json');
  writeFileSync(
    patientInboundJobFile,
    `${JSON.stringify(patientInboundJob)}\n`,
    'utf8'
  );
  const patientInbound = await runJob(patientInboundJobFile, port);
  const uhcOperationsOnlyJob = structuredClone(patientInboundJob);
  uhcOperationsOnlyJob.id =
    'job-opportunity-tournament-uhc-operations-only-smoke';
  uhcOperationsOnlyJob.payload.tournamentId =
    'opturn-uhc-operations-only-smoke';
  uhcOperationsOnlyJob.payload.objective.id =
    'obj-uhc-eligibility-scheduling-no-revenue';
  const uhcOperationsOnlyJobFile = join(
    tmp,
    'uhc-operations-only-job.json'
  );
  writeFileSync(
    uhcOperationsOnlyJobFile,
    `${JSON.stringify(uhcOperationsOnlyJob)}\n`,
    'utf8'
  );
  const uhcOperationsOnly = await runJob(
    uhcOperationsOnlyJobFile,
    port
  );
  const crossMotionTimingJob = structuredClone(patientInboundJob);
  crossMotionTimingJob.id =
    'job-opportunity-tournament-cross-motion-timing-smoke';
  crossMotionTimingJob.payload.tournamentId =
    'opturn-cross-motion-timing-smoke';
  crossMotionTimingJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-cross-motion-timing',
    sourceId: 'src-delivery-map',
    kind: 'hospital-program',
    title: 'Baby-Friendly hospital program',
    summary: 'Applications are accepted today.',
    observedAt: '2026-07-25T12:00:00Z',
    current: true,
    confidence: 'high'
  });
  const crossMotionTimingJobFile = join(
    tmp,
    'cross-motion-timing-job.json'
  );
  writeFileSync(
    crossMotionTimingJobFile,
    `${JSON.stringify(crossMotionTimingJob)}\n`,
    'utf8'
  );
  const crossMotionTiming = await runJob(
    crossMotionTimingJobFile,
    port
  );
  const familyCollisionJob = structuredClone(candidateFreeJob);
  familyCollisionJob.id = 'job-opportunity-tournament-family-collision-smoke';
  familyCollisionJob.payload.tournamentId = 'opturn-family-collision-smoke';
  familyCollisionJob.payload.evidenceSnapshot.sourceEvidence.push({
    observationId: 'obs-family-collision',
    sourceId: 'src-delivery-map',
    kind: 'case-study',
    title: 'Family collision evidence',
    summary: 'Family collision evidence must not merge distinct normalized strategy family identifiers.',
    observedAt: '2026-07-25T12:00:00Z',
    confidence: 'high'
  });
  const familyCollisionJobFile = join(tmp, 'family-collision-job.json');
  writeFileSync(
    familyCollisionJobFile,
    `${JSON.stringify(familyCollisionJob)}\n`,
    'utf8'
  );
  const familyCollision = await runJob(familyCollisionJobFile, port);
  const singleFinalistJob = structuredClone(job);
  singleFinalistJob.id = 'job-opportunity-tournament-single-finalist-smoke';
  singleFinalistJob.payload.tournamentId = 'opturn-single-finalist-smoke';
  singleFinalistJob.payload.budget.maxHypotheses = 1;
  singleFinalistJob.payload.budget.maxFinalists = 2;
  const singleFinalistJobFile = join(tmp, 'single-finalist-job.json');
  writeFileSync(singleFinalistJobFile, `${JSON.stringify(singleFinalistJob)}\n`, 'utf8');
  const singleFinalist = await runJob(singleFinalistJobFile, port);
  const nonResearchJob = structuredClone(job);
  nonResearchJob.id = 'job-opportunity-tournament-side-effects-not-authorized-smoke';
  nonResearchJob.payload.tournamentId = 'opturn-side-effects-not-authorized-smoke';
  nonResearchJob.payload.researchOnly = false;
  const nonResearchJobFile = join(tmp, 'non-research-job.json');
  writeFileSync(nonResearchJobFile, `${JSON.stringify(nonResearchJob)}\n`, 'utf8');
  const nonResearch = await runJob(nonResearchJobFile, port);
  const dryRun = await runJob(
    candidateFreeJobFile,
    port,
    '/unexpected-mcp',
    { args: ['--dry-run'] }
  );
  const missingKey = await runJob(
    candidateFreeJobFile,
    port,
    '/unexpected-mcp',
    { env: { OPENROUTER_API_KEY: '' } }
  );

  if (openRouterCalls.length !== 30) {
    throw new Error(`expected one OpenRouter call per tournament run, got ${openRouterCalls.length}`);
  }
  if (unexpectedRequests.length !== 0) {
    throw new Error(`tournament made unexpected network/MCP requests: ${JSON.stringify(unexpectedRequests)}`);
  }
  const forbiddenEvidenceMarkers = [
    'src-queued',
    'src-rejected',
    'src-disabled',
    'src-unknown-status',
    'src-not-in-snapshot',
    'obs-queued-person',
    'obs-rejected',
    'obs-disabled',
    'obs-unknown-status',
    'obs-unknown-source',
    'obs-missing-source-id',
    'extract-queued',
    'extract-unknown',
    'src-context-localhost',
    'src-context-rfc1918',
    'src-context-metadata',
    '/ssrf-probe',
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    'LEAK MARKER'
  ];
  for (const [inputIndex, input] of openRouterInputs.entries()) {
    const serializedEvidence = JSON.stringify(input.evidenceCatalog || []);
    if (!serializedEvidence.includes('source:src-delivery-map') ||
        !serializedEvidence.includes('observation:obs-delivery-proof')) {
      if (inputIndex !== 3) {
        throw new Error(`approved source evidence was not retained: ${serializedEvidence}`);
      }
    }
    if (inputIndex === 3 &&
        (!serializedEvidence.includes('source:src-context-safe') ||
         !serializedEvidence.includes('observation:obs-context-candidate'))) {
      throw new Error(`approved source evidence was not retained: ${serializedEvidence}`);
    }
    if (inputIndex < 2 &&
        ((input.evidenceCatalog || []).length !== 64 ||
         !serializedEvidence.includes('timeline:peer-post-smoke') ||
         !serializedEvidence.includes('observation:obs-structured-person') ||
         !serializedEvidence.includes('observation:obs-model-candidate'))) {
      throw new Error(`candidate evidence was not protected under catalog pressure: ${serializedEvidence}`);
    }
    const leakedMarker = forbiddenEvidenceMarkers.find(
      (marker) => serializedEvidence.includes(marker)
    );
    if (leakedMarker) {
      throw new Error(`non-approved source evidence leaked into generator input (${leakedMarker}): ${serializedEvidence}`);
    }
    if (input.responseSchema?.seedContract !== 'revenue_family_bundle_v1' ||
        !input.responseSchema?.familyA?.d ||
        !input.responseSchema?.familyB?.d ||
        !Array.isArray(input.responseSchema?.familyA?.d?.revenuePaths) ||
        !Array.isArray(input.responseSchema?.familyB?.d?.revenuePaths) ||
        'offers' in (input.responseSchema || {}) ||
        Object.keys(input.outputRules?.familyBundleSchema?.d || {})[0] !==
          'revenuePaths' ||
        input.outputRules?.familyBundleSchema?.m == null ||
        input.outputRules?.revenuePathSchema?.contractVersion !==
          'incremental_revenue_v1' ||
        !input.outputRules?.hardRules?.some((rule) =>
          /Every item belongs only to its containing family bundle/i.test(rule)
        ) ||
        !input.outputRules?.hardRules?.some((rule) =>
          /operations-only/i.test(rule)
        ) ||
        !input.outputRules?.hardRules?.some((rule) =>
          /Every attributionSignal must literally name/i.test(rule)
        ) ||
        !input.outputRules?.hardRules?.some((rule) =>
          /silently audit every family/i.test(rule)
        ) ||
        !input.outputRules?.hardRules?.some((rule) =>
          /Family e must contain every evidence ID/i.test(rule)
        )) {
      throw new Error(`generator prompt lost the nested family-bundle contract: ${JSON.stringify(input.responseSchema)}`);
    }
  }
  for (const call of openRouterCalls) {
    if (call.max_tokens !== 8000) {
      throw new Error(`expected bounded 8000-token completion, got ${call.max_tokens}`);
    }
    const responseFormat = call.response_format || {};
    const responseSchema = responseFormat.json_schema?.schema || {};
    const responseDefinitions = responseSchema.$defs || {};
    if (responseFormat.type !== 'json_schema' ||
        responseFormat.json_schema?.name !==
          'profile_scribe_opportunity_tournament_v3' ||
        responseFormat.json_schema?.strict !== true ||
        responseSchema.additionalProperties !== false ||
        responseSchema.properties?.familyA?.properties?.d?.properties
          ?.revenuePaths?.minItems !== 1 ||
        responseDefinitions.revenuePath?.properties?.contractVersion
          ?.enum?.[0] !== 'incremental_revenue_v1' ||
        responseDefinitions.revenuePath?.properties?.acquisitionMode
          ?.enum?.includes('inbound') !== true ||
        responseDefinitions.revenuePath?.properties?.vm?.minimum !== 1 ||
        responseDefinitions.offerItem?.properties?.l?.description
          ?.includes('explicitly paid') !== true ||
        responseDefinitions.actionItem?.properties?.l?.description
          ?.includes('paid booking') !== true ||
        responseDefinitions.evidenceRef?.enum?.length < 1 ||
        responseDefinitions.evidenceRef?.enum?.some((id) =>
          /^source:/i.test(id)
        )) {
      throw new Error(`expected strict tournament JSON-schema response mode, got ${JSON.stringify(responseFormat)}`);
    }
    const maxPrice = call.provider?.max_price || {};
    if (maxPrice.prompt !== 2 ||
        maxPrice.completion !== 8 ||
        maxPrice.request !== 0.12 ||
        call.provider?.require_parameters !== true) {
      throw new Error(`expected conservative OpenRouter max_price routing caps, got ${JSON.stringify(maxPrice)}`);
    }
    const system = call.messages?.find((message) => message.role === 'system')?.content || '';
    if (!/not outreach/i.test(system) || !/Return no email, direct message, post, pitch/i.test(system)) {
      throw new Error('expected explicit research-only/no-outreach generator boundary');
    }
    if (!/exact name appears verbatim/i.test(system) ||
        !/Do not return contact details or URLs/i.test(system) ||
        !/strategy family coherent end to end/i.test(system) ||
        !/exactly two complete top-level family bundles/i.test(system) ||
        !/actual buyer and explicitly paid offer/i.test(system) ||
        !/observable paid conversion and durable attribution record/i.test(system) ||
        !/singular action must itself advance permissioned acquisition or paid conversion/i.test(system) ||
        !/Prefer an inbound paid-conversion path for familyA/i.test(system) ||
        !/Construct each family's revenuePath first/i.test(system) ||
        !/verification of that capability belongs only in supportingBottleneck/i.test(system) ||
        /recommend a bounded way to verify or use it instead/i.test(system)) {
      throw new Error('expected strict same-call candidate extraction boundary');
    }
  }

  for (const receipt of [first, second]) {
    if (receipt.status !== 'completed' ||
        receipt.artifactType !== 'opportunity_tournament_result' ||
        receipt.artifactId !== job.payload.tournamentId) {
      throw new Error(`expected completed tournament receipt, got ${JSON.stringify(receipt)}`);
    }
    const metadata = receipt.metadata || {};
    for (const key of ['hypotheses', 'candidates', 'winner', 'runnerUp', 'searchSpace', 'gate', 'usage']) {
      if (!(key in metadata)) throw new Error(`expected direct metadata.${key}`);
    }
    if (metadata.searchSpace?.theoreticalCount !== 65536 ||
        metadata.searchSpace?.expandedCount !== 10000 ||
        metadata.searchSpace?.modelCalls !== 1 ||
        metadata.searchSpace?.eligibleCount !== 4 ||
        metadata.searchSpace?.incompatibleCount <= 0 ||
        metadata.searchSpace?.strategyFamilyCount !== 4 ||
        metadata.searchSpace?.coherenceGate !== 'strategy_family_motion_v2' ||
        metadata.searchSpace?.revenueGate !== 'incremental_income_v1' ||
        metadata.searchSpace?.revenuePathContract !==
          'incremental_revenue_v1' ||
        metadata.searchSpace?.revenueRejectedCount !== 0 ||
        Object.keys(
          metadata.searchSpace?.revenueRejectionReasons || {}
        ).length !== 0 ||
        metadata.hypotheses?.length !== 4) {
      throw new Error(`unexpected compact search-space result: ${JSON.stringify(metadata.searchSpace)}`);
    }
    if (metadata.hypotheses.some((hypothesis) =>
      hypothesis._tuple || hypothesis._strategyFamily
    )) {
      throw new Error('internal seed tuples leaked into persisted finalist hypotheses');
    }
    for (const hypothesis of metadata.hypotheses) {
      const provenance = hypothesis.provenance || {};
      const dimensionValues = Object.values(provenance.dimensions || {});
      const revenuePath = hypothesis.revenuePath || {};
      if (!hypothesis.proofPoint ||
          hypothesis.expectedValueMicros <= 0 ||
          revenuePath.contractVersion !== 'incremental_revenue_v1' ||
          !revenuePath.incrementalIncomeOutcome ||
          !revenuePath.conversionAction ||
          !revenuePath.observableRevenueOutcome ||
          !revenuePath.attributionSignal ||
          !revenuePath.evidenceRefs?.length ||
          !provenance.strategyFamilyId ||
          provenance.motionSignatures?.length !== 1 ||
          Object.keys(provenance.motionDimensions || {}).length !== 8 ||
          !provenance.familyEvidenceRefs?.length ||
          !provenance.sharedEvidenceRefs?.length ||
          provenance.revenueContractVersion !==
            'incremental_revenue_v1' ||
          !provenance.dimensions?.revenuePath ||
          dimensionValues.length !== 8 ||
          dimensionValues.some((dimension) =>
            !dimension.familyIds?.includes(provenance.strategyFamilyId) ||
            !dimension.evidenceRefs?.some((ref) =>
              provenance.sharedEvidenceRefs.includes(ref)
            )
          ) ||
          !provenance.timingSupportPhrase ||
          !provenance.timingEvidenceRef ||
          !provenance.timingEvidenceText?.toLowerCase().includes(
            provenance.timingSupportPhrase.toLowerCase()
          )) {
        throw new Error(`finalist lost compact strategy provenance: ${JSON.stringify(hypothesis)}`);
      }
    }
    if (!Array.isArray(metadata.winner?.motionSignatures) ||
        !Array.isArray(metadata.runnerUp?.motionSignatures) ||
        metadata.winner?.revenuePath?.contractVersion !==
          'incremental_revenue_v1' ||
        metadata.runnerUp?.revenuePath?.contractVersion !==
          'incremental_revenue_v1' ||
        metadata.winner?.expectedValueMicros <= 0 ||
        metadata.runnerUp?.expectedValueMicros <= 0) {
      throw new Error('recommendation motion signatures were not retained');
    }
    const coherentPaths = [
      [
        'A paid focused workflow audit',
        'Founder-led professional service businesses',
        'One warm referral introduction',
        'Prepare one paid workflow-audit offer and booking request for a warm introduction',
        'Determine whether the review-gated client delivery workflow supports acting',
        'Stop after one unanswered review-gated attempt'
      ],
      [
        'A paid implementation diagnostic',
        'Small agency operations leaders',
        'One permissioned professional-network introduction request',
        'Prepare one paid implementation-diagnostic proposal and permissioned contract request',
        'Determine whether the observed handoff bottlenecks support acting',
        'Request human review before any follow-up'
      ],
      [
        'A paid proof-backed pilot',
        'Independent consultants with repeatable delivery',
        'One inbound paid-offer discovery path',
        'Prepare one paid pilot offer and inbound checkout request',
        'Determine whether one prioritized operating change supports acting',
        'Record the outcome before selecting another strategy'
      ],
      [
        'A paid narrow operating-system review',
        'Boutique service founders improving client workflows',
        'One existing-customer referral path',
        'Prepare one paid operating-system review offer and existing-customer referral booking request',
        'Determine whether the workflow identifies handoff bottlenecks before acting',
        'Use one permissioned clarification only'
      ]
    ];
    for (const hypothesis of metadata.hypotheses) {
      const tuple = [
        hypothesis.offer,
        hypothesis.buyerSegment,
        hypothesis.channel,
        hypothesis.action,
        hypothesis.timingTrigger,
        hypothesis.followUp
      ];
      if (!coherentPaths.some((path) =>
        path.every((value, index) => value === tuple[index])
      )) {
        throw new Error(`cross-family strategy survived the coherence gate: ${JSON.stringify(hypothesis)}`);
      }
    }
    if (!metadata.winner?.hypothesisId ||
        !metadata.winner?.actionId ||
        !metadata.winner?.candidateId ||
        metadata.winner?.requiresReview !== true ||
        !metadata.runnerUp?.hypothesisId ||
        metadata.winner.hypothesisId === metadata.runnerUp.hypothesisId) {
      throw new Error(`expected singular winner and distinct runner-up: ${JSON.stringify(metadata.winner)}`);
    }
    const selectedCandidates = metadata.candidates.filter((candidate) => candidate.selected);
    if (selectedCandidates.length !== 1 ||
        selectedCandidates[0].id !== metadata.winner.candidateId ||
        selectedCandidates[0].hypothesisId !== metadata.winner.hypothesisId ||
        selectedCandidates[0].identityResolved !== true) {
      throw new Error(`winner candidate attribution was not singular and consistent: ${JSON.stringify(selectedCandidates)}`);
    }
    if (!metadata.winner.action?.includes(selectedCandidates[0].displayLabel) ||
        !metadata.winner.why?.includes(selectedCandidates[0].displayLabel) ||
        !metadata.winner.why?.includes('Cited evidence:')) {
      throw new Error(`winner recommendation did not visibly name and ground its singular candidate: ${JSON.stringify(metadata.winner)}`);
    }
    const winnerHypothesis = metadata.hypotheses.find(
      (hypothesis) => hypothesis.id === metadata.winner.hypothesisId
    );
    if (!winnerHypothesis ||
        winnerHypothesis.rank !== 1 ||
        winnerHypothesis.status !== 'winner' ||
        typeof winnerHypothesis.score?.total !== 'number') {
      throw new Error(`winner does not reference rank-one hypothesis: ${JSON.stringify(metadata.hypotheses?.[0])}`);
    }
    if (!selectedCandidates[0].evidenceRefs.some((ref) =>
      winnerHypothesis.evidenceRefs.includes(ref) &&
      metadata.winner.evidenceRefs.includes(ref)
    )) {
      throw new Error(`winner candidate did not complete the evidence-overlap chain: ${JSON.stringify(selectedCandidates[0])}`);
    }
    const runnerUpHypothesis = metadata.hypotheses.find(
      (hypothesis) => hypothesis.id === metadata.runnerUp.hypothesisId
    );
    if (!runnerUpHypothesis ||
        runnerUpHypothesis.rank !== 2 ||
        runnerUpHypothesis.status !== 'runner_up') {
      throw new Error(`runner-up does not reference rank-two hypothesis: ${JSON.stringify(metadata.hypotheses?.[1])}`);
    }
    if (!Array.isArray(metadata.winner.evidenceRefs) ||
        metadata.winner.evidenceRefs.length === 0) {
      throw new Error(`winner was not grounded to supplied evidence refs: ${JSON.stringify(metadata.winner.evidenceRefs)}`);
    }
    if (metadata.gate?.decision !== 'human_review' ||
        metadata.gate?.winnerHypothesisId !== metadata.winner.hypothesisId ||
        metadata.gate?.sideEffects?.pdlCalls !== 0 ||
        metadata.gate?.sideEffects?.outreachAttempts !== 0 ||
        metadata.gate?.sideEffects?.publishAttempts !== 0) {
      throw new Error(`research-only gate was not preserved: ${JSON.stringify(metadata.gate)}`);
    }
    if (metadata.usage?.calls !== 1 ||
        metadata.usage?.reportedCostMicros !== 18750 ||
        metadata.usage?.totalTokens !== usage.total_tokens ||
        metadata.usage?.withinBudget !== true) {
      throw new Error(`expected exact bounded usage metadata: ${JSON.stringify(metadata.usage)}`);
    }
    if (!Array.isArray(metadata.candidates) || metadata.candidates.length !== 3) {
      throw new Error(`expected exact timeline, source, and model candidates: ${JSON.stringify(metadata.candidates)}`);
    }
    if (metadata.candidates.some((candidate) =>
      candidate.id === 'candidate-queued-person' ||
      candidate.id === 'candidate-public-smoke' ||
      candidate.displayLabel === 'Queued Candidate Must Not Appear' ||
      candidate.id === 'candidate-ungrounded-exact-person' ||
      candidate.displayLabel === 'Ungrounded Exact Person' ||
      candidate.id === 'candidate-self-smoke' ||
      candidate.displayLabel === 'Casey Founder' ||
      candidate.displayLabel === 'Invented Person Must Not Appear' ||
      candidate.publicUrl === 'https://example.com/invented-avery-url'
    )) {
      throw new Error(`ungrounded, self, or invented candidate leaked into tournament result: ${JSON.stringify(metadata.candidates)}`);
    }
    for (const candidate of metadata.candidates) {
      const assignedHypothesis = metadata.hypotheses.find(
        (hypothesis) => hypothesis.id === candidate.hypothesisId
      );
      if (!candidate.evidenceRefs?.length ||
          !assignedHypothesis ||
          !candidate.evidenceRefs.some((ref) =>
            assignedHypothesis.evidenceRefs.includes(ref)
          )) {
        throw new Error(`candidate did not overlap its assigned hypothesis: ${JSON.stringify(candidate)}`);
      }
    }
    const peerCandidate = metadata.candidates.find(
      (candidate) => candidate.displayLabel === 'Peer Builder'
    );
    if (peerCandidate?.publicUrl !== 'https://profilescribe.test/u/peer-builder' ||
        !peerCandidate.providers?.includes('profilescribe_internal') ||
        !peerCandidate.evidenceRefs?.includes('timeline:peer-post-smoke') ||
        peerCandidate.identityResolved !== true) {
      throw new Error(`expected exact internal ProfileScribe peer candidate: ${JSON.stringify(peerCandidate)}`);
    }
    const sourceCandidate = metadata.candidates.find(
      (candidate) => candidate.id === 'candidate-source-person'
    );
    if (sourceCandidate?.displayLabel !== 'Morgan Operator' ||
        sourceCandidate.publicUrl !== 'https://example.com/morgan-operator' ||
        !sourceCandidate.providers?.includes('source_evidence') ||
        !sourceCandidate.evidenceRefs?.includes('observation:obs-structured-person')) {
      throw new Error(`expected exact structured source-evidence candidate: ${JSON.stringify(sourceCandidate)}`);
    }
    const modelCandidate = metadata.candidates.find(
      (candidate) => candidate.displayLabel === 'Avery Decisionmaker'
    );
    if (modelCandidate?.organization !== 'Exact Buyer Co' ||
        modelCandidate.role !== 'Operations Director' ||
        modelCandidate.market !== 'Boston, Massachusetts' ||
        modelCandidate.publicUrl ||
        modelCandidate.contactPaths?.length !== 0 ||
        !modelCandidate.providers?.includes('openrouter_evidence_extraction') ||
        !modelCandidate.evidenceRefs?.includes('observation:obs-model-candidate') ||
        modelCandidate.identityResolved !== true) {
      throw new Error(`expected exact same-call model candidate: ${JSON.stringify(modelCandidate)}`);
    }
    const serialized = JSON.stringify(receipt);
    if (serialized.includes('private-candidate@example.com') ||
        serialized.includes('+1 (212) 555-0199') ||
        serialized.includes('http://127.0.0.1:9999/internal') ||
        serialized.includes('http://169.254.169.254/latest/meta-data') ||
        serialized.includes('http://[::1]/internal') ||
        serialized.includes('https://user:password@example.com/private') ||
        /"email"\s*:|"phone"\s*:|"message"\s*:|"body"\s*:/i.test(serialized)) {
      throw new Error('tournament receipt contained contact data or outreach/publishable copy fields');
    }
  }

  if (candidateFree.status !== 'skipped' ||
      candidateFree.metadata?.candidates?.length !== 0 ||
      candidateFree.metadata?.winner !== null ||
      candidateFree.metadata?.runnerUp !== null ||
      candidateFree.metadata?.gate?.decision !== 'needs_more_approved_evidence' ||
      candidateFree.metadata?.gate?.requiresReview !== true ||
      candidateFree.metadata?.gate?.sideEffects?.pdlCalls !== 0 ||
      candidateFree.metadata?.gate?.sideEffects?.outreachAttempts !== 0 ||
      candidateFree.metadata?.usage?.calls !== 1 ||
      candidateFree.metadata?.searchSpace?.expandedCount !== 128) {
    throw new Error(`candidate-free run did not stop at the grounded-candidate gate: ${JSON.stringify(candidateFree)}`);
  }
  if (candidateFree.metadata?.usage?.providerMaxPrice?.prompt !== 2 ||
      candidateFree.metadata?.usage?.providerMaxPrice?.completion !== 8 ||
      candidateFree.metadata?.usage?.providerMaxPrice?.request !== 0.12) {
    throw new Error(`candidate-free receipt lost provider price ceilings: ${JSON.stringify(candidateFree.metadata?.usage)}`);
  }
  if (contextResult.status !== 'completed' ||
      contextResult.metadata?.candidates?.length !== 1 ||
      contextResult.metadata?.winner?.candidateId !== contextResult.metadata?.candidates?.[0]?.id ||
      contextResult.metadata?.candidates?.[0]?.displayLabel !== 'Context Buyer Co' ||
      contextResult.metadata?.candidates?.[0]?.identityResolved !== true ||
      !contextResult.metadata?.candidates?.[0]?.evidenceRefs?.includes('observation:obs-context-candidate') ||
      contextResult.metadata?.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(`persisted-context tournament did not return its exact grounded candidate: ${JSON.stringify(contextResult)}`);
  }
  if (nestedFamily.status !== 'completed' ||
      nestedFamily.metadata?.searchSpace?.theoreticalCount !== 8192 ||
      nestedFamily.metadata?.searchSpace?.expandedCount !== 8192 ||
      nestedFamily.metadata?.searchSpace?.eligibleCount !== 64 ||
      nestedFamily.metadata?.searchSpace?.dimensionCounts?.offers !== 4 ||
      nestedFamily.metadata?.searchSpace?.seedContract !== 'revenue_family_bundle_v1' ||
      nestedFamily.metadata?.searchSpace?.declaredStrategyFamilyCount !== 2 ||
      nestedFamily.metadata?.searchSpace?.strategyFamilyCount !== 2 ||
      nestedFamily.metadata?.searchSpace?.completeStrategyFamilyCount !== 2 ||
      nestedFamily.metadata?.searchSpace?.incompleteStrategyFamilyCount !== 0 ||
      nestedFamily.metadata?.searchSpace?.strategyFamilyAnchorCoverage?.some(
        (family) =>
          family.familyAnchorCount < 1 ||
          family.sharedAnchorCount !== 0
      ) ||
      nestedFamily.metadata?.searchSpace?.strategyFamilyCollisionCount !== 0 ||
      nestedFamily.metadata?.searchSpace?.familyEvidenceMismatchSeedCount !== 1 ||
      nestedFamily.metadata?.searchSpace?.motionConflictCount !== 0 ||
      nestedFamily.metadata?.searchSpace?.timingVerificationRepairCount !== 2 ||
      nestedFamily.metadata?.searchSpace?.unsupportedTimingSeedCount !== 0 ||
      nestedFamily.metadata?.searchSpace?.modelCalls !== 1 ||
      nestedFamily.metadata?.hypotheses?.length !== 20 ||
      nestedFamily.metadata?.hypotheses?.some((hypothesis) =>
        /forbidden cross-family global offer/i.test(hypothesis.offer || '') ||
        !/^Determine whether the cited fact /i.test(
          hypothesis.timingTrigger || ''
        ) ||
        hypothesis.score?.timing > 0.25 ||
        hypothesis.score?.risk < 0.35 ||
        hypothesis.score?.uncertainty < 0.75 ||
        !hypothesis.provenance?.familyEvidenceRefs?.includes(
          hypothesis.provenance?.timingEvidenceRef
        ) ||
        !hypothesis.provenance?.dimensions?.timingTrigger?.evidenceRefs?.includes(
          hypothesis.provenance?.timingEvidenceRef
        ) ||
        JSON.stringify(
          [...new Set(
            Object.values(hypothesis.provenance?.dimensions || {})
              .flatMap((dimension) =>
                (dimension.evidenceRefs || []).filter((ref) =>
                  !ref.startsWith('source:')
                )
              )
          )].sort()
        ) !== JSON.stringify(
          [...(hypothesis.provenance?.sharedEvidenceRefs || [])].sort()
        )
      ) ||
      new Set(
        nestedFamily.metadata?.hypotheses?.map((hypothesis) => hypothesis.id)
      ).size !== nestedFamily.metadata?.hypotheses?.length ||
      nestedFamily.metadata?.hypotheses?.[0]?.provenance?.strategyFamilyId ===
        nestedFamily.metadata?.hypotheses?.[1]?.provenance?.strategyFamilyId ||
      nestedFamily.metadata?.gate?.decision !== 'human_review' ||
      nestedFamily.metadata?.gate?.sideEffects?.providerWrites !== 0) {
    throw new Error(`nested family bundles did not produce a complete family-diverse tournament: ${JSON.stringify(nestedFamily)}`);
  }
  if (cappedNestedFamily.status !== 'completed' ||
      cappedNestedFamily.metadata?.searchSpace?.theoreticalCount !== 8192 ||
      cappedNestedFamily.metadata?.searchSpace?.expandedCount !== 2 ||
      cappedNestedFamily.metadata?.searchSpace?.retainedCount !== 2 ||
      cappedNestedFamily.metadata?.searchSpace?.eligibleCount !== 2 ||
      cappedNestedFamily.metadata?.hypotheses?.length !== 2 ||
      cappedNestedFamily.metadata?.hypotheses?.[0]?.provenance?.strategyFamilyId ===
        cappedNestedFamily.metadata?.hypotheses?.[1]?.provenance?.strategyFamilyId ||
      cappedNestedFamily.metadata?.searchSpace?.strategyFamilyAnchorCoverage?.some(
        (family) => family.sharedAnchorCount !== 0
      ) ||
      cappedNestedFamily.metadata?.gate?.decision !== 'human_review' ||
      cappedNestedFamily.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
      cappedNestedFamily.metadata?.usage?.calls !== 1) {
    throw new Error(`capped sampling lost a distributed strategy family: ${JSON.stringify(cappedNestedFamily)}`);
  }
  if (incompleteFamily.status !== 'skipped' ||
      incompleteFamily.metadata?.searchSpace?.seedContract !==
        'revenue_family_bundle_v1' ||
      incompleteFamily.metadata?.searchSpace?.completeStrategyFamilyCount !==
        1 ||
      incompleteFamily.metadata?.searchSpace?.incompleteStrategyFamilyCount !==
        1 ||
      !/every dimension cites specific family evidence/i.test(
        incompleteFamily.metadata?.gate?.reason || ''
      ) ||
      /shared approved-observation anchor in every dimension/i.test(
        incompleteFamily.metadata?.gate?.reason || ''
      ) ||
      incompleteFamily.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
      incompleteFamily.metadata?.usage?.calls !== 1) {
    throw new Error(`incomplete family gate used a stale v1 explanation: ${JSON.stringify(incompleteFamily)}`);
  }
  if (unrelatedCandidate.status !== 'skipped' ||
      unrelatedCandidate.metadata?.candidates?.length !== 0 ||
      unrelatedCandidate.metadata?.winner !== null ||
      unrelatedCandidate.metadata?.gate?.decision !== 'needs_more_approved_evidence' ||
      unrelatedCandidate.metadata?.gate?.sideEffects?.pdlCalls !== 0 ||
      unrelatedCandidate.metadata?.usage?.calls !== 1) {
    throw new Error(`proof-only candidate was incorrectly attached to an unrelated buyer strategy: ${JSON.stringify(unrelatedCandidate)}`);
  }
  const promotedWinnerCandidate = promotableCandidate.metadata?.candidates?.find(
    (candidate) => candidate.id === promotableCandidate.metadata?.winner?.candidateId
  );
  if (promotableCandidate.status !== 'completed' ||
      promotedWinnerCandidate?.displayLabel !== 'Promotable Buyer Co' ||
      promotedWinnerCandidate.identityResolved !== true ||
      !promotedWinnerCandidate.providers?.includes('openrouter_seed_extraction') ||
      promotableCandidate.metadata?.hypotheses?.[0]?.buyerSegment !== 'Promotable Buyer Co operations leaders' ||
      promotableCandidate.metadata?.hypotheses?.[0]?.rank !== 1 ||
      promotableCandidate.metadata?.hypotheses?.[0]?.status !== 'winner' ||
      promotableCandidate.metadata?.searchSpace?.retainedCount >= 20 ||
      promotableCandidate.metadata?.hypotheses?.length < 2 ||
      !promotableCandidate.metadata?.winner?.evidenceRefs?.includes('observation:obs-promotable-candidate')) {
    throw new Error(`best lower-ranked actionable hypothesis was not promoted safely: ${JSON.stringify(promotableCandidate)}`);
  }
  if (explicitCandidatePrecedence.status !== 'completed' ||
      explicitCandidatePrecedence.metadata?.winner?.candidateId == null ||
      !explicitCandidatePrecedence.metadata?.candidates?.some(
        (candidate) =>
          candidate.id === explicitCandidatePrecedence.metadata.winner.candidateId &&
          candidate.providers?.includes('openrouter_evidence_extraction')
      ) ||
      explicitCandidatePrecedence.metadata?.candidates?.some(
        (candidate) => candidate.providers?.includes('openrouter_seed_extraction')
      )) {
    throw new Error(`seed fallback overrode an explicit candidate: ${JSON.stringify(explicitCandidatePrecedence)}`);
  }
  for (const [label, result] of [
    ['profile owner organization', ownerOrganization],
    ['proof-only organization', proofOnlyOrganization],
    ['generic capitalized phrase', genericOrganization]
  ]) {
    if (result.status !== 'skipped' ||
        result.metadata?.candidates?.length !== 0 ||
        result.metadata?.winner !== null ||
        result.metadata?.gate?.decision !== 'needs_more_approved_evidence' ||
        result.metadata?.gate?.sideEffects?.outreachAttempts !== 0 ||
        result.metadata?.usage?.calls !== 1) {
      throw new Error(`${label} was incorrectly promoted as a candidate: ${JSON.stringify(result)}`);
    }
  }
  if (unsupportedTiming.status !== 'skipped' ||
      !/no source-backed timing trigger/i.test(unsupportedTiming.summary || '') ||
      unsupportedTiming.metadata?.searchSpace?.unsupportedTimingSeedCount !== 4 ||
      unsupportedTiming.metadata?.searchSpace?.timingVerificationRepairCount !== 0 ||
      unsupportedTiming.metadata?.searchSpace?.eligibleCount !== 0 ||
      unsupportedTiming.metadata?.gate?.sideEffects?.outreachAttempts !== 0 ||
      unsupportedTiming.metadata?.usage?.calls !== 1) {
    throw new Error(`unsupported timing claim survived normalization: ${JSON.stringify(unsupportedTiming)}`);
  }
  if (forgedTiming.status !== 'skipped' ||
      forgedTiming.metadata?.searchSpace?.seedContract !== 'revenue_family_bundle_v1' ||
      forgedTiming.metadata?.searchSpace?.unsupportedTimingSeedCount !== 2 ||
      forgedTiming.metadata?.searchSpace?.timingVerificationRepairCount !== 0 ||
      openRouterInputs.find(
        (input) => input.objective?.id === 'obj-forged-timing-family-bundles'
      )?.evidenceCatalog?.some(
        (item) => item.id === 'observation:obs-forged-timing'
      ) ||
      forgedTiming.metadata?.winner !== null ||
      forgedTiming.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
      forgedTiming.metadata?.usage?.calls !== 1) {
    throw new Error(`forged explicit observation repaired timing without approved-source provenance: ${JSON.stringify(forgedTiming)}`);
  }
  for (const [label, result] of [
    ['explicitly non-current observation', inactiveTiming],
    ['old observation', oldTiming],
    ['ended observation', endedTiming]
  ]) {
    if (result.status !== 'skipped' ||
        result.metadata?.searchSpace?.seedContract !== 'revenue_family_bundle_v1' ||
        result.metadata?.searchSpace?.unsupportedTimingSeedCount !== 2 ||
        result.metadata?.searchSpace?.timingVerificationRepairCount !== 0 ||
        result.metadata?.winner !== null ||
        result.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
        result.metadata?.usage?.calls !== 1) {
      throw new Error(`${label} was repaired into a current timing trigger: ${JSON.stringify(result)}`);
    }
  }
  if (unknownFamily.status !== 'skipped' ||
      unknownFamily.metadata?.searchSpace?.invalidFamilySeedCount !== 32 ||
      unknownFamily.metadata?.searchSpace?.eligibleCount !== 0 ||
      unknownFamily.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
      unknownFamily.metadata?.usage?.calls !== 1) {
    throw new Error(`undeclared family became a compatibility wildcard: ${JSON.stringify(unknownFamily)}`);
  }
  if (familyEvidenceMismatch.status !== 'skipped' ||
      familyEvidenceMismatch.metadata?.searchSpace?.familyEvidenceMismatchSeedCount !== 2 ||
      familyEvidenceMismatch.metadata?.searchSpace?.invalidFamilySeedCount < 2 ||
      familyEvidenceMismatch.metadata?.hypotheses?.some((hypothesis) =>
        /baby-friendly|hospital coordinator/i.test(
          `${hypothesis.action || ''} ${hypothesis.channel || ''}`
        )
      ) ||
      familyEvidenceMismatch.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
      familyEvidenceMismatch.metadata?.usage?.calls !== 1) {
    throw new Error(`mistagged hospital seeds survived the UHC family evidence gate: ${JSON.stringify(familyEvidenceMismatch)}`);
  }
  if (mixedMotion.status !== 'skipped' ||
      mixedMotion.metadata?.searchSpace?.eligibleCount !== 0 ||
      mixedMotion.metadata?.searchSpace?.motionConflictCount < 1 ||
      mixedMotion.metadata?.winner !== null ||
      mixedMotion.metadata?.gate?.sideEffects?.outreachAttempts !== 0 ||
      mixedMotion.metadata?.usage?.calls !== 1) {
    throw new Error(`same-evidence cross-motion strategy survived the independent motion gate: ${JSON.stringify(mixedMotion)}`);
  }
  if (proofMotionConflict.status !== 'skipped' ||
      proofMotionConflict.metadata?.searchSpace?.eligibleCount !== 0 ||
      proofMotionConflict.metadata?.searchSpace?.motionConflictCount < 1 ||
      proofMotionConflict.metadata?.hypotheses?.length !== 0 ||
      proofMotionConflict.metadata?.winner !== null ||
      proofMotionConflict.metadata?.usage?.calls !== 1) {
    throw new Error(`proof-only cross-motion strategy survived the independent motion gate: ${JSON.stringify(proofMotionConflict)}`);
  }
  if (companyKindBinding.status !== 'skipped' ||
      companyKindBinding.metadata?.candidates?.length !== 0 ||
      companyKindBinding.metadata?.winner !== null ||
      companyKindBinding.metadata?.gate?.decision !== 'needs_more_approved_evidence' ||
      companyKindBinding.metadata?.usage?.calls !== 1) {
    throw new Error(`company-kind organization bound to a buyer that did not name it: ${JSON.stringify(companyKindBinding)}`);
  }
  if (staleUrgency.status !== 'skipped' ||
      staleUrgency.metadata?.searchSpace?.unsupportedTimingSeedCount !== 4 ||
      staleUrgency.metadata?.searchSpace?.timingVerificationRepairCount !== 0 ||
      staleUrgency.metadata?.searchSpace?.eligibleCount !== 0 ||
      staleUrgency.metadata?.winner !== null ||
      staleUrgency.metadata?.usage?.calls !== 1) {
    throw new Error(`historical urgency survived direct timing validation: ${JSON.stringify(staleUrgency)}`);
  }
  if (organizationBinding.status !== 'skipped' ||
      organizationBinding.metadata?.candidates?.length !== 0 ||
      organizationBinding.metadata?.winner !== null ||
      organizationBinding.metadata?.gate?.decision !== 'needs_more_approved_evidence' ||
      organizationBinding.metadata?.gate?.sideEffects?.pdlCalls !== 0 ||
      organizationBinding.metadata?.usage?.calls !== 1) {
    throw new Error(`named organization spelling bound to a buyer segment that did not name it: ${JSON.stringify(organizationBinding)}`);
  }
  if (patientInbound.status !== 'completed' ||
      patientInbound.metadata?.searchSpace?.eligibleCount !== 2 ||
      patientInbound.metadata?.searchSpace?.motionConflictCount !== 0 ||
      patientInbound.metadata?.searchSpace?.revenueRejectedCount !== 0 ||
      patientInbound.metadata?.searchSpace?.revenueGate !==
        'incremental_income_v1' ||
      patientInbound.metadata?.searchSpace?.revenuePathContract !==
        'incremental_revenue_v1' ||
      patientInbound.metadata?.searchSpace?.timingVerificationRepairCount !== 2 ||
      patientInbound.metadata?.searchSpace?.unsupportedTimingSeedCount !== 0 ||
      patientInbound.metadata?.hypotheses?.some((hypothesis) =>
        !/^Determine whether the cited fact /i.test(
          hypothesis.timingTrigger || ''
        ) ||
        hypothesis.score?.timing > 0.25 ||
        hypothesis.score?.risk < 0.35 ||
        hypothesis.score?.uncertainty < 0.75 ||
        hypothesis.revenuePath?.acquisitionMode !== 'inbound' ||
        hypothesis.revenuePath?.contractVersion !==
          'incremental_revenue_v1' ||
        hypothesis.expectedValueMicros <= 0 ||
        !hypothesis.provenance?.timingEvidenceText?.toLowerCase().includes(
          hypothesis.provenance?.timingSupportPhrase?.toLowerCase() || '\u0000'
        )
      ) ||
      patientInbound.metadata?.winner?.candidateId == null ||
      !/evidence anchor/i.test(patientInbound.metadata?.winner?.why || '') ||
      /(?:for|with) United Healthcare/i.test(
        `${patientInbound.metadata?.winner?.action || ''} ${patientInbound.metadata?.winner?.title || ''}`
      ) ||
      !patientInbound.metadata?.candidates?.some(
        (candidate) =>
          candidate.id === 'candidate-source-person-uhc' &&
          candidate.kind === 'organization'
      ) ||
      patientInbound.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
      patientInbound.metadata?.usage?.calls !== 1) {
    throw new Error(`legitimate patient-inbound insurance-context strategy was blocked or rewritten as insurer outreach: ${JSON.stringify(patientInbound)}`);
  }
  if (uhcOperationsOnly.status !== 'skipped' ||
      uhcOperationsOnly.metadata?.searchSpace?.eligibleCount !== 0 ||
      uhcOperationsOnly.metadata?.searchSpace?.revenueRejectedCount < 1 ||
      uhcOperationsOnly.metadata?.searchSpace?.revenueGate !==
        'incremental_income_v1' ||
      uhcOperationsOnly.metadata?.searchSpace?.revenuePathContract !==
        'incremental_revenue_v1' ||
      uhcOperationsOnly.metadata?.searchSpace
        ?.revenueRejectionReasons?.operations_only_action < 1 ||
      uhcOperationsOnly.metadata?.searchSpace
        ?.revenueRejectionReasons?.missing_paid_offer < 1 ||
      uhcOperationsOnly.metadata?.searchSpace
        ?.revenueRejectionReasons?.missing_incremental_income < 1 ||
      uhcOperationsOnly.metadata?.searchSpace
        ?.revenueRejectionReasons?.missing_observable_revenue < 1 ||
      uhcOperationsOnly.metadata?.hypotheses?.length !== 0 ||
      uhcOperationsOnly.metadata?.winner !== null ||
      uhcOperationsOnly.metadata?.runnerUp !== null ||
      uhcOperationsOnly.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
      uhcOperationsOnly.metadata?.usage?.calls !== 1) {
    throw new Error(`UHC eligibility/scheduling operations won without incremental demand and paid conversion: ${JSON.stringify(uhcOperationsOnly)}`);
  }
  if (crossMotionTiming.status !== 'skipped' ||
      crossMotionTiming.metadata?.searchSpace?.seedContract !==
        'revenue_family_bundle_v1' ||
      crossMotionTiming.metadata?.searchSpace?.completeStrategyFamilyCount !== 1 ||
      crossMotionTiming.metadata?.searchSpace?.incompleteStrategyFamilyCount !== 1 ||
      crossMotionTiming.metadata?.searchSpace?.familyEvidenceMismatchSeedCount !== 1 ||
      crossMotionTiming.metadata?.searchSpace?.invalidFamilySeedCount < 1 ||
      crossMotionTiming.metadata?.searchSpace?.timingVerificationRepairCount !== 1 ||
      crossMotionTiming.metadata?.winner !== null ||
      crossMotionTiming.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
      crossMotionTiming.metadata?.usage?.calls !== 1) {
    throw new Error(`cross-motion family timing evidence was salvaged: ${JSON.stringify(crossMotionTiming)}`);
  }
  if (familyCollision.status !== 'skipped' ||
      familyCollision.metadata?.searchSpace?.strategyFamilyCollisionCount !== 1 ||
      familyCollision.metadata?.searchSpace?.strategyFamilyCount !== 0 ||
      familyCollision.metadata?.searchSpace?.eligibleCount !== 0 ||
      familyCollision.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
      familyCollision.metadata?.usage?.calls !== 1) {
    throw new Error(`normalized strategy-family collision was silently merged: ${JSON.stringify(familyCollision)}`);
  }
  if (singleFinalist.status !== 'skipped' ||
      singleFinalist.metadata?.hypotheses?.length !== 1 ||
      singleFinalist.metadata?.candidates?.length !== 0 ||
      singleFinalist.metadata?.winner !== null ||
      singleFinalist.metadata?.runnerUp !== null ||
      singleFinalist.metadata?.gate?.decision !== 'needs_more_approved_evidence' ||
      singleFinalist.metadata?.usage?.calls !== 1) {
    throw new Error(`single-finalist tournament incorrectly completed without a distinct runner-up: ${JSON.stringify(singleFinalist)}`);
  }
  for (const requiredTool of [
    'read_profile',
    'read_sources',
    'read_source_evidence',
    'search_timeline_posts',
    'discover_timeline_posts'
  ]) {
    if (!mcpCalls.includes(requiredTool)) {
      throw new Error(`persisted-context tournament omitted read-only MCP tool ${requiredTool}: ${JSON.stringify(mcpCalls)}`);
    }
  }
  if (nonResearch.status !== 'skipped' ||
      nonResearch.metadata?.gate?.decision !== 'block' ||
      nonResearch.metadata?.gate?.requiresReview !== true ||
      nonResearch.metadata?.searchSpace?.revenueGate !==
        'incremental_income_v1' ||
      nonResearch.metadata?.searchSpace?.revenuePathContract !==
        'incremental_revenue_v1' ||
      nonResearch.metadata?.searchSpace?.revenueRejectedCount !== 0 ||
      nonResearch.metadata?.gate?.sideEffects?.pdlCalls !== 0 ||
      nonResearch.metadata?.gate?.sideEffects?.outreachAttempts !== 0 ||
      nonResearch.metadata?.gate?.sideEffects?.publishAttempts !== 0) {
    throw new Error(`non-research tournament request was not blocked: ${JSON.stringify(nonResearch)}`);
  }
  for (const [label, result] of [
    ['dry-run', dryRun],
    ['missing-key', missingKey]
  ]) {
    if (result.status !== 'skipped' ||
        result.metadata?.searchSpace?.modelCalls !== 0 ||
        result.metadata?.searchSpace?.timingVerificationRepairCount !== 0 ||
        result.metadata?.searchSpace?.revenueGate !==
          'incremental_income_v1' ||
        result.metadata?.searchSpace?.revenuePathContract !==
          'incremental_revenue_v1' ||
        result.metadata?.searchSpace?.revenueRejectedCount !== 0 ||
        Object.keys(
          result.metadata?.searchSpace?.revenueRejectionReasons || {}
        ).length !== 0 ||
        result.metadata?.gate?.sideEffects?.providerWrites !== 0 ||
        result.metadata?.usage?.calls !== 0) {
      throw new Error(`${label} tournament path lost its zero-repair trace: ${JSON.stringify(result)}`);
    }
  }

  const firstIDs = first.metadata.hypotheses.map((hypothesis) => hypothesis.id);
  const secondIDs = second.metadata.hypotheses.map((hypothesis) => hypothesis.id);
  if (JSON.stringify(firstIDs) !== JSON.stringify(secondIDs) ||
      first.metadata.winner.hypothesisId !== second.metadata.winner.hypothesisId) {
    throw new Error('same evidence and seeds did not produce deterministic finalist ranking');
  }

  console.log('profile-scribe-rig opportunity tournament smoke check passed.');
} finally {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}

function runJob(
  jobFile,
  port,
  mcpPath = '/unexpected-mcp',
  options = {}
) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [
      join(root, 'bin/run-job.mjs'),
      '--job-file',
      jobFile,
      ...Array.isArray(options.args) ? options.args : []
    ], {
      cwd: root,
      env: {
        ...process.env,
        OPENROUTER_API_KEY: 'sk-or-tournament-smoke',
        PROFILESCRIBE_AGENT_TOKEN: 'tournament-smoke-agent-token',
        PROFILESCRIBE_MCP_URL: `http://127.0.0.1:${port}${mcpPath}`,
        PROFILESCRIBE_APP_URL: 'https://profilescribe.test',
        PROFILESCRIBE_RIG_SOURCE_FETCH_TIMEOUT_MS: '250',
        PROFILESCRIBE_RIG_OPENROUTER_CHAT_COMPLETIONS_URL: `http://127.0.0.1:${port}/openrouter`,
        PROFILESCRIBE_RIG_TOURNAMENT_MODEL: 'test/opportunity-tournament',
        ...options.env
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      if (code !== 0) {
        rejectRun(new Error(`run-job exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      try {
        resolveRun(JSON.parse(stdout || '{}'));
      } catch (error) {
        rejectRun(new Error(`invalid run-job JSON: ${error.message}\n${stdout}\n${stderr}`));
      }
    });
  });
}
