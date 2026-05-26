const fs = require('fs');
const file = 'apps/mobile-storefront/components/checkout/ShippingQuotesCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace selection background colors
content = content.replace(
  /                      backgroundColor: isSelected\n                        \? isDark\n                          \? 'rgba\\(217, 59, 48, 0\\.16\\)'\n                          : palette\\.red\[50\]\n                        : colors\\.card,/g,
  `                      backgroundColor: isSelected\n                        ? colors.primaryLowOpacity\n                        : colors.card,`
);

// Replace selection text colors
content = content.replace(
  /                            color: isSelected\n                              \? isDark\n                                \? '#FDECEA'\n                                : BRAND\\.primary\n                              : colors\\.text,/g,
  `                            color: isSelected\n                              ? colors.primary\n                              : colors.text,`
);

// Replace selection meta colors
content = content.replace(
  /                          color: isSelected\n                            \? isDark\n                              \? palette\\.gray\[200\]\n                              : '#B42318'\n                            : colors\\.textSecondary,/g,
  `                          color: isSelected\n                            ? colors.primary\n                            : colors.textSecondary,`
);

// Replace selection price colors
content = content.replace(
  /                          color: isSelected\n                            \? isDark\n                              \? '#FFF5F4'\n                              : BRAND\\.primary\n                            : colors\\.text,/g,
  `                          color: isSelected\n                            ? colors.primary\n                            : colors.text,`
);

// Replace badge backgrounds
content = content.replace(
  /  badge: \{\n    backgroundColor: '#DBEAFE',\n    borderRadius: RADIUS\.full,\n    paddingHorizontal: 6,\n    paddingVertical: 2,\n  \},/g,
  `  badge: {\n    backgroundColor: '#DBEAFE',\n    borderRadius: RADIUS.full,\n    paddingHorizontal: 6,\n    paddingVertical: 2,\n  },` // Wait, I need to pass dynamic colors to badges...
);
fs.writeFileSync(file, content, 'utf8');
