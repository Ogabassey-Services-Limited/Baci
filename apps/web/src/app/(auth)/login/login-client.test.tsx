import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockLoginForm = vi.hoisted(() =>
  vi.fn((props: { defaultEmail?: string; redirectTo?: string }) => (
    <div>
      <span>email:{props.defaultEmail ?? ''}</span>
      <span>redirect:{props.redirectTo ?? ''}</span>
    </div>
  ))
);

vi.mock('@/components/login-form', () => ({
  default: mockLoginForm,
}));

import LoginClient from './login-client';

describe('LoginClient', () => {
  it.each([
    {
      expected: { defaultEmail: '', redirectTo: '/dashboard' },
      input: { defaultEmail: '' },
      name: 'defaults redirect when only an empty email is provided',
    },
    {
      expected: { defaultEmail: '', redirectTo: '/dashboard' },
      input: { defaultEmail: undefined },
      name: 'defaults empty email and redirect when email is undefined',
    },
    {
      expected: { defaultEmail: 'admin@example.com', redirectTo: '/admin' },
      input: { defaultEmail: 'admin@example.com', redirectTo: '/admin' },
      name: 'preserves a safe admin redirect',
    },
    {
      expected: {
        defaultEmail: 'admin+ops@example.com',
        redirectTo: '/admin/merchants?health=at_risk',
      },
      input: {
        defaultEmail: 'admin+ops@example.com',
        redirectTo: '/admin/merchants?health=at_risk',
      },
      name: 'preserves query parameters for a safe admin redirect',
    },
    {
      expected: { defaultEmail: '', redirectTo: '/dashboard' },
      input: { defaultEmail: '', redirectTo: 'https://evil.example/admin' },
      name: 'sanitizes unsafe absolute redirects',
    },
  ])('$name', ({ expected, input }) => {
    mockLoginForm.mockClear();

    render(<LoginClient {...input} />);

    expect(mockLoginForm).toHaveBeenCalledTimes(1);
    expect(mockLoginForm.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining(expected)
    );
    expect(screen.getByText(`email:${expected.defaultEmail}`)).toBeVisible();
    expect(screen.getByText(`redirect:${expected.redirectTo}`)).toBeVisible();
  });
});
