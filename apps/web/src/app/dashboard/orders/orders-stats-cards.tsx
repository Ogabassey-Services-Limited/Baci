'use client';

import { FileWarning, PackageCheck, ShoppingCart } from 'lucide-react';
import { BagLoader } from '@/components/ui/bag-loader';
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
      <Card className="border-blue-200 bg-blue-50/50 backdrop-blur-xs transition-transform hover:scale-105">
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

      <Card className="border-yellow-200 bg-yellow-50/50 backdrop-blur-xs transition-transform hover:scale-105">
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

      <Card className="border-blue-200 bg-blue-50/50 backdrop-blur-xs transition-transform hover:scale-105">
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
