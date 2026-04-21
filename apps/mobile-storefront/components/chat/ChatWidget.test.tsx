import { render, screen } from '@testing-library/react-native';
import { ChatWidget } from './ChatWidget';

// Mock the three custom hooks
jest.mock('./use-chat', () => ({
  useChat: jest.fn(() => ({
    messages: [],
    input: '',
    setInput: jest.fn(),
    isLoading: false,
    flatListRef: { current: null },
    inputRef: { current: null },
    handleSend: jest.fn(),
    handleSuggestionPress: jest.fn(),
    scrollToBottom: jest.fn(),
  })),
}));

const mockPan = {
  x: { addListener: jest.fn(() => '1'), removeListener: jest.fn() },
  y: { addListener: jest.fn(() => '2'), removeListener: jest.fn() },
  setOffset: jest.fn(),
  setValue: jest.fn(),
  flattenOffset: jest.fn(),
};

jest.mock('./use-draggable-fab', () => ({
  useDraggableFab: jest.fn(() => ({
    pan: mockPan,
    panResponder: { panHandlers: {} },
    pulseAnim: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      setValue: jest.fn(),
    },
    isDragging: false,
    hasMoved: { current: false },
    isOnRight: { current: true },
  })),
}));

jest.mock('./use-proactive-nudge', () => ({
  useProactiveNudge: jest.fn(() => ({
    proactiveMsg: null,
    nudgeFadeAnim: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      setValue: jest.fn(),
    },
    dismissNudge: jest.fn(),
  })),
}));

// Mock UI store
const mockOpenChat = jest.fn();
const mockCloseChat = jest.fn();
let mockIsChatOpen = false;

jest.mock('@/stores/ui-store', () => ({
  useUIStore: jest.fn((selector: (state: unknown) => unknown) => {
    const state = {
      isChatOpen: mockIsChatOpen,
      openChat: mockOpenChat,
      closeChat: mockCloseChat,
    };
    return selector(state);
  }),
}));

// Mock useColorScheme
jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

// Mock expo-router usePathname
const mockUsePathname = jest.fn(() => '/');
jest.mock('expo-router', () => ({
  usePathname: jest.fn(() => mockUsePathname()),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  Link: 'Link',
}));

// Mock ChatModal as a simple component
jest.mock('./ChatModal', () => ({
  ChatModal: jest.fn(() => null),
}));

// Mock styles
jest.mock('./styles', () => ({
  styles: {
    fabContainer: {},
    fab: {},
    aiBadge: {},
    aiBadgeText: {},
    fabEmoji: {},
    nudgeContainer: {},
    nudgeRight: {},
    nudgeLeft: {},
    nudgeBubble: {},
    nudgeText: {},
    nudgeClose: {},
    nudgeTailContainer: {},
    nudgeTailRight: {},
    nudgeTailLeft: {},
    nudgeDot1: {},
    nudgeDot2: {},
    dragIndicator: {},
    dragIndicatorText: {},
  },
}));

describe('ChatWidget', () => {
  beforeEach(() => {
    mockIsChatOpen = false;
    mockOpenChat.mockClear();
    mockCloseChat.mockClear();
    mockUsePathname.mockReturnValue('/');
  });

  it('renders the FAB button with the correct accessibility label', () => {
    render(<ChatWidget />);

    const fab = screen.getByRole('button', {
      name: 'Open chat assistant. Drag to move.',
    });
    expect(fab).toBeTruthy();
  });

  it('shows the AI badge text on the FAB', () => {
    render(<ChatWidget />);

    expect(screen.getByText('AI')).toBeTruthy();
  });

  it('returns null when pathname matches a hidden route (/checkout)', () => {
    mockUsePathname.mockReturnValue('/checkout');
    const { toJSON } = render(<ChatWidget />);

    expect(toJSON()).toBeNull();
  });

  it('returns null on the cart route', () => {
    mockUsePathname.mockReturnValue('/cart');
    const { toJSON } = render(<ChatWidget />);

    expect(toJSON()).toBeNull();
  });

  it('returns null when pathname starts with /auth/login', () => {
    mockUsePathname.mockReturnValue('/auth/login');
    const { toJSON } = render(<ChatWidget />);

    expect(toJSON()).toBeNull();
  });

  it('returns null for /order-success route', () => {
    mockUsePathname.mockReturnValue('/order-success');
    const { toJSON } = render(<ChatWidget />);

    expect(toJSON()).toBeNull();
  });

  it('renders the FAB when on a non-hidden route', () => {
    mockUsePathname.mockReturnValue('/home');
    render(<ChatWidget />);

    expect(
      screen.getByRole('button', {
        name: 'Open chat assistant. Drag to move.',
      })
    ).toBeTruthy();
  });

  it('renders santa emoji when santaMode is true', () => {
    render(<ChatWidget santaMode={true} />);

    expect(screen.getByText('🎅')).toBeTruthy();
  });

  it('does not render santa emoji when santaMode is false', () => {
    render(<ChatWidget santaMode={false} />);

    expect(screen.queryByText('🎅')).toBeNull();
  });
});
