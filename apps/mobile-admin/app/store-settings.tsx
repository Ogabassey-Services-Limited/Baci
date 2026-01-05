/**
 * Store Settings Screen
 * Configure store name, logo, and details
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    StatusBar,
    TextInput,
    Alert,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

import * as ImagePicker from 'expo-image-picker';

interface MerchantSettings {
    id: string;
    business_name: string | null;
    phone: string | null;
    email: string | null;
    logo_url: string | null;
    slug: string | null;
    business_address: string | null;
    support_email: string | null;
    support_phone: string | null;
}

export default function StoreSettingsScreen() {
    const { colors, shadows, isDark } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);

    // Fetch full merchant settings
    const { data: merchant, isLoading } = useQuery({
        queryKey: ['merchant-settings', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('merchants')
                .select('id, business_name, phone, email, logo_url, slug, business_address, support_email, support_phone')
                .eq('user_id', user!.id)
                .single();
            if (error) throw error;
            return data as MerchantSettings;
        },
        enabled: !!user?.id,
    });

    // Form state
    const [businessName, setBusinessName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');

    // Sync form with fetched data
    useEffect(() => {
        if (merchant) {
            setBusinessName(merchant.business_name || '');
            setPhone(merchant.phone || merchant.support_phone || '');
            setEmail(merchant.email || merchant.support_email || '');
            setAddress(merchant.business_address || '');
        }
    }, [merchant]);

    // Handle Image Pick and Upload
    const handleImagePick = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                await uploadLogo(asset.uri);
            }
        } catch (error) {
            console.error('Pick image error:', error);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadLogo = async (uri: string) => {
        if (!merchant?.id) return;
        setIsUploading(true);

        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${merchant.id}/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(filePath, blob, {
                    contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(filePath);

            // Update merchant logo_url
            const { error: updateError } = await supabase
                .from('merchants')
                .update({ logo_url: publicUrl })
                .eq('id', merchant.id);

            if (updateError) throw updateError;

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['merchant'] });
            queryClient.invalidateQueries({ queryKey: ['merchant-settings'] });

            Alert.alert('Success', 'Logo updated successfully');
        } catch (error: any) {
            console.error('Upload error:', error);
            Alert.alert('Error', error.message || 'Failed to upload logo');
        } finally {
            setIsUploading(false);
        }
    };

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!merchant?.id) throw new Error('No merchant found');
            const { error } = await supabase
                .from('merchants')
                .update({
                    business_name: businessName,
                    phone: phone,
                    support_phone: phone,
                    support_email: email,
                    business_address: address,
                })
                .eq('id', merchant.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['merchant'] });
            queryClient.invalidateQueries({ queryKey: ['merchant-settings'] });
            Alert.alert('Success', 'Store settings updated successfully');
        },
        onError: () => {
            Alert.alert('Error', 'Failed to update store settings');
        },
    });

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Store Settings',
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </Pressable>
                    ),
                    headerRight: () => (
                        <Pressable onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending} style={styles.saveButton}>
                            {saveMutation.isPending ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
                            )}
                        </Pressable>
                    ),
                }}
            />
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {/* Logo Section */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Store Logo</Text>
                        <View style={styles.logoContainer}>
                            {merchant?.logo_url ? (
                                <Image source={{ uri: merchant.logo_url }} style={styles.logo} resizeMode="contain" />
                            ) : (
                                <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.logoPlaceholderText}>
                                        {businessName.charAt(0).toUpperCase() || 'S'}
                                    </Text>
                                </View>
                            )}
                            <Pressable
                                style={[styles.changeLogoButton, { borderColor: colors.border }]}
                                onPress={handleImagePick}
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <>
                                        <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
                                        <Text style={[styles.changeLogoText, { color: colors.textSecondary }]}>Change</Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    </View>

                    {/* Business Name */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Business Name</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                            value={businessName}
                            onChangeText={setBusinessName}
                            placeholder="Enter business name"
                            placeholderTextColor={colors.textMuted}
                        />
                    </View>

                    {/* Phone */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="Enter phone number"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="phone-pad"
                        />
                    </View>

                    {/* Email */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Support Email</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter support email"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Address */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Business Address</Text>
                        <TextInput
                            style={[styles.input, styles.multilineInput, { color: colors.text, borderColor: colors.border }]}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Enter business address"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Store URL (Read-only) */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Store URL</Text>
                        <View style={[styles.urlContainer, { backgroundColor: colors.cardHover }]}>
                            <Text style={[styles.urlText, { color: colors.text }]}>
                                {merchant?.slug}.usebaci.com
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
    saveButton: { padding: SPACING.sm },
    saveText: { fontSize: TYPOGRAPHY.size.md, fontFamily: TYPOGRAPHY.fontFamily.semiBold },
    scrollView: { flex: 1 },
    scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
    card: { borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg },
    label: { fontSize: TYPOGRAPHY.size.sm, fontFamily: TYPOGRAPHY.fontFamily.medium, marginBottom: SPACING.sm },
    input: {
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
        borderWidth: 1,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
    },
    multilineInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
    logo: { width: 80, height: 80, borderRadius: RADIUS.lg },
    logoPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: RADIUS.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoPlaceholderText: { fontSize: 32, fontFamily: TYPOGRAPHY.fontFamily.bold, color: '#FFFFFF' },
    changeLogoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderWidth: 1,
        borderRadius: RADIUS.md,
    },
    changeLogoText: { fontSize: TYPOGRAPHY.size.sm, fontFamily: TYPOGRAPHY.fontFamily.medium },
    urlContainer: { padding: SPACING.md, borderRadius: RADIUS.md },
    urlText: { fontSize: TYPOGRAPHY.size.md, fontFamily: TYPOGRAPHY.fontFamily.medium },
});
