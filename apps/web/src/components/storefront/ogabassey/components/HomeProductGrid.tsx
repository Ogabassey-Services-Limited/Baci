'use client';

import dynamic from 'next/dynamic';
import type { Route } from 'next';
import Link from 'next/link';
import type React from 'react';
import { Fragment, useEffect, useState } from 'react';
import { prioritizeSmartphoneProducts } from '@baci/shared';
import { useMerchantSafe } from '@/hooks/merchant/use-merchant';
import { AD_CONFIG } from '../config/ads';
import { products as mockProducts } from '../data/products';
import { useDeferredActivation } from './deferred-shell-feature';
import type {
  ProductGridInteractionBindingsValue,
  ProductGridParticle,
} from './ProductGridInteractionBindings';
import { DeferredAdUnit } from './deferred-ad-unit';
import { HomeProductGridCard } from './HomeProductGridCard';
import type { ProductGridItemProps } from './ProductGridItem';
import type { Product } from '../types';

const DeferredFloatingParticles = dynamic(
  () => import('./FloatingParticles').then((mod) => mod.FloatingParticles),
  { loading: () => null }
);

interface ProductGridInteractionBindingsModule {
  ProductGridInteractionBindings: React.ComponentType<{
    children: (
      bindings: ProductGridInteractionBindingsValue
    ) => React.ReactNode;
  }>;
}

interface ProductGridItemModule {
  ProductGridItem: React.ComponentType<ProductGridItemProps>;
}

interface HomeProductGridProps {
  storeSlug?: string;
  products?: Product[];
  title?: string;
  showViewAll?: boolean;
  initialDisplayCount?: number;
  inlineAdBreakpoints?: number[];
  loadInteractionBindings?: () => Promise<ProductGridInteractionBindingsModule>;
  loadInteractiveCard?: () => Promise<ProductGridItemModule>;
}

const PRODUCTS_PER_PAGE = 20;
const NO_PARTICLES: ProductGridParticle[] = [];
const PRODUCT_GRID_MPU_CONFIG = AD_CONFIG.PRODUCT_GRID_MPU;

const STATIC_BINDINGS: ProductGridInteractionBindingsValue = {
  isAdded: () => false,
  getCartQuantity: () => 0,
  isWishlisted: () => false,
  onAddToCart: (event) => {
    event.preventDefault();
    event.stopPropagation();
  },
  onToggleWishlist: (event) => {
    event.preventDefault();
    event.stopPropagation();
  },
  particles: NO_PARTICLES,
};

