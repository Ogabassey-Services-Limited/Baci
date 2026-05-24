'use client';

import { AlertCircle, CheckCircle, Info, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { MerchantProvider } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
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

// Fixed action bar at bottom
function PreviewActionBar({ template }: { template: TemplateDefinition }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-xs border-t border-border shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Badge className={statusColors[template.status]}>
            {template.status}
          </Badge>
          <div className="truncate">
            <h3 className="font-semibold text-sm truncate">{template.name}</h3>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              {template.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ActivateButton templateId={template.id} />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Info className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <TemplateInfoSheet template={template} />
          </Sheet>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/templates">
              <XCircle className="h-4 w-4 mr-1" />
              Close
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// Template info sheet content
function TemplateInfoSheet({ template }: { template: TemplateDefinition }) {
  return (
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
            <p>This preview uses mock data. No database connection required.</p>
            <p className="mt-2">
              Store: <strong>{template.mockData.merchant.business_name}</strong>
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
            <Link href="/dashboard/templates">Back to Templates</Link>
          </Button>
        </div>
      </div>
    </SheetContent>
  );
}

// Helper component for Activation - bypasses mock context to use real session
function ActivateButton({ templateId }: { templateId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isActivating, setIsActivating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check for real authenticated session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.user);
    };
    checkAuth();
  }, []);

  const handleActivate = async () => {
    setIsActivating(true);

    try {
      // Import Supabase client directly to bypass mock MerchantProvider context
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      // Check for real authenticated user
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        toast({
          title: 'Login Required',
          description:
            'Please log in to activate this template for your store.',
          variant: 'destructive',
        });
        const loginUrl = `/login?redirect=/template-preview/${templateId}`;
        router.push(loginUrl as '/login');
        return;
      }

      // Fetch the real merchant for this user
      const { data: realMerchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id, template_id')
        .eq('user_id', session.user.id)
        .single();

      if (merchantError || !realMerchant) {
        toast({
          title: 'No Store Found',
          description:
            'You need to create a store first before selecting a template.',
          variant: 'destructive',
        });
        router.push('/onboarding');
        return;
      }

      // Update the merchant's template_id
      const { error: updateError } = await supabase
        .from('merchants')
        .update({ template_id: templateId })
        .eq('id', realMerchant.id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: 'Template Activated!',
        description: 'Your store is now using this template.',
      });

      router.push('/dashboard/settings');
    } catch (error) {
      console.error('Template activation error:', error);
      toast({
        title: 'Activation Failed',
        description: 'Could not update store settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsActivating(false);
    }
  };

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <Button className="w-full" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Checking...
      </Button>
    );
  }

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
      {isActivating
        ? 'Activating...'
        : isAuthenticated
          ? 'Use This Template'
          : 'Login to Use Template'}
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
        <div className="pb-16">
          {' '}
          {/* Add padding for fixed action bar */}
          <Suspense fallback={<LoadingDisplay />}>
            <HomeComponent
              storeSlug={template.mockData.merchant.slug}
              isPreview={true}
            />
          </Suspense>
        </div>
        <PreviewActionBar template={template} />
      </MerchantProvider>
    </CartProvider>
  );
}
