import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BlogStats } from './blog-client-types';

const STATUS_CARDS = [
  {
    label: 'Total Posts',
    status: 'all',
    value: (stats: BlogStats) => stats.total,
  },
  {
    label: 'Published',
    status: 'published',
    value: (stats: BlogStats) => stats.published,
  },
  {
    label: 'Drafts',
    status: 'draft',
    value: (stats: BlogStats) => stats.drafts,
  },
] as const;

interface BlogStatsFiltersProps {
  discoverRemediationCount: number;
  onDiscoverRemediation: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: string) => void;
  searchQuery: string;
  stats: BlogStats;
  statusFilter: string;
}

export function BlogStatsFilters({
  discoverRemediationCount,
  onDiscoverRemediation,
  onSearchChange,
  onStatusChange,
  searchQuery,
  stats,
  statusFilter,
}: BlogStatsFiltersProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        {STATUS_CARDS.map((card) => (
          <Card
            className={`transition-all hover:shadow-md ${
              statusFilter === card.status
                ? card.status === 'published'
                  ? 'ring-2 ring-green-600'
                  : card.status === 'draft'
                    ? 'ring-2 ring-yellow-600'
                    : 'ring-2 ring-primary'
                : ''
            }`}
            key={card.status}
          >
            <button
              aria-pressed={statusFilter === card.status}
              className="block w-full cursor-pointer text-left"
              onClick={() => onStatusChange(card.status)}
              type="button"
            >
              <CardHeader className="pb-2">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle
                  className={`text-2xl ${
                    card.status === 'published'
                      ? 'text-green-600'
                      : card.status === 'draft'
                        ? 'text-yellow-600'
                        : ''
                  }`}
                >
                  {card.value(stats)}
                </CardTitle>
              </CardHeader>
            </button>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Views on this page</CardDescription>
            <CardTitle className="text-2xl">
              {stats.pageViews.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {discoverRemediationCount > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              {discoverRemediationCount === 1
                ? '1 published post needs Discover image updates.'
                : `${discoverRemediationCount} published posts need Discover image updates.`}
            </p>
            <Button onClick={onDiscoverRemediation} size="sm" variant="outline">
              Update image metadata
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-10"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search posts..."
            value={searchQuery}
          />
        </div>
        <Select onValueChange={onStatusChange} value={statusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Posts</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
