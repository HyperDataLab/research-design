import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

it('shell: Tổng quan lists the three stages and marks unbuilt screens', async () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { level: 1, name: 'Tổng quan' })).toBeInTheDocument();
  for (const stage of ['1. Tài liệu', '2. Thiết kế', '3. Kế hoạch'])
    expect(screen.getByRole('heading', { level: 2, name: stage })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Bảng so sánh/ })).not.toBeInTheDocument();
});
