import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { Tree, type TreeNode } from './Tree';

const nodes: TreeNode[] = [
  {
    id: 'a',
    label: 'Alpha',
    meta: 3,
    children: [{ id: 'a1', label: 'Child', children: [{ id: 'a11', label: 'Leaf' }] }],
  },
  { id: 'b', label: 'Beta' },
];
const row = (name: string) => screen.getByRole('treeitem', { name: new RegExp(name) });

it('shows top-level rows until one is expanded, and selects on click', () => {
  const onSelect = vi.fn();
  render(<Tree label="Mục" nodes={nodes} onSelect={onSelect} />);
  expect(screen.getAllByRole('treeitem')).toHaveLength(2);
  expect(row('Alpha')).toHaveAttribute('aria-expanded', 'false');
  expect(row('Beta')).not.toHaveAttribute('aria-expanded');
  fireEvent.click(row('Beta'));
  expect(onSelect).toHaveBeenCalledWith('b');
});

it('expands with the arrow keys and moves focus through visible rows', () => {
  const onSelect = vi.fn();
  render(<Tree label="Mục" nodes={nodes} onSelect={onSelect} />);
  const alpha = row('Alpha');
  alpha.focus();
  fireEvent.keyDown(alpha, { key: 'ArrowRight' });
  expect(screen.getAllByRole('treeitem')).toHaveLength(3);
  fireEvent.keyDown(alpha, { key: 'ArrowRight' });
  expect(row('Child')).toHaveFocus();
  fireEvent.keyDown(row('Child'), { key: 'ArrowLeft' });
  expect(alpha).toHaveFocus();
  fireEvent.keyDown(alpha, { key: 'End' });
  expect(row('Beta')).toHaveFocus();
  fireEvent.keyDown(row('Beta'), { key: 'Home' });
  expect(alpha).toHaveFocus();
  fireEvent.keyDown(alpha, { key: 'ArrowDown' });
  expect(row('Child')).toHaveFocus();
  fireEvent.keyDown(row('Child'), { key: 'ArrowUp' });
  fireEvent.keyDown(alpha, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith('a');
  fireEvent.keyDown(alpha, { key: 'ArrowLeft' });
  expect(screen.getAllByRole('treeitem')).toHaveLength(2);
  fireEvent.keyDown(alpha, { key: 'x' });
});

it('reveals a selected row inside collapsed parents', () => {
  function Host() {
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <>
        <button onClick={() => setSelected('a11')}>go</button>
        <Tree label="Mục" nodes={nodes} selectedId={selected} onSelect={setSelected} />
      </>
    );
  }
  render(<Host />);
  fireEvent.click(screen.getByText('go'));
  expect(row('Leaf')).toHaveAttribute('aria-selected', 'true');
});

it('toggles a row from its chevron without selecting it', () => {
  const onSelect = vi.fn();
  const { container } = render(
    <Tree label="Mục" nodes={nodes} defaultExpanded={['a']} onSelect={onSelect} />,
  );
  expect(screen.getAllByRole('treeitem')).toHaveLength(3);
  fireEvent.click(container.querySelector('button') as HTMLButtonElement);
  expect(screen.getAllByRole('treeitem')).toHaveLength(2);
  expect(onSelect).not.toHaveBeenCalled();
});
