import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { SidebarItem } from './SidebarItem';
import { planned } from '@/modules/planned';
it('PA-17 links ready project screens only inside a project', () => {
  const plannedItem = planned.find((item) => item.id === 'corpus');
  if (!plannedItem) throw new Error();
  const item = { ...plannedItem, status: 'ready' as const };
  render(
    <MemoryRouter initialEntries={['/p/123']}>
      <SidebarItem item={item} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: item.label })).toHaveAttribute('href', '/p/123/corpus');
  cleanup();
  render(
    <MemoryRouter initialEntries={['/']}>
      <SidebarItem item={item} />
    </MemoryRouter>,
  );
  expect(screen.getByTitle('Mở một dự án trước')).toHaveTextContent(item.label);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
