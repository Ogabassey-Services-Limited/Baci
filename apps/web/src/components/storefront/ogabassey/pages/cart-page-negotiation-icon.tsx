export function CartPageNegotiationIcon({
  className = '',
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="38"
      viewBox="0 0 512 512"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="32" y="80" width="448" height="256" rx="16" ry="16" />
      <path d="M64 384h384M96 432h320" />
      <circle cx="256" cy="208" r="80" />
      <path d="M480 160a80 80 0 01-80-80M32 160a80 80 0 0080-80M480 256a80 80 0 00-80 80M32 256a80 80 0 0180 80" />
    </svg>
  );
}
