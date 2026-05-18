'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import type { OrderStats } from './actions';

export function OrdersUrgentAlert({
  showAlert,
  stats,
  statsLoading,
  onDismiss,
  onResolve,
}: {
  showAlert: boolean;
  stats: OrderStats;
  statsLoading: boolean;
  onDismiss: () => void;
  onResolve: () => void;
}) {
  if (!showAlert || (!statsLoading && stats.urgentOrders <= 0)) {
    return null;
  }

  return (
    <Alert className="relative border-yellow-200 bg-yellow-50/80 text-yellow-900 backdrop-blur-xs dark:border-yellow-500/20 dark:bg-yellow-500/10 dark:text-yellow-100">
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-300" />
      <AlertTitle className="font-semibold">
        {statsLoading ? (
          <span className="flex items-center gap-2">
            <BagLoader size={16} />
            Checking orders...
          </span>
        ) : (
          `${stats.urgentOrders.toLocaleString()} order${stats.urgentOrders !== 1 ? 's' : ''} require${stats.urgentOrders === 1 ? 's' : ''} urgent attention.`
        )}
      </AlertTitle>
      <AlertDescription>
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent p-0 font-medium text-inherit underline"
          onClick={onResolve}
        >
          Click to resolve
        </button>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </Alert>
  );
}
