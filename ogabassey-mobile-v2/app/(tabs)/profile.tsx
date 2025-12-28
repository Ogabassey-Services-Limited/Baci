import { View, Text, ScrollView, Pressable, StatusBar, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth-store';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function Profile() {
    const { user, customer, signInWithOtp, verifyOtp, signOut, isLoading } = useAuthStore();

    // Auth Form State
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSignIn = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }
        setIsSubmitting(true);
        const { success, error } = await signInWithOtp(email);
        setIsSubmitting(false);

        if (success) {
            setShowOtpInput(true);
            Alert.alert('Success', 'Login code sent to your email!');
        } else {
            Alert.alert('Error', error || 'Failed to send code');
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp) return;
        setIsSubmitting(true);
        const { success, error } = await verifyOtp(email, otp);
        setIsSubmitting(false);

        if (success) {
            // Auto login happens
        } else {
            Alert.alert('Error', error || 'Invalid code');
        }
    };

    const handleSignOut = async () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut }
        ]);
    };

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="var(--primary)" />
            </View>
        );
    }

    if (!user) {
        return (
            <SafeAreaView className="flex-1 bg-white p-6 justify-center">
                <StatusBar barStyle="dark-content" />
                <View className="items-center mb-10">
                    <View className="w-20 h-20 bg-primary/10 rounded-2xl items-center justify-center mb-4 transform rotate-3">
                        <Ionicons name="person" size={40} color="var(--primary)" className="text-primary" />
                    </View>
                    <Text className="text-3xl font-bold text-gray-900 font-serif">Welcome Back</Text>
                    <Text className="text-gray-500 text-center mt-2">Sign in to access your orders, wallet, and wishlist.</Text>
                </View>

                {!showOtpInput ? (
                    <View className="space-y-4 gap-4">
                        <View>
                            <Text className="text-sm font-bold text-gray-700 mb-1.5 ml-1">Email Address</Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900"
                                placeholder="name@example.com"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                        <Pressable
                            className={`bg-primary rounded-xl py-4 items-center shadow-lg ${isSubmitting ? 'opacity-70' : ''}`}
                            onPress={handleSignIn}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="var(--primary-foreground)" />
                            ) : (
                                <Text className="text-primary-foreground font-bold text-lg">Send Login Code</Text>
                            )}
                        </Pressable>
                    </View>
                ) : (
                    <View className="space-y-4 gap-4">
                        <View>
                            <Text className="text-sm font-bold text-gray-700 mb-1.5 ml-1">Enter Code</Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 text-center tracking-widest font-mono"
                                placeholder="123456"
                                value={otp}
                                onChangeText={setOtp}
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                        </View>
                        <Pressable
                            className={`bg-primary rounded-xl py-4 items-center shadow-lg ${isSubmitting ? 'opacity-70' : ''}`}
                            onPress={handleVerifyOtp}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="var(--primary-foreground)" />
                            ) : (
                                <Text className="text-primary-foreground font-bold text-lg">Verify & Sign In</Text>
                            )}
                        </Pressable>
                        <Pressable onPress={() => setShowOtpInput(false)} className="items-center mt-4">
                            <Text className="text-gray-500 text-sm">Use a different email</Text>
                        </Pressable>
                    </View>
                )}
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
            <StatusBar barStyle="dark-content" />

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Profile Header */}
                <View className="bg-white px-6 pt-6 pb-8 rounded-b-3xl shadow-[0_4px_20px_-12px_rgba(0,0,0,0.1)] mb-6">
                    <View className="flex-row items-center mb-6">
                        <Image
                            source={{ uri: customer?.avatar_url || 'https://via.placeholder.com/100' }}
                            style={{ width: 80, height: 80, borderRadius: 40 }}
                            className="bg-gray-200"
                        />
                        <View className="ml-4 flex-1">
                            <Text className="text-xl font-bold text-gray-900 font-serif">
                                {customer?.first_name ? `${customer.first_name} ${customer.last_name || ''}` : 'My Account'}
                            </Text>
                            <Text className="text-gray-500 text-sm">{user.email}</Text>
                            {customer?.loyalty_tier && (
                                <View className="bg-secondary/10 self-start px-2 py-0.5 rounded-full mt-2">
                                    <Text className="text-xs font-bold text-secondary-foreground uppercase">{customer.loyalty_tier}</Text>
                                </View>
                            )}
                        </View>
                        <Pressable onPress={() => { }} className="bg-gray-100 p-2 rounded-full">
                            <Ionicons name="pencil" size={20} color="#374151" />
                        </Pressable>
                    </View>

                    <View className="flex-row gap-4">
                        <Pressable onPress={() => router.push('/(tabs)/wallet')} className="flex-1 bg-gray-50 p-4 rounded-xl items-center border border-gray-100">
                            <Ionicons name="wallet-outline" size={24} color="#374151" />
                            <Text className="text-xs font-bold text-gray-900 mt-2">Wallet</Text>
                        </Pressable>
                        <Pressable className="flex-1 bg-gray-50 p-4 rounded-xl items-center border border-gray-100">
                            <Ionicons name="cube-outline" size={24} color="#374151" />
                            <Text className="text-xs font-bold text-gray-900 mt-2">Orders</Text>
                        </Pressable>
                        <Pressable className="flex-1 bg-gray-50 p-4 rounded-xl items-center border border-gray-100">
                            <Ionicons name="location-outline" size={24} color="#374151" />
                            <Text className="text-xs font-bold text-gray-900 mt-2">Address</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Menu Items */}
                <View className="px-5 gap-3">
                    <Text className="text-sm font-bold text-gray-500 uppercase ml-1 mb-1">Settings</Text>

                    <MenuLink icon="notifications-outline" title="Notifications" />
                    <MenuLink icon="lock-closed-outline" title="Privacy & Security" />
                    <MenuLink icon="color-palette-outline" title="Appearance" />

                    <Text className="text-sm font-bold text-gray-500 uppercase ml-1 mb-1 mt-4">Support</Text>

                    <MenuLink icon="help-circle-outline" title="Help Center" />
                    <MenuLink icon="chatbubble-ellipses-outline" title="Contact Support" />
                    <MenuLink icon="document-text-outline" title="Terms & Policies" />

                    <Pressable
                        onPress={handleSignOut}
                        className="bg-red-50 p-4 rounded-xl flex-row items-center mt-6 border border-red-100"
                    >
                        <Ionicons name="log-out-outline" size={24} color="#DC2626" />
                        <Text className="flex-1 ml-3 font-semibold text-red-600">Sign Out</Text>
                        <Ionicons name="chevron-forward" size={20} color="#FECACA" />
                    </Pressable>

                    <Text className="text-center text-gray-400 text-xs mt-6 mb-10">
                        Version 1.0.0
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function MenuLink({ icon, title, onPress }: { icon: any, title: string, onPress?: () => void }) {
    return (
        <Pressable onPress={onPress} className="bg-white p-4 rounded-xl flex-row items-center border border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <Ionicons name={icon} size={22} color="#374151" />
            <Text className="flex-1 ml-3 font-semibold text-gray-700">{title}</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
        </Pressable>
    )
}
