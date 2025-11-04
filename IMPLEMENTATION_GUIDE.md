# Implementation Guide - Modern SDK Generator

This guide documents the comprehensive implementation of Redux Toolkit Query, React 19 features, and cross-cutting concerns in the OpenAPI SDK Generator.

## Overview

The SDK generator has been upgraded with:

1. **Latest Redux Toolkit Query** - Modern data fetching with automatic caching
2. **React 19 Features** - Optimistic updates, Suspense integration, form actions
3. **Comprehensive Error Handling** - Structured error codes and retry logic
4. **Performance Monitoring** - Metrics collection and performance tracking
5. **Structured Logging** - Winston-based logging with file rotation
6. **Exception Management** - Global error handlers and recovery mechanisms

## Architecture

### CLI Layer (src/cli.ts)

The CLI has been enhanced with:

- **Global error handlers** - Process-level error catching
- **Structured logging** - Winston logger with multiple transports
- **Performance tracking** - Operation timing and metrics
- **Health checks** - CLI command to view system health
- **Debugging support** - `--debug` and `--log-level` flags

Example usage:
```bash
# Generate with debug logging
openapi-redux-gen generate -i spec.yaml -o ./output --debug

# Check health and metrics
openapi-redux-gen health

# Clear collected metrics
openapi-redux-gen clear-metrics
```

### Core Utilities (src/utils/)

#### 1. Error Codes (error-codes.ts)

Centralized error management:

```typescript
// Categorized error codes
enum ErrorCode {
  FILE_READ_ERROR = 'FS_1000',
  OPENAPI_PARSE_ERROR = 'API_2000',
  GENERATION_ERROR = 'GEN_3000',
  // ... more codes
}

// Rich error class
class AppError extends Error {
  code: ErrorCode;
  severity: 'error' | 'warning' | 'info';
  userMessage: string;
  technicalDetails?: string;
  suggestedAction?: string;
  context?: Record<string, any>;
}
```

#### 2. Logging (logger.ts)

Production-ready logging with Winston:

```typescript
// Structured logging
logger.info('Operation completed', { duration: 1234, userId: '123' });
logger.error('Failed to parse', error, { filePath: '/path' });

// Performance tracking
const timer = new PerformanceTimer('Operation Name');
// ... do work ...
timer.end(true); // Automatically logs duration
```

Features:
- Console and file transports
- Daily log rotation
- JSON formatting for files
- Colored console output
- Contextual metadata

#### 3. Monitoring (monitoring.ts)

Performance and error metrics:

```typescript
// Automatic tracking with decorator
@measurePerformance('functionName')
async function myFunction() { }

// Manual tracking
await trackPerformance('operation', async () => {
  // ... work ...
});

// Get metrics
const stats = monitoring.getPerformanceStats();
console.log(`Average duration: ${stats.averageDuration}ms`);
```

#### 4. Error Handler (error-handler.ts)

Centralized error handling:

```typescript
// Setup global handlers
setupGlobalErrorHandlers();

// Async wrapper
const safeFunction = asyncHandler(async () => {
  // ... code that might throw ...
});

// Retry logic
await retryWithBackoff(
  () => apiCall(),
  { maxRetries: 3, initialDelay: 1000 }
);
```

### Generated SDK Features

#### 1. RTK Query API (api.ts)

Modern data fetching with:

- Automatic caching
- Request deduplication
- Cache invalidation
- Optimistic updates
- Retry logic with exponential backoff
- Tag-based cache management

```typescript
// Generated API
export const petStoreApi = createApi({
  reducerPath: 'petStoreApi',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Pet', 'User'],
  endpoints: (builder) => ({
    getPets: builder.query({
      query: (args) => '/pets',
      providesTags: [{ type: 'Pet', id: 'LIST' }],
    }),
  }),
});

// Auto-generated hooks
export const { useGetPetsQuery, useCreatePetMutation } = petStoreApi;
```

#### 2. React 19 Hooks (hooks.ts)

Leveraging latest React features:

**Optimistic Mutations:**
```typescript
const { mutate, isPending } = useOptimisticMutation(
  async (data) => createUser(data),
  {
    getOptimisticData: (data) => ({ id: 'temp', ...data }),
    onSuccess: (result) => { /* ... */ },
  }
);
```

**Suspense Integration:**
```typescript
function DataComponent() {
  const data = useSuspenseQuery(() => fetchData(), []);
  return <div>{data.name}</div>;
}
```

**Form Mutations:**
```typescript
const { handleSubmit, isLoading } = useFormMutation(
  async (formData) => createResource(formData),
  { onSuccess: () => { /* ... */ } }
);
```

#### 3. Error Handling (error-handling.ts)

Structured error management:

```typescript
// Error codes for client-side
enum ApiErrorCode {
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  // ... more
}

// Rich error class
class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;
  data?: any;
}

// Error handler
const apiError = handleApiError(error);
console.log(apiError.code, apiError.status);
```

#### 4. Monitoring (monitoring.ts & monitoring-hooks.ts)

Performance tracking:

**Core Monitoring:**
```typescript
// Track requests
await trackRequest('operation', async () => {
  return await apiCall();
});

// Get metrics
const metrics = metricsCollector.getMetrics();
```

**React Hooks:**
```typescript
// API metrics
const metrics = useApiMetrics(5000); // Update every 5s

// Network status
const isOnline = useNetworkStatus();

// Error tracking
const { errors, trackError, clearErrors } = useErrorTracking();

// Request timing
const { start, end, duration } = useRequestTiming('operation');
```

#### 5. Logging (logger.ts)

Client-side logging:

```typescript
// Configure
logger.setLevel(LogLevel.DEBUG);
logger.setEnabled(true);

// Use
logger.info('User action', { action: 'click' });
logger.error('API failed', error);
```

