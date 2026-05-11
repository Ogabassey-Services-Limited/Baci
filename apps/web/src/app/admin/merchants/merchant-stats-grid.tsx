// Required for interactive stat cards with click and keyboard handlers.
'use client';

import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AdminMerchantHealthRow } from '@/types/admin-merchants';

export type HealthFilter = 'all' | AdminMerchantHealthRow['health_status'];

export type MerchantStats = {
  total: number;
  healthy: number;
  atRisk: number;
  churned: number;
  new: number;
};

const STAT_ITEMS: Array<{
  borderClass?: string;
  filter: HealthFilter;
  icon: typeof Building2;
  iconClass: string;
  label: string;
  ringClass: string;
  valueKey: keyof MerchantStats;
}> = [
  {
    filter: 'all',
    icon: Building2,
    iconClass: 'text-primary',
    label: 'Total Merchants',
    ringClass: 'ring-primary',
    valueKey: 'total',
  },
  {
    borderClass: 'border-emerald-500/20',
    filter: 'healthy',
    icon: CheckCircle,
    iconClass: 'text-emerald-500',
    label: 'Healthy',
    ringClass: 'ring-emerald-500',
    valueKey: 'healthy',
  },
  {
    borderClass: 'border-amber-500/20',
    filter: 'at_risk',
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    label: 'At Risk',
    ringClass: 'ring-amber-500',
    valueKey: 'atRisk',
  },
  {
    borderClass: 'border-destructive/20',
    filter: 'churned',
    icon: XCircle,
    iconClass: 'text-destructive',
    label: 'Churned',
    ringClass: 'ring-destructive',
    valueKey: 'churned',
  },
  {
    borderClass: 'border-indigo-500/20',
    filter: 'new',
    icon: Clock,
    iconClass: 'text-indigo-500',
    label: 'New (No Sales)',
    ringClass: 'ring-indigo-500',
    valueKey: 'new',
  },
];

export function MerchantStatsGrid({
  activeFilter,
  onFilterChange,
  stats,
}: {
  activeFilter: HealthFilter;
  onFilterChange: (filter: HealthFilter) => void;
  stats: MerchantStats;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {STAT_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.filter}
            className={cn(
              'cursor-pointer transition-colors hover:bg-muted/50',
              item.borderClass,
              activeFilter === item.filter && 'ring-2',
              activeFilter === item.filter && item.ringClass
            )}
            onClick={() => onFilterChange(item.filter)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onFilterChange(item.filter);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Filter merchants by ${item.label}`}
            aria-pressed={activeFilter === item.filter}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Icon
                  className={cn('h-8 w-8', item.iconClass)}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-stat">{stats[item.valueKey]}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
