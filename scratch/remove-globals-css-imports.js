const fs = require('fs');
const path = require('path');

const directories = ['apps/web/src/app/(platform)', 'apps/web/src/app/(auth)'];

function processDirectory(dirRelPath) {
  const dirPath = path.resolve(__dirname, '..', dirRelPath);
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory does not exist: ${dirRelPath}`);
    return;
  }

  function walk(currentPath) {
    const files = fs.readdirSync(currentPath);
    files.forEach((file) => {
      const fullPath = path.join(currentPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file === 'page.tsx') {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes("import '@/app/globals.css';")) {
          content = content.replace("import '@/app/globals.css';\n", '');
          content = content.replace("import '@/app/globals.css';", '');
          fs.writeFileSync(fullPath, content, 'utf8');
          const rel = path.relative(path.resolve(__dirname, '..'), fullPath);
          console.log(`Successfully removed globals.css import from: ${rel}`);
        }
      }
    });
  }

  walk(dirPath);
}

directories.forEach(processDirectory);
