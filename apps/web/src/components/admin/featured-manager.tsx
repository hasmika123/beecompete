'use client';

import { useState, useTransition } from 'react';
import { Button, ChevronDown, ChevronUp, Trash, useToast } from '@beecompete/ui';
import { NativeSelect } from '@/components/admin/native-select';
import { setFeaturedSlots } from '@/app/admin/landing/actions';

interface Option {
  id: string;
  name: string;
}

/** Manage the Landing carousel: add/remove/reorder competitions, then save the ordered list (≤10). */
export function FeaturedManager({
  allCompetitions,
  initial,
}: {
  allCompetitions: Option[];
  initial: string[];
}) {
  const [ids, setIds] = useState<string[]>(initial);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const nameOf = new Map(allCompetitions.map((c) => [c.id, c.name]));
  const available = allCompetitions.filter((c) => !ids.includes(c.id));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
    setIds(next);
  };

  return (
    <div className="grid gap-4">
      {ids.length === 0 && (
        <p className="text-sm text-muted">
          No featured competitions yet — add up to 10 below to fill the Landing carousel.
        </p>
      )}
      <ol className="grid gap-2">
        {ids.map((id, i) => (
          <li
            key={id}
            className="flex items-center justify-between gap-2 rounded-[var(--radius-panel)] border border-border p-2.5 text-sm"
          >
            <span className="flex items-center gap-2">
              <span className="text-muted">{i + 1}.</span>
              {nameOf.get(id) ?? id}
            </span>
            <span className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ChevronUp aria-hidden="true" className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Move down"
                disabled={i === ids.length - 1}
                onClick={() => move(i, 1)}
              >
                <ChevronDown aria-hidden="true" className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Remove"
                onClick={() => setIds(ids.filter((x) => x !== id))}
              >
                <Trash aria-hidden="true" className="size-4" />
              </Button>
            </span>
          </li>
        ))}
      </ol>

      {ids.length >= 10 ? (
        <p className="text-sm text-muted">Maximum of 10 featured picks reached.</p>
      ) : (
        available.length > 0 && (
          <NativeSelect
            aria-label="Add competition to carousel"
            options={available.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Add a competition…"
            value=""
            onChange={(e) => {
              if (e.target.value) setIds([...ids, e.target.value]);
            }}
            className="max-w-sm"
          />
        )
      )}

      <div>
        <Button
          size="sm"
          disabled={pending || ids.length === 0}
          onClick={() =>
            startTransition(async () => {
              try {
                await setFeaturedSlots(ids);
                toast({ title: 'Carousel saved', tone: 'success' });
              } catch (err) {
                toast({ title: err instanceof Error ? err.message : 'Save failed', tone: 'error' });
              }
            })
          }
        >
          Save carousel ({ids.length})
        </Button>
      </div>
    </div>
  );
}
