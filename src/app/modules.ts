import home from '@/modules/home';
import projects from '@/modules/projects';
import corpus from '@/modules/corpus';
import bank from '@/modules/bank';
import questions from '@/modules/questions';
import settings from '@/modules/settings';
import { planned } from '@/modules/planned';
import { GROUP_ORDER } from './groups';

export const modules = [home, projects, corpus, bank, questions, settings, ...planned].sort(
  (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.order - b.order,
);
