# Environment Variables for VPS Deployment Scripts

This document lists the environment variables that can be used to configure the VPS deployment scripts in `/scripts/`.

## Required Variables

These environment variables should be set in your `.env.local` or shell environment when running deployment scripts:

### VPS Connection

- **`VPS_USER`** (default: `bassey`)
  - The SSH username for connecting to the VPS
  - Used by: all deployment scripts

- **`VPS_IP`** (default: `82.29.190.219`)
  - The IP address of the VPS server
  - Used by: all deployment scripts

- **`VPS_PATH`** (default: `/var/www/cdn/products`)
  - The remote directory path on the VPS where product images are stored
  - Used by: `deploy-galleries.ts`, `deploy-matched-images.ts`, `download-orphans.ts`, `migrate-images-vps.ts`

- **`VPS_UPLOAD_PATH`** (default: `/home/bassey/hp_uploads`)
  - Alternative upload path for HP images
  - Used by: `deploy-hp-images.ts`

- **`SSH_KEY_PATH`** (default: `~/.ssh/id_ed25519`)
  - Path to the SSH private key for authentication
  - Used by: `deploy-gaming-images.ts`, `deploy-matched-images.ts`

### CDN Configuration

- **`CDN_BASE_URL`** (default: `https://cdn.ogabassey.com/products`)
  - The base URL for the CDN where images are served
  - Used by: all deployment scripts

### Local Paths

- **`PRIMARY_IMAGE_DIR`** (default: `{project_root}/public/website designs`)
  - Local directory containing source images for matching
  - Used by: `deploy-matched-images.ts`

## Usage Example

Create a `.env.local` file or export these variables before running scripts:

```bash
# .env.local or shell export
export VPS_USER="your-username"
export VPS_IP="your-vps-ip"
export VPS_PATH="/var/www/cdn/products"
export CDN_BASE_URL="https://your-cdn.com/products"
export SSH_KEY_PATH="/path/to/your/ssh/key"
export PRIMARY_IMAGE_DIR="/path/to/local/images"
```

## Scripts Modified

The following scripts have been updated to use environment variables:

1. **`deploy-galleries.ts`**
   - VPS_USER, VPS_IP, VPS_PATH, CDN_BASE_URL

2. **`deploy-gaming-images.ts`**
   - VPS_USER, VPS_IP, VPS_PATH, CDN_BASE_URL, SSH_KEY_PATH

3. **`deploy-hp-images.ts`**
   - VPS_USER, VPS_IP, VPS_UPLOAD_PATH, CDN_BASE_URL

4. **`deploy-matched-images.ts`**
   - VPS_USER, VPS_IP, VPS_PATH, CDN_BASE_URL, SSH_KEY_PATH, PRIMARY_IMAGE_DIR

5. **`download-orphans.ts`**
   - VPS_USER, VPS_IP, VPS_PATH

6. **`migrate-images-vps.ts`**
   - VPS_PATH, CDN_BASE_URL

## Path Resolution

All local file paths have been updated to use `path.join(process.cwd(), ...)` instead of hardcoded absolute paths. This makes the scripts portable across different development environments.

## Default Values

Each script includes sensible defaults that match the current production configuration. If you don't set environment variables, the scripts will use these defaults for backward compatibility.
