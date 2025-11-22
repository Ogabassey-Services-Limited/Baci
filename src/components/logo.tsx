import { cn } from '@/lib/utils';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/baci-logo.png"
        alt="Baci - AI E-commerce Builder Platform Logo"
        width={169}
        height={56}
        className="h-11 w-auto"
        loading="eager"
        priority
        unoptimized
      />
    </div>
  );
}
