/**
 * Tax Settings Screen
 * Configure VAT settings for the merchant
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    StatusBar,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

export default function TaxScreen() {
    const { colors, shadows, isDark } = useTheme();
    const { merchant, isLoading } = useMerchant();
    const router = useRouter();
    const queryClient = useQueryClient();

    // Local state for optimistic UI
    const [vatEnabled, setVatEnabled] = useState(
        merchant?.vat_registration_status === 'registered'
    );

    // Update VAT status mutation
    const updateVatMutation = useMutation({
        mutationFn: async (enabled: boolean) => {
            if (!merchant?.id) throw new Error('No merchant found');

            const { error } = await supabase
                .from('merchants')
                .update({
                    vat_registration_status: enabled ? 'registered' : 'not_registered'
                })
                .eq('id', merchant.id);

            if (error) throw error;
            return enabled;
        },
        onMutate: async (enabled) => {
            // Optimistic update
            setVatEnabled(enabled);
        },
        onSuccess: (enabled) => {
            queryClient.invalidateQueries({ queryKey: ['merchant'] });
            Alert.alert(
                'Success',
                enabled
                    ? 'VAT has been enabled. 7.5% VAT will be applied to all orders.'
                    : 'VAT has been disabled.'
            );
        },
        onError: (error, enabled) => {
            // Revert on error
            setVatEnabled(!enabled);
            Alert.alert('Error', 'Failed to update VAT settings. Please try again.');
        },
    });

    const handleToggleVat = () => {
        const newValue = !vatEnabled;

        Alert.alert(
            newValue ? 'Enable VAT?' : 'Disable VAT?',
            newValue
                ? '7.5% VAT will be added to all orders. Make sure you are registered with FIRS before enabling.'
                : 'VAT will no longer be applied to orders.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: newValue ? 'Enable' : 'Disable',
                    style: newValue ? 'default' : 'destructive',
                    onPress: () => updateVatMutation.mutate(newValue),
                },
            ]
        );
    };

    // Sync local state when merchant data loads
    React.useEffect(() => {
        if (merchant) {
            setVatEnabled(merchant.vat_registration_status === 'registered');
        }
    }, [merchant?.vat_registration_status]);

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
                    title: 'Tax Settings',
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </Pressable>
                    ),
                }}
            />
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* VAT Status Card */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: vatEnabled ? colors.successLight : colors.cardHover }]}>
                                <Ionicons
                                    name="receipt-outline"
                                    size={24}
                                    color={vatEnabled ? colors.success : colors.textSecondary}
                                />
                            </View>
                            <View style={styles.cardHeaderText}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>VAT Collection</Text>
                                <View style={[
                                    styles.statusBadge,
                                    { backgroundColor: vatEnabled ? colors.successLight : colors.cardHover }
                                ]}>
                                    <View style={[
                                        styles.statusDot,
                                        { backgroundColor: vatEnabled ? colors.success : colors.textMuted }
                                    ]} />
                                    <Text style={[
                                        styles.statusText,
                                        { color: vatEnabled ? colors.success : colors.textMuted }
                                    ]}>
                                        {vatEnabled ? 'Enabled' : 'Disabled'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {/* Toggle Row */}
                        <Pressable
                            style={styles.toggleRow}
                            onPress={handleToggleVat}
                            disabled={updateVatMutation.isPending}
                        >
                            <View style={styles.toggleInfo}>
                                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                                    Charge 7.5% VAT
                                </Text>
                                <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                                    Applied to all orders at checkout
                                </Text>
                            </View>
                            <View style={styles.toggleContainer}>
                                {updateVatMutation.isPending ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <View style={[
                                        styles.toggle,
                                        vatEnabled && styles.toggleActive,
                                        { backgroundColor: vatEnabled ? colors.success : colors.cardHover }
                                    ]}>
                                        <View style={[
                                            styles.toggleThumb,
                                            vatEnabled && styles.toggleThumbActive,
                                        ]} />
                                    </View>
                                )}
                            </View>
                        </Pressable>
                    </View>

                    {/* VAT Rate Info */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>VAT Rate</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>7.5%</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Country</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>Nigeria 🇳🇬</Text>
                        </View>
                    </View>

                    {/* Info Notice */}
                    <View style={[styles.notice, { backgroundColor: colors.infoLight || '#EFF6FF' }]}>
                        <Ionicons name="information-circle" size={20} color={colors.info || '#3B82F6'} />
                        <Text style={[styles.noticeText, { color: colors.info || '#3B82F6' }]}>
                            VAT is automatically calculated and shown separately on invoices. Ensure you are registered with FIRS before enabling VAT collection.
                        </Text>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButton: {
        padding: SPACING.sm,
        marginLeft: -SPACING.sm,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: SPACING.lg,
        paddingBottom: SPACING['3xl'],
    },
    card: {
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.lg,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        marginBottom: SPACING.md,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardHeaderText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        marginBottom: SPACING.xs,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.full,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: TYPOGRAPHY.size.xs,
        fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    },
    divider: {
        height: 1,
        marginVertical: SPACING.md,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleInfo: {
        flex: 1,
    },
    toggleLabel: {
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.semiBold,
        marginBottom: 2,
    },
    toggleDescription: {
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
    },
    toggleContainer: {
        width: 52,
        height: 32,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    toggle: {
        width: 52,
        height: 32,
        borderRadius: 16,
        padding: 2,
        justifyContent: 'center',
    },
    toggleActive: {},
    toggleThumb: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleThumbActive: {
        alignSelf: 'flex-end',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.xs,
    },
    infoLabel: {
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
    },
    infoValue: {
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    },
    notice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
    },
    noticeText: {
        flex: 1,
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
        lineHeight: 20,
    },
});
