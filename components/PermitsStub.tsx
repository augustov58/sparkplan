import React from 'react';
import { AlertOctagon } from 'lucide-react';
import { BetaFeatureStub } from './BetaFeatureStub';

export const PermitsStub: React.FC<{ projectId?: string }> = ({ projectId }) => (
  <BetaFeatureStub
    icon={AlertOctagon}
    title="Permits"
    featureKey="permits"
    projectId={projectId}
    description={
      'Track the full permit + inspection lifecycle in one place: submission → AHJ review → approval → ' +
      'inspection scheduling → results → corrections → reinspect → closed. Built for the day-to-day ' +
      'reality of running 5–15 active permits across multiple jurisdictions.'
    }
    forwardLink={
      projectId
        ? { label: 'Inspection & Issues', path: `/project/${projectId}/issues` }
        : undefined
    }
  />
);
