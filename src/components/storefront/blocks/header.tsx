'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useMerchant } from '@/hooks/use-merchant';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { Cart } from '@/components/cart';
import { LoyaltyBadge } from '@/components/storefront/loyalty/loyalty-badge';
import { Search, ShoppingBag, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemedButton } from '@/components/themed';
import { asRoute } from '@/lib/routes';

export interface HeaderProps {
    showLogo?: boolean;
    showSearch?: boolean;
    showCart?: boolean;
    showMenu?: boolean;
    navigationLinks?: { label: string; url: string }[];
    ctaButton?: {
        text: string;
        url: string;
        show: boolean;
    };
    backgroundColor?: string;
    textColor?: string;
    sticky?: boolean;
    logoUrl?: string;
    storeName?: string;
    layout?: 'logo-left-nav-center' | 'logo-left-nav-right' | 'logo-center';
    searchStyle?: 'outline' | 'filled' | 'minimal';
    searchRadius?: 'none' | 'sm' | 'md' | 'full';
    paddingY?: 'sm' | 'md' | 'lg';
    glassEffect?: boolean;
    backgroundImage?: string;
}

export function Header({
    showLogo = true,
    showSearch = true,
    showCart = true,
    showMenu = true,
    navigationLinks = [],
    ctaButton,
    backgroundColor,
    textColor,
    sticky = true,
    logoUrl,
    storeName,
    layout = 'logo-left-nav-center',
    searchStyle = 'outline',
    searchRadius = 'full',
    paddingY = 'md',
    glassEffect = true,
    backgroundImage
}: HeaderProps) {
    const { merchant } = useMerchant();
    const { cartCount } = useCart();
    const { user } = useAuth();
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Use merchant data if props are missing (fallback for template usage)
    const finalLogoUrl = logoUrl || merchant?.logo_url;
    const finalStoreName = storeName || merchant?.business_name || 'Store';

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const paddingClasses = {
        sm: 'py-2',
        md: 'py-4',
        lg: 'py-6'
    };

    const searchClasses = {
        outline: 'bg-transparent border-input',
        filled: 'bg-muted border-transparent',
        minimal: 'bg-transparent border-transparent border-b border-input rounded-none px-0'
    };

    const radiusClasses = {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        full: 'rounded-full'
    };

    // Determine effective text color based on scroll state and glass effect
    const effectiveTextColor = isScrolled || !glassEffect ? (textColor || 'inherit') : 'white';
    const effectiveBgColor = isScrolled
        ? (glassEffect ? 'rgba(255, 255, 255, 0.8)' : (backgroundColor || 'white'))
        : (glassEffect ? 'transparent' : (backgroundColor || 'white'));

    return (
        <Sheet>
            <header
                className={cn(
                    "w-full z-50 transition-all duration-300 px-4 md:px-8 overflow-hidden",
                    sticky ? "fixed top-0 left-0 right-0" : "relative",
                    isScrolled && glassEffect ? "backdrop-blur-md shadow-sm" : "",
                    paddingClasses[paddingY]
                )}
                style={{
                    backgroundColor: effectiveBgColor,
                    color: effectiveTextColor
                }}
            >
                {/* Background Image Pattern */}
                {backgroundImage && (
                    <div
                        className="absolute inset-0 z-[-1] opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: `url(${backgroundImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                        }}
                    />
                )}
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    {/* Logo Section */}
                    {showLogo && (
                        <Link href="/" className={cn("flex items-center gap-2 group shrink-0", {
                            "order-1": layout !== 'logo-center',
                            "order-2 mx-auto": layout === 'logo-center'
                        })}>
                            {finalLogoUrl ? (
                                <Image
                                    src={finalLogoUrl}
                                    alt={finalStoreName}
                                    width={40}
                                    height={40}
                                    className="rounded-full object-cover ring-2 ring-white/50 shadow-sm transition-transform group-hover:scale-105"
                                />
                            ) : (
                                <Logo className="transition-transform group-hover:scale-105" />
                            )}
                            <span className={cn("font-bold text-xl tracking-tight transition-colors")}>
                                {finalStoreName}
                            </span>
                        </Link>
                    )}

                    {/* Desktop Navigation */}
                    {showMenu && navigationLinks.length > 0 && (
                        <nav className={cn("hidden md:flex items-center gap-6", {
                            "order-2 mx-auto": layout === 'logo-left-nav-center',
                            "order-2 ml-auto mr-4": layout === 'logo-left-nav-right',
                            "order-1 mr-auto": layout === 'logo-center'
                        })}>
                            {navigationLinks.map((link, index) => (
                                <Link
                                    key={index}
                                    href={asRoute(link.url)}
                                    className="text-sm font-medium hover:opacity-70 transition-opacity"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                    )}

                    {/* Search Bar (Desktop) */}
                    {showSearch && (
                        <div className={cn("hidden md:block relative max-w-xs w-full", {
                            "order-3": true,
                            "ml-auto": layout === 'logo-left-nav-center'
                        })}>
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 group-focus-within:opacity-100 transition-opacity" />
                                <Input
                                    type="search"
                                    placeholder="Search..."
                                    className={cn(
                                        "pl-9 transition-all focus-visible:ring-1",
                                        searchClasses[searchStyle],
                                        radiusClasses[searchRadius],
                                        glassEffect && !isScrolled ? "bg-white/10 border-white/20 text-white placeholder:text-white/70" : ""
                                    )}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Actions (Cart, Mobile Menu, CTA) */}
                    <div className={cn("flex items-center gap-3 shrink-0", {
                        "order-4 ml-auto": true
                    })}>
                        {ctaButton?.show && ctaButton.text && (
                            <ThemedButton asChild colorRole="primary" size="sm" className="hidden sm:inline-flex rounded-full">
                                <Link href={asRoute(ctaButton.url)}>{ctaButton.text}</Link>
                            </ThemedButton>
                        )}

                        {showSearch && (
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Search className="w-5 h-5" />
                            </Button>
                        )}

                        {/* Loyalty Badge - shows when user is logged in and enrolled */}
                        {user && merchant?.id && (
                            <LoyaltyBadge
                                merchantId={merchant.id}
                                customerId={user.id}
                                compact
                                className="hidden sm:flex"
                                rewardsHref="/pages/rewards"
                            />
                        )}

                        {showCart && (
                            <SheetTrigger asChild>
                                <button className="relative p-2 hover:bg-black/5 rounded-full transition-colors group">
                                    <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    {cartCount > 0 && (
                                        <span className="absolute top-0 right-0 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm animate-in zoom-in">
                                            {cartCount}
                                        </span>
                                    )}
                                </button>
                            </SheetTrigger>
                        )}

                        {showMenu && (
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="md:hidden p-2 hover:bg-black/5 rounded-full transition-colors"
                            >
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 z-40 bg-background pt-24 px-6 md:hidden"
                    >
                        <div className="flex flex-col gap-6">
                            {showSearch && (
                                <Input
                                    type="search"
                                    placeholder="Search products..."
                                    className="w-full"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            )}
                            <nav className="flex flex-col gap-4 text-lg font-medium">
                                <Link href="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
                                {navigationLinks.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={asRoute(link.url)}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                                {user && merchant?.id && (
                                    <button
                                        type="button"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="w-full text-left"
                                    >
                                        <LoyaltyBadge
                                            merchantId={merchant.id}
                                            customerId={user.id}
                                            showPoints
                                            rewardsHref="/pages/rewards"
                                        />
                                    </button>
                                )}
                            </nav>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <Cart />
        </Sheet>
    );
}
