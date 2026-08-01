import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { getPublicRootDomain } from '@/lib/blog-public-config';
import type { MerchantPreviewData, PostFormData } from './edit-blog-types';

export function EditBlogSeoTab({
  formData,
  merchant,
  handleChange,
  optimizeSEO,
}: {
  formData: PostFormData;
  merchant: MerchantPreviewData | null;
  handleChange: (field: keyof PostFormData, value: string) => void;
  optimizeSEO: (field: 'seo_title' | 'seo_description') => void;
}) {
  const titleLength = formData.seo_title?.length || formData.title.length;
  const descriptionLength =
    formData.seo_description?.length || formData.excerpt.length;
  const blogUrl = merchant?.custom_domain
    ? `https://${merchant.custom_domain.replace(/\/$/, '')}/blog/`
    : merchant?.slug
      ? `https://${getPublicRootDomain() ?? 'usebaci.com'}/${merchant.slug}/blog/`
      : '/blog/';
  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO Settings</CardTitle>
        <CardDescription>
          Optimize your post for search engines and Google Discover
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="seo_title">SEO Title</Label>
          <Input
            id="seo_title"
            placeholder={formData.title || 'Custom SEO title'}
            value={formData.seo_title}
            onChange={(event) => handleChange('seo_title', event.target.value)}
          />
          <div className="flex justify-between items-center text-xs">
            <span
              className={
                titleLength > 60
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              }
            >
              {titleLength}/60 characters (recommended)
            </span>
            {titleLength >= 50 && titleLength <= 60 && (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 hover:bg-green-100 border-none"
              >
                Optimized for SEO
              </Badge>
            )}
            {titleLength > 70 && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="animate-pulse">
                  Too Long
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => optimizeSEO('seo_title')}
                >
                  Fix for me
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="seo_description">Meta Description</Label>
          <Textarea
            id="seo_description"
            placeholder={formData.excerpt || 'Custom meta description'}
            value={formData.seo_description}
            onChange={(event) =>
              handleChange('seo_description', event.target.value)
            }
            rows={3}
          />
          <div className="flex justify-between items-center text-xs">
            <span
              className={
                descriptionLength > 150
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              }
            >
              {descriptionLength}/150 characters{' '}
              {!formData.seo_description &&
                formData.excerpt &&
                '(using excerpt)'}
            </span>
            {descriptionLength >= 120 && descriptionLength <= 150 && (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 hover:bg-green-100 border-none"
              >
                Optimized for Google/Social
              </Badge>
            )}
            {descriptionLength > 160 && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="animate-pulse">
                  Exceeds Limit
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => optimizeSEO('seo_description')}
                >
                  Fix for me
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="focus_keyword">Focus Keyword</Label>
          <Input
            id="focus_keyword"
            placeholder="Primary keyword to target"
            value={formData.focus_keyword}
            onChange={(event) =>
              handleChange('focus_keyword', event.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="keywords">SEO Keywords</Label>
          <Input
            id="keywords"
            placeholder="Separate keywords with commas"
            value={formData.keywords}
            onChange={(event) => handleChange('keywords', event.target.value)}
          />
        </div>
        <div className="pt-4 border-t">
          <Label className="mb-2 block">Search Preview</Label>
          <div className="p-4 bg-white dark:bg-slate-950 rounded-lg border">
            <div className="text-blue-600 dark:text-blue-400 text-lg hover:underline cursor-pointer truncate">
              {formData.seo_title || formData.title || 'Post Title'}
            </div>
            <div className="text-green-700 dark:text-green-500 text-sm">
              {blogUrl}
              {formData.slug || 'post-slug'}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-2">
              {formData.seo_description ||
                formData.excerpt ||
                'Post description will appear here...'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
