import { Globe, Plus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function DomainsHeader() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-linear-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900/50 dark:via-slate-800/30 dark:to-slate-900/50 border p-6 shadow-sm">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-bl from-primary/10 to-transparent rounded-full blur-2xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-linear-to-tr from-purple-500/10 to-transparent rounded-full blur-xl" />

      <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
            <Globe className="w-8 h-8 text-primary" />
            Domains
          </h1>
          <p className="text-muted-foreground">
            Manage your store domains and custom URLs
          </p>
        </div>
        <Button
          asChild
          className="shadow-lg hover:shadow-xl transition-all bg-linear-to-r from-primary to-purple-600 hover:scale-105"
        >
          <Link href="/dashboard/domains?tab=custom">
            <Plus className="w-4 h-4 mr-2" />
            Add Domain
          </Link>
        </Button>
      </div>
    </div>
  );
}
