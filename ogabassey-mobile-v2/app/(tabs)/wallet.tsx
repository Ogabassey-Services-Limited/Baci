import { View, Text, ScrollView, Pressable, StatusBar, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth-store';
import { useWallet } from '../../hooks/use-wallet';
import { formatPrice } from '../../types/product';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';

export default function Wallet() {
    const { user, isLoading: isAuthLoading } = useAuthStore();
    const router = useRouter();

    // Only fetch wallet if user is logged in
    const { data: walletData, isLoading: isWalletLoading } = useWallet();

    if (isAuthLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="var(--primary)" />
            </View>
        );
    }

    if (!user) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center p-6">
                <StatusBar barStyle="dark-content" />
                <View className="w-24 h-24 bg-red-50 rounded-full items-center justify-center mb-6">
                    <Ionicons name="wallet-outline" size={48} color="var(--primary)" className="text-primary" />
                </View>
                <Text className="text-xl font-bold text-gray-900 mb-2 font-serif">Sign in to access Wallet</Text>
                <Text className="text-gray-500 text-center mb-8 px-4">
                    Manage your funds, loyalty points, and view transaction history.
                </Text>
                <Pressable
                    onPress={() => router.push('/(tabs)/profile')} // Assuming login is in profile or separate auth screen
                    className="bg-primary px-8 py-3 rounded-full shadow-lg"
                >
                    <Text className="text-primary-foreground font-bold text-base">Sign In / Sign Up</Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    const { wallet, transactions } = walletData || { wallet: null, transactions: [] };
    const isLoading = isWalletLoading && !wallet;

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-5 py-4 flex-row justify-between items-center bg-white border-b border-gray-100">
                <Text className="text-xl font-bold text-gray-900 font-serif">My Wallet</Text>
                <Pressable>
                    <Ionicons name="notifications-outline" size={24} color="#374151" />
                </Pressable>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
                {isLoading ? (
                    <ActivityIndicator size="large" color="var(--primary)" className="mt-10" />
                ) : (
                    <>
                        {/* Balance Card */}
                        <View className="bg-gray-900 rounded-3xl p-6 mb-6 shadow-xl shadow-gray-900/20">
                            <View className="flex-row justify-between items-start mb-8">
                                <View>
                                    <Text className="text-gray-400 text-sm font-medium mb-1">Total Balance</Text>
                                    <Text className="text-4xl font-bold text-white">
                                        {formatPrice(wallet?.balance || 0)}
                                    </Text>
                                </View>
                                <View className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                                    <Ionicons name="card-outline" size={24} color="white" />
                                </View>
                            </View>

                            <View className="flex-row gap-4">
                                <Pressable className="flex-1 bg-primary rounded-xl py-3 items-center flex-row justify-center gap-2">
                                    <Ionicons name="add" size={20} color="var(--primary-foreground)" />
                                    <Text className="text-primary-foreground font-bold">Top Up</Text>
                                </Pressable>
                                <Pressable className="flex-1 bg-white/10 rounded-xl py-3 items-center flex-row justify-center gap-2">
                                    <Ionicons name="send" size={18} color="white" />
                                    <Text className="text-white font-bold">Transfer</Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Loyalty Points */}
                        <View className="bg-white rounded-2xl p-5 mb-6 flex-row items-center border border-gray-100 shadow-sm">
                            <View className="w-12 h-12 bg-yellow-50 rounded-full items-center justify-center mr-4">
                                <Ionicons name="trophy" size={20} color="#CA8A04" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 uppercase font-bold tracking-wider">Loyalty Points</Text>
                                <Text className="text-xl font-bold text-gray-900">{wallet?.loyalty_points || 0}</Text>
                            </View>
                            <View className="bg-secondary/10 px-3 py-1 rounded-full">
                                <Text className="text-xs font-bold text-secondary-foreground uppercase">{wallet?.loyalty_tier || 'Bronze'}</Text>
                            </View>
                        </View>

                        {/* Transactions Section */}
                        <Text className="text-lg font-bold text-gray-900 mb-4 px-1">Recent Transactions</Text>

                        {transactions && transactions.length > 0 ? (
                            transactions.map((tx) => (
                                <View key={tx.id} className="bg-white p-4 rounded-xl mb-3 flex-row items-center border border-gray-100">
                                    <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${tx.type === 'credit' ? 'bg-green-100' : 'bg-red-50'}`}>
                                        <Ionicons
                                            name={tx.type === 'credit' ? 'arrow-down' : 'arrow-up'}
                                            size={20}
                                            color={tx.type === 'credit' ? '#16A34A' : '#DC2626'}
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="font-semibold text-gray-900 text-sm" numberOfLines={1}>
                                            {tx.description || (tx.type === 'credit' ? 'Deposit' : 'Purchase')}
                                        </Text>
                                        <Text className="text-xs text-gray-500 mt-0.5">
                                            {new Date(tx.created_at).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <Text className={`font-bold ${tx.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                                        {tx.type === 'credit' ? '+' : '-'}{formatPrice(tx.amount)}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <View className="items-center py-8">
                                <Text className="text-gray-400">No transactions yet</Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
