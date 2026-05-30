import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { SwapTradeInUploadStep } from './SwapTradeInUploadStep';

function renderUploadStep(overrides = {}) {
  const props = {
    colors: Colors.light,
    error: null,
    isAnalyzing: false,
    onClearVideo: jest.fn(),
    onPickVideo: jest.fn(),
    onRecordVideo: jest.fn(),
    onStartAnalysis: jest.fn(),
    videoUri: null,
    ...overrides,
  };

  render(<SwapTradeInUploadStep {...props} />);

  return props;
}

describe('SwapTradeInUploadStep', () => {
  it('renders upload choices and forwards picker actions', () => {
    const props = renderUploadStep();

    fireEvent.press(screen.getByText('Select Video'));
    fireEvent.press(screen.getByText('Record Now'));

    expect(screen.getByText('Upload a Video of Your Device')).toBeTruthy();
    expect(props.onPickVideo).toHaveBeenCalledTimes(1);
    expect(props.onRecordVideo).toHaveBeenCalledTimes(1);
  });

  it('renders selected video state and starts analysis', () => {
    const props = renderUploadStep({ videoUri: 'file:///device.mov' });

    fireEvent.press(screen.getByText('Remove'));
    fireEvent.press(screen.getByText('Analyze Device'));

    expect(screen.getByText('Video Selected')).toBeTruthy();
    expect(props.onClearVideo).toHaveBeenCalledTimes(1);
    expect(props.onStartAnalysis).toHaveBeenCalledTimes(1);
  });

  it('shows upload errors', () => {
    renderUploadStep({ error: 'Video is too long' });

    expect(screen.getByText('Video is too long')).toBeTruthy();
  });
});
