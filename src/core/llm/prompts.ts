import type { ChatRequest } from './contract';
export const PROMPT_VERSIONS = { connection_test: 'connection_test@1' } as const;
export const CONNECTION_TEST_MESSAGES: ChatRequest['messages'] = [
  { role: 'system', content: 'Reply with the single word OK.' },
  { role: 'user', content: 'ping' },
];
