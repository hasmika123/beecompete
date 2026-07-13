import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareMenu } from './share-menu';

describe('ShareMenu', () => {
  it('opens the channel popover and builds clean intent links (no tracking params)', async () => {
    const user = userEvent.setup();
    render(<ShareMenu title="AMC 10" path="/c/amc-10" />);

    expect(screen.queryByRole('group')).toBeNull(); // closed initially
    await user.click(screen.getByRole('button', { name: /share/i }));

    expect(screen.getByRole('group', { name: /share amc 10/i })).toBeTruthy();

    const url = `${window.location.origin}/c/amc-10`;
    const x = screen.getByRole('link', { name: 'X' });
    expect(x.getAttribute('href')).toContain('twitter.com/intent/tweet');
    expect(x.getAttribute('href')).toContain(encodeURIComponent(url));
    // Privacy (M21): the shared URL carries no tracking params, and links open safely.
    expect(x.getAttribute('href')).not.toContain('utm_');
    expect(x.getAttribute('rel')).toContain('noopener');

    for (const name of ['X', 'Facebook', 'WhatsApp', 'LinkedIn', 'Email']) {
      expect(screen.getByRole('link', { name })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: /copy link/i })).toBeTruthy();

    // Email uses a mailto: with the title as subject.
    expect(screen.getByRole('link', { name: 'Email' }).getAttribute('href')).toMatch(
      /^mailto:\?subject=AMC%2010/,
    );
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<ShareMenu title="Test" path="/c/test" />);
    await user.click(screen.getByRole('button', { name: /share/i }));
    expect(screen.getByRole('group')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group')).toBeNull();
  });
});
