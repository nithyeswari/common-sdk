# OpenAPI Redux SDK Generator

Generate type-safe Redux SDKs from OpenAPI specifications - available as both a **CLI tool** and a **web application**!

## 🌟 Two Ways to Use

### 🌐 Web App (Firebase Hosting) - **Recommended for most users**
- **URL**: Deploy to Firebase Hosting
- **Zero setup**: Just upload your OpenAPI file
- **100% private**: Everything runs in your browser
- **Completely free**: No backend, no costs
- **Instant**: Generate and download immediately

[See deployment guide →](./FIREBASE_HOSTING_GUIDE.md)

### 💻 CLI Tool - **For automation & CI/CD**
- **Command line**: Perfect for scripts and build pipelines
- **Local processing**: Works offline
- **Automation**: Integrate with your workflow
- **Batch processing**: Generate multiple SDKs

[See CLI documentation below ↓](#cli-usage)

---

## 🚀 Quick Start - Web App

### Deploy to Firebase (2 minutes)

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Update .firebaserc with your project ID
# (Create a Firebase project at console.firebase.google.com)

# 4. Deploy
firebase deploy --only hosting
```

Your app is now live at `https://your-project-id.web.app`! 🎉

**That's it!** No backend setup, no functions, completely free.

[Full deployment guide →](./FIREBASE_HOSTING_GUIDE.md)

---

## 💻 CLI Usage

### Installation

```bash
npm install
npm run build
```

### Generate SDK

```bash
# Basic usage
node dist/cli.js generate -i examples/petstore-api.yaml -o ./output

# With options
node dist/cli.js generate \
  -i path/to/openapi.yaml \
  -o ./output/sdk \
  -n myapi \
  -b https://api.example.com
```

### Global Installation (Optional)

```bash
npm install -g .
openapi-redux-gen generate -i openapi.yaml -o ./sdk
```

---

## ✨ Features

### What Gets Generated

- **📝 TypeScript Types**: Interfaces from OpenAPI schemas
- **🔌 API Client**: Axios-based HTTP client
- **⚡ Redux Actions**: Async thunks for each endpoint
- **🔄 Redux Reducers**: Slices with loading/error/data states
- **🏪 Redux Store**: Store configuration helpers
- **🎯 Selectors**: Typed selectors for each operation
- **📦 Package Files**: README, package.json, and index.ts

### Code Quality

- ✅ **Type-safe**: Full TypeScript support
- ✅ **Modern**: Redux Toolkit with async thunks
- ✅ **Clean**: Well-organized, readable code
- ✅ **Documented**: JSDoc comments from OpenAPI descriptions
- ✅ **Production-ready**: Ready to use in your application

---

## 📖 Usage Examples

### Web App Usage

1. Visit your deployed URL
2. Upload OpenAPI file (YAML or JSON)
3. Set module name (e.g., "petstore")
4. Click "Generate SDK"
5. Download ZIP file
6. Extract and use in your project!

### CLI Usage

```bash
# Generate from YAML
node dist/cli.js generate -i api.yaml -o ./sdk

# Generate from JSON
node dist/cli.js generate -i api.json -o ./sdk

# With custom module name
node dist/cli.js generate -i api.yaml -o ./sdk -n myapi

# Override base URL
node dist/cli.js generate -i api.yaml -o ./sdk -b https://api.prod.com
```

### Using Generated SDK

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import {
  petstoreReducer,
  listPets,
  selectListPetsData,
  selectListPetsLoading
} from './sdk';

// Configure store
const store = configureStore({
  reducer: { petstore: petstoreReducer }
});

// Use in components
function PetList() {
  const dispatch = useDispatch();
  const pets = useSelector(selectListPetsData);
  const loading = useSelector(selectListPetsLoading);

  useEffect(() => {
    dispatch(listPets({ limit: 10 }));
  }, []);

  if (loading) return <div>Loading...</div>;
  return <ul>{pets?.map(pet => <li>{pet.name}</li>)}</ul>;
}
```

---

## 🏗️ Project Structure

```
common-sdk/
├── public/                   # Web app (Firebase Hosting)
│   ├── index.html           # UI
│   ├── styles.css           # Styling
│   ├── app.js               # App logic
│   └── generator.js         # Client-side SDK generator
├── src/                     # CLI tool
│   ├── cli.ts              # CLI entry point
│   ├── generator.ts        # Main orchestrator
│   ├── parser/             # OpenAPI parser
│   ├── generators/         # Code generators
│   └── types/              # Type definitions
├── examples/
│   └── petstore-api.yaml   # Example OpenAPI spec
├── firebase.json           # Firebase Hosting config
└── README.md               # This file
```

---

## 🎯 Use Cases

### Web App is Perfect For:
- 🎨 Designers & product managers
- 🚀 Quick one-off SDK generation
- 👥 Teams without CLI access
- 📱 Mobile/tablet usage
- 🔒 Privacy-conscious users (everything stays local)

### CLI is Perfect For:
- 🤖 CI/CD pipelines
- 📜 Scripts and automation
- 🔁 Batch processing
- 💻 Developer workflows
- 🏢 Enterprise environments

---

## 🌐 Web App Architecture

### 100% Client-Side

```
User's Browser
├── Upload OpenAPI file
├── Parse with js-yaml
├── Generate TypeScript code
├── Bundle with JSZip
└── Download ZIP
```

**No server involved!**

### Benefits

- **Private**: Files never leave your browser
- **Fast**: No server processing time
- **Free**: Zero hosting costs
- **Scalable**: Unlimited concurrent users
- **Secure**: No server to hack

### Libraries (via CDN)

- [js-yaml](https://github.com/nodeca/js-yaml) - Parse YAML
- [JSZip](https://stuk.github.io/jszip/) - Create ZIP files

---

## 💰 Pricing

| Method | Cost |
|--------|------|
| **Web App** | **FREE** (Firebase Hosting free tier) |
| **CLI Tool** | **FREE** (open source) |
| **Both** | **$0.00/month** 🎉 |

---

## 📚 Documentation

- [🚀 Firebase Hosting Guide](./FIREBASE_HOSTING_GUIDE.md) - Deploy web app
- [📋 Deployment Summary](./DEPLOYMENT_SUMMARY.md) - Quick overview
- [📖 Project Summary](./PROJECT_SUMMARY.md) - Technical details
- [🔧 CLI Documentation](#cli-usage) - Above

---

## 🛠️ Development

### CLI Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Test
node dist/cli.js generate -i examples/petstore-api.yaml -o ./test-output
```

### Web App Development

```bash
# Test locally
cd public
python -m http.server 8000
# or
npx http-server . -p 8000

# Then visit http://localhost:8000
```

---

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- [ ] Support for OpenAPI 2.0
- [ ] Additional generator templates
- [ ] More customization options
- [ ] Better error messages
- [ ] Unit tests
- [ ] React Query/SWR generator option
- [ ] GraphQL support

---

## 📄 License

MIT License - Free to use, modify, and distribute

---

## 🙏 Credits

Built with:
- TypeScript
- Redux Toolkit
- Axios
- Firebase Hosting
- js-yaml
- JSZip

---

## 📊 Quick Comparison

| Feature | Web App | CLI Tool |
|---------|---------|----------|
| Setup | None | npm install |
| Usage | Upload file | Command line |
| Speed | Instant | Instant |
| Privacy | 100% local | 100% local |
| Cost | Free | Free |
| Automation | No | Yes |
| CI/CD | No | Yes |
| Mobile | Yes | No |
| Offline | After first load | Yes |

---

## 🎉 Get Started Now!

### For Most Users (Web App):
1. Deploy to Firebase (2 minutes)
2. Share URL with team
3. Generate SDKs instantly

[Deploy Now →](./FIREBASE_HOSTING_GUIDE.md)

### For Developers (CLI):
1. `npm install && npm run build`
2. `node dist/cli.js generate -i openapi.yaml -o ./sdk`
3. Use generated SDK in your project

---

**Made with ❤️ for the API development community**

🌟 Star this repo if you find it useful!

📧 Questions? Open an issue on GitHub

🚀 Happy coding!
