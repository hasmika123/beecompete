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

/** Inactive panels stay mounted (SEO/SSR) but carry the `hidden` attribute. */
function panelHidden(text: string): boolean {
  const panel = screen.getByText(text).closest('[role="tabpanel"]');
  if (!panel) throw new Error(`no tabpanel around "${text}"`);
  return panel.hasAttribute('hidden');
}

describe('Tabs', () => {
  it('keeps every panel mounted, hides inactive ones, and switches on click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // All panels are in the DOM (server-rendered HTML must contain tab content — SEO).
    expect(panelHidden('Panel A')).toBe(false);
    expect(panelHidden('Panel B')).toBe(true);
    expect(panelHidden('Panel C')).toBe(true);

    await user.click(screen.getByRole('tab', { name: 'Resources' }));
    expect(panelHidden('Panel B')).toBe(false);
    expect(panelHidden('Panel A')).toBe(true);
    expect(screen.getByRole('tab', { name: 'Resources' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('moves selection with arrow keys (roving tabindex)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('tab', { name: 'Overview' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(panelHidden('Panel B')).toBe(false);
    await user.keyboard('{End}');
    expect(panelHidden('Panel C')).toBe(false);
  });
});
