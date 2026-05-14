'use client';

import {
  BarChart3,
  ChevronDown,
  FileText,
  Gift,
  Globe,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Newspaper,
  Package,
  Paintbrush,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Search,
  Settings,
  ShoppingCart,
  Store,
  UploadCloud,
  User,
  UserCog,
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/auth-context';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { COUNTRIES, getCountryByCode } from '@/lib/countries';
import { asRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';

// The original layout is now a client component to prevent hydration errors.

const StoreLink = ({
  isMobile = false,
  isCollapsed,
  merchantLoading,
  storeUrl,
  customDomain,
}: {
  isMobile?: boolean;
  isCollapsed: boolean;
  merchantLoading: boolean;
  storeUrl: string;
  customDomain?: string;
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

  const displayUrl = (() => {
    try {
      const url = new URL(storeUrl);
      return url.hostname;
    } catch {
      return 'Visit Store';
    }
  })();

  const linkContent = (
    <>
      <Store className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
      {!isCollapsed && !isMobile && (
        <span className="font-medium text-foreground">{displayUrl}</span>
      )}
      {isMobile && (
        <span className="font-medium text-foreground">{displayUrl}</span>
      )}
    </>
  );

  // Validate that storeUrl is safe (relative or from trusted domain)
  // Only allow:
  // 1. Relative paths starting with /
  // 2. localhost URLs (development only)
  // 3. URLs ending with .usebaci.com (production)
  // 4. Custom domains that match merchant's custom_domain
  const isSafeUrl = (() => {
    if (storeUrl.startsWith('/') && !storeUrl.startsWith('//')) return true;
    if (storeUrl.startsWith('http://localhost:')) return true;

    try {
      const url = new URL(storeUrl);
      const trustedDomain =
        process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';

      // Allow custom domains that match merchant's custom_domain
      if (customDomain && url.hostname === customDomain) {
        return true;
      }

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
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  useToast(); // Keep toast available for potential future use

  // Track if we've already attempted a redirect to prevent loops
  const [hasAttemptedAuthCheck, setHasAttemptedAuthCheck] = useState(false);

  // Orders count for sidebar badge - fetched lazily to not block initial render
  const [ordersCount, setOrdersCount] = useState(0);

  // NOTE: Auth and onboarding redirects are now handled SERVER-SIDE in layout.tsx
  // This effect is only for handling edge cases like session expiry during navigation
  useEffect(() => {
    // Wait for auth loading to finish
    if (authLoading) return;

    // If session expires during navigation, redirect to login
    // The server layout handles initial auth, this is a safety net
    if (!user && !hasAttemptedAuthCheck) {
      setHasAttemptedAuthCheck(true);
      // Wait briefly for potential session hydration
      const timer = setTimeout(() => {
        if (!user) {
          router.push('/login');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, router, hasAttemptedAuthCheck]);

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

  // Orders count fetch effect
  useEffect(() => {
    // Only fetch if merchant exists and we're on dashboard
    // This is a lightweight call just for the badge count
    if (merchant?.id && ordersCount === 0) {
      // Use a simpler query just for count instead of full metrics
      import('@/lib/supabase/client').then(({ createClient }) => {
        const supabase = createClient();
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchant.id)
          .then(({ count }) => setOrdersCount(count || 0));
      });
    }
  }, [merchant?.id, ordersCount]);

  const selectedCountry = merchant?.country
    ? getCountryByCode(merchant.country)
    : null;

  const getStoreUrl = () => {
    if (!merchant?.slug) return '#';

    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment) {
      // In development, use localhost with direct slug path
      return `http://localhost:3000/${merchant.slug}`;
    }

    // In production, prioritize custom domain
    if (merchant.custom_domain) {
      return `https://${merchant.custom_domain}`;
    }

    // Fallback to subdomain URL
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    return `https://${merchant.slug}.${rootDomain}`;
  };

  const storeUrl = getStoreUrl();

  const handleSignOut = async () => {
    await signOut();
    // Use hard navigation to clear all client-side state/cache and avoid re-fetching protected routes
    window.location.href = '/login';
  };

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
      href: '/dashboard/migrations' as Route,
      icon: UploadCloud,
      label: 'Migrations',
    },
    {
      href: '/dashboard/customers' as Route,
      icon: Users,
      label: 'Customers',
    },
    {
      href: '/dashboard/staff' as Route,
      icon: UserCog,
      label: 'Staff',
    },
    {
      href: '/dashboard/loyalty' as Route,
      icon: Gift,
      label: 'Loyalty',
    },
    {
      href: '/dashboard/santa' as Route,
      icon: MessageCircle,
      label: 'Santa Campaign',
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
      href: '/dashboard/domains' as Route,
      icon: Globe,
      label: 'Domains',
    },
    {
      href: '/dashboard/pages' as Route,
      icon: FileText,
      label: 'Pages',
      // Badge disabled temporarily
    },
    {
      href: '/dashboard/blog' as Route,
      icon: Newspaper,
      label: 'Blog',
    },
    {
      href: '/dashboard/templates' as Route,
      icon: LayoutTemplate,
      label: 'Templates',
    },
    {
      icon: Paintbrush,
      label: 'Customize Website',
      href: '/builder' as Route,
    },
    {
      href: '/dashboard/channels' as Route,
      icon: Store,
      label: 'Marketplaces',
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

  const { hasPermission, staffAccess } = useMerchant();

  const filteredNavItems = navItems.filter((item) => {
    // Owners always see everything
    if (staffAccess.isOwner) return true;

    // Santa Campaign is special (only for ogabassey)
    if (item.label === 'Santa Campaign' && merchant?.slug !== 'ogabassey') {
      return false;
    }

    if (item.label === 'Migrations') {
      return (
        hasPermission('settings', 'edit') ||
        hasPermission('orders', 'edit') ||
        hasPermission('products', 'create')
      );
    }

    // Map labels/paths to resources in role_permissions table
    const resourceMap: Record<string, string> = {
      Dashboard: 'dashboard',
      Analytics: 'analytics',
      Orders: 'orders',
      Products: 'products',
      Customers: 'customers',
      Staff: 'staff',
      Loyalty: 'marketing', // Loyalty is part of marketing permissions
      'Santa Campaign': 'marketing',
      Wallet: 'wallet', // Assuming wallet exists, check role_permissions
      SEO: 'marketing',
      Domains: 'settings',
      Pages: 'pages',
      Blog: 'marketing', // Blog is usually under marketing, or its own 'blog'
      Templates: 'builder',
      'Customize Website': 'builder',
      Marketplaces: 'integrations',
      Integrations: 'integrations',
      Settings: 'settings',
    };

    const resource = resourceMap[item.label];
    if (resource) {
      // For menu visibility, we generally check for 'view' permission
      return hasPermission(resource, 'view');
    }

    return true;
  });

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
          isCollapsed ? 'md:grid-cols-[120px_1fr]' : 'md:grid-cols-[300px_1fr]'
        )}
      >
        {/* Sidebar - Glassmorphic & Floating */}
        <div className="hidden md:block relative z-20">
          <div
            className={cn(
              'sticky top-4 rounded-3xl border border-white/20 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-xl transition-all duration-300 flex flex-col overflow-hidden ml-4 mb-4',
              'h-[calc(100vh-2rem)]',
              isCollapsed ? 'w-[100px]' : 'w-[280px]'
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
                  {filteredNavItems.map((item) => {
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
                    customDomain={merchant?.custom_domain}
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
        <div className="flex flex-col relative min-h-screen overflow-x-hidden">
          {/* Collapse Button - Floating */}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'fixed top-8 z-30 hidden md:flex rounded-full shadow-lg border border-white/20 bg-white/80 dark:bg-black/40 dark:border-white/10 backdrop-blur-md transition-all duration-300 hover:scale-110',
              isCollapsed ? 'left-[100px]' : 'left-[280px]'
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
          <header className="flex h-16 items-center gap-4 border-b bg-white/50 dark:bg-black/50 backdrop-blur-md px-4 md:hidden sticky top-0 z-20 transition-all duration-300">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
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
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
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
                    {filteredNavItems.map((item) => {
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label="User menu"
                  >
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

          {/* Desktop Header Actions (Refactored to Block for safety) */}
          <div className="hidden md:flex w-full justify-end items-center gap-3 px-6 pt-6 pb-2 z-20 bg-background/50 backdrop-blur-sm sticky top-0">
            <div className="flex items-center gap-2 p-1.5 rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/20 shadow-sm ml-auto">
              <StoreLink
                isMobile={false}
                isCollapsed={false}
                merchantLoading={merchantLoading}
                storeUrl={storeUrl}
                customDomain={merchant?.custom_domain}
              />
              <div className="w-[1px] h-4 bg-border/50" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3 gap-2 hover:bg-white/50"
                    aria-label="Select country"
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
                    aria-label="User menu"
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
            className="flex-1 transition-all duration-300 ease-in-out p-4 md:p-6 lg:p-8 overflow-auto"
          >
            <NotificationBanner />
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center">
                  <BagLoader />
                </div>
              }
            >
              {children}
            </Suspense>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-white/20 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 px-2">
          <Link
            href="/dashboard"
            className={cn(
              'flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors',
              pathname === '/dashboard'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link
            href="/dashboard/orders"
            className={cn(
              'flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative',
              pathname === '/dashboard/orders'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              {ordersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-background">
                  {ordersCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Orders</span>
          </Link>
          <Link
            href="/dashboard/products"
            className={cn(
              'flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors',
              pathname === '/dashboard/products'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Package className="h-5 w-5" />
            <span className="text-[10px] font-medium">Products</span>
          </Link>
          <Link
            href="/dashboard/customers"
            className={cn(
              'flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors',
              pathname === '/dashboard/customers'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="h-5 w-5" />
            <span className="text-[10px] font-medium">Customers</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors text-muted-foreground hover:text-foreground'
            )}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium">Menu</span>
          </button>
        </div>
      </div>
    </>
  );
}
