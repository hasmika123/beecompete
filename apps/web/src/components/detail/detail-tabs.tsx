'use client';

import type { ReactNode } from 'react';
import { Tab, TabList, TabPanel, Tabs } from '@beecompete/ui';

// The detail-page tabbed section (blueprints Page 3a, renamed by #82, reordered by #94):
// "At a glance" (default — the strip moved INTO the folder as its first tab) · "Details" ·
// "About" · "FAQ". Client wrapper around the shared Tabs primitive; panel bodies are
// server-rendered and passed in as nodes (About/FAQ omitted when there's no content).

interface DetailTabsProps {
  glance: ReactNode;
  keyFacts: ReactNode;
  about?: ReactNode;
  faq?: ReactNode;
}

export function DetailTabs({ glance, keyFacts, about, faq }: DetailTabsProps) {
  return (
    // Basic underline tabs (owner 2026-08-18, #104): the component default — quiet strip,
    // active underline, plain content below. Ends the styled-tab experiments (folder #92–#98,
    // pill #99–#103; the pill variant survives in packages/ui + the design demo).
    <Tabs defaultValue="glance">
      <TabList aria-label="Competition details">
        <Tab value="glance">At a glance</Tab>
        <Tab value="facts">Details</Tab>
        {about && <Tab value="about">About</Tab>}
        {faq && <Tab value="faq">FAQ</Tab>}
      </TabList>
      <TabPanel value="glance">{glance}</TabPanel>
      <TabPanel value="facts">{keyFacts}</TabPanel>
      {about && <TabPanel value="about">{about}</TabPanel>}
      {faq && <TabPanel value="faq">{faq}</TabPanel>}
    </Tabs>
  );
}
