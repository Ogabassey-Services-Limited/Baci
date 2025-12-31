/**
 * Login Screen - Mobile Admin
 * Clean, minimal design with proper error handling
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { BaciLogo } from '@/components/BaciLogo';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

// Baci Brand Colors
const BRAND = {
    yellow: '#f0bf58',
    navy: '#23255d',
};

export default function LoginScreen() {
    const { colors } = useTheme();
    const { signIn } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            setError('Please enter both email and password');
            return;
        }

        setIsLoading(true);
        setError(null);

        const { error: authError } = await signIn(email.trim(), password);

        if (authError) {
            setError(authError.message === 'Invalid login credentials'
                ? 'Incorrect email or password'
                : authError.message
            );
        }
        // If successful, onAuthStateChange in useAuth will update state
        // and _layout.tsx will automatically navigate to authenticated routes

        setIsLoading(false);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    {/* Baci Branding */}
                    <View style={styles.header}>
                        <BaciLogo size={80} borderRadius={20} />
                        <Text style={[styles.title, { color: BRAND.navy }]}>Baci</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Manage your store on the go
                        </Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {error && (
                            <View style={[styles.errorCard, { backgroundColor: colors.errorLight }]}>
                                <Ionicons name="alert-circle" size={20} color={colors.error} />
                                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="you@example.com"
                                    placeholderTextColor={colors.textMuted}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    keyboardType="email-address"
                                    textContentType="emailAddress"
                                    editable={!isLoading}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="••••••••"
                                    placeholderTextColor={colors.textMuted}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoComplete="password"
                                    textContentType="password"
                                    editable={!isLoading}
                                />
                                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color={colors.textMuted}
                                    />
                                </Pressable>
                            </View>
                        </View>

                        <Pressable
                            style={[
                                styles.loginButton,
                                { backgroundColor: BRAND.yellow },
                                isLoading && styles.loginButtonDisabled,
                            ]}
                            onPress={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={[styles.loginButtonText, { color: BRAND.navy }]}>Sign In</Text>
                            )}
                        </Pressable>
                    </View>

                    {/* Footer */}
                    <Text style={[styles.footer, { color: colors.textMuted }]}>
                        Use your merchant account credentials
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING['3xl'],
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: RADIUS.xl,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
    },
    title: {
        fontSize: TYPOGRAPHY.size['2xl'],
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
    },
    form: {
        gap: SPACING.lg,
    },
    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        gap: SPACING.sm,
    },
    errorText: {
        flex: 1,
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
    },
    inputGroup: {
        gap: SPACING.xs,
    },
    label: {
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        marginLeft: SPACING.xs,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
    },
    inputIcon: {
        marginRight: SPACING.sm,
    },
    input: {
        flex: 1,
        paddingVertical: SPACING.md,
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
    },
    eyeButton: {
        padding: SPACING.xs,
    },
    loginButton: {
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.sm,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#FFF',
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    },
    footer: {
        textAlign: 'center',
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
        marginTop: SPACING['3xl'],
    },
});
