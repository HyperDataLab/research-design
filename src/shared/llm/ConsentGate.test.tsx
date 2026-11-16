import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ConsentGate } from './ConsentGate';
import { useConsent } from './useConsent';
vi.mock('./useConsent', () => ({ useConsent: vi.fn() }));
const state = { required: { version: 1, provider: 'Provider' }, accepted: null, configured: true };
describe('ConsentGate', () => {
  it('LC-06 gates children, configuration and budget', () => {
    const mock = vi.mocked(useConsent);
    mock.mockReturnValue({
      state,
      ready: false,
      loading: false,
      error: '',
      accept: vi.fn(),
      reload: vi.fn(),
    });
    const view = render(
      <MemoryRouter>
        <ConsentGate>Child</ConsentGate>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Cần đồng ý gửi dữ liệu/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/settings');
    mock.mockReturnValue({
      state: { ...state, configured: false },
      ready: false,
      loading: false,
      error: '',
      accept: vi.fn(),
      reload: vi.fn(),
    });
    view.rerender(
      <MemoryRouter>
        <ConsentGate>Child</ConsentGate>
      </MemoryRouter>,
    );
    expect(screen.getByText('AI chưa được cấu hình')).toBeInTheDocument();
    mock.mockReturnValue({ state, ready: true, loading: false, error: '', accept: vi.fn(), reload: vi.fn() });
    view.rerender(
      <MemoryRouter>
        <ConsentGate>Child</ConsentGate>
      </MemoryRouter>,
    );
    expect(screen.getByText('Child')).toBeInTheDocument();
    view.rerender(
      <MemoryRouter>
        <ConsentGate over>Child</ConsentGate>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Đã hết hạn mức token hôm nay/)).toBeInTheDocument();
  });
});
