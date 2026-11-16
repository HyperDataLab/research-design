import { describe, expect, it } from 'vitest';
import { chatRequestSchema, promptVersionSchema } from './contract';
import { llmErrorMessage } from './llmErrors';
import { CONNECTION_TEST_MESSAGES, PROMPT_VERSIONS } from './prompts';
import { budgetLevel, formatTokens } from './usageView';
describe('LLM client helpers', () => {
  it('LC-01 maps every error and fallback', () => {
    expect(llmErrorMessage('consent_required', 403)).toBe(
      'Cần đồng ý gửi dữ liệu cho AI trước khi dùng tính năng này.',
    );
    expect(llmErrorMessage('budget_exceeded', 429)).toBe('Đã hết hạn mức token hôm nay.');
    for (const code of ['llm_not_configured', 'upstream_error', 'upstream_timeout'])
      expect(llmErrorMessage(code, 500)).not.toBe(llmErrorMessage('unknown', 500));
    expect(llmErrorMessage('', 0)).toBe('Không kết nối được máy chủ.');
    expect(llmErrorMessage('unknown', 500)).toBe('Không thể hoàn tất yêu cầu. Vui lòng thử lại.');
  });
  it('LC-02 formats tokens and budget boundaries', () => {
    expect([budgetLevel(79.9, 100), budgetLevel(80, 100), budgetLevel(100, 100), budgetLevel(0, 0)]).toEqual([
      'ok',
      'warning',
      'over',
      'over',
    ]);
    expect(formatTokens(12300)).toBe('12.300');
  });
  it('LC-03 validates prompt versions and connection request', () => {
    Object.values(PROMPT_VERSIONS).forEach((v) =>
      expect(promptVersionSchema.safeParse(v).success).toBe(true),
    );
    expect(
      chatRequestSchema.safeParse({
        projectId: '0123456789abcdef',
        feature: 'connection_test',
        promptVersion: PROMPT_VERSIONS.connection_test,
        messages: CONNECTION_TEST_MESSAGES,
        maxOutputTokens: 16,
      }).success,
    ).toBe(true);
  });
});
