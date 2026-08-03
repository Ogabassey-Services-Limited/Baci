import { beforeEach, expect, it } from 'vitest';
import {
  getActionMocks,
  sendMagicLink,
  setupActionMocks,
} from './actions.test-support';

const mocks = getActionMocks();

beforeEach(setupActionMocks);

it('sends a magic link through the public onboarding action', async () => {
  await expect(sendMagicLink('merchant@example.com')).resolves.toEqual({
    success: true,
    message: 'Magic link sent! Check your email.',
  });
  expect(mocks.signInWithOtp).toHaveBeenCalledWith({
    email: 'merchant@example.com',
    options: {
      shouldCreateUser: true,
      emailRedirectTo: 'https://usebaci.com/onboarding?fromMagicLink=true',
    },
  });
});
