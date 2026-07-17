import Link from 'next/link';
import { ArrowLeft, ArrowRight, buttonClasses } from '@beecompete/ui';

/**
 * Shared Prev/Next pager for admin list pages (competitions, organizations, both review
 * queues). Server component — pages build the href so their other params (query, status)
 * survive paging. Renders nothing for a single page.
 */
export function AdminPagination({
  page,
  totalPages,
  hrefFor,
}: {
  /** Zero-based current page (Spring `Page.number`). */
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted">
        Page {page + 1} of {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 0 && (
          <Link
            href={hrefFor(page - 1)}
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Prev
          </Link>
        )}
        {page < totalPages - 1 && (
          <Link
            href={hrefFor(page + 1)}
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          >
            Next <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
    </nav>
  );
}
