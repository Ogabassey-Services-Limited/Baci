import { Button } from '@/components/ui/button';

interface BlogPaginationProps {
  hasMore: boolean;
  page: number;
  setPage: (updater: (page: number) => number) => void;
  total: number;
}

const ITEMS_PER_PAGE = 20;

export function BlogPagination({
  hasMore,
  page,
  setPage,
  total,
}: BlogPaginationProps) {
  return (
    <div className="flex items-center justify-between border-t pt-4">
      <div className="text-muted-foreground text-sm">
        Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{' '}
        {Math.min(page * ITEMS_PER_PAGE, total)} of {total} results
      </div>
      <div className="flex items-center gap-2">
        <Button
          disabled={page === 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          size="sm"
          variant="outline"
        >
          Previous
        </Button>
        <Button
          disabled={!hasMore}
          onClick={() => setPage((current) => current + 1)}
          size="sm"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
