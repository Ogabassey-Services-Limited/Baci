import { connection } from 'next/server';
import { type ReactNode, Suspense } from 'react';

async function StorefrontPdpDynamicMetadataMarker() {
  await connection();

  return null;
}

export default function StorefrontPdpLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {/*
        Next 16 Dynamic IO requires a request-time marker in the same segment as
        request-bound PDP metadata. Keep this marker hostless: previous hidden
        div markers added DOM slots that collided with Next's metadata boundary.
      */}
      <Suspense fallback={null}>
        <StorefrontPdpDynamicMetadataMarker />
      </Suspense>
      {children}
    </>
  );
}
