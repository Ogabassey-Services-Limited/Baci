import { Ionicons } from '@expo/vector-icons';
import type { Control, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { BRAND } from '@/constants/Colors';
import type { ShippingAddressInput } from '@/lib/validation';
import { CheckoutFormField } from './CheckoutFormField';
import { checkoutContactCardStyles as styles } from './CheckoutContactCard.styles';
import { CheckoutGuestSaveDetails } from './CheckoutGuestSaveDetails';

type CheckoutContactCardColors = {
  background: string;
  border: string;
  card: string;
  error: string;
  muted: string;
  placeholder: string;
  text: string;
  textSecondary: string;
};

type CheckoutContactCardProps = {
  accountPassword: string;
  colors: CheckoutContactCardColors;
  contactSummary: string;
  control: Control<ShippingAddressInput>;
  email?: string;
  errors: FieldErrors<ShippingAddressInput>;
  hasContactIdentity: boolean;
  isAuthenticated: boolean;
  isCollapsed: boolean;
  isDark: boolean;
  onChangeAccountPassword: (value: string) => void;
  onToggleCollapsed: () => void;
  onToggleSaveDetails: () => void;
  phone?: string;
  saveDetails: boolean;
};

const CONTACT_NAME_FIELDS = [
  { label: 'First Name', name: 'firstName', placeholder: 'E.g. John' },
  { label: 'Last Name', name: 'lastName', placeholder: 'E.g. Doe' },
] as const;

export function CheckoutContactCard({
  accountPassword,
  colors,
  contactSummary,
  control,
  email,
  errors,
  hasContactIdentity,
  isAuthenticated,
  isCollapsed,
  isDark,
  onChangeAccountPassword,
  onToggleCollapsed,
  onToggleSaveDetails,
  phone,
  saveDetails,
}: CheckoutContactCardProps) {
  const showCollapseAction =
    isAuthenticated && (isCollapsed || hasContactIdentity);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          overflow: 'visible',
          position: 'relative',
          zIndex: 20,
        },
      ]}
    >
      <View style={styles.cardHeaderActionRow}>
        <View style={[styles.cardHeader, styles.cardHeaderInline]}>
          <Ionicons name="person-outline" size={16} color={BRAND.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Contact
          </Text>
        </View>
        {showCollapseAction ? (
          <Pressable
            accessibilityLabel={
              isCollapsed ? 'Edit contact details' : 'Collapse contact details'
            }
            accessibilityRole="button"
            hitSlop={10}
            onPress={onToggleCollapsed}
            style={styles.inlineEditButton}
          >
            <View style={styles.inlineActionContent}>
              <Ionicons
                name={isCollapsed ? 'create-outline' : 'checkmark-outline'}
                size={16}
                color={BRAND.primary}
              />
              <Text style={styles.inlineActionText}>
                {isCollapsed ? 'Edit' : 'Done'}
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      {isCollapsed ? (
        <ContactSummary
          colors={colors}
          contactSummary={contactSummary}
          email={email}
          phone={phone}
        />
      ) : (
        <View style={[styles.cardBody, styles.contactCardBody]}>
          <View style={styles.row}>
            {CONTACT_NAME_FIELDS.map((field) => (
              <View key={field.name} style={styles.halfInput}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {field.label}
                </Text>
                <CheckoutFormField
                  autoCapitalize="words"
                  colors={colors}
                  control={control}
                  errors={errors}
                  isDark={isDark}
                  label=""
                  name={field.name}
                  placeholder={field.placeholder}
                />
              </View>
            ))}
          </View>

          <Text
            style={[styles.label, { color: colors.textSecondary, marginBottom: 8 }]}
          >
            Phone Number
          </Text>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onBlur, onChange, value } }) => (
              <PhoneInput
                containerStyle={styles.compactInputGroup}
                error={errors.phone?.message}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Email Address
          </Text>
          <CheckoutFormField
            autoCapitalize="none"
            colors={colors}
            containerStyle={styles.compactInputGroup}
            control={control}
            errors={errors}
            isDark={isDark}
            keyboardType="email-address"
            label=""
            name="email"
            placeholder="john@example.com"
          />

          {!isAuthenticated ? (
            <CheckoutGuestSaveDetails
              accountPassword={accountPassword}
              colors={colors}
              onChangeAccountPassword={onChangeAccountPassword}
              onToggleSaveDetails={onToggleSaveDetails}
              saveDetails={saveDetails}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function ContactSummary({
  colors,
  contactSummary,
  email,
  phone,
}: Pick<CheckoutContactCardProps, 'colors' | 'contactSummary' | 'email' | 'phone'>) {
  return (
    <View
      style={[
        styles.summaryPanel,
        {
          backgroundColor: colors.muted,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.summaryMetaRow}>
        <Ionicons name="person-circle-outline" size={16} color={BRAND.primary} />
        <Text style={[styles.summaryMetaLabel, { color: colors.textSecondary }]}>
          Signed in
        </Text>
      </View>
      <Text style={[styles.summaryTitle, { color: colors.text }]}>
        {contactSummary || 'Contact details'}
      </Text>
      {email ? (
        <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
          {email}
        </Text>
      ) : null}
      {phone ? (
        <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
          {phone}
        </Text>
      ) : null}
    </View>
  );
}
