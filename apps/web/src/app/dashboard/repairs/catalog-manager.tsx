'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DevicesManager from './devices-manager';
import ImportManager from './import-manager';
import ServiceTypesManager from './service-types-manager';

interface CatalogManagerProps {
  canEdit: boolean;
  canDelete: boolean;
}

export default function CatalogManager({
  canEdit,
  canDelete,
}: CatalogManagerProps) {
  return (
    <Tabs defaultValue="devices" className="mt-4">
      <TabsList>
        <TabsTrigger value="devices">Devices</TabsTrigger>
        <TabsTrigger value="service-types">Service types</TabsTrigger>
        {canEdit ? <TabsTrigger value="import">AI import</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="devices">
        <DevicesManager canEdit={canEdit} canDelete={canDelete} />
      </TabsContent>
      <TabsContent value="service-types">
        <ServiceTypesManager canEdit={canEdit} canDelete={canDelete} />
      </TabsContent>
      {canEdit ? (
        <TabsContent value="import">
          <ImportManager canEdit={canEdit} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
