#!/bin/bash
PR_NUMBERS=("217" "216" "215" "213" "212" "211" "210" "209" "208" "207" "206" "205")
REPO_OWNER=$(gh repo view --json owner -q .owner.login)
REPO_NAME=$(gh repo view --json name -q .name)

for PR in "${PR_NUMBERS[@]}"; do
  echo "Fetching PR #$PR..."
  gh api graphql --paginate -f query='
  query($owner: String!, $name: String!, $pr: Int!, $endCursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100, after: $endCursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            isResolved
            path
            comments(first: 5) {
              nodes { author { login } body url createdAt }
            }
          }
        }
        comments(first: 100) {
          nodes { author { login } body url createdAt }
        }
      }
    }
  }' -F owner="$REPO_OWNER" -F name="$REPO_NAME" -F pr=$PR > pr_${PR}_threads.json
done
