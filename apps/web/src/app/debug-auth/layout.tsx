import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/auth-context';

export default function DebugAuthLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
