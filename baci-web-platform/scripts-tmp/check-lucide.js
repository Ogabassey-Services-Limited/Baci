const { Newspaper } = require('lucide-react');
if (Newspaper) {
  console.log('✅ Newspaper icon found!');
} else {
  console.error('❌ Newspaper icon NOT found in lucide-react');
  process.exit(1);
}
