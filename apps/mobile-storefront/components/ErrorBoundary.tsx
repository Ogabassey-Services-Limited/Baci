import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import Colors from '@/constants/Colors';
import { ErrorFallbackView } from './ErrorFallbackView';
import {
  classifyError,
  type ErrorType,
  getErrorContent,
  logError,
} from './error-boundary-content';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: ErrorType;
  colorScheme: ColorSchemeName | null | undefined;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  private colorSchemeSubscription: ReturnType<
    typeof Appearance.addChangeListener
  > | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: 'general',
      colorScheme: Appearance.getColorScheme(),
    };
  }

  componentDidMount() {
    this.colorSchemeSubscription = Appearance.addChangeListener(
      ({ colorScheme }) => {
        this.setState({ colorScheme });
      }
    );
  }

  componentWillUnmount() {
    this.colorSchemeSubscription?.remove();
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorType: classifyError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, errorInfo, this.props.context);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorType: 'general',
    });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const colors = Colors[this.state.colorScheme === 'dark' ? 'dark' : 'light'];

    return (
      <ErrorFallbackView
        colors={colors}
        content={getErrorContent(this.state.errorType)}
        debugContext={this.props.context || 'unknown context'}
        error={this.state.error}
        onRetry={this.handleRetry}
      />
    );
  }
}

export function ErrorFallback({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  const colorScheme = Appearance.getColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  logError(error, undefined, 'expo-router-fallback');

  return (
    <ErrorFallbackView
      colors={colors}
      content={getErrorContent(classifyError(error))}
      error={error}
      onRetry={retry}
    />
  );
}
