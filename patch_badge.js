const fs = require('fs');
const file = 'apps/mobile-storefront/components/checkout/ShippingQuotesCard.tsx';
let content = fs.readFileSync(file, 'utf8');

const search = `                            {
                              backgroundColor: isDark
                                ? colors.background
                                : colors.foreground,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              {
                                color: isDark
                                  ? colors.foreground
                                  : colors.background,
                              },
                            ]}
                          >`;

const replace = `                            { backgroundColor: colors.foreground },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              { color: colors.background },
                            ]}
                          >`;

content = content.replace(search, replace);
fs.writeFileSync(file, content, 'utf8');
