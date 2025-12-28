/**
 * Lightweight Toast Component for mobile
 * Auto-dismisses after a short delay
 */

import { View, Text, Animated, StyleSheet } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

interface ToastState {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
}

let showToastFn: ((message: string, type?: 'success' | 'error' | 'info') => void) | null = null;

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    if (showToastFn) {
        showToastFn(message, type);
    }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'success' });
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-50)).current;

    useEffect(() => {
        showToastFn = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
            setToast({ visible: true, message, type });

            // Animate in
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-hide after 2 seconds
            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: -50,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ]).start(() => {
                    setToast({ visible: false, message: '', type: 'success' });
                });
            }, 2000);
        };

        return () => {
            showToastFn = null;
        };
    }, [fadeAnim, translateY]);

    const getIconName = () => {
        switch (toast.type) {
            case 'success':
                return 'checkmark-circle';
            case 'error':
                return 'close-circle';
            case 'info':
                return 'information-circle';
            default:
                return 'checkmark-circle';
        }
    };

    const getColors = () => {
        switch (toast.type) {
            case 'success':
                return { bg: '#22C55E', text: '#FFFFFF' };
            case 'error':
                return { bg: '#EF4444', text: '#FFFFFF' };
            case 'info':
                return { bg: '#3B82F6', text: '#FFFFFF' };
            default:
                return { bg: '#22C55E', text: '#FFFFFF' };
        }
    };

    if (!toast.visible) return <>{children}</>;

    const colors = getColors();

    return (
        <>
            {children}
            <Animated.View
                style={[
                    styles.toastContainer,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY }],
                        backgroundColor: colors.bg,
                    },
                ]}
            >
                <Ionicons name={getIconName()} size={20} color={colors.text} />
                <Text style={[styles.toastText, { color: colors.text }]}>{toast.message}</Text>
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    toastText: {
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '600',
    },
});
