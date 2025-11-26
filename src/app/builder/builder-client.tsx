'use client';

import { Puck, Data, Drawer, DefaultComponentProps } from '@measured/puck';
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
import { InlineContextMenu } from '@/components/builder/inline-context-menu';
import { defaultTheme, ThemeConfiguration } from '@/lib/theme-config';
import { applyTheme } from '@/lib/theme-manager';
import { ThemeEditor } from '@/components/builder/theme-editor-redesigned';
import { BuilderSidebar } from '@/components/builder/builder-sidebar';
import { SEOPanel, SEOData } from '@/components/builder/seo-panel';
import { StoreSettingsPanel, StoreSettings } from '@/components/builder/store-settings-panel';
import { SetupPanel, SetupSettings } from '@/components/builder/setup-panel';
import { MediaLibrary } from '@/components/builder/media-library';
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
    const [viewportWidth, setViewportWidth] = useState<string | number>('100%');
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
    const [showFieldsSidebar, setShowFieldsSidebar] = useState(false);
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

    const handleDataChange = (newData: Data) => {
        // Ensure all components have unique IDs
        if (newData.content) {
            newData.content = newData.content.map((component, index) => {
                const props = component.props as DefaultComponentProps;
                if (!props?.id) {
                    return {
                        ...component,
                        props: {
                            ...props,
                            id: `${component.type}-${Date.now()}-${index}`
                        }
                    };
                }
                return component;
            });
        }
        setData(newData);
    };

    return (
        <div className="h-screen flex flex-col bg-background">
            <StorefrontProvider>
                <Puck
                    config={builderConfig}
                    data={data}
                    onPublish={handlePublish}
                    onChange={handleDataChange}
                    metadata={{
                        merchantId: merchant.id,
                        merchant: merchant,
                        products: []
                    }}
                    overrides={{
                        componentOverlay: ({ children, componentId, componentType, isSelected }: { children: React.ReactNode; componentId: string; componentType: string; isSelected: boolean }) => {
                            // Get component index to determine if it can move up/down
                            const componentIndex = data.content?.findIndex((c) => (c.props as DefaultComponentProps)?.id === componentId) ?? -1;
                            const canMoveUp = componentIndex > 0;
                            const canMoveDown = componentIndex >= 0 && componentIndex < (data.content?.length ?? 0) - 1;

                            // Position menu below for Header component or first component to avoid overlap
                            const menuPosition = (componentType === 'Header' || componentIndex === 0) ? 'bottom' : 'top';

                            return (
                                <div className="relative">
                                    {children}
                                    {isSelected && (
                                        <InlineContextMenu
                                            componentId={componentId}
                                            componentType={componentType}
                                            position={menuPosition}
                                            onEdit={() => {
                                                setShowFieldsSidebar(true);
                                            }}
                                            onDuplicate={() => {
                                                const componentToDuplicate = data.content?.find((c) => (c.props as DefaultComponentProps)?.id === componentId);
                                                if (componentToDuplicate) {
                                                    const newComponent = {
                                                        ...componentToDuplicate,
                                                        props: {
                                                            ...componentToDuplicate.props,
                                                            id: `${componentToDuplicate.type}-${Date.now()}`
                                                        }
                                                    };
                                                    const newContent = [...(data.content || [])];
                                                    newContent.splice(componentIndex + 1, 0, newComponent);
                                                    setData({ ...data, content: newContent });
                                                }
                                            }}
                                            onDelete={() => {
                                                if (confirm(`Delete this ${componentType} component?`)) {
                                                    const newContent = data.content?.filter((c) => (c.props as DefaultComponentProps)?.id !== componentId) || [];
                                                    setData({ ...data, content: newContent });
                                                }
                                            }}
                                            onMoveUp={() => {
                                                if (canMoveUp) {
                                                    const newContent = [...(data.content || [])];
                                                    [newContent[componentIndex - 1], newContent[componentIndex]] =
                                                        [newContent[componentIndex], newContent[componentIndex - 1]];
                                                    setData({ ...data, content: newContent });
                                                }
                                            }}
                                            onMoveDown={() => {
                                                if (canMoveDown) {
                                                    const newContent = [...(data.content || [])];
                                                    [newContent[componentIndex], newContent[componentIndex + 1]] =
                                                        [newContent[componentIndex + 1], newContent[componentIndex]];
                                                    setData({ ...data, content: newContent });
                                                }
                                            }}
                                            canMoveUp={canMoveUp}
                                            canMoveDown={canMoveDown}
                                        />
                                    )}
                                </div>
                            );
                        },
                        drawer: ({ children: _children }: { children: React.ReactNode }) => {
                            // Get all components from all categories (deduplicated)
                            const allComponents: string[] = [];
                            const categories = builderConfig.categories || {};
                            Object.values(categories).forEach((category) => {
                                if (category.components && Array.isArray(category.components)) {
                                    allComponents.push(...category.components);
                                }
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
                                                    {({ children: _itemChildren }) => (
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
                                        theme={(data as Data & { theme?: ThemeConfiguration })?.theme || defaultTheme}
                                        onChange={(newTheme: ThemeConfiguration) => {
                                            setData(prev => ({ ...prev, theme: newTheme } as Data & { theme: ThemeConfiguration }));
                                        }}
                                        onReset={() => {
                                            applyTheme(defaultTheme);
                                            setData(prev => ({ ...prev, theme: defaultTheme } as Data & { theme: ThemeConfiguration }));
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
                                mediaPanel={
                                    <MediaLibrary />
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

                                    /* Hide default Puck action bar and component label */
                                    .Puck-actionBar {
                                        display: none !important;
                                    }
                                    
                                    /* Hide the Puck component label button that overlaps */
                                    /* Hide the Puck component label button that overlaps */
                                    .Puck-badge,
                                    [class*="Puck-badge"],
                                    [class*="ComponentLabel"],
                                    [class*="OverlayLabel"] {
                                        display: none !important;
                                    }

                                    /* Hide ActionBar visually but keep it in DOM to prevent drag errors */
                                    [class*="ActionBar"],
                                    [class*="_ActionBar_"],
                                    [class*="_ActionBar-label_"] {
                                        opacity: 0 !important;
                                        pointer-events: none !important;
                                        height: 0 !important;
                                        width: 0 !important;
                                        overflow: hidden !important;
                                        margin: 0 !important;
                                        padding: 0 !important;
                                        min-height: 0 !important;
                                        border: none !important;
                                    }

                                    /* Improve component overlay styling */
                                    .Puck-overlay {
                                        pointer-events: none;
                                    }
                                    
                                    .Puck-overlay--isSelected {
                                        border: 2px solid hsl(var(--primary)) !important;
                                        box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1) !important;
                                    }

                                    /* Ensure inline menu is clickable */
                                    .Puck-overlay > div {
                                        pointer-events: auto;
                                    }
                                `}} />
                                <Puck.Components />
                            </BuilderSidebar>

                            <div className="flex-1 relative bg-accent/5 flex flex-col overflow-hidden">
                                {/* Viewport Controls - Above Canvas */}
                                <div className="h-12 bg-white border-b flex items-center justify-center gap-2 px-4 shrink-0">
                                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                                        <button
                                            onClick={() => setViewportWidth(375)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm ${viewportWidth === 375 ? 'bg-white shadow-sm' : 'hover:bg-white'
                                                }`}
                                            title="Mobile Portrait (375px)"
                                        >
                                            <Smartphone className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-medium">Mobile</span>
                                        </button>
                                        <button
                                            onClick={() => setViewportWidth(768)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm ${viewportWidth === 768 ? 'bg-white shadow-sm' : 'hover:bg-white'
                                                }`}
                                            title="Tablet (768px)"
                                        >
                                            <Tablet className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-medium">Tablet</span>
                                        </button>
                                        <button
                                            onClick={() => setViewportWidth('100%')}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm ${viewportWidth === '100%' ? 'bg-white shadow-sm' : 'hover:bg-white'
                                                }`}
                                            title="Desktop (1440px)"
                                        >
                                            <Monitor className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-medium">Desktop</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2">
                                    <div
                                        className="h-full bg-white shadow-sm mx-auto transition-all duration-300"
                                        style={{
                                            width: viewportWidth,
                                            maxWidth: '100%'
                                        }}
                                    >
                                        <Puck.Preview />
                                    </div>
                                </div>
                                <GeminiCommandBar onCommand={handleAiCommand} isLoading={isAiLoading} />
                            </div>

                            {/* Right Sidebar - Component Properties */}
                            {showFieldsSidebar && (
                                <div className="w-[320px] bg-white border-l flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
                                    <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                                        <h3 className="text-sm font-semibold text-gray-700">Properties</h3>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0"
                                            onClick={() => setShowFieldsSidebar(false)}
                                        >
                                            <span className="sr-only">Close</span>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </Button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                        <Puck.Fields />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Puck>
            </StorefrontProvider>
        </div>
    );
}
