import { emailAllowed } from './auth';
import type { Caller } from './auth';
import { PREFIX, type Deps } from './app';
import { bad, body, conflict, json, keys, method, object, read, save } from './http';

export interface Project {
  id: string;
  title: string;
  owner: string;
  members: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
export const projectKey = (id: string) => `${PREFIX}projects/${id}/project.json`;
const marker = (email: string, id: string) => `${PREFIX}members/${email}/${id}`;
const titleValid = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 200;

export async function projects(deps: Deps, request: Request, caller: Caller): Promise<Response> {
  if (request.method === 'GET') {
    const prefix = `${PREFIX}members/${caller.email}/`;
    const ids = (await keys(deps.bucket, prefix)).map((key) => key.slice(prefix.length));
    const found = await Promise.all(
      ids.filter((id) => /^[a-f0-9]{16}$/.test(id)).map((id) => read<Project>(deps.bucket, projectKey(id))),
    );
    const visible = found.filter((p): p is Project => !!p && p.members.includes(caller.email));
    visible.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return json(200, { projects: visible });
  }
  if (request.method !== 'POST') return method();
  const input = await body(request, 2 * 1024 * 1024);
  if (input instanceof Response) return input;
  if (!object(input) || Object.keys(input).some((k) => k !== 'title') || !titleValid(input.title))
    return bad();
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
  const now = deps.now().toISOString();
  const project: Project = {
    id,
    title: input.title.trim(),
    owner: caller.email,
    members: [caller.email],
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await deps.bucket.put(marker(caller.email, id), '');
  await save(deps.bucket, projectKey(id), project);
  return json(201, project);
}

export async function patchProject(
  deps: Deps,
  request: Request,
  caller: Caller,
  project: Project,
): Promise<Response> {
  const input = await body(request, 2 * 1024 * 1024);
  if (input instanceof Response) return input;
  if (!object(input) || Object.keys(input).some((k) => !['title', 'archived', 'members'].includes(k)))
    return bad();
  if (project.archived && Object.keys(input).some((k) => k !== 'archived')) return conflict();
  if ('title' in input && !titleValid(input.title)) return bad();
  if ('archived' in input && typeof input.archived !== 'boolean') return bad();
  let members = project.members;
  if ('members' in input) {
    if (caller.email !== project.owner) return errorForbidden();
    if (
      !Array.isArray(input.members) ||
      input.members.length > 50 ||
      !input.members.every(
        (m: unknown) => emailAllowed(m, deps.allowedDomain) && /^[^\s/@]+@[^\s/@]+$/.test(m),
      )
    )
      return bad();
    members = [...new Set((input.members as string[]).map((m) => m.toLowerCase()))].sort();
    if (!members.includes(project.owner)) return bad();
  }
  const updated: Project = {
    ...project,
    members,
    updatedAt: deps.now().toISOString(),
    ...(typeof input.title === 'string' ? { title: input.title.trim() } : {}),
    ...(typeof input.archived === 'boolean' ? { archived: input.archived } : {}),
  };
  for (const member of members.filter((m) => !project.members.includes(m)))
    await deps.bucket.put(marker(member, project.id), '');
  await save(deps.bucket, projectKey(project.id), updated);
  for (const member of project.members.filter((m) => !members.includes(m)))
    await deps.bucket.delete(marker(member, project.id));
  return json(200, updated);
}
function errorForbidden() {
  return json(403, { error: 'forbidden', message: 'Only the owner may change members.' });
}
