import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { emptyDraft } from '@/core/draft/schema';
import { emptyPapersDoc } from '@/core/papers/papers';
import { examplePlan } from '@/core/plan/examplePlan';
import { ApiError } from '@/shared/api/client';
import { usePlans } from './usePlans';

const mocks = vi.hoisted(() => ({
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  getDoc: vi.fn(),
  freezePlan: vi.fn(),
  gate: vi.fn(),
}));
vi.mock('@/shared/api/apiContext', () => ({ useApi: () => mocks }));
vi.mock('@/shared/auth/authContext', () => ({ useAuth: () => ({ user: { email: 'a@hyperdatalab.org' } }) }));
vi.mock('@/shared/project/projectContext', () => ({
  useProject: () => ({ project: { id: 'project', title: 'Project' } }),
}));
vi.mock('@/core/draft/freezeGate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/draft/freezeGate')>()),
  freezeGate: mocks.gate,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listPlans.mockResolvedValue([]);
  mocks.getDoc.mockImplementation(async (_id: string, kind: string) => ({
    data: kind === 'draft' ? emptyDraft() : emptyPapersDoc(),
  }));
  mocks.gate.mockReturnValue({
    state: 'plan',
    plan: examplePlan(),
    issues: [],
    blocked: false,
    unchanged: false,
  });
});
it('UP-01 reads both documents fresh before freezing', async () => {
  mocks.freezePlan.mockResolvedValue(examplePlan());
  const { result } = renderHook(() => usePlans());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    expect(await result.current.freeze({ deviation: null })).toMatchObject({ ok: true });
  });
  expect(mocks.getDoc.mock.calls.map((call) => call[1])).toEqual(['draft', 'papers']);
  expect(mocks.gate.mock.calls[0]?.[1]).toMatchObject({
    planId: 'project',
    title: 'Project',
    frozenBy: 'a@hyperdatalab.org',
  });
});
it('UP-02 refuses each local gate state', async () => {
  const { result } = renderHook(() => usePlans());
  await waitFor(() => expect(result.current.loading).toBe(false));
  for (const [gate, reason] of [
    [{ state: 'not_a_plan', missing: [] }, 'not_a_plan'],
    [{ state: 'plan', blocked: true, unchanged: false }, 'blocked'],
    [{ state: 'plan', blocked: false, unchanged: true }, 'unchanged'],
  ] as const) {
    mocks.gate.mockReturnValue(gate);
    await act(async () => {
      expect(await result.current.freeze({ deviation: null })).toMatchObject({ ok: false, reason });
    });
  }
  expect(mocks.freezePlan).not.toHaveBeenCalled();
});
it('UP-03 reloads after a conflict without retrying', async () => {
  mocks.freezePlan.mockRejectedValue(new ApiError(409, 'conflict', 'Conflict'));
  const { result } = renderHook(() => usePlans());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    expect(await result.current.freeze({ deviation: null })).toEqual({ ok: false, reason: 'conflict' });
  });
  expect(mocks.freezePlan).toHaveBeenCalledTimes(1);
  expect(mocks.listPlans).toHaveBeenCalledTimes(3);
});
