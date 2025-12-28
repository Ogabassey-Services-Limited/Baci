
import { View, Text, TextInput, Pressable, Modal, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

// Country data for phone input
const COUNTRIES = [
    { code: 'NG', name: 'Nigeria', dial_code: '+234', flag: '🇳🇬', maxLength: 10 },
    { code: 'GH', name: 'Ghana', dial_code: '+233', flag: '🇬🇭', maxLength: 9 },
    { code: 'KE', name: 'Kenya', dial_code: '+254', flag: '🇰🇪', maxLength: 9 },
    { code: 'GB', name: 'United Kingdom', dial_code: '+44', flag: '🇬🇧', maxLength: 10 },
    { code: 'US', name: 'United States', dial_code: '+1', flag: '🇺🇸', maxLength: 10 },
    { code: 'CA', name: 'Canada', dial_code: '+1', flag: '🇨🇦', maxLength: 10 },
    { code: 'ZA', name: 'South Africa', dial_code: '+27', flag: '🇿🇦', maxLength: 9 },
];

interface PhoneInputProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
}

export function PhoneInput({ value, onChangeText, placeholder = "Phone Number" }: PhoneInputProps) {
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);

    // Split value into dial code and number if possible, or just treat as number
    // Ideally we pass full number up, but for UI we might want to split visually

    return (
        <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Phone Number *</Text>
            <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                {/* Country Selector Trigger */}
                <Pressable
                    onPress={() => setModalVisible(true)}
                    className="flex-row items-center px-3 py-3 border-r border-gray-200 bg-gray-100"
                >
                    <Text className="text-lg mr-2">{selectedCountry.flag}</Text>
                    <Text className="text-sm font-medium text-gray-700">{selectedCountry.dial_code}</Text>
                    <Ionicons name="chevron-down" size={12} color="#6B7280" style={{ marginLeft: 4 }} />
                </Pressable>

                {/* Number Input */}
                <TextInput
                    className="flex-1 px-4 py-3 text-gray-900 text-base"
                    value={value}
                    onChangeText={(text) => {
                        // Sanitize: allow only numbers
                        const numericValue = text.replace(/[^0-9]/g, '');

                        // Remove leading zero if present
                        const sanitizedValue = numericValue.startsWith('0')
                            ? numericValue.substring(1)
                            : numericValue;

                        onChangeText(sanitizedValue);
                    }}
                    placeholder="8012345678" // Example without leading 0
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={selectedCountry.maxLength} // Dynamic limit based on country
                />
            </View>

            {/* Country Picker Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl h-[60%]">
                        <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
                            <Text className="text-lg font-bold text-gray-900">Select Country</Text>
                            <Pressable onPress={() => setModalVisible(false)} className="p-2 bg-gray-100 rounded-full">
                                <Ionicons name="close" size={20} color="#374151" />
                            </Pressable>
                        </View>

                        <FlatList
                            data={COUNTRIES}
                            keyExtractor={(item) => item.code}
                            contentContainerStyle={{ padding: 16 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    className="flex-row items-center py-4 border-b border-gray-50"
                                    onPress={() => {
                                        setSelectedCountry(item);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text className="text-2xl mr-4">{item.flag}</Text>
                                    <View className="flex-1">
                                        <Text className="text-base font-medium text-gray-900">{item.name}</Text>
                                        <Text className="text-sm text-gray-500">{item.dial_code}</Text>
                                    </View>
                                    {selectedCountry.code === item.code && (
                                        <Ionicons name="checkmark-circle" size={24} color="#DC2626" />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
