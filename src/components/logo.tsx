import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg
        width="110"
        height="36"
        viewBox="0 0 110 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shopping Cart */}
        <path
          d="M8.625 29.25C7.5875 29.25 6.75 30.0875 6.75 31.125C6.75 32.1625 7.5875 33 8.625 33C9.6625 33 10.5 32.1625 10.5 31.125C10.5 30.0875 9.6625 29.25 8.625 29.25ZM0 3V6H3L6.525 13.9875L5.1375 16.5125C4.9875 16.7875 4.875 17.1 4.875 17.4375C4.875 18.475 5.7125 19.3125 6.75 19.3125H27V16.3125H7.1625C6.9625 16.3125 6.8125 16.1625 6.8125 15.975L6.8625 15.7875L7.875 13.9875H22.95L28.125 6H5.475L4.575 4.125C4.425 3.7875 4.0875 3.5625 3.7125 3.5625H0.75C0.3375 3.5625 0 3.225 0 2.8125V3Z"
          fill="#3F51B5"
        />
        <path
          d="M23.625 29.25C22.5875 29.25 21.75 30.0875 21.75 31.125C21.75 32.1625 22.5875 33 23.625 33C24.6625 33 25.5 32.1625 25.5 31.125C25.5 30.0875 24.6625 29.25 23.625 29.25Z"
          fill="#FFC107"
        />
        <path d="M8.625 29.25C7.5875 29.25 6.75 30.0875 6.75 31.125C6.75 32.1625 7.5875 33 8.625 33C9.6625 33 10.5 32.1625 10.5 31.125C10.5 30.0875 9.6625 29.25 8.625 29.25Z" fill="#FFC107" />
        
        {/* Baci Text */}
        <text x="35" y="27" fontFamily="var(--font-sans), sans-serif" fontSize="28" fontWeight="bold" fill="#3F51B5">
          Bac
        </text>
        <text x="90" y="27" fontFamily="var(--font-sans), sans-serif" fontSize="28" fontWeight="bold" fill="#3F51B5">
          i
        </text>
        <circle cx="94" cy="9.5" r="4.5" fill="#FFC107" />
      </svg>
      
    </div>
  );
}
