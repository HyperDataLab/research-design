import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AuthContext, type AuthValue } from '@/shared/auth/authContext';
import { ApiProvider } from '@/shared/api/ApiProvider';
import { ApiError, type ApiClient } from '@/shared/api/client';
import ProjectHome from './ProjectHome';
import ProjectLayout from './ProjectLayout';
const auth: AuthValue = {
  mode: 'firebase',
  user: { uid: 'a', email: 'a@hyperdatalab.org', name: 'a' },
  ready: true,
  error: '',
  signIn: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn(),
};
function setup(getProject: ApiClient['getProject']) {
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
    getProject,
    me: vi.fn(),
    listProjects: vi.fn(),
    createProject: vi.fn(),
    patchProject: vi.fn(),
  };
  render(
    <MemoryRouter initialEntries={['/p/123']}>
      <AuthContext.Provider value={auth}>
        <ApiProvider client={api}>
          <Routes>
            <Route path="/p/:projectId" element={<ProjectLayout />}>
              <Route index element={<ProjectHome />} />
            </Route>
          </Routes>
        </ApiProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
it('PJ-11 shows the project title and workflow screens', async () => {
  setup(
    vi.fn().mockResolvedValue({
      id: '123',
      title: 'Research',
      owner: auth.user?.email,
      members: [],
      archived: false,
      createdAt: '',
      updatedAt: '',
    }),
  );
  expect(await screen.findByRole('heading', { name: 'Research' })).toBeInTheDocument();
  expect(screen.getAllByText(/S\u1eafp c\u00f3/).length).toBeGreaterThan(0);
});
it('PJ-12 shows a missing project', async () => {
  setup(vi.fn().mockRejectedValue(new ApiError(404, 'not_found', 'missing')));
  expect(await screen.findByText(/Kh\u00f4ng t\u00ecm th\u1ea5y d\u1ef1 \u00e1n/)).toBeInTheDocument();
});
