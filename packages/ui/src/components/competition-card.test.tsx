import { render, screen } from '@testing-library/react';
import { CompetitionCard } from './competition-card';

const DATA = {
  name: 'AMC 10',
  href: '/c/amc-10',
  categorySlug: 'math',
  categoryName: 'Math',
  gradeLabel: 'Grades 8–10',
  organizerName: 'MAA',
  organizerVerified: true,
  summary: 'The classic 25-question contest.',
  free: false,
  regionLabel: 'Nationwide',
  prizeLabel: 'Medals + AIME invite',
  deadlineLabel: '9 days to go',
};

describe('CompetitionCard', () => {
  it('renders the whole card as one link with the card facts', () => {
    render(<CompetitionCard data={DATA} />);
    const link = screen.getByRole('link', { name: 'AMC 10' });
    expect(link.getAttribute('href')).toBe('/c/amc-10');
    expect(screen.getByText('Math')).toBeTruthy();
    expect(screen.getByText('Grades 8–10')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Verified organizer' })).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText('Medals + AIME invite')).toBeTruthy();
    expect(screen.getByText('9 days to go')).toBeTruthy();
    // Share corner is present + labeled; the card link is still the primary action (A8).
    expect(screen.getByRole('button', { name: 'Share AMC 10' })).toBeTruthy();
  });

  it('omits the share corner when shareable is false', () => {
    render(<CompetitionCard data={DATA} shareable={false} />);
    expect(screen.queryByRole('button', { name: 'Share AMC 10' })).toBeNull();
  });

  it('keeps the footer slot and cost positivity for free competitions without a prize', () => {
    render(
      <CompetitionCard
        data={{ ...DATA, free: true, prizeLabel: undefined, deadlineLabel: undefined }}
      />,
    );
    const free = screen.getByText('Free');
    expect(free.className).toContain('text-success');
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('reserves the organizer + description slots on a sparse card (fixed-slot anatomy)', () => {
    // Owner 2026-07-13 (blueprints #35): every card renders the same rows at the same heights.
    // An unattributed, summary-less card keeps BLANK reserved space — the slots exist, empty.
    render(
      <CompetitionCard
        data={{
          ...DATA,
          organizerName: undefined,
          organizerVerified: undefined,
          summary: undefined,
          gradeLabel: undefined,
        }}
      />,
    );
    const orgSlot = screen.getByTestId('organizer-slot');
    expect(orgSlot).toBeTruthy();
    expect(orgSlot.textContent).toBe(''); // blank, never placeholder text
    expect(orgSlot.className).toContain('h-6'); // fixed height even when empty
    const summarySlot = screen.getByTestId('summary-slot');
    expect(summarySlot.textContent).toBe('');
    expect(summarySlot.className).toContain('min-h-[2lh]'); // two lines reserved
    expect(screen.queryByRole('img', { name: 'Verified organizer' })).toBeNull();
  });
});
