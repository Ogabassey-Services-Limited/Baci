import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BagIconProps {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export function BagIcon({
  className,
  width = 24,
  height = 24,
  priority = false,
}: BagIconProps) {
  return (
    <div className={cn('relative', className)} style={{ width, height }}>
      <Image
        src="/bag-icon.svg"
        alt="Bag Icon"
        fill
        sizes={`${width}px`}
        className="object-contain"
        priority={priority}
      />
    </div>
  );
}
