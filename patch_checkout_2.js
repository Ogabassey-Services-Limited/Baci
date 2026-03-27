const fs = require('fs');
const filepath = 'apps/mobile-storefront/app/checkout.tsx';
let code = fs.readFileSync(filepath, 'utf8');

const target = `    return () => backHandler.remove();
  }, [step]);`;

const replacement = `    return () => backHandler.remove();
  }, [step, performBackTransition]);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(filepath, code, 'utf8');
  console.log('Patched checkout.tsx useEffect deps');
} else {
  console.error('Target useEffect deps not found');
}
