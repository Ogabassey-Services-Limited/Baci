/**
 * Sidebar Drawer Component
 * Matches web MobileMenu design exactly
 */

import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from './Logo';
import { useAuthStore } from '../../stores/auth-store';
import { useMerchant } from '../../hooks/use-store';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

interface MenuItem {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    route: string;
}

export function Drawer({ isOpen, onClose }: DrawerProps) {
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const { isAuthenticated } = useAuthStore();
    const { data: merchant } = useMerchant();

    if (!isOpen) return null;

    const handleNavigate = (route: string) => {
        onClose();
        router.push(route as any);
    };

    const menuItems: MenuItem[] = [
        { icon: 'person-outline', label: 'Profile', route: '/profile' },
        { icon: 'ribbon-outline', label: 'Member Status', route: '/member-status' },
        { icon: 'bag-outline', label: 'Orders', route: '/orders' },
        { icon: 'heart-outline', label: 'Saved Items', route: '/wishlist' },
        { icon: 'barcode-outline', label: 'IMEI Checker', route: '/imei-check' },
        { icon: 'wallet-outline', label: 'Wallet', route: '/wallet' },
        { icon: 'document-text-outline', label: 'Receipts', route: '/receipts' },
        { icon: 'location-outline', label: 'Address Book', route: '/addresses' },
        { icon: 'build-outline', label: 'Repairs', route: '/repairs' },
        { icon: 'swap-horizontal-outline', label: 'Swap / Trade-in', route: '/swap' },
        { icon: 'star-outline', label: 'My Reviews', route: '/reviews' },
        { icon: 'help-circle-outline', label: 'Help & Support', route: '/help' },
    ];

    return (
        <View className="absolute inset-0 z-[100]">
            {/* Backdrop */}
            <Pressable
                className="absolute inset-0 bg-black/60"
                onPress={onClose}
            />

            {/* Sidebar - White background matching web */}
            <View
                className="absolute left-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-white shadow-2xl flex flex-col"
                style={{ paddingTop: insets.top }}
            >
                {/* Header */}
                <View className="px-5 py-5 border-b border-gray-100 flex-row items-center justify-between">
                    <Logo height={24} color="#111827" />
                    <Pressable
                        onPress={onClose}
                        className="p-2 rounded-full active:bg-gray-100"
                    >
                        <Ionicons name="close" size={20} color="#6B7280" />
                    </Pressable>
                </View>

                {/* Menu Items */}
                <ScrollView
                    className="flex-1 py-4"
                    showsVerticalScrollIndicator={false}
                >
                    <View className="px-5">
                        <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                            Account
                        </Text>
                        <View className="gap-1">
                            {menuItems.map((item) => {
                                const isActive = pathname === item.route;
                                return (
                                    <Pressable
                                        key={item.label}
                                        onPress={() => handleNavigate(item.route)}
                                        className={`flex-row items-center gap-3 p-3 rounded-xl ${isActive
                                                ? 'bg-red-50'
                                                : 'active:bg-gray-50'
                                            }`}
                                    >
                                        <Ionicons
                                            name={item.icon}
                                            size={18}
                                            color={isActive ? '#DC2626' : '#9CA3AF'}
                                        />
                                        <Text
                                            className={`text-sm ${isActive
                                                    ? 'text-red-600 font-bold'
                                                    : 'text-gray-700 font-medium'
                                                }`}
                                        >
                                            {item.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>

                {/* Footer */}
                <View
                    className="px-5 py-5 border-t border-gray-100 bg-gray-50"
                    style={{ paddingBottom: Math.max(insets.bottom, 20) }}
                >
                    {!isAuthenticated ? (
                        <Pressable
                            onPress={() => handleNavigate('/login')}
                            className="bg-gray-900 py-3.5 rounded-xl shadow-lg active:scale-95"
                        >
                            <Text className="text-white font-bold text-center">
                                Login / Register
                            </Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={() => {
                                onClose();
                                useAuthStore.getState().signOut();
                                router.replace('/');
                            }}
                            className="bg-gray-200 py-3.5 rounded-xl active:scale-95"
                        >
                            <Text className="text-gray-900 font-bold text-center">
                                Sign Out
                            </Text>
                        </Pressable>
                    )}
                    <Text className="text-center text-[10px] text-gray-400 mt-3">
                        v1.0.0 • © 2024 {merchant?.business_name || 'Ogabassey'}
                    </Text>
                </View>
            </View>
        </View>
    );
}

