import type { Bucket } from './app';

export const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const json = (status: number, value: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
export const error = (status: number, code: string, message: string, issues?: unknown) =>
  json(status, { error: code, message, ...(issues === undefined ? {} : { issues }) });
export const missing = () => error(404, 'not_found', 'The resource was not found.');
export const bad = () => error(400, 'bad_request', 'The request is invalid.');
export const conflict = () => error(409, 'conflict', 'The request conflicts with the stored resource.');
export const method = () => error(405, 'method_not_allowed', 'The method is not allowed.');

export async function body(request: Request, limit: number): Promise<unknown | Response> {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > limit) return error(413, 'too_large', 'The request body is too large.');
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return bad();
  }
}

export async function keys(bucket: Bucket, prefix: string): Promise<string[]> {
  const result: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, ...(cursor ? { cursor } : {}) });
    result.push(...page.objects.map((entry) => entry.key));
    if (page.truncated && !page.cursor) throw new Error('Truncated bucket listing has no cursor');
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return result;
}
export async function read<T>(bucket: Bucket, key: string): Promise<T | undefined> {
  const entry = await bucket.get(key);
  return entry ? (JSON.parse(await entry.text()) as T) : undefined;
}
export const save = (bucket: Bucket, key: string, value: unknown) => bucket.put(key, JSON.stringify(value));
