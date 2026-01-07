/**
 * New Order Screen (Record a Sale)
 * Redesigned to match "Record a sale" UI inspiration
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Pressable,
    Alert,
    ActivityIndicator,
    FlatList,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useMerchant } from '@/hooks/useMerchant';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers, useCreateCustomer } from '@/hooks/useCustomers';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { format } from 'date-fns';
import {
    ORDER_SOURCE_CONFIG,
    BRAND_COLORS,
    type OrderSource,
    type PaymentStatus
} from '@baci/shared';

// Type definitions
interface OrderItem {
    product_id: string; // 'custom' for manual items
    product_name: string;
    quantity: number;
    price: number;
    image_url?: string;
    is_custom?: boolean;
}

interface CustomerInfo {
    name: string;
    email: string;
    phone: string;
    address: string;
}

const CHANNELS: { id: OrderSource; label: string; icon: any; color: string }[] = [
    { id: 'physical', label: 'Physical sales', icon: 'storefront', color: ORDER_SOURCE_CONFIG?.physical?.colorKey || 'primary' },
    { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: BRAND_COLORS?.instagram || '#E4405F' },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', color: BRAND_COLORS?.whatsapp || '#25D366' },
    { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: BRAND_COLORS?.facebook || '#1877F2' },
    { id: 'tiktok', label: 'Tiktok', icon: 'logo-tiktok', color: BRAND_COLORS?.tiktok || '#000000' },
    { id: 'jumia', label: 'Jumia', icon: 'cart', color: BRAND_COLORS?.jumia || '#F68B1E' },
    { id: 'jiji', label: 'Jiji', icon: 'pricetag', color: BRAND_COLORS?.jiji || '#3DB83A' },
    { id: 'konga', label: 'Konga', icon: 'bag', color: BRAND_COLORS?.konga || '#ED017F' },
];

export default function NewOrderScreen() {
    const { colors, shadows } = useTheme();
    const { merchant } = useMerchant();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { data: productsData, isLoading: productsLoading } = useProducts();
    const { data: customersData } = useCustomers({ search: customerSearch });
    const createCustomerMutation = useCreateCustomer();

    // State
    const [date, setDate] = useState(new Date());
    const [selectedChannel, setSelectedChannel] = useState<OrderSource>('physical');
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
    const [customer, setCustomer] = useState<CustomerInfo>({ name: '', email: '', phone: '', address: '' });
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modals
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showCustomItemModal, setShowCustomItemModal] = useState(false);

    // Search & Form
    const [productSearch, setProductSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ firstName: '', lastName: '', phone: '', email: '' });
    const [customItem, setCustomItem] = useState({ name: '', price: '' });

    // Helpers
    const formatPrice = (amount: number) =>
        new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);

    // Filter Products
    const allProducts = useMemo(() => {
        if (!productsData?.pages) return [];
        return productsData.pages.flatMap((page) => page.products || []);
    }, [productsData]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return allProducts;
        const search = productSearch.toLowerCase();
        return allProducts.filter((p) =>
            p.name.toLowerCase().includes(search) ||
            p.sku?.toLowerCase().includes(search)
        );
    }, [allProducts, productSearch]);

    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Handlers (Same logic, just keeping cleanly separated)
    const handleAddProduct = (product: any) => {
        setOrderItems((prev) => {
            const existing = prev.find((item) => item.product_id === product.id);
            if (existing) {
                return prev.map((item) =>
                    item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, {
                product_id: product.id,
                product_name: product.name,
                quantity: 1,
                price: product.price,
                image_url: product.images?.[0],
            }];
        });
        setShowProductModal(false);
        setProductSearch('');
    };

    const handleAddCustomItem = () => {
        if (!customItem.name || !customItem.price) return;
        setOrderItems((prev) => [
            ...prev,
            {
                product_id: `custom-${Date.now()}`,
                product_name: customItem.name,
                quantity: 1,
                price: Number(customItem.price),
                is_custom: true,
            },
        ]);
        setCustomItem({ name: '', price: '' });
        setShowCustomItemModal(false);
    };

    const handleQuantityChange = (id: string, delta: number) => {
        setOrderItems((prev) => prev.map(item => {
            if (item.product_id !== id) return item;
            return { ...item, quantity: Math.max(0, item.quantity + delta) };
        }).filter(item => item.quantity > 0));
    };

    const handleSelectCustomer = (c: any) => {
        setCustomer({
            name: c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
            email: c.email || '',
            phone: c.phone || '',
            address: ''
        });
        setShowCustomerModal(false);
        setCustomerSearch('');
    };

    const handleCreateCustomer = async () => {
        if (!newCustomer.firstName || !newCustomer.phone) {
            Alert.alert('Required', 'First Name and Phone are required');
            return;
        }

        try {
            const customer = await createCustomerMutation.mutateAsync({
                first_name: newCustomer.firstName,
                last_name: newCustomer.lastName,
                phone: newCustomer.phone,
                email: newCustomer.email || undefined,
            });

            handleSelectCustomer(customer);
            setIsCreatingCustomer(false);
            setNewCustomer({ firstName: '', lastName: '', phone: '', email: '' });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const generateOrderNumber = () => {
        const date = new Date();
        const prefix = 'ORD';
        const datePart = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getFullYear()).slice(-2)}`;
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${datePart}-${randomPart}`;
    };

    const handleSubmit = async () => {
        if (orderItems.length === 0) {
            Alert.alert('Required', 'Please add at least one product');
            return;
        }

        setIsSubmitting(true);
        try {
            const orderNumber = generateOrderNumber();

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    merchant_id: merchant?.id,
                    order_number: orderNumber,
                    customer_name: customer.name || 'Walk-in Customer',
                    customer_email: customer.email || null,
                    customer_phone: customer.phone || null,
                    shipping_status: 'fulfilled',
                    payment_status: paymentStatus,
                    total: total,
                    subtotal: total,
                    currency: merchant?.payout_currency || 'NGN',
                    source: selectedChannel,
                    recorded_by_user_id: user?.id,
                    notes: notes.trim() || null,
                })
                .select()
                .single();

            if (orderError) throw orderError;

            const { error: itemsError } = await supabase.from('order_items').insert(
                orderItems.map((item) => ({
                    order_id: order.id,
                    product_id: item.is_custom ? null : item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    price: item.price,
                }))
            );

            if (itemsError) throw itemsError;

            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['order-counts'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

            Alert.alert('Success', 'Sale recorded successfully', [
                { text: 'View Order', onPress: () => router.replace(`/order/${order.id}`) },
                {
                    text: 'New Sale', onPress: () => {
                        setOrderItems([]);
                        setCustomer({ name: '', email: '', phone: '', address: '' });
                        setNotes('');
                    }
                },
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: 'New Sale',
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={{ paddingRight: 16 }}>
                            <Text style={{ color: colors.text, fontSize: 16 }}>Cancel</Text>
                        </Pressable>
                    ),
                    headerRight: () => (
                        isSubmitting && <ActivityIndicator color={colors.primary} />
                    ),
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                    headerTitleStyle: { fontFamily: TYPOGRAPHY.fontFamily.bold },
                }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={100}
            >
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                    {/* SECTION 1: Details (Date & Customer) - List Style */}
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        {/* Date Row */}
                        <View style={[styles.listRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                            <View style={styles.iconBox}>
                                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                            </View>
                            <Text style={[styles.listLabel, { color: colors.text }]}>Date</Text>
                            <Text style={[styles.listValue, { color: colors.textSecondary }]}>
                                {format(date, 'MMM dd, yyyy')}
                            </Text>
                        </View>

                        {/* Customer Row */}
                        <Pressable
                            style={styles.listRow}
                            onPress={() => setShowCustomerModal(true)}
                        >
                            <View style={styles.iconBox}>
                                <Ionicons name="person-outline" size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.listLabel, { color: colors.text }]}>Customer</Text>
                                {customer.name ? (
                                    <Text style={[styles.listSubValue, { color: colors.success }]}>
                                        {customer.name} {customer.phone ? `• ${customer.phone}` : ''}
                                    </Text>
                                ) : null}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {!customer.name && <Text style={{ color: colors.textMuted, fontSize: 14 }}>Optional</Text>}
                                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                            </View>
                        </Pressable>
                    </View>

                    {/* SECTION 2: Sales Channel - Horizontal Scroll */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sales Channel</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.channelScroll}
                        >
                            {CHANNELS.map((channel) => {
                                const isSelected = selectedChannel === channel.id;
                                const rawColor = channel.color || colors.primary;
                                const activeColor = rawColor.startsWith('#') ? rawColor : (colors[rawColor as keyof typeof colors] || colors.primary);

                                return (
                                    <Pressable
                                        key={channel.id}
                                        style={[
                                            styles.channelPill,
                                            {
                                                backgroundColor: isSelected ? activeColor : colors.card,
                                                borderColor: isSelected ? activeColor : colors.border,
                                            }
                                        ]}
                                        onPress={() => setSelectedChannel(channel.id)}
                                    >
                                        <Ionicons
                                            name={channel.icon}
                                            size={18}
                                            color={isSelected ? '#fff' : colors.textSecondary}
                                        />
                                        <Text style={[
                                            styles.channelText,
                                            { color: isSelected ? '#fff' : colors.text }
                                        ]}>
                                            {channel.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* SECTION 3: Products */}
                    <View style={styles.section}>
                        <View style={styles.rowBetween}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Items</Text>
                        </View>

                        {/* New Item Actions - Modern Buttons */}
                        <View style={styles.rowGap}>
                            <Pressable
                                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={() => setShowProductModal(true)}
                            >
                                <Ionicons name="search" size={20} color={colors.primary} />
                                <Text style={[styles.actionBtnText, { color: colors.text }]}>Search Catalog</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={() => setShowCustomItemModal(true)}
                            >
                                <Ionicons name="add" size={20} color={colors.primary} />
                                <Text style={[styles.actionBtnText, { color: colors.text }]}>Custom Amount</Text>
                            </Pressable>
                        </View>

                        {/* Product List - Card Style Rows */}
                        <View style={{ marginTop: 12, gap: 8 }}>
                            {orderItems.length === 0 ? (
                                <View style={[styles.emptyState, { borderColor: colors.border }]}>
                                    <Text style={{ color: colors.textMuted }}>No items added yet</Text>
                                </View>
                            ) : (
                                orderItems.map((item) => (
                                    <View key={item.product_id} style={[styles.itemCard, { backgroundColor: colors.card }]}>
                                        <View style={[styles.qtyBadge, { backgroundColor: colors.inputBg }]}>
                                            <Text style={{ fontWeight: 'bold', color: colors.text }}>{item.quantity}x</Text>
                                        </View>
                                        <View style={{ flex: 1, paddingHorizontal: 12 }}>
                                            <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{item.product_name}</Text>
                                            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{formatPrice(item.price)}/ea</Text>
                                        </View>

                                        <View style={styles.itemActions}>
                                            <Pressable onPress={() => handleQuantityChange(item.product_id, -1)} style={[styles.circleBtn, { backgroundColor: colors.border }]}>
                                                <Ionicons name="remove" size={16} color={colors.text} />
                                            </Pressable>
                                            <Pressable onPress={() => handleQuantityChange(item.product_id, 1)} style={[styles.circleBtn, { backgroundColor: colors.primary }]}>
                                                <Ionicons name="add" size={16} color="#fff" />
                                            </Pressable>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </View>

                    {/* SECTION 4: Notes */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text>
                        <TextInput
                            style={[styles.notesInput, { backgroundColor: colors.card, color: colors.text }]}
                            placeholder="Add internal notes..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            value={notes}
                            onChangeText={setNotes}
                        />
                    </View>

                    {/* Padding for footer */}
                    <View style={{ height: 100 }} />

                </ScrollView>
            </KeyboardAvoidingView>

            {/* Sticky Footer */}
            <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                {/* Payment Toggle inside Footer */}
                <View style={[styles.paymentToggle, { backgroundColor: colors.inputBg }]}>
                    {(['unpaid', 'paid', 'partially_paid'] as PaymentStatus[]).map((status) => {
                        const isSelected = paymentStatus === status;
                        return (
                            <Pressable
                                key={status}
                                style={[
                                    styles.toggleOption,
                                    isSelected && { backgroundColor: colors.background, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 2 }
                                ]}
                                onPress={() => setPaymentStatus(status)}
                            >
                                <Text style={[
                                    styles.toggleText,
                                    { color: isSelected ? (status === 'paid' ? colors.success : status === 'unpaid' ? colors.error : colors.warning) : colors.textSecondary }
                                ]}>
                                    {status === 'partially_paid' ? 'Partial' : status.toUpperCase()}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <View style={styles.footerRow}>
                    <View>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Total Amount</Text>
                        <Text style={{ color: colors.text, fontSize: 24, fontFamily: TYPOGRAPHY.fontFamily.bold }}>
                            {formatPrice(total)}
                        </Text>
                    </View>
                    <Pressable
                        style={[styles.payBtn, { backgroundColor: colors.primary, opacity: orderItems.length === 0 ? 0.6 : 1 }]}
                        onPress={handleSubmit}
                        disabled={isSubmitting || orderItems.length === 0}
                    >
                        <Text style={styles.payBtnText}>Save Order</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </Pressable>
                </View>
            </View>

            {/* --- MODALS (Same functionality, simplified styles) --- */}

            {/* Product Modal */}
            <Modal visible={showProductModal} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Select Item</Text>
                        <Pressable onPress={() => setShowProductModal(false)}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </Pressable>
                    </View>
                    <View style={[styles.searchBox, { backgroundColor: colors.cardHover }]}>
                        <Ionicons name="search" size={20} color={colors.textMuted} />
                        <TextInput
                            style={{ flex: 1, color: colors.text, marginLeft: 8 }}
                            placeholder="Search products..."
                            placeholderTextColor={colors.textMuted}
                            value={productSearch}
                            onChangeText={setProductSearch}
                            autoFocus
                        />
                    </View>
                    <FlatList
                        data={filteredProducts}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <Pressable
                                style={[styles.productItem, { borderBottomColor: colors.border }]}
                                onPress={() => handleAddProduct(item)}
                            >
                                <View>
                                    <Text style={{ color: colors.text, fontSize: 16 }}>{item.name}</Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>SKU: {item.sku || 'N/A'}</Text>
                                </View>
                                <Text style={{ color: colors.text, fontWeight: '500' }}>{formatPrice(item.price)}</Text>
                            </Pressable>
                        )}
                    />
                </SafeAreaView>
            </Modal>

            {/* Custom Item Modal */}
            <Modal visible={showCustomItemModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.dialog, { backgroundColor: colors.card }]}>
                        <Text style={[styles.dialogTitle, { color: colors.text }]}>Custom Item</Text>
                        <TextInput
                            style={[styles.dialogInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                            placeholder="Description (e.g. Delivery Fee)"
                            placeholderTextColor={colors.textMuted}
                            value={customItem.name}
                            onChangeText={t => setCustomItem(p => ({ ...p, name: t }))}
                        />
                        <TextInput
                            style={[styles.dialogInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                            placeholder="Amount (0.00)"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            value={customItem.price}
                            onChangeText={t => setCustomItem(p => ({ ...p, price: t }))}
                        />
                        <View style={styles.dialogActions}>
                            <Pressable onPress={() => setShowCustomItemModal(false)} style={styles.dialogBtn}>
                                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                            </Pressable>
                            <Pressable onPress={handleAddCustomItem} style={[styles.dialogBtn, { backgroundColor: colors.success, borderRadius: 8 }]}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add to Cart</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Customer Modal - Enhanced */}
            <Modal visible={showCustomerModal} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <View>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {isCreatingCustomer ? 'New Customer' : 'Select Customer'}
                            </Text>
                            {isCreatingCustomer && (
                                <Pressable onPress={() => setIsCreatingCustomer(false)} style={{ marginTop: 4 }}>
                                    <Text style={{ color: colors.primary }}>Back to search</Text>
                                </Pressable>
                            )}
                        </View>
                        <Pressable onPress={() => setShowCustomerModal(false)}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </Pressable>
                    </View>

                    {isCreatingCustomer ? (
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                            <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
                                <View style={{ gap: 8 }}>
                                    <Text style={{ color: colors.textSecondary }}>Contact Info</Text>
                                    <TextInput
                                        style={[styles.sheetInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                                        placeholder="Mobile Phone (Required)"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="phone-pad"
                                        value={newCustomer.phone}
                                        onChangeText={t => setNewCustomer(p => ({ ...p, phone: t }))}
                                    />
                                    <TextInput
                                        style={[styles.sheetInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                                        placeholder="Email Address (Optional)"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={newCustomer.email}
                                        onChangeText={t => setNewCustomer(p => ({ ...p, email: t }))}
                                    />
                                </View>

                                <View style={{ gap: 8 }}>
                                    <Text style={{ color: colors.textSecondary }}>Personal Info</Text>
                                    <TextInput
                                        style={[styles.sheetInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                                        placeholder="First Name (Required)"
                                        placeholderTextColor={colors.textMuted}
                                        value={newCustomer.firstName}
                                        onChangeText={t => setNewCustomer(p => ({ ...p, firstName: t }))}
                                    />
                                    <TextInput
                                        style={[styles.sheetInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                                        placeholder="Last Name"
                                        placeholderTextColor={colors.textMuted}
                                        value={newCustomer.lastName}
                                        onChangeText={t => setNewCustomer(p => ({ ...p, lastName: t }))}
                                    />
                                </View>

                                <Pressable
                                    style={[styles.payBtn, { backgroundColor: colors.primary, marginTop: 16, justifyContent: 'center' }]}
                                    onPress={handleCreateCustomer}
                                    disabled={createCustomerMutation.isPending}
                                >
                                    {createCustomerMutation.isPending ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.payBtnText}>Save Customer</Text>
                                    )}
                                </Pressable>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    ) : (
                        <>
                            <View style={[styles.searchBox, { backgroundColor: colors.cardHover }]}>
                                <Ionicons name="search" size={20} color={colors.textMuted} />
                                <TextInput
                                    style={{ flex: 1, color: colors.text, marginLeft: 8 }}
                                    placeholder="Search name, email, or phone..."
                                    placeholderTextColor={colors.textMuted}
                                    value={customerSearch}
                                    onChangeText={setCustomerSearch}
                                />
                            </View>

                            <Pressable
                                style={[styles.listRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                                onPress={() => setIsCreatingCustomer(true)}
                            >
                                <View style={[styles.iconBox, { backgroundColor: colors.primary + '20' }]}>
                                    <Ionicons name="person-add" size={18} color={colors.primary} />
                                </View>
                                <Text style={[styles.listLabel, { color: colors.primary, fontSize: 16 }]}>
                                    Create new customer
                                </Text>
                            </Pressable>

                            <FlatList
                                data={customersData?.pages.flatMap(p => p.customers) || []}
                                keyExtractor={item => item.id}
                                contentContainerStyle={{ paddingBottom: 40 }}
                                renderItem={({ item }) => (
                                    <Pressable
                                        style={[styles.listRow, { borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 12 }]}
                                        onPress={() => handleSelectCustomer(item)}
                                    >
                                        <View style={[styles.iconBox, { backgroundColor: colors.cardHover }]}>
                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textSecondary }}>
                                                {(item.first_name?.[0] || item.email?.[0] || '?').toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.itemTitle, { color: colors.text }]}>
                                                {item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown'}
                                            </Text>
                                            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                                                {item.phone || item.email || 'No contact info'}
                                            </Text>
                                        </View>
                                        {(item.total_orders > 0) && (
                                            <View style={[styles.qtyBadge, { backgroundColor: colors.success + '20' }]}>
                                                <Text style={{ color: colors.success, fontSize: 12 }}>{item.total_orders} orders</Text>
                                            </View>
                                        )}
                                    </Pressable>
                                )}
                                ListEmptyComponent={
                                    <View style={{ padding: 32, alignItems: 'center' }}>
                                        <Text style={{ color: colors.textMuted }}>No customers found</Text>
                                    </View>
                                }
                            />
                        </>
                    )}
                </SafeAreaView>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: SPACING.md, gap: SPACING.md },

    // List Card Style
    card: {
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.03)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    listLabel: { fontSize: 14, fontWeight: '500' },
    listValue: { fontSize: 14, marginLeft: 'auto' },
    listSubValue: { fontSize: 13, marginTop: 2 },

    // Channel Section
    section: { marginTop: 8 },
    sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, opacity: 0.7 },
    channelScroll: { gap: 8, paddingRight: 16 },
    channelPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 100,
        borderWidth: 1,
        gap: 6,
    },
    channelText: { fontSize: 13, fontWeight: '600' },

    // Product Section
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    rowGap: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    actionBtnText: { fontSize: 14, fontWeight: '500' },

    emptyState: { padding: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: RADIUS.md },

    // Item Card
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: RADIUS.md,
    },
    qtyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    itemTitle: { fontSize: 15, fontWeight: '500' },
    itemActions: { flexDirection: 'row', gap: 8 },
    circleBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

    // Notes
    notesInput: {
        height: 80,
        borderRadius: RADIUS.md,
        padding: 12,
        textAlignVertical: 'top',
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        gap: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 10,
    },
    paymentToggle: {
        flexDirection: 'row',
        padding: 4,
        borderRadius: RADIUS.lg,
    },
    toggleOption: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.md },
    toggleText: { fontSize: 12, fontWeight: '700' },

    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    payBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 100,
    },
    payBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Modal Styles
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    searchBox: { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 12, borderRadius: 8 },
    productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
    dialog: { padding: 24, borderRadius: 20, gap: 16, width: '90%', alignSelf: 'center' },
    dialogTitle: { fontSize: 18, fontWeight: 'bold' },
    dialogInput: { padding: 14, borderRadius: 12 },
    dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
    dialogBtn: { paddingHorizontal: 16, paddingVertical: 10 },
    bottomSheet: { padding: 24, paddingBottom: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    sheetTitle: { fontSize: 20, fontWeight: 'bold' },
    sheetInput: { padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 },
    sheetBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8 },

});
