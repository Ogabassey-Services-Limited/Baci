import { ArrowRight, Link2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MigrationShopifyPlaceholder() {
  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="border-b border-border/60 bg-gradient-to-r from-background via-background to-muted/20">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-500">
            Shopify migration
          </p>
          <CardTitle className="text-2xl">
            Direct store connection is the next source on this screen
          </CardTitle>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Instead of forcing Shopify into a CSV upload flow, the final version
            should connect the store, pull the right entities, and drop them
            into the same review-and-import pipeline you already have for Bumpa.
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
            Authenticate the merchant’s Shopify shop and confirm the source
            account before pulling any data.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ArrowRight className="h-4 w-4 text-primary" />
            Pull and preview
          </div>
          <p className="text-sm text-muted-foreground">
            Import orders or products into the same preview table with source
            aware actions, validation, and safe replay behavior.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Merchant-safe launch
          </div>
          <p className="text-sm text-muted-foreground">
            Keep Bumpa live today while Shopify remains an explicit option on
            the page instead of hidden future scope.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
