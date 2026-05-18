'use client';

import { ArrowRight, Home } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background font-sans overflow-hidden selection:bg-accent/30">
      {/* Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-accent/5 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[100px] -z-10" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02] -z-10" />

      <div className="absolute top-6 left-6 z-50">
        <Link href="/">
          <Logo />
        </Link>
      </div>

      <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
        <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-500">
          <div className="relative inline-block">
            <h1 className="text-[10rem] md:text-[12rem] font-bold leading-none text-slate-100 dark:text-slate-900/50 select-none">
              404
            </h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl md:text-3xl font-bold text-primary dark:text-white bg-white/80 dark:bg-black/80 backdrop-blur-xs px-6 py-2 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                Page Not Found
              </span>
            </div>
          </div>

          <div className="space-y-4 -mt-8">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-primary dark:text-white">
              Looks like you've ventured off the map
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
              We couldn't find the page you're looking for. It might have been
              moved, deleted, or perhaps it never existed.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button
              asChild
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white rounded-full h-12 px-8 shadow-lg shadow-primary/20 hover:translate-y-[-2px] transition-all"
            >
              <Link href="/">
                <Home className="mr-2 h-4 w-4" /> Go Home
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full h-12 px-8 border-2 hover:bg-accent/5 hover:text-accent hover:border-accent/50 transition-all"
            >
              <Link href="/contact">
                Contact Support <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="pt-12 text-sm text-muted-foreground">
            Lost?{' '}
            <Link href="/" className="text-accent hover:underline font-medium">
              Return to the homepage
            </Link>{' '}
            to start over.
          </div>
        </div>
      </div>
    </div>
  );
}
