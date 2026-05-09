/**
 * IssuesTab — relocates the existing `IssuesLog` UI into the Permits page.
 *
 * Phase 1 ships zero behavioral changes — same component, same hook,
 * same UI. Phase 2 will wire issue rows to a parent inspection via the
 * new `issues.permit_inspection_id` FK.
 */
import React from 'react';
import { IssuesLog } from '../IssuesLog';
import type { Project } from '../../types';

interface IssuesTabProps {
  project: Project;
  updateProject: (p: Project) => void;
}

export const IssuesTab: React.FC<IssuesTabProps> = ({
  project,
  updateProject,
}) => {
  return <IssuesLog project={project} updateProject={updateProject} />;
};
