import { cn } from '@/lib/utils';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src="https://drive.google.com/uc?export=view&id=1O9Z3Cvdx97n0GgkHdiUc4EBgdlfAuSmG"
        alt="Baci Logo"
        width={104}
        height={34}
        className="h-auto w-auto"
      />
    </div>
  );
}
