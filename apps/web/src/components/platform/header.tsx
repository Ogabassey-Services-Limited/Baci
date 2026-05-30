'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function PlatformHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-white/10 glass">
      <div
        className="container h-16 flex items-center justify-between"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <Link href="/" className="flex items-center gap-2 group">
          <Logo
            className="transition-transform group-hover:scale-105"
            priority
          />
          <span className="sr-only">Baci</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/#features"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Features
          </Link>
          <Link
            href="/#how-it-works"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            asChild
            variant="ghost"
            className="hidden sm:inline-flex hover:bg-primary/10 hover:text-primary"
          >
            <Link href="/login">Login</Link>
          </Button>
          <Button
            asChild
            className="hidden sm:inline-flex bg-primary hover:bg-primary/90 text-primary-foreground dark:text-indigo-950 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 hover:-translate-y-0.5"
          >
            <Link href="/onboarding">Get Started</Link>
          </Button>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden hover:bg-primary/10"
              >
                <Menu className="size-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader className="text-left pb-6 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <Logo width={80} height={25} />
                  <span>Baci</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-8">
                <Link
                  href="/#features"
                  className="text-lg font-medium px-4 py-2 rounded-md hover:bg-accent transition-colors"
                >
                  Features
                </Link>
                <Link
                  href="/#how-it-works"
                  className="text-lg font-medium px-4 py-2 rounded-md hover:bg-accent transition-colors"
                >
                  How It Works
                </Link>
                <Link
                  href="/pricing"
                  className="text-lg font-medium px-4 py-2 rounded-md hover:bg-accent transition-colors"
                >
                  Pricing
                </Link>
                <div className="pt-4 mt-4 border-t flex flex-col gap-3">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Link href="/login">Login</Link>
                  </Button>
                  <Button asChild className="w-full justify-start">
                    <Link href="/onboarding">Get Started</Link>
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
