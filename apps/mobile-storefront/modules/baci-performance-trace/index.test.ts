const mockNativeModule = {
  beginAsyncSection: jest.fn(() => 17),
  endAsyncSection: jest.fn(),
};

jest.mock('./src/BaciPerformanceTraceModule', () => ({
  __esModule: true,
  default: mockNativeModule,
}));

import BaciPerformanceTrace from './index';

describe('baci-performance-trace public module', () => {
  it('re-exports the optional native module contract', () => {
    expect(BaciPerformanceTrace).toBe(mockNativeModule);
    expect(BaciPerformanceTrace?.beginAsyncSection('home')).toBe(17);
    BaciPerformanceTrace?.endAsyncSection('home', 17);
    expect(mockNativeModule.endAsyncSection).toHaveBeenCalledWith('home', 17);
  });
});
