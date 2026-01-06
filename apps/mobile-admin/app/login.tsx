/**
 * Login Screen - Mobile Admin
 * Clean, minimal design with social login support
 */

import React, { useState, useEffect } from 'react';
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
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { BaciLogo } from '@/components/BaciLogo';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingContext';
import { supabase } from '@/lib/supabase';

// Required for Google Auth
WebBrowser.maybeCompleteAuthSession();

// Baci Brand Colors
const BRAND = {
    yellow: '#f0bf58',
    navy: '#23255d',
};

export default function LoginScreen() {
    const { colors } = useTheme();
    const { signIn } = useAuth();
    const { resetOnboarding } = useOnboarding();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isAppleLoading, setIsAppleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Google Auth Setup
    const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });

    // Handle Google response
    useEffect(() => {
        if (googleResponse?.type === 'success') {
            const { id_token } = googleResponse.params;
            handleGoogleToken(id_token);
        } else if (googleResponse?.type === 'error') {
            setError('Google sign-in failed');
            setIsGoogleLoading(false);
        }
    }, [googleResponse]);

    const handleGoogleToken = async (idToken: string) => {
        try {
            const { error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: idToken,
            });
            if (error) {
                setError(error.message);
            }
        } catch (err) {
            setError('Failed to sign in with Google');
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        setError(null);
        await promptGoogleAsync();
    };

    const handleAppleSignIn = async () => {
        setIsAppleLoading(true);
        setError(null);

        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (credential.identityToken) {
                const { error } = await supabase.auth.signInWithIdToken({
                    provider: 'apple',
                    token: credential.identityToken,
                });
                if (error) {
                    setError(error.message);
                }
            }
        } catch (err: unknown) {
            if ((err as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
                setError('Apple sign-in failed');
            }
        } finally {
            setIsAppleLoading(false);
        }
    };

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

        setIsLoading(false);
    };

    const isAnyLoading = isLoading || isGoogleLoading || isAppleLoading;

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
                                    editable={!isAnyLoading}
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
                                    editable={!isAnyLoading}
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
                                isAnyLoading && styles.loginButtonDisabled,
                            ]}
                            onPress={handleLogin}
                            disabled={isAnyLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={BRAND.navy} />
                            ) : (
                                <Text style={[styles.loginButtonText, { color: BRAND.navy }]}>Sign In</Text>
                            )}
                        </Pressable>

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                            <Text style={[styles.dividerText, { color: colors.textMuted }]}>or continue with</Text>
                            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        </View>

                        {/* Social Login Buttons */}
                        <View style={styles.socialButtons}>
                            {/* Google Sign-In */}
                            <Pressable
                                style={[styles.socialButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={handleGoogleSignIn}
                                disabled={isAnyLoading}
                            >
                                {isGoogleLoading ? (
                                    <ActivityIndicator size="small" color={colors.text} />
                                ) : (
                                    <>
                                        <Ionicons name="logo-google" size={20} color="#DB4437" />
                                        <Text style={[styles.socialButtonText, { color: colors.text }]}>Google</Text>
                                    </>
                                )}
                            </Pressable>

                            {/* Apple Sign-In */}
                            {Platform.OS === 'ios' && (
                                <Pressable
                                    style={[styles.socialButton, { backgroundColor: '#000', borderColor: '#000' }]}
                                    onPress={handleAppleSignIn}
                                    disabled={isAnyLoading}
                                >
                                    {isAppleLoading ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="logo-apple" size={20} color="#FFF" />
                                            <Text style={[styles.socialButtonText, { color: '#FFF' }]}>Apple</Text>
                                        </>
                                    )}
                                </Pressable>
                            )}
                        </View>
                    </View>

                    {/* Footer */}
                    <Text style={[styles.footer, { color: colors.textMuted }]}>
                        Use your merchant account credentials
                    </Text>

                    {/* DEV: Reset Onboarding */}
                    {__DEV__ && (
                        <Pressable
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 12,
                                borderRadius: RADIUS.md,
                                borderWidth: 1,
                                gap: 8,
                                marginTop: SPACING.xl,
                                backgroundColor: '#FEF3C7',
                                borderColor: '#F59E0B',
                            }}
                            onPress={async () => {
                                await resetOnboarding();
                            }}
                        >
                            <Ionicons name="refresh-outline" size={20} color="#D97706" />
                            <Text style={{ color: '#D97706', fontWeight: '600' }}>Reset Onboarding (Dev)</Text>
                        </Pressable>
                    )}
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
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.md,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        marginHorizontal: SPACING.md,
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
    },
    socialButtons: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    socialButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        gap: SPACING.sm,
    },
    socialButtonText: {
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
    },
});
