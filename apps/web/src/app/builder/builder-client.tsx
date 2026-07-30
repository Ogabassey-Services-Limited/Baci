'use client';

import {
  type Data,
  type DefaultComponentProps,
  Drawer,
  Puck,
} from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import {
  ArrowLeft,
  Box,
  Code,
  FormInput,
  GalleryHorizontal,
  Globe,
  Image as ImageIcon,
  Instagram,
  LayoutTemplate,
  List,
  Loader2,
  Mail,
  Map as MapIcon,
  Monitor,
  MousePointerClick,
  MoveVertical,
  PanelBottom,
  PanelTop,
  Quote,
  Save,
  Search,
  Share2,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tablet,
  Type,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BuilderSidebar } from '@/components/builder/builder-sidebar';
import { builderConfig } from '@/components/builder/config';
import { GeminiCommandBar } from '@/components/builder/gemini-command-bar';
import { InlineContextMenu } from '@/components/builder/inline-context-menu';
import { MediaLibrary } from '@/components/builder/media-library';
import { type SEOData, SEOPanel } from '@/components/builder/seo-panel';
import {
  SetupPanel,
  type SetupSettings,
} from '@/components/builder/setup-panel';
import {
  type StoreSettings,
  StoreSettingsPanel,
} from '@/components/builder/store-settings-panel';
import { ThemeEditor } from '@/components/builder/theme-editor-redesigned';
import { useCopilotBuilderActions } from '@/components/builder/use-copilot-builder-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { CartProvider } from '@/hooks/use-cart';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { defaultTheme, type ThemeConfiguration } from '@/lib/theme-config';
import { applyTheme } from '@/lib/theme-manager';
import type { BuilderDegradedReason } from '@/schemas/builder';
import type { BuilderPreviewMode } from './builder-client-types';
import { getDegradedBuilderDescription } from './builder-descriptions';
import { loadBuilderData } from './load-builder-data';
import { useBuilderAiDraftActions } from './use-builder-ai-draft-actions';
import { useBuilderMutationActions } from './use-builder-mutation-actions';

// Component icon mapping - using component functions for dynamic sizing
const componentIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
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

// React Compiler cannot yet lower try/finally (or throw inside try/catch)
// statements, so the async builder orchestration lives in dedicated modules
// instead of inside the component body.

