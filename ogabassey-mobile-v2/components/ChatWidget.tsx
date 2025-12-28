
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard,
    Dimensions,
} from 'react-native';
import { usePathname } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Gift, Send, X, Sparkles, ShoppingCart, User } from 'lucide-react-native';
import { useCart } from '../hooks/use-cart';
import { formatPrice } from '../stores/cart-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    FadeInDown,
    FadeOut,
} from 'react-native-reanimated';

// Types
interface SantaCartAction {
    productName: string;
    price: number;
    added: boolean;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    santaAction?: SantaCartAction;
}

const SUGGESTIONS = [
    { label: 'Track my order', icon: 'Truck' },
    { label: 'Best gaming phones', icon: 'Zap' },
    { label: 'Return policy', icon: 'ShoppingBag' },
    { label: 'Contact support', icon: 'Headphones' },
];

const PROACTIVE_MESSAGES = [
    "Looking for a new phone? 📱",
    "Need help checking an IMEI? 🔍",
    "Want to see gaming laptops? 🎮",
    "I can help you swap your device! 🔄",
    "Searching for a specific spec? ⚡",
    "Check out our daily deals! 🏷️",
    "Need a repair quote? 🔧"
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHAT_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
const CHAT_HEIGHT = Math.min(SCREEN_HEIGHT * 0.6, 450);

const renderMarkdownText = (text: string, isUser: boolean) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
        <Text className={`text-[13px] leading-5 ${isUser ? 'text-white' : 'text-gray-800'}`}>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <Text key={index} className="font-bold">
                            {part.slice(2, -2)}
                        </Text>
                    );
                }
                return <Text key={index}>{part}</Text>;
            })}
        </Text>
    );
};

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [proactiveMsg, setProactiveMsg] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();

    const { addToCart } = useCart();

    // Route awareness for positioning
    const pathname = usePathname();
    // Check if we are on screens with bottom floating buttons/footers
    const hasBottomInterference = pathname?.includes('checkout') || pathname?.includes('cart');
    // Move up by ~80px if interference exists
    const bottomOffset = hasBottomInterference ? 80 : 0;

    // Animation values
    const animation = useSharedValue(0);

    // Santa Mode Toggle
    const isSanta = false;

    // Animate open/close
    useEffect(() => {
        animation.value = withSpring(isOpen ? 1 : 0, {
            damping: 20,
            stiffness: 300,
        });
    }, [isOpen]);

    // Drag Animation Values
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const context = useSharedValue({ x: 0, y: 0 });

    const pan = Gesture.Pan()
        .onStart(() => {
            context.value = { x: translateX.value, y: translateY.value };
        })
        .onUpdate((event) => {
            translateX.value = event.translationX + context.value.x;
            translateY.value = event.translationY + context.value.y;
        });

    const dragStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
            ],
        };
    });

    const chatAnimatedStyle = useAnimatedStyle(() => {
        // Window stays fixed at bottom-right, does NOT follow drag.
        // It simply fades in and scales up.

        const scale = interpolate(animation.value, [0, 1], [0.9, 1]);
        const opacity = interpolate(animation.value, [0, 0.2, 1], [0, 1, 1]);
        const translateYOffset = interpolate(animation.value, [0, 1], [20, 0]);

        return {
            opacity,
            transform: [
                { translateY: translateYOffset },
                { scale },
            ],
        };
    });

    // Proactive Nudge Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isOpen) {
                const randomMsg = PROACTIVE_MESSAGES[Math.floor(Math.random() * PROACTIVE_MESSAGES.length)];
                setProactiveMsg(randomMsg);

                // Auto-dismiss after 8 seconds
                setTimeout(() => setProactiveMsg(null), 8000);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    // Hide proactive message when chat opens
    useEffect(() => {
        if (isOpen) setProactiveMsg(null);
    }, [isOpen]);

    const API_URL = 'https://ogabassey.com';

    const handleSend = async (messageText: string) => {
        if (!messageText.trim()) return;

        const newMessage: ChatMessage = { role: 'user', text: messageText };
        setMessages((prev) => [...prev, newMessage]);
        setInput('');
        setIsLoading(true);
        Keyboard.dismiss();

        try {
            const endpoint = isSanta ? `${API_URL}/api/chat/santa` : `${API_URL}/api/chat`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        ...messages.map((m) => ({
                            role: m.role === 'model' ? 'assistant' : 'user',
                            content: m.text,
                        })),
                        { role: 'user', content: messageText },
                    ],
                }),
            });

            if (!response.ok) throw new Error('Chat service unavailable');

            const aiResponseText = await response.text();

            // Parse Santa Action
            let santaAction: SantaCartAction | undefined;
            const actionMatch = aiResponseText.match(/ACTION:ADD_TO_CART\|PRODUCT:([^|]+)\|PRICE:([^\s]+)/);

            if (actionMatch) {
                const product = actionMatch[1];
                const priceStr = actionMatch[2].replace(/[₦,N\s]/g, '');
                const price = parseInt(priceStr, 10) || 0;
                santaAction = {
                    productName: product,
                    price,
                    added: false
                };
            }

            const displayText = aiResponseText
                .replace(/ACTION:ADD_TO_CART\|PRODUCT:[^|]+\|PRICE:[^\s]+/g, '')
                .trim();

            setMessages((prev) => [...prev, { role: 'model', text: displayText, santaAction }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'model',
                    text: "I'm having trouble connecting right now. Please check your internet and try again.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddSantaWishToCart = useCallback((messageIndex: number) => {
        const message = messages[messageIndex];
        if (!message?.santaAction || message.santaAction.added) return;

        const santaProduct = {
            product_id: `santa-wish-${Date.now()}`,
            name: message.santaAction.productName,
            price: message.santaAction.price,
            quantity: 1,
            image_url: 'https://ogabassey.com/african-santa-head.svg',
            description: `Santa's special Christmas wish`,
            max_quantity: 999
        };

        addToCart(santaProduct);

        setMessages((prev) =>
            prev.map((msg, idx) =>
                idx === messageIndex && msg.santaAction
                    ? { ...msg, santaAction: { ...msg.santaAction, added: true } }
                    : msg
            )
        );
    }, [messages, addToCart]);

    // Initial Greeting
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                {
                    role: 'model',
                    text: isSanta
                        ? 'Ho ho ho! How can Santa AI help you today?'
                        : 'Hello! How can I help you today?',
                },
            ]);
        }
    }, [isOpen, messages.length, isSanta]);

    const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => (
        <View className={`flex-row gap-2 mb-3 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>

            {item.role === 'model' && (
                <View className={`w-7 h-7 rounded-full items-center justify-center border border-gray-100 ${isSanta ? 'bg-red-50' : 'bg-white'}`}>
                    {isSanta ? <Gift size={14} color="#DC2626" /> : <Sparkles size={14} color="#DC2626" />}
                </View>
            )}

            <View className="flex-col max-w-[75%]">
                <View className={`px-3 py-2.5 rounded-2xl ${item.role === 'user'
                    ? 'bg-red-600 rounded-tr-none'
                    : 'bg-white border border-gray-200 rounded-tl-none'
                    }`}>
                    {/* Render text with markdown support */}
                    {renderMarkdownText(item.text, item.role === 'user')}

                    {/* Santa Action Card */}
                    {item.santaAction && (
                        <View className="mt-2 pt-2 border-t border-green-200">
                            <View className="flex-row items-center gap-1.5 mb-1">
                                <Gift size={14} color="#16A34A" />
                                <Text className="text-[11px] font-bold text-green-700">Wish Granted!</Text>
                            </View>
                            <Text className="text-xs font-medium text-gray-800">{item.santaAction.productName}</Text>
                            <Text className="text-xs font-bold text-green-600 mb-2">{formatPrice(item.santaAction.price)}</Text>

                            <TouchableOpacity
                                onPress={() => handleAddSantaWishToCart(index)}
                                disabled={item.santaAction.added}
                                className={`flex-row items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg ${item.santaAction.added ? 'bg-green-100' : 'bg-green-600'
                                    }`}
                            >
                                <ShoppingCart size={14} color={item.santaAction.added ? '#15803D' : 'white'} />
                                <Text className={`text-[11px] font-bold ${item.santaAction.added ? 'text-green-700' : 'text-white'}`}>
                                    {item.santaAction.added ? 'Added!' : 'Add to Cart'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            {item.role === 'user' && (
                <View className="w-7 h-7 rounded-full bg-gray-200 items-center justify-center">
                    <User size={14} color="#666" />
                </View>
            )}
        </View>
    );

    return (
        <>
            {/* Chat Bubble Popup */}
            {isOpen && (
                <Animated.View
                    style={[
                        {
                            position: 'absolute',
                            bottom: 160 + bottomOffset,
                            right: 16,
                            width: CHAT_WIDTH,
                            height: CHAT_HEIGHT,
                            backgroundColor: '#F9FAFB',
                            borderRadius: 20,
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.15,
                            shadowRadius: 24,
                            elevation: 12,
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            zIndex: 100,
                        },
                        chatAnimatedStyle,
                    ]}
                >
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-3 py-2.5 bg-white border-b border-gray-100">
                        <View className="flex-row items-center gap-2">
                            <View className={`w-8 h-8 rounded-full items-center justify-center ${isSanta ? 'bg-red-100' : 'bg-red-50'}`}>
                                {isSanta ? <Gift size={18} color="#DC2626" /> : <Sparkles size={18} color="#DC2626" />}
                            </View>
                            <View>
                                <Text className="font-bold text-gray-900 text-sm">
                                    {isSanta ? 'Santa AI 🎄' : 'Ogabassey AI'}
                                </Text>
                                <Text className="text-[10px] text-green-600 font-medium">● Online</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => setIsOpen(false)}
                            className="p-1.5 bg-gray-100 rounded-full"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <X size={16} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {/* Messages */}
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderItem}
                        keyExtractor={(_, i) => i.toString()}
                        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
                        className="flex-1"
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        showsVerticalScrollIndicator={false}
                    />

                    {/* Loading Indicator */}
                    {isLoading && (
                        <View className="px-4 pb-2">
                            <View className="flex-row items-center gap-1.5 bg-white self-start px-3 py-1.5 rounded-2xl rounded-tl-none border border-gray-100">
                                <ActivityIndicator size="small" color="#DC2626" />
                                <Text className="text-[11px] text-gray-500">Typing...</Text>
                            </View>
                        </View>
                    )}

                    {/* Input Area */}
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
                    >
                        <View className="p-3 bg-white border-t border-gray-100">
                            {/* Suggestions */}
                            {messages.length < 3 && !isLoading && (
                                <View className="flex-row flex-wrap gap-1.5 mb-2">
                                    {SUGGESTIONS.slice(0, 2).map((s, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            onPress={() => handleSend(s.label)}
                                            className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full"
                                        >
                                            <Text className="text-[11px] text-gray-600">{s.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <View className="flex-row items-center gap-2">
                                <TextInput
                                    value={input}
                                    onChangeText={setInput}
                                    placeholder={isSanta ? "Tell Santa your wish..." : "Ask me anything..."}
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-2 text-[13px] text-gray-900"
                                    placeholderTextColor="#9CA3AF"
                                    returnKeyType="send"
                                    onSubmitEditing={() => handleSend(input)}
                                />
                                <TouchableOpacity
                                    onPress={() => handleSend(input)}
                                    disabled={!input.trim() || isLoading}
                                    className={`w-9 h-9 rounded-full items-center justify-center ${!input.trim() || isLoading ? 'bg-gray-200' : 'bg-red-600'
                                        }`}
                                >
                                    <Send size={16} color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Animated.View>
            )}

            {/* Draggable Container for FAB and Nudge */}
            <GestureDetector gesture={pan}>
                <Animated.View
                    style={[
                        dragStyle,
                        {
                            position: 'absolute',
                            right: 16,
                            bottom: 96 + bottomOffset, // Base position aligned with FAB center
                            zIndex: 50,
                        }
                    ]}
                >
                    {/* Proactive Nudge Bubble - Pinned to green AI indicator */}
                    {!isOpen && proactiveMsg && (
                        <Animated.View
                            entering={FadeInDown.springify().damping(20).mass(0.5)}
                            exiting={FadeOut.duration(200)}
                            className="absolute bg-white px-4 py-3 rounded-2xl shadow-md border border-gray-100"
                            style={{
                                bottom: 52, // Align with top of FAB where green indicator sits
                                right: 56, // Position to the left of the FAB
                                width: 180,
                                // Round all corners except bottom-right which points to indicator
                                borderBottomRightRadius: 4,
                            }}
                        >
                            <TouchableOpacity onPress={() => setIsOpen(true)}>
                                <Text className="text-gray-800 text-[13px] font-medium leading-5">
                                    {proactiveMsg}
                                </Text>
                            </TouchableOpacity>
                            {/* Tail pointing to green indicator */}
                            <View
                                className="absolute bg-white rotate-45 border-r border-b border-gray-100"
                                style={{
                                    width: 10,
                                    height: 10,
                                    bottom: 8,
                                    right: -5,
                                }}
                            />
                        </Animated.View>
                    )}

                    {/* Floating Action Button */}
                    <TouchableOpacity
                        onPress={() => setIsOpen(!isOpen)}
                        className={`w-14 h-14 rounded-full items-center justify-center shadow-lg border ${isOpen ? 'bg-gray-900 border-gray-800' : 'bg-[rgba(255,255,255,0.9)] border-gray-100'
                            }`}
                        style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 8,
                            elevation: 8
                        }}
                        activeOpacity={0.9}
                    >
                        {isOpen ? (
                            <X size={22} color="white" />
                        ) : (
                            <>
                                <Sparkles size={24} color="#DC2626" />
                                <View className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white items-center justify-center">
                                    <View className="w-2 h-2 bg-green-400 rounded-full" />
                                </View>
                            </>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            </GestureDetector>
        </>
    );
}
