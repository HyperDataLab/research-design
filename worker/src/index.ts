import { LLM_LIMITS } from '../../src/core/llm/contract';
import { createRemoteJWKSet } from 'jose';
import { handle, type Bucket } from './app';
import { SECURETOKEN_JWKS, verifyFirebaseToken } from './auth';

interface Env {
  BUCKET: Bucket;
  LLM_BASE_URL?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  LLM_PROVIDER?: string;
  DAILY_TOKEN_BUDGET?: string;
  LLM_MAX_OUTPUT_TOKENS?: string;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_DOMAIN: string;
  ALLOWED_ORIGINS: string;
}
const numberOr = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return value && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const jwks = createRemoteJWKSet(new URL(SECURETOKEN_JWKS));
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(
      {
        bucket: env.BUCKET,
        llmProvider: env.LLM_PROVIDER || 'unknown',
        llm:
          env.LLM_BASE_URL && env.LLM_API_KEY && env.LLM_MODEL
            ? {
                baseUrl: env.LLM_BASE_URL,
                apiKey: env.LLM_API_KEY,
                model: env.LLM_MODEL,
                provider: env.LLM_PROVIDER || 'unknown',
                dailyTokenBudget: numberOr(env.DAILY_TOKEN_BUDGET, 300000),
                maxOutputTokens: Math.min(
                  numberOr(env.LLM_MAX_OUTPUT_TOKENS, LLM_LIMITS.maxOutputTokens),
                  LLM_LIMITS.maxOutputTokens,
                ),
                fetch,
                timeoutMs: 120000,
              }
            : null,
        verifyToken: (token) => verifyFirebaseToken(token, jwks, env.FIREBASE_PROJECT_ID, env.ALLOWED_DOMAIN),
        allowedDomain: env.ALLOWED_DOMAIN,
        allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
        now: () => new Date(),
      },
      request,
    );
  },
};
