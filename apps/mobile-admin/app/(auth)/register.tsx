import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    ActivityIndicator,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { DARK_COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme'; // Adjust import path if needed

// Simplified Business Types from Web Config
const BUSINESS_TYPES = [
    { id: 'fashion', label: 'Fashion & Apparel' },
    { id: 'electronics', label: 'Electronics & Gadgets' },
    { id: 'home-goods', label: 'Home Goods & Decor' },
    { id: 'health-beauty', label: 'Health & Beauty' },
    { id: 'handmade', label: 'Handmade & Crafts' },
    { id: 'food-beverage', label: 'Food & Beverage' },
    { id: 'hair-extensions', label: 'Hair & Extensions' },
    { id: 'pharmaceuticals', label: 'Pharmaceuticals & Medical' },
    { id: 'other', label: 'Other' },
];

const API_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    // Use machine's LAN IP for physical devices (Replace '10.104.85.17' if your IP changes)
    'http://10.104.85.17:3000/api/mobile-onboarding';
// Fallback for emulators if needed:
// Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/mobile-onboarding' : 'http://localhost:3000/api/mobile-onboarding';

export default function RegisterScreen() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        businessName: '',
        businessType: '',
        otherBusinessType: '',
        slug: '',
    });
    const [isSlugEdited, setIsSlugEdited] = useState(false);

    const updateForm = (key: string, value: string) => {
        setFormData((prev) => {
            const updates: Partial<typeof formData> = { [key]: value };

            // Auto-generate slug if business name changes and slug hasn't been manually edited
            if (key === 'businessName' && !isSlugEdited) {
                const firstWord = value.split(' ')[0] || '';
                updates.slug = firstWord
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens (though for first word, less likely needed)
                    .replace(/(^-|-$)/g, '');
            }

            return { ...prev, ...updates };
        });
    };

    const handleSlugChange = (text: string) => {
        setIsSlugEdited(true);
        // Basic sanitization for manual input (allow hyphens, lowercase)
        const sanitized = text.toLowerCase().replace(/[^a-z0-9-]/g, '');
        setFormData((prev) => ({ ...prev, slug: sanitized }));
    };

    const handleNext = () => {
        if (step === 1) {
            if (!formData.email || !formData.password || !formData.confirmPassword) {
                Alert.alert('Error', 'Please fill in all fields');
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                Alert.alert('Error', 'Passwords do not match');
                return;
            }
            if (formData.password.length < 8) {
                Alert.alert('Error', 'Password must be at least 8 characters');
                return;
            }
            setStep(2);
        }
    };

    const handleRegister = async () => {
        if (!formData.businessName || !formData.businessType) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (
            formData.businessType === 'other' &&
            !formData.otherBusinessType.trim()
        ) {
            Alert.alert('Error', 'Please specify your business type');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.email.toLowerCase(),
                    password: formData.password,
                    confirmPassword: formData.confirmPassword, // Required for Zod validation
                    businessName: formData.businessName,
                    businessType: formData.businessType,
                    otherBusinessType: formData.otherBusinessType,
                    slug: formData.slug || undefined, // Send slug if present
                    // Default branding for mobile quick-start
                    brandColors: JSON.stringify({
                        primary: '#000000',
                        background: '#ffffff',
                        accent: '#F59E0B',
                    }),
                    logoUrl: 'https://via.placeholder.com/150', // Placeholder for now, or add logo upload step later
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            // Check if user is already verified (e.g. if Supabase "Confirm Email" is disabled)
            if (data.user?.email_confirmed_at) {
                Alert.alert('Success', 'Account created!', [
                    { text: 'Continue', onPress: () => router.push('/(auth)/login') },
                ]);
            } else {
                // Navigate to verification
                router.push({
                    pathname: '/(auth)/verify',
                    params: { email: formData.email },
                });
            }
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Registration error:', err);
            Alert.alert(
                'Registration Failed',
                err.message || 'Please try again later.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#0D0D1A', '#1A1A2E']}
                style={StyleSheet.absoluteFillObject}
            />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Pressable
                        onPress={() => (step === 1 ? router.back() : setStep(1))}
                        style={styles.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Create Account</Text>
                    <View style={{ width: 24 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={styles.content}>
                        {/* Progress Indicator */}
                        <View style={styles.progressContainer}>
                            <View
                                style={[
                                    styles.progressBar,
                                    { width: step === 1 ? '50%' : '100%' },
                                ]}
                            />
                        </View>
                        <Text style={styles.stepText}>Step {step} of 2</Text>

                        {step === 1 ? (
                            // Step 1: Account Info
                            <View style={styles.formSection}>
                                <Text style={styles.sectionTitle}>Account Details</Text>
                                <Text style={styles.sectionValidation}>Required</Text>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Email Address</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="you@example.com"
                                        placeholderTextColor="#6B7280"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={formData.email}
                                        onChangeText={(t) => updateForm('email', t)}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Password</Text>
                                    <View style={styles.passwordContainer}>
                                        <TextInput
                                            style={styles.passwordInput}
                                            placeholder="••••••••"
                                            placeholderTextColor="#6B7280"
                                            secureTextEntry={!showPassword}
                                            value={formData.password}
                                            onChangeText={(t) => updateForm('password', t)}
                                        />
                                        <Pressable
                                            onPress={() => setShowPassword(!showPassword)}
                                            style={styles.eyeButton}
                                        >
                                            <Ionicons
                                                name={showPassword ? 'eye-off' : 'eye'}
                                                size={20}
                                                color="#9CA3AF"
                                            />
                                        </Pressable>
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Confirm Password</Text>
                                    <View style={styles.passwordContainer}>
                                        <TextInput
                                            style={styles.passwordInput}
                                            placeholder="••••••••"
                                            placeholderTextColor="#6B7280"
                                            secureTextEntry={!showPassword}
                                            value={formData.confirmPassword}
                                            onChangeText={(t) => updateForm('confirmPassword', t)}
                                        />
                                        <Pressable
                                            onPress={() => setShowPassword(!showPassword)} // Shared toggle for simplicity, or could separate
                                            style={styles.eyeButton}
                                        >
                                            <Ionicons
                                                name={showPassword ? 'eye-off' : 'eye'}
                                                size={20}
                                                color="#9CA3AF"
                                            />
                                        </Pressable>
                                    </View>
                                </View>

                                <Pressable style={styles.button} onPress={handleNext}>
                                    <Text style={styles.buttonText}>Next Step</Text>
                                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                                </Pressable>
                            </View>
                        ) : (
                            // Step 2: Business Info
                            <View style={styles.formSection}>
                                <Text style={styles.sectionTitle}>Business Info</Text>
                                <Text style={styles.sectionValidation}>
                                    Tell us about your store
                                </Text>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Business Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="My Awesome Store"
                                        placeholderTextColor="#6B7280"
                                        value={formData.businessName}
                                        onChangeText={(t) => updateForm('businessName', t)}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Store Link</Text>
                                    <View style={styles.urlInputContainer}>
                                        <TextInput
                                            style={[styles.urlInput, { textAlign: 'right' }]}
                                            placeholder="my-store"
                                            placeholderTextColor="#6B7280"
                                            autoCapitalize="none"
                                            value={formData.slug}
                                            onChangeText={handleSlugChange}
                                        />
                                        <Text style={styles.urlSuffix}>.usebaci.com</Text>
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Business Type</Text>
                                    <View style={styles.typeGrid}>
                                        {BUSINESS_TYPES.map((type) => (
                                            <Pressable
                                                key={type.id}
                                                style={[
                                                    styles.typeCard,
                                                    formData.businessType === type.id &&
                                                    styles.typeCardSelected,
                                                ]}
                                                onPress={() => updateForm('businessType', type.id)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.typeText,
                                                        formData.businessType === type.id &&
                                                        styles.typeTextSelected,
                                                    ]}
                                                >
                                                    {type.label}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>

                                {formData.businessType === 'Other' && (
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Please specify</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g. Pet Supplies"
                                            placeholderTextColor="#6B7280"
                                            value={formData.otherBusinessType}
                                            onChangeText={(text) =>
                                                updateForm('otherBusinessType', text)
                                            }
                                        />
                                    </View>
                                )}

                                <Pressable
                                    style={[styles.button, isLoading && { opacity: 0.7 }]}
                                    onPress={handleRegister}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <>
                                            <Text style={styles.buttonText}>Launch Store</Text>
                                            <Ionicons name="rocket-outline" size={20} color="#FFF" />
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DARK_COLORS.background,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    backButton: {
        padding: SPACING.xs,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: TYPOGRAPHY.size.lg,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
    },
    content: {
        padding: SPACING.lg,
    },
    progressContainer: {
        height: 4,
        backgroundColor: '#2A2A40',
        borderRadius: 2,
        marginBottom: SPACING.xs,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: DARK_COLORS.primary,
    },
    stepText: {
        color: '#9CA3AF',
        fontSize: TYPOGRAPHY.size.sm,
        marginBottom: SPACING.xl,
        textAlign: 'right',
    },
    formSection: {
        gap: SPACING.xl,
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: TYPOGRAPHY.size['3xl'],
        fontFamily: TYPOGRAPHY.fontFamily.bold,
    },
    sectionValidation: {
        color: '#9CA3AF',
        fontSize: TYPOGRAPHY.size.md,
        marginTop: -SPACING.lg, // Pull up closer to title
    },
    inputGroup: {
        gap: SPACING.sm,
    },
    label: {
        color: '#E2E8F0',
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
    },
    input: {
        backgroundColor: DARK_COLORS.inputBg,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        color: '#FFF',
        fontSize: TYPOGRAPHY.size.md,
        borderWidth: 1,
        borderColor: DARK_COLORS.border,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: DARK_COLORS.inputBg,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: DARK_COLORS.border,
    },
    passwordInput: {
        flex: 1,
        padding: SPACING.md,
        color: '#FFF',
        fontSize: TYPOGRAPHY.size.md,
    },
    eyeButton: {
        padding: SPACING.md,
    },
    button: {
        backgroundColor: DARK_COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', // Center content horizontally
        paddingVertical: 16, // Increase padding for touch target
        borderRadius: RADIUS.full,
        marginTop: SPACING.lg,
        gap: SPACING.sm,
        shadowColor: DARK_COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#FFF',
        fontSize: TYPOGRAPHY.size.lg,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    typeCard: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: RADIUS.full,
        borderWidth: 1,
        borderColor: DARK_COLORS.border,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    typeCardSelected: {
        backgroundColor: DARK_COLORS.primary,
        borderColor: DARK_COLORS.primary,
    },
    typeText: {
        color: '#9CA3AF',
        fontSize: TYPOGRAPHY.size.sm,
    },
    typeTextSelected: {
        color: '#FFF',
        fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    },
    urlInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: DARK_COLORS.inputBg,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: DARK_COLORS.border,
        overflow: 'hidden',
    },
    urlSuffix: {
        color: '#9CA3AF',
        paddingRight: SPACING.md,
        paddingLeft: SPACING.xs,
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        backgroundColor: 'rgba(255,255,255,0.05)',
        height: '100%',
        textAlignVertical: 'center',
        paddingVertical: SPACING.md, // Match input padding
    },
    urlInput: {
        flex: 1,
        color: '#FFF',
        padding: SPACING.md,
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
    },
});
