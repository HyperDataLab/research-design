import {
  CONSENT_VERSION,
  LLM_LIMITS,
  chatRequestSchema,
  consentRecordSchema,
  estimateTokens,
  type ChatRequest,
} from '../../src/core/llm/contract';
import { type Caller } from './auth';
import { type Deps, PREFIX } from './app';
import { bad, body, conflict, error, json, method, missing, object, read } from './http';
import { projectKey, type Project } from './projects';
import {
  addCounts,
  addEntry,
  daySchema,
  emptyCounts,
  emptyDay,
  expire,
  id,
  monthSchema,
  readValue,
  update,
  usageKey,
  type Entry,
  type Month,
  type Reservation,
} from './ledger';

const consentKey = (email: string) => `${PREFIX}consent/${email}.json`;
async function state(deps: Deps, caller: Caller) {
  const record = consentRecordSchema.safeParse(await read<unknown>(deps.bucket, consentKey(caller.email)));
  return {
    required: { version: CONSENT_VERSION, provider: deps.llmProvider },
    accepted:
      record.success && record.data.version === CONSENT_VERSION && record.data.provider === deps.llmProvider
        ? record.data
        : null,
    configured: deps.llm !== null,
  };
}
export async function consent(deps: Deps, request: Request, caller: Caller): Promise<Response> {
  if (request.method === 'GET') return json(200, await state(deps, caller));
  if (request.method !== 'PUT') return method();
  const input = await body(request, LLM_LIMITS.maxRequestBytes);
  if (input instanceof Response) return input;
  if (
    !object(input) ||
    Object.keys(input).length !== 2 ||
    typeof input.version !== 'number' ||
    !Number.isInteger(input.version) ||
    typeof input.provider !== 'string'
  )
    return bad();
  if (input.version !== CONSENT_VERSION || input.provider !== deps.llmProvider) return conflict();
  const record = {
    version: CONSENT_VERSION,
    provider: deps.llmProvider,
    acceptedBy: caller.email,
    acceptedAt: deps.now().toISOString(),
  };
  if (
    !(await update(
      deps.bucket,
      consentKey(caller.email),
      () => record,
      () => record,
      consentRecordSchema,
    ))
  )
    return error(503, 'internal', 'Could not save consent.');
  return json(200, {
    required: { version: CONSENT_VERSION, provider: deps.llmProvider },
    accepted: record,
    configured: deps.llm !== null,
  });
}
export async function usage(deps: Deps, request: Request, caller: Caller): Promise<Response> {
  if (request.method !== 'GET') return method();
  const date = deps.now().toISOString().slice(0, 10);
  const [day, month] = await Promise.all([
    readValue(deps.bucket, usageKey(caller.email, date), emptyDay, daySchema),
    readValue<Month>(
      deps.bucket,
      usageKey(caller.email, date.slice(0, 7)),
      () => ({
        totals: emptyCounts(),
      }),
      monthSchema,
    ),
  ]);
  return json(200, {
    day: date,
    dailyBudget: deps.llm?.dailyTokenBudget ?? 0,
    today: {
      ...day.totals,
      reservedTokens: day.reservations.reduce((n, r) => n + r.tokens, 0),
      estimatedCalls: day.entries.filter((e) => e.estimated).length,
    },
    month: month.totals,
    byFeature: Object.entries(day.byFeature).map(([feature, counts]) => ({ feature, ...counts })),
  });
}
async function upstream(
  deps: NonNullable<Deps['llm']>,
  input: ChatRequest,
  cap: number,
): Promise<
  | {
      content: string;
      finishReason: string | null;
      inputTokens: number;
      outputTokens: number;
      estimated: boolean;
    }
  | 'timeout'
  | 'error'
> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('timeout'));
      }, deps.timeoutMs);
    });
    const operation = async () => {
      const response = await deps.fetch(`${deps.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${deps.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: deps.model,
          messages: input.messages,
          max_tokens: cap,
          temperature: 0.1,
          ...(input.responseSchema
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: { name: 'output', strict: true, schema: input.responseSchema },
                },
              }
            : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) return 'error' as const;
      const data: unknown = await response.json();
      if (
        !object(data) ||
        !Array.isArray(data.choices) ||
        !object(data.choices[0]) ||
        !object(data.choices[0].message) ||
        typeof data.choices[0].message.content !== 'string'
      )
        return 'error' as const;
      const content = data.choices[0].message.content;
      const u = data.usage;
      const valid =
        object(u) &&
        Number.isSafeInteger(u.prompt_tokens) &&
        (u.prompt_tokens as number) >= 0 &&
        Number.isSafeInteger(u.completion_tokens) &&
        (u.completion_tokens as number) >= 0;
      return {
        content,
        finishReason:
          typeof data.choices[0].finish_reason === 'string' ? data.choices[0].finish_reason : null,
        inputTokens: valid
          ? (u.prompt_tokens as number)
          : estimateTokens(input.messages.map((m) => m.content).join('')),
        outputTokens: valid ? (u.completion_tokens as number) : estimateTokens(content),
        estimated: !valid,
      };
    };
    return await Promise.race([operation(), timeout]);
  } catch {
    return controller.signal.aborted ? 'timeout' : 'error';
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function chat(deps: Deps, request: Request, caller: Caller): Promise<Response> {
  if (request.method !== 'POST') return method();
  const raw = await body(request, LLM_LIMITS.maxRequestBytes);
  if (raw instanceof Response) return raw;
  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success) return bad();
  const input = parsed.data;
  const config = deps.llm;
  if (!config) return error(503, 'llm_not_configured', 'The language model is not configured.');
  if (!(await state(deps, caller)).accepted) return error(403, 'consent_required', 'Consent is required.');
  const project = await read<Project>(deps.bucket, projectKey(input.projectId));
  if (!project || !project.members.includes(caller.email)) return missing();
  if (project.archived) return conflict();
  const now = deps.now();
  const date = now.toISOString().slice(0, 10);
  const key = usageKey(caller.email, date);
  const cap = Math.min(input.maxOutputTokens ?? LLM_LIMITS.maxOutputTokens, config.maxOutputTokens);
  const reservation: Reservation = {
    id: id(),
    at: now.toISOString(),
    tokens: estimateTokens(input.messages.map((m) => m.content).join('')) + cap,
    projectId: input.projectId,
    feature: input.feature,
    promptVersion: input.promptVersion,
    model: config.model,
  };
  let exceeded: { used: number; reserved: number } | undefined;
  let expired: Entry[] = [];
  let reserved: boolean;
  try {
    await readValue(
      deps.bucket,
      usageKey(caller.email, date.slice(0, 7)),
      () => ({ totals: emptyCounts() }),
      monthSchema,
    );
    // The first write of a day is read-then-write; simultaneous first calls can both pass.
    reserved = await update(
      deps.bucket,
      key,
      emptyDay,
      (old) => {
        const day = expire(old, now);
        expired = day.entries.slice(old.entries.length);
        const used = day.totals.inputTokens + day.totals.outputTokens;
        const pending = day.reservations.reduce((n, r) => n + r.tokens, 0);
        if (used + pending + reservation.tokens > config.dailyTokenBudget) {
          exceeded = { used, reserved: pending };
          return null;
        }
        return { ...day, reservations: [...day.reservations, reservation] };
      },
      daySchema,
    );
  } catch {
    return error(503, 'internal', 'Could not reserve usage.');
  }
  if (!reserved)
    return exceeded
      ? json(429, {
          error: 'budget_exceeded',
          message: 'The daily budget would be exceeded.',
          ...exceeded,
          dailyBudget: config.dailyTokenBudget,
        })
      : error(503, 'internal', 'Could not reserve usage.');
  if (expired.length) {
    try {
      await update<Month>(
        deps.bucket,
        usageKey(caller.email, date.slice(0, 7)),
        () => ({ totals: emptyCounts() }),
        (month) => ({
          totals: expired.reduce(
            (counts, entry) => addCounts(counts, entry.inputTokens, entry.outputTokens),
            month.totals,
          ),
        }),
        monthSchema,
      );
    } catch {
      /* The day remains the authoritative budget. */
    }
  }
  const result = await upstream(config, input, cap);
  if (typeof result === 'string') {
    try {
      await update(
        deps.bucket,
        key,
        emptyDay,
        (day) => {
          const current = expire(day, deps.now());
          return { ...current, reservations: current.reservations.filter((r) => r.id !== reservation.id) };
        },
        daySchema,
      );
    } catch {
      /* A failed cleanup leaves the conservative reservation in place. */
    }
    return error(
      result === 'timeout' ? 504 : 502,
      result === 'timeout' ? 'upstream_timeout' : 'upstream_error',
      result === 'timeout' ? 'The language model timed out.' : 'The language model request failed.',
    );
  }
  const entry: Entry = {
    id: reservation.id,
    at: deps.now().toISOString(),
    projectId: input.projectId,
    feature: input.feature,
    promptVersion: input.promptVersion,
    model: config.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimated: result.estimated,
  };
  try {
    const daySaved = await update(
      deps.bucket,
      key,
      emptyDay,
      (day) => {
        const current = expire(day, deps.now());
        return addEntry(
          { ...current, reservations: current.reservations.filter((r) => r.id !== reservation.id) },
          entry,
        );
      },
      daySchema,
    );
    if (daySaved)
      await update<Month>(
        deps.bucket,
        usageKey(caller.email, date.slice(0, 7)),
        () => ({ totals: emptyCounts() }),
        (month) => ({ totals: addCounts(month.totals, entry.inputTokens, entry.outputTokens) }),
        monthSchema,
      );
  } catch {
    /* The day is authoritative; a failed day write leaves the reservation. */
  }
  return json(200, {
    content: result.content,
    finishReason: result.finishReason,
    model: config.model,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimated: result.estimated,
    },
  });
}
