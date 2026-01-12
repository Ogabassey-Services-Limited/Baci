/**
 * Payment Methods Screen
 * Displays actual payment settings from database
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

interface PaymentSettings {
    id: string;
    merchant_id: string;
    paystack_enabled: boolean;
    korapay_enabled: boolean;
    credit_direct_enabled: boolean;
    credpal_enabled: boolean;
    pay_on_delivery_enabled: boolean;
    pay_on_delivery_limit?: number | null;
    juicyway_enabled: boolean;
}

interface PaymentMethod {
    id: string;
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    description: string;
    dbField: keyof PaymentSettings;
    category: 'gateway' | 'bnpl' | 'offline';
}

export default function PaymentMethodsScreen() {
    const { colors, shadows, isDark } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

    // Fetch actual payment settings
    const { data: settings, isLoading } = useQuery({
        queryKey: ['payment-settings', user?.id],
        queryFn: async () => {
            // First get merchant ID
            const { data: merchant } = await supabase
                .from('merchants')
                .select('id')
                .eq('user_id', user!.id)
                .single();

            if (!merchant) throw new Error('No merchant found');

            const { data, error } = await supabase
                .from('merchant_feature_settings')
                .select('id, merchant_id, paystack_enabled, korapay_enabled, credit_direct_enabled, credpal_enabled, pay_on_delivery_enabled, juicyway_enabled')
                .eq('merchant_id', merchant.id)
                .single();

            if (error) throw error;
            return data as PaymentSettings;
        },
        enabled: !!user?.id,
    });

    // Toggle mutation with Optimistic Updates (2026 Best Practice)
    const toggleMutation = useMutation({
        mutationFn: async ({ field, value }: { field: keyof PaymentSettings; value: boolean }) => {
            if (!settings?.id) throw new Error('No settings found');
            const { error } = await supabase
                .from('merchant_feature_settings')
                .update({ [field]: value })
                .eq('id', settings.id);
            if (error) throw error;
        },
        onMutate: async ({ field, value }) => {
            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['payment-settings', user?.id] });

            // Snapshot the previous value
            const previousSettings = queryClient.getQueryData(['payment-settings', user?.id]);

            // Optimistically update to the new value
            queryClient.setQueryData(['payment-settings', user?.id], (old: PaymentSettings | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    [field]: value,
                };
            });

            // Return a context object with the snapshotted value
            return { previousSettings };
        },
        onError: (error, variables, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousSettings) {
                queryClient.setQueryData(['payment-settings', user?.id], context.previousSettings);
            }
            // @ts-ignore
            const msg = error?.message || 'Failed to update setting';
            Alert.alert('Error', msg);
        },
        onSettled: () => {
            // Always refetch after error or success:
            queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
        },
    });

    const paymentMethods: PaymentMethod[] = [
        // Payment Gateways
        {
            id: 'paystack',
            name: 'Paystack',
            icon: 'card-outline',
            description: 'Cards, bank transfer, USSD & mobile money',
            dbField: 'paystack_enabled',
            category: 'gateway',
        },
        {
            id: 'korapay',
            name: 'Korapay',
            icon: 'wallet-outline',
            description: 'Card payments and bank transfers',
            dbField: 'korapay_enabled',
            category: 'gateway',
        },
        {
            id: 'juicyway',
            name: 'Juicy Way',
            icon: 'flash-outline',
            description: 'Crypto/Stablecoin payments',
            dbField: 'juicyway_enabled',
            category: 'gateway',
        },
        // BNPL Options
        {
            id: 'credpal',
            name: 'CredPal',
            icon: 'calendar-outline',
            description: 'Buy now, pay later in installments',
            dbField: 'credpal_enabled',
            category: 'bnpl',
        },
        {
            id: 'credit_direct',
            name: 'Credit Direct',
            icon: 'time-outline',
            description: 'Flexible BNPL payment plans',
            dbField: 'credit_direct_enabled',
            category: 'bnpl',
        },
        // Offline
        {
            id: 'pay_on_delivery',
            name: 'Pay on Delivery',
            icon: 'cash-outline',
            description: 'Cash payment when order arrives',
            dbField: 'pay_on_delivery_enabled',
            category: 'offline',
        },
    ];

    const handleManagePayments = () => {
        Linking.openURL('https://usebaci.com/dashboard/settings/payments');
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

    const renderSection = (title: string, category: 'gateway' | 'bnpl' | 'offline') => {
        const methods = paymentMethods.filter(m => m.category === category);
        return (
            <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
                {methods.map((method, index) => {
                    const isEnabled = settings?.[method.dbField] as boolean ?? false;
                    return (
                        <View key={method.id}>
                            {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                            <View style={styles.methodRow}>
                                <View style={[styles.methodIcon, { backgroundColor: isEnabled ? (colors.successLight || '#E8F5E9') : colors.cardHover }]}>
                                    <Ionicons name={method.icon} size={24} color={isEnabled ? colors.success : colors.textMuted} />
                                </View>
                                <View style={styles.methodInfo}>
                                    <Text style={[styles.methodName, { color: colors.text }]}>{method.name}</Text>
                                    <Text style={[styles.methodDescription, { color: colors.textSecondary }]}>
                                        {method.description}
                                    </Text>
                                </View>
                                <Switch
                                    value={isEnabled}
                                    onValueChange={(value) => toggleMutation.mutate({ field: method.dbField, value })}
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                    thumbColor="#FFFFFF"
                                    disabled={toggleMutation.isPending}
                                />
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Payment Methods',
                    // Native back button will be used
                }}
            />
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {renderSection('Payment Gateways', 'gateway')}
                    {renderSection('Buy Now, Pay Later', 'bnpl')}
                    {renderSection('Offline Payments', 'offline')}

                    {/* Info Notice */}
                    <View style={[styles.notice, { backgroundColor: colors.infoLight || '#EFF6FF' }]}>
                        <Ionicons name="information-circle" size={20} color={colors.info || '#3B82F6'} />
                        <Text style={[styles.noticeText, { color: colors.info || '#3B82F6' }]}>
                            API keys and webhook configuration available on web dashboard.
                        </Text>
                    </View>

                    {/* Manage Button */}
                    <Pressable
                        style={[styles.manageButton, { backgroundColor: colors.primary }]}
                        onPress={handleManagePayments}
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
    sectionTitle: {
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        marginBottom: SPACING.md,
    },
    divider: { height: 1, marginVertical: SPACING.md },
    methodRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    methodIcon: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    methodInfo: { flex: 1 },
    methodName: { fontSize: TYPOGRAPHY.size.md, fontFamily: TYPOGRAPHY.fontFamily.semiBold },
    methodDescription: { fontSize: TYPOGRAPHY.size.sm, fontFamily: TYPOGRAPHY.fontFamily.regular, marginTop: 2 },
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
