import { AlertTriangle, CheckCircle2, Grid2x2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type {
  ProductMigrationStatus,
  ProductVariantModel,
} from '@/lib/products';

interface ProductMigrationBadgesProps {
  migrationStatus?: ProductMigrationStatus;
  variantModel?: ProductVariantModel;
}

export function ProductMigrationBadges({
  migrationStatus,
  variantModel,
}: ProductMigrationBadgesProps) {
  const showSkuMatrixBadge = variantModel === 'sku_matrix';
  const showNeedsReviewBadge = migrationStatus === 'needs_review';
  const showMigratedBadge = migrationStatus === 'migrated';

  if (!showSkuMatrixBadge && !showNeedsReviewBadge && !showMigratedBadge) {
    return null;
  }

  return (
    <>
      {showSkuMatrixBadge ? (
        <Badge
          variant="secondary"
          className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
        >
          <Grid2x2 className="h-3 w-3" />
          SKU Matrix
        </Badge>
      ) : null}
      {showNeedsReviewBadge ? (
        <Badge
          variant="secondary"
          className="gap-1 border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <AlertTriangle className="h-3 w-3" />
          Needs Review
        </Badge>
      ) : null}
      {showMigratedBadge ? (
        <Badge
          variant="secondary"
          className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-3 w-3" />
          Migrated
        </Badge>
      ) : null}
    </>
  );
}
