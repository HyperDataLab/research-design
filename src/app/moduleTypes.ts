import type { ComponentType, LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';
export interface ModuleDefinition {
  id: string;
  label: string;
  /** One line saying what the screen is for; shown on Tổng quan and on the placeholder page. */
  summary: string;
  icon: LucideIcon;
  path: string;
  group: 'home' | 'literature' | 'design' | 'plan' | 'system';
  order: number;
  status: 'ready' | 'beta' | 'soon';
  page: LazyExoticComponent<ComponentType>;
  /** A screen reached from another module: it has its route but no sidebar entry of its own. */
  partOf?: string;
  scope?: 'project';
}
