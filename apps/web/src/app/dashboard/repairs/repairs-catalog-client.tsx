'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BookingsPlaceholder from './bookings-placeholder';
import CatalogManager from './catalog-manager';

export default function RepairsCatalogClient() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl">Repairs</h1>
        <p className="text-muted-foreground text-sm">
          Manage your device-first repair catalogue and (soon) bookings.
        </p>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog">
          <CatalogManager />
        </TabsContent>
        <TabsContent value="bookings">
          <BookingsPlaceholder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
