import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src="/logo.png"
        alt="Baci Logo"
        width={104}
        height={34}
        className="h-auto"
        priority
      />
    </div>
  );
}
