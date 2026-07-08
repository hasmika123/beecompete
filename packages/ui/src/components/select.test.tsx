import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Select, type SelectOption } from './select';

const OPTIONS: SelectOption[] = [
  { value: 'math', label: 'Math' },
  { value: 'science', label: 'Science' },
  { value: 'debate', label: 'Debate', disabled: true },
  { value: 'robotics', label: 'Robotics' },
];

function Harness() {
  const [value, setValue] = useState<string>();
  return <Select aria-label="Category" options={OPTIONS} value={value} onValueChange={setValue} />;
}

describe('Select', () => {
  it('opens on click and selects an option, closing the list', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('combobox', { name: 'Category' });
    expect(trigger).toHaveProperty('textContent', 'Select…');

    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();

    await user.click(screen.getByRole('option', { name: 'Science' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger.textContent).toContain('Science');
  });

  it('supports full keyboard interaction and skips disabled options', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('combobox', { name: 'Category' });

    trigger.focus();
    await user.keyboard('{ArrowDown}'); // open, active = Math
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeTruthy();

    await user.keyboard('{ArrowDown}'); // active = Science
    await user.keyboard('{ArrowDown}'); // Debate disabled → skips to Robotics
    expect(listbox.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Robotics' }).id,
    );

    await user.keyboard('{Enter}'); // select Robotics, close, refocus trigger
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger.textContent).toContain('Robotics');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes without selecting on Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('combobox', { name: 'Category' });

    await user.click(trigger);
    await user.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger.textContent).toContain('Select…');
  });
});
