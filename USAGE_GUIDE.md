# Complete Usage Guide

## 🎯 All Generation Options

You can generate code for **individual frameworks** or **all three at once**.

---

## Option 1: Generate ALL Frameworks 🚀

Generate React, Spring Boot, AND Quarkus from a single command!

```bash
openapi-redux-gen generate-all -i petstore.yaml -o ./my-fullstack-app
```

**Output Structure:**
```
my-fullstack-app/
├── frontend-react/          # React + RTK Query + React 19
│   ├── api.ts
│   ├── hooks.ts
│   ├── monitoring-hooks.ts
│   ├── error-handling.ts
│   └── ...
├── backend-spring/          # Spring Boot 3.x
│   ├── pom.xml
│   ├── src/main/java/...
│   └── ...
└── backend-quarkus/         # Quarkus 3.x
    ├── pom.xml
    ├── src/main/java/...
    └── ...
```

### Full Command with All Options:

```bash
openapi-redux-gen generate-all \
  -i petstore.yaml \
  -o ./my-app \
  -p com.mycompany.api \
  -g com.mycompany \
  -a petstore \
  --module-name petstore \
  --quarkus-reactive
```

### Selective Generation:

```bash
# Generate only React + Spring Boot (skip Quarkus)
openapi-redux-gen generate-all \
  -i petstore.yaml \
  -o ./my-app \
  --skip-quarkus

# Generate only React + Quarkus (skip Spring Boot)
openapi-redux-gen generate-all \
  -i petstore.yaml \
  -o ./my-app \
  --skip-spring

# Generate only Spring + Quarkus (skip React)
openapi-redux-gen generate-all \
  -i petstore.yaml \
  -o ./my-app \
  --skip-react
```

---

## Option 2: Generate Individual Frameworks 🎨

### React/TypeScript Only

```bash
# Modern (RTK Query + React 19)
openapi-redux-gen generate \
  -i petstore.yaml \
  -o ./frontend \
  --modern-only

# Legacy (createAsyncThunk)
openapi-redux-gen generate \
  -i petstore.yaml \
  -o ./frontend \
  --legacy-only

# Both (for migration)
openapi-redux-gen generate \
  -i petstore.yaml \
  -o ./frontend
```

### Spring Boot Only

```bash
openapi-redux-gen generate-spring \
  -i petstore.yaml \
  -o ./backend-spring \
  -p com.example.petstore \
  -g com.example \
  -a petstore-api \
  --java-version 21 \
  --spring-boot-version 3.2.0
```

### Quarkus Only

```bash
# Non-Reactive
openapi-redux-gen generate-quarkus \
  -i petstore.yaml \
  -o ./backend-quarkus \
  -p com.example.petstore

# Reactive (Mutiny)
openapi-redux-gen generate-quarkus \
  -i petstore.yaml \
  -o ./backend-quarkus \
  -p com.example.petstore \
  --reactive
```

---

## 📋 All Commands Reference

### 1. `generate` - React/TypeScript

Generate React + Redux Toolkit Query SDK.

```bash
openapi-redux-gen generate [options]

Required:
  -i, --input <path>      OpenAPI spec file (YAML or JSON)
  -o, --output <path>     Output directory

Optional:
  -n, --name <name>       Module name (default: "api")
  -b, --base-url <url>    Base URL override
  --modern-only           Generate only RTK Query (skip createAsyncThunk)
  --legacy-only           Generate only createAsyncThunk (skip RTK Query)
  --debug                 Enable debug logging
  --log-level <level>     Set log level (error|warn|info|debug)
```

**Examples:**
```bash
# Modern React 19 + RTK Query
openapi-redux-gen generate -i spec.yaml -o ./frontend --modern-only

# Legacy with async thunks
openapi-redux-gen generate -i spec.yaml -o ./frontend --legacy-only

# Both for migration
openapi-redux-gen generate -i spec.yaml -o ./frontend

# With custom settings
openapi-redux-gen generate \
  -i spec.yaml \
  -o ./frontend \
  -n myapi \
  -b https://api.example.com \
  --modern-only \
  --debug
```

---

### 2. `generate-spring` - Spring Boot

Generate Spring Boot 3.x REST API.

```bash
openapi-redux-gen generate-spring [options]

Required:
  -i, --input <path>              OpenAPI spec file
  -o, --output <path>             Output directory

Optional:
  -p, --package <name>            Java package (default: com.example.api)
  -g, --group-id <id>             Maven group ID (default: com.example)
  -a, --artifact-id <id>          Maven artifact ID (default: api-service)
  -v, --version <version>         Version (default: 1.0.0)
  --java-version <version>        Java version (default: 21)
  --spring-boot-version <version> Spring Boot version (default: 3.2.0)
```

