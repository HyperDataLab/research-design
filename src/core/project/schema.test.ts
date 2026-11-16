import { expect, it } from 'vitest';
import { projectSchema } from './schema';
it('PJ-01 accepts a Worker project and rejects unknown fields', () => {
  const project = {
    id: '0123456789abcdef',
    title: 'Example',
    owner: 'a@hyperdatalab.org',
    members: ['a@hyperdatalab.org'],
    archived: false,
    createdAt: '2026-11-16T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
  };
  expect(projectSchema.parse(project)).toEqual(project);
  expect(projectSchema.safeParse({ ...project, extra: true }).success).toBe(false);
});
