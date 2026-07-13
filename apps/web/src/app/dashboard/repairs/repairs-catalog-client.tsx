'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BookingsManager from './bookings-manager';
import CatalogManager from './catalog-manager';

interface RepairsCatalogClientProps {
  canEdit: boolean;
  canDelete: boolean;
  /**
   * Whether the repair catalogue is live on the PUBLIC storefront
   * (`merchant_feature_settings.repairs_catalog_enabled`). This only drives a
   * "not live yet" notice — catalogue management stays reachable regardless so
   * merchants can build/import their devices and quotes BEFORE publishing.
   */
  catalogPubliclyEnabled?: boolean;
}

export default function RepairsCatalogClient({
  canEdit,
  canDelete,
  catalogPubliclyEnabled = true,
}: RepairsCatalogClientProps) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl">Repairs</h1>
        <p className="text-muted-foreground text-sm">
          Manage your device-first repair catalogue and bookings.
        </p>
      </div>

      {catalogPubliclyEnabled ? null : (
        <p
          role="status"
          className="rounded-md border bg-muted/40 p-3 text-muted-foreground text-sm"
        >
          Your repair catalogue isn't live on your storefront yet. Add devices
          and quotes here, then enable repairs in your storefront settings to
          publish it.
        </p>
      )}

      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings">
          <BookingsManager canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="catalog">
          <CatalogManager canEdit={canEdit} canDelete={canDelete} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
