'use client';

import { Logo } from '@/components/logo';
import Link from 'next/link';
import Image from 'next/image';
import { useMerchant } from '@/hooks/use-merchant';
import { ShoppingBag, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCart } from '@/hooks/use-cart';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { Cart } from '@/components/cart';
import { Button } from '@/components/ui/button';
import { ThemedButton, ThemedBadge } from '@/components/themed';
import { useStorefront } from '@/contexts/storefront-context';

/**
 * StorefrontHeader - Now fully themeable via CSS variables
 * 
 * All visual properties are controlled by the theme system:
 * - --theme-header-bg: Background color
 * - --theme-header-text: Text color
 * - --theme-header-icon: Icon color
 * - --theme-header-cart-icon: Cart icon color
 * - --theme-header-search-border: Search border color
 * - --theme-header-search-bg: Search background color
 * - --theme-header-height: Header height
 * - --theme-header-px: Horizontal padding
 * - --theme-radius-md: Border radius for search
 */
export function StorefrontHeader() {
    const { merchant } = useMerchant();
    const { cartCount } = useCart();
    const { searchQuery, setSearchQuery } = useStorefront();

    if (!merchant) return null;

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
                <div className="flex items-center gap-2 font-semibold">
                    {merchant.logo_url ? (
                        <Image src={merchant.logo_url} alt={`${merchant.business_name} logo`} width={32} height={32} className="rounded-sm object-contain" />
                    ) : (
                        <Logo />
                    )}
                    <span className="hidden sm:inline-block">{merchant.business_name}</span>
                </div>

                <div className="flex-1 flex justify-center px-4">
                    <div className="w-full max-w-md relative">
                        <Search
                            className="absolute left-2.5 top-2.5 h-4 w-4"
                            style={{ color: 'var(--theme-header-icon, #6B7280)' }}
                        />
                        <Input
                            type="search"
                            placeholder="Search products..."
                            className="w-full appearance-none pl-8 transition-all"
                            style={{
                                backgroundColor: 'var(--theme-header-search-bg, #FFFFFF)',
                                borderColor: 'var(--theme-header-search-border, #E2E8F0)',
                                borderRadius: 'var(--theme-radius-md, 0.5rem)',
                                color: 'var(--theme-header-text, #000000)',
                            }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <nav className="flex items-center gap-2 sm:gap-4">
                    <Link href="/dashboard/orders">
                        <ThemedButton colorRole="primary">My Dashboard</ThemedButton>
                    </Link>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="relative h-10 w-10">
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
