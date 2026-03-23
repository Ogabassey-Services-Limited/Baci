'use client';

import {
  AlertTriangle,
  FileWarning,
  PackageCheck,
  ShoppingCart,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OrderStats } from './actions';

export function OrdersStatsCards({
  stats,
  statsLoading,
}: {
  stats: OrderStats;
  statsLoading: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="border-blue-200 bg-blue-50/50 backdrop-blur-sm transition-transform hover:scale-105">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-800">
            Total Orders 🛍️
          </CardTitle>
          <ShoppingCart className="h-5 w-5 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-stat text-blue-900 dark:text-slate-50">
            {statsLoading ? (
              <BagLoader size={24} />
            ) : (
              stats.totalOrders.toLocaleString()
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-200 bg-yellow-50/50 backdrop-blur-sm transition-transform hover:scale-105">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-yellow-800">
            Completed Orders ✅
          </CardTitle>
          <PackageCheck className="h-5 w-5 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-stat text-yellow-900 dark:text-slate-50">
            {statsLoading ? (
              <BagLoader size={24} />
            ) : (
              stats.completedOrders.toLocaleString()
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/50 backdrop-blur-sm transition-transform hover:scale-105">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-800">
            Unpaid Orders 💸
          </CardTitle>
          <FileWarning className="h-5 w-5 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-stat text-blue-900 dark:text-slate-50">
            {statsLoading ? (
              <BagLoader size={24} />
            ) : (
              stats.unpaidOrders.toLocaleString()
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
  if (!showAlert || stats.urgentOrders <= 0) {
    return null;
  }

  return (
    <Alert className="relative border-yellow-200 bg-yellow-50/80 text-yellow-900 backdrop-blur-sm dark:border-yellow-500/20 dark:bg-yellow-500/10 dark:text-yellow-100">
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
