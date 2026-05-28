const fs = require('fs');
const file = '.jules/eclipse.md';

const entry = `## 2025-05-18 - [products.tsx active tab text contrast]
**Learning:** Hardcoding \`#000000\` for active tab text over \`colors.gold\` fails to adapt. Using \`colors.background\` provides optimal contrast because it naturally flips between light (for dark mode gold) and dark (for light mode gold).
**Action:** Replace hardcoded hex colors on specific themed backgrounds with opposing theme tokens like \`colors.background\` for active states.
`;

if (fs.existsSync(file)) {
  fs.appendFileSync(file, '\n' + entry);
} else {
  fs.mkdirSync('.jules', { recursive: true });
  fs.writeFileSync(file, entry);
}
console.log('Updated .jules/eclipse.md');
