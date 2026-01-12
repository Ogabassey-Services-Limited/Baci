
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/context/OnboardingContext';
import { View, ActivityIndicator } from 'react-native';
import { DARK_COLORS } from '@/constants/theme';

export default function Index() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const { hasSeenOnboarding, isLoading: onboardingLoading } = useOnboarding();

    if (authLoading || onboardingLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: DARK_COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={DARK_COLORS.primary} size="large" />
            </View>
        );
    }

    // 1. Initial Launch -> Onboarding
    if (!hasSeenOnboarding) {
        return <Redirect href="/(auth)/onboarding" />;
    }

    // 2. Not Authenticated -> Login
    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    // 3. Authenticated -> Dashboard
    return <Redirect href="/(admin)/(tabs)" />;
}
