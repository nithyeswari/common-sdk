# Firebase Deployment Guide

This guide will help you deploy the OpenAPI Redux SDK Generator to Firebase.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Firebase CLI** installed globally
3. **Firebase project** created in the Firebase Console

## Setup Steps

### 1. Install Firebase CLI

If you haven't already, install the Firebase CLI globally:

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Create a Firebase Project

Go to [Firebase Console](https://console.firebase.google.com/) and create a new project:
- Click "Add project"
- Enter a project name (e.g., "openapi-sdk-generator")
- Choose whether to enable Google Analytics
- Click "Create project"

### 4. Initialize Firebase in Your Project

Update the `.firebaserc` file with your Firebase project ID:

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

Replace `your-project-id` with your actual Firebase project ID from the console.

### 5. Install Dependencies

Install root dependencies:
```bash
npm install
```

Install Firebase Functions dependencies:
```bash
npm run functions:install
```

### 6. Build the Project

Build both the CLI and Firebase Functions:
```bash
npm run build
npm run functions:build
```

## Deployment

### Deploy Everything (Hosting + Functions)

```bash
npm run deploy
```

This will deploy:
- Static web UI to Firebase Hosting
- API functions to Firebase Functions

### Deploy Only Hosting

```bash
npm run deploy:hosting
```

### Deploy Only Functions

```bash
npm run deploy:functions
```

## Testing Locally

Before deploying, you can test locally using Firebase Emulators:

```bash
npm run serve
```

This will start:
- Hosting emulator at http://localhost:5000
- Functions emulator at http://localhost:5001

## Post-Deployment

### 1. Update the API URL

After deploying, update the API URL in `public/app.js`:

```javascript
const apiURL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001/your-project-id/us-central1/api/generate'
    : '/api/generate';
```

Replace `your-project-id` with your actual Firebase project ID.

### 2. Access Your App

Your app will be available at:
```
https://your-project-id.web.app
```

Or if you have a custom domain configured:
```
https://your-custom-domain.com
```

## Firebase Configuration

### Functions Configuration

The Firebase Functions are configured with:
- **Runtime**: Node.js 18
- **Memory**: Default (256 MB) - can be increased if needed
- **Timeout**: Default (60s) - can be increased for large specs

To modify these, update `functions/src/index.ts`:

```typescript
export const api = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB'
  })
  .https.onRequest(app);
```

### CORS Configuration

CORS is configured to allow all origins by default:

```typescript
app.use(cors({ origin: true }));
```

For production, you may want to restrict this:

```typescript
app.use(cors({
  origin: ['https://your-domain.com', 'https://your-project-id.web.app']
}));
```

## Environment Variables

If you need to set environment variables for your functions:

```bash
firebase functions:config:set someservice.key="THE API KEY"
```

Access them in your code:

```typescript
const key = functions.config().someservice.key;
```

## Monitoring and Logs

### View Function Logs

```bash
firebase functions:log
```

Or view in the Firebase Console:
- Go to Functions section
- Click on a function
- View logs

### Monitor Usage

Firebase Console provides:
- Function invocations
- Execution time
- Memory usage
- Error rates

## Cost Considerations

### Free Tier Limits

Firebase Free (Spark) Plan includes:
- 125K function invocations/month
- 40K GB-seconds/month
- 10 GB hosting storage
- 360 MB hosting transfer/day

### Paid Plan (Blaze)

For production use, consider upgrading to Blaze plan:
- Pay as you go
- No hard limits
- Better for high traffic

### Optimization Tips

1. **Use appropriate memory allocation** - Don't over-allocate
2. **Set reasonable timeouts** - Match to actual processing time
3. **Clean up temporary files** - Already implemented
4. **Cache when possible** - Consider caching parsed specs if needed

## Security

### File Upload Restrictions

Current restrictions in place:
- File type validation (YAML/JSON only)
- No data persistence
- Temporary files cleaned up immediately

### Additional Security (Recommended for Production)

1. **Add authentication**:
```typescript
// In functions/src/index.ts
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== functions.config().api.key) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.post('/generate', authenticate, generateSDKHandler);
```

2. **Add rate limiting**:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // limit each IP to 10 requests per windowMs
});

app.use('/generate', limiter);
```

3. **Add file size limits**:
```typescript
// Already handled by Busboy, but can be configured:
const busboy = Busboy({
  headers: req.headers,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  }
});
```

## Troubleshooting

### Common Issues

1. **"Permission denied" errors**
   - Ensure you're logged in: `firebase login`
   - Check project permissions in Firebase Console

2. **"Function not found" errors**
   - Rebuild functions: `npm run functions:build`
   - Check function name in `firebase.json`

3. **CORS errors**
   - Check CORS configuration in `functions/src/index.ts`
   - Ensure OPTIONS requests are handled

4. **Timeout errors**
   - Increase timeout in function configuration
   - Optimize processing for large specs

5. **Build errors**
   - Delete `node_modules` and reinstall
   - Check TypeScript version compatibility

### Debug Mode

Enable debug logging:

```bash
firebase --debug deploy
```

## CI/CD Integration

### GitHub Actions Example

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
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install
          npm run functions:install

      - name: Build
        run: |
          npm run build
          npm run functions:build

      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

Generate a Firebase token:
```bash
firebase login:ci
```

Add the token to your GitHub repository secrets as `FIREBASE_TOKEN`.

## Support

For issues or questions:
- Check [Firebase Documentation](https://firebase.google.com/docs)
- Open an issue on GitHub
- Review Firebase Console logs

## License

MIT
