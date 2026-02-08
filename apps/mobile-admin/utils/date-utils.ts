/**
 * Date Utilities for Orders Screen
 * Provides relative date labeling and order grouping
 */

import { format, isToday, isYesterday, isSameDay, startOfDay } from 'date-fns';
import type { Order } from '@baci/shared';

/**
 * Get a human-readable relative date label
 * - "Today" / "Yesterday" for recent dates
 * - Day names (Thursday, Wednesday, etc.) for current week
 * - "Mon, Jan 26" format for dates older than last Sunday
 */
export function getRelativeDateLabel(
    date: Date,
    referenceDate: Date = new Date()
): string {
    if (isToday(date)) {
        return 'Today';
    }

    if (isYesterday(date)) {
        return 'Yesterday';
    }

    // Calculate the most recent Sunday (start of current week)
    const refDay = referenceDate.getDay(); // 0 = Sunday, 6 = Saturday
    const daysSinceSunday = refDay; // How many days since last Sunday
    const lastSunday = new Date(referenceDate);
    lastSunday.setDate(referenceDate.getDate() - daysSinceSunday);
    lastSunday.setHours(0, 0, 0, 0);

    // If the date is on or after last Sunday, show day name
    if (date >= lastSunday) {
        return format(date, 'EEEE'); // Full day name: "Thursday", "Wednesday"
    }

    // For older dates, show abbreviated date format
    return format(date, 'EEE, MMM d'); // "Mon, Jan 26"
}

/**
 * Section type for SectionList
 */
export interface OrderSection {
    title: string;
    data: Order[];
}

/**
 * Group orders by relative date for SectionList
 * Returns sections with title (date label) and data (orders for that day)
 */
export function groupOrdersByRelativeDate(
    orders: Order[],
    referenceDate: Date = new Date()
): OrderSection[] {
    const grouped = new Map<string, Order[]>();

    // Group orders by date
    for (const order of orders) {
        const orderDate = new Date(order.created_at);
        const dayStart = startOfDay(orderDate);
        const label = getRelativeDateLabel(dayStart, referenceDate);

        const existing = grouped.get(label);
        if (existing) {
            existing.push(order);
        } else {
            grouped.set(label, [order]);
        }
    }

    // Convert to section array (maintains insertion order from Map)
    const sections: OrderSection[] = [];
    for (const [title, data] of grouped) {
        sections.push({ title, data });
    }

    return sections;
}

/**
 * Get the date key for an order (for grouping)
 * Returns the start of day as ISO string for consistent grouping
 */
export function getOrderDateKey(order: Order): string {
    const date = new Date(order.created_at);
    return startOfDay(date).toISOString();
}
