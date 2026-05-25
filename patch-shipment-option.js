const fs = require('fs');
const file = 'apps/mobile-admin/components/orders/ShipmentOptionCard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'style={[\n        styles.optionCard,\n        {\n          backgroundColor: selected ? colors.primaryLight : colors.card,\n          borderColor: selected ? colors.primary : colors.border,\n          opacity: disabled ? 0.48 : 1,\n        },\n      ]}',
  `style={({ pressed }) => [\n        styles.optionCard,\n        {\n          backgroundColor: selected ? colors.primaryLight : colors.card,\n          borderColor: selected ? colors.primary : colors.border,\n          opacity: disabled ? 0.48 : pressed ? 0.7 : 1,\n        },\n      ]}`
);

fs.writeFileSync(file, content);
console.log('ShipmentOptionCard.tsx patched.');
