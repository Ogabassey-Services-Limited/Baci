import { Systrace } from 'react-native';
import { beginPerformanceTrace } from './performance-trace';

jest.mock('react-native', () => ({
  Systrace: {
    beginAsyncEvent: jest.fn(() => 41),
    endAsyncEvent: jest.fn(),
    isEnabled: jest.fn(),
  },
}));

const mockSystrace = Systrace as jest.Mocked<typeof Systrace>;

describe('beginPerformanceTrace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when an external system trace is not recording', () => {
    mockSystrace.isEnabled.mockReturnValue(false);

    const endTrace = beginPerformanceTrace('home', { focused: true });
    endTrace();

    expect(mockSystrace.beginAsyncEvent).not.toHaveBeenCalled();
    expect(mockSystrace.endAsyncEvent).not.toHaveBeenCalled();
  });

  it('marks a privacy-safe surface lifetime in an active Android trace', () => {
    mockSystrace.isEnabled.mockReturnValue(true);

    const endTrace = beginPerformanceTrace('gadget_pattern', {
      api_level: 31,
      customer_email: 'customer@example.com',
      instance_id: 'gadget_pattern_2',
      renderer: 'raster_gradient',
    });
    endTrace();
    endTrace();

    expect(mockSystrace.beginAsyncEvent).toHaveBeenCalledWith(
      'baci.surface.gadget_pattern',
      {
        api_level: '31',
        instance_id: 'gadget_pattern_2',
        renderer: 'raster_gradient',
      }
    );
    expect(mockSystrace.endAsyncEvent).toHaveBeenCalledTimes(1);
    expect(mockSystrace.endAsyncEvent).toHaveBeenCalledWith(
      'baci.surface.gadget_pattern',
      41
    );
  });
});
