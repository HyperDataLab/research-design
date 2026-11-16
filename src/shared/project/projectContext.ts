import { createContext, useContext } from 'react';
import type { Project } from '../../core/project/schema';

export const ProjectContext = createContext<{ project: Project; readOnly: boolean } | null>(null);
export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('ProjectLayout missing');
  return context;
}
