#!/usr/bin/env node

/**
 * Fetch all comments from a GitHub Pull Request
 * Usage: node scripts/fetch-pr-comments.js <PR_NUMBER>
 * 
 * Requires: GITHUB_TOKEN environment variable
 */

const https = require('https');

const PR_NUMBER = process.argv[2];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!PR_NUMBER) {
    console.error('❌ Please provide a PR number: node scripts/fetch-pr-comments.js <PR_NUMBER>');
    process.exit(1);
}

if (!GITHUB_TOKEN) {
    console.error('❌ Please set GITHUB_TOKEN environment variable');
    console.error('   Get one from: https://github.com/settings/tokens');
    process.exit(1);
}

// Extract owner and repo from package.json or git remote
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
    console.error('❌ Could not determine repository from git remote');
    process.exit(1);
}

console.log(`📥 Fetching comments for PR #${PR_NUMBER} from ${owner}/${repo}...\n`);

function fetchGitHub(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: path,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'PR-Comment-Fetcher',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    try {
        // Fetch PR details
        const pr = await fetchGitHub(`/repos/${owner}/${repo}/pulls/${PR_NUMBER}`);

        // Fetch different types of comments
        const [reviewComments, issueComments, reviews] = await Promise.all([
            fetchGitHub(`/repos/${owner}/${repo}/pulls/${PR_NUMBER}/comments`),
            fetchGitHub(`/repos/${owner}/${repo}/issues/${PR_NUMBER}/comments`),
            fetchGitHub(`/repos/${owner}/${repo}/pulls/${PR_NUMBER}/reviews`)
        ]);

        console.log(`📋 PR #${PR_NUMBER}: ${pr.title}`);
        console.log(`🔗 ${pr.html_url}\n`);
        console.log('='.repeat(80));

        // Group comments by file
        const commentsByFile = {};

        reviewComments.forEach(comment => {
            const file = comment.path;
            if (!commentsByFile[file]) {
                commentsByFile[file] = [];
            }
            commentsByFile[file].push({
                type: 'review',
                line: comment.line || comment.original_line,
                body: comment.body,
                user: comment.user.login,
                created_at: comment.created_at,
                url: comment.html_url
            });
        });

        // Print review comments grouped by file
        if (Object.keys(commentsByFile).length > 0) {
            console.log('\n📝 CODE REVIEW COMMENTS:\n');

            for (const [file, comments] of Object.entries(commentsByFile)) {
                console.log(`\n📄 ${file}`);
                console.log('-'.repeat(80));

                comments.sort((a, b) => a.line - b.line);

                comments.forEach(comment => {
                    console.log(`\n  Line ${comment.line} | @${comment.user}:`);
                    console.log(`  ${comment.body.split('\n').join('\n  ')}`);
                    console.log(`  🔗 ${comment.url}`);
                });
            }
        }

        // Print general PR comments
        if (issueComments.length > 0) {
            console.log('\n\n💬 GENERAL PR COMMENTS:\n');
            console.log('-'.repeat(80));

            issueComments.forEach(comment => {
                console.log(`\n@${comment.user.login} (${new Date(comment.created_at).toLocaleString()}):`);
                console.log(comment.body);
                console.log(`🔗 ${comment.html_url}`);
            });
        }

        // Print review summaries
        const reviewsWithComments = reviews.filter(r => r.body && r.body.trim());
        if (reviewsWithComments.length > 0) {
            console.log('\n\n⭐ REVIEW SUMMARIES:\n');
            console.log('-'.repeat(80));

            reviewsWithComments.forEach(review => {
                const stateEmoji = {
                    'APPROVED': '✅',
                    'CHANGES_REQUESTED': '🔴',
                    'COMMENTED': '💬'
                };

                console.log(`\n${stateEmoji[review.state] || '📝'} ${review.state} by @${review.user.login}:`);
                console.log(review.body);
                console.log(`🔗 ${review.html_url}`);
            });
        }

        // Summary
        console.log('\n\n' + '='.repeat(80));
        console.log('📊 SUMMARY:');
        console.log(`   • ${reviewComments.length} code review comments`);
        console.log(`   • ${issueComments.length} general comments`);
        console.log(`   • ${reviews.length} reviews (${reviewsWithComments.length} with summaries)`);
        console.log(`   • ${Object.keys(commentsByFile).length} files with comments`);
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
