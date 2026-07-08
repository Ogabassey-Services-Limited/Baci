import { fireEvent, render, screen } from '@testing-library/react-native';
import type { QuizPrizeClaim } from '@/services/quiz';
import { QuizPrizeClaimPanel } from './QuizPrizeClaimPanel';
import { createQuizStyles, type QuizThemeColors } from './QuizScreen.styles';

const mockClaimPrize = jest.fn();
const mockRetry = jest.fn();
const mockHookState: {
  claimPrize: () => void;
  retry: () => void;
  isPreparing: boolean;
  isReady: boolean;
  error: string | null;
} = {
  claimPrize: mockClaimPrize,
  retry: mockRetry,
  isPreparing: false,
  isReady: true,
  error: null,
};

jest.mock('./use-quiz-prize-claim', () => ({
  useQuizPrizeClaim: () => mockHookState,
}));

const colors: QuizThemeColors = {
  background: '#000000',
  border: '#111111',
  card: '#222222',
  error: '#ff0000',
  muted: '#333333',
  primary: '#0000ff',
  primaryLowOpacity: 'rgba(0,0,255,0.1)',
  primaryForeground: '#ffffff',
  success: '#00ff00',
  text: '#ffffff',
  textSecondary: '#cccccc',
  warning: '#ffff00',
};
const styles = createQuizStyles(colors);

const prizeClaim: QuizPrizeClaim = {
  awardId: 'award-1',
  productId: 'prod-1',
  voucherToken: 'token-abc',
  cartPath: '/ogabassey/cart',
};

describe('QuizPrizeClaimPanel', () => {
  beforeEach(() => {
    mockClaimPrize.mockClear();
    mockRetry.mockClear();
    mockHookState.isPreparing = false;
    mockHookState.isReady = true;
    mockHookState.error = null;
  });

  it('claims the prize when the product is ready', () => {
    render(<QuizPrizeClaimPanel prizeClaim={prizeClaim} styles={styles} />);

    expect(screen.getByText('You won a prize!')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Claim your prize' }));
    expect(mockClaimPrize).toHaveBeenCalledTimes(1);
  });

  it('disables the claim button and shows preparing copy while loading', () => {
    mockHookState.isPreparing = true;
    mockHookState.isReady = false;

    render(<QuizPrizeClaimPanel prizeClaim={prizeClaim} styles={styles} />);

    const button = screen.getByRole('button', { name: 'Claim your prize' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Preparing your prize…')).toBeTruthy();
  });

  it('renders an error alert with a retry action', () => {
    mockHookState.error = 'Prize could not be loaded';

    render(<QuizPrizeClaimPanel prizeClaim={prizeClaim} styles={styles} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Prize could not be loaded'
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Try loading your prize again' })
    );
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});
