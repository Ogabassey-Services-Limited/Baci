import { Suspense } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
import { getDiscountCodes } from './actions';
import { DiscountClient } from './discount-client';

export default async function DiscountCodesPage() {
  const discountCodes = await getDiscountCodes();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <BagLoader size={32} />
        </div>
      }
    >
      <DiscountClient initialDiscountCodes={discountCodes} />
    </Suspense>
  );
}
