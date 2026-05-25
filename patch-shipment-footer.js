const fs = require('fs');
const file = 'apps/mobile-admin/components/orders/ShipmentFlowFooter.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'style={[\n            styles.secondaryButton,\n            { backgroundColor: colors.backgroundLight },\n            isSubmitting ? styles.secondaryButtonDisabled : null,\n          ]}',
  `style={({ pressed }) => [\n            styles.secondaryButton,\n            { backgroundColor: colors.backgroundLight },\n            isSubmitting ? styles.secondaryButtonDisabled : null,\n            { opacity: pressed ? 0.7 : 1 },\n          ]}`
);

content = content.replace(
  'style={[\n          styles.primaryButton,\n          { backgroundColor: colors.primary },\n          showBack ? null : styles.primaryButtonFull,\n          isSubmitting ? styles.primaryButtonDisabled : null,\n        ]}',
  `style={({ pressed }) => [\n          styles.primaryButton,\n          { backgroundColor: colors.primary },\n          showBack ? null : styles.primaryButtonFull,\n          isSubmitting ? styles.primaryButtonDisabled : null,\n          { opacity: isSubmitting ? 1 : pressed ? 0.7 : 1 },\n        ]}`
);

fs.writeFileSync(file, content);
console.log('ShipmentFlowFooter.tsx patched.');
