# OpenAPI Redux SDK Generator - Firebase Web App

This is the Firebase-deployed web version of the OpenAPI Redux SDK Generator. Users can upload their OpenAPI specifications and instantly download a generated Redux-based TypeScript SDK.

## 🌟 Features

- **🌐 Web-Based**: No CLI installation required
- **📤 File Upload**: Simple drag-and-drop or file selection
- **⚡ Instant Generation**: Generate SDKs in seconds
- **📦 Download ZIP**: Get your SDK as a ready-to-use ZIP file
- **🔒 No Data Storage**: All processing happens in memory
- **🎨 Beautiful UI**: Modern, responsive design
- **🆓 Free Hosting**: Hosted on Firebase with generous free tier

## 📁 Project Structure

```
common-sdk/
├── functions/                    # Firebase Functions (Backend)
│   ├── src/
│   │   ├── index.ts             # Main function entry point
│   │   ├── handlers/
│   │   │   └── generate-sdk.ts  # File upload and processing handler
│   │   ├── services/
│   │   │   └── sdk-generator.ts # SDK generation logic
│   │   └── lib/                 # Shared code (parsers, generators)
│   ├── package.json
│   └── tsconfig.json
├── public/                       # Frontend (Static Hosting)
│   ├── index.html               # Main web page
│   ├── styles.css               # Styling
│   └── app.js                   # Frontend JavaScript
├── firebase.json                # Firebase configuration
├── .firebaserc                  # Firebase project settings
└── README_FIREBASE.md           # This file
```

## 🚀 Quick Deployment

### 1. Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase account

### 2. Setup

```bash
# Install dependencies
npm install
npm run functions:install

# Login to Firebase
firebase login

# Update .firebaserc with your project ID
# Edit the file and replace "your-project-id"
```

### 3. Deploy

```bash
npm run deploy
```

Your app will be live at: `https://your-project-id.web.app`

## 🔧 Configuration

### Update API Endpoint

After deployment, update `public/app.js` (line 43):

```javascript
const apiURL = window.location.hostname === 'localhost'
    ? 'http://localhost:5001/YOUR-PROJECT-ID/us-central1/api/generate'
    : '/api/generate';
```

Replace `YOUR-PROJECT-ID` with your actual Firebase project ID.

## 📋 How It Works

### Frontend Flow

1. User selects OpenAPI file (YAML/JSON)
2. User optionally sets module name and base URL
3. File is uploaded via POST to `/api/generate`
4. Progress indicator shows status
5. ZIP file is automatically downloaded
6. No data is retained

### Backend Flow

1. Firebase Function receives file upload
2. File is written to temporary directory
3. OpenAPI spec is parsed and validated
4. TypeScript types are generated from schemas
5. API client, Redux actions, reducers, and store are generated
6. All files are bundled into a ZIP
7. ZIP is streamed to client
8. Temporary files are deleted

### Security Features

- ✅ File type validation (only YAML/JSON)
- ✅ No persistent storage
- ✅ Automatic cleanup of temp files
- ✅ CORS enabled for web access
- ✅ Request size limits via Busboy
- ✅ Server-side validation with Swagger Parser

## 🎯 API Endpoint

### POST /api/generate

Generates SDK from uploaded OpenAPI specification.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `openApiFile`: OpenAPI spec file (YAML or JSON)
  - `moduleName`: (optional) Name for the SDK module
  - `baseURL`: (optional) Override base URL from spec

**Response:**
- Content-Type: `application/zip`
- Body: ZIP file containing generated SDK

**Example using cURL:**

```bash
curl -X POST https://your-project-id.web.app/api/generate \
  -F "openApiFile=@petstore.yaml" \
  -F "moduleName=petstore" \
  -F "baseURL=https://api.example.com" \
  -o sdk.zip
```

## 💰 Cost Estimation

### Firebase Free Tier (Spark Plan)

- **Functions**: 125K invocations/month
- **Hosting**: 10 GB storage, 360 MB/day transfer
- **Perfect for**: Personal use, demos, small teams

### Pay-As-You-Go (Blaze Plan)

Estimated costs for 1,000 SDK generations/month:
- **Functions**: ~$0.20 (2GB-seconds per invocation)
- **Hosting**: ~$0.15 (data transfer)
- **Total**: ~$0.35/month

Very affordable for production use!

## 🔒 Adding Authentication (Optional)

To protect your API with an API key:

1. Set Firebase config:
```bash
firebase functions:config:set api.key="your-secret-key"
```

2. Update `functions/src/handlers/generate-sdk.ts`:

```typescript
// At the top of the handler
const apiKey = req.headers['x-api-key'];
if (apiKey !== functions.config().api.key) {
  res.status(401).json({ error: 'Unauthorized' });
  return;
}
```

3. Update `public/app.js` to send the key:

```javascript
const response = await fetch(apiURL, {
  method: 'POST',
  body: formData,
  headers: {
    'X-API-Key': 'your-secret-key'
  }
});
```

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
firebase functions:log

# Or view in Firebase Console
# Functions > api > Logs
```

### Metrics Available

- Function invocations
- Execution time
- Memory usage
- Error rate
- Network egress

## 🐛 Troubleshooting

### "Function not found"
- Ensure functions are deployed: `npm run deploy:functions`
- Check function name in `firebase.json`

### "CORS error"
- Verify CORS configuration in `functions/src/index.ts`
- Check browser console for specific error

### "Timeout"
- Increase timeout in `functions/src/index.ts`:
```typescript
export const api = functions
  .runWith({ timeoutSeconds: 300 })
  .https.onRequest(app);
```

### Large files failing
- Increase memory allocation:
```typescript
export const api = functions
  .runWith({ memory: '512MB' })
  .https.onRequest(app);
```

## 🧪 Local Testing

Test locally before deploying:

```bash
# Start emulators
npm run serve

# Visit http://localhost:5000
# Functions at http://localhost:5001
```

## 📚 Documentation

- [Quick Start Guide](./QUICK_START.md)
- [Full Deployment Guide](./FIREBASE_DEPLOYMENT.md)
- [CLI Documentation](./README.md)
- [Project Summary](./PROJECT_SUMMARY.md)

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- [ ] Add rate limiting
- [ ] Add authentication options
- [ ] Support for OpenAPI 2.0
- [ ] Custom template support
- [ ] Batch processing
- [ ] Progress webhooks
- [ ] Email delivery option

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Credits

Built with:
- Firebase (Hosting + Functions)
- TypeScript
- Express.js
- Swagger Parser
- Archiver
- Busboy

---

**Made with ❤️ for the API development community**
