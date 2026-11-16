import home from '@/modules/home';
import { planned } from '@/modules/planned';
import { GROUP_ORDER } from './groups';

export const modules = [home, ...planned].sort(
  (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.order - b.order,
);
