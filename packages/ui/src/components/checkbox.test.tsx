import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Checkbox } from './checkbox';
import { Radio, RadioGroup } from './radio-group';

describe('Checkbox', () => {
  it('toggles and exposes a clickable label', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Math" />);
    const box = screen.getByRole('checkbox', { name: 'Math' });
    expect(box).toHaveProperty('checked', false);
    await user.click(screen.getByText('Math'));
    expect(box).toHaveProperty('checked', true);
  });
});

describe('RadioGroup', () => {
  function Harness() {
    const [value, setValue] = useState('student');
    return (
      <RadioGroup value={value} onValueChange={setValue} aria-label="Role">
        <Radio value="student" label="Student" />
        <Radio value="parent" label="Parent" />
      </RadioGroup>
    );
  }

  it('selects one option at a time', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Student' })).toHaveProperty('checked', true);
    await user.click(screen.getByText('Parent'));
    expect(screen.getByRole('radio', { name: 'Parent' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Student' })).toHaveProperty('checked', false);
  });
});
