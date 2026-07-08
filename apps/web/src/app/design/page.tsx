import type { Metadata } from 'next';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from '@beecompete/ui';
import {
  Calendar,
  GraduationCap,
  Heart,
  MapPin,
  Search,
  Trophy,
  VerifiedSeal,
} from '@beecompete/ui';
import { SelectDemo } from './select-demo';

export const metadata: Metadata = { title: 'Design system' };

/**
 * Living showcase of @beecompete/ui — the owner-review surface for F7 styling
 * (owner reacts with reference photos per component; design-brief §1 delegation).
 * Not a product page; site-wide noindex applies.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="font-display text-2xl text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="max-w-3xl">
      <Badge>Internal · living document</Badge>
      <h1 className="font-display mt-4 text-4xl text-foreground">Design system</h1>
      <p className="mt-2 text-muted">
        Tokens + primitives from{' '}
        <code className="rounded bg-surface px-1.5 py-0.5 text-sm">@beecompete/ui</code>. Toggle the
        theme in the header to check dark mode.
      </p>

      <Section title="Type">
        <p className="font-display text-5xl text-foreground">
          Search. Compete. <em>Participate.</em>
        </p>
        <p className="font-display mt-2 text-2xl text-muted">
          Display serif — Fraunces, weighted so titles never look thin.{' '}
          <em>Italic accents, used sparingly.</em>
        </p>
        <p className="mt-4 max-w-prose text-base text-foreground">
          Body and UI text is Inter — a clean, readable sans for paragraphs, labels, buttons, and
          forms. It pairs quietly with the serif headlines above.
        </p>
        <p className="font-display mt-4 text-4xl text-foreground">
          1,204 <span className="text-lg text-muted">competitions tracked</span>
        </p>
      </Section>

      <Section title="Icons">
        <p className="mb-3 text-sm text-muted">
          Phosphor, via <code className="rounded bg-surface px-1.5 py-0.5">@beecompete/ui</code> —
          regular by default; <code className="rounded bg-surface px-1.5 py-0.5">weight</code>{' '}
          variants (bold · fill · duotone) for emphasis and active states.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-foreground">
          <Search aria-hidden="true" className="size-6" />
          <Calendar aria-hidden="true" className="size-6" />
          <Trophy aria-hidden="true" className="size-6" />
          <GraduationCap aria-hidden="true" className="size-6" />
          <MapPin aria-hidden="true" className="size-6" />
          <Trophy aria-hidden="true" weight="duotone" className="size-6 text-brand-gold" />
          <Heart aria-hidden="true" weight="fill" className="size-6 text-danger" />
          <VerifiedSeal aria-hidden="true" weight="fill" className="size-6 text-success" />
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="brand">Brand CTA</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button variant="brand" size="lg">
            <Search aria-hidden="true" /> Browse competitions
          </Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="verified">Verified</Badge>
          <Badge>Curated</Badge>
          <Badge variant="gold">Math</Badge>
          <Badge variant="outline">Grades 6–8</Badge>
          <Badge variant="danger">Deadline soon</Badge>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid max-w-md gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="ds-name" className="text-sm font-medium text-foreground">
              Student name
            </label>
            <Input id="ds-name" placeholder="e.g. Ada Lovelace" />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="ds-invalid" className="text-sm font-medium text-foreground">
              Email (invalid state)
            </label>
            <Input id="ds-invalid" defaultValue="not-an-email" aria-invalid />
          </div>
          <SelectDemo />
          <div className="grid gap-1.5">
            <label htmlFor="ds-notes" className="text-sm font-medium text-foreground">
              Notes
            </label>
            <Textarea id="ds-notes" placeholder="Anything the curators should know…" />
          </div>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* CompetitionCard direction study — the real component ships with R1-6
              (per-category cover art system lands alongside the catalog). */}
          <Card interactive className="group overflow-hidden">
            <div className="relative flex h-36 items-center justify-center bg-linear-to-br from-brand-gold-soft to-brand-gold/45">
              <Trophy
                aria-hidden="true"
                weight="duotone"
                className="size-14 text-brand-gold drop-shadow-none transition-transform group-hover:scale-105"
              />
              <Badge variant="verified" className="absolute top-3 right-3">
                Verified
              </Badge>
            </div>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="gold">
                  <GraduationCap aria-hidden="true" className="size-3.5" /> Math
                </Badge>
                <Badge variant="outline">Grades 8–10</Badge>
              </div>
              <CardTitle className="pt-1.5">AMC 10</CardTitle>
              <CardDescription>
                The classic 25-question contest for students in grade 10 and below.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Deadline + prize: bold, fixed position (page-blueprints shared components). */}
              <div className="grid gap-1.5 rounded-[var(--radius-field)] bg-surface px-3.5 py-2.5 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Calendar aria-hidden="true" className="size-4 text-muted" />
                  <strong className="font-semibold text-foreground">Closes Nov 8</strong>
                </span>
                <span className="inline-flex items-center gap-2">
                  <Trophy aria-hidden="true" className="size-4 text-muted" />
                  <strong className="font-semibold text-foreground">Medals + AIME invite</strong>
                </span>
                <span className="inline-flex items-center gap-2 text-muted">
                  <MapPin aria-hidden="true" className="size-4" /> In person · Nationwide
                </span>
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <span className="text-sm font-medium text-muted">Free entry</span>
              <Button variant="secondary" size="sm">
                View details
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plain card</CardTitle>
              <CardDescription>
                Rounded 16px, hairline border, no shadow at rest. The card to the left is
                `interactive` — hover it for the one sanctioned soft lift.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <Button variant="secondary" size="sm">
                An action
              </Button>
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}
