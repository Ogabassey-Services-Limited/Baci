'use client';

import { Puck, Data, Drawer } from '@measured/puck';
import '@measured/puck/puck.css';
import { builderConfig } from '@/components/builder/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import {
    Loader2, Save, Globe, ArrowLeft, Smartphone, Tablet, Monitor,
    LayoutTemplate, GalleryHorizontal, Type, Image as ImageIcon,
    MousePointerClick, ShoppingBag, Quote, List, Mail,
    MoveVertical, PanelBottom, PanelTop, Box,
    Video, Map as MapIcon, Instagram, FormInput, Share2, Code, Search, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { StorefrontProvider } from '@/contexts/storefront-context';
import { useRouter } from 'next/navigation';
import { GeminiCommandBar } from '@/components/builder/gemini-command-bar';
import { defaultTheme, ThemeConfiguration } from '@/lib/theme-config';
import { applyTheme } from '@/lib/theme-manager';
import { ThemeEditor } from '@/components/builder/theme-editor-redesigned';
import { BuilderSidebar } from '@/components/builder/builder-sidebar';
import { SEOPanel, SEOData } from '@/components/builder/seo-panel';
import { StoreSettingsPanel, StoreSettings } from '@/components/builder/store-settings-panel';
import { SetupPanel, SetupSettings } from '@/components/builder/setup-panel';
import { useAuth } from '@/contexts/auth-context';
import { useMerchant } from '@/hooks/use-merchant';

// Component icon mapping - using component functions for dynamic sizing
const componentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    Hero: LayoutTemplate,
    HeroCarousel: GalleryHorizontal,
    Text: Type,
    Image: ImageIcon,
    Button: MousePointerClick,
    ProductGrid: ShoppingBag,
    Testimonial: Quote,
    Features: List,
    Newsletter: Mail,
    Spacer: MoveVertical,
    Footer: PanelBottom,
    Header: PanelTop,
    Video: Video,
    Map: MapIcon,
    InstagramFeed: Instagram,
    ContactForm: FormInput,
    SocialIcons: Share2,
    CodeEmbed: Code,
    Search: Search,
};

