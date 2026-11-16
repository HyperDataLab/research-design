import { emailAllowed, NotAllowedError, type Caller } from './auth';
import { document, itemList } from './documents';
import { error, json, method, missing, read } from './http';
import { plans } from './plans';
import { patchProject, projectKey, projects, type Project } from './projects';
import { DOC_KINDS, ITEM_COLLECTIONS } from '../../src/core/project/storage';

export interface Bucket {
  get(key: string): Promise<{ text(): Promise<string>; httpEtag: string } | null>;
  put(
    key: string,
    value: string,
    options?: { onlyIf: { etagMatches: string } },
  ): Promise<{ httpEtag: string } | null>;
  delete(key: string): Promise<void>;
  list(options: {
    prefix: string;
    cursor?: string;
  }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
}
export interface Deps {
  verifyToken: (token: string) => Promise<Caller>;
  bucket: Bucket;
  allowedOrigins: string[];
  allowedDomain: string;
  now: () => Date;
}
export const PREFIX = 'researchdesign/';

async function route(deps: Deps, request: Request, caller: Caller): Promise<Response> {
  const path = new URL(request.url).pathname.split('/');
  if (path.length === 3 && path[1] === 'v1' && path[2] === 'me')
    return request.method === 'GET' ? json(200, caller) : method();
  if (path[1] !== 'v1' || path[2] !== 'projects') return missing();
  if (path.length === 3) return projects(deps, request, caller);
  const id = path[3];
  if (!id || !/^[a-f0-9]{16}$/.test(id)) return missing();
  const area = path[4];
  const part = path[5];
  const item = path[6];
  const projectRoute = path.length === 4;
  const docRoute =
    path.length === 6 && area === 'docs' && !!part && (DOC_KINDS as readonly string[]).includes(part);
  const itemRoute =
    (path.length === 6 || path.length === 7) &&
    area === 'items' &&
    !!part &&
    (ITEM_COLLECTIONS as readonly string[]).includes(part) &&
    (path.length === 6 || (!!item && /^[a-z0-9][a-z0-9-]{0,79}$/.test(item)));
  const planRoute =
    (path.length === 5 || path.length === 6) &&
    area === 'plans' &&
    (path.length === 5 || (!!part && /^[1-9][0-9]*$/.test(part) && Number.isSafeInteger(Number(part))));
  if (!projectRoute && !docRoute && !itemRoute && !planRoute) return missing();
  const project = await read<Project>(deps.bucket, projectKey(id));
  if (!project || !project.members.includes(caller.email)) return missing();
  if (projectRoute) {
    if (request.method === 'GET') return json(200, project);
    if (request.method === 'PATCH') return patchProject(deps, request, caller, project);
    return method();
  }
  if (project.archived && request.method === 'PUT') return error(409, 'conflict', 'The project is archived.');
  const base = `${PREFIX}projects/${id}/`;
  if (docRoute) return document(deps, request, `${base}docs/${part}.json`, 2 * 1024 * 1024);
  if (itemRoute) {
    const prefix = `${base}items/${part}/`;
    return item
      ? document(deps, request, `${prefix}${item}.json`, 8 * 1024 * 1024)
      : itemList(deps, request, prefix);
  }
  return plans(deps, request, caller, `${base}plans/`, part);
}

export async function handle(deps: Deps, request: Request): Promise<Response> {
  const origin = request.headers.get('Origin');
  const cors = new Headers({ Vary: 'Origin' });
  if (origin && deps.allowedOrigins.includes(origin)) {
    cors.set('Access-Control-Allow-Origin', origin);
    cors.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
    cors.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match');
    cors.set('Access-Control-Expose-Headers', 'ETag');
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  let response: Response;
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) response = error(401, 'unauthenticated', 'A valid token is required.');
  else {
    let caller: Caller | undefined;
    try {
      caller = await deps.verifyToken(token);
      caller.email = caller.email.toLowerCase();
      if (!emailAllowed(caller.email, deps.allowedDomain) || !/^[^\s/@]+@[^\s/@]+$/.test(caller.email))
        throw new NotAllowedError();
    } catch (cause) {
      response =
        cause instanceof NotAllowedError
          ? error(403, 'forbidden', 'The account is not allowed.')
          : error(401, 'unauthenticated', 'A valid token is required.');
      for (const [key, value] of cors) response.headers.set(key, value);
      return response;
    }
    try {
      response = await route(deps, request, caller);
    } catch {
      response = error(500, 'internal', 'Unexpected error.');
    }
  }
  for (const [key, value] of cors) response.headers.set(key, value);
  return response;
}
