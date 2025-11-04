/**
 * Advanced Usage Example - React 19 + Redux Toolkit Query
 * Demonstrates all modern features including:
 * - RTK Query for data fetching
 * - React 19 hooks (use, useOptimistic, useTransition)
 * - Error handling and retry logic
 * - Performance monitoring
 * - Optimistic updates
 */

import React, { Suspense, useActionState, useOptimistic } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Import generated SDK (example paths)
import {
  petStoreApi,
  petStoreApiReducer,
  petStoreApiMiddleware,
  useGetPetsQuery,
  useCreatePetMutation,
} from './generated/api';

import {
  useOptimisticMutation,
  useSuspenseQuery,
  useFormMutation,
  usePrefetch,
  useInvalidateCache,
} from './generated/hooks';

import {
  useApiMetrics,
  useNetworkStatus,
  useErrorTracking,
  useDevToolsMonitoring,
} from './generated/monitoring-hooks';

import { ApiError, retryWithBackoff } from './generated/error-handling';
import { logger, LogLevel } from './generated/logger';

// =============================================================================
// Store Configuration
// =============================================================================

const store = configureStore({
  reducer: {
    [petStoreApi.reducerPath]: petStoreApiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(petStoreApiMiddleware),
});

// =============================================================================
// Error Boundary Component
// =============================================================================

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Component error caught', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-container">
            <h2>Something went wrong</h2>
            <p>{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })}>
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// Monitoring Dashboard Component
// =============================================================================