export default function BuilderClient() {
    const [data, setData] = useState<Data>({ content: [], root: { title: 'Home' }, zones: {} });
    const [seoData, setSeoData] = useState<SEOData>({
        title: '',
        description: '',
        keywords: '',
        twitterCard: 'summary_large_image'
    });
    const [storeSettings, setStoreSettings] = useState<StoreSettings>({
        productPage: {
            layout: 'standard',
            showRelatedProducts: true,
            showReviews: true,
            showShareButtons: true,
            imageGalleryStyle: 'thumbnails',
            enableZoom: true,
            showInventory: true,
        },
        cart: {
            enableCartDrawer: true,
            showShippingEstimate: true,
            showProgressBar: false,
            enableGiftMessage: false,
            enableDiscountCodes: true,
        },
        checkout: {
            enableGuestCheckout: true,
            requirePhoneNumber: false,
            showOrderNotes: true,
            showNewsletterSignup: true,
            enableExpressCheckout: true,
        },
        shipping: {
            showEstimatedDelivery: true,
            defaultShippingMessage: 'Free shipping on orders over $50',
            internationalShipping: false,
        },
        policies: {
            returnPolicy: '',
            shippingPolicy: '',
            privacyPolicy: '',
        },
    });
    const [setupSettings, setSetupSettings] = useState<SetupSettings>({
        site: {
            title: 'My Store',
            tagline: 'Premium products at affordable prices',
            currency: 'USD',
            timezone: 'America/New_York',
            language: 'en',
            units: 'imperial',
        },
        social: {},
        analytics: {},
        customCode: {},
    });
    const [pageLoading, setPageLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { merchant, loading: merchantLoading } = useMerchant();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            if (authLoading || merchantLoading) return;
            if (!user || !merchant) {
                setPageLoading(false);
                return;
            }

            try {
                const res = await fetch('/api/builder?slug=home');

                if (!res.ok) {
                    if (res.status === 401) {
                        router.push('/login');
                        return;
                    }
                    throw new Error(`API error: ${res.status}`);
                }

                const json = await res.json();
                console.log('BuilderClient: Fetched JSON:', json);

                if (json.config) {
                    console.log('BuilderClient: Setting data from config:', json.config);
                    setData(json.config);

                    // Load SEO data if it exists
                    if (json.seo) {
                        setSeoData(json.seo);
                    } else {
                        // Set default SEO from page title
                        setSeoData({
                            title: json.config.root?.title || 'Home',
                            description: '',
                            keywords: '',
                            twitterCard: 'summary_large_image'
                        });
                    }

                    // Load Store Settings if they exist
                    if (json.storeSettings) {
                        setStoreSettings(json.storeSettings);
                    }

                    // Load Setup Settings if they exist
                    if (json.setupSettings) {
                        setSetupSettings(json.setupSettings);
                    }

                    if (json.config.theme) {
                        applyTheme(json.config.theme);
                    } else {
                        applyTheme(defaultTheme);
                    }
                    if (json.isDefault) {
                        toast({
                            title: 'Starting from your template',
                            description: 'We\'ve loaded your current storefront as a starting point. Customize it to make it your own!',
                        });
                    }
                } else {
                    const defaultData = {
                        content: [],
                        root: { title: 'Home' },
                        zones: {},
                        theme: defaultTheme
                    };
                    setData(defaultData);
                    applyTheme(defaultData.theme);
                }
            } catch (error) {
                console.error('Failed to load builder data:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load page configuration. Using default template.',
                    variant: 'destructive',
                });
                const defaultData = {
                    content: [],
                    root: { title: 'Home' },
                    zones: {},
                    theme: defaultTheme
                };
                setData(defaultData);
                applyTheme(defaultData.theme);
            } finally {
                setPageLoading(false);
            }
        };

        loadData();
    }, [user, merchant, authLoading, merchantLoading, router, toast]);

    const handleSave = async (newData: Data) => {
        setSaving(true);
        try {
            await fetch('/api/builder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: 'home',
                    name: 'Home',
                    config: newData,
                    seo: seoData,
                    storeSettings: storeSettings,
                    setupSettings: setupSettings
                })
            });
        } catch (error) {
            console.error('Failed to save:', error);
            toast({
                title: 'Error',
                description: 'Failed to save changes.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!data) return;

        setPublishing(true);
        await handleSave(data);

        try {
            const res = await fetch('/api/builder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: 'home' })
            });

            if (!res.ok) throw new Error('Failed to publish');

            toast({
                title: 'Published! 🚀',
                description: 'Your changes are now live on your storefront.',
            });
        } catch (error) {
            console.error('Failed to publish:', error);
            toast({
                title: 'Error',
                description: 'Failed to publish changes.',
                variant: 'destructive',
            });
        } finally {
            setPublishing(false);
        }
    };

    const handleAiCommand = async (command: string) => {
        setIsAiLoading(true);
        try {
            const response = await fetch('/api/builder/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: command,
                    currentConfig: data
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ details: 'Unknown error' }));
                throw new Error(errorData.details || 'Failed to process AI request');
            }

            const result = await response.json();

            if (result.config) {
                setData(result.config);
                if (result.config.theme) {
                    applyTheme(result.config.theme);
                }
                toast({
                    title: "✨ Design Updated",
                    description: "Gemini AI has applied your changes successfully!",
                });
            } else {
                console.warn('No config in AI response');
                toast({
                    title: "Warning",
                    description: "AI response was incomplete. Please try again.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error('Gemini AI Command Error:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to process AI command. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsAiLoading(false);
        }
    };

    if (authLoading || merchantLoading || pageLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user || !merchant) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p>Redirecting to login...</p>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-background">
            <StorefrontProvider>
                <Puck
                    config={builderConfig}
                    data={data}
                    onPublish={handlePublish}
                    onChange={setData}
                    metadata={{
                        merchantId: merchant.id,
                        merchant: merchant,
                        products: []
                    }}
                    viewports={[
                        {
                            width: 375,
                            height: 'auto',
                            label: 'Mobile Portrait',
                            icon: 'Smartphone'
                        },
                        {
                            width: 768,
                            height: 'auto',
                            label: 'Tablet',
                            icon: 'Tablet'
                        },
                        {
                            width: 1440,
                            height: 'auto',
                            label: 'Desktop',
                            icon: 'Monitor'
                        }
                    ]}
                    overrides={{
                        drawer: ({ children }: any) => {
                            // Get all components from all categories (deduplicated)
                            const allComponents: string[] = [];
                            Object.values(builderConfig.categories || {}).forEach((category: any) => {
                                allComponents.push(...(category.components || []));
                            });
                            const uniqueComponents = Array.from(new Set(allComponents));

                            return (
                                <div style={{ height: '100%', overflow: 'auto' }}>
                                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                                        Drag and drop elements anywhere on your page
                                    </p>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: '0.75rem',
                                        width: '100%'
                                    }}>
                                        {uniqueComponents.map((componentName, index) => {
                                            const IconComponent = componentIcons[componentName] || Box;
                                            return (
                                                <Drawer.Item key={`${componentName}-${index}`} name={componentName}>
                                                    {({ children: itemChildren }) => (
                                                        <div style={{
                                                            border: '1px solid #e5e7eb',
                                                            borderRadius: '0.5rem',
                                                            padding: '0.75rem',
                                                            minHeight: '80px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'grab',
                                                            transition: 'all 0.2s',
                                                            background: 'white',
                                                            overflow: 'hidden'
                                                        }}>
                                                            <div style={{ color: '#9ca3af', marginBottom: '0.5rem' }}>
                                                                <IconComponent className="w-8 h-8" />
                                                            </div>
                                                            <span style={{
                                                                fontSize: '0.7rem',
                                                                fontWeight: 400,
                                                                color: '#6b7280',
                                                                textAlign: 'center',
                                                                lineHeight: '1.2',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                width: '100%'
                                                            }}>
                                                                {componentName}
                                                            </span>
                                                        </div>
                                                    )}
                                                </Drawer.Item>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        },
                    }}
                >
                    <div className="flex flex-col h-screen bg-background">
                        <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur z-10 shrink-0">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" asChild className="h-9 w-9">
                                    <Link href="/dashboard">
                                        <ArrowLeft className="w-4 h-4" />
                                        <span className="sr-only">Back to Dashboard</span>
                                    </Link>
                                </Button>
                                <div className="flex items-center gap-2 ml-2">
                                    <span className="font-semibold text-lg">Website Builder</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSave(data!)}
                                    disabled={saving}
                                    className="h-9"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span className="ml-2 hidden sm:inline">Save Draft</span>
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handlePublish}
                                    disabled={publishing}
                                    className="h-9"
                                >
                                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                                    <span className="ml-2 hidden sm:inline">Publish</span>
                                </Button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-hidden flex">
                            <BuilderSidebar
                                themeEditor={
                                    <ThemeEditor
                                        theme={(data as any)?.theme || defaultTheme}
                                        onChange={(newTheme: ThemeConfiguration) => {
                                            setData(prev => ({ ...prev, theme: newTheme } as any));
                                        }}
                                        onReset={() => {
                                            applyTheme(defaultTheme);
                                            setData(prev => ({ ...prev, theme: defaultTheme } as any));
                                        }}
                                    />
                                }
                                aiTools={
                                    <div className="space-y-4">
                                        <div className="p-4 border rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-purple-600" />
                                                Gemini AI Assistant
                                            </h3>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Describe what you want to change and Gemini will update your website instantly.
                                            </p>
                                            <GeminiCommandBar
                                                onCommand={handleAiCommand}
                                                isLoading={isAiLoading}
                                                compact={true}
                                            />
                                        </div>
                                    </div>
                                }
                                outline={<Puck.Outline />}
                                seoPanel={
                                    <SEOPanel
                                        seoData={seoData}
                                        onChange={setSeoData}
                                        pagePath="/home"
                                    />
                                }
                                storePanel={
                                    <StoreSettingsPanel
                                        settings={storeSettings}
                                        onChange={setStoreSettings}
                                    />
                                }
                                setupPanel={
                                    <SetupPanel
                                        settings={setupSettings}
                                        onChange={setSetupSettings}
                                    />
                                }
                            >
                                <style dangerouslySetInnerHTML={{
                                    __html: `
                                    /* Hide category titles to create continuous grid */
                                    .PuckSidebarSection-title {
                                        display: none !important;
                                    }
                                    .PuckSidebarSection-breadcrumbs {
                                        display: none !important;
                                    }
                                    
                                    /* Force all component lists to use 3-column grid */
                                    .PuckComponentList {
                                        display: grid !important;
                                        grid-template-columns: repeat(3, 1fr) !important;
                                        gap: 0.75rem !important;
                                    }
                                    
                                    .PuckComponentList-item {
                                        border: 1px solid #e5e7eb;
                                        border-radius: 0.75rem;
                                        padding: 1rem;
                                        min-height: 100px;
                                        display: flex;
                                        flex-direction: column;
                                        align-items: center;
                                        justify-content: center;
                                        cursor: grab;
                                        transition: all 0.2s;
                                    }
                                    .PuckComponentList-item:hover {
                                        border-color: hsl(var(--primary));
                                        background-color: hsl(var(--primary) / 0.05);
                                    }
                                    .PuckComponentList-item svg {
                                        width: 2.5rem !important;
                                        height: 2.5rem !important;
                                        stroke-width: 1.5 !important;
                                        color: #9ca3af;
                                    }
                                    .PuckComponentList-item span {
                                        font-size: 0.75rem;
                                        font-weight: 400;
                                        color: #6b7280;
                                        margin-top: 0.625rem;
                                        text-align: center;
                                    }
                                `}} />
                                <Puck.Components />
                            </BuilderSidebar>

                            <div className="flex-1 relative bg-accent/5 flex flex-col overflow-hidden">
                                {/* Viewport Controls - Above Canvas */}
                                <div className="h-12 bg-white border-b flex items-center justify-center gap-2 px-4 shrink-0">
                                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                                        <button
                                            onClick={() => {
                                                const iframe = document.querySelector('.Puck-portal iframe') as HTMLIFrameElement;
                                                if (iframe) iframe.style.width = '375px';
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white transition-colors text-sm"
                                            title="Mobile Portrait (375px)"
                                        >
                                            <Smartphone className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-medium">Mobile</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const iframe = document.querySelector('.Puck-portal iframe') as HTMLIFrameElement;
                                                if (iframe) iframe.style.width = '768px';
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white transition-colors text-sm"
                                            title="Tablet (768px)"
                                        >
                                            <Tablet className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-medium">Tablet</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const iframe = document.querySelector('.Puck-portal iframe') as HTMLIFrameElement;
                                                if (iframe) iframe.style.width = '100%';
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white transition-colors text-sm"
                                            title="Desktop (1440px)"
                                        >
                                            <Monitor className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-medium">Desktop</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2">
                                    <div className="h-full bg-white shadow-sm mx-auto">
                                        <Puck.Preview />
                                    </div>
                                </div>
                                <GeminiCommandBar onCommand={handleAiCommand} isLoading={isAiLoading} />
                            </div>
                        </div>
                    </div>
                </Puck>
            </StorefrontProvider>
        </div>
    );
}
