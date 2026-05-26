const fs = require('fs');

const file = 'apps/mobile-storefront/components/cart/CartItemCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update Trash Button
const trashSearch = `<Pressable
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={\`Remove \${item.name} from cart\`}
        >
          <Ionicons name="trash-outline" size={18} color={BRAND.primary} />
        </Pressable>`;
const trashReplace = `<Pressable
          style={({ pressed }) => [
            styles.removeButton,
            pressed && { opacity: 0.7 }
          ]}
          onPress={() => handleRemoveItem(item)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={\`Remove \${item.name} from cart\`}
        >
          <Ionicons name="trash-outline" size={18} color={BRAND.primary} />
        </Pressable>`;
content = content.replace(trashSearch, trashReplace);

// Update Minus Button
const minusSearch = `<Pressable
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item, -1)}
            disabled={item.quantity <= 1}
            accessibilityRole="button"
            accessibilityLabel={\`Decrease quantity for \${item.name}\`}
          >`;
const minusReplace = `<Pressable
            style={({ pressed }) => [
              styles.quantityButton,
              pressed && { opacity: 0.7 }
            ]}
            onPress={() => handleQuantityChange(item, -1)}
            disabled={item.quantity <= 1}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={\`Decrease quantity for \${item.name}\`}
          >`;
content = content.replace(minusSearch, minusReplace);

// Update Plus Button
const plusSearch = `<Pressable
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item, 1)}
            accessibilityRole="button"
            accessibilityLabel={\`Increase quantity for \${item.name}\`}
          >`;
const plusReplace = `<Pressable
            style={({ pressed }) => [
              styles.quantityButton,
              pressed && { opacity: 0.7 }
            ]}
            onPress={() => handleQuantityChange(item, 1)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={\`Increase quantity for \${item.name}\`}
          >`;
content = content.replace(plusSearch, plusReplace);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched apps/mobile-storefront/components/cart/CartItemCard.tsx');