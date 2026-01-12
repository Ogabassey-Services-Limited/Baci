import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { generateReport, ReportType } from './ReportsGenerator';
import { AnalyticsData } from '../../app/analytics';

const COLORS = {
    primary: '#000000',
    background: '#FFFFFF',
    text: '#111111',
    textSecondary: '#666666',
    border: '#EEEEEE',
    overlay: 'rgba(0,0,0,0.5)',
};

interface ReportSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    analyticsData: AnalyticsData;
    merchantName: string;
    startDate: Date;
    endDate: Date;
}

export default function ReportSelectionModal({
    visible,
    onClose,
    analyticsData,
    merchantName,
    startDate,
    endDate,
}: ReportSelectionModalProps) {
    const [loading, setLoading] = useState(false);

    if (!visible) return null;

    const handleGenerate = async (type: ReportType) => {
        setLoading(true);
        try {
            let transactions: any[] = [];

            if (type === 'tax_ledger') {
                const { data, error } = await supabase
                    .from('orders')
                    .select(`
                        id,
                        created_at,
                        total_amount,
                        tax_amount,
                        customer:customers(first_name, last_name)
                    `)
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString())
                    .eq('payment_status', 'paid')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                transactions = data || [];
            }

            await generateReport(type, {
                title: type === 'executive' ? 'Executive Summary' : 'Sales Tax Ledger',
                startDate,
                endDate,
                merchantName,
                data: analyticsData,
                transactions,
            });
            onClose();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.overlay}>
            <View style={styles.modal}>
                <View style={styles.header}>
                    <Text style={styles.title}>Export Report</Text>
                    <Pressable onPress={onClose}>
                        <Ionicons name="close" size={24} color={COLORS.text} />
                    </Pressable>
                </View>

                <View style={styles.content}>
                    <Pressable
                        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                        onPress={() => handleGenerate('executive')}
                        disabled={loading}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="stats-chart" size={24} color={COLORS.primary} />
                        </View>
                        <View style={styles.optionText}>
                            <Text style={styles.optionTitle}>Executive Summary</Text>
                            <Text style={styles.optionSubtitle}>Revenue, profit, and top performers</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                        onPress={() => handleGenerate('tax_ledger')}
                        disabled={loading}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="document-text" size={24} color={COLORS.primary} />
                        </View>
                        <View style={styles.optionText}>
                            <Text style={styles.optionTitle}>Tax & Sales Ledger</Text>
                            <Text style={styles.optionSubtitle}>Detailed transaction list for audits</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                    </Pressable>
                </View>

                {loading && (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loaderText}>Generating PDF...</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.overlay,
        justifyContent: 'flex-end',
        zIndex: 1000,
    },
    modal: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 40,
        minHeight: 300,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    content: {
        padding: 20,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    optionPressed: {
        backgroundColor: '#F0F0F0',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EEEEEE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionText: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 4,
    },
    optionSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    loaderText: {
        marginTop: 10,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
});
