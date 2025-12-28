import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';

// Get base URL from environment
const API_BASE = 'https://ogabassey.com'; // Web API base URL

interface PlacePrediction {
    placeId: string;
    mainText: string;
    secondaryText: string;
    fullText: string;
}

export interface PlaceDetails {
    streetNumber: string;
    route: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    formattedAddress: string;
}

interface AddressAutocompleteProps {
    value: string;
    onChangeText: (text: string) => void;
    onSelect?: (place: PlaceDetails) => void;
    placeholder?: string;
    country?: string;
}

export function AddressAutocomplete({
    value,
    onChangeText,
    onSelect,
    placeholder = 'Enter your street address',
    country = 'NG', // Default to Nigeria
}: AddressAutocompleteProps) {
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [hasSelected, setHasSelected] = useState(false); // Track if user selected an address
    const [sessionToken] = useState(() => {
        // Generate a random session token (React Native compatible)
        return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 15)}`;
    });
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Fetch predictions when input value changes
    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        if (value.length < 2) {
            setPredictions([]);
            setIsOpen(false);
            return;
        }

        // Don't fetch if user already selected an address (prevent reopening on text update)
        if (hasSelected) {
            setHasSelected(false); // Reset on next manual typing
            return;
        }

        setIsLoading(true);
        debounceTimer.current = setTimeout(async () => {
            try {
                const params = new URLSearchParams({
                    input: value,
                    sessionToken,
                    ...(country && { country }),
                });

                const response = await fetch(`${API_BASE}/api/places/autocomplete?${params.toString()}`);

                if (response.ok) {
                    const data = await response.json();
                    setPredictions(data.predictions || []);
                    setIsOpen((data.predictions || []).length > 0);
                }
            } catch (error) {
                console.error('Error fetching predictions:', error);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [value, sessionToken, country]);

    const handleSelect = async (prediction: PlacePrediction) => {
        setHasSelected(true); // Mark as selected to prevent dropdown reopening
        onChangeText(prediction.mainText);
        setIsOpen(false);
        setPredictions([]);

        if (onSelect) {
            setIsLoading(true);
            try {
                const response = await fetch(
                    `${API_BASE}/api/places/details?placeId=${encodeURIComponent(prediction.placeId)}`
                );

                if (response.ok) {
                    const data = await response.json();
                    const details = data.details;

                    if (details) {
                        onSelect({
                            streetNumber: details.streetNumber || '',
                            route: details.route || '',
                            city: details.city || '',
                            state: details.state || '',
                            zip: details.postalCode || '',
                            country: details.country || '',
                            formattedAddress: details.formattedAddress,
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching place details:', error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleClear = () => {
        setHasSelected(false); // Allow dropdown to show again after clearing
        onChangeText('');
        setPredictions([]);
        setIsOpen(false);
    };

    return (
        <View style={{ position: 'relative', zIndex: 1000 }}>
            {/* Input Field */}
            <View style={{ position: 'relative' }}>
                <TextInput
                    value={value}
                    onChangeText={(text) => {
                        onChangeText(text);
                        if (text.length >= 2) setIsOpen(true);
                    }}
                    onFocus={() => {
                        if (predictions.length > 0) setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    className="bg-gray-50 px-4 py-3 rounded-xl text-gray-900 border border-gray-200 pr-12"
                />

                {/* Loading / Clear Icon */}
                <View className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                    ) : value.length > 0 ? (
                        <Pressable onPress={handleClear} className="p-1">
                            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                        </Pressable>
                    ) : (
                        <Ionicons name="location-outline" size={20} color="#9CA3AF" />
                    )}
                </View>
            </View>

            {/* Dropdown Suggestions */}
            {isOpen && predictions.length > 0 && (
                <View
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 8,
                        backgroundColor: 'white',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        elevation: 10,
                        zIndex: 9999,
                        overflow: 'hidden',
                    }}
                >
                    <ScrollView
                        style={{ maxHeight: 250 }}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                    >
                        {predictions.map((item) => (
                            <Pressable
                                key={item.placeId}
                                onPress={() => handleSelect(item)}
                                className="flex-row items-start gap-3 px-4 py-3 border-b border-gray-100 active:bg-gray-50"
                            >
                                <View className="mt-0.5 w-7 h-7 bg-red-50 rounded-full items-center justify-center">
                                    <Ionicons name="location" size={14} color="#DC2626" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                                        {item.mainText}
                                    </Text>
                                    <Text className="text-xs text-gray-500" numberOfLines={1}>
                                        {item.secondaryText}
                                    </Text>
                                </View>
                            </Pressable>
                        ))}
                        {/* Google Branding Footer */}
                        <View className="px-4 py-2 bg-gray-50 flex-row justify-end items-center">
                            <Text className="text-[10px] text-gray-400">
                                Powered by{' '}
                                <Text style={{ color: '#4285F4' }}>G</Text>
                                <Text style={{ color: '#EA4335' }}>o</Text>
                                <Text style={{ color: '#FBBC05' }}>o</Text>
                                <Text style={{ color: '#4285F4' }}>g</Text>
                                <Text style={{ color: '#34A853' }}>l</Text>
                                <Text style={{ color: '#EA4335' }}>e</Text>
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            )}
        </View>
    );
}
