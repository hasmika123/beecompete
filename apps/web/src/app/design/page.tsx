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
  ArrowRight,
  Calendar,
  GraduationCap,
  Heart,
  MapPin,
  Search,
  Share,
  Ticket,
  Trophy,
  Users,
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
        <p className="mb-3 text-sm text-muted">
          CompetitionCard shown at its real listing width — 4 per row on desktop (~270px).
        </p>
        <div className="flex flex-wrap items-start gap-5">
          {/* CompetitionCard direction study — the real component ships with R1-6
              (per-category cover art system lands alongside the catalog). */}
          {/* The whole card is the link in the real component (R1-6); the corner arrow
              is a hover affordance, not a separate control. Cards in a grid must all be
              the SAME height: flex column + mt-auto footer, title/prize truncate,
              description clamped. */}
          <Card
            interactive
            className="group relative flex w-[270px] shrink-0 flex-col overflow-hidden"
          >
            {/* Top-right corner: social-proof count (→ M31, thresholded at R2) that
                crossfades to the grey view arrow on hover. The count sits in a
                translucent pill so it stays readable over any cover art (scrim rule);
                the arrow is right-aligned in the stack so it lands in the corner. */}
            {/* Quick actions — favorite (→ M7 save/follow) + share (→ M21). Same
                translucent-pill treatment as the count so they read over any cover. */}
            <span className="absolute top-3 left-3 z-10 flex gap-1.5">
              <button
                type="button"
                aria-label="Save competition"
                className="grid size-7 place-items-center rounded-full bg-background/85 text-muted transition-colors hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                <Heart aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Share competition"
                className="grid size-7 place-items-center rounded-full bg-background/85 text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                <Share aria-hidden="true" className="size-4" />
              </button>
            </span>
            <span className="absolute top-3 right-2.5 z-10 grid items-center justify-items-end">
              <span className="col-start-1 row-start-1 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground transition-opacity group-hover:opacity-0">
                <Users aria-hidden="true" className="size-3.5 text-muted" />
                1.2k registered
              </span>
              <ArrowRight
                aria-hidden="true"
                weight="bold"
                className="col-start-1 row-start-1 size-5 text-muted opacity-0 transition-opacity group-hover:opacity-100"
              />
            </span>
            <div className="relative flex h-36 items-center justify-center bg-linear-to-br from-brand-gold-soft to-brand-gold/45">
              <Trophy
                aria-hidden="true"
                weight="duotone"
                className="size-14 text-brand-gold drop-shadow-none transition-transform group-hover:scale-105"
              />
            </div>
            <CardHeader className="p-4 pb-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="gold">
                  <GraduationCap aria-hidden="true" className="size-3.5" /> Math
                </Badge>
                <Badge variant="outline">Grades 8–10</Badge>
              </div>
              <CardTitle className="truncate pt-1">AMC 10</CardTitle>
              {/* Organizer attribution — the ORG is what's verified (DQ13), so the seal
                  sits on the org, icon-only. */}
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-muted"
                >
                  MA
                </span>
                <span className="truncate text-sm text-muted">
                  Mathematical Association of America
                </span>
                <VerifiedSeal
                  weight="fill"
                  className="size-4 shrink-0 text-success"
                  aria-label="Verified organizer"
                  role="img"
                />
              </div>
              <CardDescription className="line-clamp-2">
                The classic 25-question contest for students in grade 10 and below.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-3">
              {/* Only the two card-level facts (owner r10): Cost + Region — format and
                  entry pathway live on the details page / filters. Icon + value pairs
                  in fixed half-width slots: the ticket and map-pin icons carry the
                  labels, values stay large and scannable, each truncates independently. */}
              <div className="grid grid-cols-2 gap-x-3 border-t border-border pt-3">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Ticket aria-hidden="true" className="size-4 shrink-0 text-success" />
                  <span className="truncate text-sm font-semibold text-success">Free</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted" />
                  <span className="truncate text-sm font-medium text-foreground">Nationwide</span>
                </span>
              </div>
            </CardContent>
            {/* Footer, Kaggle-style: PRIZE is the bold, prominent fact; the deadline is
                quiet muted "N days to go" text (flips to a danger tint only in the final
                days). Pinned via mt-auto so every card in a grid shares the baseline. */}
            <CardFooter className="mt-auto items-center justify-between gap-2.5 border-t border-border p-4 py-3">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Trophy
                  aria-hidden="true"
                  weight="fill"
                  className="size-4 shrink-0 text-brand-gold"
                />
                <strong className="truncate text-sm font-semibold text-foreground">
                  Medals + AIME invite
                </strong>
              </span>
              <span className="shrink-0 text-xs whitespace-nowrap text-muted">9 days to go</span>
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
