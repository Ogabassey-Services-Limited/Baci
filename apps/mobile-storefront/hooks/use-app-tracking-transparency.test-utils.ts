import { jest } from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';

// Shared harness for the two colocated ATT test suites (baseline lifecycle +
// the 2.1.512 silent-denial recovery regression). Kept in a `.test-utils` file
// — ignored by jest's testPathIgnorePatterns — so neither suite has to
// duplicate the mock fns/AppState wiring and both stay under the 300-line
// file limit. The `jest.mock(...)` module registrations stay in each test
// file so babel-plugin-jest-hoist lifts them above every import (including the
// hook under test); registering them here would run too late, after the hook
// has already bound the real modules.

export const mockCanRequestTrackingTransparency = jest.fn<() => boolean>(
  () => true
);
export const mockGetTrackingPermissionStatus =
  jest.fn<() => Promise<{ status: string }>>();
export const mockRequestTrackingPermission = jest.fn<() => Promise<string>>();
export const mockRecordCrashBreadcrumb = jest.fn();
export const mockTrackEvent = jest.fn();
export const mockRemoveAppStateListener = jest.fn();

export const attAppStateMock: {
  current: AppStateStatus;
  listener: ((state: AppStateStatus) => void) | null;
} = {
  current: 'active',
  listener: null,
};

// Re-seed the ATT mocks to their default baseline (undetermined status, a
// granted request) and re-install the AppState spies. `clearAllMocks` does not
// drain queued `mockResolvedValueOnce` values, so the async mocks are reset
// before re-seeding to stop a queued Once from a prior test leaking in.
export function primeAttTrackingMocks() {
  mockGetTrackingPermissionStatus.mockReset();
  mockRequestTrackingPermission.mockReset();
  attAppStateMock.current = 'active';
  attAppStateMock.listener = null;
  mockCanRequestTrackingTransparency.mockReturnValue(true);
  mockGetTrackingPermissionStatus.mockResolvedValue({ status: 'undetermined' });
  mockRequestTrackingPermission.mockResolvedValue('granted');
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    get: () => attAppStateMock.current,
  });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      attAppStateMock.listener = listener;
      return { remove: mockRemoveAppStateListener };
    });
}
