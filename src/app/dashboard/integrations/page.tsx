'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useMerchant } from '@/hooks/use-merchant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function IntegrationsPage() {
    const { merchant } = useMerchant();
    const { toast } = useToast();
    const [feedValidating, setFeedValidating] = useState(false);
    const [feedStatus, setFeedStatus] = useState<'valid' | 'invalid' | null>(null);

    if (!merchant) {
        return <div>Loading...</div>;
    }

    // Generate feed URLs based on merchant's domain or subdomain
    const baseUrl = merchant.custom_domain
        ? `https://${merchant.custom_domain}`
        : `https://${merchant.slug}.baci.app`;

    const feedUrls = {
        google: `${baseUrl}/api/feed/google-merchant?merchant_slug=${merchant.slug}`,
        facebook: `${baseUrl}/api/feed/facebook?merchant_slug=${merchant.slug}`,
        tiktok: `${baseUrl}/api/feed/tiktok?merchant_slug=${merchant.slug}`,
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'Copied!',
            description: 'Feed URL copied to clipboard',
        });
    };

    const validateFeed = async (platform: 'google' | 'facebook' | 'tiktok') => {
        setFeedValidating(true);
        try {
            const response = await fetch(feedUrls[platform]);
            if (response.ok) {
                setFeedStatus('valid');
                toast({
                    title: 'Feed is valid!',
                    description: `Your ${platform} product feed is working correctly`,
                });
            } else {
                setFeedStatus('invalid');
                toast({
                    title: 'Feed validation failed',
                    description: 'There was an error fetching your product feed',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            setFeedStatus('invalid');
            toast({
                title: 'Feed validation failed',
                description: error instanceof Error ? error.message : 'Could not connect to your product feed',
                variant: 'destructive',
            });
        } finally {
            setFeedValidating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
                <p className="text-muted-foreground mt-2">
                    Connect your store to external platforms and services
                </p>
            </div>

            {/* Google Merchant Center */}
            <Card className="glass">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                Google Merchant Center
                                {feedStatus === 'valid' && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Active
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                Sync your products to Google Shopping and run product ads
                            </CardDescription>
                        </div>
                        <Image
                            src="https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png"
                            alt="Google"
                            width={32}
                            height={32}
                            className="h-8 w-8"
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <strong>What is Google Merchant Center?</strong>
                            <br />
                            It allows your products to appear in Google Shopping results and run Shopping ads.
                            Customers can see your product images, prices, and stock status directly in Google search.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="feed-url" className="text-base font-semibold">
                                Your Product Feed URL
                            </Label>
                            <p className="text-sm text-muted-foreground mb-2">
                                Copy this URL and paste it in Google Merchant Center
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Input
                                id="feed-url"
                                value={feedUrls.google}
                                readOnly
                                className="font-mono text-sm"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => copyToClipboard(feedUrls.google)}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => validateFeed('google')}
                                disabled={feedValidating}
                            >
                                <RefreshCw className={`h-4 w-4 ${feedValidating ? 'motion-safe:animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-sm">Setup Instructions:</h4>
                        <ol className="space-y-2 text-sm list-decimal list-inside">
                            <li>
                                Go to{' '}
                                <a
                                    href="https://merchants.google.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    Google Merchant Center
                                    <ExternalLink className="h-3 w-3" />
                                </a>{' '}
                                and sign in with your Google account
                            </li>
                            <li>Click on <strong>Products</strong> in the left menu</li>
                            <li>Click on <strong>Feeds</strong></li>
                            <li>Click the <strong>+</strong> button to add a new feed</li>
                            <li>
                                Select your <strong>Country of sale</strong> and <strong>Language</strong>
                            </li>
                            <li>Choose <strong>"Scheduled fetch"</strong> as the input method</li>
                            <li>Paste your feed URL from above</li>
                            <li>Set fetch frequency to <strong>"Daily"</strong></li>
                            <li>Click <strong>Create feed</strong></li>
                        </ol>
                    </div>

                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Important:</strong> After setting up the feed in Google Merchant Center,
                            it may take 3-5 days for Google to review and approve your products. Make sure your
                            products have proper titles, descriptions, images, and GTINs (if applicable).
                        </AlertDescription>
                    </Alert>

                    <div className="pt-4 border-t">
                        <h4 className="font-semibold text-sm mb-3">Feed includes:</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Product titles & descriptions
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Pricing & availability
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Product images
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Brand & condition
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                GTINs & MPNs
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Shipping weights
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Facebook & Instagram */}
            <Card className="glass">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle>Facebook & Instagram Shopping</CardTitle>
                            <CardDescription>
                                Sell products directly on Facebook and Instagram
                            </CardDescription>
                        </div>
                        <svg className="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Facebook Shops and Instagram Shopping let customers browse and purchase products directly on social media.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="facebook-feed-url" className="text-base font-semibold">
                                Your Product Catalog Feed URL
                            </Label>
                            <p className="text-sm text-muted-foreground mb-2">
                                Use this feed in Facebook Commerce Manager
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Input
                                id="facebook-feed-url"
                                value={feedUrls.facebook}
                                readOnly
                                className="font-mono text-sm"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => copyToClipboard(feedUrls.facebook)}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => validateFeed('facebook')}
                                disabled={feedValidating}
                            >
                                <RefreshCw className={`h-4 w-4 ${feedValidating ? 'motion-safe:animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-sm">Setup Instructions:</h4>
                        <ol className="space-y-2 text-sm list-decimal list-inside">
                            <li>
                                Go to{' '}
                                <a
                                    href="https://business.facebook.com/commerce"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    Facebook Commerce Manager
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </li>
                            <li>Click <strong>Catalog</strong> in the left menu</li>
                            <li>Click <strong>Add Items</strong> → <strong>Use Data Feed</strong></li>
                            <li>Choose <strong>Scheduled fetch</strong></li>
                            <li>Paste your feed URL from above</li>
                            <li>Set schedule to <strong>Daily</strong></li>
                            <li>Click <strong>Upload</strong></li>
                        </ol>
                    </div>
                </CardContent>
            </Card>

            {/* TikTok Shopping */}
            <Card className="glass">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle>TikTok Shopping</CardTitle>
                            <CardDescription>
                                Sell products through TikTok Shop and TikTok Ads
                            </CardDescription>
                        </div>
                        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" fill="currentColor"/>
                        </svg>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            TikTok Shopping allows you to showcase products in videos and run shoppable ads to reach younger audiences.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="tiktok-feed-url" className="text-base font-semibold">
                                Your Product Catalog Feed URL
                            </Label>
                            <p className="text-sm text-muted-foreground mb-2">
                                Use this feed in TikTok Seller Center
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Input
                                id="tiktok-feed-url"
                                value={feedUrls.tiktok}
                                readOnly
                                className="font-mono text-sm"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => copyToClipboard(feedUrls.tiktok)}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => validateFeed('tiktok')}
                                disabled={feedValidating}
                            >
                                <RefreshCw className={`h-4 w-4 ${feedValidating ? 'motion-safe:animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-sm">Setup Instructions:</h4>
                        <ol className="space-y-2 text-sm list-decimal list-inside">
                            <li>
                                Go to{' '}
                                <a
                                    href="https://seller.tiktok.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    TikTok Seller Center
                                    <ExternalLink className="h-3 w-3" />
                                </a>{' '}
                                (or TikTok Ads Manager for ads)
                            </li>
                            <li>Navigate to <strong>Products</strong> → <strong>Product Catalog</strong></li>
                            <li>Click <strong>Add Data Source</strong></li>
                            <li>Select <strong>Data Feed</strong></li>
                            <li>Paste your feed URL from above</li>
                            <li>Set update frequency to <strong>Daily</strong></li>
                            <li>Click <strong>Submit</strong></li>
                        </ol>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
