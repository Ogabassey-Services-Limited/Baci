import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Modal, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { RADIUS, SPACING } from '@/constants/theme';

interface BarcodeScannerModalProps {
    isVisible: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
    title?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
    isVisible,
    onClose,
    onScan,
    title = 'Scan Barcode',
}) => {
    const { colors } = useTheme();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (isVisible && (!permission || !permission.granted)) {
            requestPermission();
        }
    }, [isVisible, permission, requestPermission]);

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        // Provide haptic feedback for success
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onScan(data);

        // Reset scanned state after a short delay to prevent multi-scans but allow subsequent ones
        setTimeout(() => {
            setScanned(false);
        }, 1500);
    };

    if (!permission) {
        return null;
    }

    return (
        <Modal
            animationType="slide"
            transparent={false}
            visible={isVisible}
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <Pressable onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={colors.text} />
                    </Pressable>
                </View>

                {!permission.granted ? (
                    <View style={styles.center}>
                        <Ionicons name="camera-outline" size={64} color={colors.textMuted} style={{ marginBottom: 20 }} />
                        <Text style={[styles.message, { color: colors.textSecondary }]}>
                            Camera permission is required to scan barcodes.
                        </Text>
                        <Pressable
                            style={[styles.button, { backgroundColor: colors.primary }]}
                            onPress={requestPermission}
                        >
                            <Text style={styles.buttonText}>Grant Permission</Text>
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.cameraContainer}>
                        <CameraView
                            style={styles.camera}
                            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                            barcodeScannerSettings={{
                                barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
                            }}
                        >
                            <View style={styles.overlay}>
                                <View style={[styles.scannerBox, { borderColor: colors.primary }]}>
                                    <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
                                    <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
                                    <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
                                    <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />

                                    {/* Subtle scanning animation line placeholder */}
                                    <View style={[styles.scanLine, { backgroundColor: colors.primary }]} />
                                </View>
                                <Text style={styles.helperText}>Align barcode within the frame</Text>
                            </View>
                        </CameraView>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingTop: 60,
        paddingBottom: SPACING.md,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
    },
    closeButton: {
        padding: 4,
    },
    cameraContainer: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    message: {
        textAlign: 'center',
        marginBottom: SPACING.lg,
        fontSize: 16,
        lineHeight: 24,
    },
    button: {
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerBox: {
        width: 280,
        height: 180,
        borderWidth: 0,
        backgroundColor: 'transparent',
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderWidth: 3,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
    scanLine: {
        position: 'absolute',
        width: '100%',
        height: 2,
        top: '50%',
        opacity: 0.5,
    },
    helperText: {
        color: '#FFF',
        marginTop: 30,
        fontSize: 15,
        fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: RADIUS.full,
    },
});
