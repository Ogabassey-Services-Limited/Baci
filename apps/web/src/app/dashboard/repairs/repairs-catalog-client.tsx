'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BookingsManager from './bookings-manager';
import CatalogManager from './catalog-manager';

export default function RepairsCatalogClient() {
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
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings">
          <BookingsManager />
        </TabsContent>
        <TabsContent value="catalog">
          <CatalogManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
