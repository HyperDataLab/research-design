export function llmErrorMessage(code: string, status: number): string {
  if (status === 0) return 'Không kết nối được máy chủ.';
  const messages: Record<string, string> = {
    consent_required: 'Cần đồng ý gửi dữ liệu cho AI trước khi dùng tính năng này.',
    budget_exceeded: 'Đã hết hạn mức token hôm nay.',
    llm_not_configured: 'AI chưa được cấu hình.',
    upstream_error: 'Không thể kết nối với nhà cung cấp AI.',
    upstream_timeout: 'Kết nối với nhà cung cấp AI đã hết thời gian chờ.',
  };
  return messages[code] ?? 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}
