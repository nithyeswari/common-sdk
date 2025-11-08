# Multi-Spec OpenAPI Support Guide

## 🎯 Overview

The OpenAPI Redux SDK Generator now supports generating SDKs from OpenAPI specifications that span multiple files using `$ref` references. This is essential for large API projects where schemas, parameters, and responses are shared across multiple APIs.

## ✨ Features

- ✅ **Automatic Reference Resolution**: Upload multiple YAML/JSON files and the generator automatically resolves all `$ref` references
- ✅ **External File Support**: References like `$ref: './common-schemas.yaml#/components/schemas/Error'` are fully supported
- ✅ **Smart Bundling**: The generator bundles all files into a single coherent specification before generating SDKs
- ✅ **Type Preservation**: All referenced types are properly included in the generated TypeScript types
- ✅ **Header Support**: Works seamlessly with header parameters, query params, path params, etc.
- ✅ **Full Stack**: Generate React + Spring Boot + Quarkus SDKs from multi-file specs

## 🚀 Quick Start

### Web UI

1. Visit https://cleverli.web.app
2. Click **"Choose OpenAPI file(s)"**
3. Select multiple files (Ctrl+Click or Cmd+Click):
   - Select the **main API spec first**
   - Then select all referenced files
4. The UI will show: `3 files selected: products-api.yaml (main) + 2 more`
5. Choose SDK types and configure options
6. Click **"Generate SDK"**
7. The generator will:
   - Read all files
   - Resolve external `$ref` references
   - Bundle into a single spec
   - Generate SDKs with all types included

### Example Usage

Given these files:

```
common-schemas.yaml       <- Shared components
products-api.yaml         <- Main API (references common)
orders-api.yaml          <- Another API (also references common)
```

**To generate Products SDK:**
1. Select `products-api.yaml` **first**
2. Then select `common-schemas.yaml`
3. Generate!

**To generate Orders SDK:**
1. Select `orders-api.yaml` **first**
2. Then select `common-schemas.yaml`
3. Generate!

## 📁 Project Structure Examples

### Pattern 1: Central Common File

```
my-api/
├── common/
│   └── schemas.yaml          # Shared: Error, User, Pagination, Money, etc.
├── products-api.yaml         # Products API (refs common/schemas.yaml)
├── orders-api.yaml           # Orders API (refs common/schemas.yaml)
└── users-api.yaml            # Users API (refs common/schemas.yaml)
```

### Pattern 2: Domain-Driven

```
my-api/
├── common/
│   ├── errors.yaml           # Error schemas
│   ├── auth.yaml             # Auth schemas & params
│   └── pagination.yaml       # Pagination schemas
├── products/
│   ├── api.yaml              # Main products API
│   └── schemas.yaml          # Product-specific schemas
└── orders/
    ├── api.yaml              # Main orders API
    └── schemas.yaml          # Order-specific schemas
```

### Pattern 3: Microservices

```
apis/
├── shared/
│   ├── common-types.yaml     # Base types
│   ├── common-errors.yaml    # Error responses
│   └── common-auth.yaml      # Auth components
├── service-a/
│   └── openapi.yaml          # Service A (refs shared/*)
├── service-b/
│   └── openapi.yaml          # Service B (refs shared/*)
└── service-c/
    └── openapi.yaml          # Service C (refs shared/*)
```

## 🔗 Reference Syntax

### External File References

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

### Parameter References

```yaml
# In products-api.yaml
paths:
  /products:
    get:
      parameters:
        - $ref: './common-schemas.yaml#/components/parameters/AuthorizationHeader'
        - $ref: './common-schemas.yaml#/components/parameters/PageParam'
```

### Response References

```yaml
# In products-api.yaml
paths:
  /products:
    get:
      responses:
        '401':
          $ref: './common-schemas.yaml#/components/responses/UnauthorizedError'
        '404':
          $ref: './common-schemas.yaml#/components/responses/NotFoundError'
```

### Nested References

```yaml
# common-schemas.yaml defines UserInfo
components:
  schemas:
    UserInfo:
      properties:
        address:
          $ref: '#/components/schemas/Address'  # Internal ref

# products-api.yaml uses UserInfo
components:
  schemas:
    Product:
      properties:
        createdBy:
          $ref: './common-schemas.yaml#/components/schemas/UserInfo'  # External ref
          # Address is automatically resolved from UserInfo
```

