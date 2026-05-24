const fs = require('fs');
const file = 'apps/web/src/components/storefront/ogabassey/pages/checkout/components/OrderSummarySidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

const search = `<button
                      type="button"
                      onClick={() =>
                        setPayWithWallet(!payWithWallet)
                      }`;
const replace = `<button
                      type="button"
                      role="switch"
                      aria-checked={payWithWallet}
                      aria-label="Use Wallet Credit"
                      onClick={() =>
                        setPayWithWallet(!payWithWallet)
                      }`;

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully patched');
} else {
    console.log('Search string not found');
}
