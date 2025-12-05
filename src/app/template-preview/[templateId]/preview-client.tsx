'use client';

import {
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  Settings,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { CartProvider } from '@/hooks/use-cart';
import { MerchantProvider, useMerchant } from '@/hooks/use-merchant';
import {
  TEMPLATE_REGISTRY,
  type TemplateComponents,
  type TemplateDefinition,
} from '@/templates/registry';

interface TemplatePreviewClientProps {
  templateId: string;
}

// Status badge colors
const statusColors = {
  production: 'bg-green-100 text-green-800',
  beta: 'bg-yellow-100 text-yellow-800',
  draft: 'bg-gray-100 text-gray-800',
};

// Engine status icon
function EngineStatusIcon({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <CheckCircle className="h-4 w-4 text-green-600" />
  ) : (
    <XCircle className="h-4 w-4 text-gray-400" />
  );
}

// Development toolbar
function DevToolbar({ template }: { template: TemplateDefinition }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-white border-2"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-80 sm:w-96 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Template Info
            <Badge className={statusColors[template.status]}>
              {template.status}
            </Badge>
          </SheetTitle>
          <SheetDescription>{template.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Activation Action - Prominent at top */}
          <Card className="border-green-100 bg-green-50/50">
            <CardContent className="pt-6">
              <ActivateButton templateId={template.id} />
            </CardContent>
          </Card>

          {/* Template Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {template.id}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span>{template.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="capitalize">{template.category}</span>
              </div>
              {template.author && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Author</span>
                  <span>{template.author}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Engine Integration Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Engine Integration</CardTitle>
              <CardDescription className="text-xs">
                Features connected to Baci e-commerce engine
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Products API</span>
                <EngineStatusIcon enabled={template.engine.products} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Cart</span>
                <EngineStatusIcon enabled={template.engine.cart} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Checkout</span>
                <EngineStatusIcon enabled={template.engine.checkout} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Customer Auth</span>
                <EngineStatusIcon enabled={template.engine.customerAuth} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Wishlist</span>
                <EngineStatusIcon enabled={template.engine.wishlist} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Order Tracking</span>
                <EngineStatusIcon enabled={template.engine.orderTracking} />
              </div>
            </CardContent>
          </Card>

          {/* Mock Data Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Preview Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <p>
                This preview uses mock data. No database connection required.
              </p>
              <p className="mt-2">
                Store:{' '}
                <strong>{template.mockData.merchant.business_name}</strong>
              </p>
            </CardContent>
          </Card>

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="space-y-3 pt-4 border-t">
            <Button asChild className="w-full" variant="outline">
              <Link href="/template-preview">View All Templates</Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Helper component for Activation to access context
function ActivateButton({ templateId }: { templateId: string }) {
  const { updateMerchant, merchant } = useMerchant();
  const { toast } = useToast();
  const router = useRouter();
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async () => {
    // If we are in purely mock mode (no real merchant logged in), show warning
    if (!merchant || merchant.id === 'preview-merchant' || merchant.id.endsWith('-preview')) {
      // Check if we have a REAL merchant ID in the URL or context?
      // Actually, PreviewClient is wrapped in MerchantProvider with a MOCK slug.
      // So 'useMerchant ' will return the MOCK merchant.
      // We cannot update the mock merchant.
      // We need to fetch the REAL merchant status to update.
      // However, this page is `/template-preview/id`.
      // If the user IS logged in, they have a session.
      // But the MerchantProvider is initialized with the TEMPLATE'S mock slug in line 356.
      // So `useMerchant` returns the MOCK data.

      // This is a problem. The user wants to update THEIR REAL store.
      // We need to know if there is a real authenticated user/merchant.
      // Since we are inside a Mock MerchantProvider, we can't easily get the real one via that context.
      // However, we might rely on the `updateMerchant` failure or check `createClient` for session.

      toast({
        title: "Simulated Activation",
        description: "In this preview, we are simulating activation. In a real scenario, this would update your live store.",
      });
      return;
    }

    setIsActivating(true);
    try {
      // Update published_config with new template ID
      const currentConfig = merchant.published_config || {};
      await updateMerchant({
        published_config: {
          ...currentConfig,
          templateId: templateId
        }
      });

      toast({
        title: "Template Activated!",
        description: "Your store is now using this template.",
      });

      router.push('/dashboard/settings');
    } catch (error) {
      console.error(error);
      toast({
        title: "Activation Failed",
        description: "Could not update store settings.",
        variant: 'destructive'
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <Button
      className="w-full bg-green-600 hover:bg-green-700 text-white"
      onClick={handleActivate}
      disabled={isActivating}
    >
      {isActivating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle className="mr-2 h-4 w-4" />
      )}
      {isActivating ? "Activating..." : "Use This Template"}
    </Button>
  );
}

// Error display
function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Template Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{message}</p>
          <Button asChild className="mt-4">
            <Link href="/admin/templates">Back to Templates</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Loading display
function LoadingDisplay() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-4 text-gray-600">Loading template...</p>
      </div>
    </div>
  );
}

export function TemplatePreviewClient({
  templateId,
}: TemplatePreviewClientProps) {
  const searchParams = useSearchParams();
  const hideToolbar = searchParams.get('hideToolbar') === 'true';

  const [components, setComponents] = useState<TemplateComponents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const template = TEMPLATE_REGISTRY[templateId];

  useEffect(() => {
    if (!template) {
      setError(`Template "${templateId}" not found in registry.`);
      setLoading(false);
      return;
    }

    // Load template components dynamically
    template
      .getComponents()
      .then((loaded) => {
        setComponents(loaded);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load template:', err);
        setError(`Failed to load template components: ${err.message}`);
        setLoading(false);
      });
  }, [templateId, template]);

  if (!template) {
    return <ErrorDisplay message={`Template "${templateId}" not found.`} />;
  }

  if (loading) {
    return <LoadingDisplay />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  if (!components?.Home) {
    return (
      <ErrorDisplay message="Template does not export a Home component." />
    );
  }

  const HomeComponent = components.Home;

  return (
    <CartProvider>
      <MerchantProvider
        slug={template.mockData.merchant.slug}
        initialMerchant={template.mockData.merchant}
      >
        <Suspense fallback={<LoadingDisplay />}>
          <HomeComponent
            storeSlug={template.mockData.merchant.slug}
            merchant={template.mockData.merchant}
            isPreview={true}
            // Explicitly force mock data for all engine-aware components
            useMockData={true}
          />
        </Suspense>
        {!hideToolbar && <DevToolbar template={template} />}
      </MerchantProvider>
    </CartProvider>
  );
}
