import { act, renderHook } from '@testing-library/react-native';
import { useHomePermissionPrompt } from './useHomePermissionPrompt';

const mockRequestPermission = jest.fn();
const mockTriggerSystemPrompt = jest.fn();
const mockMarkDenied = jest.fn();

jest.mock('@/hooks/use-permission-booster', () => ({
  usePermissionBooster: () => ({
    markDenied: mockMarkDenied,
    requestPermission: mockRequestPermission,
    triggerSystemPrompt: mockTriggerSystemPrompt,
  }),
}));

async function advanceHomeSoftAskTimer() {
  await act(async () => {
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
  });
}

describe('useHomePermissionPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRequestPermission.mockResolvedValue('granted');
    mockTriggerSystemPrompt.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the tracking soft ask after the home discovery delay', async () => {
    mockRequestPermission.mockResolvedValueOnce('soft-ask-needed');

    const { result } = renderHook(() => useHomePermissionPrompt());

    expect(result.current.showPermissionModal).toBe(false);

    await advanceHomeSoftAskTimer();

    expect(mockRequestPermission).toHaveBeenCalledWith('tracking');
    expect(result.current.showPermissionModal).toBe(true);
  });

  it('does not show the soft ask when permission is already resolved', async () => {
    const { result } = renderHook(() => useHomePermissionPrompt());

    await advanceHomeSoftAskTimer();

    expect(mockRequestPermission).toHaveBeenCalledWith('tracking');
    expect(result.current.showPermissionModal).toBe(false);
  });

  it('runs the tracking system prompt when the shopper accepts', async () => {
    const { result } = renderHook(() => useHomePermissionPrompt());

    await act(async () => {
      await result.current.handlePermissionGrant();
    });

    expect(mockTriggerSystemPrompt).toHaveBeenCalledWith('tracking');
    expect(result.current.showPermissionModal).toBe(false);
  });

  it('records a tracking denial when the shopper declines', () => {
    const { result } = renderHook(() => useHomePermissionPrompt());

    act(() => {
      result.current.handlePermissionDeny();
    });

    expect(mockMarkDenied).toHaveBeenCalledWith('tracking');
    expect(result.current.showPermissionModal).toBe(false);
  });

  it('clears the pending soft ask timer on unmount', async () => {
    const { unmount } = renderHook(() => useHomePermissionPrompt());

    unmount();
    await advanceHomeSoftAskTimer();

    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});
