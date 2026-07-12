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
});
