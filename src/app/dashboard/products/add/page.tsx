import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AddProductForm from './add-product-form';

// Mark as dynamic to prevent SSG with Firebase
export const dynamic = 'force-dynamic';

export default function AddProductPage() {
  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/dashboard/products">
            <Button type="button" variant="outline" size="icon" className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
            </Button>
        </Link>
        <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          Add New Product
        </h1>
      </div>
      <AddProductForm />
    </>
  );
}