export default function BuilderClient() {
  const [data, setData] = useState<Data>({
    content: [],
    root: { title: 'Home' },
    zones: {},
  });
  const [viewportWidth, setViewportWidth] = useState<string | number>('100%');
  const [seoData, setSeoData] = useState<SEOData>({
    title: '',
    description: '',
    keywords: '',
    twitterCard: 'summary_large_image',
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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [degradedReason, setDegradedReason] =
    useState<BuilderDegradedReason | null>(null);
  const [previewMode, setPreviewMode] = useState<BuilderPreviewMode>(null);
  const [aiDraftJobId, setAiDraftJobId] = useState<string | null>(null);
  const [canApplyAiDraft, setCanApplyAiDraft] = useState(false);
  const [applyingAiDraft, setApplyingAiDraft] = useState(false);
  const [showStaleAiDraftDialog, setShowStaleAiDraftDialog] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { merchant, loading: merchantLoading } = useMerchant();
  const userId = user?.id ?? null;
  const merchantId = merchant?.id ?? null;
  // Register CopilotKit actions for AI-driven component manipulation
  useCopilotBuilderActions({ data, setData });

  useEffect(() => {
    if (!authLoading && !userId) {
      router.push('/login');
    }
  }, [userId, authLoading, router]);

  // When auth + merchant have resolved but there is no user/merchant to load
  // for, stop the page loader during render (a prev-key comparison) rather than
  // synchronously inside the effect — that forces an extra render where the
  // stale loading state is briefly visible. The data-loading effect below
  // resets `pageLoading` via the module-scope loader once a fetch completes.
  const isResolvedWithoutTarget =
    !authLoading && !merchantLoading && (!userId || !merchantId);
  // Seed `false` so a first render that is already resolved-without-target
  // still triggers the loader-off transition below.
  const [prevResolvedWithoutTarget, setPrevResolvedWithoutTarget] =
    useState(false);
  if (isResolvedWithoutTarget !== prevResolvedWithoutTarget) {
    setPrevResolvedWithoutTarget(isResolvedWithoutTarget);
    if (isResolvedWithoutTarget) {
      setPageLoading(false);
    }
  }

  // Arm the page loader during render whenever the load target (user +
  // merchant) becomes available or changes, instead of re-arming it
  // synchronously inside the data-loading effect. The effect's deps include
  // object identities (`router`, `toast`), so re-arming `pageLoading` inside it
  // bails the React Compiler out of memoizing the component. The effect below
  // still owns the fetch and turns the loader off via the module-scope loader.
  const loadTargetKey =
    !authLoading && !merchantLoading && userId && merchantId
      ? `${userId}::${merchantId}`
      : null;
  const [prevLoadTargetKey, setPrevLoadTargetKey] = useState<string | null>(
    null
  );
  if (loadTargetKey !== prevLoadTargetKey) {
    setPrevLoadTargetKey(loadTargetKey);
    if (loadTargetKey) {
      setPageLoading(true);
    }
  }

  // Load initial data. The async fetch (with its try/catch/finally) lives in
  // the module-scope `loadBuilderData` helper so the React Compiler can memoize
  // this component.
  useEffect(() => {
    if (authLoading || merchantLoading) return;
    if (!userId || !merchantId) return;

    const controller = new AbortController();

    void loadBuilderData({
      merchantId,
      router,
      signal: controller.signal,
      toast,
      setData,
      setSeoData,
      setStoreSettings,
      setSetupSettings,
      setPageLoading,
      setLastUpdated,
      setCanEdit,
      setDegradedReason,
      setPreviewMode,
      setAiDraftJobId,
      setCanApplyAiDraft,
    });

    return () => {
      controller.abort();
    };
  }, [userId, merchantId, authLoading, merchantLoading, router, toast]);

  const { handlePublish, handleSave } = useBuilderMutationActions({
    canEdit,
    data,
    degradedReason,
    expectedLastUpdated: lastUpdated,
    merchantId,
    previewMode,
    seoData,
    setLastUpdated,
    setPublishing,
    setSaving,
    setupSettings,
    storeSettings,
    toast,
  });

  const { applyAiDraft, handleAiCommand } = useBuilderAiDraftActions({
    aiDraftJobId,
    canApplyAiDraft,
    canEdit,
    data,
    degradedReason,
    merchantId,
    previewMode,
    router,
    setAiDraftJobId,
    setApplyingAiDraft,
    setCanApplyAiDraft,
    setCanEdit,
    setData,
    setDegradedReason,
    setIsAiLoading,
    setLastUpdated,
    setPreviewMode,
    setShowStaleAiDraftDialog,
    toast,
  });

  if (authLoading || merchantLoading || pageLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !merchant) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Redirecting to login…</p>
      </div>
    );
  }

  const handleDataChange = (newData: Data) => {
    if (!canEdit) {
      return;
    }

    // Ensure all components have unique IDs
    if (newData.content) {
      newData.content = newData.content.map((component, index) => {
        const props = component.props as DefaultComponentProps;
        if (!props?.id) {
          return {
            ...component,
            props: {
              ...props,
              id: `${component.type}-${Date.now()}-${index}`,
            },
          };
        }
        return component;
      });
    }
    setData(newData);
  };

  const isAiDraftPreview = previewMode === 'ai_draft';
  const shouldBlockBuilder = !canEdit && !isAiDraftPreview;

  return (
    <div className="h-screen flex flex-col bg-background">
      <AlertDialog
        open={showStaleAiDraftDialog}
        onOpenChange={setShowStaleAiDraftDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your current draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Your starter draft changed after this AI design was generated.
              Replace the current starter draft with the AI design?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current draft</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowStaleAiDraftDialog(false);
                void applyAiDraft(true);
              }}
            >
              Replace draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Puck
        config={builderConfig}
        data={data}
        onPublish={handlePublish}
        onChange={handleDataChange}
        metadata={{
          merchantId: merchant.id,
          merchant: merchant,
          products: [],
        }}
        overrides={{
          componentOverlay: ({
            children,
            componentId,
            componentType,
            isSelected,
          }: {
            children: React.ReactNode;
            componentId: string;
            componentType: string;
            isSelected: boolean;
          }) => {
            // Get component index to determine if it can move up/down
            const componentIndex =
              data.content?.findIndex(
                (c) => (c.props as DefaultComponentProps)?.id === componentId
              ) ?? -1;
            const canMoveUp = componentIndex > 0;
            const canMoveDown =
              componentIndex >= 0 &&
              componentIndex < (data.content?.length ?? 0) - 1;

            // Position menu below for Header component or first component to avoid overlap
            const menuPosition =
              componentType === 'Header' || componentIndex === 0
                ? 'bottom'
                : 'top';

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
                      const componentToDuplicate = data.content?.find(
                        (c) =>
                          (c.props as DefaultComponentProps)?.id === componentId
                      );
                      if (componentToDuplicate) {
                        const newComponent = {
                          ...componentToDuplicate,
                          props: {
                            ...componentToDuplicate.props,
                            id: `${componentToDuplicate.type}-${Date.now()}`,
                          },
                        };
                        const newContent = [...(data.content || [])];
                        newContent.splice(componentIndex + 1, 0, newComponent);
                        setData({ ...data, content: newContent });
                      }
                    }}
                    onDelete={() => {
                      if (confirm(`Delete this ${componentType} component?`)) {
                        const newContent =
                          data.content?.filter(
                            (c) =>
                              (c.props as DefaultComponentProps)?.id !==
                              componentId
                          ) || [];
                        setData({ ...data, content: newContent });
                      }
                    }}
                    onMoveUp={() => {
                      if (canMoveUp) {
                        const newContent = [...(data.content || [])];
                        [
                          newContent[componentIndex - 1],
                          newContent[componentIndex],
                        ] = [
                          newContent[componentIndex],
                          newContent[componentIndex - 1],
                        ];
                        setData({ ...data, content: newContent });
                      }
                    }}
                    onMoveDown={() => {
                      if (canMoveDown) {
                        const newContent = [...(data.content || [])];
                        [
                          newContent[componentIndex],
                          newContent[componentIndex + 1],
                        ] = [
                          newContent[componentIndex + 1],
                          newContent[componentIndex],
                        ];
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
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '1rem',
                  }}
                >
                  Drag and drop elements anywhere on your page
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.75rem',
                    width: '100%',
                  }}
                >
                  {uniqueComponents.map((componentName, index) => {
                    const IconComponent = componentIcons[componentName] || Box;
                    return (
                      <Drawer.Item
                        // biome-ignore lint/suspicious/noArrayIndexKey: List is static
                        key={`${componentName}-${index}`}
                        name={componentName}
                      >
                        {({ children: _itemChildren }) => (
                          <div
                            style={{
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
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                color: '#9ca3af',
                                marginBottom: '0.5rem',
                              }}
                            >
                              <IconComponent className="size-8" />
                            </div>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 400,
                                color: '#6b7280',
                                textAlign: 'center',
                                lineHeight: '1.2',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                width: '100%',
                              }}
                            >
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
          <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur-sm z-10 shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild className="size-9">
                <Link href="/dashboard">
                  <ArrowLeft className="size-4" />
                  <span className="sr-only">Back to Dashboard</span>
                </Link>
              </Button>
              <div className="flex items-center gap-2 ml-2">
                <span className="font-semibold text-lg">Website Builder</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!canEdit && (
                <div
                  className={`hidden md:flex rounded-full border px-3 py-1 text-xs font-medium ${
                    isAiDraftPreview
                      ? 'border-sky-300 bg-sky-50 text-sky-800'
                      : 'border-amber-300 bg-amber-50 text-amber-800'
                  }`}
                >
                  {isAiDraftPreview
                    ? 'AI draft preview'
                    : 'Read-only recovery mode'}
                </div>
              )}
              {isAiDraftPreview && canApplyAiDraft && (
                <Button
                  size="sm"
                  onClick={() => applyAiDraft()}
                  disabled={applyingAiDraft}
                  className="h-9"
                >
                  {applyingAiDraft ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Apply AI design</span>
                </Button>
              )}
              {!isAiDraftPreview && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => data && handleSave(data)}
                    disabled={saving || publishing || !canEdit}
                    className="h-9"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Save Draft</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={handlePublish}
                    disabled={saving || publishing || !canEdit}
                    className="h-9"
                  >
                    {publishing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Globe className="size-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Publish</span>
                  </Button>
                </>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-hidden flex relative">
            <div
              className={`flex flex-1 overflow-hidden ${
                shouldBlockBuilder
                  ? 'pointer-events-none opacity-60 select-none'
                  : ''
              }`}
            >
              <BuilderSidebar
                themeEditor={
                  <ThemeEditor
                    theme={
                      (data as Data & { theme?: ThemeConfiguration })?.theme ||
                      defaultTheme
                    }
                    onChange={(newTheme: ThemeConfiguration) => {
                      setData(
                        (prev) =>
                          ({ ...prev, theme: newTheme }) as Data & {
                            theme: ThemeConfiguration;
                          }
                      );
                    }}
                    onReset={() => {
                      applyTheme(defaultTheme);
                      setData(
                        (prev) =>
                          ({ ...prev, theme: defaultTheme }) as Data & {
                            theme: ThemeConfiguration;
                          }
                      );
                    }}
                  />
                }
                aiTools={
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-linear-to-br from-purple-50 to-blue-50 border-purple-200">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="size-4 text-purple-600" />
                        Gemini AI Assistant
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Describe what you want to change and Gemini will update
                        your website instantly.
                      </p>
                      <GeminiCommandBar
                        onCommand={handleAiCommand}
                        isLoading={isAiLoading}
                        compact={true}
                        disabled={!canEdit}
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
                mediaPanel={<MediaLibrary />}
              >
                <style>
                  {`
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
                                `}
                </style>
                <Puck.Components />
              </BuilderSidebar>

              <div className="flex-1 relative bg-accent/5 flex flex-col overflow-hidden">
                {isAiDraftPreview && (
                  <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
                    AI draft preview. Review the design before applying it to
                    your editable store draft.
                  </div>
                )}
                {/* Viewport Controls - Above Canvas */}
                <div className="h-12 bg-white border-b flex items-center justify-center gap-2 px-4 shrink-0">
                  <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                    {[
                      { width: 375, label: 'Mobile', Icon: Smartphone },
                      { width: 768, label: 'Tablet', Icon: Tablet },
                      { width: 1200, label: 'Desktop', Icon: Monitor },
                    ].map(({ width, label, Icon }) => (
                      <button
                        key={width}
                        type="button"
                        onClick={() => setViewportWidth(width)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm ${
                          viewportWidth === width
                            ? 'bg-white shadow-sm'
                            : 'hover:bg-white'
                        }`}
                        title={`${label} (${width}px)`}
                      >
                        <Icon className="size-4 text-primary" />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  <div
                    className="h-full bg-white shadow-sm mx-auto transition-all duration-300"
                    style={{
                      width: viewportWidth,
                      maxWidth: '100%',
                    }}
                  >
                    <CartProvider>
                      <Puck.Preview />
                    </CartProvider>
                  </div>
                </div>
                <GeminiCommandBar
                  onCommand={handleAiCommand}
                  isLoading={isAiLoading}
                  disabled={!canEdit}
                />
              </div>

              {/* Right Sidebar - Component Properties */}
              {showFieldsSidebar && (
                <div className="w-[320px] bg-white border-l flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
                  <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Properties
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0"
                      onClick={() => setShowFieldsSidebar(false)}
                    >
                      <span className="sr-only">Close</span>
                      <svg
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <Puck.Fields />
                  </div>
                </div>
              )}
            </div>

            {shouldBlockBuilder && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/65 backdrop-blur-xs">
                <div className="max-w-md rounded-xl border bg-background p-6 text-center shadow-lg">
                  <h2 className="text-lg font-semibold">
                    Builder is in read-only mode
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {getDegradedBuilderDescription(degradedReason)}
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => window.location.reload()}
                  >
                    Reload Builder
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Puck>
    </div>
  );
}
