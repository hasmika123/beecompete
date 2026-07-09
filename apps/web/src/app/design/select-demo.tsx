'use client';

import { Select } from '@beecompete/ui';

/** Client-side demo wrapper — Select is interactive, the showcase page stays a server component. */
export function SelectDemo() {
  return (
    <div className="grid gap-1.5">
      <label id="ds-category-label" className="text-sm font-medium text-foreground">
        Category
      </label>
      <Select
        aria-labelledby="ds-category-label"
        placeholder="Pick a category…"
        options={[
          { value: 'math', label: 'Math' },
          { value: 'science', label: 'Science & Engineering' },
          { value: 'cs', label: 'Computer Science / Coding' },
          { value: 'robotics', label: 'Robotics' },
          { value: 'debate', label: 'Debate & Speech' },
          { value: 'writing', label: 'Writing & Essay (full)', disabled: true },
        ]}
      />
    </div>
  );
}
