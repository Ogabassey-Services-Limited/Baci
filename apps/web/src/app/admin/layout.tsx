'use client';

import {
  BarChart3,
  Bell,
  Building2,
  Database,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  User,
  Users,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CsrfInitializer } from '@/components/csrf-initializer';
import { Logo } from '@/components/logo';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AdminLayoutFallback />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}

function AdminLayoutFallback() {
  return (
    <div
      className="flex min-h-screen w-full items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <CsrfInitializer />
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 motion-safe:animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading admin panel...</p>
      </div>
    </div>
  );
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function checkAdminStatus() {
      if (authLoading) return;

      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const supabase = createClient();
        const { data: merchant, error } = await supabase
          .from('merchants')
          .select('is_platform_admin')
          .eq('user_id', user.id)
          .single();

        if (error || !merchant?.is_platform_admin) {
          toast({
            title: 'Access Denied',
            description: 'You do not have platform admin privileges.',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }

        setIsAdmin(true);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to verify admin access.',
          variant: 'destructive',
        });
        router.push('/dashboard');
      } finally {
        setAdminLoading(false);
      }
    }

    checkAdminStatus();
  }, [user, authLoading, router, toast]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const navItems: {
    href: Route;
    icon: typeof LayoutDashboard;
    label: string;
  }[] = [
    {
      href: '/admin' as Route,
      icon: LayoutDashboard,
      label: 'Overview',
    },
    {
      href: '/admin/merchants' as Route,
      icon: Building2,
      label: 'Merchants',
    },
    {
      href: '/admin/analytics' as Route,
      icon: BarChart3,
      label: 'Analytics',
    },
    {
      href: '/admin/system' as Route,
      icon: Database,
      label: 'System Health',
    },
    {
      href: '/admin/notifications' as Route,
      icon: Bell,
      label: 'Notifications',
    },
    {
      href: '/admin/templates' as Route,
      icon: LayoutTemplate,
      label: 'Templates',
    },
    {
      href: '/admin/settings' as Route,
      icon: Settings,
      label: 'Platform Settings',
    },
  ];

  // Loading state
  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <CsrfInitializer />
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 motion-safe:animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Verifying admin access...
          </p>
        </div>
      </div>
    );
  }

  // Not admin - redirect is handled in useEffect
  if (!user || !isAdmin) {
    return null;
  }

  return (
    <>
      <CsrfInitializer />
      <div
        className={cn(
          'grid min-h-screen w-full transition-all',
          isCollapsed
            ? 'md:grid-cols-[80px_1fr]'
            : 'md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]'
        )}
      >
        {/* Sidebar */}
        <div className="hidden border-r bg-card md:block">
          <div className="flex h-full max-h-screen flex-col">
            {/* Logo */}
            <div
              className={cn(
                'flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6',
                isCollapsed && 'justify-center'
              )}
            >
              <Link
                href="/admin"
                className="flex items-center gap-2 font-semibold"
              >
                <Logo />
                {!isCollapsed && (
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      Admin
                    </span>
                  </span>
                )}
              </Link>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto">
              <TooltipProvider>
                <nav
                  className="grid items-start px-2 text-sm font-medium lg:px-4 mt-2"
                  aria-label="Admin navigation"
                >
                  {navItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/admin' &&
                        pathname.startsWith(item.href));
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
                              <item.icon
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              {!isCollapsed && <span>{item.label}</span>}
                            </div>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right">
                              {item.label}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </Link>
                    );
                  })}

                  {/* Divider */}
                  <div className="my-4 border-t" />

                  {/* Link back to merchant dashboard */}
                  <Link
                    href="/dashboard"
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                      isCollapsed && 'justify-center'
                    )}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4" aria-hidden="true" />
                          {!isCollapsed && <span>Merchant Dashboard</span>}
                        </div>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          Merchant Dashboard
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </Link>
                </nav>
              </TooltipProvider>
            </div>

            {/* Admin info footer */}
            <div className="mt-auto p-4 border-t">
              {!isCollapsed && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>Platform Administrator</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-col relative">
          {/* Collapse toggle button */}
          <Button
            variant="default"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'fixed top-1/2 -translate-y-1/2 z-20 hidden md:flex rounded-full',
              isCollapsed ? 'left-[68px]' : 'left-[208px] lg:left-[268px]',
              'bg-primary hover:bg-primary/90 text-primary-foreground transition-all'
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
            <span className="sr-only">
              {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </span>
          </Button>

          {/* Header */}
          <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 sticky top-0 z-10">
            {/* Mobile menu */}
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
                <nav
                  className="grid gap-2 text-lg font-medium"
                  aria-label="Mobile admin navigation"
                >
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 text-lg font-semibold mb-4"
                  >
                    <Logo />
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-sm text-primary">Admin</span>
                  </Link>
                  {navItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/admin' &&
                        pathname.startsWith(item.href));
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
                      </Link>
                    );
                  })}
                  <div className="my-2 border-t" />
                  <Link
                    href="/dashboard"
                    className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                  >
                    <Users className="h-5 w-5" />
                    Merchant Dashboard
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>

            {/* Page title area */}
            <div className="w-full flex-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Platform Admin</span>
              </div>
            </div>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                  <span className="sr-only">Toggle user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {user?.email || 'Admin Account'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push('/dashboard/settings')}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-500 focus:bg-red-100 focus:text-red-700"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* Main content */}
          <main
            id="main-content"
            className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-y-auto bg-muted/30"
          >
            <Suspense
              fallback={
                <div
                  className="flex flex-1 items-center justify-center"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <Loader2 className="h-8 w-8 motion-safe:animate-spin" />
                  <span className="sr-only">Loading admin content...</span>
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
