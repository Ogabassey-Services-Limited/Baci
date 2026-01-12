/**
 * Analytics Products Screen
 * List of top selling products with revenue and units sold
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useTopSellingProducts, TopSellingProduct } from '@/hooks/useProducts';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

export default function AnalyticsProductsScreen() {
    const { colors, isDark, shadows } = useTheme();
    const router = useRouter();
    const { data: topProducts, isLoading } = useTopSellingProducts(50);

    const formatCurrency = (amount: number) => {
        return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    };

    const renderProductItem = ({ item, index }: { item: TopSellingProduct; index: number }) => (
        <Pressable
            style={[styles.productItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
            onPress={() => router.push(`/product/${item.id}`)}
        >
            <View style={styles.rankContainer}>
                <Text style={[styles.rankText, { color: colors.textSecondary }]}>{index + 1}</Text>
            </View>

            <View style={styles.productInfo}>
                <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={[styles.productStats, { color: colors.textSecondary }]}>
                    {item.totalSold} units sold
                </Text>
            </View>

            <View style={styles.productValue}>
                <Text style={[styles.revenueText, { color: colors.text }]}>
                    {formatCurrency(item.totalRevenue)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
        </Pressable>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Top Products',
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                }}
            />
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            <FlatList
                data={topProducts}
                renderItem={renderProductItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No product data available for this period.
                            </Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 40,
    },
    productItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rankContainer: {
        width: 30,
    },
    rankText: {
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.medium,
    },
    productInfo: {
        flex: 1,
        paddingRight: SPACING.md,
    },
    productName: {
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.semiBold,
        marginBottom: 2,
    },
    productStats: {
        fontSize: TYPOGRAPHY.size.xs,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
    },
    productValue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    revenueText: {
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    },
    emptyState: {
        padding: 60,
        alignItems: 'center',
        gap: 16,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: TYPOGRAPHY.size.md,
    },
});
