/**
 * Shipping Settings Screen
 * Configure shipping providers and delivery settings
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    StatusBar,
    Linking,
    ActivityIndicator,
    Switch,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

interface ShippingSettings {
    merchant_id: string;
    shipping_providers: string[];
    free_shipping_threshold: number | null;
}

interface ShippingProvider {
    id: string;
    name: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
}

const AVAILABLE_PROVIDERS: ShippingProvider[] = [
    {
        id: 'gigl',
        name: 'GIG Logistics',
        description: 'Nationwide delivery with tracking',
        icon: 'cube-outline',
    },
    {
        id: 'topship',
        name: 'Topship',
        description: 'Fast local and international shipping',
        icon: 'airplane-outline',
    },
    {
        id: 'shiip',
        name: 'Shiip',
        description: 'Same-day and next-day delivery',
        icon: 'flash-outline',
    },
];

export default function ShippingScreen() {
    const { colors, shadows, isDark } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

    // Fetch shipping settings
    const { data: settings, isLoading } = useQuery({
        queryKey: ['shipping-settings', user?.id],
        queryFn: async () => {
            const { data: merchant } = await supabase
                .from('merchants')
                .select('id')
                .eq('user_id', user!.id)
                .single();

            if (!merchant) throw new Error('No merchant found');

            const { data, error } = await supabase
                .from('merchant_feature_settings')
                .select('merchant_id, shipping_providers, free_shipping_threshold')
                .eq('merchant_id', merchant.id)
                .single();

            if (error) throw error;
            return data as ShippingSettings;
        },
        enabled: !!user?.id,
    });

    // Toggle provider mutation
    const toggleProviderMutation = useMutation({
        mutationFn: async ({ providerId, enabled }: { providerId: string; enabled: boolean }) => {
            if (!settings?.merchant_id) throw new Error('No settings found');

            const currentProviders = settings.shipping_providers || [];
            let newProviders: string[];

            if (enabled) {
                newProviders = [...currentProviders, providerId];
            } else {
                newProviders = currentProviders.filter(p => p !== providerId);
            }

            const { error } = await supabase
                .from('merchant_feature_settings')
                .update({ shipping_providers: newProviders })
                .eq('merchant_id', settings.merchant_id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shipping-settings'] });
        },
        onError: (error) => {
            Alert.alert('Error', 'Failed to update shipping provider');
        },
    });

    const handleManageShipping = () => {
        Linking.openURL('https://usebaci.com/dashboard/settings/shipping');
    };

    const isProviderEnabled = (providerId: string) => {
        return settings?.shipping_providers?.includes(providerId) ?? false;
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const enabledCount = settings?.shipping_providers?.length ?? 0;

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Shipping',
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </Pressable>
                    ),
                }}
            />
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {/* Shipping Providers Section */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Shipping Providers</Text>
                            <View style={[styles.countBadge, { backgroundColor: colors.primaryLight || colors.cardHover }]}>
                                <Text style={[styles.countText, { color: colors.primary }]}>{enabledCount} active</Text>
                            </View>
                        </View>
                        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                            Enable providers to offer customers real-time shipping rates at checkout.
                        </Text>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {AVAILABLE_PROVIDERS.map((provider, index) => {
                            const enabled = isProviderEnabled(provider.id);
                            return (
                                <View key={provider.id}>
                                    {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                                    <View style={styles.providerRow}>
                                        <View style={[
                                            styles.providerIcon,
                                            { backgroundColor: enabled ? (colors.successLight || '#E8F5E9') : colors.cardHover }
                                        ]}>
                                            <Ionicons
                                                name={provider.icon}
                                                size={24}
                                                color={enabled ? colors.success : colors.textMuted}
                                            />
                                        </View>
                                        <View style={styles.providerInfo}>
                                            <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
                                            <Text style={[styles.providerDescription, { color: colors.textSecondary }]}>
                                                {provider.description}
                                            </Text>
                                        </View>
                                        <Switch
                                            value={enabled}
                                            onValueChange={(value) => toggleProviderMutation.mutate({
                                                providerId: provider.id,
                                                enabled: value
                                            })}
                                            trackColor={{ false: colors.border, true: colors.primary }}
                                            thumbColor="#FFFFFF"
                                            disabled={toggleProviderMutation.isPending}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Free Shipping Card */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <View style={styles.featureRow}>
                            <View style={[styles.featureIcon, { backgroundColor: colors.cardHover }]}>
                                <Ionicons name="gift-outline" size={24} color={colors.primary} />
                            </View>
                            <View style={styles.featureInfo}>
                                <Text style={[styles.featureTitle, { color: colors.text }]}>Free Shipping</Text>
                                <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                                    {settings?.free_shipping_threshold
                                        ? `Orders above ₦${settings.free_shipping_threshold.toLocaleString()}`
                                        : 'Not configured'}
                                </Text>
                            </View>
                            <View style={[
                                styles.statusBadge,
                                { backgroundColor: settings?.free_shipping_threshold ? colors.successLight : colors.cardHover }
                            ]}>
                                <Text style={[
                                    styles.statusText,
                                    { color: settings?.free_shipping_threshold ? colors.success : colors.textMuted }
                                ]}>
                                    {settings?.free_shipping_threshold ? 'On' : 'Off'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Info Notice */}
                    <View style={[styles.notice, { backgroundColor: colors.infoLight || '#EFF6FF' }]}>
                        <Ionicons name="information-circle" size={20} color={colors.info || '#3B82F6'} />
                        <Text style={[styles.noticeText, { color: colors.info || '#3B82F6' }]}>
                            Configure API keys and advanced shipping rules on the web dashboard.
                        </Text>
                    </View>

                    {/* Manage Button */}
                    <Pressable
                        style={[styles.manageButton, { backgroundColor: colors.primary }]}
                        onPress={handleManageShipping}
                    >
                        <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.manageButtonText}>Advanced Settings</Text>
                    </Pressable>
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
    scrollView: { flex: 1 },
    scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
    card: { borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: TYPOGRAPHY.size.lg, fontFamily: TYPOGRAPHY.fontFamily.bold },
    sectionDescription: {
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
        marginTop: SPACING.xs,
        lineHeight: 20,
    },
    countBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.full
    },
    countText: { fontSize: TYPOGRAPHY.size.xs, fontFamily: TYPOGRAPHY.fontFamily.semiBold },
    divider: { height: 1, marginVertical: SPACING.md },
    providerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    providerIcon: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    providerInfo: { flex: 1 },
    providerName: { fontSize: TYPOGRAPHY.size.md, fontFamily: TYPOGRAPHY.fontFamily.semiBold },
    providerDescription: { fontSize: TYPOGRAPHY.size.sm, fontFamily: TYPOGRAPHY.fontFamily.regular, marginTop: 2 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureInfo: { flex: 1 },
    featureTitle: { fontSize: TYPOGRAPHY.size.md, fontFamily: TYPOGRAPHY.fontFamily.semiBold },
    featureDescription: { fontSize: TYPOGRAPHY.size.sm, fontFamily: TYPOGRAPHY.fontFamily.regular, marginTop: 2 },
    statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
    statusText: { fontSize: TYPOGRAPHY.size.xs, fontFamily: TYPOGRAPHY.fontFamily.semiBold },
    notice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.lg,
    },
    noticeText: { flex: 1, fontSize: TYPOGRAPHY.size.sm, fontFamily: TYPOGRAPHY.fontFamily.regular, lineHeight: 20 },
    manageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        padding: SPACING.lg,
        borderRadius: RADIUS.lg,
    },
    manageButtonText: { color: '#FFFFFF', fontSize: TYPOGRAPHY.size.md, fontFamily: TYPOGRAPHY.fontFamily.semiBold },
});
