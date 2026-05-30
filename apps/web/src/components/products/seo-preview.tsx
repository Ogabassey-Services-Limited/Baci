import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateSlug } from '@/lib/seo-utils';

interface SeoPreviewProps {
  title: string;
  description: string;
  slug: string;
  category?: string;
  merchantUrl?: string;
}

export function SeoPreview({
  title,
  description,
  slug,
  category,
  merchantUrl = 'store.usebaci.com',
}: SeoPreviewProps) {
  const displayTitle = title || 'Product Title';
  const displayDescription =
    description || 'Product description will appear here...';
  const productSlug = slug || 'product-slug';

  // Build URL based on category availability
  const displayUrl = category
    ? `https://${merchantUrl}/${generateSlug(category)}/${productSlug}`
    : `https://${merchantUrl}/products/${productSlug}`;

  return (
    <Card className="bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Search Engine Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-white p-4 rounded-md shadow-sm border max-w-[600px]">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-gray-100 rounded-full p-1">
              <div className="size-4 bg-gray-300 rounded-full" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-700">{merchantUrl}</span>
              <span className="text-xs text-gray-500">{displayUrl}</span>
            </div>
          </div>
          <h3 className="text-xl text-[#1a0dab] hover:underline cursor-pointer truncate font-medium">
            {displayTitle}
          </h3>
          <p className="text-sm text-[#4d5156] mt-1 line-clamp-2">
            {displayDescription}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
