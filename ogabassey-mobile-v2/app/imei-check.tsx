import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

export default function IMEICheckScreen() {
    const insets = useSafeAreaInsets();
    const [imei, setImei] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleCheck = async () => {
        if (imei.length < 15) {
            Alert.alert('Invalid IMEI', 'IMEI must be at least 15 digits');
            return;
        }

        setIsChecking(true);
        // TODO: Call IMEI check API
        setTimeout(() => {
            setResult({
                valid: true,
                brand: 'Samsung',
                model: 'Galaxy S24 Ultra',
                status: 'Clean',
            });
            setIsChecking(false);
        }, 2000);
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View
                className="bg-white px-4 pb-4 border-b border-gray-100"
                style={{ paddingTop: insets.top + 16 }}
            >
                <View className="flex-row items-center gap-4">
                    <Pressable onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </Pressable>
                    <Text className="text-xl font-bold text-gray-900">IMEI Checker</Text>
                </View>
            </View>

            <View className="p-4">
                {/* Input */}
                <View className="bg-white p-4 rounded-xl mb-4">
                    <Text className="text-gray-700 font-medium mb-2">Enter IMEI Number</Text>
                    <TextInput
                        value={imei}
                        onChangeText={setImei}
                        placeholder="e.g., 359876543210123"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={15}
                        className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900"
                    />
                    <Text className="text-xs text-gray-400 mt-2">
                        Dial *#06# on your phone to find the IMEI
                    </Text>
                </View>

                <Pressable
                    onPress={handleCheck}
                    disabled={isChecking || imei.length < 15}
                    className={`py-4 rounded-xl items-center ${imei.length >= 15 ? 'bg-red-600' : 'bg-gray-300'
                        }`}
                >
                    {isChecking ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold">Check IMEI</Text>
                    )}
                </Pressable>

                {/* Result */}
                {result && (
                    <View className="bg-white p-4 rounded-xl mt-4">
                        <View className="flex-row items-center gap-2 mb-3">
                            <Ionicons
                                name={result.status === 'Clean' ? 'checkmark-circle' : 'alert-circle'}
                                size={24}
                                color={result.status === 'Clean' ? '#22C55E' : '#EF4444'}
                            />
                            <Text className={`font-bold text-lg ${result.status === 'Clean' ? 'text-green-600' : 'text-red-600'}`}>
                                {result.status}
                            </Text>
                        </View>
                        <View className="gap-2">
                            <Text className="text-gray-600">Brand: <Text className="font-medium text-gray-900">{result.brand}</Text></Text>
                            <Text className="text-gray-600">Model: <Text className="font-medium text-gray-900">{result.model}</Text></Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}
