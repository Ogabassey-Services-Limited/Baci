const fs = require('fs');
const filepath = 'apps/mobile-storefront/app/checkout.tsx';
let code = fs.readFileSync(filepath, 'utf8');

const target = `  const performBackTransition = () => {
    if (step === 'payment') {
      setStep('address');
    } else if (step === 'review') {
      setStep('payment');
    } else {
      router.back();
    }
  };`;

const replacement = `  const performBackTransition = React.useCallback(() => {
    if (step === 'payment') {
      setStep('address');
    } else if (step === 'review') {
      setStep('payment');
    } else {
      router.back();
    }
  }, [step, router]);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(filepath, code, 'utf8');
  console.log('Patched checkout.tsx performBackTransition');
} else {
  console.error('Target performBackTransition not found');
}
