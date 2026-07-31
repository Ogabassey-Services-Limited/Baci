import { Badge } from '@/components/ui/badge';
import type { BlogDiscoverImageReadinessState } from '@/lib/blog-discover-readiness';

const labels: Record<BlogDiscoverImageReadinessState, string> = {
  legacy_missing_metadata: 'Missing image metadata',
  missing_featured_image: 'Needs featured image',
  missing_landscape_variant: 'Missing 16:9 variant',
  ready: 'Discover ready',
  unmanaged_featured_image: 'Needs managed image',
};

export function BlogDiscoverReadinessBadge({
  state,
}: {
  state: BlogDiscoverImageReadinessState;
}) {
  return (
    <Badge
      className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      variant="secondary"
    >
      {labels[state]}
    </Badge>
  );
}
