import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthValue } from '@/shared/auth/authContext';
import { ApiProvider } from '@/shared/api/ApiProvider';
import type { ApiClient } from '@/shared/api/client';
import Page from './Page';
const user = { uid: 'a', email: 'a@hyperdatalab.org', name: 'a' };
const project = {
  id: '0123456789abcdef',
  title: 'First',
  owner: user.email,
  members: [user.email],
  archived: false,
  createdAt: '2026-11-16T00:00:00Z',
  updatedAt: '2026-11-16T00:00:00Z',
};
function setup(signedIn = true, projects = [project]) {
  const api: ApiClient = {
    listPlans: vi.fn(),
    getPlan: vi.fn(),
    freezePlan: vi.fn(),
    getConsent: vi.fn(),
    acceptConsent: vi.fn(),
    getUsage: vi.fn(),
    chat: vi.fn(),
    getDoc: vi.fn(),
    putDoc: vi.fn(),
    listItems: vi.fn(),
    getItem: vi.fn(),
    putItem: vi.fn(),
    me: vi.fn(),
    listProjects: vi.fn().mockResolvedValue(projects),
    createProject: vi.fn().mockResolvedValue(project),
    getProject: vi.fn(),
    patchProject: vi.fn().mockResolvedValue(project),
  };
  const auth: AuthValue = {
    mode: 'firebase',
    user: signedIn ? user : null,
    ready: true,
    error: '',
    signIn: vi.fn(),
    signOut: vi.fn(),
    getIdToken: vi.fn(),
  };
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <ApiProvider client={api}>
          <Page />
        </ApiProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return api;
}
describe('projects', () => {
  it('PJ-06 signed out makes no API request', () => {
    const api = setup(false);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(api.listProjects).not.toHaveBeenCalled();
  });
  it('PJ-07 lists and creates a project', async () => {
    const api = setup();
    expect(await screen.findByText('First')).toBeInTheDocument();
    expect(screen.getByText(/Chủ dự án: bạn · cập nhật/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /T\u1ea1o d\u1ef1 \u00e1n/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'L\u01b0u' }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith('New'));
    fireEvent.click(await screen.findByRole('button', { name: /\u0110\u1ed5i t\u00ean/ }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'L\u01b0u' }));
    await waitFor(() => expect(api.patchProject).toHaveBeenCalledWith(project.id, { title: 'Renamed' }));
  });
  it('PJ-08 archives a project', async () => {
    const api = setup();
    await screen.findByText('First');
    vi.mocked(api.listProjects).mockResolvedValueOnce([{ ...project, archived: true }]);
    fireEvent.click(screen.getByRole('button', { name: 'L\u01b0u tr\u1eef' }));
    await waitFor(() => expect(api.patchProject).toHaveBeenCalledWith(project.id, { archived: true }));
    const filter = await screen.findByRole('button', { name: /\u0110\u00e3 l\u01b0u tr\u1eef/ });
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    fireEvent.click(filter);
    expect(screen.getByText('First')).toBeInTheDocument();
    vi.mocked(api.listProjects).mockResolvedValueOnce([project]);
    fireEvent.click(screen.getByRole('button', { name: /Kh\u00f4i ph\u1ee5c/ }));
    await waitFor(() => expect(api.patchProject).toHaveBeenCalledWith(project.id, { archived: false }));
    expect(await screen.findByText('First')).toBeInTheDocument();
  });
  it('PJ-09 retries a failed load', async () => {
    const api = setup();
    vi.mocked(api.listProjects).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(await screen.findByRole('button', { name: /Th\u1eed l\u1ea1i/ }));
    expect(await screen.findByText('First')).toBeInTheDocument();
  });
  it('PJ-10 keeps the dialog open after a failed create', async () => {
    const api = setup();
    vi.mocked(api.createProject).mockRejectedValueOnce(new Error('offline'));
    await screen.findByText('First');
    fireEvent.click(screen.getByRole('button', { name: /T\u1ea1o d\u1ef1 \u00e1n/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'L\u01b0u' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await waitFor(() => expect(api.createProject).toHaveBeenCalled());
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
  it('PJ-07 shows another owner’s email', async () => {
    setup(true, [{ ...project, owner: 'other@hyperdatalab.org' }]);
    expect(await screen.findByText(/Chủ dự án: other@hyperdatalab.org · cập nhật/)).toBeInTheDocument();
  });
  it('PJ-15 explains when all projects are archived', async () => {
    setup(true, [{ ...project, archived: true }]);
    expect(await screen.findByText('Không có dự án đang hoạt động')).toBeInTheDocument();
    expect(screen.getByText('Các dự án đã lưu trữ nằm sau bộ lọc Đã lưu trữ.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Đã lưu trữ/ }));
    expect(screen.getByText('First')).toBeInTheDocument();
  });
});
