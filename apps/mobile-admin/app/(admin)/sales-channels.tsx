/**
 * Sales Channels Screen
 * Manage external marketplace connections like Jumia, Konga, etc.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function SalesChannelsScreen() {
    const { colors, shadows, isDark } = useTheme();
    const router = useRouter();
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(false);

    // TODO: Move to shared config
    const WEB_APP_URL = 'https://usebaci.com';

    const handleConnectJumia = async () => {
        try {
            setLoading(true);
            const authUrl = `${WEB_APP_URL}/api/marketplace/jumia/connect?connectionType=oauth&platform=mobile`;

            const result = await WebBrowser.openAuthSessionAsync(
                authUrl,
                'baciadmin://'
            );

            if (result.type === 'success' && result.url) {
                const { queryParams } = Linking.parse(result.url);
                if (queryParams?.success === 'jumia_connected') {
                    setIsConnected(true);
                    Alert.alert('Success', 'Jumia account connected successfully!');
                }
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to connect Jumia account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Sales Channels',
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </Pressable>
                    ),
                }}
            />
            <SafeAreaView
                style={[styles.container, { backgroundColor: colors.background }]}
                edges={['bottom']}
            >
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.header}>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Connect your store to major marketplaces to sync inventory and orders automatically.
                        </Text>
                    </View>

                    {/* Jumia Channel */}
                    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
                        <View style={styles.channelHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: '#FF9900' }]}>
                                <Text style={styles.iconText}>J</Text>
                            </View>
                            <View style={styles.channelInfo}>
                                <Text style={[styles.channelTitle, { color: colors.text }]}>Jumia</Text>
                                <Text style={[styles.channelDesc, { color: colors.textSecondary }]}>
                                    Africa's no.1 marketplace
                                </Text>
                            </View>
                            <View style={[
                                styles.badge,
                                { backgroundColor: isConnected ? colors.successLight : colors.border }
                            ]}>
                                <Text style={[
                                    styles.badgeText,
                                    { color: isConnected ? colors.success : colors.textMuted }
                                ]}>
                                    {isConnected ? 'Active' : 'Inactive'}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <Pressable
                            onPress={handleConnectJumia}
                            disabled={loading || isConnected}
                            style={[
                                styles.connectButton,
                                {
                                    backgroundColor: isConnected ? colors.cardHover : colors.primary,
                                    opacity: loading ? 0.7 : 1
                                }
                            ]}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={[
                                    styles.connectButtonText,
                                    { color: isConnected ? colors.textSecondary : '#FFF' }
                                ]}>
                                    {isConnected ? 'Connected to Jumia' : 'Connect Jumia Account'}
                                </Text>
                            )}
                        </Pressable>
                    </View>

                    {/* Pending Channels */}
                    <View style={[styles.card, { backgroundColor: colors.card, opacity: 0.6 }]}>
                        <View style={styles.channelHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: '#3366FF' }]}>
                                <Text style={styles.iconText}>K</Text>
                            </View>
                            <View style={styles.channelInfo}>
                                <Text style={[styles.channelTitle, { color: colors.text }]}>Konga</Text>
                                <Text style={[styles.channelDesc, { color: colors.textSecondary }]}>
                                    Coming soon
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.card, { backgroundColor: colors.card, opacity: 0.6 }]}>
                        <View style={styles.channelHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: '#000000' }]}>
                                <Ionicons name="logo-amazon" size={20} color="#FFF" />
                            </View>
                            <View style={styles.channelInfo}>
                                <Text style={[styles.channelTitle, { color: colors.text }]}>Amazon</Text>
                                <Text style={[styles.channelDesc, { color: colors.textSecondary }]}>
                                    Coming soon
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { padding: SPACING.lg },
    backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
    header: { marginBottom: SPACING.xl },
    subtitle: {
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
        lineHeight: 20,
    },
    card: {
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.lg,
    },
    channelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    iconText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    channelInfo: { flex: 1 },
    channelTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
    },
    channelDesc: {
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily.regular,
    },
    badge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.full,
    },
    badgeText: {
        fontSize: 10,
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        textTransform: 'uppercase',
    },
    divider: {
        height: 1,
        marginVertical: SPACING.lg,
    },
    connectButton: {
        height: 48,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    connectButtonText: {
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    },
});
