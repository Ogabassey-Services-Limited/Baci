import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  CreditCard,
  FileText,
  Megaphone,
  Package,
  Store,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type {
  SetupChecklistContentProps,
  SetupItem,
} from './setup-checklist-types';
import { getWebStoreReadinessHref } from './store-readiness-hrefs';

const categoryIcons = {
  payments: CreditCard,
  products: Package,
  store: Store,
  legal: FileText,
  marketing: Megaphone,
};

const priorityColors = {
  required:
    'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
  recommended:
    'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
  optional:
    'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
};

const priorityLabels = {
  required: 'Required',
  recommended: 'Recommended',
  optional: 'Optional',
};

export function SetupChecklistContent({
  compact,
  displayItems,
  incompleteItems,
  readiness,
  requiredIncomplete,
  setShowAll,
  showAll,
}: SetupChecklistContentProps) {
  return (
    <div className={cn(compact && 'px-0 pb-0', 'p-0 sm:p-6 sm:pt-0')}>
      {!readiness.isReady && requiredIncomplete.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="size-4" />
            {requiredIncomplete.length} required{' '}
            {requiredIncomplete.length === 1 ? 'item' : 'items'} remaining
          </div>
          <p className="mt-1 text-red-600 dark:text-red-400">
            Complete these to publish your store and start accepting orders.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {displayItems.map((item, index) => (
          <SetupItemRow
            key={item.id}
            item={item}
            isNext={index === 0 && !item.completed && !compact}
          />
        ))}
      </div>

      {incompleteItems.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-4 flex items-center gap-1 rounded-sm text-primary text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-expanded={showAll}
          aria-label={
            showAll
              ? 'Show fewer setup items'
              : `Show ${incompleteItems.length - 3} more setup items`
          }
        >
          {showAll
            ? 'Show less'
            : `Show ${incompleteItems.length - 3} more items`}
          <ArrowRight
            className={cn(
              'size-3 transition-transform',
              showAll && 'rotate-90'
            )}
          />
        </button>
      )}

      {incompleteItems.length === 0 && (
        <div className="py-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-12 text-green-600" />
          <p className="font-medium text-lg">All set up!</p>
          <p className="text-muted-foreground text-sm">
            Your store is fully configured and ready for customers.
          </p>
        </div>
      )}
    </div>
  );
}

function SetupItemRow({ item, isNext }: { item: SetupItem; isNext?: boolean }) {
  const Icon = categoryIcons[item.category];
  const itemHref = getWebStoreReadinessHref(item.id);
  const href =
    `${itemHref}${itemHref.includes('?') ? '&' : '?'}onboarding=true` as Route;

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg border p-3 transition-all',
        item.completed
          ? 'border-green-200 bg-green-50/50 hover:bg-green-50 dark:border-green-800 dark:bg-green-950/30 dark:hover:bg-green-950/50'
          : isNext
            ? 'border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20'
            : 'border-border bg-card hover:border-primary/50 hover:shadow-sm'
      )}
    >
      {isNext && (
        <span className="absolute -left-1 top-1/2 h-8 w-1 -translate-y-1/2 animate-pulse rounded-full bg-primary" />
      )}
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors',
          item.completed
            ? 'bg-green-600 text-white'
            : isNext
              ? 'bg-primary/20 text-primary'
              : 'bg-muted'
        )}
      >
        {item.completed ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <Circle
            className={cn('size-4', isNext ? 'text-primary' : 'text-gray-400')}
          />
        )}
      </div>
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          item.completed
            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
            : isNext
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'font-medium text-sm',
              item.completed && 'text-muted-foreground line-through'
            )}
          >
            {item.label}
          </p>
          {isNext && (
            <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-bold text-[10px] text-primary uppercase tracking-wider">
              Next Step
            </span>
          )}
        </div>
        <p className="truncate text-muted-foreground text-xs">
          {item.description}
        </p>
      </div>
      {!item.completed && !isNext && (
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 font-medium text-xs',
            priorityColors[item.priority]
          )}
        >
          {priorityLabels[item.priority]}
        </span>
      )}
      <ArrowRight
        className={cn(
          'size-4 shrink-0 transition-transform group-hover:translate-x-1',
          item.completed
            ? 'text-green-600 dark:text-green-400'
            : isNext
              ? 'text-primary'
              : 'text-muted-foreground'
        )}
      />
    </Link>
  );
}
