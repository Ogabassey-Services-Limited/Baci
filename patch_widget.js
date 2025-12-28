
const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'ogabassey-mcp/server.ts');
console.log(`Patching ${targetFile}...`);

try {
    let content = fs.readFileSync(targetFile, 'utf8');

    // 1. Refactor HTML Structure
    // Add ID to welcome-grid
    content = content.replace(
        '<div class="welcome-grid">',
        '<div class="welcome-grid" id="nav-grid">'
    );

    // Wrap Content in Viewport
    content = content.replace(
        '      <div class="cta-section">\n        <h3>🎄 Holiday Shopping Made Easy</h3>',
        '      <div id="viewport">\n        <div class="cta-section">\n          <h3>🎄 Holiday Shopping Made Easy</h3>'
    );

    // Close the viewport div
    content = content.replace(
        '        <button class="cta-btn" id="visit-btn">Explore Store</button>\n      </div>\n    </div>',
        '        <button class="cta-btn" id="visit-btn">Explore Store</button>\n      </div>\n      </div>\n    </div>'
    );

    // 2. Update Javascript Selection
    content = content.replace(
        "const contentEl = document.getElementById('content');",
        "const contentEl = document.getElementById('viewport');"
    );

    // 3. Add renderHome function
    const renderHomeFn = `
    const renderHome = () => {
      contentEl.innerHTML = '<div class="cta-section"><h3>🎄 Holiday Shopping Made Easy</h3><p>Find the perfect gift - just ask me anything!</p><button class="cta-btn" id="visit-btn-inner">Explore Store</button></div>';
      document.getElementById('visit-btn-inner')?.addEventListener('click', () => openLink('https://ogabassey.com'));
    };

    const renderProducts`;

    content = content.replace('const renderProducts', renderHomeFn);

    // 4. Update Event Listener
    const oldListener = `    window.addEventListener('openai:set_globals', (e) => {
      const out = e.detail?.globals?.toolOutput;
      if (out?.products) renderProducts(out.products);
      else if (out?.order) renderOrder(out.order);
    }, { passive: true });`;

    const newListener = `    window.addEventListener('openai:set_globals', (e) => {
      const out = e.detail?.globals?.toolOutput;
      if (out?.view === 'home') renderHome();
      else if (out?.products) renderProducts(out.products);
      else if (out?.order) renderOrder(out.order);
    }, { passive: true });`;

    content = content.replace(oldListener, newListener);

    fs.writeFileSync(targetFile, content);
    console.log('Successfully patched server.ts');

} catch (e) {
    console.error('Failed to patch:', e);
    process.exit(1);
}
