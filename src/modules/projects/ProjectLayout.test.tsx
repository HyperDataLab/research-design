import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AuthContext, type AuthValue } from '@/shared/auth/authContext';
import { ApiProvider } from '@/shared/api/ApiProvider';
import { ApiError, createApiClient } from '@/shared/api/client';
import { useProject } from '@/shared/project/projectContext';
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
function Child() {
  const { project, readOnly } = useProject();
  return (
    <div>
      {project.title} {String(readOnly)}
    </div>
  );
}
function setup(archived: boolean, missing = false) {
  const api = createApiClient({ baseUrl: '', getToken: async () => 'token' });
  api.getProject = missing
    ? vi.fn().mockRejectedValue(new ApiError(404, 'not_found', 'missing'))
    : vi.fn().mockResolvedValue({ id: '123', title: 'Study', archived });
  render(
    <MemoryRouter initialEntries={['/p/123/child']}>
      <AuthContext.Provider value={auth}>
        <ApiProvider client={api}>
          <Routes>
            <Route path="/p/:projectId" element={<ProjectLayout />}>
              <Route path="child" element={<Child />} />
            </Route>
          </Routes>
        </ApiProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
it('PA-14 supplies the project and a link to its home', async () => {
  setup(false);
  expect(await screen.findByText('Study false')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '‹ Study' })).toHaveAttribute('href', '/p/123');
});
it('PA-15 makes archived projects read-only', async () => {
  setup(true);
  expect(await screen.findByText('Study true')).toBeInTheDocument();
});
it('PA-16 does not render children of a missing project', async () => {
  setup(false, true);
  expect(await screen.findByText('Không tìm thấy dự án')).toBeInTheDocument();
  expect(screen.queryByText(/Study/)).not.toBeInTheDocument();
});
