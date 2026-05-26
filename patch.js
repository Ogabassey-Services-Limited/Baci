const fs = require('fs');
const file = 'apps/mobile-storefront/components/cart/CartItemCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The tricky part is replacing the `imageContainer` Pressable style,
// let's do it carefully with replace

content = content.replace(
  `style={[
            styles.imageContainer,
            {
              backgroundColor: surfaceInset,
              borderColor: colors.border,
            },
          ]}`,
  `style={({ pressed }) => [
            styles.imageContainer,
            {
              backgroundColor: surfaceInset,
              borderColor: colors.border,
            },
            pressed && { opacity: 0.7 },
          ]}`
);

fs.writeFileSync(file, content);
