import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  variant?: 'default' | 'light' | 'auto';
  priority?: boolean;
}

export function Logo({
  className,
  width = 100,
  height = 31,
  variant = 'auto',
  priority = false,
}: LogoProps) {
  if (variant === 'light') {
    return (
      <div className={cn('relative', className)} style={{ width, height }}>
        <Image
          src="/baci-logo-dark.svg"
          alt="Baci Logo"
          fill
          sizes={`${width}px`}
          className="object-contain"
          priority={priority}
          loading={priority ? undefined : 'lazy'}
        />
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} style={{ width, height }}>
      <Image
        src="/baci-logo.svg"
        alt="Baci Logo"
        fill
        sizes={`${width}px`}
        className="object-contain dark:hidden"
        priority={priority}
        loading={priority ? undefined : 'lazy'}
      />
      <Image
        src="/baci-logo-dark.svg"
        alt="Baci Logo"
        fill
        sizes={`${width}px`}
        className="object-contain hidden dark:block"
        priority={priority}
        loading={priority ? undefined : 'lazy'}
      />
    </div>
  );
}
