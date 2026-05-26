const fs = require('fs');
const file = 'apps/mobile-storefront/components/ErrorBoundary.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the first block
content = content.replace(
  /                  styles\.debugContainer,\n                  \{ backgroundColor: isDark \? '#7F1D1D' : '#FEE2E2' \},\n                \]\}/g,
  `                  styles.debugContainer,\n                  { backgroundColor: colors.destructive },\n                ]}`
);

content = content.replace(
  /                    styles\.debugTitle,\n                    \{ color: isDark \? '#FECACA' : '#991B1B' \},\n                  \]\}/g,
  `                    styles.debugTitle,\n                    { color: colors.destructiveForeground },\n                  ]}`
);

content = content.replace(
  /                    styles\.debugText,\n                    \{ color: isDark \? '#FCA5A5' : '#7F1D1D' \},\n                  \]\}/g,
  `                    styles.debugText,\n                    { color: colors.destructiveForeground },\n                  ]}`
);

content = content.replace(
  /                      styles\.debugStack,\n                      \{ color: isDark \? '#FCA5A5' : '#7F1D1D' \},\n                    \]\}/g,
  `                      styles.debugStack,\n                      { color: colors.destructiveForeground },\n                    ]}`
);

// Replace the second block
content = content.replace(
  /              styles\.debugContainer,\n              \{ backgroundColor: isDark \? '#7F1D1D' : '#FEE2E2' \},\n            \]\}/g,
  `              styles.debugContainer,\n              { backgroundColor: colors.destructive },\n            ]}`
);

content = content.replace(
  /                styles\.debugTitle,\n                \{ color: isDark \? '#FECACA' : '#991B1B' \},\n              \]\}/g,
  `                styles.debugTitle,\n                { color: colors.destructiveForeground },\n              ]}`
);

content = content.replace(
  /                styles\.debugText,\n                \{ color: isDark \? '#FCA5A5' : '#7F1D1D' \},\n              \]\}/g,
  `                styles.debugText,\n                { color: colors.destructiveForeground },\n              ]}`
);

content = content.replace(
  /                  styles\.debugStack,\n                  \{ color: isDark \? '#FCA5A5' : '#7F1D1D' \},\n                \]\}/g,
  `                  styles.debugStack,\n                  { color: colors.destructiveForeground },\n                ]}`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched ErrorBoundary.tsx');
