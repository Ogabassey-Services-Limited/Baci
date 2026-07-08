'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DevicesManager from './devices-manager';
import ImportManager from './import-manager';
import ServiceTypesManager from './service-types-manager';

export default function CatalogManager() {
  return (
    <Tabs defaultValue="devices" className="mt-4">
      <TabsList>
        <TabsTrigger value="devices">Devices</TabsTrigger>
        <TabsTrigger value="service-types">Service types</TabsTrigger>
        <TabsTrigger value="import">AI import</TabsTrigger>
      </TabsList>
      <TabsContent value="devices">
        <DevicesManager />
      </TabsContent>
      <TabsContent value="service-types">
        <ServiceTypesManager />
      </TabsContent>
      <TabsContent value="import">
        <ImportManager />
      </TabsContent>
    </Tabs>
  );
}
