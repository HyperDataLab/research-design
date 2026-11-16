import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiContext } from '@/shared/api/apiContext';
import { ApiError, createApiClient } from '@/shared/api/client';
import { AuthContext, type AuthValue } from '@/shared/auth/authContext';
import { ToastContext } from '@/shared/ui/toastContext';
import Page from './Page';

const user = { uid: 'a', email: 'a@hyperdatalab.org', name: 'A' };
const accepted = {
  version: 1,
  provider: 'Provider',
  acceptedBy: user.email,
  acceptedAt: '2026-11-16T00:00:00Z',
};
const state = { required: { version: 1, provider: 'Provider' }, accepted: null, configured: true };
const usage = {
  day: '2026-11-16',
  dailyBudget: 100,
  today: { inputTokens: 50, outputTokens: 30, calls: 1, reservedTokens: 0, estimatedCalls: 1 },
  month: { inputTokens: 60, outputTokens: 40, calls: 2 },
  byFeature: [{ feature: 'fact_extraction' as const, inputTokens: 50, outputTokens: 30, calls: 1 }],
};
const project = {
  id: '0123456789abcdef',
  title: 'P',
  owner: user.email,
  members: [user.email],
  archived: false,
  createdAt: '2026-11-16T00:00:00Z',
  updatedAt: '2026-11-16T00:00:00Z',
};
function setup(
  options: {
    signedIn?: boolean;
    configured?: boolean;
    consent?: boolean;
    projects?: boolean;
    usageError?: boolean;
    over?: boolean;
    noEstimates?: boolean;
  } = {},
) {
  const api = createApiClient({ baseUrl: '', getToken: async () => 'token' });
  vi.spyOn(api, 'getConsent').mockResolvedValue({
    ...state,
    configured: options.configured !== false,
    accepted: options.consent ? accepted : null,
  });
  vi.spyOn(api, 'acceptConsent').mockResolvedValue({ ...state, accepted });
  vi.spyOn(api, 'getUsage').mockImplementation(async () => {
    if (options.usageError) throw new Error();
    return {
      ...usage,
      today: {
        ...usage.today,
        inputTokens: options.over ? 70 : 50,
        estimatedCalls: options.noEstimates ? 0 : 1,
      },
    };
  });
  vi.spyOn(api, 'listProjects').mockResolvedValue(options.projects === false ? [] : [project]);
  vi.spyOn(api, 'chat').mockResolvedValue({
    content: 'OK',
    finishReason: 'stop',
    model: 'm',
    usage: { inputTokens: 2, outputTokens: 3, estimated: false },
  });
  const auth: AuthValue = {
    mode: 'firebase',
    user: options.signedIn === false ? null : user,
    ready: true,
    error: '',
    signIn: vi.fn(),
    signOut: vi.fn(),
    getIdToken: vi.fn(),
  };
  const toast = vi.fn();
  render(
    <AuthContext.Provider value={auth}>
      <ApiContext.Provider value={api}>
        <ToastContext.Provider value={toast}>
          <Page />
        </ToastContext.Provider>
      </ApiContext.Provider>
    </AuthContext.Provider>,
  );
  return { api, toast };
}
describe('settings', () => {
  it('LC-07 accepts the current provider and shows the date', async () => {
    const { api } = setup();
    expect(await screen.findByText('Chưa đồng ý')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý' }));
    await waitFor(() => expect(api.acceptConsent).toHaveBeenCalledWith(1, 'Provider'));
    expect(await screen.findByText(/Đã đồng ý ngày/)).toBeInTheDocument();
  });
  it('LC-08 displays unconfigured state', async () => {
    setup({ configured: false });
    expect(await screen.findByText('AI chưa được cấu hình')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đồng ý' })).not.toBeInTheDocument();
  });
  it('LC-09 shows usage, features and estimates', async () => {
    setup();
    expect(await screen.findByText('80 / 100 token')).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '80');
    expect(screen.getByRole('meter')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByText('Trích dữ kiện')).toBeInTheDocument();
    expect(screen.getByText('Có 1 lần gọi được ước lượng')).toBeInTheDocument();
  });
  it('LC-09 hides the estimate line when there are no estimates', async () => {
    setup({ noEstimates: true });
    await screen.findByRole('meter');
    expect(screen.queryByText(/1 lần gọi được ước lượng/)).not.toBeInTheDocument();
  });
  it('LC-10 marks over budget', async () => {
    setup({ over: true });
    expect(await screen.findByRole('meter')).toHaveAttribute('data-tone', 'over');
  });
  it('LC-11 tests a connection and reports a budget failure', async () => {
    const { api, toast } = setup({ consent: true });
    const button = await screen.findByRole('button', { name: 'Kiểm tra kết nối' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Kết nối tốt: đã dùng 5 token'));
    expect(api.getUsage).toHaveBeenCalledTimes(2);
    vi.mocked(api.chat).mockRejectedValueOnce(new ApiError(429, 'budget_exceeded', ''));
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Đã hết hạn mức token hôm nay.'));
  });
  it('LC-11 disables calls without consent even with a project', async () => {
    setup();
    await screen.findByText('Chưa đồng ý');
    expect(screen.getByRole('button', { name: 'Kiểm tra kết nối' })).toBeDisabled();
  });
  it('LC-11 disables calls without consent or a project', async () => {
    setup({ projects: false });
    expect(await screen.findByText('Cần có một dự án để kiểm tra kết nối.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kiểm tra kết nối' })).toBeDisabled();
  });
  it('LC-12 signed out makes no API call', () => {
    const { api } = setup({ signedIn: false });
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(api.getConsent).not.toHaveBeenCalled();
    expect(api.getUsage).not.toHaveBeenCalled();
    expect(api.listProjects).not.toHaveBeenCalled();
  });
  it('LC-13 usage error leaves consent available', async () => {
    setup({ usageError: true });
    expect(await screen.findByText('Không tải được hạn mức token.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Đồng ý' })).toBeInTheDocument();
  });
});
