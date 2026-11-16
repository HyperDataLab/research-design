import type { Plugin } from 'vite';
import { Readable } from 'node:stream';
import { handle, type Deps } from '../worker/src/app';
import { emailAllowed } from '../worker/src/auth';
import { MemoryBucket } from '../worker/src/memoryBucket';
export function devApi(): Plugin {
  const deps: Deps = {
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
