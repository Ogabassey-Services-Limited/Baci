import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateSlug } from "@/lib/seo-utils";

interface SeoPreviewProps {
    title: string;
    description: string;
    slug: string;
    category?: string;
    merchantUrl?: string;
}

/**
 * Render a search engine result preview for product metadata.
 *
 * Displays a mock search result card using the provided title, description, slug, optional category, and merchant domain.
 *
 * @param title - Product title to display; falls back to "Product Title" when not provided
 * @param description - Product description to display; falls back to "Product description will appear here..." when not provided
 * @param slug - Product slug used in the preview URL; falls back to "product-slug" when not provided
 * @param category - Optional category; when provided the URL includes a slugified category segment
 * @param merchantUrl - Merchant domain shown in the preview and used to build the URL; defaults to "store.usebaci.com"
 * @returns A JSX element rendering a styled search engine preview for the supplied metadata
 */
export function SeoPreview({ title, description, slug, category, merchantUrl = "store.usebaci.com" }: SeoPreviewProps) {
    const displayTitle = title || "Product Title";
    const displayDescription = description || "Product description will appear here...";
    const productSlug = slug || "product-slug";

    // Build URL based on category availability
    const displayUrl = category
        ? `https://${merchantUrl}/${generateSlug(category)}/${productSlug}`
        : `https://${merchantUrl}/products/${productSlug}`;

    return (
        <Card className="bg-muted/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Search Engine Preview</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="bg-white p-4 rounded-md shadow-sm border max-w-[600px]">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="bg-gray-100 rounded-full p-1">
                            <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
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