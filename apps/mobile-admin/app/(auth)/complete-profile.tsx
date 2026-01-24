import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { DARK_COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { supabase } from '@/lib/supabase';


import { useOnboarding } from '@/hooks/useOnboarding';

// Simplified Business Types
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



export default function CompleteProfileScreen() {
    const router = useRouter();

    const { completeProfile, isLoading } = useOnboarding();
    const [isInitializing, setIsInitializing] = useState(true);

    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        businessName: '',
        businessType: '',
        otherBusinessType: '',
        slug: '',
        email: '',
        logoUrl: '',
    });
    const [isSlugEdited, setIsSlugEdited] = useState(false);

    // Prefill Data on Mount
    useEffect(() => {
        async function prefillData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    console.log('User metadata:', user.user_metadata);
                    const metadata = user.user_metadata || {};
                    const metadataFullName = metadata.full_name || metadata.name || '';
                    const avatarUrl = metadata.avatar_url || metadata.picture || '';

                    // Default business name to user's name if available (e.g. "John's Store")
                    // Logic: "John Doe" -> "John" -> "John's Store"
                    // Or just use full name for now and let them edit
                    const suggestedName = metadataFullName ? `${metadataFullName.split(' ')[0]}'s Store` : '';

                    // Generate slug from suggested name
                    const suggestedSlug = suggestedName
                        ? suggestedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                        : '';

                    setFormData(prev => ({
                        ...prev,
                        fullName: metadataFullName,
                        email: user.email || '',
                        businessName: suggestedName,
                        slug: suggestedSlug,
                        logoUrl: avatarUrl,
                    }));
                }
            } catch (e) {
                console.error('Error prefilling data:', e);
            } finally {
                setIsInitializing(false);
            }
        }
        prefillData();
    }, []);

    const updateForm = (key: string, value: string) => {
        setFormData((prev) => {
            const updates: Partial<typeof formData> = { [key]: value };

            // Auto-generate slug if business name changes and slug hasn't been manually edited
            if (key === 'businessName' && !isSlugEdited) {
                const slugBase = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                updates.slug = slugBase;
            }

            return { ...prev, ...updates };
        });
    };

    const handleSlugChange = (text: string) => {
        setIsSlugEdited(true);
        const sanitized = text.toLowerCase().replace(/[^a-z0-9-]/g, '');
        setFormData((prev) => ({ ...prev, slug: sanitized }));
    };

    const handleCompleteSetup = async () => {
        if (!formData.businessName || !formData.businessType || !formData.fullName) {
            Alert.alert('Error', 'Please fill in all required fields (Name, Business Name, Type)');
            return;
        }

        if (formData.businessType === 'other' && !formData.otherBusinessType.trim()) {
            Alert.alert('Error', 'Please specify your business type');
            return;
        }

        completeProfile.mutate({
            fullName: formData.fullName,
            phone: formData.phone,
            email: formData.email,
            businessName: formData.businessName,
            businessType: formData.businessType,
            otherBusinessType: formData.otherBusinessType,
            slug: formData.slug || undefined,
            logoUrl: formData.logoUrl || 'https://via.placeholder.com/150',
            brandColors: JSON.stringify({
                primary: '#000000',
                background: '#ffffff',
                accent: '#F59E0B',
            }),
        }, {
            onSuccess: () => {
                Alert.alert('Success', 'Store created!', [
                    { text: 'Go to Dashboard', onPress: () => router.replace('/(admin)/(tabs)') },
                ]);
            },
            onError: (error) => {
                console.error('Setup error:', error);
                Alert.alert('Setup Failed', error.message || 'Please try again later.');
            }
        });
    };

    if (isInitializing) {
        return (
            <View style={{ flex: 1, backgroundColor: DARK_COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={DARK_COLORS.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#0D0D1A', '#1A1A2E']}
                style={StyleSheet.absoluteFillObject}
            />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    {/* No back button, this is a forced step */}
                    <View />
                    <Text style={styles.headerTitle}>Complete Setup</Text>
                    <View style={{ width: 24 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={styles.content}>
                        <View style={styles.introSection}>
                            {formData.logoUrl ? (
                                <Image source={{ uri: formData.logoUrl }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Ionicons name="storefront-outline" size={40} color={DARK_COLORS.textSecondary} />
                                </View>
                            )}
                            <Text style={styles.introTitle}>Welcome{formData.fullName ? `, ${formData.fullName.split(' ')[0]}` : ''}!</Text>
                            <Text style={styles.introText}>Let's finish setting up your profile and store.</Text>
                        </View>

                        <View style={styles.formSection}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Your Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="John Doe"
                                    placeholderTextColor="#6B7280"
                                    value={formData.fullName}
                                    onChangeText={(t) => updateForm('fullName', t)}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Phone Number (Optional)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="+1 234 567 8900"
                                    placeholderTextColor="#6B7280"
                                    value={formData.phone}
                                    onChangeText={(t) => updateForm('phone', t)}
                                    keyboardType="phone-pad"
                                />
                            </View>

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
                                                formData.businessType === type.id && styles.typeCardSelected,
                                            ]}
                                            onPress={() => updateForm('businessType', type.id)}
                                        >
                                            <Text
                                                style={[
                                                    styles.typeText,
                                                    formData.businessType === type.id && styles.typeTextSelected,
                                                ]}
                                            >
                                                {type.label}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {formData.businessType === 'other' && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Please specify</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Pet Supplies"
                                        placeholderTextColor="#6B7280"
                                        value={formData.otherBusinessType}
                                        onChangeText={(text) => updateForm('otherBusinessType', text)}
                                    />
                                </View>
                            )}

                            <Pressable
                                style={[styles.button, isLoading && { opacity: 0.7 }]}
                                onPress={handleCompleteSetup}
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
    headerTitle: {
        color: '#FFF',
        fontSize: TYPOGRAPHY.size.lg,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
    },
    content: {
        padding: SPACING.lg,
    },
    introSection: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: RADIUS.full,
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: DARK_COLORS.primary,
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: RADIUS.full,
        backgroundColor: DARK_COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    introTitle: {
        color: '#FFF',
        fontSize: TYPOGRAPHY.size.xl,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        marginBottom: SPACING.xs,
    },
    introText: {
        color: DARK_COLORS.textSecondary,
        fontSize: TYPOGRAPHY.size.md,
        textAlign: 'center',
    },
    formSection: {
        gap: SPACING.xl,
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
    button: {
        backgroundColor: DARK_COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: RADIUS.full,
        marginTop: SPACING.lg,
        gap: SPACING.sm,
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
        paddingVertical: SPACING.md,
    },
    urlInput: {
        flex: 1,
        color: '#FFF',
        padding: SPACING.md,
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
    },
});
