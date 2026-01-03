/**
 * Domains Screen
 * Custom domain settings (PRO feature)
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useMerchant } from '@/hooks/useMerchant';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

export default function DomainsScreen() {
    const { colors, shadows, isDark } = useTheme();
    const { merchant, storeUrl } = useMerchant();
    const router = useRouter();

    const handleManageDomains = () => {
        Linking.openURL('https://usebaci.com/dashboard/settings/domains');
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Domains',
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
                    {/* Current Domain */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: colors.successLight }]}>
                                <Ionicons name="globe" size={24} color={colors.success} />
                            </View>
                            <View style={styles.cardHeaderText}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Primary Domain</Text>
                                <View style={[styles.statusBadge, { backgroundColor: colors.successLight }]}>
                                    <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                                    <Text style={[styles.statusText, { color: colors.success }]}>Active</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <View style={[styles.urlContainer, { backgroundColor: colors.cardHover }]}>
                            <Ionicons name="link-outline" size={18} color={colors.textSecondary} />
                            <Text style={[styles.urlText, { color: colors.text }]}>{storeUrl || `${merchant?.slug}.mybaci.store`}</Text>
                        </View>
                    </View>

                    {/* Custom Domain Info */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <View style={styles.proHeader}>
                            <View style={[styles.proBadge, { backgroundColor: colors.warning }]}>
                                <Text style={styles.proBadgeText}>PRO</Text>
                            </View>
                            <Text style={[styles.proTitle, { color: colors.text }]}>Custom Domain</Text>
                        </View>
                        <Text style={[styles.proDescription, { color: colors.textSecondary }]}>
                            Connect your own domain like yourstore.com for a professional look.
                        </Text>

                        <View style={styles.featureList}>
                            {['SSL certificate included', 'Easy DNS setup', 'Email forwarding'].map((feature) => (
                                <View key={feature} style={styles.featureRow}>
                                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                                    <Text style={[styles.featureText, { color: colors.textSecondary }]}>{feature}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Manage Button */}
                    <Pressable
                        style={[styles.manageButton, { backgroundColor: colors.primary }]}
                        onPress={handleManageDomains}
                    >
                        <Ionicons name="open-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.manageButtonText}>Manage on Web Dashboard</Text>
                    </Pressable>
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
    scrollView: { flex: 1 },
    scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
    card: { borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    iconContainer: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    cardHeaderText: { flex: 1 },
    cardTitle: { fontSize: TYPOGRAPHY.size.lg, fontFamily: TYPOGRAPHY.fontFamily.bold, marginBottom: SPACING.xs },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.full,
        gap: 6,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: TYPOGRAPHY.size.xs, fontFamily: TYPOGRAPHY.fontFamily.semiBold },
    divider: { height: 1, marginVertical: SPACING.md },
    urlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
    },
    urlText: { fontSize: TYPOGRAPHY.size.md, fontFamily: TYPOGRAPHY.fontFamily.medium },
    proHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
    proBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
    proBadgeText: { color: '#FFFFFF', fontSize: TYPOGRAPHY.size.xs, fontFamily: TYPOGRAPHY.fontFamily.bold },
    proTitle: { fontSize: TYPOGRAPHY.size.lg, fontFamily: TYPOGRAPHY.fontFamily.bold },
    proDescription: { fontSize: TYPOGRAPHY.size.sm, fontFamily: TYPOGRAPHY.fontFamily.regular, marginBottom: SPACING.md },
    featureList: { gap: SPACING.sm },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    featureText: { fontSize: TYPOGRAPHY.size.sm, fontFamily: TYPOGRAPHY.fontFamily.regular },
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
