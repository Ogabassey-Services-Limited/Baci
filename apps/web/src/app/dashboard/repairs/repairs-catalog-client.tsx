'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BookingsManager from './bookings-manager';
import CatalogManager from './catalog-manager';

interface RepairsCatalogClientProps {
  canEdit: boolean;
  canDelete: boolean;
  catalogEnabled?: boolean;
}

export default function RepairsCatalogClient({
  canEdit,
  canDelete,
  catalogEnabled = true,
}: RepairsCatalogClientProps) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl">Repairs</h1>
        <p className="text-muted-foreground text-sm">
          Manage your device-first repair catalogue and bookings.
        </p>
      </div>

      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          {catalogEnabled ? (
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="bookings">
          <BookingsManager canEdit={canEdit} />
        </TabsContent>
        {catalogEnabled ? (
          <TabsContent value="catalog">
            <CatalogManager canEdit={canEdit} canDelete={canDelete} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
