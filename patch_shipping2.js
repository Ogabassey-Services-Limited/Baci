const fs = require('fs');
const file = 'apps/mobile-storefront/components/checkout/ShippingQuotesCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The badge background is hardcoded in StyleSheet. Let's make it inline.
content = content.replace(
  /                        <View style=\{styles\.badgeDark\}>\n                          <Text style=\{styles\.badgeText\}>GIGL<\/Text>\n                        <\/View>/g,
  `                        <View style={[styles.badge, { backgroundColor: isDark ? colors.background : colors.foreground }]}>\n                          <Text style={[styles.badgeText, { color: isDark ? colors.foreground : colors.background }]}>GIGL</Text>\n                        </View>`
);

content = content.replace(
  /                        <View style=\{styles\.badge\}>\n                          <Text style=\{styles\.badgeTextLight\}>Topship<\/Text>\n                        <\/View>/g,
  `                        <View style={[styles.badge, { backgroundColor: colors.muted }]}>\n                          <Text style={[styles.badgeText, { color: colors.text }]}>Topship</Text>\n                        </View>`
);

// We still keep the style layout inside StyleSheet, but remove the colors.
content = content.replace(
  /  badge: \{\n    backgroundColor: '#DBEAFE',\n    borderRadius: RADIUS\.full,\n    paddingHorizontal: 6,\n    paddingVertical: 2,\n  \},/g,
  `  badge: {\n    borderRadius: RADIUS.full,\n    paddingHorizontal: 6,\n    paddingVertical: 2,\n  },`
);

content = content.replace(
  /  badgeDark: \{\n    backgroundColor: '#111827',\n    borderRadius: RADIUS\.full,\n    paddingHorizontal: 6,\n    paddingVertical: 2,\n  \},/g,
  `` // remove completely since we reused badge and applied colors inline
);

content = content.replace(
  /  badgeText: \{\n    color: '#FFFFFF',\n    fontSize: 9,\n    fontWeight: '700',\n    textTransform: 'uppercase',\n  \},/g,
  `  badgeText: {\n    fontSize: 9,\n    fontWeight: '700',\n    textTransform: 'uppercase',\n  },`
);

content = content.replace(
  /  badgeTextLight: \{\n    color: '#0F172A',\n    fontSize: 9,\n    fontWeight: '700',\n    textTransform: 'uppercase',\n  \},/g,
  `` // remove completely
);

fs.writeFileSync(file, content, 'utf8');
