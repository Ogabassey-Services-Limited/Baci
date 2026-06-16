import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DateTimePickerField } from '@/components/ui/DateTimePickerField';
import { BRAND, palette } from '@/constants/Colors';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { SAVINGS_FREQUENCIES, themedInputStyle } from './start-savings.helpers';
import { startSavingsStyles as styles } from './start-savings.styles';
import type {
  SavingsProductChoice,
  StartSavingsColors,
} from './start-savings.types';
import type { StartSavingsController } from './start-savings-controller.types';
import { toProductChoice } from './start-savings-controller.utils';

type StartSavingsProductFieldsProps = {
  colors: StartSavingsColors;
  controller: StartSavingsController;
};

const MAX_PRODUCT_SUGGESTIONS = 5;

export function StartSavingsProductFields({
  colors,
  controller,
}: StartSavingsProductFieldsProps) {
  return (
    <>
      <ProductSearchSection colors={colors} controller={controller} />
      <TargetAndFrequencySection colors={colors} controller={controller} />
    </>
  );
}

function ProductSearchSection({
  colors,
  controller,
}: StartSavingsProductFieldsProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.text }]}>
        What are you saving for?
      </Text>
      <TextInput
        accessibilityRole="search"
        accessibilityLabel="Savings product search"
        value={controller.searchValue}
        onChangeText={controller.setSearchValue}
        placeholder="Search product"
        placeholderTextColor={colors.placeholder}
        style={[styles.input, themedInputStyle(colors)]}
      />
      {controller.selectedProduct ? (
        <View
          style={[
            styles.selectedProductCard,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Text
            style={[
              styles.selectedProductLabel,
              { color: colors.textSecondary },
            ]}
          >
            Selected product
          </Text>
          <Text style={[styles.selectedProductName, { color: colors.text }]}>
            {controller.selectedProduct.name}
          </Text>
          <Text
            style={[styles.selectedProductPrice, { color: colors.primary }]}
          >
            {formatNgnCurrency(controller.selectedProduct.price)}
          </Text>
          <ProductMeta colors={colors} product={controller.selectedProduct} />
        </View>
      ) : null}
      {!controller.selectedProduct && controller.debouncedSearch.trim() ? (
        <View style={styles.productSuggestions}>
          {controller.isProductsLoading ? (
            <ActivityIndicator
              accessibilityLabel="Loading savings products"
              size="small"
              color={BRAND.primary}
            />
          ) : controller.products.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No matching products found.
            </Text>
          ) : (
            controller.products
              .slice(0, MAX_PRODUCT_SUGGESTIONS)
              .map((product) => (
                <Pressable
                  key={product.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${product.name}`}
                  onPress={() => controller.selectProduct(product)}
                  style={[
                    styles.productSuggestionRow,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.productSuggestionName,
                      { color: colors.text },
                    ]}
                  >
                    {product.name}
                  </Text>
                  <Text
                    style={[
                      styles.productSuggestionPrice,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {formatNgnCurrency(product.price)}
                  </Text>
                  <ProductMeta
                    colors={colors}
                    product={toProductChoice(product)}
                  />
                </Pressable>
              ))
          )}
        </View>
      ) : null}
    </View>
  );
}

function ProductMeta({
  colors,
  product,
}: {
  colors: StartSavingsColors;
  product: SavingsProductChoice;
}) {
  const meta = [product.conditionLabel, product.variantLabel].filter(
    (value): value is string => Boolean(value)
  );

  if (meta.length === 0) {
    return null;
  }

  return (
    <Text style={[styles.productMetaText, { color: colors.textSecondary }]}>
      {meta.join(' · ')}
    </Text>
  );
}

function TargetAndFrequencySection({
  colors,
  controller,
}: StartSavingsProductFieldsProps) {
  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          Target amount
        </Text>
        <TextInput
          accessibilityLabel="Savings target amount"
          value={controller.targetAmount}
          onChangeText={controller.setTargetAmount}
          keyboardType="number-pad"
          placeholder="Enter amount"
          placeholderTextColor={colors.placeholder}
          style={[styles.input, themedInputStyle(colors)]}
        />
      </View>
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          How will you prefer to save?
        </Text>
        <View style={styles.frequencyRow}>
          {SAVINGS_FREQUENCIES.map((option) => {
            const isActive = controller.frequency === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${option} savings frequency`}
                onPress={() => controller.setFrequency(option)}
                style={[
                  styles.frequencyOption,
                  {
                    backgroundColor: isActive ? BRAND.primary : colors.card,
                    borderColor: isActive ? BRAND.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.frequencyOptionLabel,
                    { color: isActive ? palette.white : colors.text },
                  ]}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <DateAndAmountInputs colors={colors} controller={controller} />
    </>
  );
}

function DateAndAmountInputs({
  colors,
  controller,
}: StartSavingsProductFieldsProps) {
  return (
    <View style={styles.row}>
      <DateTimePickerField
        accessibilityLabel="Savings debit time"
        fallbackDisplay="06:20"
        fieldStyle={[styles.pickerField, themedInputStyle(colors)]}
        label="Preferred debit time"
        labelStyle={[styles.sectionLabel, { color: colors.text }]}
        mode="time"
        onChangeText={controller.setPreferredDebitTime}
        textStyle={[styles.pickerFieldText, { color: colors.text }]}
        value={controller.preferredDebitTime}
        wrapperStyle={styles.rowItem}
      />
      <DateTimePickerField
        accessibilityLabel="Savings start date"
        fallbackDisplay="YYYY-MM-DD"
        fieldStyle={[styles.pickerField, themedInputStyle(colors)]}
        label="Start date"
        labelStyle={[styles.sectionLabel, { color: colors.text }]}
        mode="date"
        onChangeText={controller.setStartDate}
        textStyle={[styles.pickerFieldText, { color: colors.text }]}
        value={controller.startDate}
        wrapperStyle={styles.rowItem}
      />
    </View>
  );
}
