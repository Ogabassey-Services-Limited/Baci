import { ArrowRight, Link2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MigrationShopifyPlaceholder() {
  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="border-b border-border/60 bg-linear-to-r from-background via-background to-muted/20">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-500">
            Shopify migration
          </p>
          <CardTitle className="text-2xl">
            Shopify connection is the next migration path
          </CardTitle>
          <p className="max-w-2xl text-sm text-muted-foreground">
            When this source goes live, you will connect the store, pull the
            right data, and review everything before import. There is nothing to
            upload manually for Shopify yet.
          </p>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 p-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-primary" />
            Connect store
          </div>
          <p className="text-sm text-muted-foreground">
            Sign in to the merchant&apos;s Shopify store and confirm the source
            before Baci pulls any data.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ArrowRight className="h-4 w-4 text-primary" />
            Pull and preview
          </div>
          <p className="text-sm text-muted-foreground">
            Pull products or orders into the same review flow so you can check
            the data before anything is imported.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Merchant-safe launch
          </div>
          <p className="text-sm text-muted-foreground">
            Launch the Shopify path when it is ready without hiding it from
            merchants or forcing it through the Bumpa upload steps.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
