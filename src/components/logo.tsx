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
        <path
          d="M14.6667 5.33331C10.0447 5.33331 6.26927 9.10874 6.26927 13.7307C6.26927 18.3527 10.0447 22.1281 14.6667 22.1281V26.6666C7.51472 26.6666 1.83337 20.9853 1.83337 13.7307C1.83337 6.47614 7.51472 0.794796 14.6667 0.794796V5.33331Z"
          fill="currentColor"
          fillOpacity="0.4"
        />
        <path
          d="M17.3333 26.6667C21.9553 26.6667 25.7307 22.8913 25.7307 18.2693C25.7307 13.6473 21.9553 9.87186 17.3333 9.87186V5.33334C24.4853 5.33334 30.1666 11.0147 30.1666 18.2693C30.1666 25.5239 24.4853 31.2052 17.3333 31.2052V26.6667Z"
          fill="currentColor"
        />
      </svg>
      <span className="font-headline text-2xl font-bold tracking-tight">
        Baci
      </span>
    </div>
  );
}
