export VERCEL_TOKEN="test_token"
export VERCEL_PROJECT_ID="test_project_id"
export VERCEL_ORG_ID="test_org_id"
pnpm exec vercel build --yes --token="$VERCEL_TOKEN" || echo "failed"
