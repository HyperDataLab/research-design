import home from '@/modules/home';
import projects from '@/modules/projects';
import corpus from '@/modules/corpus';
import evidence from '@/modules/evidence';
import bank from '@/modules/bank';
import questions from '@/modules/questions';
import design from '@/modules/design';
import measurement from '@/modules/measurement';
import analyses from '@/modules/analyses';
import runs from '@/modules/runs';
import packageModule from '@/modules/package';
import settings from '@/modules/settings';
import { planned } from '@/modules/planned';
import { GROUP_ORDER } from './groups';

export const modules = [
  home,
  projects,
  corpus,
  evidence,
  bank,
  questions,
  design,
  measurement,
  analyses,
  runs,
  packageModule,
  settings,
  ...planned,
].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.order - b.order);
