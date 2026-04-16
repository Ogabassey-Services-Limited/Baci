import { Archive, DollarSign, File, Package } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductsPageStatsProps {
  totalProducts: number;
  inventoryValueLabel: string;
  outOfStockCount: number;
  categoryCount: number;
}

export function ProductsPageStats({
  totalProducts,
  inventoryValueLabel,
  outOfStockCount,
  categoryCount,
}: ProductsPageStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 transition-transform transform hover:scale-105">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">
            Total Products
          </CardTitle>
          <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {totalProducts}
          </div>
          <p className="text-xs text-muted-foreground dark:text-blue-300/70">
            items in your catalog
          </p>
        </CardContent>
      </Card>
      <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800 transition-transform transform hover:scale-105">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">
            Inventory Value
          </CardTitle>
          <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">
            {inventoryValueLabel}
          </div>
          <p className="text-xs text-muted-foreground dark:text-green-300/70">
            Total value of tracked stock
          </p>
        </CardContent>
      </Card>
      <Card className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800 transition-transform transform hover:scale-105">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-800 dark:text-red-300">
            Out of Stock
          </CardTitle>
          <Archive className="h-4 w-4 text-red-600 dark:text-red-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-900 dark:text-red-100">
            {outOfStockCount}
          </div>
          <p className="text-xs text-muted-foreground dark:text-red-300/70">
            items need restocking
          </p>
        </CardContent>
      </Card>
      <Link href="/dashboard/categories" className="contents">
        <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800 transition-transform transform hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Categories
            </CardTitle>
            <File className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
              {categoryCount}
            </div>
            <p className="text-xs text-muted-foreground dark:text-yellow-300/70">
              product categories
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