function renderProductGridAdFallback() {
  return (
    <div
      aria-hidden="true"
      className="w-full flex justify-center items-center my-6"
    >
      <div className="flex flex-col items-center">
        <span className="text-[9px] text-gray-300 uppercase tracking-widest mb-1 self-start ml-1">
          Sponsored
        </span>
        <div
          className="relative overflow-hidden bg-gray-50 border border-gray-100 flex flex-col items-center justify-center text-center shadow-sm"
          style={{
            minHeight: `${PRODUCT_GRID_MPU_CONFIG.mobileHeight}px`,
            minWidth: `${PRODUCT_GRID_MPU_CONFIG.mobileWidth}px`,
          }}
        >
          <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-4 z-0 opacity-50 bg-[repeating-linear-gradient(45deg,#e5e7eb_0,#e5e7eb_1px,transparent_1px,transparent_10px)]">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-1">
              Ad Space
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              {PRODUCT_GRID_MPU_CONFIG.name}
            </span>
            <span className="text-[9px] text-gray-300 mt-1">
              {PRODUCT_GRID_MPU_CONFIG.width}x{PRODUCT_GRID_MPU_CONFIG.height}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeProductGrid({
  storeSlug,
  products,
  title = 'Featured Products',
  showViewAll = true,
  initialDisplayCount = 8,
  inlineAdBreakpoints = [8, 16],
  loadInteractionBindings,
  loadInteractiveCard,
}: HomeProductGridProps) {
  const [displayCount, setDisplayCount] = useState(
    Math.max(1, initialDisplayCount)
  );
  const [InteractionBindings, setInteractionBindings] = useState<
    ProductGridInteractionBindingsModule['ProductGridInteractionBindings'] | null
  >(null);
  const [InteractiveCard, setInteractiveCard] = useState<
    ProductGridItemModule['ProductGridItem'] | null
  >(null);
  const merchantContext = useMerchantSafe();
  const interactionsActivated = useDeferredActivation({
    timeoutMs: 0,
    activateOnIdle: false,
  });

  useEffect(() => {
    if (!interactionsActivated || (InteractionBindings && InteractiveCard)) {
      return;
    }

    let cancelled = false;
    const resolveBindingsModule = InteractionBindings
      ? Promise.resolve({
          ProductGridInteractionBindings: InteractionBindings,
        })
      : (
          loadInteractionBindings ??
          (() => import('./ProductGridInteractionBindings'))
        )();
    const resolveInteractiveCardModule = InteractiveCard
      ? Promise.resolve({
          ProductGridItem: InteractiveCard,
        })
      : (loadInteractiveCard ?? (() => import('./ProductGridItem')))();

    void Promise.all([
      resolveBindingsModule,
      resolveInteractiveCardModule,
    ]).then(([bindingsModule, interactiveCardModule]) => {
      if (cancelled) {
        return;
      }

      setInteractionBindings(() => bindingsModule.ProductGridInteractionBindings);
      setInteractiveCard(() => interactiveCardModule.ProductGridItem);
    });

    return () => {
      cancelled = true;
    };
  }, [
    InteractiveCard,
    InteractionBindings,
    interactionsActivated,
    loadInteractionBindings,
    loadInteractiveCard,
  ]);

  const rawBasePath =
    merchantContext?.basePath ?? (storeSlug ? `/${storeSlug}` : '');
  const normalizedBasePath = rawBasePath.trim().replace(/\/+$/, '');
  const basePath =
    normalizedBasePath && !normalizedBasePath.startsWith('/')
      ? `/${normalizedBasePath}`
      : normalizedBasePath;
  const allProductsHref = `${basePath}/products`;
  const allProducts = products && products.length > 0 ? products : mockProducts;
  const featuredProducts = prioritizeSmartphoneProducts(allProducts);
  const visibleProducts = featuredProducts.slice(0, displayCount);
  const hasMoreProducts = displayCount < featuredProducts.length;

  useEffect(() => {
    setDisplayCount(Math.max(1, initialDisplayCount));
  }, [initialDisplayCount]);

  const renderGrid = (
    bindings: ProductGridInteractionBindingsValue,
    deferInteractiveChrome: boolean
  ) => (
    <section className="max-w-[1400px] mx-auto px-3 md:px-6 py-6 md:py-8 relative">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          {title === 'Featured Products' && (
            <span className="text-(--store-primary) font-bold uppercase tracking-wider text-xs md:text-sm">
              Best Sellers
            </span>
          )}
          <h2 className="mt-1 text-xl font-bold text-white md:text-3xl">
            {title}
          </h2>
        </div>
        {showViewAll && (
          <Link
            href={allProductsHref as Route}
            prefetch={false}
            className="hidden text-xs font-medium text-white/70 transition-colors hover:text-white md:text-base sm:block"
          >
            View all products
          </Link>
        )}
      </div>

      {featuredProducts.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-gray-500 text-lg">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          {visibleProducts.map((product, index) => (
            <Fragment key={product.id}>
              {deferInteractiveChrome || !InteractiveCard ? (
                <HomeProductGridCard
                  basePath={basePath}
                  product={product}
                  deferImageLoading={index >= 2}
                />
              ) : (
                <InteractiveCard
                  basePath={basePath}
                  product={product}
                  onAddToCart={(event, selectedProduct) =>
                    bindings.onAddToCart(event, selectedProduct)
                  }
                  isAdded={bindings.isAdded(product.id)}
                  cartQuantity={bindings.getCartQuantity(product.id)}
                  viewMode="grid"
                  isWishlisted={bindings.isWishlisted(product.id)}
                  onToggleWishlist={(event) =>
                    bindings.onToggleWishlist(event, product)
                  }
                  deferInteractiveChrome={deferInteractiveChrome}
                  interactiveChromeTimeoutMs={deferInteractiveChrome ? 0 : undefined}
                  interactiveChromeActivateOnIdle={!deferInteractiveChrome}
                  deferImageLoading={index >= 2}
                />
              )}

              {inlineAdBreakpoints.includes(index + 1) && (
                <div className="col-span-2 lg:col-span-4 flex items-center justify-center my-2 md:my-4">
                  <DeferredAdUnit
                    fallback={renderProductGridAdFallback()}
                    placementKey="PRODUCT_GRID_MPU"
                    timeoutMs={1}
                  />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}

      {hasMoreProducts && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            onClick={() =>
              setDisplayCount((currentCount) => currentCount + PRODUCTS_PER_PAGE)
            }
            type="button"
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all duration-200 active:scale-95"
          >
            Load More Products
          </button>
          <span className="text-sm text-gray-500">
            Showing {visibleProducts.length} of {featuredProducts.length}{' '}
            products
          </span>
        </div>
      )}

      {bindings.particles.length > 0 && (
        <DeferredFloatingParticles particles={bindings.particles} />
      )}
    </section>
  );

  if (!InteractionBindings) {
    return renderGrid(STATIC_BINDINGS, true);
  }

  return (
    <InteractionBindings>
      {(bindings) => renderGrid(bindings, false)}
    </InteractionBindings>
  );
}
