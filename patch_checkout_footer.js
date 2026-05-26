const fs = require('fs');

const file = 'apps/mobile-storefront/components/cart/CartCheckoutFooter.tsx';
let content = fs.readFileSync(file, 'utf8');

const checkoutSearch = `<Pressable
          style={styles.checkoutButtonContainer}
          onPress={onCheckout}
          accessibilityRole="button"
          accessibilityLabel={\`Proceed to checkout, total \${formatPrice(grandTotal)}\`}
        >`;
const checkoutReplace = `<Pressable
          style={({ pressed }) => [
            styles.checkoutButtonContainer,
            pressed && { opacity: 0.8 }
          ]}
          onPress={onCheckout}
          accessibilityRole="button"
          accessibilityLabel={\`Proceed to checkout, total \${formatPrice(grandTotal)}\`}
        >`;
content = content.replace(checkoutSearch, checkoutReplace);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched apps/mobile-storefront/components/cart/CartCheckoutFooter.tsx');