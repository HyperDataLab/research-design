import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Wizard } from './Wizard';

const setup = (ready = true, finishDisabled = false) => {
  const onFinish = vi.fn();
  render(
    <Wizard
      label="Thiết lập"
      finishLabel="Chạy"
      finishDisabled={finishDisabled}
      onFinish={onFinish}
      note="Ước tính 3 lượt"
      steps={[
        { id: 'a', title: 'Một', summary: '2 mục', ready, content: <p>Nội dung một</p> },
        { id: 'b', title: 'Hai', content: <p>Nội dung hai</p> },
      ]}
    />,
  );
  return onFinish;
};
const next = () => screen.getByRole('button', { name: 'Tiếp tục' });

it('moves through steps, keeps the note and offers the action only at the end', () => {
  const onFinish = setup();
  expect(screen.getByText('Ước tính 3 lượt')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Chạy' })).toBeNull();
  fireEvent.click(next());
  expect(screen.getByText('Nội dung hai')).toBeInTheDocument();
  expect(screen.getByText('2 mục')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Chạy' }));
  expect(onFinish).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
  expect(screen.getByText('Nội dung một')).toBeInTheDocument();
});

it('holds the user on an incomplete step and cannot jump ahead', () => {
  setup(false);
  expect(next()).toBeDisabled();
  expect(screen.getByRole('button', { name: /Hai/ })).toBeDisabled();
});

it('lets the user return to a finished step from the step list', () => {
  setup();
  fireEvent.click(next());
  fireEvent.click(screen.getByRole('button', { name: /Một/ }));
  expect(screen.getByText('Nội dung một')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Một/ })).toHaveAttribute('aria-current', 'step');
});
