const fs = require('fs');
const file = 'apps/mobile-storefront/components/checkout/ShippingQuotesCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// There's still one occurrence of BRAND.primary and hardcoded selection styling
content = content.replace(
  /                      borderColor: isSelected \? BRAND\.primary : colors\.border,\n                      backgroundColor: isSelected\n                        \? isDark\n                          \? 'rgba\\(217, 59, 48, 0\.16\\)'\n                          : palette\.red\[50\]\n                        : colors\.card,/g,
  `                      borderColor: isSelected ? colors.primary : colors.border,\n                      backgroundColor: isSelected\n                        ? colors.primaryLowOpacity\n                        : colors.card,`
);

content = content.replace(
  /color=\{BRAND\.primary\}/g,
  `color={colors.primary}`
);


fs.writeFileSync(file, content, 'utf8');
