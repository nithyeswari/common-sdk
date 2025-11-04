# OpenAPI Redux SDK Generator - Project Summary

## Overview
A complete CLI tool that generates Redux-based client SDKs from OpenAPI specifications. The tool creates fully-typed TypeScript code including API clients, Redux actions, reducers, and store configuration.

## Project Structure

```
common-sdk/
├── src/                              # Source code
│   ├── cli.ts                        # CLI entry point with Commander.js
│   ├── generator.ts                  # Main orchestrator for SDK generation
│   ├── types/
│   │   └── index.ts                  # TypeScript type definitions
│   ├── parser/
│   │   └── openapi-parser.ts         # OpenAPI spec parser
│   └── generators/
│       ├── types-generator.ts        # Generates TypeScript types from schemas
│       ├── api-client-generator.ts   # Generates Axios-based API client
│       ├── redux-actions-generator.ts # Generates Redux async thunks
│       ├── redux-reducers-generator.ts # Generates Redux slices and reducers
│       └── redux-store-generator.ts  # Generates store configuration
├── dist/                             # Compiled JavaScript output
├── examples/
│   ├── petstore-api.yaml            # Example OpenAPI specification
│   └── usage-example.tsx            # Example React component usage
├── output/
│   └── petstore-sdk/                # Generated SDK (test output)
│       ├── types.ts                 # Generated TypeScript types
│       ├── client.ts                # Generated API client
│       ├── actions.ts               # Generated Redux actions
│       ├── reducers.ts              # Generated Redux reducers
│       ├── store.ts                 # Generated store configuration
│       ├── index.ts                 # Main export file
│       ├── package.json             # SDK package configuration
│       └── README.md                # SDK usage documentation
├── package.json                     # Project configuration
├── tsconfig.json                    # TypeScript configuration
├── .gitignore                       # Git ignore rules
└── README.md                        # Main documentation

```

## Key Features

### 1. CLI Tool
- Built with Commander.js
- Colorful output using Chalk
- Simple command structure: `generate -i <input> -o <output>`
- Options for module name and base URL customization

### 2. OpenAPI Parser
- Validates and parses OpenAPI 3.0 specifications
- Extracts operations (endpoints) with all details
- Extracts schemas for type generation
- Supports both JSON and YAML formats

### 3. Type Generator
- Converts OpenAPI schemas to TypeScript interfaces
- Handles complex types (unions, intersections, enums)
- Generates parameter types for each operation
- Preserves JSDoc comments from descriptions

### 4. API Client Generator
- Creates Axios-based HTTP client
- Type-safe method signatures
- Authentication support (Bearer tokens)
- Configurable base URL and headers
- Supports path, query, and header parameters
- Request body handling

### 5. Redux Actions Generator
- Creates Redux Toolkit async thunks
- One thunk per API operation
- Fully typed with TypeScript
- Automatic error handling

### 6. Redux Reducers Generator
- Creates Redux slices with loading/error/data states
- Handles pending, fulfilled, and rejected states
- Includes reset actions for state management
- Generates typed selectors for each operation

### 7. Redux Store Generator
- Provides store configuration helpers
- Typed dispatch and state exports
- Support for integration with existing stores
- Optional React-Redux hook helpers

## Generated SDK Structure

### Types (types.ts)
```typescript
export interface Pet {
  id: string;
  name: string;
  tag?: string;
  status?: 'available' | 'pending' | 'sold';
}
```

### Client (client.ts)
```typescript
export class PetstoreClient {
  async listPets(queryParams, config): Promise<AxiosResponse<Pet[]>> {
    // Implementation
  }
}
```

### Actions (actions.ts)
```typescript
export const listPets = createAsyncThunk<Pet[], { limit?: number }>(
  'petstore/listPets',
  async (params) => {
    // Implementation
  }
);
```

### Reducers (reducers.ts)
```typescript
export interface PetstoreState {
  listPets: {
    data: Pet[] | null;
    loading: boolean;
    error: string | null;
  };
  // ... other operations
}
```

### Store (store.ts)
```typescript
export function createPetstoreStore(preloadedState?, additionalReducers?) {
  return configureStore({
    reducer: { petstore: petstoreReducer, ...additionalReducers },
    preloadedState,
  });
}
```

## Usage

### Generate SDK
```bash
# Basic usage
npm run build
node dist/cli.js generate -i examples/petstore-api.yaml -o ./output/my-sdk

# With options
node dist/cli.js generate \
  -i path/to/openapi.yaml \
  -o ./output/api-sdk \
  -n myapi \
  -b https://api.example.com
```

### Use in React App
```typescript
import { useDispatch, useSelector } from 'react-redux';
import { listPets, selectListPetsData } from './sdk';

function MyComponent() {
  const dispatch = useDispatch();
  const pets = useSelector(selectListPetsData);

  useEffect(() => {
    dispatch(listPets({ limit: 10 }));
  }, []);

  return <div>{/* Render pets */}</div>;
}
```

### Direct API Client Usage
```typescript
import { petstoreClient } from './sdk';

const response = await petstoreClient.listPets({ limit: 10 });
console.log(response.data);
```

## Dependencies

### Runtime Dependencies
- `@apidevtools/swagger-parser`: OpenAPI spec parsing and validation
- `commander`: CLI framework
- `chalk`: Terminal styling
- `handlebars`: Template engine
- `fs-extra`: Enhanced file system operations

### Peer Dependencies (for generated SDK)
- `@reduxjs/toolkit`: Redux state management
- `redux`: Core Redux
- `axios`: HTTP client

### Dev Dependencies
- `typescript`: TypeScript compiler
- `openapi-types`: OpenAPI type definitions
- `prettier`: Code formatting

## Technical Highlights

1. **Full TypeScript Support**: Everything is strongly typed
2. **Modular Architecture**: Separate generators for each concern
3. **Error Handling**: Comprehensive error handling throughout
4. **Extensible**: Easy to add new generators or modify existing ones
5. **Production Ready**: Generated code is ready for production use
6. **Documentation**: Auto-generated README for each SDK

## Testing

The project includes a complete example:
- `examples/petstore-api.yaml`: Sample OpenAPI spec
- `examples/usage-example.tsx`: React usage example
- `output/petstore-sdk/`: Generated test output

## Future Enhancements

Potential improvements:
- Support for OpenAPI 2.0 (Swagger)
- Custom templates support
- React Query/SWR generator option
- GraphQL schema support
- SDK versioning and changelog generation
- Unit test generation
- Validation using Zod or Yup
- Mock data generation
- API documentation site generation

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Test with example
node dist/cli.js generate -i examples/petstore-api.yaml -o ./test-output
```

## License
MIT
