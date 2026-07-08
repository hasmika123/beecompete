import { render, screen } from '@testing-library/react';
import { Button, buttonClasses } from './button';

describe('Button', () => {
  it('renders a type=button pill with primary styling by default', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toHaveProperty('type', 'button');
    expect(btn.className).toContain('rounded-full');
    expect(btn.className).toContain('bg-primary');
  });

  it('applies variant and size classes', () => {
    render(
      <Button variant="brand" size="lg">
        Browse
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Browse' });
    expect(btn.className).toContain('bg-brand-gold');
    expect(btn.className).toContain('h-10.5');
  });

  it('buttonClasses merges custom classes with variant classes', () => {
    const cls = buttonClasses({ variant: 'secondary', className: 'w-full' });
    expect(cls).toContain('w-full');
    expect(cls).toContain('border-border');
  });
});
