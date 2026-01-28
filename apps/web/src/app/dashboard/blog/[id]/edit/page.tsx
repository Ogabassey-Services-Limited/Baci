import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';
import { EditBlogPostClient } from './edit-post-client';

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex h-[50vh] w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <EditBlogPostClient postId={id} />
    </Suspense>
  );
}
