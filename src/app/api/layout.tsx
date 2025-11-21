// This layout ensures API routes remain server-side and are not affected by client components
export default function ApiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
