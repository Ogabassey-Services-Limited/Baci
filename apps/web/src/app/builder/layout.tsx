import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/auth-context';

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
