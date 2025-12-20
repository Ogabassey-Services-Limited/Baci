import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, 'src');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

async function buildWidget() {
    const entryPoint = path.join(SRC_DIR, 'index.tsx');
    const cssPath = path.join(SRC_DIR, 'styles.css');
    const outPath = path.join(ASSETS_DIR, 'ogabassey-store.html');

    console.log('Building Ogabassey Premium Widget...');

    // Bundle JS/TSX
    const jsResult = await esbuild.build({
        entryPoints: [entryPoint],
        bundle: true,
        minify: true,
        format: 'esm',
        write: false,
        jsx: 'automatic',
        jsxImportSource: 'react',
        target: ['es2020'],
        define: {
            'process.env.NODE_ENV': '"production"'
        },
        external: [], // Bundle everything
    });

    const jsCode = jsResult.outputFiles[0].text;

    // Read CSS
    let cssCode = '';
    if (fs.existsSync(cssPath)) {
        cssCode = fs.readFileSync(cssPath, 'utf8');
    }

    // Create HTML bundle with skybridge compatibility
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="color-scheme" content="dark light">
  <style>${cssCode}</style>
</head>
<body>
  <div id="ogabassey-root"></div>
  <script type="module">${jsCode}</script>
</body>
</html>`;

    fs.writeFileSync(outPath, htmlContent);
    console.log(`✓ Built ${outPath} (${(htmlContent.length / 1024).toFixed(1)}KB)`);
}

async function main() {
    try {
        await buildWidget();
        console.log('\n✅ Widget build complete!');
    } catch (err) {
        console.error('Build failed:', err);
        process.exit(1);
    }
}

main();
