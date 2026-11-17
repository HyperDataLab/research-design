import type { Plugin } from 'vite';
import { Readable } from 'node:stream';
import { handle, type Deps } from '../worker/src/app';
import { emailAllowed } from '../worker/src/auth';
import { MemoryBucket } from '../worker/src/memoryBucket';
import { estimateTokens } from '../src/core/llm/contract';

/**
 * The dev server never reaches a real model. This stands in for the router: it answers every call with a
 * fixed text and reports usage, so consent, the budget and the ledger can be exercised locally at no cost.
 */
const fakeRouter: typeof fetch = async (_input, init) => {
  const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
    messages?: { content: string }[];
  };
  const prompt = (body.messages ?? []).map((message) => message.content).join('');
  let content = 'OK';
  const user = (body.messages ?? []).find(
    (message) => message.content.includes('"facts"') && message.content.includes('"ref"'),
  );
  if (user) {
    const parsed = JSON.parse(user.content) as { facts: { ref: string }[] };
    const refs = parsed.facts.map((fact) => fact.ref);
    if (refs[0])
      content = JSON.stringify({
        suggestions: [
          { text: 'Consider this fact in the plan.', cites: [refs[0]] },
          {
            text: 'Consider another planning option.',
            cites: [refs[1] ?? refs[0], 'p-ffffffffffff/unknown'],
          },
        ],
      });
  }
  return Response.json({
    choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: estimateTokens(prompt), completion_tokens: 1 },
  });
};
export function devApi(): Plugin {
  const deps: Deps = {
    llm: {
      baseUrl: 'http://dev-router.invalid/v1',
      apiKey: 'dev',
      model: 'dev-fixed-answer',
      provider: 'máy chủ dev (không gọi model thật)',
      dailyTokenBudget: 20000,
      maxOutputTokens: 4096,
      fetch: fakeRouter,
      timeoutMs: 5000,
    },
    llmProvider: 'máy chủ dev (không gọi model thật)',
    bucket: new MemoryBucket(),
    allowedOrigins: [],
    allowedDomain: 'hyperdatalab.org',
    now: () => new Date(),
    verifyToken: async (token) => {
      if (!token.startsWith('dev:')) throw new Error('Invalid token');
      const email = token.slice(4);
      if (!emailAllowed(email, 'hyperdatalab.org') || !/^[^\s/@]+@[^\s/@]+$/.test(email))
        throw new Error('Invalid email');
      return { uid: email, email, name: email.split('@')[0] ?? '' };
    },
  };
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        void (async () => {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers))
              if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
            const method = req.method ?? 'GET';
            const body = Buffer.concat(chunks);
            const response = await handle(
              deps,
              new Request('http://localhost' + (req.url ?? '/'), {
                method,
                headers,
                ...(method === 'GET' || method === 'HEAD' || !body.length ? {} : { body }),
              }),
            );
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            if (response.body)
              Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(res);
            else res.end();
          } catch {
            res.statusCode = 500;
            res.end();
          }
        })();
      });
    },
  };
}
