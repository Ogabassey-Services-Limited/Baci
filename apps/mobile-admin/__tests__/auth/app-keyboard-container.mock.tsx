import type { ReactElement, ReactNode } from 'react';

export const APP_KEYBOARD_CONTAINER_LABEL = 'Keyboard container';

export async function createAppKeyboardContainerMock(): Promise<{
  AppKeyboardContainer: ({
    children,
  }: {
    children?: ReactNode;
  }) => ReactElement;
}> {
  const React = await import('react');

  return {
    AppKeyboardContainer: ({ children }: { children?: ReactNode }) =>
      React.createElement(
        'div',
        {
          'aria-label': APP_KEYBOARD_CONTAINER_LABEL,
          role: 'region',
        },
        children
      ),
  };
}
