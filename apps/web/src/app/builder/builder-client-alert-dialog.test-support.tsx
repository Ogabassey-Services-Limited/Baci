import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ChildrenProps = {
  children: ReactNode;
};

const AlertDialog = ({ children, open }: ChildrenProps & { open?: boolean }) =>
  open ? <div>{children}</div> : null;

const AlertDialogAction = ({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...props}>
    {children}
  </button>
);

const AlertDialogCancel = ({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...props}>
    {children}
  </button>
);

const AlertDialogContent = ({ children }: ChildrenProps) => (
  <div aria-label="Replace your current draft?" role="alertdialog">
    {children}
  </div>
);

const AlertDialogDescription = ({ children }: ChildrenProps) => (
  <p>{children}</p>
);

const AlertDialogFooter = ({ children }: ChildrenProps) => (
  <div>{children}</div>
);

const AlertDialogHeader = ({ children }: ChildrenProps) => (
  <div>{children}</div>
);

const AlertDialogTitle = ({ children }: ChildrenProps) => <h2>{children}</h2>;

const alertDialogMock = {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
};

export default alertDialogMock;
