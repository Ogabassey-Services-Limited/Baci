
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
  ChevronLeft,
  ChevronRight,
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
import { getCountryByCode } from '@/lib/countries';
import { useAuth } from '@/contexts/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// The original layout is now a client component to prevent hydration errors.
export default function DashboardClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { merchant, loading: merchantLoading } = useMerchant();
  const { user, loading: authLoading, signOut } = useAuth();
  const [hasMounted, setHasMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);


  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    // If auth is done loading and there's no user, redirect to login.
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const selectedCountry = merchant?.country ? getCountryByCode(merchant.country) : null;
  
  const getStoreUrl = () => {
    if (typeof window === 'undefined' || !merchant?.business_name) return '#';
    const slug = merchant.business_name.toLowerCase().replace(/\s+/g, '-');
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'baci.store';
    const isLocal = window.location.hostname.includes('localhost');
    
    if (isLocal) {
        // For local development, construct the subdomain URL for localhost
        return `http://${slug}.localhost:3000`;
    }
    // For production, use the root domain
    return `https://${slug}.${rootDomain}`;
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
      href: '/dashboard/settings',
      icon: Settings,
      label: 'Settings',
    },
  ];

  const StoreLink = ({ isMobile = false }) => {
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
        target="_blank"
        rel="noopener noreferrer"
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
  
  // While checking auth, show a loading screen.
  if (authLoading || !user) {
    return (
        <div className="flex min-h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
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
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                {navItems.map((item) => (
                    <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                        { 'bg-muted text-primary': pathname === item.href },
                        isCollapsed && 'justify-center'
                    )}
                    >
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-3">
                                <item.icon className="h-4 w-4" />
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
                ))}
                <StoreLink />
                </nav>
            </TooltipProvider>
          </div>
          <div className="mt-auto p-4">
             {!isCollapsed ? (
                <Card>
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
             ) : null}
            <div className="border-t mt-4 pt-4">
                <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="w-full h-10">
                    {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                    <span className="sr-only">{isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
                </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
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
              <nav className="grid gap-2 text-lg font-medium">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-lg font-semibold mb-4"
                >
                  <Logo />
                </Link>
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      'mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground',
                      { 'bg-muted text-foreground': pathname === item.href }
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                    {item.badge && (
                      <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                ))}
                <StoreLink isMobile />
              </nav>
              <div className="mt-auto">
                <Card>
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
           {merchantLoading ? (
             <Loader2 className="h-5 w-5 animate-spin" />
           ) : selectedCountry && (
             <div className="text-2xl">{selectedCountry.flag}</div>
           )}
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
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
