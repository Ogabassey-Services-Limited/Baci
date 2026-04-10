'use client';

import Link from 'next/link';
import { useMerchantSafe } from '@/hooks/use-merchant';

export function AnnouncementBar() {
  const merchantContext = useMerchantSafe();
  const config = merchantContext?.merchant?.published_config
    ?.announcement_bar as
    | {
        enabled: boolean;
        message: string;
        link: string;
        background_color: string;
        text_color: string;
      }
    | undefined;

  if (!config?.enabled) {
    return null;
  }

  const content = (
    <div
      className="w-full py-2 px-4 text-center text-sm font-medium transition-colors"
      style={{
        backgroundColor: config.background_color || '#000000',
        color: config.text_color || '#ffffff',
      }}
    >
      {config.message}
    </div>
  );

  if (config.link) {
    return (
      <Link
        href={config.link as '/'}
        className="block w-full hover:opacity-90 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return content;
}
