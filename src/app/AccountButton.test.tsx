import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthValue } from '@/shared/auth/authContext';
import { AccountButton } from './AccountButton';
const base: AuthValue = {
  mode: 'firebase',
  user: null,
  ready: true,
  error: '',
  signIn: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn(),
};
describe('account', () => {
  it('PJ-13 shows Firebase, dev and unconfigured modes', () => {
    const view = render(
      <AuthContext.Provider value={base}>
        <AccountButton />
      </AuthContext.Provider>,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
    view.rerender(
      <AuthContext.Provider value={{ ...base, mode: 'dev' }}>
        <AccountButton />
      </AuthContext.Provider>,
    );
    expect(screen.getByRole('button').textContent).toContain('(dev)');
    view.rerender(
      <AuthContext.Provider value={{ ...base, mode: 'unconfigured' }}>
        <AccountButton />
      </AuthContext.Provider>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('PJ-13 opens the account menu and closes it on Escape and outside click', () => {
    render(
      <AuthContext.Provider
        value={{ ...base, user: { uid: 'a', email: 'a@hyperdatalab.org', name: 'Alice' } }}
      >
        <AccountButton />
      </AuthContext.Provider>,
    );
    const button = screen.getByRole('button', { name: 'Alice' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('a@hyperdatalab.org')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
