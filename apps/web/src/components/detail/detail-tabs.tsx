'use client';

import type { ReactNode } from 'react';
import { Tab, TabList, TabPanel, Tabs } from '@beecompete/ui';

// The detail-page tabbed section (blueprints Page 3a, retabbed by #87 — owner 2026-08-22;
// extended by #108 — owner 2026-08-26):
// "Overview" (default — the At-a-glance strip) · "Logistics" · "Eligibility" · "Judging" ·
// "Awards" · "FAQ" · "More". Judging/Awards/FAQ/More are omitted when there's no content (same
// rule the old About/FAQ tabs followed); Eligibility always has at least "How to enter", and
// Logistics always has cost/delivery/format/runs. The Timeline is NOT a tab — it stays its own
// layout entity (sidebar / mobile section). Client wrapper around the shared Tabs primitive;
// panel bodies are server-rendered nodes.
//
// ORDER mirrors the admin create form's steps (#108): Overview → Administration/Logistics →
// Eligibility → Judging → Awards → …, with the overflow bin last exactly as the form's "Custom
// fields" step is. FAQ stays ahead of More so the SEO block keeps a stable position.
// Seven tabs overflow a phone: the underline TabList already scrolls horizontally with a hidden
// scrollbar and `shrink-0` tabs, so labels scroll rather than wrap or compress.

interface DetailTabsProps {
  overview: ReactNode;
  logistics: ReactNode;
  eligibility: ReactNode;
  judging?: ReactNode;
  awards?: ReactNode;
  faq?: ReactNode;
  more?: ReactNode;
}

export function DetailTabs({
  overview,
  logistics,
  eligibility,
  judging,
  awards,
  faq,
  more,
}: DetailTabsProps) {
  return (
    // Basic underline tabs (owner 2026-08-18, #104): the component default — quiet strip,
    // active underline, plain content below.
    <Tabs defaultValue="overview">
      <TabList aria-label="Competition details">
        <Tab value="overview">Overview</Tab>
        <Tab value="logistics">Logistics</Tab>
        <Tab value="eligibility">Eligibility</Tab>
        {judging && <Tab value="judging">Judging</Tab>}
        {awards && <Tab value="awards">Awards</Tab>}
        {faq && <Tab value="faq">FAQ</Tab>}
        {more && <Tab value="more">More</Tab>}
      </TabList>
      <TabPanel value="overview">{overview}</TabPanel>
      <TabPanel value="logistics">{logistics}</TabPanel>
      <TabPanel value="eligibility">{eligibility}</TabPanel>
      {judging && <TabPanel value="judging">{judging}</TabPanel>}
      {awards && <TabPanel value="awards">{awards}</TabPanel>}
      {faq && <TabPanel value="faq">{faq}</TabPanel>}
      {more && <TabPanel value="more">{more}</TabPanel>}
    </Tabs>
  );
}
