import { vi } from 'vitest';

const mocks = {
  getAppUrl: vi.fn(),
  getConfiguredAppUrl: vi.fn(),
  getOllamaStorefrontModel: vi.fn(),
  getRootDomain: vi.fn(),
  isAiStorefrontGenerationEnabled: vi.fn(),
  isEventPipelineEnqueueEnabled: vi.fn(),
  isProduction: vi.fn(),
  triggerAiStorefrontWorker: vi.fn(),
  recordPlatformDomainEvent: vi.fn(),
  ensureActionRateLimit: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  signInWithOtp: vi.fn(),
  adminInsert: vi.fn(),
  adminUpdate: vi.fn(),
  adminSelect: vi.fn(),
  adminMaybeSingle: vi.fn(),
  adminSingle: vi.fn(),
  adminEq: vi.fn(),
  adminFrom: vi.fn(),
  adminRpc: vi.fn(),
  pageConfigInsert: vi.fn(),
  pageConfigSelect: vi.fn(),
  pageConfigSingle: vi.fn(),
  aiJobsInsert: vi.fn(),
  generateInitialTemplate: vi.fn(),
  loggerError: vi.fn(),
};

export function getActionMocks() {
  return mocks;
}

const serverClient = {
  auth: {
    getUser: mocks.getUser,
    signInWithPassword: mocks.signInWithPassword,
    signUp: mocks.signUp,
    signOut: mocks.signOut,
    signInWithOtp: mocks.signInWithOtp,
  },
};
const adminClient = { from: mocks.adminFrom, rpc: mocks.adminRpc };

vi.doMock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: (callback: () => void | Promise<void>) =>
      void Promise.resolve()
        .then(callback)
        .catch(() => undefined),
  };
});
vi.doMock('next/headers', () => ({
  cookies: vi
    .fn()
    .mockResolvedValue({ getAll: () => [], get: () => null, set: vi.fn() }),
}));
vi.doMock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => serverClient),
}));
vi.doMock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => adminClient),
}));
vi.doMock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: mocks.ensureActionRateLimit,
}));
vi.doMock('@/lib/events/event-pipeline-config', () => ({
  isEventPipelineEnqueueEnabled: mocks.isEventPipelineEnqueueEnabled,
}));
vi.doMock('@/lib/events/record-platform-domain-event', () => ({
  recordPlatformDomainEvent: mocks.recordPlatformDomainEvent,
}));
vi.doMock('@/env', () => ({
  getAppUrl: mocks.getAppUrl,
  getConfiguredAppUrl: mocks.getConfiguredAppUrl,
  getOllamaStorefrontModel: mocks.getOllamaStorefrontModel,
  getRootDomain: mocks.getRootDomain,
  isAiStorefrontGenerationEnabled: mocks.isAiStorefrontGenerationEnabled,
  isProduction: mocks.isProduction,
}));
vi.doMock('@/lib/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.doMock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: mocks.loggerError, warn: vi.fn() },
}));
vi.doMock('@/lib/initial-template-generator', () => ({
  generateInitialTemplate: mocks.generateInitialTemplate,
}));
vi.doMock('@/lib/ai-storefront/trigger-storefront-worker', () => ({
  triggerAiStorefrontWorker: mocks.triggerAiStorefrontWorker,
}));
vi.doMock('@/services/hero-image-generator', () => ({
  assignHeroImagesToMerchant: vi.fn().mockResolvedValue(undefined),
}));

export const validFields = {
  email: 'merchant@example.com',
  password: 'StrongP@ss123!',
  confirmPassword: 'StrongP@ss123!',
  businessName: 'TestStore',
  businessType: 'fashion',
  country: 'NG',
  logoUrl: 'https://example.com/logo.png',
  brandColors: JSON.stringify({
    primary: '#000000',
    background: '#ffffff',
    accent: '#F59E0B',
  }),
};
export const prevState = { success: false, message: '' };
const updatedAt = '2026-04-28T10:00:00.000Z';

export function makeFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

export function setupActionMocks() {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.ensureActionRateLimit.mockResolvedValue(true);
  mocks.getAppUrl.mockReturnValue('http://localhost:3000');
  mocks.getConfiguredAppUrl.mockReturnValue('https://usebaci.com');
  mocks.getOllamaStorefrontModel.mockReturnValue('gemma4:e4b');
  mocks.getRootDomain.mockReturnValue('usebaci.com');
  mocks.isAiStorefrontGenerationEnabled.mockReturnValue(false);
  mocks.isEventPipelineEnqueueEnabled.mockReturnValue(false);
  mocks.recordPlatformDomainEvent.mockResolvedValue({
    already_enqueued: false,
    domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
    queue_message_id: 9,
  });
  mocks.isProduction.mockReturnValue(false);
  mocks.triggerAiStorefrontWorker.mockResolvedValue({
    triggered: true,
    status: 202,
  });
  mocks.generateInitialTemplate.mockResolvedValue({});
  mocks.adminRpc.mockResolvedValue({ data: null, error: null });
  mocks.pageConfigSingle.mockResolvedValue({
    data: { updated_at: updatedAt },
    error: null,
  });
  mocks.pageConfigSelect.mockReturnValue({ single: mocks.pageConfigSingle });
  mocks.pageConfigInsert.mockReturnValue({ select: mocks.pageConfigSelect });
  mocks.aiJobsInsert.mockResolvedValue({ data: null, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  mocks.signInWithPassword.mockResolvedValue({
    data: null,
    error: { message: 'Invalid login credentials' },
  });
  mocks.signUp.mockResolvedValue({
    data: {
      user: { id: 'user-123', email: 'merchant@example.com' },
      session: { access_token: 'test-token' },
    },
    error: null,
  });
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.adminFrom.mockImplementation((table: string) => {
    if (table === 'merchants')
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle: mocks.adminMaybeSingle }),
        }),
        insert: mocks.adminInsert,
        update: mocks.adminUpdate.mockReturnValue({ eq: mocks.adminEq }),
      };
    if (table === 'domains')
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    if (table === 'page_configs') return { insert: mocks.pageConfigInsert };
    if (table === 'ai_jobs') return { insert: mocks.aiJobsInsert };
    return {
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };
  });
}

export async function submitOnboarding(
  prevState: { message: string; success: boolean },
  formData: FormData
) {
  const actions = await import('./actions');
  return actions.submitOnboarding(prevState, formData);
}

export async function sendMagicLink(email: string) {
  const actions = await import('./actions');
  return actions.sendMagicLink(email);
}

export function setupChainedMock(
  finalData: unknown,
  finalError: unknown = null
): void {
  mocks.adminSingle.mockResolvedValue({ data: finalData, error: finalError });
  mocks.adminSelect.mockReturnValue({ single: mocks.adminSingle });
  mocks.adminInsert.mockReturnValue({ select: mocks.adminSelect });
  mocks.adminUpdate.mockReturnValue({ select: mocks.adminSelect });
  mocks.adminEq.mockReturnValue({ select: mocks.adminSelect });
}

export async function flushAfterCallbacks() {
  await Promise.resolve();
  await Promise.resolve();
}
export { adminClient, updatedAt };
