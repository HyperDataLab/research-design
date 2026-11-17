import { emptyDraft } from '../draft/schema';
import type { ExperimentFact, ExperimentFactsView } from '../facts/experimentFacts';
import type { FactsDoc } from '../facts/factsDoc';
import type { Paper } from '../papers/papers';
import { buildSuggestionRequest, PROMPT_VERSION, readSuggestions } from './suggest';

const at = '2026-01-01T00:00:00Z';
const paper = { id: 'p-000000000001', title: 'Invented paper' } as Paper;
const fact = {
  id: 'fact-1',
  kind: 'metric',
  value: 'Invented value',
  sentenceKeys: ['secret-sentence-key'],
  tableCell: { columnHeader: 'secret table header' },
  number: 8791,
  unit: 'secret-unit',
} as ExperimentFact;
const doc: FactsDoc = {
  schemaVersion: 1,
  paperId: paper.id,
  source: { paperlabId: '', etag: '', fetchedBy: '', fetchedAt: at },
  facts: { facts: [fact, { ...fact, id: 'fact-2', value: 'secret excluded value' }] } as ExperimentFactsView,
  decisions: { 'fact-1': { decision: 'use', reason: null, by: '', at } },
};
const args = {
  projectId: '0123456789abcdef',
  target: 'hypotheses' as const,
  papers: [paper],
  factsByPaperId: { [paper.id]: doc },
  draft: emptyDraft(),
};
it('FR-405 sends only selected fact projections, questions and hypotheses for each target', () => {
  const draft = {
    ...emptyDraft(),
    questions: [{ id: 'q-1', text: 'Question', gap: 'private gap', papers: [] }],
    hypotheses: [
      {
        id: 'h-1',
        statement: 'Hypothesis',
        kind: 'exploratory' as const,
        question: null,
        claim: null,
        independent: [],
        dependent: [],
      },
    ],
  };
  for (const target of ['hypotheses', 'metrics', 'threats'] as const) {
    const result = buildSuggestionRequest({ ...args, target, draft });
    expect(result.factCount).toBe(1);
    expect(result.allow).toEqual(new Set([`${paper.id}/fact-1`]));
    expect(result.request?.feature).toBe('plan_suggestion');
    expect(result.request?.promptVersion).toBe(PROMPT_VERSION);
    expect(PROMPT_VERSION).toBe('plan_suggestion@1');
    expect(result.request?.maxOutputTokens).toBe(1500);
    expect(result.request?.messages[0]?.content).toContain(target);
    expect(result.request?.messages[0]?.content).toMatch(/cite.*ref/i);
    expect(result.request?.messages[0]?.content).toMatch(/JSON only/i);
    expect(result.request?.responseSchema).toHaveProperty('properties.suggestions');
    const sent = JSON.stringify(result.request);
    for (const secret of [
      'secret-sentence-key',
      'secret table header',
      'secret excluded value',
      'secret-unit',
      '8791',
      'private gap',
    ])
      expect(sent).not.toContain(secret);
    expect(sent).toContain('Invented value');
    expect(sent).toContain('Question');
    expect(sent).toContain('Hypothesis');
  }
  expect(buildSuggestionRequest({ ...args, factsByPaperId: {} })).toEqual({
    factCount: 0,
    request: null,
    allow: new Set(),
  });
});
it('FR-405 parses JSON, fenced JSON and prose; rejects malformed responses', () => {
  const json = JSON.stringify({ suggestions: [{ text: ' Idea ', cites: ['a', 'a', 'bad'] }] });
  const expected = {
    ok: true,
    suggestions: [{ text: 'Idea', cites: ['a'] }],
    droppedCites: 1,
    droppedSuggestions: 0,
  };
  for (const content of [json, `\`\`\`json\n${json}\n\`\`\``, `Here: ${json} done`])
    expect(readSuggestions(content, new Set(['a']))).toEqual(expected);
  expect(readSuggestions('not JSON', new Set())).toEqual({ ok: false });
  expect(readSuggestions('{"suggestions":1}', new Set())).toEqual({ ok: false });
});
it('FR-405 drops empty, overlong, uncited and excess suggestions', () => {
  const suggestions = [
    { text: ' ', cites: ['a'] },
    { text: 'x'.repeat(601), cites: ['a'] },
    { text: 'bad', cites: ['unknown'] },
    ...Array.from({ length: 13 }, (_, i) => ({ text: `idea ${i}`, cites: ['a'] })),
  ];
  const result = readSuggestions(JSON.stringify({ suggestions }), new Set(['a']));
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.suggestions).toHaveLength(12);
  expect(result.droppedCites).toBe(1);
  expect(result.droppedSuggestions).toBe(4);
});

it('FR-405 drops a suggestion whose citations are all outside the facts sent', () => {
  const result = readSuggestions(
    JSON.stringify({
      suggestions: [
        { text: 'Kept', cites: ['p-000000000001/f-1'] },
        { text: 'Dropped', cites: ['p-999999999999/f-9'] },
        { text: 'No cites', cites: [] },
      ],
    }),
    new Set(['p-000000000001/f-1']),
  );
  expect(result).toMatchObject({ ok: true, droppedSuggestions: 2 });
  expect(result.ok && result.suggestions.map((entry) => entry.text)).toEqual(['Kept']);
});
