import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Add Product | Baci',
  description: 'Create a product in your Baci catalog',
};

export default function AddProductPage() {
  redirect('/dashboard/products?action=new');
}
