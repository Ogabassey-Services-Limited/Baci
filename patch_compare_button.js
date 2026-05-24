const fs = require('fs');
const file = 'apps/mobile-storefront/components/product/CompareButton.tsx';
let content = fs.readFileSync(file, 'utf8');

const searchStr = `    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={isInComparison ? 'Remove from comparison' : 'Add to comparison'}
      accessibilityState={{ checked: isInComparison }}
      style={({ pressed }) => [
        styles.button,
        size === 'small' && styles.buttonSmall,
        {
          backgroundColor: isInComparison
            ? \`\${BRAND.primary}15\`
            : \`\${colors.textSecondary}10\`,
          borderColor: isInComparison ? BRAND.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >`;

const replaceStr = `    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={isInComparison ? 'Remove from comparison' : 'Add to comparison'}
      accessibilityState={{ checked: isInComparison }}
      accessibilityHint="Toggles adding or removing this product from the comparison list"
      style={({ pressed }) => [
        styles.button,
        size === 'small' && styles.buttonSmall,
        {
          backgroundColor: isInComparison
            ? \`\${BRAND.primary}15\`
            : \`\${colors.textSecondary}10\`,
          borderColor: isInComparison ? BRAND.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replaceStr);
  fs.writeFileSync(file, content);
  console.log('Successfully patched CompareButton.tsx (added hint)');
} else {
  console.error('Could not find string to replace');
}
