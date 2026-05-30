import Image from 'next/image';
import { CheckStockSection } from '@/components/jumia/consignment/check-stock-section';
import { CreateConsignmentForm } from '@/components/jumia/consignment/create-consignment-form';
import { UpdateConsignmentForm } from '@/components/jumia/consignment/update-consignment-form';
import { ThemedCard } from '@/components/themed/themed-card';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface JumiaExpressPanelProps {
  integrationId: string;
  businessClientCode: string;
}

export function JumiaExpressPanel({
  integrationId,
  businessClientCode,
}: JumiaExpressPanelProps) {
  return (
    <div className="space-y-6">
      {/* Panel header */}
      <ThemedCard accentPosition="top" accentColor="primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="relative size-8 overflow-hidden rounded border border-gray-100 bg-white">
              <Image
                src="/jumia-logo.png"
                alt="Jumia"
                fill
                sizes="32px"
                className="object-contain"
              />
            </div>
            <div>
              <CardTitle className="text-xl">
                Jumia Express (Consignment)
              </CardTitle>
              <CardDescription>
                Manage warehouse consignments, track stock levels, and update
                shipment details for your Jumia Express products.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </ThemedCard>

      {/* Create Consignment */}
      <ThemedCard>
        <CreateConsignmentForm
          integrationId={integrationId}
          businessClientCode={businessClientCode}
        />
      </ThemedCard>

      {/* Check Stock */}
      <ThemedCard>
        <CheckStockSection
          integrationId={integrationId}
          businessClientCode={businessClientCode}
        />
      </ThemedCard>

      {/* Update Consignment */}
      <ThemedCard>
        <UpdateConsignmentForm integrationId={integrationId} />
      </ThemedCard>
    </div>
  );
}
