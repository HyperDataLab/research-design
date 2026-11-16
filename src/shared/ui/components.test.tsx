import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { TextField } from './TextField';
import { Select } from './Select';
import { Checkbox } from './Checkbox';
import { Chip } from './Chip';
import { Badge } from './Badge';
import { Card } from './Card';
import { SegmentedControl } from './SegmentedControl';
import { ToastProvider } from './ToastProvider';
import { useToast } from './toastContext';
import styles from './ui.module.css';

describe('shared UI', () => {
  it('assigns the token height class to single-line controls and sizes the checkbox', () => {
    const { controlMd, controlSm, checkbox } = styles;
    if (!controlMd || !controlSm || !checkbox) throw new Error('Control styles are missing');
    render(
      <>
        <Button>Medium button</Button>
        <Button size="sm">Small button</Button>
        <IconButton label="Medium icon">+</IconButton>
        <IconButton size="sm" label="Small icon">
          +
        </IconButton>
        <TextField label="Medium field" />
        <TextField label="Small field" size="sm" />
        <Select label="Medium select">
          <option>One</option>
        </Select>
        <Select label="Small select" size="sm">
          <option>One</option>
        </Select>
        <Checkbox>Check</Checkbox>
      </>,
    );
    for (const name of ['Medium button', 'Medium icon', 'Medium field', 'Medium select']) {
      expect(
        screen.queryByLabelText(name, { selector: 'input, select' }) ?? screen.getByRole('button', { name }),
      ).toHaveClass(controlMd);
    }
    for (const name of ['Small button', 'Small icon', 'Small field', 'Small select']) {
      const element =
        screen.queryByLabelText(name, { selector: 'input, select' }) ?? screen.getByRole('button', { name });
      expect(element).toHaveClass(controlSm);
    }
    const css = readFileSync('src/shared/ui/ui.module.css', 'utf8');
    expect(css).toMatch(
      /\.controlMd\s*\{[^}]*height:\s*var\(--control-h\);[^}]*min-height:\s*var\(--control-h\);[^}]*line-height:\s*1;/s,
    );
    expect(css).toMatch(
      /\.controlSm\s*\{[^}]*height:\s*var\(--control-h-sm\);[^}]*min-height:\s*var\(--control-h-sm\);[^}]*line-height:\s*1;/s,
    );
    expect(screen.getByRole('checkbox', { name: 'Check' }).parentElement).toHaveClass(checkbox);
    expect(css).toMatch(
      /\.checkbox input\s*\{[^}]*width:\s*var\(--space-4\);[^}]*height:\s*var\(--space-4\);[^}]*accent-color:\s*var\(--accent\)/s,
    );
  });
  it('defaults buttons to type button and labels icon buttons', () => {
    render(
      <>
        <Button>Save</Button>
        <IconButton label="Copy">+</IconButton>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Copy' })).toHaveAttribute('aria-label', 'Copy');
  });
  it('associates field hints and errors and labels controls', () => {
    render(
      <>
        <TextField label="Text" hint="Hint" error="Error" multiline />
        <Select label="Choice">
          <option>One</option>
        </Select>
        <Checkbox>Enabled</Checkbox>
      </>,
    );
    expect(screen.getByLabelText('Text')).toHaveAccessibleDescription('Hint Error');
    expect(screen.getByLabelText('Text')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox', { name: 'Choice' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).toBeInTheDocument();
  });
  it('renders chips, badges and cards', () => {
    render(
      <Card padding="md">
        <Chip aria-pressed count={2}>
          Category
        </Chip>
        <Badge tone="success" icon="✓">
          Done
        </Badge>
      </Card>,
    );
    expect(screen.getByRole('button', { name: 'Category (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('✓Done')).toBeInTheDocument();
  });
  it('moves selection and focus with arrow keys', () => {
    function Example() {
      const [value, setValue] = useState('a');
      return (
        <SegmentedControl
          label="Filter"
          value={value}
          onChange={setValue}
          options={[
            { value: 'a', label: 'All' },
            { value: 'b', label: 'Other' },
          ]}
        />
      );
    }
    render(<Example />);
    const first = screen.getByRole('radio', { name: 'All' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Other' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Other' })).toHaveFocus();
  });
  it('announces and dismisses a toast', () => {
    vi.useFakeTimers();
    function Example() {
      const toast = useToast();
      return <Button onClick={() => toast('Saved')}>Save</Button>;
    }
    render(
      <ToastProvider>
        <Example />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
