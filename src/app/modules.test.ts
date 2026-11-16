import { GROUP_ORDER } from './groups';
import { modules } from './modules';
it('has no corrupted module labels', () => {
  for (const item of modules) expect(item.label).not.toContain('?');
});
it('has unique ids, labels and paths and is sorted by group and order', () => {
  expect(new Set(modules.map((m) => m.id)).size).toBe(modules.length);
  expect(new Set(modules.map((m) => m.label)).size).toBe(modules.length);
  expect(new Set(modules.map((m) => m.path)).size).toBe(modules.length);
  for (let i = 0; i < modules.length; i++) {
    const item = modules[i];
    expect(item).toBeDefined();
    if (!item) continue;
    expect(GROUP_ORDER).toContain(item.group);
    const previous = modules[i - 1];
    if (previous) {
      expect(GROUP_ORDER.indexOf(item.group)).toBeGreaterThanOrEqual(GROUP_ORDER.indexOf(previous.group));
      if (previous.group === item.group) expect(item.order).toBeGreaterThan(previous.order);
    }
  }
});
