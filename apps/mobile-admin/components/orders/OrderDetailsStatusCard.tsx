import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { orderDetailsOverviewStyles as styles } from './order-details-overview.styles';
import type { OrderSourceInfo } from './order-details.types';

interface OrderDetailsStatusCardProps {
  colors: ThemeColors;
  createdAtLabel: string;
  recordedByName?: string | null;
  shippingColor: string;
  shippingConfig: { icon: string; label: string };
  shippingStatus: string;
  source?: string | null;
  sourceInfo: OrderSourceInfo;
  updatedAtLabel: string;
}

export function OrderDetailsStatusCard({
  colors,
  createdAtLabel,
  recordedByName,
  shippingColor,
  shippingConfig,
  shippingStatus,
  source,
  sourceInfo,
  updatedAtLabel,
}: OrderDetailsStatusCardProps) {
  const baseSteps = ['pending', 'processing', 'shipped', 'delivered'];
  const currentStatus = shippingStatus === 'fulfilled' ? 'pending' : shippingStatus;
  const steps = [...baseSteps];
  if (currentStatus === 'returned') steps.push('returned');
  if (currentStatus === 'cancelled') steps.push('cancelled');
  const currentStepIndex = steps.indexOf(currentStatus);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.statusHeader}>
        <View>
          <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
            Placed on {createdAtLabel}
          </Text>
          <View style={styles.sourceRow}>
            <Ionicons
              color={sourceInfo.color}
              name={sourceInfo.name as keyof typeof Ionicons.glyphMap}
              size={14}
            />
            <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
              {source === 'staff_entry' && recordedByName
                ? `Recorded by ${recordedByName}`
                : `via ${sourceInfo.label}`}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadgeBig, { backgroundColor: `${shippingColor}15` }]}>
          <Ionicons
            color={shippingColor}
            name={shippingConfig.icon as keyof typeof Ionicons.glyphMap}
            size={14}
          />
          <Text style={[styles.statusTextBig, { color: shippingColor }]}>
            {shippingConfig.label}
          </Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        {steps.map((step, index) => {
          const isActive = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isLast = index === steps.length - 1;

          return (
            <Fragment key={step}>
              <View style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: isActive ? shippingColor : colors.inputBg,
                      borderColor: isActive ? shippingColor : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    color={isActive ? colors.textOnPrimary : colors.textMuted}
                    name={shippingConfig.icon as keyof typeof Ionicons.glyphMap}
                    size={12}
                  />
                </View>
                <Text
                  style={[
                    styles.progressLabel,
                    {
                      color: isCurrent ? colors.text : colors.textMuted,
                      fontWeight: isCurrent ? '700' : '600',
                    },
                  ]}
                >
                  {step}
                </Text>
              </View>
              {!isLast ? (
                <View
                  style={[
                    styles.progressLine,
                    {
                      backgroundColor:
                        index < currentStepIndex ? shippingColor : colors.border,
                    },
                  ]}
                />
              ) : null}
            </Fragment>
          );
        })}
      </View>

      <Text style={[styles.statusNote, { color: colors.textMuted }]}>
        Latest update: {updatedAtLabel}
      </Text>
    </View>
  );
}
