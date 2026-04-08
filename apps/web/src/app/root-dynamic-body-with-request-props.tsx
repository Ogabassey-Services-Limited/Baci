import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { isStorefrontRequest, RootDynamicBody } from '@/app/root-dynamic-body';

export async function RootDynamicBodyWithRequestProps({
  children,
}: {
  children: ReactNode;
}) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || undefined;
  const forcedTheme = isStorefrontRequest(headersList) ? 'light' : undefined;

  return (
    <RootDynamicBody nonce={nonce} forcedTheme={forcedTheme}>
      {children}
    </RootDynamicBody>
  );
}
