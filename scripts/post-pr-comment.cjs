const https = require('https');

const PR_NUMBER = process.argv[2];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!PR_NUMBER || !GITHUB_TOKEN) {
    console.error('Usage: GITHUB_TOKEN=... node scripts/post-pr-comment.cjs <PR_NUMBER>');
    process.exit(1);
}

// Extract owner and repo
const { execSync } = require('child_process');
let owner, repo;
try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
    if (match) {
        owner = match[1];
        repo = match[2];
    }
} catch (error) {
    console.error('Could not determine repository');
    process.exit(1);
}

const commentBody = `
I have addressed the following code review comments:

### ✅ **Accessibility Fixes**
- **Notifications Page**: Replaced \`div role="button"\` with semantic \`<button>\` elements for better accessibility.
- **Settings Page**: Added \`aria-label\` and \`role="img"\` to all inline SVGs (TikTok, YouTube, Pinterest, LinkedIn, etc.) to fix linter errors.
- **Product Detail**: Verified \`type="button"\` usage on interactive elements.

### 📝 **Documentation Improvements**
- **Performance Guide**: 
  - Fixed grammar ("full-page load").
  - Added proper blank lines around headings to satisfy markdownlint.

### 🔒 **Security**
- **Product Page**: Verified \`dangerouslySetInnerHTML\` usage is safe (using \`safeJsonLdStringify\` for JSON-LD).

@coderabbitai please review the changes! 🐰
`;

const data = JSON.stringify({ body: commentBody });

const options = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/issues/${PR_NUMBER}/comments`,
    method: 'POST',
    headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Node.js Script',
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', chunk => responseData += chunk);
    res.on('end', () => {
        if (res.statusCode === 201) {
            console.log('✅ Comment posted successfully!');
            // Sanitize URL to prevent log injection
            const parsedResponse = JSON.parse(responseData);
            const url = parsedResponse.html_url;
            // Remove all control characters and validate URL format
            const sanitizedUrl = url.replace(/[\r\n\t\x00-\x1F\x7F]/g, '');
            // Only log if it's a valid GitHub URL
            if (sanitizedUrl.startsWith('https://github.com/')) {
                console.log(sanitizedUrl);
            } else {
                console.log('[URL sanitized for security]');
            }
        } else {
            // Sanitize statusCode to prevent log injection
            const sanitizedStatusCode = String(res.statusCode).replace(/[^0-9]/g, '') || '?';
            console.error(`❌ Failed to post comment: ${sanitizedStatusCode}`);
            console.error(JSON.stringify(responseData));
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(data);
req.end();
