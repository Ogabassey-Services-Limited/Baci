import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
      >
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path
          d="M13 10C13 8.89543 13.8954 8 15 8H19C20.1046 8 21 8.89543 21 10V14C21 15.1046 20.1046 16 19 16H15C13.8954 16 13 15.1046 13 14V10Z"
          fill="white"
        />
        <path
          d="M13 22C13 20.8954 13.8954 20 15 20H19C20.1046 20 21 20.8954 21 22V24H15C13.8954 24 13 23.1046 13 22Z"
          fill="white"
          fillOpacity="0.7"
        />
      </svg>
      <span className="font-headline text-2xl font-bold tracking-tight">
        Baci
      </span>
    </div>
  );
}
