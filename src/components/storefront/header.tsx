'use client';

import { Logo } from '@/components/logo';
import Link from 'next/link';
import Image from 'next/image';
import { useMerchant } from '@/hooks/use-merchant';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { Cart } from '@/components/cart';
import { Button } from '@/components/ui/button';
import { ThemedButton, ThemedBadge } from '@/components/themed';
import { useStorefront } from '@/contexts/storefront-context';
import { SearchAutocomplete } from './search-autocomplete';
import { useRouter } from 'next/navigation';

/**
 * Render the storefront header with a themeable appearance, search input, dashboard link, and cart trigger.
 *
 * The header's visual appearance can be customized via CSS variables:
 * - `--theme-header-bg`: Background color
 * - `--theme-header-text`: Text color
 * - `--theme-header-icon`: Icon color
 * - `--theme-header-cart-icon`: Cart icon color
 * - `--theme-header-search-border`: Search border color
 * - `--theme-header-search-bg`: Search background color
 * - `--theme-header-height`: Header height
 * - `--theme-header-px`: Horizontal padding
 * - `--theme-radius-md`: Border radius for search
 *
 * @returns The storefront header element, or `null` when no merchant is available.
 */
export function StorefrontHeader() {
    const { merchant } = useMerchant();
    const { cartCount } = useCart();
    const { searchQuery, setSearchQuery } = useStorefront();
    const router = useRouter();

    if (!merchant) return null;

    const handleProductSelect = (url: string) => {
        router.push(url);
    };

    return (
        <Sheet>
            <header
                className="px-4 lg:px-6 flex items-center gap-4 shadow-sm sticky top-0 z-50 transition-colors"
                style={{
                    backgroundColor: 'var(--theme-header-bg, #FFFFFF)',
                    height: 'var(--theme-header-height, 4rem)',
                    paddingLeft: 'var(--theme-header-px, 1rem)',
                    paddingRight: 'var(--theme-header-px, 1rem)',
                    color: 'var(--theme-header-text, #000000)',
                }}
            >
                <Link href={`/${merchant.slug}`} className="flex items-center gap-3 font-semibold shrink-0">
                    {merchant.logo_url ? (
                        <Image
                            src={merchant.logo_url}
                            alt={`${merchant.business_name} logo`}
                            width={160}
                            height={48}
                            className="h-10 sm:h-12 w-auto max-w-[140px] sm:max-w-[160px] object-contain"
                            priority
                        />
                    ) : (
                        <Logo />
                    )}
                    {!merchant.logo_url && (
                        <span className="hidden sm:inline-block">{merchant.business_name}</span>
                    )}
                </Link>

                <div className="flex-1 flex justify-center px-4">
                    <SearchAutocomplete
                        merchantId={merchant.id}
                        value={searchQuery}
                        onChange={setSearchQuery}
                        onSelectProduct={handleProductSelect}
                        placeholder="Search products..."
                        className="w-full max-w-md"
                    />
                </div>

                <nav className="flex items-center gap-2 sm:gap-4">
                    <Link href="/dashboard/orders">
                        <ThemedButton colorRole="primary">My Dashboard</ThemedButton>
                    </Link>
                    <SheetTrigger asChild>
                        {/* Touch target meets WCAG 2.5.5 minimum (44px) */}
                        <Button variant="outline" size="icon" className="relative touch-manipulation">
                            <ShoppingBag
                                className="w-5 h-5"
                                style={{ color: 'var(--theme-header-cart-icon, #000000)' }}
                            />
                            {cartCount > 0 && <ThemedBadge colorRole="accent" variant="default" className="absolute -top-1 -right-1 h-5 w-5 text-xs justify-center rounded-full p-0">{cartCount}</ThemedBadge>}
                            <span className="sr-only">Cart</span>
                        </Button>
                    </SheetTrigger>
                </nav>
            </header>
            <Cart />
        </Sheet>
    );
}