# OpenAPI SDK Generator

Generate type-safe SDKs from OpenAPI specifications for **React/TypeScript**, **Spring Boot**, and **Quarkus** - available as both a **CLI tool** and a **web application**.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Features](#features)
- [CLI Commands](#cli-commands)
- [Generated Code](#generated-code)
- [Web App Deployment](#web-app-deployment)
- [Multi-Spec Support](#multi-spec-support)
- [Advanced Features](#advanced-features)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## Overview

A comprehensive code generation platform that creates production-ready SDKs from OpenAPI specifications:

| Framework | Command | Output |
|-----------|---------|--------|
| **React + Redux** | `generate` | TypeScript, RTK Query, React 19 hooks |
| **Spring Boot** | `generate-spring` | Java REST API with Spring Boot 3.x |
| **Quarkus** | `generate-quarkus` | Java REST API with Quarkus 3.x |
| **Spring Boot Client** | `generate-spring-client` | WebClient-based REST client SDK |
| **Quarkus Client** | `generate-quarkus-client` | MicroProfile REST Client SDK |
| **All Frameworks** | `generate-all` | Generate React + Spring Boot + Quarkus at once |

### Two Ways to Use

**Web App (Firebase Hosting)** - Recommended for most users
- Zero setup: Just upload your OpenAPI file
- 100% private: Everything runs in your browser
- Completely free: No backend, no costs

**CLI Tool** - For automation & CI/CD
- Command line: Perfect for scripts and build pipelines
- Local processing: Works offline
- Batch processing: Generate multiple SDKs

---

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Generate React SDK (Modern - RTK Query + React 19)

```bash
node dist/cli.js generate -i examples/petstore-api.yaml -o ./output --modern-only
```

### Generate Spring Boot API

```bash
node dist/cli.js generate-spring -i examples/petstore-api.yaml -o ./spring-api -p com.example.petstore
```

### Generate Quarkus API (Reactive)

```bash
node dist/cli.js generate-quarkus -i examples/petstore-api.yaml -o ./quarkus-api -p com.example.petstore --reactive
```

### Generate All Frameworks at Once

```bash
node dist/cli.js generate-all -i examples/petstore-api.yaml -o ./fullstack-app
```

This creates:
```
fullstack-app/
├── frontend-react/      # React + RTK Query + React 19
├── backend-spring/      # Spring Boot 3.x
└── backend-quarkus/     # Quarkus 3.x
```

---

## Features

### What Gets Generated

**React/TypeScript:**
- RTK Query API with automatic caching
- React 19 hooks (useOptimistic, useSuspense)
- TypeScript types from OpenAPI schemas
- Error handling utilities
- Monitoring hooks
- Client-side logger

**Spring Boot:**
- REST controllers with `@RestController`
- Bean Validation with Jakarta Validation
- Global exception handling with `@ControllerAdvice`
- OpenAPI/Swagger UI auto-configured
- Actuator for health checks and metrics
- AOP logging aspect
- Prometheus metrics export

**Quarkus:**
- JAX-RS resources with `@Path`
- Reactive/Non-reactive options (Mutiny)
- SmallRye OpenAPI auto-configured
- MicroProfile Health checks
- CDI interceptors for logging
- Native compilation ready (GraalVM)

### Feature Matrix

| Feature | React/TypeScript | Spring Boot | Quarkus |
|---------|------------------|-------------|---------|
| **Code Generation** | Yes | Yes | Yes |
| **Type Safety** | TypeScript | Java | Java |
| **Validation** | Yes | Bean Validation | Bean Validation |
| **Error Handling** | Structured | @ControllerAdvice | Exception Mappers |
| **Logging** | Winston | Logback | JSON logging |
| **Monitoring** | Custom hooks | Actuator | SmallRye Health |
| **Metrics** | Performance tracking | Micrometer | Micrometer |
| **OpenAPI Docs** | Yes | Springdoc | SmallRye OpenAPI |
| **Auto-caching** | RTK Query | No | No |
| **Reactive** | React 19 | No | Mutiny |
| **Native Compilation** | No | No | GraalVM |

---

## CLI Commands

### `generate` - React/TypeScript SDK

```bash
node dist/cli.js generate [options]

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

### `generate-spring` - Spring Boot API

```bash
node dist/cli.js generate-spring [options]

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

### `generate-quarkus` - Quarkus API

```bash
node dist/cli.js generate-quarkus [options]

Required:
  -i, --input <path>              OpenAPI spec file
  -o, --output <path>             Output directory

Optional:
  -p, --package <name>            Java package (default: com.example.api)
  -g, --group-id <id>             Maven group ID (default: com.example)
  -a, --artifact-id <id>          Maven artifact ID (default: api-service)
  -v, --version <version>         Version (default: 1.0.0)
  --java-version <version>        Java version (default: 21)
  --quarkus-version <version>     Quarkus version (default: 3.6.0)
  --reactive                      Generate reactive code with Mutiny
```

### `generate-all` - All Frameworks

```bash
node dist/cli.js generate-all [options]

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

### `generate-spring-client` - Spring Boot Client SDK

```bash
node dist/cli.js generate-spring-client [options]

Optional:
  --use-rest-template     Use RestTemplate instead of WebClient
```

### `generate-quarkus-client` - Quarkus Client SDK

```bash
node dist/cli.js generate-quarkus-client [options]

Optional:
  --reactive              Generate reactive (Mutiny) client
```

### Utility Commands

```bash
# Check health and view metrics
node dist/cli.js health

# Clear collected metrics
node dist/cli.js clear-metrics
```

---

## Generated Code

### React + RTK Query Example

```typescript
// api.ts
export const petStoreApi = createApi({
  reducerPath: 'petStoreApi',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Pet'],
  endpoints: (builder) => ({
    getPets: builder.query<Pet[], { limit: number }>({
      query: ({ limit }) => `pets?limit=${limit}`,
      providesTags: ['Pet'],
    }),
    createPet: builder.mutation<Pet, Partial<Pet>>({
      query: (pet) => ({
        url: 'pets',
        method: 'POST',
        body: pet,
      }),
      invalidatesTags: ['Pet'],
    }),
  }),
});

export const { useGetPetsQuery, useCreatePetMutation } = petStoreApi;
```

**Usage in Component:**

```typescript
function PetList() {
  const { data: pets, isLoading } = useGetPetsQuery({ limit: 10 });

  if (isLoading) return <div>Loading...</div>;
  return <ul>{pets?.map(pet => <li>{pet.name}</li>)}</ul>;
}
```

### Spring Boot Controller Example

```java
@RestController
@RequestMapping("/pets")
@Validated
public class PetController {

    private final PetService service;

    @GetMapping
    public ResponseEntity<List<Pet>> getPets(
        @RequestParam(required = false) Integer limit
    ) {
        var result = service.getPets(limit);
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<Pet> createPet(@Valid @RequestBody Pet pet) {
        var result = service.createPet(pet);
        return ResponseEntity.ok(result);
    }
}
```

### Quarkus Resource Example (Reactive)

```java
@Path("/pets")
public class PetResource {

    @Inject
    PetService service;

    @GET
    public Uni<Response> getPets(@QueryParam("limit") Integer limit) {
        return service.getPets(limit)
            .onItem().transform(result -> Response.ok(result).build());
    }

    @POST
    public Uni<Response> createPet(@Valid Pet pet) {
        return service.createPet(pet)
            .onItem().transform(result -> Response.ok(result).build());
    }
}
```

### Client SDK Example (Quarkus)

```java
@RegisterRestClient(configKey = "pet-store-api")
@RegisterClientHeaders(HeaderPropagationFactory.class)
@Path("/")
public interface PetsClient {

    @CircuitBreaker(requestVolumeThreshold = 10, failureRatio = 0.5)
    @Retry(maxRetries = 3, delay = 1000)
    @Timeout(value = 10000)
    @GET
    @Path("/pets")
    Uni<List<Pet>> listPets(
        @QueryParam("limit") Long limit,
        @QueryParam("tag") String tag
    );
}
```

---

## Web App Deployment

### Deploy to Firebase (100% Client-Side)

Everything runs in the browser - no backend needed!

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

Your app is now live at `https://your-project-id.web.app`

**Benefits:**
- Private: Files never leave your browser
- Fast: No server processing time
- Free: Zero hosting costs
- Scalable: Unlimited concurrent users

### Test Locally

```bash
cd public
npx http-server . -p 8000
# Visit http://localhost:8000
```

---

## Multi-Spec Support

The generator supports OpenAPI specifications that span multiple files using `$ref` references.

### Example Structure

```
my-api/
├── common-schemas.yaml       # Shared: Error, User, Pagination, etc.
├── products-api.yaml         # Products API (refs common)
└── orders-api.yaml           # Orders API (refs common)
```

### Reference Syntax

```yaml
# In products-api.yaml
components:
  schemas:
    Product:
      properties:
        price:
          $ref: './common-schemas.yaml#/components/schemas/Money'
        createdBy:
          $ref: './common-schemas.yaml#/components/schemas/UserInfo'
```

### Web UI Multi-File Upload

1. Click "Choose OpenAPI file(s)"
2. Select multiple files (Ctrl+Click):
   - Select the **main API spec first**
   - Then select all referenced files
3. Generate SDK

---

## Advanced Features

### React 19 Features

**Optimistic Updates:**

```typescript
const { mutate, isPending } = useOptimisticMutation(
  createPetMutation,
  {
    getOptimisticData: (data) => ({ id: 'temp', ...data }),
    onSuccess: () => toast.success('Created!'),
  }
);
```

**Suspense Integration:**

```typescript
function PetDetails({ petId }) {
  const pet = use(fetchPet(petId));
  return <div>{pet.name}</div>;
}

<Suspense fallback={<Loading />}>
  <PetDetails petId="123" />
</Suspense>
```

### Header Forwarding (Microservices)

The generated Quarkus client includes automatic header propagation:

```java
@RegisterClientHeaders(HeaderPropagationFactory.class)
```

Automatically forwards:
- Authorization tokens
- X-Correlation-ID
- X-Request-ID
- X-Trace-ID
- X-Tenant-ID

### Client SDK Resilience

**Circuit Breaker:**
```java
@CircuitBreaker(requestVolumeThreshold = 10, failureRatio = 0.5)
```

**Retry Logic:**
```java
@Retry(maxRetries = 3, delay = 1000, jitter = 500)
```

**Timeout:**
```java
@Timeout(value = 10000)
```

### Spec Aggregator

Merge multiple OpenAPI specifications into a single unified spec:

1. Upload multiple specs
2. Enable "Spec Aggregation"
3. Configure aggregated spec name
4. Generate unified SDK

### CO2 Emission Tracking

Track carbon footprint of API endpoints:

```yaml
x-co2-impact:
  estimatedGramsPerRequest: 0.25
  trackingEnabled: true
  monitoringMetric: "co2.api.users"
```

---

## Development

### Project Structure

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
│   └── utils/              # Utilities (logging, monitoring, errors)
├── examples/
│   └── petstore-api.yaml   # Example OpenAPI spec
├── firebase.json           # Firebase Hosting config
└── README.md               # This file
```

### Build Commands

```bash
# Install dependencies
npm install

# Build CLI
npm run build

# Watch mode
npm run dev

# Test generation
node dist/cli.js generate -i examples/petstore-api.yaml -o ./test-output --debug
```

### Running Generated Projects

**Spring Boot:**

```bash
cd spring-api
mvn spring-boot:run
# Visit http://localhost:8080/swagger-ui.html
```

**Quarkus:**

```bash
cd quarkus-api
mvn quarkus:dev
# Visit http://localhost:8080/swagger-ui
```

### Performance Comparison

| Metric | Spring Boot | Quarkus JVM | Quarkus Native |
|--------|-------------|-------------|----------------|
| **Startup Time** | 3-5s | 1-2s | 0.05s |
| **Memory (RSS)** | 200-400MB | 100-200MB | 50-100MB |
| **First Response** | 3-5s | 1-2s | < 0.1s |

---

## Troubleshooting

### Spring Boot

**Port already in use:**
```properties
server.port=8081
```

**Validation not working:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

### Quarkus

**Dev mode not starting:**
```bash
mvn clean quarkus:dev
```

**Native build fails:**
```bash
mvn clean package -Pnative -Dquarkus.native.container-build=true
```

### CLI Tool

**Enable debug logging:**
```bash
node dist/cli.js generate -i spec.yaml -o ./output --debug --log-level debug
```

**View logs:**
```bash
cat logs/combined-$(date +%Y-%m-%d).log
```

**Check health:**
```bash
node dist/cli.js health
```

---

## When to Use What

### Use Spring Boot if:
- Large existing Spring ecosystem
- Enterprise applications
- Traditional JVM deployment
- Team knows Spring already

### Use Quarkus if:
- Cloud-native/Kubernetes deployments
- Microservices architecture
- Need fast startup and low memory
- Serverless/FaaS deployments
- Native compilation is priority

### Use RTK Query + React 19 if:
- Starting a new React project
- Want automatic caching
- Need optimistic updates
- Want minimal boilerplate

---

## License

MIT License - Free to use, modify, and distribute.

---

## Credits

Built with:
- TypeScript
- Redux Toolkit Query
- React 19
- Spring Boot 3.x
- Quarkus 3.x
- Firebase Hosting
- js-yaml
- JSZip
- Winston
