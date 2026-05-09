import React from 'react';
import { CreditCard } from 'lucide-react';
import { BetaFeatureStub } from './BetaFeatureStub';

export const TmBillingStub: React.FC<{ projectId?: string }> = ({ projectId }) => (
  <BetaFeatureStub
    icon={CreditCard}
    title="T&M Billing"
    featureKey="tm_billing"
    projectId={projectId}
    description={
      'Time & materials billing tied to project phases, change orders, and AIA pay applications. ' +
      'Built for commercial electrical subcontractors who need to track labor hours, material costs, ' +
      'and progress billing — without forcing a flat-rate residential workflow that doesn\'t fit the work.'
    }
  />
);
