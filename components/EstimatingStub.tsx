import React from 'react';
import { Calculator } from 'lucide-react';
import { BetaFeatureStub } from './BetaFeatureStub';

export const EstimatingStub: React.FC<{ projectId?: string }> = ({ projectId }) => (
  <BetaFeatureStub
    icon={Calculator}
    title="Estimating"
    featureKey="estimating"
    projectId={projectId}
    description={
      'Generate electrical takeoffs and bid pricing in minutes. SparkPlan ties estimating directly ' +
      'to your panel, feeder, and circuit model — no spreadsheet round-trip. Pre-built assemblies for ' +
      'panel upgrades, branch circuits, and service upgrades, with material + labor pricing you can tune.'
    }
  />
);
