const fs = require('fs');
const filepath = 'apps/mobile-storefront/app/checkout.tsx';
let code = fs.readFileSync(filepath, 'utf8');

const target = `  const performBackTransition = React.useCallback(() => {
    if (step === 'payment') {
      setStep('address');
    } else if (step === 'review') {
      setStep('payment');
    } else {
      router.back();
    }
  }, [step, router]);`;

const replacement = `  const performBackTransition = React.useCallback(() => {
    if (step === 'payment') {
      setStep('address');
    } else if (step === 'review') {
      setStep('payment');
    } else {
      router.back();
    }
  }, [step]);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(filepath, code, 'utf8');
  console.log('Patched checkout.tsx performBackTransition deps');
} else {
  console.error('Target performBackTransition deps not found');
}
