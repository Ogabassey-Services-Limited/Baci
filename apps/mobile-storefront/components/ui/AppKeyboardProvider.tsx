import type { ReactNode } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

interface AppKeyboardProviderProps {
  children: ReactNode;
}

export default function AppKeyboardProvider({
  children,
}: AppKeyboardProviderProps) {
  return (
    <KeyboardProvider
      navigationBarTranslucent
      preserveEdgeToEdge
      statusBarTranslucent
    >
      {children}
    </KeyboardProvider>
  );
}
