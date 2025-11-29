const https = require('https');
const { execSync } = require('child_process');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
    console.error('❌ Please set GITHUB_TOKEN environment variable');
    process.exit(1);
}

// Extract owner and repo
let owner, repo;
try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
    if (match) {
        owner = match[1];
        repo = match[2];
    }
} catch (error) {
    console.error('❌ Could not determine repository from git remote');
    process.exit(1);
}

console.log(`🛡️  Fetching security alerts for ${owner}/${repo}...\n`);

function fetchGitHub(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: path,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'Security-Alert-Fetcher',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else if (res.statusCode === 404 || res.statusCode === 403) {
                    // Some endpoints might be disabled or inaccessible
                    resolve([]);
                } else {
                    reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    try {
        // 1. Code Scanning Alerts (e.g., CodeQL)
        console.log('🔍 Checking Code Scanning alerts...');
        const codeScanning = await fetchGitHub(`/repos/${owner}/${repo}/code-scanning/alerts?state=open`);

        // 2. Dependabot Alerts (Dependencies)
        console.log('📦 Checking Dependabot alerts...');
        const dependabot = await fetchGitHub(`/repos/${owner}/${repo}/dependabot/alerts?state=open`);

        // 3. Secret Scanning Alerts
        console.log('🔑 Checking Secret Scanning alerts...');
        const secrets = await fetchGitHub(`/repos/${owner}/${repo}/secret-scanning/alerts?state=open`);

        console.log('\n' + '='.repeat(80));
        console.log('🚨 SECURITY REPORT');
        console.log('='.repeat(80));

        let hasAlerts = false;

        if (codeScanning.length > 0) {
            hasAlerts = true;
            console.log(`\n📝 CODE SCANNING (${codeScanning.length})`);
            codeScanning.forEach(alert => {
                console.log(`\n[${alert.rule.severity}] ${alert.rule.description}`);
                console.log(`  File: ${alert.most_recent_instance.location.path}:${alert.most_recent_instance.location.start_line}`);
                console.log(`  URL: ${alert.html_url}`);
                console.log(`  Rule: ${alert.rule.id}`);
            });
        }

        if (dependabot.length > 0) {
            hasAlerts = true;
            console.log(`\n📦 DEPENDABOT (${dependabot.length})`);
            dependabot.forEach(alert => {
                console.log(`\n[${alert.security_advisory.severity}] ${alert.security_advisory.summary}`);
                console.log(`  Package: ${alert.dependency.package.name}`);
                console.log(`  Version: ${alert.dependency.manifest_path}`);
                console.log(`  Fix: ${alert.security_advisory.patched_versions}`);
                console.log(`  URL: ${alert.html_url}`);
            });
        }

        if (secrets.length > 0) {
            hasAlerts = true;
            console.log(`\n🔑 SECRET SCANNING (${secrets.length})`);
            secrets.forEach(alert => {
                console.log(`\n[CRITICAL] Secret found: ${alert.secret_type_display_text}`);
                console.log(`  Location: ${alert.locations_url}`); // Requires extra fetch usually, but simplified here
                console.log(`  URL: ${alert.html_url}`);
            });
        }

        if (!hasAlerts) {
            console.log('\n✅ No open security alerts found!');
        } else {
            console.log('\n⚠️  Please fix the issues above.');
        }
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
