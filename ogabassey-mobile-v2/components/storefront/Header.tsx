import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from './Logo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { GadgetPattern } from './GadgetPattern';
import { SearchAutocomplete } from './SearchAutocomplete';
import { Drawer } from './Drawer';
import { useMerchant } from '../../hooks/use-store';

export function Header() {
    const insets = useSafeAreaInsets();
    const { data: merchant } = useMerchant();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const handleSelectProduct = (slug: string) => {
        router.push(`/product/${slug}`);
    };

    const handleSearch = (query: string) => {
        router.push(`/search?q=${query}`);
    };

    return (
        <>
            <View
                className="z-50 w-full relative bg-[#0F0F0F]"
                style={{ paddingTop: insets.top }}
            >
                {/* Background Pattern */}
                <GadgetPattern />

                <View className="px-4 pb-4 pt-2 flex-col gap-4 relative z-10">
                    {/* Top Row: Menu & Logo */}
                    <View className="flex-row items-center gap-4">
                        <Pressable onPress={() => setIsDrawerOpen(true)}>
                            <Ionicons name="menu" size={28} color="white" />
                        </Pressable>

                        <Pressable onPress={() => router.push('/')}>
                            <Logo height={28} color="white" />
                        </Pressable>
                    </View>

                    {/* Search Bar Row with Autocomplete */}
                    <SearchAutocomplete
                        merchantId={merchant?.id}
                        onSelectProduct={handleSelectProduct}
                        onSearch={handleSearch}
                    />
                </View>
            </View>

            {/* Sidebar Drawer */}
            <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
        </>
    );
}
