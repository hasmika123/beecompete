'use client';

import { useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Chip,
  CircleHelp,
  EmptyState,
  FormField,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Search,
  Skeleton,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  ToastProvider,
  Tooltip,
  Trophy,
  useToast,
} from '@beecompete/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const GRADES = ['All', 'Elementary', 'Middle', 'High'];

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        onClick={() => toast({ tone: 'success', title: 'Saved to My Competitions' })}
      >
        Success toast
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({ tone: 'error', title: "Couldn't share", description: 'Try again in a moment.' })
        }
      >
        Error toast
      </Button>
    </div>
  );
}

export function NewComponentsShowcase() {
  const [grade, setGrade] = useState('All');
  const [filters, setFilters] = useState(['Math', 'Free']);
  const [modalOpen, setModalOpen] = useState(false);
  const [audience, setAudience] = useState('student');
  const [emailError, setEmailError] = useState(true);

  return (
    <ToastProvider>
      <Section title="Chips">
        <p className="mb-2 text-sm text-muted">Grade quick-chips (single-select toggle):</p>
        <div className="flex flex-wrap gap-2">
          {GRADES.map((g) => (
            <Chip key={g} selected={grade === g} onClick={() => setGrade(g)}>
              {g}
            </Chip>
          ))}
        </div>
        <p className="mt-4 mb-2 text-sm text-muted">Active filters (removable):</p>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Chip key={f} onRemove={() => setFilters((prev) => prev.filter((x) => x !== f))}>
              {f}
            </Chip>
          ))}
          {filters.length === 0 && <span className="text-sm text-muted">All cleared.</span>}
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex items-center gap-4">
          <Avatar name="Mathematical Association of America" size="sm" />
          <Avatar name="Ada Lovelace" size="md" />
          <Avatar name="Grace Hopper" size="lg" />
        </div>
      </Section>

      <Section title="Alerts">
        <div className="grid max-w-xl gap-3">
          <Alert tone="info" title="Beta">
            BeeCompete is in beta — details may change while we verify listings.
          </Alert>
          <Alert tone="success" title="Verified organizer">
            This listing is maintained directly by the organizer.
          </Alert>
          <Alert tone="warning">
            This page links to affiliate resources; we may earn a commission.
          </Alert>
          <Alert tone="danger" title="Registration closed">
            The deadline for this edition has passed.
          </Alert>
        </div>
      </Section>

      <Section title="Tooltip">
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
          Verification state
          <Tooltip content="Curated by our team until the organizer claims the listing.">
            <button
              type="button"
              aria-label="What does this mean?"
              className="text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <CircleHelp aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
        </span>
      </Section>

      <Section title="Tabs">
        <p className="mb-2 text-sm text-muted">Underline (default):</p>
        <Tabs defaultValue="overview" className="max-w-xl">
          <TabList>
            <Tab value="overview">Overview</Tab>
            <Tab value="resources">Resources</Tab>
            <Tab value="faq">FAQ</Tab>
          </TabList>
          <TabPanel value="overview" className="text-sm text-muted">
            The evergreen competition summary, eligibility, and format.
          </TabPanel>
          <TabPanel value="resources" className="text-sm text-muted">
            Curated prep links and past papers (with affiliate disclosure).
          </TabPanel>
          <TabPanel value="faq" className="text-sm text-muted">
            Curated Q&amp;A — rendered with FAQPage structured data at R1-7.
          </TabPanel>
        </Tabs>

        <p className="mt-6 mb-2 text-sm text-muted">Attached (active tab merges into the card):</p>
        <Tabs variant="attached" defaultValue="consistency">
          <TabList>
            <Tab value="dedication">Dedication</Tab>
            <Tab value="reputability">Reputability</Tab>
            <Tab value="consistency">Consistency</Tab>
            <Tab value="analytics">Trading analytics</Tab>
          </TabList>
          <TabPanel value="dedication" className="text-sm text-muted">
            The people are here to back you up.
          </TabPanel>
          <TabPanel value="reputability" className="text-sm text-muted">
            A platform you can trust.
          </TabPanel>
          <TabPanel value="consistency" className="text-sm text-muted">
            The consistency, dedication, and openness an online trader needs.
          </TabPanel>
          <TabPanel value="analytics" className="text-sm text-muted">
            Understand every move.
          </TabPanel>
        </Tabs>
      </Section>

      <Section title="Form field, checkbox, radio">
        <div className="grid max-w-md gap-4">
          <FormField
            label="Email"
            required
            error={emailError ? 'Enter a valid email address.' : undefined}
          >
            <Input
              type="email"
              defaultValue="not-an-email"
              onChange={(e) => setEmailError(!e.target.value.includes('@'))}
            />
          </FormField>
          <FormField label="Interests" labelAsText hint="Pick any that apply.">
            <div className="grid gap-2">
              <Checkbox label="Math" defaultChecked />
              <Checkbox label="Science &amp; Engineering" />
              <Checkbox label="Debate &amp; Speech" />
            </div>
          </FormField>
          <FormField label="I am a…" labelAsText>
            <RadioGroup value={audience} onValueChange={setAudience}>
              <Radio value="student" label="Student" />
              <Radio value="parent" label="Parent / Guardian" />
              <Radio value="educator" label="Educator" />
            </RadioGroup>
          </FormField>
        </div>
      </Section>

      <Section title="Modal">
        <Button onClick={() => setModalOpen(true)}>Open share dialog</Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Share this competition"
          description="Anyone with the link can view it."
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Copy link</Button>
            </>
          }
        >
          <Input readOnly value="https://beecompete.com/c/amc-10" aria-label="Share link" />
        </Modal>
      </Section>

      <Section title="Toasts">
        <ToastDemo />
      </Section>

      <Section title="Loading & empty states">
        <div className="grid max-w-xl gap-6">
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
          <div
            className="grid gap-2 rounded-[var(--radius-panel)] border border-border p-4"
            aria-busy="true"
          >
            <Skeleton className="h-24" />
            <Skeleton className="w-2/3" />
            <Skeleton className="w-1/3" />
          </div>
          <EmptyState
            icon={<Search aria-hidden="true" />}
            title="No competitions match those filters"
            description="Try widening the grade range or clearing a filter to see near matches."
            action={<Button variant="secondary">Clear filters</Button>}
          />
        </div>
      </Section>
    </ToastProvider>
  );
}