**Examples:**
```bash
# Basic
openapi-redux-gen generate-spring -i spec.yaml -o ./spring-api

# Custom package
openapi-redux-gen generate-spring \
  -i spec.yaml \
  -o ./spring-api \
  -p com.mycompany.api

# Full customization
openapi-redux-gen generate-spring \
  -i spec.yaml \
  -o ./spring-api \
  -p com.mycompany.petstore \
  -g com.mycompany \
  -a petstore-api \
  -v 2.0.0 \
  --java-version 21 \
  --spring-boot-version 3.2.1
```

---

### 3. `generate-quarkus` - Quarkus

Generate Quarkus 3.x REST API.

```bash
openapi-redux-gen generate-quarkus [options]

Required:
  -i, --input <path>            OpenAPI spec file
  -o, --output <path>           Output directory

Optional:
  -p, --package <name>          Java package (default: com.example.api)
  -g, --group-id <id>           Maven group ID (default: com.example)
  -a, --artifact-id <id>        Maven artifact ID (default: api-service)
  -v, --version <version>       Version (default: 1.0.0)
  --java-version <version>      Java version (default: 21)
  --quarkus-version <version>   Quarkus version (default: 3.6.0)
  --reactive                    Generate reactive code with Mutiny
```

**Examples:**
```bash
# Basic
openapi-redux-gen generate-quarkus -i spec.yaml -o ./quarkus-api

# Reactive
openapi-redux-gen generate-quarkus \
  -i spec.yaml \
  -o ./quarkus-api \
  --reactive

# Full customization
openapi-redux-gen generate-quarkus \
  -i spec.yaml \
  -o ./quarkus-api \
  -p com.mycompany.petstore \
  -g com.mycompany \
  -a petstore-api \
  -v 2.0.0 \
  --java-version 21 \
  --quarkus-version 3.6.0 \
  --reactive
```

---

### 4. `generate-all` - All Frameworks

Generate React + Spring Boot + Quarkus at once!

```bash
openapi-redux-gen generate-all [options]

Required:
  -i, --input <path>      OpenAPI spec file
  -o, --output <path>     Output directory

Optional:
  -p, --package <name>    Java package (default: com.example.api)
  -g, --group-id <id>     Maven group ID (default: com.example)
  -a, --artifact-id <id>  Maven artifact ID (default: api-service)
  --module-name <name>    React module name (default: api)
  --skip-react            Skip React generation
  --skip-spring           Skip Spring Boot generation
  --skip-quarkus          Skip Quarkus generation
  --quarkus-reactive      Generate reactive Quarkus code
```

**Examples:**
```bash
# Generate all three
openapi-redux-gen generate-all -i spec.yaml -o ./fullstack

# Skip one framework
openapi-redux-gen generate-all -i spec.yaml -o ./app --skip-quarkus

# Only React + Spring
openapi-redux-gen generate-all \
  -i spec.yaml \
  -o ./app \
  --skip-quarkus

# Only React + Quarkus (reactive)
openapi-redux-gen generate-all \
  -i spec.yaml \
  -o ./app \
  --skip-spring \
  --quarkus-reactive

# Full customization
openapi-redux-gen generate-all \
  -i spec.yaml \
  -o ./fullstack \
  -p com.mycompany.api \
  -g com.mycompany \
  -a petstore \
  --module-name petstore \
  --quarkus-reactive
```

---

### 5. `health` - Health Check

Check CLI health and view metrics.

```bash
openapi-redux-gen health
```

**Output:**
```
=== Health Status ===

Status: HEALTHY
Timestamp: 2025-11-04T16:30:39.964Z

=== Metrics Summary ===

Performance:
  Total Operations: 5
  Average Duration: 1234.56ms
  Success Rate: 100.00%
```

---

### 6. `clear-metrics` - Clear Metrics

Clear all collected performance metrics.

```bash
openapi-redux-gen clear-metrics
```

---

## 🎯 Common Use Cases

### 1. Full-Stack Monorepo

```bash
openapi-redux-gen generate-all \
  -i api-spec.yaml \
  -o ./monorepo/packages \
  -p com.mycompany.api \
  --module-name api
```

**Structure:**
```
monorepo/
└── packages/
    ├── frontend-react/
    ├── backend-spring/
    └── backend-quarkus/
```

### 2. Frontend Only (Modern React)

```bash
openapi-redux-gen generate \
  -i api-spec.yaml \
  -o ./src/api \
  -n myapi \
  --modern-only
```

### 3. Backend Only (Choose One)

```bash
# Spring Boot
openapi-redux-gen generate-spring \
  -i api-spec.yaml \
  -o ./backend \
  -p com.example.api

# OR Quarkus (Cloud-Native)
openapi-redux-gen generate-quarkus \
  -i api-spec.yaml \
  -o ./backend \
  -p com.example.api \
  --reactive
```

### 4. Microservices (All Separate)

