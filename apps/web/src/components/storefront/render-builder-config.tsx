'use client';

import { type Data, Render } from '@puckeditor/core';
import type { CSSProperties, ReactNode } from 'react';
import { builderConfig } from '@/components/builder/config';
import { StorefrontProvider } from '@/contexts/storefront-context';
import { CartContext } from '@/hooks/cart/cart-context';
import type { CartContextType } from '@/hooks/cart/cart-types';
import { MerchantContext } from '@/hooks/merchant/merchant-context';
import type { MerchantContextType, MerchantData } from '@/hooks/merchant/types';
import { getCuratedThemeTokenProjection } from '@/lib/storefront-defaults/curated-theme-token-projection';
import { defaultTheme, type ThemeConfiguration } from '@/lib/theme-config';

type PreviewMerchantContext = {
  basePath: string;
  id: string;
  slug: string;
};

type DeepPartial<T> = {
  [Key in keyof T]?: T[Key] extends object ? DeepPartial<T[Key]> : T[Key];
};

type BuilderPreviewConfig = {
  content: unknown[];
  root: unknown;
  theme?: DeepPartial<ThemeConfiguration>;
  zones?: Record<string, unknown>;
};

type RenderBuilderConfigProps = {
  config: BuilderPreviewConfig;
  merchantContext: PreviewMerchantContext;
};

const previewCart: CartContextType = {
  addToCart: () => undefined,
  cart: [],
  cartCount: 0,
  cartTotal: 0,
  clearCart: () => undefined,
  dismissUpsell: () => undefined,
  hasSmartCartPro: false,
  isCartOpen: false,
  isHydrated: true,
  lastAddedProduct: null,
  merchantSlug: 'preview-store',
  removeFromCart: () => undefined,
  setIsCartOpen: () => undefined,
  setMerchantSlug: () => undefined,
  showUpsell: false,
  subtotal: 0,
  totalItems: 0,
  updateQuantity: () => undefined,
};

function isThemeObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTheme(
  fallback: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fallback).map(([key, value]) => {
      const candidate = override[key];
      if (isThemeObject(value) && isThemeObject(candidate))
        return [key, normalizeTheme(value, candidate)];
      return [key, typeof candidate === typeof value ? candidate : value];
    })
  );
}

function getPreviewTheme(config: BuilderPreviewConfig): ThemeConfiguration {
  const theme = config.theme;
  if (!isThemeObject(theme)) return defaultTheme;
  return normalizeTheme(
    defaultTheme as unknown as Record<string, unknown>,
    theme as Record<string, unknown>
  ) as unknown as ThemeConfiguration;
}

function markHeaderBlocksAsPreview(config: BuilderPreviewConfig): Data {
  return {
    ...config,
    content: config.content.map((block) => {
      if (
        typeof block !== 'object' ||
        block === null ||
        !Object.hasOwn(block, 'type') ||
        !Object.hasOwn(block, 'props')
      ) {
        return block;
      }
      const candidate = block as { props: unknown; type: unknown };
      if (
        candidate.type !== 'Header' ||
        typeof candidate.props !== 'object' ||
        candidate.props === null
      )
        return block;
      return {
        ...block,
        props: { ...candidate.props, isPreview: true },
      };
    }),
  } as Data;
}

function getPreviewMerchant(context: PreviewMerchantContext): MerchantData {
  return {
    business_name: 'Preview Store',
    business_type: 'other',
    id: `preview-${context.id}-preview`,
    slug: 'preview-store',
    user_id: 'preview-user',
  };
}

function getPreviewMerchantContext(
  context: PreviewMerchantContext
): MerchantContextType {
  return {
    basePath: context.basePath,
    hasPermission: () => false,
    loading: false,
    merchant: getPreviewMerchant(context),
    navigationCategories: [],
    reloadMerchant: () => undefined,
    routingMode: 'path',
    staffAccess: {
      isOwner: false,
      isStaff: false,
      permissions: {},
      role: null,
    },
    updateMerchant: async () => undefined,
  };
}

function PreviewContext({
  children,
  merchantContext,
}: {
  children: ReactNode;
  merchantContext: PreviewMerchantContext;
}) {
  return (
    <MerchantContext.Provider
      value={getPreviewMerchantContext(merchantContext)}
    >
      <CartContext.Provider value={previewCart}>
        <StorefrontProvider>{children}</StorefrontProvider>
      </CartContext.Provider>
    </MerchantContext.Provider>
  );
}

export function RenderBuilderConfig({
  config,
  merchantContext,
}: RenderBuilderConfigProps) {
  const theme = getPreviewTheme(config);
  const previewConfig = markHeaderBlocksAsPreview(config);
  return (
    <PreviewContext merchantContext={merchantContext}>
      <div
        data-base-path={merchantContext.basePath}
        data-testid="builder-preview-surface"
        style={getCuratedThemeTokenProjection(theme) as CSSProperties}
      >
        <Render config={builderConfig} data={previewConfig} />
      </div>
    </PreviewContext>
  );
}
