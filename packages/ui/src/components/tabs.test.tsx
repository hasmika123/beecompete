import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tab, TabList, TabPanel, Tabs } from './tabs';

function Harness() {
  return (
    <Tabs defaultValue="a">
      <TabList>
        <Tab value="a">Overview</Tab>
        <Tab value="b">Resources</Tab>
        <Tab value="c">FAQ</Tab>
      </TabList>
      <TabPanel value="a">Panel A</TabPanel>
      <TabPanel value="b">Panel B</TabPanel>
      <TabPanel value="c">Panel C</TabPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('shows only the active panel and switches on click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('Panel A')).toBeTruthy();
    expect(screen.queryByText('Panel B')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Resources' }));
    expect(screen.getByText('Panel B')).toBeTruthy();
    expect(screen.queryByText('Panel A')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Resources' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('moves selection with arrow keys (roving tabindex)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('tab', { name: 'Overview' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Panel B')).toBeTruthy();
    await user.keyboard('{End}');
    expect(screen.getByText('Panel C')).toBeTruthy();
  });
});
