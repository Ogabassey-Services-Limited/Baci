import { ArrowLeft, Eye, Loader2, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { asRoute } from '@/lib/routes';

export function NewBlogPostHeader({
  wordCount,
  readingTime,
  isSaving,
  onPreview,
  onSaveDraft,
  onPublish,
}: {
  wordCount: number;
  readingTime: number;
  isSaving: boolean;
  onPreview: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={asRoute('/dashboard/blog')}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Blog Post</h1>
          <p className="text-sm text-muted-foreground">
            {wordCount} words | {readingTime} min read
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onPreview} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Eye className="size-4 mr-2" />
          )}
          Preview
        </Button>
        <Button variant="outline" onClick={onSaveDraft} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Save className="size-4 mr-2" />
          )}
          Save Draft
        </Button>
        <Button onClick={onPublish} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Send className="size-4 mr-2" />
          )}
          Publish
        </Button>
      </div>
    </div>
  );
}
