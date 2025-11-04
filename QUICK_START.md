# Quick Start - Deploy to Firebase

This is a simplified guide to get your OpenAPI Redux SDK Generator deployed to Firebase quickly.

## 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

## 2. Login to Firebase

```bash
firebase login
```

## 3. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it (e.g., "openapi-sdk-gen")
4. Complete setup

## 4. Configure Project

Edit `.firebaserc` and replace `your-project-id` with your Firebase project ID:

```json
{
  "projects": {
    "default": "openapi-sdk-gen"
  }
}
```

## 5. Install Dependencies

```bash
# Install root dependencies
npm install

# Install function dependencies
npm run functions:install
```

## 6. Update API URL

Edit `public/app.js` line ~43 and replace `your-project-id`:

```javascript
const apiURL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001/openapi-sdk-gen/us-central1/api/generate'  // Update this
    : '/api/generate';
```

## 7. Deploy

```bash
npm run deploy
```

That's it! Your app will be live at:
```
https://openapi-sdk-gen.web.app
```

## Test Locally First (Optional)

```bash
npm run serve
```

Then visit http://localhost:5000

## Troubleshooting

**Build fails?**
```bash
# Clean and rebuild
rm -rf node_modules functions/node_modules
npm install
npm run functions:install
npm run deploy
```

**Permission denied?**
```bash
firebase login --reauth
```

**Function timeout?**

Edit `functions/src/index.ts` and add:

```typescript
export const api = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB'
  })
  .https.onRequest(app);
```

## What Gets Deployed?

- **Frontend**: Beautiful web UI at Firebase Hosting
- **Backend**: API endpoint at Firebase Functions
- **Features**:
  - Upload OpenAPI spec
  - Generate Redux SDK
  - Download ZIP
  - No data stored

## Cost

Free tier includes:
- 125K function calls/month
- 10 GB hosting storage

Perfect for personal/small team use!

## Next Steps

- Add custom domain in Firebase Console
- Set up monitoring and alerts
- Consider adding authentication
- Review full documentation in `FIREBASE_DEPLOYMENT.md`
