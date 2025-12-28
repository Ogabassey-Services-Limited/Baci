import { View, Text, Pressable, Alert } from 'react-native';
import { Phone, Wifi, Tv, Zap, Gamepad2 } from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
import { useMerchant } from '../../hooks/use-store';

// Using Lucide icons for a more premium, modern look that matches the web design
const UTILITIES = [
    { id: 'airtime', name: 'Airtime', Icon: Phone },
    { id: 'data', name: 'Data', Icon: Wifi },
    { id: 'tv', name: 'Tv', Icon: Tv },
    { id: 'power', name: 'Power', Icon: Zap },
    { id: 'gaming', name: 'Gaming', Icon: Gamepad2 },
];

const UTILITY_WORDS = ['Airtime!', 'Data!', 'TV!', 'Power!', 'Gaming!'];

// Helper to create RGBA color from Hex for background opacity
const hexToRgba = (hex: string, opacity: number) => {
    let c: any = hex.substring(1).split('');
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + opacity + ')';
};

export function UtilityPanel() {
    const { data: merchant } = useMerchant();
    const primaryColor = merchant?.brand_colors?.primary || '#DC2626';

    const [activeIndex, setActiveIndex] = useState(0);
    const [isAutoRotating, setIsAutoRotating] = useState(true);
    const autoResumeTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isAutoRotating) return;

        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % UTILITY_WORDS.length);
        }, 2500);
        return () => clearInterval(interval);
    }, [isAutoRotating]);

    const handlePress = (idx: number) => {
        // Stop auto-rotation
        setIsAutoRotating(false);
        setActiveIndex(idx);

        // Clear existing resume timer
        if (autoResumeTimer.current) {
            clearTimeout(autoResumeTimer.current);
        }

        // Resume auto-rotation after 5 seconds
        autoResumeTimer.current = setTimeout(() => {
            setIsAutoRotating(true);
        }, 5000);

        // Show coming soon message
        const utility = UTILITIES[idx];
        Alert.alert(
            `${utility.name} Coming Soon`,
            `Purchase ${utility.name.toLowerCase()} directly from the app - launching soon!`,
            [{ text: 'OK' }]
        );
    };

    return (
        <View className="px-4 mt-4 mb-2">
            <View className="bg-white rounded-3xl p-2 border border-gray-100">
                {/* We Pay YOU Header */}
                <View
                    style={{ backgroundColor: hexToRgba(primaryColor, 0.05) }}
                    className="rounded-2xl py-3 px-4 mb-4 items-center overflow-hidden"
                >
                    <Text className="text-gray-900 font-medium text-sm text-center">
                        We Pay <Text className="text-primary font-bold">YOU</Text> When You Buy{' '}
                        <Text className="text-primary font-bold">{UTILITY_WORDS[activeIndex]}</Text>
                    </Text>
                </View>

                {/* Icons Grid */}
                <View className="flex-row justify-between px-2 pb-2">
                    {UTILITIES.map((item, idx) => {
                        const isActive = idx === activeIndex;
                        return (
                            <Pressable
                                key={item.id}
                                className="items-center gap-2"
                                onPress={() => handlePress(idx)}
                            >
                                <View
                                    className={`w-12 h-12 rounded-full items-center justify-center overflow-hidden ${!isActive && 'bg-gray-100'}`}
                                    style={isActive ? { backgroundColor: hexToRgba(primaryColor, 0.1) } : {}}
                                >
                                    {/* Lucide Icons - passing explicit hex color */}
                                    <item.Icon
                                        size={24}
                                        color={isActive ? primaryColor : '#4B5563'}
                                        strokeWidth={2}
                                    />
                                </View>
                                <Text className={`text-xs font-medium ${isActive ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                                    {item.name}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

