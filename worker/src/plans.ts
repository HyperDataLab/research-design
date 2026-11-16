import { planSchema, type ExperimentPlan } from '../../src/core/plan/schema';
import { validatePlan } from '../../src/core/plan/validatePlan';
import type { Caller } from './auth';
import type { Deps } from './app';
import { bad, body, conflict, error, json, keys, method, missing, read, save } from './http';

export async function plans(
  deps: Deps,
  request: Request,
  caller: Caller,
  prefix: string,
  version?: string,
): Promise<Response> {
  if (!version) {
    if (request.method !== 'GET') return method();
    const all = await versions(deps, prefix);
    return json(200, {
      versions: all.map((p) => ({ version: p.planVersion, frozenAt: p.frozenAt, frozenBy: p.frozenBy })),
    });
  }
  const key = `${prefix}${version}.json`;
  if (request.method === 'GET') {
    const plan = await read<ExperimentPlan>(deps.bucket, key);
    return plan ? json(200, plan) : missing();
  }
  if (request.method !== 'PUT') return method();
  const input = await body(request, 2 * 1024 * 1024);
  if (input instanceof Response) return input;
  const parsed = planSchema.safeParse(input);
  if (!parsed.success)
    return error(
      422,
      'plan_invalid',
      'The plan has an invalid shape.',
      parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    );
  if (String(parsed.data.planVersion) !== version) return bad();
  const plan = { ...parsed.data, frozenBy: caller.email, frozenAt: deps.now().toISOString() };
  const issues = validatePlan(plan);
  if (issues.some((issue) => issue.level === 'blocking'))
    return error(422, 'plan_invalid', 'The plan cannot be frozen.', issues);
  const existing = await versions(deps, prefix);
  if (
    existing.some((p) => p.planVersion === plan.planVersion) ||
    plan.planVersion !== (existing.at(-1)?.planVersion ?? 0) + 1 ||
    existing.some((p) => p.planId !== plan.planId)
  )
    return conflict();
  await save(deps.bucket, key, plan);
  return json(201, plan);
}
async function versions(deps: Deps, prefix: string): Promise<ExperimentPlan[]> {
  const all = (await keys(deps.bucket, prefix)).filter((key) =>
    /^[1-9][0-9]*\.json$/.test(key.slice(prefix.length)),
  );
  const found = await Promise.all(all.map((key) => read<ExperimentPlan>(deps.bucket, key)));
  return found
    .filter((p): p is ExperimentPlan => p !== undefined)
    .sort((a, b) => a.planVersion - b.planVersion);
}
