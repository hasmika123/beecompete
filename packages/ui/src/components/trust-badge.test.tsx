import { render, screen } from '@testing-library/react';
import { TrustBadge, isElevatedTier, trustTierMeta } from './trust-badge';

describe('TrustBadge', () => {
  it('renders the canonical label for each tier', () => {
    for (const [tier, label] of [
      ['curated', 'Curated'],
      ['claimed', 'Host-claimed'],
      ['verified', 'Verified'],
      ['unverified', 'Unverified'],
    ] as const) {
      const { unmount } = render(<TrustBadge tier={tier} />);
      expect(screen.getByText(label)).toBeTruthy();
      unmount();
    }
  });

  it('exposes the tier blurb as a native title hint by default', () => {
    render(<TrustBadge tier="verified" />);
    const badge = screen.getByText('Verified').closest('[title]');
    expect(badge?.getAttribute('title')).toBe(trustTierMeta('verified').blurb);
  });

  it('omits the title hint when titleHint is false (blurb shown as text elsewhere)', () => {
    render(<TrustBadge tier="curated" titleHint={false} />);
    expect(screen.getByText('Curated').closest('[title]')).toBeNull();
  });

  it('falls back to unverified for an unknown state', () => {
    expect(trustTierMeta('nonsense').tier).toBe('unverified');
  });

  it('treats only claimed/verified as elevated', () => {
    expect(isElevatedTier('verified')).toBe(true);
    expect(isElevatedTier('claimed')).toBe(true);
    expect(isElevatedTier('curated')).toBe(false);
    expect(isElevatedTier('unverified')).toBe(false);
  });
});
