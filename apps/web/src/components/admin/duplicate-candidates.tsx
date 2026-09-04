'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Checkbox } from '@beecompete/ui';
import { enumLabel } from '@/components/admin/enum-labels';
import { formatDate } from '@/lib/dates';
import { describeReasons, hardCompetitionMatch, hardOrganizationMatch } from '@/lib/duplicates';
import type { CompetitionDuplicates, OrganizationCandidate } from '@/lib/admin-types';

/**
 * The "possible duplicates" surface of the competition and organization forms (DQ4,
 * docs/duplicate-detection-plan.md). Same shape as the organizer resolver's candidate list a
 * curator already knows — a list of named rows to look at — inside the Alert every other
 * form-level notice uses. Nothing new to learn, and no new element type.
 *
 * Two verdicts, one panel:
 *  - HARD: a live listing (or organization) already carries this exact name. The server refuses
 *    that outright, so the panel says so and offers no checkbox — the fix is a rename, or editing
 *    the other row.
 *  - SOFT: same URL / website, similar name, or an archived same-name row. Listed with reasons,
 *    plus the one checkbox the server honours: "This is not a duplicate". Posted as
 *    `confirmNotDuplicate`; the checkbox lives INSIDE the form so it rides the ordinary submit.
 */

const DELAY_MS = 450;

/**
 * Runs `check` after the inputs settle. `key` is the inputs, serialized: a change restarts the
 * timer; null means "nothing to check" and clears the result. Late replies are dropped, so a slow
 * lookup for an old name never overwrites the answer for the current one.
 */
export function useDuplicateCheck<T>(
  key: string | null,
  check: () => Promise<T>,
): { result: T | null; checking: boolean } {
  // The answer is stored WITH the key it answers, and read back only while that key is still the
  // current one — so a change of inputs shows nothing (not a stale panel) until the new answer
  // lands, and no state has to be reset synchronously when the inputs change.
  const [answer, setAnswer] = useState<{ key: string; value: T | null } | null>(null);
  const latest = useRef(0);
  // The latest `check` closure, synced after render so the timer below always calls the current
  // one without being a dependency (a new closure every render would restart the timer every render).
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });

  useEffect(() => {
    if (key === null) return;
    const seq = ++latest.current;
    const timer = setTimeout(async () => {
      let value: T | null = null;
      try {
        value = await checkRef.current();
      } catch {
        value = null; // the server gate still stands; a failed pre-check just shows nothing
      }
      if (seq === latest.current) setAnswer({ key, value });
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [key]);

  const current = key !== null && answer?.key === key;
  return { result: current ? answer.value : null, checking: key !== null && !current };
}

function ConfirmCheckbox({ subject }: { subject: string }) {
  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <Checkbox
        name="confirmNotDuplicate"
        label={`I checked — this is not a duplicate, save the ${subject} anyway`}
      />
    </div>
  );
}

function CandidateRow({
  href,
  title,
  subtitle,
  reasons,
  archived,
}: {
  href: string;
  title: string;
  subtitle?: string | null;
  reasons: string;
  archived: boolean;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <Link href={href} className="font-medium text-foreground underline underline-offset-2">
        {title}
      </Link>
      {archived && <Badge variant="outline">archived</Badge>}
      <span className="text-xs text-muted">
        {reasons}
        {subtitle ? ` · ${subtitle}` : ''}
      </span>
    </li>
  );
}

export function CompetitionDuplicatesPanel({
  duplicates,
  className,
}: {
  duplicates: CompetitionDuplicates | null;
  className?: string;
}) {
  if (!duplicates || (duplicates.catalog.length === 0 && duplicates.pending.length === 0)) {
    return null;
  }
  const hard = hardCompetitionMatch(duplicates);
  if (hard) {
    return (
      <Alert tone="danger" className={className} title="A live listing already has this name">
        <p>
          <Link
            href={`/admin/competitions/${hard.id}`}
            className="font-medium underline underline-offset-2"
          >
            {hard.name}
          </Link>
          {hard.organizerName ? ` (${hard.organizerName})` : ''} is already in the catalog under
          this name. Two live listings can’t share one — rename this one so people can tell them
          apart, or edit that listing instead.
        </p>
      </Alert>
    );
  }
  return (
    <Alert tone="warning" className={className} title="Possible duplicate — check before saving">
      {duplicates.catalog.length > 0 && (
        <ul className="grid gap-1">
          {duplicates.catalog.map((c) => (
            <CandidateRow
              key={c.id}
              href={`/admin/competitions/${c.id}`}
              title={c.name}
              subtitle={c.organizerName}
              reasons={describeReasons(c.reasons)}
              archived={c.archivedAt !== null}
            />
          ))}
        </ul>
      )}
      {duplicates.pending.length > 0 && (
        <div className={duplicates.catalog.length > 0 ? 'mt-2' : undefined}>
          <p className="text-xs font-medium text-foreground">
            {duplicates.catalog.length > 0
              ? 'Also waiting in the import queue:'
              : 'Not listed yet, but already waiting in the import queue:'}
          </p>
          <ul className="mt-1 grid gap-1">
            {duplicates.pending.map((p) => (
              <CandidateRow
                key={p.importRecordId}
                href={`/admin/import-records/${p.importRecordId}`}
                title={p.name ?? 'untitled record'}
                subtitle={`queued ${formatDate(p.createdAt)}`}
                reasons={describeReasons(p.reasons)}
                archived={false}
              />
            ))}
          </ul>
        </div>
      )}
      <ConfirmCheckbox subject="listing" />
    </Alert>
  );
}

export function OrganizationDuplicatesPanel({
  candidates,
  className,
}: {
  candidates: OrganizationCandidate[] | null;
  className?: string;
}) {
  if (!candidates || candidates.length === 0) return null;
  const hard = hardOrganizationMatch(candidates);
  if (hard) {
    return (
      <Alert tone="danger" className={className} title="An organization already has this name">
        <p>
          <Link
            href={`/admin/organizations/${hard.id}`}
            className="font-medium underline underline-offset-2"
          >
            {hard.name}
          </Link>
          {hard.domain ? ` (${hard.domain})` : ''} already exists. Use it — or, if this really is a
          different organization, give it a name that tells the two apart.
        </p>
      </Alert>
    );
  }
  return (
    <Alert tone="warning" className={className} title="Possible duplicate — check before saving">
      <ul className="grid gap-1">
        {candidates.map((c) => (
          <CandidateRow
            key={c.id}
            href={`/admin/organizations/${c.id}`}
            title={c.name}
            subtitle={[enumLabel(c.type), c.domain].filter(Boolean).join(' · ')}
            reasons={describeReasons(c.reasons)}
            archived={c.archivedAt !== null}
          />
        ))}
      </ul>
      <ConfirmCheckbox subject="organization" />
    </Alert>
  );
}
