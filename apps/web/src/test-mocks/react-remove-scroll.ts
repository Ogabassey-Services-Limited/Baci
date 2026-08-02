import { createElement, Fragment, type ReactNode } from 'react';

export function RemoveScroll({ children }: { children?: ReactNode }) {
  return createElement(Fragment, null, children);
}
