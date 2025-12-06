'use client';

import {
  BarChart3,
  ChevronDown,
  FileText,
  Gift,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  LogOut,
  Menu,
  Package,
  Paintbrush,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Search,
  Settings,
  ShoppingCart,
  Store,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { BagIcon } from '@/components/bag-icon';
import { Logo } from '@/components/logo';
import { NotificationBanner } from '@/components/notifications/notification-banner';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { Badge } from '@/components/ui/badge';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/auth-context';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { COUNTRIES, getCountryByCode } from '@/lib/countries';
import { asRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { getDashboardMetrics } from './actions';

// The original layout is now a client component to prevent hydration errors.

const StoreLink = ({
  isMobile = false,
  isCollapsed,
  merchantLoading,
  storeUrl,
}: {
  isMobile?: boolean;
  isCollapsed: boolean;
  merchantLoading: boolean;
  storeUrl: string;
}) => {
  const baseClassName = isMobile
    ? 'mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground'
    : cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground',
        isCollapsed && 'justify-center'
      );

  const isReady = !merchantLoading && storeUrl !== '#';

  if (!isReady) {
    const loadingContent = (
      <div className={cn(baseClassName, 'opacity-50 cursor-not-allowed')}>
        <Loader2
          className={cn(
            'h-4 w-4 motion-safe:animate-spin',
            isMobile && 'h-5 w-5'
          )}
        />
        {!isCollapsed && !isMobile && 'Visit Store'}
        {isMobile && 'Visit Store'}
      </div>
    );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{loadingContent}</TooltipTrigger>
          <TooltipContent side="right">Loading store...</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const linkContent = (
    <>
      <Store className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
      {!isCollapsed && !isMobile && 'Visit Store'}
      {isMobile && 'Visit Store'}
    </>
  );

  // Validate that storeUrl is safe (relative or from trusted domain)
  // Only allow:
  // 1. Relative paths starting with /
  // 2. localhost URLs (development only)
  // 3. URLs ending with .usebaci.com (production)
  const isSafeUrl = (() => {
    if (storeUrl.startsWith('/') && !storeUrl.startsWith('//')) return true;
    if (storeUrl.startsWith('http://localhost:')) return true;

    try {
      const url = new URL(storeUrl);
      const trustedDomain =
        process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
      // Ensure the hostname ends with our trusted domain (prevents subdomain takeover)
      return (
        url.hostname.endsWith(`.${trustedDomain}`) ||
        url.hostname === trustedDomain
      );
    } catch {
      return false;
    }
  })();

  return (
    <Link
      href={isSafeUrl ? asRoute(storeUrl) : asRoute('/')}
      className={cn(baseClassName, 'transition-all hover:text-primary')}
    >
      {isCollapsed && !isMobile ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{linkContent}</span>
            </TooltipTrigger>
            <TooltipContent side="right">Visit Store</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        linkContent
      )}
    </Link>
  );
};

export default function DashboardClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { merchant, loading: merchantLoading, updateMerchant } = useMerchant();
  const { user, loading: authLoading, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Wait for both auth and merchant loading to finish before making decisions
    if (authLoading || merchantLoading) {
      return;
    }

    // If there's no user, redirect to login page. This is the primary auth check.
    if (!user) {
      router.push('/login');
      return;
    }

    // If there IS a user but NO merchant record, they haven't completed onboarding.
    // This is the critical security and UX fix.
    // If there IS a user but NO merchant record OR incomplete profile, they haven't completed onboarding.
    // This is the critical security and UX fix.
    if (!merchant || !merchant.business_name) {
      toast({
        title: 'Onboarding Incomplete',
        description:
          'Please complete your store setup to access the dashboard.',
        variant: 'destructive',
      });
      router.push('/onboarding');
      return;
    }
  }, [user, merchant, authLoading, merchantLoading, router, toast]);

  // Auto-collapse sidebar on main content interaction
  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const handleInteraction = (event: Event) => {
      // Only auto-collapse on desktop and if sidebar is expanded
      if (window.innerWidth >= 768 && !isCollapsed) {
        if (event.type === 'click') {
          setIsCollapsed(true);
        } else if (event.type === 'scroll') {
          const target = event.target as HTMLElement;
          // Calculate 5% of the scrollable height
          const threshold = (target.scrollHeight - target.clientHeight) * 0.05;

          // If scrolled more than 5% and threshold is valid (not 0)
          if (threshold > 0 && target.scrollTop > threshold) {
            setIsCollapsed(true);
          }
        }
      }
    };

    // Collapse on click or scroll (with threshold)
    mainContent.addEventListener('click', handleInteraction);
    mainContent.addEventListener('scroll', handleInteraction);

    return () => {
      mainContent.removeEventListener('click', handleInteraction);
      mainContent.removeEventListener('scroll', handleInteraction);
    };
  }, [isCollapsed]);

  const [ordersCount, setOrdersCount] = useState(0);

  useEffect(() => {
    if (merchant?.id) {
      getDashboardMetrics(merchant.id).then((metrics) => {
        setOrdersCount(metrics.orders.value);
      });
    }
  }, [merchant?.id]);

  const selectedCountry = merchant?.country
    ? getCountryByCode(merchant.country)
    : null;

  const getStoreUrl = () => {
    if (!merchant?.slug) return '#';

    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment) {
      // In development, use localhost with the storefront path
      return `http://localhost:3000/storefront/${merchant.slug}`;
    }

    // In production, use subdomain URL
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    return `https://${merchant.slug}.${rootDomain}`;
  };

  const storeUrl = getStoreUrl();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const unfilledPagesCount = (() => {
    if (!merchant?.pages) return 6; // All pages missing if object doesn't exist
    const pages = merchant.pages as Record<string, string>;
    const keys = ['about', 'contact', 'privacy', 'terms', 'faq', 'legal'];
    return keys.filter((key) => !pages[key] || pages[key].trim().length === 0)
      .length;
  })();

  const navItems: {
    href: Route;
    icon: typeof LayoutDashboard;
    label: string;
    badge?: number;
    badgeVariant?: 'default' | 'destructive';
  }[] = [
    {
      href: '/dashboard' as Route,
      icon: LayoutDashboard,
      label: 'Dashboard',
    },
    {
      href: '/dashboard/analytics' as Route,
      icon: BarChart3,
      label: 'Analytics',
    },
    {
      href: '/dashboard/orders' as Route,
      icon: ShoppingCart,
      label: 'Orders',
      badge: ordersCount > 0 ? ordersCount : undefined,
    },
    {
      href: '/dashboard/products' as Route,
      icon: Package,
      label: 'Products',
    },
    {
      href: '/dashboard/customers' as Route,
      icon: Users,
      label: 'Customers',
    },
    {
      href: '/dashboard/loyalty' as Route,
      icon: Gift,
      label: 'Loyalty',
    },
    {
      href: '/dashboard/wallet' as Route,
      icon: Wallet,
      label: 'Wallet',
    },
    {
      href: '/dashboard/seo' as Route,
      icon: Search,
      label: 'SEO',
    },
    {
      href: '/dashboard/pages' as Route,
      icon: FileText,
      label: 'Pages',
      badge: unfilledPagesCount > 0 ? unfilledPagesCount : undefined,
      badgeVariant: 'destructive',
    },
    {
      href: '/dashboard/templates' as Route, // Updated path
      icon: LayoutTemplate,
      label: 'Templates',
    },
    {
      icon: Paintbrush,
      label: 'Customize Website',
      href: '/builder' as Route,
    },
    {
      href: '/dashboard/integrations' as Route,
      icon: Plug,
      label: 'Integrations',
    },
    {
      href: '/dashboard/settings' as Route,
      icon: Settings,
      label: 'Settings',
    },
  ];

  // While checking auth OR if auth has succeeded but we are still waiting for the merchant,
  // show a full-page loading screen. This prevents content flashes and incorrect redirects.
  if (authLoading || (user && merchantLoading)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <BagLoader size={64} />
      </div>
    );
  }

  // If after loading, there's still no user or no merchant, it means the redirect is in progress.
  // Render nothing to prevent a flash of the layout.
  if (!user || !merchant) {
    return null;
  }

  return (
    <>
      {/* Skip link for keyboard navigation */}

      <div
        className={cn(
          'grid min-h-screen w-full transition-all',
          isCollapsed ? 'md:grid-cols-[80px_1fr]' : 'md:grid-cols-[260px_1fr]'
        )}
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {/* Sidebar - Glassmorphic & Floating */}
        <div className="hidden md:block relative z-20">
          <div
            className={cn(
              'fixed top-4 bottom-4 left-4 rounded-3xl border border-white/20 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-xl transition-all duration-300 flex flex-col overflow-hidden',
              isCollapsed ? 'w-[80px]' : 'w-[260px]'
            )}
          >
            {/* Sidebar Header */}
            <div
              className={cn(
                'flex h-20 items-center px-6',
                isCollapsed && 'justify-center px-2'
              )}
            >
              <Link
                href="/dashboard"
                className="flex items-center gap-2 font-semibold transition-transform hover:scale-105"
              >
                {isCollapsed ? <BagIcon width={32} height={32} /> : <Logo />}
                {!isCollapsed && <span className="sr-only">Baci</span>}
              </Link>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
              <TooltipProvider>
                <nav
                  className="grid gap-2 text-sm font-medium"
                  aria-label="Main navigation"
                >
                  {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-full px-4 py-3 transition-all duration-200 group relative overflow-hidden',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                            : 'text-muted-foreground hover:bg-white/50 dark:hover:bg-white/10 hover:text-foreground',
                          isCollapsed && 'justify-center px-2'
                        )}
                      >
                        {/* Hover Glow Effect */}
                        {!isActive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}

                        <item.icon
                          className={cn(
                            'h-5 w-5 shrink-0 transition-transform group-hover:scale-110',
                            isActive && 'animate-pulse-subtle'
                          )}
                          aria-hidden="true"
                        />

                        {!isCollapsed && (
                          <span className="truncate">{item.label}</span>
                        )}

                        {!isCollapsed && item.badge && (
                          <Badge
                            variant={item.badgeVariant || 'default'}
                            className={cn(
                              'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px]',
                              item.badgeVariant === 'destructive'
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-accent text-accent-foreground'
                            )}
                          >
                            {/* If it's the Pages alert, show an Exclamation mark if preferred, or just the number. 
                                User asked for 'alert', usually '!' is clearer than a number for 'unfilled'. 
                                But let's stick to number for now as it gives scope of work. */}
                            {item.label === 'Pages' ? '!' : item.badge}
                          </Badge>
                        )}
                      </Link>
                    );
                  })}
                  <div className="my-4 h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
                  <StoreLink
                    isMobile={false}
                    isCollapsed={isCollapsed}
                    merchantLoading={merchantLoading}
                    storeUrl={storeUrl}
                  />
                </nav>
              </TooltipProvider>
            </div>

            {/* Sidebar Footer (Upgrade Card) */}
            <div className="p-4 mt-auto">
              {!isCollapsed && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground shadow-lg">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                  <h4 className="font-semibold relative z-10">
                    Upgrade to Pro
                  </h4>
                  <p className="text-xs text-primary-foreground/80 mt-1 mb-3 relative z-10">
                    Unlock AI superpowers & unlimited support.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full shadow-sm relative z-10 text-primary font-semibold"
                  >
                    Upgrade
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col relative min-h-screen">
          {/* Collapse Button - Floating */}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'fixed top-8 z-30 hidden md:flex rounded-full shadow-lg border border-white/20 bg-white/80 backdrop-blur-md transition-all duration-300 hover:scale-110',
              isCollapsed ? 'left-[70px]' : 'left-[250px]'
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            <span className="sr-only">
              {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </span>
          </Button>

          {/* Mobile Header */}
          <header className="flex h-16 items-center gap-4 border-b bg-white/50 dark:bg-black/50 backdrop-blur-md px-4 md:hidden sticky top-0 z-20">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 md:hidden"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex flex-col w-[280px] p-0 border-r-0 bg-transparent shadow-none"
              >
                {/* Mobile Sheet Content - Reusing Glass Style */}
                <div className="h-full w-full rounded-r-3xl border-r border-y border-white/20 bg-white/90 dark:bg-black/90 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
                  <div className="flex h-20 items-center px-6 border-b border-white/10">
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 font-semibold"
                    >
                      <Logo />
                    </Link>
                  </div>
                  <nav className="grid gap-2 p-4 overflow-y-auto">
                    {navItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-md'
                              : 'text-muted-foreground hover:bg-muted'
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          {item.label}
                          {item.badge && (
                            <Badge className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-accent-foreground px-1.5 text-[10px]">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex-1 flex justify-end items-center gap-2">
              <ThemeToggle />
              <NotificationCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Desktop Header Actions (Floating) */}
          <div className="hidden md:flex absolute top-6 right-8 z-20 items-center gap-3">
            <div className="flex items-center gap-2 p-1.5 rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/20 shadow-sm">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3 gap-2 hover:bg-white/50"
                  >
                    {merchantLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : selectedCountry ? (
                      <span className="text-lg leading-none">
                        {selectedCountry.flag}
                      </span>
                    ) : (
                      '🌐'
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuLabel>Select Country</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COUNTRIES.map((country) => (
                    <DropdownMenuItem
                      key={country.code}
                      onSelect={() => updateMerchant({ country: country.code })}
                    >
                      <span className="mr-2 text-lg">{country.flag}</span>
                      <span>{country.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-[1px] h-4 bg-border/50" />

              <ThemeToggle />
              <NotificationCenter />

              <div className="w-[1px] h-4 bg-border/50" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-white/50"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push('/dashboard/settings')}
                  >
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-red-500"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <main
            id="main-content"
            className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-8 pt-20 md:pt-24 lg:pt-24 overflow-y-auto overflow-x-hidden min-w-0"
          >
            <NotificationBanner />
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center">
                  <BagLoader size={48} />
                </div>
              }
            >
              {children}
            </Suspense>
          </main>
        </div>
      </div>
    </>
  );
}
