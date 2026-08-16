import { strongestRemainingHuntExperiment } from '../bin/opportunity-tournament.mjs';

const observation = {
  id: 'observation:owner-homepage',
  approvedSourceObservation: true,
  label: 'Owner site',
  summary: 'Paid consultation bookings are available.',
  url: 'https://example.com'
};

const candidate = {
  id: 'candidate-example-pediatrics',
  motionId: 'plan_2_compensated_job',
  kind: 'employer_job_posting',
  displayLabel: 'Example Pediatrics',
  organization: 'Example Pediatrics',
  publicUrl: 'https://example.com/apply',
  commercialRole: 'paid_demand'
};

const experiment = strongestRemainingHuntExperiment({
  objective: {
    outcome: 'One attributable paid consultation',
    successMetric: 'One paid booking receipt'
  },
  evidenceCatalog: [observation],
  evidenceHash: 'abc',
  commercialContext: { allowedChannels: [] },
  commercialEvidenceGraph: { nodes: [] },
  hypotheses: [],
  commercialDiscovery: {
    valid: true,
    candidates: [candidate],
    plan: {
      plans: [{
        id: 'plan_2_compensated_job',
        paidOffer: 'paid consultation'
      }]
    }
  },
  timestamp: '2026-08-16T00:00:00.000Z',
  missingEvidence: [
    'a completed critic comparison of two source-bound cash paths'
  ]
});

if (!experiment ||
    experiment.kind !== 'revenue_path_grounding' ||
    experiment.buyer !== 'Example Pediatrics' ||
    !String(experiment.action).startsWith('Review first:') ||
    experiment.kind === 'strategy_generation_shape_recovery' ||
    !String(experiment.title).includes('Example Pediatrics')) {
  throw new Error(
    `found hunt did not become a review-first money experiment: ${JSON.stringify(experiment)}`
  );
}

console.log('found-hunt-experiment: ok');