## 📊 What Gets Generated

### TypeScript Types

All referenced schemas are included:

```typescript
// From common-schemas.yaml
export interface Error {
  code: string;
  message: string;
  details?: any;
  timestamp?: string;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface Money {
  amount: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY';
}

// From products-api.yaml (uses above types)
export interface Product {
  id: string;
  name: string;
  price: Money;           // <- Resolved from common
  createdBy: UserInfo;    // <- Resolved from common
}
```

### React API Hooks

```typescript
import { productsApi } from './api';

// All parameters including those from common-schemas.yaml
const { data, error, isLoading } = productsApi.useListProductsQuery({
  // Headers from common-schemas.yaml
  Authorization: 'Bearer token',
  'X-Request-ID': uuid(),

  // Pagination from common-schemas.yaml
  page: 1,
  pageSize: 20,

  // Local parameters
  category: 'electronics',
});

// Response includes PaginationInfo from common-schemas.yaml
// data.pagination.totalPages, data.pagination.page, etc.
```

### Spring Boot Controllers

```java
@RestController
@RequestMapping("/api/products")
public class ProductsController {

    @GetMapping
    public ResponseEntity<?> listProducts(
        // Headers from common-schemas.yaml
        @RequestHeader(value="Authorization", required=true) String authorization,
        @RequestHeader(value="X-Request-ID", required=false) String requestId,

        // Pagination from common-schemas.yaml
        @RequestParam(required=false) Integer page,
        @RequestParam(required=false) Integer pageSize,

        // Local parameters
        @RequestParam(required=false) String category
    ) {
        // Implementation
    }
}
```

### Quarkus Resources

```java
@Path("/api/products")
@Produces(MediaType.APPLICATION_JSON)
public class ProductsResource {

    @GET
    public Response listProducts(
        // Headers from common-schemas.yaml
        @HeaderParam("Authorization") String authorization,
        @HeaderParam("X-Request-ID") String requestId,

        // Pagination from common-schemas.yaml
        @QueryParam("page") Integer page,
        @QueryParam("pageSize") Integer pageSize,

        // Local parameters
        @QueryParam("category") String category
    ) {
        // Implementation
    }
}
```

## 🎓 Best Practices

### 1. Organize Common Components

```yaml
# common-schemas.yaml
components:
  # Group by category
  schemas:
    # Error types
    Error: { ... }
    ValidationError: { ... }

    # User types
    UserInfo: { ... }
    UserProfile: { ... }

    # Utility types
    Money: { ... }
    Address: { ... }
    PaginationInfo: { ... }

  # Reusable parameters
  parameters:
    AuthorizationHeader: { ... }
    RequestIDHeader: { ... }
    PageParam: { ... }
    PageSizeParam: { ... }

  # Standard responses
  responses:
    UnauthorizedError: { ... }
    NotFoundError: { ... }
    ValidationError: { ... }
```

### 2. Use Consistent Naming

```yaml
# Good: Clear, consistent naming
$ref: './common-schemas.yaml#/components/schemas/UserInfo'
$ref: './common-schemas.yaml#/components/parameters/AuthorizationHeader'
$ref: './common-schemas.yaml#/components/responses/NotFoundError'

# Avoid: Inconsistent or unclear naming
$ref: './stuff.yaml#/components/schemas/user'
$ref: './things.yaml#/components/parameters/auth'
```

### 3. Document Cross-References

```yaml
# products-api.yaml
info:
  title: Products API
  description: |
    Products management API

    **External Dependencies:**
    - common-schemas.yaml: Error types, UserInfo, Money, Pagination
```

### 4. Version Your Common Schemas

```
common/
├── v1/
│   └── schemas.yaml
└── v2/
    └── schemas.yaml

products-api-v1.yaml -> refs common/v1/schemas.yaml
products-api-v2.yaml -> refs common/v2/schemas.yaml
```

### 5. Test References Locally

Before generating, validate your multi-file spec:

