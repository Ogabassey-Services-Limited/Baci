
import DashboardClientLayout from './client-layout';

// This remains a Server Component that wraps the new Client Component.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
