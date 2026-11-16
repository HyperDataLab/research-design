import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Project } from '@/core/project/schema';
import { ApiProvider } from '@/shared/api/ApiProvider';
import { ApiError, type ApiClient } from '@/shared/api/client';
import { AuthContext } from '@/shared/auth/authContext';
import { ProjectContext } from '@/shared/project/projectContext';
import { ToastProvider } from '@/shared/ui/ToastProvider';
import Members from './Members';

const owner = 'owner@hyperdatalab.org';
const colleague = 'colleague@hyperdatalab.org';
const project: Project = {
  id: '123',
  title: 'Test',
  owner,
  members: [colleague, owner],
  archived: false,
  createdAt: '',
  updatedAt: '',
};

function setup(options: { user?: string; archived?: boolean; failure?: unknown } = {}) {
  const initial = { ...project, archived: !!options.archived };
  const patchProject = vi.fn(async (_id: string, patch: { members?: string[] }) => {
    if (options.failure) throw options.failure;
    return { ...initial, members: patch.members ?? initial.members };
  });
  const api = { getProject: vi.fn().mockResolvedValue(initial), patchProject } as unknown as ApiClient;
  function View() {
    const [current, setProject] = useState(initial);
    return (
      <ProjectContext.Provider value={{ project: current, readOnly: current.archived, setProject }}>
        <Members />
      </ProjectContext.Provider>
    );
  }
  render(
    <AuthContext.Provider
      value={{
        user: { uid: 'a', email: options.user ?? owner, name: 'A' },
        ready: true,
        mode: 'firebase',
        error: '',
        signIn: vi.fn(),
        signOut: vi.fn(),
        getIdToken: vi.fn(),
      }}
    >
      <ApiProvider client={api}>
        <ToastProvider>
          <View />
        </ToastProvider>
      </ApiProvider>
    </AuthContext.Provider>,
  );
  return { patchProject, api };
}
function enter(value: string) {
  fireEvent.change(screen.getByLabelText('Email thành viên'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Thêm' }));
}

it('MB-03 owner adds a normalized member and updates the list', async () => {
  const { patchProject } = setup();
  enter(' NEW@hyperdatalab.org ');
  await waitFor(() =>
    expect(patchProject).toHaveBeenCalledWith('123', { members: [colleague, owner, 'new@hyperdatalab.org'] }),
  );
  expect(await screen.findByText('new@hyperdatalab.org')).toBeInTheDocument();
});
it('MB-04 owner confirms removal and cannot remove their own row', async () => {
  const { patchProject } = setup();
  expect(screen.getAllByRole('button', { name: 'Gỡ' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Gỡ' }));
  expect(patchProject).not.toHaveBeenCalled();
  const dialog = screen.getByRole('alertdialog');
  expect(within(dialog).getByText('Người này sẽ không còn thấy dự án.')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Gỡ' }));
  await waitFor(() => expect(patchProject).toHaveBeenCalledWith('123', { members: [owner] }));
  await waitFor(() => expect(screen.queryByText(colleague)).not.toBeInTheDocument());
});
it('MB-05 non-owner sees the list and quiet explanation only', () => {
  setup({ user: colleague });
  expect(screen.getByText('Chỉ chủ dự án thêm hoặc gỡ thành viên.')).toBeInTheDocument();
  expect(screen.getByText(colleague)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('MB-06 archived project shows the list only', () => {
  setup({ archived: true });
  expect(screen.getByText(colleague)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByText('Chỉ chủ dự án thêm hoặc gỡ thành viên.')).not.toBeInTheDocument();
});
it.each([
  ['bad', 'Email không hợp lệ.'],
  ['a@example.org', 'Email không thuộc tổ chức.'],
  [colleague, 'Email đã là thành viên.'],
])('MB-07 refuses %s before sending', (input, message) => {
  const { patchProject, api } = setup();
  enter(input);
  expect(screen.getByText(message)).toBeInTheDocument();
  expect(patchProject).not.toHaveBeenCalled();
  expect(api.getProject).not.toHaveBeenCalled();
});
it.each([
  [new ApiError(403, 'forbidden', ''), 'Chỉ chủ dự án thêm hoặc gỡ thành viên.'],
  [new ApiError(400, 'bad', ''), 'Email không hợp lệ hoặc không thuộc tổ chức.'],
  [new Error('network'), 'Không lưu được. Kiểm tra kết nối rồi thử lại.'],
])('MB-08 reports server errors', async (failure, message) => {
  setup({ failure });
  enter('new@hyperdatalab.org');
  expect(await screen.findByRole('status')).toHaveTextContent(message);
});
