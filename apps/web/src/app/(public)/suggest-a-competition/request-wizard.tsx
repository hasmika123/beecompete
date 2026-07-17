'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Button,
  CheckCircle,
  Honeypot,
  Input,
  Select,
  Textarea,
  buttonClasses,
  cn,
} from '@beecompete/ui';
import { submitCompetitionRequest } from './actions';
import { CATEGORY_SLUG_OPTIONS } from '@/lib/digest-options';
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

  // Move focus to the confirmation panel on submit so screen-reader users hear the outcome (the
  // form is replaced, so there's no live region otherwise).
  const successRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.ok) successRef.current?.focus();
  }, [state.ok]);

  // Move focus to the step heading when the step changes (but not on first render) so screen-reader
  // users hear the new question and land just before its field — the silent setStep is otherwise
  // undetectable to AT (WCAG 4.1.3). Skipping the initial mount avoids stealing focus on page load.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  if (state.ok) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 text-center outline-none sm:p-10"
      >
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

  // noValidate: fields live in a single form across steps (non-active steps are `hidden`), so native
  // constraint validation on a hidden field (e.g. a malformed type=url) would silently block the
  // final submit with no visible error. The server (@Valid) is the real gate.
  return (
    <form action={formAction} noValidate className="grid gap-6">
      <Honeypot />

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

      <h2
        ref={stepHeadingRef}
        tabIndex={-1}
        className="font-display text-2xl text-foreground outline-none sm:text-3xl"
      >
        {activeStep.title}
      </h2>

      {/* All fields stay mounted; only the active step is shown so the final submit has them all. */}
      <div className="grid gap-4">
        <div hidden={step !== 0}>
          <Input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. National Science Bee"
            aria-label="Competition name"
            aria-required="true"
            aria-describedby="wizard-name-hint"
            autoComplete="off"
          />
          {/* Conveys the requirement non-visually AND explains why "Next" is disabled until it's
              filled (the disabled button alone gives AT users no reason) — WCAG 3.3.2. */}
          <p id="wizard-name-hint" className="mt-2 text-xs text-muted">
            Required — everything after this is optional.
          </p>
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
            options={CATEGORY_SLUG_OPTIONS}
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
