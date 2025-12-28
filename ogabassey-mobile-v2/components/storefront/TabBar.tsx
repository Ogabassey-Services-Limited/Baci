import { View, Text, Pressable, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../stores/cart-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GadgetPattern } from './GadgetPattern';

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const cartItemCount = useCartStore((s) => s.itemCount());

    const getIconName = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
        switch (routeName) {
            case 'index': return focused ? 'home' : 'home-outline';
            case 'wishlist': return focused ? 'heart' : 'heart-outline';
            case 'cart': return focused ? 'cart' : 'cart-outline';
            case 'wallet': return focused ? 'wallet' : 'wallet-outline';
            case 'profile': return focused ? 'person' : 'person-outline';
            default: return 'help-circle-outline';
        }
    };

    const getLabel = (routeName: string) => {
        switch (routeName) {
            case 'index': return 'Home';
            case 'wishlist': return 'Saved';
            case 'cart': return 'Cart';
            case 'wallet': return 'Wallet';
            case 'profile': return 'Account';
            default: return '';
        }
    };

    return (
        <View
            className="absolute bottom-0 left-0 right-0 bg-[#0F0F0F] border-t border-white/10 relative overflow-hidden"
            style={{ paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8 }}
        >
            {/* Background Pattern */}
            <GadgetPattern />

            {/* Top Highlight Line */}
            <View className="absolute top-0 left-0 right-0 h-[1px] bg-white/10 z-20" />

            <View className="flex-row justify-around items-center relative z-10">
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const iconName = getIconName(route.name, isFocused);
                    const label = getLabel(route.name);

                    // Skip if no label (e.g. valid hidden routes or removed wallet if still in state somehow)
                    if (!label) return null;

                    return (
                        <Pressable
                            key={route.key}
                            onPress={onPress}
                            className="items-center justify-center min-w-[56px] py-1"
                        >
                            <View className={`p-2 rounded-xl relative ${isFocused ? 'bg-white/10' : ''}`}>
                                <Ionicons
                                    name={iconName}
                                    size={24}
                                    color={isFocused ? 'white' : '#9CA3AF'}
                                />

                                {route.name === 'cart' && cartItemCount > 0 && (
                                    <View className="absolute -top-1 -right-1 bg-red-600 rounded-full w-[18px] h-[18px] items-center justify-center border border-[#0F0F0F]">
                                        <Text className="text-white text-[10px] font-bold">
                                            {cartItemCount > 99 ? '99+' : cartItemCount}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {isFocused && (
                                <Text className="text-white text-[10px] font-medium mt-1">
                                    {label}
                                </Text>
                            )}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