```bash
# Install swagger-cli
npm install -g @apidevtools/swagger-cli

# Validate the bundled spec
swagger-cli validate products-api.yaml

# Bundle and view resolved spec
swagger-cli bundle products-api.yaml -o bundled.yaml --dereference
cat bundled.yaml
```

## 🐛 Troubleshooting

### Issue: "Could not resolve external reference"

**Cause**: Referenced file not uploaded or path incorrect

**Solution**:
- Make sure all referenced files are selected
- Use `./` prefix for same directory: `./common-schemas.yaml`
- Check file names match exactly (case-sensitive)

### Issue: Types are missing or incorrect

**Cause**: Main spec not selected first

**Solution**:
- Always select the main API spec **first**
- Other files are treated as dependencies

### Issue: Circular reference error

**Cause**: Schema A references B, and B references A

**Solution**:
- Restructure schemas to avoid circular dependencies
- Use one-way references only
- Consider using discriminators or allOf

### Issue: Nested refs not resolving

**Cause**: Deep nesting of external references

**Solution**:
- The bundler supports multiple levels of nesting
- Ensure all intermediate files are uploaded
- Check console for specific error messages

## 📚 Example Projects

### Complete Working Example

See `examples/multi-spec/` for a complete working example:

```
examples/multi-spec/
├── common-schemas.yaml    # 300+ lines of shared components
├── products-api.yaml      # Products API with 5 endpoints
├── orders-api.yaml        # Orders API with 3 endpoints
└── README.md             # Detailed documentation
```

**Try it yourself:**

1. Download all three files from `examples/multi-spec/`
2. Go to https://cleverli.web.app
3. Upload all three files (products-api.yaml first)
4. Generate SDKs for React, Spring Boot, or Quarkus
5. Explore the generated code

### What You'll See

**common-schemas.yaml provides:**
- Error, UserInfo, PaginationInfo, Address, Money schemas
- Auth headers, pagination parameters
- Standard error responses

**products-api.yaml generates:**
- Product CRUD endpoints
- Types for Product, CreateProductRequest, UpdateProductRequest
- All common types included

**orders-api.yaml generates:**
- Order management endpoints
- Types for Order, OrderItem, CreateOrderRequest
- All common types included
- Can reference Product types if needed

## 🔄 Migration Guide

### From Single File to Multi-File

**Before:**

```yaml
# monolithic-api.yaml (1000+ lines)
openapi: 3.0.0
info:
  title: My API
paths:
  /products: { ... }
  /orders: { ... }
  /users: { ... }
components:
  schemas:
    Error: { ... }
    User: { ... }
    Product: { ... }
    Order: { ... }
    # 50+ more schemas...
```

**After:**

```yaml
# common-schemas.yaml (200 lines)
components:
  schemas:
    Error: { ... }
    User: { ... }
    Money: { ... }
    Pagination: { ... }

# products-api.yaml (300 lines)
openapi: 3.0.0
info:
  title: Products API
paths:
  /products: { ... }
components:
  schemas:
    Product:
      properties:
        createdBy:
          $ref: './common-schemas.yaml#/components/schemas/User'

# orders-api.yaml (250 lines)
openapi: 3.0.0
info:
  title: Orders API
paths:
  /orders: { ... }
components:
  schemas:
    Order:
      properties:
        customer:
          $ref: './common-schemas.yaml#/components/schemas/User'
```

**Benefits:**
- ✅ Easier to maintain
- ✅ Better team collaboration (no merge conflicts)
- ✅ Reusable components
- ✅ Clearer API boundaries

## 🤝 Support

- 🌐 **Web App**: https://cleverli.web.app
- 💰 **Donate**: https://www.paypal.com/paypalme/acommunitybookshop
- 📖 **Examples**: See `examples/multi-spec/` directory
- 🐛 **Issues**: Report any problems with multi-spec support

## 🎉 Summary

Multi-spec support enables:

1. **Better Organization**: Split large specs into logical files
2. **Reusability**: Share common schemas across multiple APIs
3. **Team Collaboration**: Multiple people can work on different files
4. **Maintainability**: Update once, reflect everywhere
5. **Scalability**: Add new APIs without duplicating common types

**Try it today at https://cleverli.web.app!**
