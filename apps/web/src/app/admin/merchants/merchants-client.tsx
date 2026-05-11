// Required for search, sort, filter, refresh, and toast interactions.
'use client';

import { Building2, Filter, RefreshCw, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatAdminThresholdCurrency } from '@/lib/admin-currency';
import { apiGet } from '@/lib/api-client';
import type {
  AdminMerchantHealthRow,
  AdminMerchantsResponse,
} from '@/types/admin-merchants';
import {
  type HealthFilter,
  type MerchantStats,
  MerchantStatsGrid,
} from './merchant-stats-grid';
import { MerchantTable } from './merchant-table';

export type { HealthFilter } from './merchant-stats-grid';

type SortBy = 'gmv' | 'orders' | 'joined';

const HEALTH_FILTERS = new Set<HealthFilter>([
  'all',
  'healthy',
  'at_risk',
  'churned',
  'new',
]);
const SORT_OPTIONS = new Set<SortBy>(['gmv', 'orders', 'joined']);
const SKELETON_ROW_COUNT = 3;

function isHealthFilter(value: string): value is HealthFilter {
  return HEALTH_FILTERS.has(value as HealthFilter);
}

function isSortBy(value: string): value is SortBy {
  return SORT_OPTIONS.has(value as SortBy);
}

function safeParseNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsedValue =
    typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

export function MerchantsClient({
  initialError = null,
  initialHealthFilter,
  initialMerchants,
}: {
  initialError?: string | null;
  initialHealthFilter: HealthFilter;
  initialMerchants: AdminMerchantHealthRow[];
}) {
  const [merchants, setMerchants] =
    useState<AdminMerchantHealthRow[]>(initialMerchants);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [healthFilter, setHealthFilter] =
    useState<HealthFilter>(initialHealthFilter);
  const [sortBy, setSortBy] = useState<SortBy>('gmv');
  const { toast } = useToast();
  const hasMounted = useRef(false);

  const fetchMerchants = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ sortBy });
      const response = await apiGet<AdminMerchantsResponse>(
        `/api/admin/merchants?${params.toString()}`
      );
      setMerchants(response.data);
      setLoadError(null);
    } catch (error) {
      console.error('Failed to fetch merchants:', error);
      setLoadError('Failed to load merchant data.');
      toast({
        description: 'Failed to load merchant data.',
        title: 'Error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler keeps fetchMerchants stable; the first rows are server-loaded, then this refetches only when sortBy changes.
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    fetchMerchants();
  }, [sortBy]);

  const filteredMerchants = merchants.filter((merchant) => {
    const normalizedSearchQuery = searchQuery.toLowerCase();
    const matchesSearch =
      merchant.business_name?.toLowerCase().includes(normalizedSearchQuery) ||
      merchant.email?.toLowerCase().includes(normalizedSearchQuery);
    const matchesHealth =
      healthFilter === 'all' || merchant.health_status === healthFilter;
    return matchesSearch && matchesHealth;
  });

  const stats = merchants.reduce<MerchantStats & { totalGmv: number }>(
    (accumulator, merchant) => {
      accumulator.total += 1;
      accumulator.totalGmv += safeParseNumber(merchant.total_gmv);

      if (merchant.health_status === 'at_risk') {
        accumulator.atRisk += 1;
      } else if (merchant.health_status === 'churned') {
        accumulator.churned += 1;
      } else if (merchant.health_status === 'healthy') {
        accumulator.healthy += 1;
      } else if (merchant.health_status === 'new') {
        accumulator.new += 1;
      }

      return accumulator;
    },
    { atRisk: 0, churned: 0, healthy: 0, new: 0, total: 0, totalGmv: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-page-title">Merchants</h1>
          <p className="text-muted-foreground">
            View merchant health, users, and operational status.
          </p>
        </div>
        <Button variant="outline" onClick={fetchMerchants} disabled={loading}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? 'motion-safe:animate-spin' : ''}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      <MerchantStatsGrid
        activeFilter={healthFilter}
        onFilterChange={setHealthFilter}
        stats={stats}
      />

      {loadError ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          <p className="font-medium">Merchant data could not load.</p>
          <p>{loadError} Use Refresh to try again.</p>
        </div>
      ) : null}

      <Card className="glass">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder="Search merchants..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={healthFilter}
                onValueChange={(value) => {
                  if (isHealthFilter(value)) {
                    setHealthFilter(value);
                  }
                }}
              >
                <SelectTrigger className="w-[150px]" aria-label="Health status">
                  <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
                  <SelectValue placeholder="Health Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sortBy}
                onValueChange={(value) => {
                  if (isSortBy(value)) {
                    setSortBy(value);
                  }
                }}
              >
                <SelectTrigger
                  className="w-[150px]"
                  aria-label="Sort merchants"
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmv">Highest GMV</SelectItem>
                  <SelectItem value="orders">Most Orders</SelectItem>
                  <SelectItem value="joined">Recently Joined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton rows are transient placeholders.
                  key={index}
                  className="flex items-center gap-4 rounded-lg border p-4"
                >
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : filteredMerchants.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="font-medium">No merchants found</p>
              <p className="text-sm">
                {searchQuery || healthFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Merchants will appear here once they sign up'}
              </p>
            </div>
          ) : (
            <MerchantTable
              merchants={filteredMerchants}
              onInvalidStorefrontUrl={() =>
                toast({
                  description: 'Could not generate a valid storefront URL.',
                  title: 'Error',
                  variant: 'destructive',
                })
              }
            />
          )}
        </CardContent>
      </Card>

      {!loading && filteredMerchants.length > 0 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Showing {filteredMerchants.length} of {merchants.length} merchants
          </p>
          <p>
            Combined GMV:{' '}
            <span className="font-medium text-foreground">
              {formatAdminThresholdCurrency(stats.totalGmv)}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
