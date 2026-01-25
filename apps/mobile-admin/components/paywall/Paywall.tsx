import { FlashList } from '@shopify/flash-list';
import React, { useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useTheme } from '@/hooks/useTheme';

interface PaywallProps {
    onClose?: () => void;
}

export default function Paywall({ onClose }: PaywallProps) {
    const { colors, shadows } = useTheme();
    const {
        currentOffering,
        purchasePackage,
        restorePurchases,
        isPro,
        isLoading,
        error,
    } = useRevenueCat();

    useEffect(() => {
        if (error) {
            Alert.alert('Error', error);
        }
    }, [error]);

    const onPurchase = async (pack: PurchasesPackage) => {
        const success = await purchasePackage(pack);
        if (success) {
            Alert.alert('Success', 'You are now a Pro member!', [
                { text: 'OK', onPress: onClose },
            ]);
        }
    };

    const onRestore = async () => {
        const success = await restorePurchases();
        if (success) {
            Alert.alert('Restored', 'Your purchases have been restored.', [
                { text: 'OK', onPress: onClose },
            ]);
        } else {
            Alert.alert('Notice', 'No active subscriptions found to restore.');
        }
    };

    const openTerms = () => {
        // Replace with actual Baci terms URL
        Linking.openURL('https://usebaci.com/legal/terms');
    };

    const openPrivacy = () => {
        // Replace with actual Baci privacy URL
        Linking.openURL('https://usebaci.com/legal/privacy');
    };

    const renderPackage = ({ item }: { item: PurchasesPackage }) => {
        const isMonthly = item.packageType === 'MONTHLY';

        return (
            <Pressable
                onPress={() => onPurchase(item)}
                style={({ pressed }) => [
                    styles.packageCard,
                    {
                        backgroundColor: colors.card,
                        borderColor: isMonthly ? colors.primary : colors.border,
                        transform: [{ scale: pressed ? 0.98 : 1 }]
                    },
                    shadows.md,
                    isMonthly && styles.featuredCard
                ]}
            >
                {isMonthly && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>MOST POPULAR</Text>
                    </View>
                )}

                <View style={styles.packageContent}>
                    <Text style={[styles.packageTitle, { color: colors.text }]}>
                        {item.product.title}
                    </Text>
                    <Text style={[styles.packageDesc, { color: colors.textSecondary }]}>
                        {item.product.description}
                    </Text>
                    <Text style={[styles.packagePrice, { color: colors.primary }]}>
                        {item.product.priceString}
                    </Text>
                </View>

                <View style={[styles.button, { backgroundColor: colors.primary }]}>
                    <Text style={styles.buttonText}>
                        {isPro ? 'Manage' : 'Subscribe'}
                    </Text>
                </View>
            </Pressable>
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>
                    Upgrade to Pro
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Unlock advanced analytics, custom themes, and more.
                </Text>
            </View>

            {/* Packages List */}
            <FlashList
                data={currentOffering?.availablePackages || []}
                renderItem={renderPackage}
                estimatedItemSize={200}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No subscriptions available at the moment.
                    </Text>
                }
            />

            {/* Footer / Legal */}
            <View style={styles.footer}>
                <Pressable onPress={onRestore} style={styles.linkButton}>
                    <Text style={[styles.linkText, { color: colors.textSecondary }]}>
                        Restore Purchases
                    </Text>
                </Pressable>

                <View style={styles.legalRow}>
                    <Pressable onPress={openTerms}>
                        <Text style={[styles.legalText, { color: colors.textMuted }]}>Terms of Service</Text>
                    </Pressable>
                    <Text style={[styles.legalText, { color: colors.textMuted }]}>•</Text>
                    <Pressable onPress={openPrivacy}>
                        <Text style={[styles.legalText, { color: colors.textMuted }]}>Privacy Policy</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    title: {
        fontSize: TYPOGRAPHY.size['2xl'],
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        marginBottom: SPACING.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
        textAlign: 'center',
        paddingHorizontal: SPACING.lg,
    },
    listContent: {
        padding: SPACING.lg,
    },
    packageCard: {
        borderRadius: RADIUS.xl,
        padding: SPACING.xl,
        marginBottom: SPACING.lg,
        borderWidth: 1.5,
    },
    featuredCard: {
        // Additional styling for featured
    },
    badge: {
        position: 'absolute',
        top: -12,
        alignSelf: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: 4,
        borderRadius: RADIUS.full,
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
    },
    packageContent: {
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    packageTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        marginBottom: 4,
    },
    packageDesc: {
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    packagePrice: {
        fontSize: TYPOGRAPHY.size['2xl'],
        fontFamily: TYPOGRAPHY.fontFamily.bold,
    },
    button: {
        height: 48,
        borderRadius: RADIUS.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: SPACING.xl,
        fontSize: TYPOGRAPHY.size.md,
    },
    footer: {
        padding: SPACING.xl,
        alignItems: 'center',
        gap: SPACING.lg,
    },
    linkButton: {
        padding: SPACING.sm,
    },
    linkText: {
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        textDecorationLine: 'underline',
    },
    legalRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    legalText: {
        fontSize: 10,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
    },
});
