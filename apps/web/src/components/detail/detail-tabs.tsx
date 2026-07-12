'use client';

import type { ReactNode } from 'react';
import { Tab, TabList, TabPanel, Tabs } from '@beecompete/ui';

// The detail-page tabbed section (blueprints Page 3a): "Key Facts & Details" (default) ·
// "About" · "FAQ". Client wrapper around the shared Tabs primitive; panel bodies are
// server-rendered and passed in as nodes (About/FAQ omitted when there's no content).

interface DetailTabsProps {
  keyFacts: ReactNode;
  about?: ReactNode;
  faq?: ReactNode;
}

export function DetailTabs({ keyFacts, about, faq }: DetailTabsProps) {
  return (
    <Tabs defaultValue="facts">
      <TabList aria-label="Competition details">
        <Tab value="facts">Key Facts &amp; Details</Tab>
        {about && <Tab value="about">About</Tab>}
        {faq && <Tab value="faq">FAQ</Tab>}
      </TabList>
      <TabPanel value="facts">{keyFacts}</TabPanel>
      {about && <TabPanel value="about">{about}</TabPanel>}
      {faq && <TabPanel value="faq">{faq}</TabPanel>}
    </Tabs>
  );
}
