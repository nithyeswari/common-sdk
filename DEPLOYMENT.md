# Deployment Guide

Your OpenAPI Redux SDK Generator can be deployed in two ways:

## Option 1: NPM Package (CLI Tool) 🚀

Deploy the CLI tool to npm for developers to install globally.

### Prerequisites

- npm account ([Sign up here](https://www.npmjs.com/signup))
- Logged in: `npm login`

### Steps

1. **Update package.json version** (if needed)
   ```bash
   # Edit package.json and bump version
   # Example: "version": "1.0.0" -> "1.1.0"
   ```

2. **Build**
   ```bash
   npm run build
   ```

3. **Test locally**
   ```bash
   npm link
   openapi-redux-gen --help
   ```

4. **Publish to npm**
   ```bash
   npm publish
   ```

5. **Users can now install**
   ```bash
   npm install -g openapi-redux-sdk-generator
   openapi-redux-gen generate -i spec.yaml -o ./output --modern-only
   ```

### Optional: Add to package.json before publishing

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/openapi-redux-sdk-generator"
  },
  "bugs": {
    "url": "https://github.com/yourusername/openapi-redux-sdk-generator/issues"
  },
  "homepage": "https://github.com/yourusername/openapi-redux-sdk-generator#readme"
}
```

---

## Option 2: Firebase Hosting (Web App) 🌐

Deploy the web-based generator for browser-based SDK generation.

### Prerequisites

- Firebase account ([Sign up here](https://firebase.google.com/))
- Firebase CLI: `npm install -g firebase-tools`

### Steps

1. **Login to Firebase**
   ```bash
   firebase login
   ```

2. **Initialize Firebase (if not done)**
   ```bash
   firebase init hosting
   ```

   When prompted:
   - Choose or create a Firebase project
   - Public directory: `public`
   - Single-page app: `No`
   - Overwrite files: `No`

3. **Update .firebaserc** with your project ID
   ```json
   {
     "projects": {
       "default": "your-project-id"
     }
   }
   ```

4. **Test locally**
   ```bash
   npm run serve
   ```

   Visit http://localhost:5000

5. **Deploy to Firebase**
   ```bash
   npm run deploy
   ```

   Or directly:
   ```bash
   firebase deploy --only hosting
   ```

6. **Your app is live!**
   ```
   https://your-project-id.web.app
   ```

---

## Option 3: Both! 🎯

Deploy both the npm package AND the web app:

```bash
# 1. Publish to npm
npm publish

# 2. Deploy to Firebase
npm run deploy
```

Now users can:
- Install CLI: `npm install -g openapi-redux-sdk-generator`
- Use web app: Visit `https://your-project-id.web.app`

---

## Quick Deploy Commands

### NPM (CLI)
```bash
# Build and publish
npm run build && npm publish
```

### Firebase (Web App)
```bash
# Deploy to hosting
npm run deploy
```

### Both
```bash
# Publish to npm
npm publish

# Deploy web app
npm run deploy
```

---

## Post-Deployment

### For NPM Package

1. **Verify installation**
   ```bash
   npm install -g openapi-redux-sdk-generator
   openapi-redux-gen --version
   ```

2. **View on npmjs.com**
   ```
   https://www.npmjs.com/package/openapi-redux-sdk-generator
   ```

3. **Update README badges** (optional)
   ```markdown
   ![npm version](https://badge.fury.io/js/openapi-redux-sdk-generator.svg)
   ![downloads](https://img.shields.io/npm/dm/openapi-redux-sdk-generator.svg)
   ```

### For Firebase Hosting

1. **Verify deployment**
   ```
   https://your-project-id.web.app
   ```

2. **Check Firebase Console**
   ```
   https://console.firebase.google.com/project/your-project-id/hosting
   ```

3. **View deployment history**
   ```bash
   firebase hosting:channel:list
   ```

---

## Troubleshooting

### NPM Publish Issues

**Error: You must verify your email**
```bash
# Check your email and verify your npm account
```

**Error: Package name taken**
```bash
# Change package name in package.json
# Example: "openapi-redux-sdk-generator-v2"
```

**Error: 403 Forbidden**
```bash
npm login
npm whoami  # Verify you're logged in
```

### Firebase Deploy Issues

**Error: No project ID specified**
```bash
# Create .firebaserc with:
{
  "projects": {
    "default": "your-project-id"
  }
}
```

**Error: Permission denied**
```bash
firebase login --reauth
```

**Error: Project not found**
```bash
# List your projects
firebase projects:list

# Use specific project
firebase use your-project-id
```

---

## Deployment Checklist

### Before NPM Publish

- [ ] Version bumped in package.json
- [ ] Build succeeds: `npm run build`
- [ ] Tests pass (if any)
- [ ] README updated
- [ ] CHANGELOG updated
- [ ] Tested locally: `npm link`
- [ ] Logged in: `npm whoami`

### Before Firebase Deploy

- [ ] Firebase project created
- [ ] .firebaserc configured
- [ ] Public directory contains web app files
- [ ] Tested locally: `npm run serve`
- [ ] Logged in: `firebase login`

---

## CI/CD (Optional)

### GitHub Actions - NPM Publish

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitHub Actions - Firebase Deploy

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install -g firebase-tools
      - run: firebase deploy --only hosting
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

---

## Environment Variables

For Firebase deployment, you can set environment variables:

```bash
# Get Firebase token for CI/CD
firebase login:ci

# Use in GitHub Actions
# Add FIREBASE_TOKEN to repository secrets
```

---

## Versioning

Follow semantic versioning:

- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backwards compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes

```bash
# Update version
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# Publish
npm publish
```

---

## Support

After deployment, users can:

1. **For CLI**: Install via `npm install -g openapi-redux-sdk-generator`
2. **For Web**: Visit your Firebase URL
3. **For Issues**: Direct to your GitHub issues page
4. **For Docs**: Point to README and guides

---

## Summary

**Choose based on your needs:**

| Deployment | Best For | Command |
|------------|----------|---------|
| **NPM** | Developers, CI/CD, automation | `npm publish` |
| **Firebase** | Non-developers, quick testing | `npm run deploy` |
| **Both** | Maximum reach | Both commands |

**Ready to deploy?**

```bash
# NPM
npm publish

# Firebase
npm run deploy

# Both
npm publish && npm run deploy
```

🚀 **Happy deploying!**
