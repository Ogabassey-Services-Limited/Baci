import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { NewBlogPostFormData } from './new-blog-post-types';

export function NewBlogPostSeoTab({
  formData,
  merchant,
  handleChange,
}: {
  formData: NewBlogPostFormData;
  merchant:
    | { custom_domain?: string | null; slug?: string | null }
    | null
    | undefined;
  handleChange: (field: keyof NewBlogPostFormData, value: string) => void;
}) {
  const titleLength = formData.seo_title?.length || formData.title.length;
  const descriptionLength =
    formData.seo_description?.length || formData.excerpt.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO Settings</CardTitle>
        <CardDescription>
          Optional - we auto-generate these if left empty
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="seo_title">SEO Title</Label>
          <Input
            id="seo_title"
            placeholder={formData.title || 'Uses post title if empty'}
            value={formData.seo_title}
            onChange={(event) => handleChange('seo_title', event.target.value)}
            maxLength={70}
          />
          <div className="flex justify-between text-xs">
            <span
              className={
                titleLength > 60 ? 'text-destructive' : 'text-muted-foreground'
              }
            >
              {titleLength}/60 characters
            </span>
            {titleLength >= 50 && titleLength <= 60 && (
              <span className="text-green-600">Good!</span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="seo_description">Meta Description</Label>
          <Textarea
            id="seo_description"
            placeholder={formData.excerpt || 'Auto-generated from content'}
            value={formData.seo_description}
            onChange={(event) =>
              handleChange('seo_description', event.target.value)
            }
            rows={3}
            maxLength={160}
          />
          <div className="flex justify-between text-xs">
            <span
              className={
                descriptionLength > 160
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }
            >
              {descriptionLength}/160 characters
            </span>
            {descriptionLength >= 120 && descriptionLength <= 160 && (
              <span className="text-green-600">Good!</span>
            )}
          </div>
        </div>
        <div className="pt-4 border-t">
          <Label className="mb-2 block">Search Preview</Label>
          <div className="p-4 bg-white dark:bg-slate-950 rounded-lg border">
            <div className="text-blue-600 dark:text-blue-400 text-lg hover:underline cursor-pointer truncate">
              {formData.seo_title || formData.title || 'Post Title'}
            </div>
            <div className="text-green-700 dark:text-green-500 text-sm">
              {merchant?.custom_domain
                ? `${merchant.custom_domain.replace(/\/$/, '')}/blog/`
                : `/${merchant?.slug}/blog/`}
              {formData.slug || 'post-slug'}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-2">
              {formData.seo_description ||
                formData.excerpt ||
                'Description auto-generated from content...'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
