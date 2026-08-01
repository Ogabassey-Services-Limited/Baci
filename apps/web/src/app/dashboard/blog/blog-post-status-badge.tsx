import { Archive, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BlogPost } from './blog-client-types';

export function BlogPostStatusBadge({
  status,
}: {
  status: BlogPost['status'];
}) {
  if (status === 'published') {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle className="mr-1 size-3" /> Published
      </Badge>
    );
  }
  if (status === 'archived') {
    return (
      <Badge variant="secondary">
        <Archive className="mr-1 size-3" /> Archived
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Clock className="mr-1 size-3" /> Draft
    </Badge>
  );
}
