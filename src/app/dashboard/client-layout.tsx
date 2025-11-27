'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

import {
  User,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Users,
  LayoutDashboard,
  Loader2,
  Store,
  FileText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Paintbrush,
  BarChart3,
  Plug
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/logo';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode, COUNTRIES } from '@/lib/countries';
import { useAuth } from '@/contexts/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

// The original layout is now a client component to prevent hydration errors.

const StoreLink = ({ isMobile = false, isCollapsed, merchantLoading, storeUrl }: { isMobile?: boolean, isCollapsed: boolean, merchantLoading: boolean, storeUrl: string }) => {
  const baseClassName = isMobile
    ? 'mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground'
    : cn('flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground', isCollapsed && 'justify-center');

  const isReady = !merchantLoading && storeUrl !== '#';

  if (!isReady) {
    const loadingContent = (
      <div className={cn(baseClassName, 'opacity-50 cursor-not-allowed')}>
        <Loader2 className={cn('h-4 w-4 animate-spin', isMobile && 'h-5 w-5')} />
        {!isCollapsed && !isMobile && 'Visit Store'}
        {isMobile && 'Visit Store'}
      </div>
    );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {loadingContent}
          </TooltipTrigger>
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

  return (
    <Link
      href={storeUrl}
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

/**
 * Renders the dashboard client layout with a collapsible sidebar, top header, mobile navigation sheet, country selector, and user menu.
 *
 * The component enforces authentication and onboarding flow: it redirects unauthenticated users to `/login` and users without a completed merchant profile to `/onboarding`. While authentication or merchant data is loading it shows a full-screen loader (or renders nothing during redirect to avoid flashes).
 *
 * @param children - Page content to display in the layout's main content area.
 * @returns The dashboard layout element containing navigation, store link, controls, and the provided children.
 */
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
        description: 'Please complete your store setup to access the dashboard.',
        variant: 'destructive',
      });
      router.push('/onboarding');
      return;
    }
  }, [user, merchant, authLoading, merchantLoading, router, toast]);

  const selectedCountry = merchant?.country ? getCountryByCode(merchant.country) : null;

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

  const navItems = [
    {
      href: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
    },
    {
      href: '/dashboard/analytics',
      icon: BarChart3,
      label: 'Analytics',
    },
    {
      href: '/dashboard/orders',
      icon: ShoppingCart,
      label: 'Orders',
      badge: 6,
    },
    {
      href: '/dashboard/products',
      icon: Package,
      label: 'Products',
    },

    {
      href: '/dashboard/customers',
      icon: Users,
      label: 'Customers',
    },
    {
      href: '/dashboard/pages',
      icon: FileText,
      label: 'Pages',
    },
    {
      icon: Paintbrush,
      label: 'Customize Website',
      href: '/builder',
    },
    {
      href: '/dashboard/integrations',
      icon: Plug,
      label: 'Integrations',
    },
    {
      href: '/dashboard/settings',
      icon: Settings,
      label: 'Settings',
    },
  ];



  // While checking auth OR if auth has succeeded but we are still waiting for the merchant,
  // show a full-page loading screen. This prevents content flashes and incorrect redirects.
  if (authLoading || (user && merchantLoading)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If after loading, there's still no user or no merchant, it means the redirect is in progress.
  // Render nothing to prevent a flash of the layout.
  if (!user || !merchant) {
    return null;
  }

  return (
    <div className={cn("grid min-h-screen w-full transition-all", isCollapsed ? "md:grid-cols-[80px_1fr]" : "md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]")}>
      <div className="hidden border-r bg-card md:block">
        <div className="flex h-full max-h-screen flex-col">
          <div className={cn("flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6", isCollapsed && "justify-center")}>
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              {isCollapsed ? <Logo /> : <Logo />}
              {!isCollapsed && <span className="sr-only">Baci</span>}
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            <TooltipProvider>
              <nav className="grid items-start px-2 text-sm font-medium lg:px-4" aria-label="Main navigation">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                        { 'bg-muted text-primary': isActive },
                        isCollapsed && 'justify-center'
                      )}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-3">
                            <item.icon className="h-4 w-4" aria-hidden="true" />
                            {!isCollapsed && <span>{item.label}</span>}
                          </div>
                        </TooltipTrigger>
                        {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                      </Tooltip>

                      {!isCollapsed && item.badge && (
                        <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
                <StoreLink isMobile={false} isCollapsed={isCollapsed} merchantLoading={merchantLoading} storeUrl={storeUrl} />
              </nav>
            </TooltipProvider>
          </div>
          <div className="mt-auto p-4">
            {!isCollapsed && (
              <Card className="border-primary/20">
                <CardHeader className="p-2 pt-0 md:p-4">
                  <CardTitle>Upgrade to Pro</CardTitle>
                  <CardDescription>
                    Unlock all features and get unlimited access to our support
                    team.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
                  <Button size="sm" className="w-full">
                    Upgrade
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

      </div>
      <div className="flex flex-col relative">
        <Button
          variant="default"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "fixed top-1/2 -translate-y-1/2 z-20 hidden md:flex rounded-full",
            isCollapsed ? "left-[68px]" : "left-[208px] lg:left-[268px]",
            "bg-blue-600 hover:bg-blue-700 text-white transition-all"
          )}
        >
          {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          <span className="sr-only">{isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
        </Button>
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 sticky top-0 z-10">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <nav className="grid gap-2 text-lg font-medium" aria-label="Mobile navigation">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-lg font-semibold mb-4"
                >
                  <Logo />
                </Link>
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground',
                        { 'bg-muted text-foreground': isActive }
                      )}
                    >
                      <item.icon className="h-5 w-5" aria-hidden="true" />
                      {item.label}
                      {item.badge && (
                        <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
                <StoreLink isMobile={true} isCollapsed={false} merchantLoading={merchantLoading} storeUrl={storeUrl} />
              </nav>
              <div className="mt-auto">
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle>Upgrade to Pro</CardTitle>
                    <CardDescription>
                      Unlock all features and get unlimited access to our
                      support team.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" className="w-full">
                      Upgrade
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1">
            {/* Search bar removed from here */}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                {merchantLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : selectedCountry ? (
                  <span className="text-2xl">{selectedCountry.flag}</span>
                ) : (
                  '🌐'
                )}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Select Country</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COUNTRIES.map(country => (
                <DropdownMenuItem key={country.code} onSelect={() => updateMerchant({ country: country.code })}>
                  <span className="mr-2 text-lg">{country.flag}</span>
                  <span>{country.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="icon" className="rounded-full">
                <User className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.email || 'My Account'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>Settings</DropdownMenuItem>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:bg-red-100 focus:text-red-700">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main id="main-content" className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-y-auto">
          <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}