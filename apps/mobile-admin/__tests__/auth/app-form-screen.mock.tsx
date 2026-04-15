import type { ReactElement, ReactNode } from 'react';
import { APP_KEYBOARD_CONTAINER_LABEL } from './app-keyboard-container.mock';

export interface AppFormScreenProps {
  children?: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
}

export function createAppFormScreenMock(): {
  AppFormScreen: (props: AppFormScreenProps) => ReactElement;
} {
  return {
    AppFormScreen: ({ children, footer, header }: AppFormScreenProps) => (
      <div>
        {header}
        <section aria-label={APP_KEYBOARD_CONTAINER_LABEL}>{children}</section>
        {footer}
      </div>
    ),
  };
}
