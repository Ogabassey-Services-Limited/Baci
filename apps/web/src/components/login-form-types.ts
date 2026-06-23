import type { ComponentProps } from 'react';

export type LoginMode =
  | 'forgot-password'
  | 'login'
  | 'passwordless-request'
  | 'passwordless-verify';

export type LoginFormAction = ComponentProps<'form'>['action'];
