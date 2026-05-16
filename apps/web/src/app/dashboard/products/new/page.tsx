import { redirect } from 'next/navigation';

export default function NewProductPage() {
  redirect('/dashboard/products/add');
}
