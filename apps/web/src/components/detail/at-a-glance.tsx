import type { ComponentType } from 'react';
import { Clock, GraduationCap, MapPin, Ticket, Trophy, Users } from '@beecompete/ui';
import { deadlineDisplay, gradeLabel } from '@/lib/catalog-display';
import {
  costLabel,
  currentEdition,
  formatDate,
  locationLabel,
  nextDeadline,
  pathwayLabel,
  prizeLabel,
} from '@/lib/detail-display';
import type { CompetitionDetail } from '@/lib/catalog-types';

// "At a glance" strip (blueprints Page 3.2): the 10-second answer — icons + values in the
// SAME fixed order on every competition: Grades · Next deadline · Cost · Location · Prize ·
// Entry pathway. Prize and deadline are omitted when unknown (rather than showing a hollow
// "—"), but the remaining order never changes. The Spine tab below is the full version.

interface Item {
  key: string;
  icon: ComponentType<{ className?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' }>;
  label: string;
  value: string;
  urgent?: boolean;
}

export function AtAGlance({ competition }: { competition: CompetitionDetail }) {
  const edition = currentEdition(competition.editions);
  const deadline = nextDeadline(competition.editions);
  const deadlineView = deadline ? deadlineDisplay(deadline.iso) : undefined;
  const prize = prizeLabel(edition);

  const items: Item[] = [
    {
      key: 'grades',
      icon: GraduationCap,
      label: 'Grades',
      value: gradeLabel(competition.minGrade, competition.maxGrade) ?? 'All grades',
    },
  ];
  if (deadline) {
    items.push({
      key: 'deadline',
      icon: Clock,
      label: 'Next deadline',
      value: deadlineView?.label ?? `Closes ${formatDate(deadline.iso)}`,
      urgent: deadlineView?.urgent,
    });
  }
  items.push(
    { key: 'cost', icon: Ticket, label: 'Cost', value: costLabel(competition, edition) },
    {
      key: 'location',
      icon: MapPin,
      label: 'Location',
      value: locationLabel(competition, edition),
    },
  );
  if (prize) {
    items.push({ key: 'prize', icon: Trophy, label: 'Prize', value: prize });
  }
  items.push({
    key: 'pathway',
    icon: Users,
    label: 'How to enter',
    value: pathwayLabel(competition.entryPathway),
  });

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="flex items-start gap-2.5">
            <Icon
              aria-hidden="true"
              weight={item.key === 'prize' ? 'fill' : 'regular'}
              className={
                item.key === 'prize' ? 'mt-0.5 size-5 text-brand-gold' : 'mt-0.5 size-5 text-muted'
              }
            />
            <div className="min-w-0">
              <dt className="text-xs text-muted">{item.label}</dt>
              <dd
                className={
                  item.urgent
                    ? 'truncate text-sm font-semibold text-danger'
                    : 'truncate text-sm font-semibold text-foreground'
                }
              >
                {item.value}
              </dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}
