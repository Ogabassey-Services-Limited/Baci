const fs = require('fs');
const file = 'apps/mobile-admin/components/orders/RecordPaymentSheet.tsx';
let content = fs.readFileSync(file, 'utf8');

// The first script didn't apply the style replacements because of regex mismatches.
// Let's use simple string replacements

content = content.replace(
  'style={[\n                styles.methodButton,\n                {\n                  backgroundColor: isSelected ? colors.primary : colors.card,\n                  borderColor: isSelected ? colors.primary : colors.border,\n                },\n              ]}',
  `style={({ pressed }) => [
                styles.methodButton,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}`
);

content = content.replace(
  'style={[\n          styles.confirmButton,\n          {\n            backgroundColor: colors.success,\n            opacity: isConfirmDisabled || isSubmitting ? 0.5 : 1,\n          },\n        ]}',
  `style={({ pressed }) => [
          styles.confirmButton,
          {
            backgroundColor: colors.success,
            opacity: isConfirmDisabled || isSubmitting ? 0.5 : pressed ? 0.7 : 1,
          },
        ]}`
);

fs.writeFileSync(file, content);
console.log('RecordPaymentSheet.tsx styles patched.');