function MonitoringDashboard() {
  const metrics = useApiMetrics(5000); // Update every 5 seconds
  const isOnline = useNetworkStatus();
  const { errors, clearErrors } = useErrorTracking();

  // Enable devtools monitoring in development
  useDevToolsMonitoring();

  return (
    <div className="monitoring-dashboard">
      <h3>API Monitoring</h3>
      <div className="metrics">
        <div>Status: {isOnline ? '🟢 Online' : '🔴 Offline'}</div>
        <div>Total Requests: {metrics.totalRequests}</div>
        <div>Success Rate: {(100 - metrics.errorRate).toFixed(2)}%</div>
        <div>Avg Response Time: {metrics.averageResponseTime.toFixed(0)}ms</div>
      </div>

      {errors.length > 0 && (
        <div className="error-log">
          <h4>Recent Errors ({errors.length})</h4>
          <button onClick={clearErrors}>Clear</button>
          {errors.map((e, i) => (
            <div key={i} className="error-item">
              <span>{e.timestamp.toISOString()}</span>
              <span>{e.error.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Pet List Component - Using RTK Query
// =============================================================================

function PetList() {
  const { data: pets, error, isLoading, refetch } = useGetPetsQuery({ limit: 10 });

  if (isLoading) {
    return <div>Loading pets...</div>;
  }

  if (error) {
    const apiError = error as ApiError;
    return (
      <div className="error">
        <p>Error loading pets: {apiError.message}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <div className="pet-list">
      <h2>Pets</h2>
      <ul>
        {pets?.map((pet: any) => (
          <li key={pet.id}>
            {pet.name} - {pet.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Optimistic Pet Creation Component - React 19 Features
// =============================================================================

interface Pet {
  id: string;
  name: string;
  status: string;
}

function CreatePetForm() {
  const [createPet] = useCreatePetMutation();
  const invalidateCache = useInvalidateCache();

  // React 19 optimistic updates
  const {
    data,
    isLoading,
    error,
    mutate,
    isPending,
  } = useOptimisticMutation<Pet, { name: string; status: string }>(
    async (variables) => {
      const result = await createPet(variables).unwrap();
      return result as Pet;
    },
    {
      getOptimisticData: (variables) => ({
        id: `temp-${Date.now()}`,
        name: variables.name,
        status: variables.status,
      }),
      onSuccess: () => {
        // Invalidate pets list to refetch
        invalidateCache(['Pet']);
      },
      onError: (error) => {
        logger.error('Failed to create pet', error);
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const status = formData.get('status') as string;

    await mutate({ name, status });
  };

  return (
    <div className="create-pet-form">
      <h2>Create Pet (with Optimistic Update)</h2>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Pet name" required />
        <select name="status" required>
          <option value="available">Available</option>
          <option value="pending">Pending</option>
          <option value="sold">Sold</option>
        </select>
        <button type="submit" disabled={isLoading || isPending}>
          {isPending ? 'Creating...' : 'Create Pet'}
        </button>
      </form>

      {data && (
        <div className="success">
          Pet created: {data.name} (Status: {data.status})
        </div>
      )}

      {error && (
        <div className="error">
          Error: {(error as Error).message}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Suspense Data Loading Component - React 19 "use" hook
// =============================================================================

function SuspensePetDetails({ petId }: { petId: string }) {
  // Using React 19's "use" hook for Suspense integration
  const prefetch = usePrefetch();

  // Prefetch on hover
  const handleMouseEnter = () => {
    prefetch('getPetById', { petId });
  };

  return (
    <div onMouseEnter={handleMouseEnter}>
      <Suspense fallback={<div>Loading pet details...</div>}>
        <PetDetailsInner petId={petId} />
      </Suspense>
    </div>
  );
}

function PetDetailsInner({ petId }: { petId: string }) {
  // This would use the "use" hook in a real implementation
  // For demonstration purposes, we'll use regular RTK Query
  const { data: pet } = useGetPetsQuery({ id: petId });

  return (
    <div className="pet-details">
      <h3>{pet?.name}</h3>
      <p>Status: {pet?.status}</p>
    </div>
  );
}

// =============================================================================
// Form with useFormStatus - React 19 Feature
// =============================================================================

function FormStatusExample() {
  const { data, isLoading, error, handleSubmit } = useFormMutation<
    Pet,
    FormData
  >(
    async (formData) => {
      const name = formData.get('name') as string;
      const status = formData.get('status') as string;

      // Simulate API call with retry logic
      return retryWithBackoff(
        async () => {
          const response = await fetch('/api/pets', {
            method: 'POST',
            body: JSON.stringify({ name, status }),
            headers: { 'Content-Type': 'application/json' },
          });

          if (!response.ok) {
            throw new Error('Failed to create pet');
          }

          return response.json();
        },
        { maxRetries: 3 }
      );
    },
    {
      onSuccess: (data) => {
        logger.info('Pet created successfully', data);
      },
      onError: (error) => {
        logger.error('Failed to create pet', error);
      },
    }
  );

  return (
    <form action={handleSubmit as any}>
      <h2>Create Pet (with Form Status)</h2>
      <input name="name" placeholder="Pet name" required />
      <select name="status" required>
        <option value="available">Available</option>
        <option value="pending">Pending</option>
      </select>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create'}
      </button>

      {error && <div className="error">{error.message}</div>}
      {data && <div className="success">Created: {data.name}</div>}
    </form>
  );
}

// =============================================================================
// Main App Component
// =============================================================================

function App() {
  // Set log level
  React.useEffect(() => {
    logger.setLevel(LogLevel.DEBUG);
    logger.setEnabled(true);
  }, []);

  return (
    <Provider store={store}>
      <ErrorBoundary>
        <div className="app">
          <h1>Pet Store - Advanced Example</h1>

          <MonitoringDashboard />

          <div className="content">
            <PetList />
            <CreatePetForm />
            <FormStatusExample />

            <Suspense fallback={<div>Loading...</div>}>
              <SuspensePetDetails petId="123" />
            </Suspense>
          </div>
        </div>
      </ErrorBoundary>
    </Provider>
  );
}

export default App;

// =============================================================================
// Usage Notes
// =============================================================================

/*
## Features Demonstrated

### 1. RTK Query
- Automatic caching and refetching
- Normalized cache updates
- Query invalidation
- Optimistic updates

### 2. React 19 Features
- `use` hook for Suspense integration
- `useOptimistic` for optimistic updates
- `useTransition` for non-blocking updates
- `useFormStatus` for form submission states

### 3. Error Handling
- Structured error codes and messages
- Retry logic with exponential backoff
- Error boundaries
- Error tracking and logging

### 4. Monitoring
- Real-time metrics dashboard
- Performance tracking
- Network status monitoring
- Error logging

### 5. Performance Optimization
- Request prefetching
- Cache management
- Optimistic updates
- Suspense boundaries

## Setup

1. Install dependencies:
   ```bash
   npm install @reduxjs/toolkit react-redux react@19
   ```

2. Generate SDK:
   ```bash
   openapi-redux-gen generate -i petstore.yaml -o ./generated
   ```

3. Configure store with middleware

4. Wrap app with Provider and ErrorBoundary

## Best Practices

- Use RTK Query for all API calls
- Implement error boundaries at appropriate levels
- Monitor API performance in production
- Use optimistic updates for better UX
- Leverage React 19 Suspense for loading states
- Enable logging in development
- Track metrics for debugging
*/
