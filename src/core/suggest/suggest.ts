import { z } from 'zod';
import type { Draft } from '../draft/schema';
import type { FactsDoc } from '../facts/factsDoc';
import type { ChatRequest } from '../llm/contract';
import type { Paper } from '../papers/papers';

export const PROMPT_VERSION = 'plan_suggestion@1';
type Target = 'hypotheses' | 'metrics' | 'threats';
const TASKS: Record<Target, string> = {
  hypotheses:
    'Suggest testable hypotheses that the facts make worth testing and that the plan does not already have.',
  metrics:
    'Suggest metrics the plan should measure, given what the cited papers measured and on which datasets.',
  threats:
    'Suggest threats to validity the plan should guard against, given how the cited papers ran their experiments.',
};
export function buildSuggestionRequest({
  projectId,
  target,
  papers,
  factsByPaperId,
  draft,
}: {
  projectId: string;
  target: Target;
  papers: Paper[];
  factsByPaperId: Record<string, FactsDoc | undefined>;
  draft: Draft;
}): { factCount: number; request: ChatRequest | null; allow: Set<string> } {
  const facts = papers.flatMap((paper) => {
    const doc = factsByPaperId[paper.id];
    return (doc?.facts.facts ?? [])
      .filter((fact) => doc?.decisions[fact.id]?.decision === 'use')
      .map((fact) => ({
        ref: `${paper.id}/${fact.id}`,
        kind: fact.kind,
        value: fact.value,
        paper: paper.title,
      }));
  });
  const allow = new Set(facts.map((fact) => fact.ref));
  if (!facts.length) return { factCount: 0, request: null, allow };
  const request: ChatRequest = {
    projectId,
    feature: 'plan_suggestion',
    promptVersion: PROMPT_VERSION,
    maxOutputTokens: 1500,
    messages: [
      {
        role: 'system',
        content: [
          'You help a researcher plan an experiment. You are given facts that were read from published papers',
          'and that the researcher chose to use, and the questions and hypotheses of the plan so far.',
          TASKS[target],
          'Give at most 8 suggestions, each one or two sentences, in the language of the questions (Vietnamese when there are none).',
          'Every suggestion must cite at least one `ref` from the supplied facts in `cites`; never invent a ref.',
          'A suggestion is a candidate for the researcher to judge: do not state that a result is true.',
          'Answer with JSON only: {"suggestions":[{"text":"...","cites":["..."]}]}.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          facts,
          questions: draft.questions.map(({ id, text }) => ({ id, text })),
          hypotheses: draft.hypotheses.map(({ id, statement }) => ({ id, statement })),
        }),
      },
    ],
    responseSchema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { text: { type: 'string' }, cites: { type: 'array', items: { type: 'string' } } },
            required: ['text', 'cites'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
  };
  return { factCount: facts.length, request, allow };
}

const answerSchema = z.object({
  suggestions: z.array(z.object({ text: z.string(), cites: z.array(z.string()) })),
});

function parseObject(content: string): unknown {
  for (let start = content.indexOf('{'); start !== -1; start = content.indexOf('{', start + 1)) {
    let depth = 0,
      quoted = false,
      escaped = false;
    for (let i = start; i < content.length; i++) {
      const char = content[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) {
        try {
          return JSON.parse(content.slice(start, i + 1)) as unknown;
        } catch {
          break;
        }
      }
    }
  }
  return null;
}
export function readSuggestions(
  content: string,
  allow: Set<string>,
):
  | { ok: false }
  | {
      ok: true;
      suggestions: { text: string; cites: string[] }[];
      droppedCites: number;
      droppedSuggestions: number;
    } {
  const parsed = answerSchema.safeParse(parseObject(content));
  if (!parsed.success) return { ok: false };
  const suggestions: { text: string; cites: string[] }[] = [];
  let droppedCites = 0,
    droppedSuggestions = 0;
  for (const suggestion of parsed.data.suggestions) {
    const cites = [
      ...new Set(
        suggestion.cites.filter((cite) => {
          if (allow.has(cite)) return true;
          droppedCites++;
          return false;
        }),
      ),
    ];
    const text = suggestion.text.trim();
    if (!text || text.length > 600 || !cites.length || suggestions.length >= 12) {
      droppedSuggestions++;
      continue;
    }
    suggestions.push({ text, cites });
  }
  return { ok: true, suggestions, droppedCites, droppedSuggestions };
}
