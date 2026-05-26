const fs = require('fs');
const file = 'apps/mobile-storefront/components/checkout/ShippingQuotesCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Use `BRAND.primary` and `colors.*` directly where appropriate without hardcoded values.
// We've already replaced the badge strings in a previous patch. We just need to fix the others.

content = content.replace(
  /                      borderColor: isSelected \? BRAND\.primary : colors\.border,\n                      backgroundColor: isSelected\n                        \? isDark\n                          \? 'rgba\\(217, 59, 48, 0\.16\\)'\n                          : palette\.red\[50\]\n                        : colors\.card,/g,
  `                      borderColor: isSelected ? colors.primary : colors.border,\n                      backgroundColor: isSelected\n                        ? colors.primaryLowOpacity\n                        : colors.card,`
);

content = content.replace(
  /                            color: isSelected\n                              \? isDark\n                                \? '#FDECEA'\n                                : BRAND\.primary\n                              : colors\.text,/g,
  `                            color: isSelected\n                              ? colors.primary\n                              : colors.text,`
);

content = content.replace(
  /                          color: isSelected\n                            \? isDark\n                              \? palette\.gray\[200\]\n                              : '#B42318'\n                            : colors\.textSecondary,/g,
  `                          color: isSelected\n                            ? colors.primary\n                            : colors.textSecondary,`
);

content = content.replace(
  /                          color: isSelected\n                            \? isDark\n                              \? '#FFF5F4'\n                              : BRAND\.primary\n                            : colors\.text,/g,
  `                          color: isSelected\n                            ? colors.primary\n                            : colors.text,`
);

content = content.replace(
  /                      color=\{isSelected \? BRAND\.primary : colors\.textSecondary\}/g,
  `                      color={isSelected ? colors.primary : colors.textSecondary}`
);

fs.writeFileSync(file, content, 'utf8');
