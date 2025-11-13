# GitHub Pages Deployment Configuration

**Status**: ✅ Configured and Active

---

## 🚀 Automatic Deployment

The SMPST IDE is configured to automatically deploy to GitHub Pages whenever you push to:
- `main` branch
- `claude/ide-next-stage-011CV2o1fgiThHhcUqfyfQJi` branch

### GitHub Actions Workflow

**File**: `.github/workflows/deploy.yml`

**What it does**:
1. Triggers on push to configured branches
2. Checks out the repository
3. Sets up Node.js 20
4. Installs dependencies (`npm ci`)
5. Builds the project (`npm run build`)
6. Adds `.nojekyll` to prevent Jekyll processing
7. Uploads build artifacts
8. Deploys to GitHub Pages

### Build Configuration

**Vite Base Path**: `/SMPST/`
- Configured in `vite.config.ts`
- Matches repository name for proper routing

---

## 🌐 Live URL

Once deployed, the IDE will be available at:

**https://onemanifold.github.io/SMPST/**

---

## 📋 First-Time Setup (One-Time Only)

If this is the first deployment, you need to enable GitHub Pages in the repository settings:

1. Go to repository **Settings** → **Pages**
2. Under **Source**, select: **GitHub Actions**
3. Save the settings

That's it! Future pushes will automatically deploy.

---

## 🔄 Deployment Status

To check deployment status:

1. Go to repository on GitHub
2. Click **Actions** tab
3. See latest workflow run for "Deploy to GitHub Pages"
4. Green checkmark = successful deployment
5. Red X = failed deployment (click for logs)

---

## 🧪 Manual Deployment

You can also trigger deployment manually:

1. Go to **Actions** tab on GitHub
2. Select "Deploy to GitHub Pages" workflow
3. Click **Run workflow**
4. Select branch: `claude/ide-next-stage-011CV2o1fgiThHhcUqfyfQJi`
5. Click **Run workflow** button

---

## 📊 What Gets Deployed

The `dist/` folder contents after build:
- HTML, CSS, JavaScript (minified)
- Monaco Editor assets
- D3.js visualizations
- All Svelte components (compiled)
- Source maps (for debugging)

**Bundle Size**: ~3.7 MB (Monaco Editor is the largest component)

---

## 🐛 Troubleshooting

### Deployment Failed

**Check**:
1. Build succeeds locally: `npm run build`
2. View error logs in Actions tab
3. Ensure all dependencies are in `package.json`
4. Check for TypeScript errors

### 404 Error on Live Site

**Check**:
1. Base path is correct: `/SMPST/`
2. GitHub Pages source is set to "GitHub Actions"
3. Wait 1-2 minutes after deployment completes

### Assets Not Loading

**Check**:
1. Browser console for 404 errors
2. Asset paths in build output
3. `.nojekyll` file exists in deployment

---

## 🔒 Permissions

The workflow requires these permissions (already configured):
- `contents: read` - Read repository content
- `pages: write` - Write to GitHub Pages
- `id-token: write` - Authentication token

---

## 📈 Deployment History

View all deployments:
1. Go to repository **Settings** → **Pages**
2. Scroll down to see deployment history
3. Each deployment shows:
   - Commit hash
   - Deployment time
   - Status (Active/Failed)

---

## 🚀 Next Steps After Deployment

1. **Verify**: Visit https://onemanifold.github.io/SMPST/
2. **Test**: Try loading examples and parsing protocols
3. **Share**: Send URL to collaborators/users
4. **Monitor**: Check Actions tab for deployment status

---

## 📝 Notes

- Deployment takes ~2-3 minutes from push to live
- No server-side code runs (static site only)
- All protocol processing happens in the browser
- Monaco Editor loaded from CDN (via vite-plugin)
- Changes are immediate after successful deployment

---

**Last Updated**: 2025-11-12
**Configured By**: Claude Code Assistant
**Status**: ✅ Ready to Deploy