```bash
# Frontend
openapi-redux-gen generate \
  -i api-spec.yaml \
  -o ./services/web-ui \
  --modern-only

# Service 1 (Spring Boot)
openapi-redux-gen generate-spring \
  -i service1-api.yaml \
  -o ./services/service1 \
  -p com.example.service1

# Service 2 (Quarkus)
openapi-redux-gen generate-quarkus \
  -i service2-api.yaml \
  -o ./services/service2 \
  -p com.example.service2 \
  --reactive
```

### 5. Migration Project (Both Modern & Legacy)

```bash
# Generate both for gradual migration
openapi-redux-gen generate \
  -i api-spec.yaml \
  -o ./frontend

# Use modern for new code, legacy still works
```

---

## 🚀 Quick Start Guide

### Complete Full-Stack App in 3 Commands

```bash
# 1. Generate all code
openapi-redux-gen generate-all \
  -i petstore.yaml \
  -o ./my-app

# 2. Run Frontend
cd my-app/frontend-react
npm install && npm start

# 3. Run Backend (choose one)
# Spring Boot:
cd ../backend-spring && mvn spring-boot:run
# OR Quarkus:
cd ../backend-quarkus && mvn quarkus:dev
```

---

## 📊 Comparison Table

| Command | Generates | Best For |
|---------|-----------|----------|
| `generate` | React/TypeScript | Frontend applications |
| `generate-spring` | Spring Boot | Traditional Java backends |
| `generate-quarkus` | Quarkus | Cloud-native, microservices |
| `generate-all` | All three! | Full-stack projects |

---

## 🎨 Customization Examples

### Example 1: Enterprise Microservice

```bash
openapi-redux-gen generate-all \
  -i user-service.yaml \
  -o ./services/user-service \
  -p com.acme.users \
  -g com.acme \
  -a user-service \
  --module-name users \
  --quarkus-reactive
```

### Example 2: Startup MVP

```bash
# Just React + Quarkus (fastest startup)
openapi-redux-gen generate-all \
  -i mvp-api.yaml \
  -o ./mvp \
  --skip-spring \
  --quarkus-reactive
```

### Example 3: Legacy Migration

```bash
# Generate both modern and legacy
openapi-redux-gen generate \
  -i legacy-api.yaml \
  -o ./frontend \
  -n legacy
```

---

## 🔍 Debugging

Enable debug mode for any command:

```bash
openapi-redux-gen generate-all \
  -i spec.yaml \
  -o ./output \
  --debug \
  --log-level debug
```

View logs:
```bash
ls logs/
# combined-2025-11-04.log
# error-2025-11-04.log
```

---

## 💡 Tips & Tricks

### 1. Use Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias oa-react="openapi-redux-gen generate --modern-only"
alias oa-spring="openapi-redux-gen generate-spring"
alias oa-quarkus="openapi-redux-gen generate-quarkus --reactive"
alias oa-all="openapi-redux-gen generate-all"

# Usage
oa-react -i spec.yaml -o ./frontend
oa-all -i spec.yaml -o ./app
```

### 2. Environment Variables

```bash
# Set defaults
export OPENAPI_PACKAGE="com.mycompany.api"
export OPENAPI_GROUP="com.mycompany"

# Use in scripts
openapi-redux-gen generate-spring \
  -i spec.yaml \
  -o ./backend \
  -p $OPENAPI_PACKAGE \
  -g $OPENAPI_GROUP
```

### 3. Automation Script

```bash
#!/bin/bash
# generate-all.sh

API_SPEC=$1
OUTPUT_DIR=$2

if [ -z "$API_SPEC" ] || [ -z "$OUTPUT_DIR" ]; then
  echo "Usage: ./generate-all.sh <api-spec> <output-dir>"
  exit 1
fi

echo "Generating full stack from $API_SPEC..."

openapi-redux-gen generate-all \
  -i "$API_SPEC" \
  -o "$OUTPUT_DIR" \
  -p com.example.api \
  --quarkus-reactive

echo "✅ Done! Check $OUTPUT_DIR"
```

---

## 📚 Next Steps

1. **Try it out:** `openapi-redux-gen generate-all -i examples/petstore-api.yaml -o ./test`
2. **Read docs:** Check COMPLETE_FEATURES.md for full feature list
3. **Deploy:** See DEPLOYMENT.md for deployment options
4. **Customize:** Modify generated code as needed

---

## 🆘 Need Help?

```bash
# General help
openapi-redux-gen --help

# Command-specific help
openapi-redux-gen generate --help
openapi-redux-gen generate-spring --help
openapi-redux-gen generate-quarkus --help
openapi-redux-gen generate-all --help

# Check health
openapi-redux-gen health

# View logs
cat logs/combined-$(date +%Y-%m-%d).log
```

---

**Happy Generating! 🚀**