## Usage Examples

### Basic RTK Query Usage

```typescript
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { petStoreApi, useGetPetsQuery } from './generated';

const store = configureStore({
  reducer: {
    [petStoreApi.reducerPath]: petStoreApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(petStoreApi.middleware),
});

function PetList() {
  const { data, error, isLoading } = useGetPetsQuery({ limit: 10 });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error!</div>;

  return <ul>{data?.map(pet => <li>{pet.name}</li>)}</ul>;
}
```

### Optimistic Updates

```typescript
import { useOptimisticMutation, useCreatePetMutation } from './generated';

function CreatePet() {
  const [createPet] = useCreatePetMutation();

  const { mutate, isPending } = useOptimisticMutation(
    async (data) => createPet(data).unwrap(),
    {
      getOptimisticData: (data) => ({ id: `temp-${Date.now()}`, ...data }),
      onSuccess: () => console.log('Created!'),
    }
  );

  return (
    <button onClick={() => mutate({ name: 'Fluffy' })}>
      {isPending ? 'Creating...' : 'Create Pet'}
    </button>
  );
}
```

### Error Handling

```typescript
import { ApiError, retryWithBackoff } from './generated';

async function fetchWithRetry() {
  try {
    const result = await retryWithBackoff(
      () => apiCall(),
      { maxRetries: 3 }
    );
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      switch (error.code) {
        case 'NETWORK_ERROR':
          // Handle network error
          break;
        case 'VALIDATION_ERROR':
          // Handle validation error
          break;
      }
    }
  }
}
```

### Monitoring Dashboard

```typescript
import { useApiMetrics, useNetworkStatus } from './generated';

function Dashboard() {
  const metrics = useApiMetrics();
  const isOnline = useNetworkStatus();

  return (
    <div>
      <h2>API Health</h2>
      <p>Status: {isOnline ? 'Online' : 'Offline'}</p>
      <p>Total Requests: {metrics.totalRequests}</p>
      <p>Success Rate: {100 - metrics.errorRate}%</p>
      <p>Avg Response Time: {metrics.averageResponseTime}ms</p>
    </div>
  );
}
```

## Best Practices

### 1. Error Handling

- Always use structured error codes
- Implement error boundaries at component boundaries
- Log errors with context for debugging
- Use retry logic for transient failures

### 2. Performance

- Enable monitoring in development
- Track slow operations (> 1s)
- Use optimistic updates for better UX
- Implement prefetching for predictable navigation

### 3. Logging

- Set appropriate log levels per environment
- Include contextual metadata
- Rotate logs to prevent disk issues
- Enable debug mode for troubleshooting

### 4. Monitoring

- Track metrics in production
- Set up alerts for error rates
- Monitor response times
- Use performance timers for critical paths

### 5. React 19

- Leverage Suspense for loading states
- Use optimistic updates for mutations
- Implement error boundaries
- Use transitions for non-urgent updates

## Testing

```bash
# Build the project
npm run build

# Test generation
npm start -- generate -i examples/petstore-api.yaml -o ./test-output

# Test with debug
npm start -- generate -i examples/petstore-api.yaml -o ./test-output --debug

# Check health
npm start -- health
```

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=debug          # error, warn, info, debug
LOG_DIR=./logs           # Log directory
ENABLE_FILE_LOGGING=true # Enable file logging

# Debugging
DEBUG=true               # Enable debug mode
NODE_ENV=development     # Environment
```

### TypeScript Configuration

The generator uses TypeScript 5.3+ with:
- Strict mode enabled
- ES2020 target
- CommonJS modules
- Source maps enabled

## Migration Guide

### From Legacy Redux to RTK Query

**Before:**
```typescript
import { fetchPets } from './actions';
const data = useSelector(state => state.pets.data);
useEffect(() => {
  dispatch(fetchPets());
}, []);
```

**After:**
```typescript
import { useGetPetsQuery } from './api';
const { data } = useGetPetsQuery();
```

### Adding Error Handling

**Before:**
```typescript
try {
  await apiCall();
} catch (error) {
  console.error(error);
}
```

**After:**
```typescript
try {
  await retryWithBackoff(() => apiCall(), { maxRetries: 3 });
} catch (error) {
  if (error instanceof ApiError) {
    logger.error('API call failed', error);
    handleApiError(error);
  }
}
```

## Troubleshooting

### Common Issues

1. **Winston module not found**
   - Run `npm install`
   - Ensure winston is in dependencies

2. **React 19 hooks not working**
   - Check React version: `npm list react`
   - Ensure React 19+ is installed

3. **RTK Query cache issues**
   - Clear cache: `dispatch(api.util.resetApiState())`
   - Check tag configuration

4. **Logging not working**
   - Check LOG_LEVEL environment variable
   - Ensure logger is enabled: `logger.setEnabled(true)`

## Performance Considerations

1. **Bundle Size**
   - RTK Query adds ~12KB gzipped
   - Winston adds ~40KB (CLI only)
   - Consider code splitting for large apps

2. **Memory Usage**
   - Metrics are capped at 1000 entries
   - Logs rotate daily
   - Clear metrics periodically

3. **Network**
   - Requests are deduplicated automatically
   - Cache reduces redundant requests
   - Use prefetching wisely

## Future Enhancements

Potential improvements:

1. GraphQL support
2. WebSocket/SSE integration
3. Offline support
4. Request cancellation
5. Advanced cache strategies
6. Telemetry integration (Sentry, DataDog)
7. React Native support
8. Server-side rendering optimizations

## Support

For issues or questions:
- Check the examples directory
- Review the generated README
- Enable debug logging
- Check health metrics

---

**Generated with Claude Code** - Modern SDK generation with React 19, RTK Query, and comprehensive cross-cutting concerns.
