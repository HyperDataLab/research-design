import type { Deps } from './app';
import { bad, body, error, json, keys, method, missing, object } from './http';

export async function document(deps: Deps, request: Request, key: string, limit: number): Promise<Response> {
  if (request.method === 'GET') {
    const found = await deps.bucket.get(key);
    if (!found) return missing();
    return json(200, { data: JSON.parse(await found.text()) as unknown }, { ETag: found.httpEtag });
  }
  if (request.method !== 'PUT') return method();
  const input = await body(request, limit);
  if (input instanceof Response) return input;
  if (!object(input) || Object.keys(input).length !== 1 || !('data' in input)) return bad();
  const match = request.headers.get('If-Match');
  if (match !== null && !/^"[^",]+"$/.test(match))
    return error(412, 'precondition_failed', 'The object has changed.');
  const current = await deps.bucket.get(key);
  if (match === '*' || (!match && current) || (match && !current))
    return error(412, 'precondition_failed', 'The object has changed.');
  const result = await deps.bucket.put(
    key,
    JSON.stringify(input.data),
    match ? { onlyIf: { etagMatches: match.slice(1, -1) } } : undefined,
  );
  if (!result) return error(412, 'precondition_failed', 'The object has changed.');
  return json(200, { ok: true }, { ETag: result.httpEtag });
}
export async function itemList(deps: Deps, request: Request, prefix: string): Promise<Response> {
  if (request.method !== 'GET') return method();
  const all = await keys(deps.bucket, prefix);
  const items = await Promise.all(
    all
      .filter((key) => /^[a-z0-9][a-z0-9-]{0,79}\.json$/.test(key.slice(prefix.length)))
      .map(async (key) => {
        const entry = await deps.bucket.get(key);
        return entry ? { key: key.slice(prefix.length, -5), etag: entry.httpEtag } : undefined;
      }),
  );
  return json(200, {
    items: items.filter((entry) => entry !== undefined).sort((a, b) => a.key.localeCompare(b.key)),
  });
}
