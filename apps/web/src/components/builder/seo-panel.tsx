'use client';

import {
  AlertCircle,
  CheckCircle2,
  Code,
  Globe,
  Search,
  Share2,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

export interface SEOData {
  title: string;
  description: string;
  keywords: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  canonicalUrl?: string;
}

interface SEOPanelProps {
  seoData: SEOData;
  onChange: (data: SEOData) => void;
  pagePath?: string;
}

export function SEOPanel({ seoData, onChange, pagePath = '/' }: SEOPanelProps) {
  const [data, setData] = useState<SEOData>(seoData);

  useEffect(() => {
    setData(seoData);
  }, [seoData]);

  const handleChange = (field: keyof SEOData, value: string) => {
    const updated = { ...data, [field]: value };
    setData(updated);
    onChange(updated);
  };

  const titleLength = data.title.length;
  const descLength = data.description.length;
  const titleStatus =
    titleLength >= 50 && titleLength <= 60
      ? 'good'
      : titleLength < 50
        ? 'short'
        : 'long';
  const descStatus =
    descLength >= 150 && descLength <= 160
      ? 'good'
      : descLength < 150
        ? 'short'
        : 'long';

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold mb-1">SEO Settings</h2>
          <p className="text-sm text-muted-foreground">
            Optimize your page for search engines and social media
          </p>
        </div>

        {/* Basic SEO */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            <h3 className="font-medium">Search Engine Optimization</h3>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="seo-title">Page Title</Label>
                <Badge
                  variant={titleStatus === 'good' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {titleLength}/60
                </Badge>
              </div>
              <Input
                id="seo-title"
                value={data.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Your awesome page title"
                maxLength={70}
              />
              {titleStatus !== 'good' && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {titleStatus === 'short'
                    ? 'Title is too short. Aim for 50-60 characters.'
                    : 'Title is too long. Keep it under 60 characters.'}
                </p>
              )}
              {titleStatus === 'good' && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Perfect length!
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="seo-description">Meta Description</Label>
                <Badge
                  variant={descStatus === 'good' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {descLength}/160
                </Badge>
              </div>
              <Textarea
                id="seo-description"
                value={data.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="A compelling description of your page..."
                rows={3}
                maxLength={170}
              />
              {descStatus !== 'good' && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {descStatus === 'short'
                    ? 'Description is too short. Aim for 150-160 characters.'
                    : 'Description is too long. Keep it under 160 characters.'}
                </p>
              )}
              {descStatus === 'good' && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Perfect length!
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="seo-keywords">Keywords (comma separated)</Label>
              <Input
                id="seo-keywords"
                value={data.keywords}
                onChange={(e) => handleChange('keywords', e.target.value)}
                placeholder="e-commerce, online store, shopping"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional. Focus on 3-5 relevant keywords.
              </p>
            </div>

            <div>
              <Label htmlFor="canonical-url">Canonical URL (optional)</Label>
              <Input
                id="canonical-url"
                value={data.canonicalUrl || ''}
                onChange={(e) => handleChange('canonicalUrl', e.target.value)}
                placeholder="https://yoursite.com/page"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Prevents duplicate content issues.
              </p>
            </div>
          </div>
        </Card>

        {/* Google Search Preview */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="font-medium">Google Search Preview</h3>
          </div>
          <div className="bg-white border rounded-lg p-3 space-y-1">
            <div className="text-sm text-primary hover:underline cursor-pointer">
              {data.title || 'Your Page Title'}
            </div>
            <div className="text-xs text-green-700">yoursite.com{pagePath}</div>
            <div className="text-sm text-gray-600">
              {data.description || 'Your meta description will appear here...'}
            </div>
          </div>
        </Card>

        {/* Social Media / Open Graph */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            <h3 className="font-medium">Social Media Sharing</h3>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="og-title">Social Title (OG:Title)</Label>
              <Input
                id="og-title"
                value={data.ogTitle || ''}
                onChange={(e) => handleChange('ogTitle', e.target.value)}
                placeholder={data.title || 'Defaults to page title'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to use page title.
              </p>
            </div>

            <div>
              <Label htmlFor="og-description">
                Social Description (OG:Description)
              </Label>
              <Textarea
                id="og-description"
                value={data.ogDescription || ''}
                onChange={(e) => handleChange('ogDescription', e.target.value)}
                placeholder={data.description || 'Defaults to meta description'}
                rows={2}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to use meta description.
              </p>
            </div>

            <div>
              <Label htmlFor="og-image">Social Image URL (OG:Image)</Label>
              <Input
                id="og-image"
                value={data.ogImage || ''}
                onChange={(e) => handleChange('ogImage', e.target.value)}
                placeholder="https://yoursite.com/image.jpg"
                type="url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 1200x630px (1.91:1 ratio)
              </p>
            </div>

            <div>
              <Label htmlFor="twitter-card">Twitter Card Type</Label>
              <select
                id="twitter-card"
                value={data.twitterCard || 'summary'}
                onChange={(e) =>
                  handleChange(
                    'twitterCard',
                    e.target.value as 'summary' | 'summary_large_image'
                  )
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="summary">Summary (Square)</option>
                <option value="summary_large_image">Summary Large Image</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Social Preview */}
        {(data.ogTitle || data.title) && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-primary" />
              <h3 className="font-medium">Social Share Preview</h3>
            </div>
            <div className="border rounded-lg overflow-hidden bg-white">
              {data.ogImage && (
                <div className="aspect-[1.91/1] bg-muted relative">
                  <Image
                    src={data.ogImage}
                    alt="OG Preview"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="p-3 space-y-1">
                <div className="text-xs text-muted-foreground uppercase">
                  yoursite.com
                </div>
                <div className="font-medium text-sm">
                  {data.ogTitle || data.title}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {data.ogDescription || data.description}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Generated Meta Tags */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-primary" />
            <h3 className="font-medium">Generated Meta Tags</h3>
          </div>
          <div className="bg-muted rounded-md p-3 font-mono text-xs overflow-x-auto">
            <pre className="whitespace-pre-wrap">
              {`<title>${data.title || 'Your Page Title'}</title>
<meta name="description" content="${data.description || 'Your description'}" />
${data.keywords ? `<meta name="keywords" content="${data.keywords}" />\n` : ''}${data.canonicalUrl ? `<link rel="canonical" href="${data.canonicalUrl}" />\n` : ''}
{/* Open Graph */}
<meta property="og:title" content="${data.ogTitle || data.title || 'Your Page Title'}" />
<meta property="og:description" content="${data.ogDescription || data.description || 'Your description'}" />
${data.ogImage ? `<meta property="og:image" content="${data.ogImage}" />\n` : ''}<meta property="og:type" content="website" />

{/* Twitter */}
<meta name="twitter:card" content="${data.twitterCard || 'summary'}" />
<meta name="twitter:title" content="${data.ogTitle || data.title || 'Your Page Title'}" />
<meta name="twitter:description" content="${data.ogDescription || data.description || 'Your description'}" />
${data.ogImage ? `<meta name="twitter:image" content="${data.ogImage}" />` : ''}`}
            </pre>
          </div>
          <p className="text-xs text-muted-foreground">
            These tags will be automatically added to your page's {`<head>`}{' '}
            section.
          </p>
        </Card>

        {/* SEO Tips */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary" />
            SEO Tips
          </h4>
          <ul className="text-xs space-y-1.5 text-muted-foreground">
            <li>• Include your primary keyword in the title and description</li>
            <li>• Make titles unique and descriptive for each page</li>
            <li>• Write descriptions that encourage clicks</li>
            <li>• Use high-quality images for social sharing (1200x630px)</li>
            <li>• Keep URLs short and readable</li>
          </ul>
        </Card>
      </div>
    </ScrollArea>
  );
}
