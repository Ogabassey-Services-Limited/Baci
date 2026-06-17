import type { ReactNode } from 'react';

type CategoryProductLayoutProps = {
  children: ReactNode;
};

export default function CategoryProductLayout({
  children,
}: CategoryProductLayoutProps) {
  return <>{children}</>;
}
