import { Suspense } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
import { getDiscountCodes } from './actions';
import { DiscountClient } from './discount-client';

async function DiscountContent() {
  const { discountCodes, currencySymbol } = await getDiscountCodes();
  return <DiscountClient initialDiscountCodes={discountCodes} currencySymbol={currencySymbol} />;
}

export default function DiscountCodesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <BagLoader size={32} />
        </div>
      }
    >
      <DiscountContent />
    </Suspense>
  );
}
