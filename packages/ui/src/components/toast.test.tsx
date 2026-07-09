import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './toast';

function Trigger() {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast({ tone: 'success', title: 'Saved', duration: 0 })}>
      Save
    </button>
  );
}

describe('ToastProvider / useToast', () => {
  it('shows a toast on trigger and dismisses it', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    expect(screen.queryByText('Saved')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('Saved');

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Saved')).toBeNull();
  });
});
