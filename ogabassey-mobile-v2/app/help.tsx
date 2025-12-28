import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HelpScreen() {
    const insets = useSafeAreaInsets();

    const faqs = [
        { q: 'How do I track my order?', a: 'Go to My Orders and tap on your order to see tracking details.' },
        { q: 'What is your return policy?', a: 'We offer 7-day returns on most products. Items must be unused and in original packaging.' },
        { q: 'How do I cancel an order?', a: 'Contact support within 1 hour of placing your order for cancellation.' },
        { q: 'Do you offer warranty?', a: 'Yes! All phones come with a 1-year warranty. Accessories have 3-month warranty.' },
        { q: 'What payment methods do you accept?', a: 'We accept bank transfer, cards, and pay on delivery in select areas.' },
    ];

    const contactOptions = [
        { icon: 'call-outline' as const, label: 'Call Us', action: () => Linking.openURL('tel:+2348000000000') },
        { icon: 'logo-whatsapp' as const, label: 'WhatsApp', action: () => Linking.openURL('https://wa.me/2348000000000') },
        { icon: 'mail-outline' as const, label: 'Email', action: () => Linking.openURL('mailto:support@ogabassey.com') },
    ];

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
                    <Text className="text-xl font-bold text-gray-900">Help & Support</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Contact Options */}
                <View className="flex-row gap-3 mb-6">
                    {contactOptions.map((option) => (
                        <Pressable
                            key={option.label}
                            onPress={option.action}
                            className="flex-1 bg-white p-4 rounded-xl items-center"
                        >
                            <Ionicons name={option.icon} size={24} color="#DC2626" />
                            <Text className="text-sm font-medium text-gray-700 mt-2">{option.label}</Text>
                        </Pressable>
                    ))}
                </View>

                {/* FAQs */}
                <Text className="text-lg font-bold text-gray-900 mb-4">Frequently Asked Questions</Text>
                <View className="gap-3">
                    {faqs.map((faq, index) => (
                        <View key={index} className="bg-white p-4 rounded-xl">
                            <Text className="font-semibold text-gray-900 mb-2">{faq.q}</Text>
                            <Text className="text-gray-500 text-sm">{faq.a}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
