'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Button,
  CheckCircle,
  Input,
  Select,
  Textarea,
  buttonClasses,
  cn,
} from '@beecompete/ui';
import { submitCompetitionRequest } from './actions';
import { INTEREST_OPTIONS } from '@/lib/digest-options';
import type { FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

// One-question-per-step wizard (page-blueprints Page 6, DQ15). All fields live in a single form
// (so the last-step submit carries everything); the client just controls which step is visible
// and the progress. Step 1 (name) is the only required field — the rest help our curators but
// never block the submit (owner: "designed to feel effortless, not like a form").
const STEPS = [
  { id: 'name', title: 'What competition should we add?' },
  { id: 'organizerName', title: 'Who runs it?' },
  { id: 'officialUrl', title: 'Where can we find it?' },
  { id: 'category', title: 'What subject is it?' },
  { id: 'extras', title: 'Anything else? (optional)' },
] as const;

export function RequestWizard({ initialName = '' }: { initialName?: string }) {
  const [state, formAction, submitting] = useActionState(submitCompetitionRequest, INITIAL);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);

  if (state.ok) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 text-center sm:p-10">
        <CheckCircle aria-hidden="true" weight="fill" className="mx-auto size-10 text-success" />
        <h2 className="mt-3 font-display text-2xl text-foreground">Thanks — request received!</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Our curation team reviews every suggestion (usually within a few days) and writes an
          honest listing before it goes live. We don&apos;t publish anything automatically.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/competitions" className={buttonClasses()}>
            Browse competitions
          </Link>
          <Link href="/suggest-a-competition" className={buttonClasses({ variant: 'secondary' })}>
            Request another
          </Link>
        </div>
      </div>
    );
  }

  const isLast = step === STEPS.length - 1;
  const canAdvance = step > 0 || name.trim().length > 0;
  const activeStep = STEPS[step] ?? STEPS[0];

  return (
    <form action={formAction} className="grid gap-6">
      {/* Honeypot — humans never see this; bots that fill it are dropped server-side. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
      >
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-brand-gold transition-[width] duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="font-display text-2xl text-foreground sm:text-3xl">{activeStep.title}</h2>

      {/* All fields stay mounted; only the active step is shown so the final submit has them all. */}
      <div className="grid gap-4">
        <div hidden={step !== 0}>
          <Input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. National Science Bee"
            aria-label="Competition name"
            autoComplete="off"
          />
        </div>
        <div hidden={step !== 1}>
          <Input
            name="organizerName"
            placeholder="Organization or host, if you know it"
            aria-label="Organizer"
            autoComplete="off"
          />
        </div>
        <div hidden={step !== 2}>
          <Input
            type="url"
            name="officialUrl"
            placeholder="https://…"
            aria-label="Official website"
            autoComplete="off"
          />
          <p className="mt-2 text-xs text-muted">
            A link to the official page helps us verify and write the listing faster.
          </p>
        </div>
        <div hidden={step !== 3}>
          <Select
            name="category"
            options={INTEREST_OPTIONS}
            placeholder="Pick the closest subject"
            aria-label="Subject category"
          />
        </div>
        <div hidden={step !== 4} className="grid gap-4">
          <Input name="grades" placeholder="Grades (e.g. 6–12)" aria-label="Grade range" />
          <Input name="deadline" placeholder="Deadline, if you know it" aria-label="Deadline" />
          <Textarea
            name="details"
            rows={4}
            placeholder="Anything else we should know?"
            aria-label="Extra details"
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={cn(buttonClasses({ variant: 'ghost' }), step === 0 && 'invisible')}
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Back
        </button>

        {isLast ? (
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit request'}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          >
            Next <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
