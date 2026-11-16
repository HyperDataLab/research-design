import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { vi } from 'vitest';
import { App } from './App';

vi.mock('@/modules/projects/ProjectLayout', () => {
  function ProjectLayout({ onProject }: { onProject: (project: { id: string; title: string }) => void }) {
    useEffect(() => {
      onProject({ id: '123', title: 'Invented study' });
    }, [onProject]);
    return <Outlet />;
  }
  return { default: ProjectLayout };
});
vi.mock('@/modules/projects/ProjectHome', () => ({ default: () => <div>Project home</div> }));

it('SH-01 shows the project title on its home and the module label on project screens', async () => {
  const { unmount } = render(
    <MemoryRouter initialEntries={['/p/123']}>
      <App />
    </MemoryRouter>,
  );
  expect(await screen.findByText('Invented study')).toBeInTheDocument();
  unmount();
  render(
    <MemoryRouter initialEntries={['/p/123/analyses']}>
      <App />
    </MemoryRouter>,
  );
  expect(document.querySelector('header')?.textContent).toContain('Phân tích thống kê');
});
