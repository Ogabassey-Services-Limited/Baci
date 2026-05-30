const fs = require('fs');

const path = 'apps/web/src/components/ui/submit-button.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /<Button\n      type="submit"\n      disabled={isDisabled}\n      className={cn\(className\)}\n      {\.\.\.props}\n    >/,
  '<Button\n      type="submit"\n      disabled={isDisabled}\n      aria-busy={pending}\n      className={cn(className)}\n      {...props}\n    >'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched submit-button.tsx');
