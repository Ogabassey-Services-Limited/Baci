import { permanentRedirect } from 'next/navigation';

export default async function CartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/${slug}/checkout`);
}
