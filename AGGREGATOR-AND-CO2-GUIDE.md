# Spec Aggregator and CO2 Tracking Guide

## Overview

The OpenAPI SDK Generator now includes two powerful new features:

1. **Spec Aggregator**: Merge multiple OpenAPI specifications into a single unified spec
2. **CO2 Emission Tracking**: Monitor and track the carbon footprint of your API endpoints

## 🔄 Spec Aggregator

### What is it?

The Spec Aggregator allows you to combine multiple OpenAPI specifications into a single consolidated spec. This is useful for:

- Creating unified API gateways
- Combining microservice APIs for documentation
- Merging APIs from different teams or departments
- Creating aggregate APIs for decision-making systems

### How to Use

1. **Upload Multiple Specs**
   - Click "Choose OpenAPI file(s)" and select multiple YAML/JSON files
   - The specs will be stored in your session

2. **Enable Aggregation**
   - Check "Enable Spec Aggregation" in the Spec Aggregator section
   - Configure options:
     - **Aggregated Spec Name**: Name for the unified spec (default: "unified-api")
     - **Download aggregated spec file**: Get the merged spec as a YAML file
     - **Generate SDKs from aggregated spec**: Create SDKs from the unified spec
     - **Show preview in browser**: View the aggregated spec before downloading

3. **Generate**
   - Click "Generate SDK"
   - The system will create an aggregated spec and optionally generate SDKs

### Aggregation Strategy

The aggregator uses intelligent merging strategies:

#### Operations (Endpoints)
- **Duplicate paths**: Operations with the same path and method are merged
- **Parameters**: All unique parameters are combined
- **Request bodies**: Content types are merged
- **Responses**: All response codes are included
- **Metadata**: Tracks which source APIs contributed to each operation

#### Schemas (Data Models)
- **Compatible schemas**: If schemas have the same name and compatible types, properties are merged
- **Incompatible schemas**: If types differ, the second schema is renamed (e.g., `User_ServiceB`)
- **Smart merging**: Object schemas combine all properties; required fields are aggregated

#### Headers
- **Union strategy**: All unique headers from all specs are included
- **Deduplication**: Identical headers are merged into reusable components

### Example

**Before Aggregation:**

```yaml
# users-api.yaml
paths:
  /users:
    get:
      parameters:
        - name: Authorization
          in: header
      responses:
        200:
          description: Success

# orders-api.yaml
paths:
  /orders:
    get:
      parameters:
        - name: Authorization
          in: header
      responses:
        200:
          description: Success
```

**After Aggregation:**

```yaml
# unified-api.yaml
info:
  title: unified-api - Aggregated API
  x-aggregated-from:
    - title: Users API
    - title: Orders API
paths:
  /users:
    get:
      # Combined from users-api
  /orders:
    get:
      # Combined from orders-api
components:
  parameters:
    Authorization:
      # Reusable header parameter
```

## 🌱 CO2 Emission Tracking

### What is it?

CO2 Emission Tracking adds sustainability monitoring to your API endpoints. Each endpoint is annotated with estimated CO2 emissions, and the generated code includes automatic tracking infrastructure.

### How it Works

1. **OpenAPI Extension**: Adds `x-co2-impact` to each operation in the spec
2. **Estimation Algorithm**: Calculates estimated grams of CO2 per request based on:
   - HTTP method (GET < DELETE < POST/PUT)
   - Number of parameters
   - Presence of request body
   - Endpoint complexity

3. **Generated Code**: Creates monitoring infrastructure:
   - `@CO2Tracked` annotation for marking endpoints
   - Interceptor for automatic metric collection
   - Micrometer integration for metrics export
   - Prometheus-ready metrics endpoint

### Enable CO2 Tracking

1. Check "Add CO2 emission annotations" in the Aggregator section
2. Generate SDKs
3. The generated code will include CO2 tracking

### Generated Code Structure

#### Annotation
```java
@CO2Tracked(
    estimatedGrams = 0.25,
    metric = "co2.api.users.list"
)
@GET
@Path("/users")
public Response listUsers() {
    // Your implementation
}
```

#### Metrics Collected
- `api.co2.emissions`: Total CO2 emissions in grams (tagged by operation and status)
- `api.co2.requests`: Number of requests per operation
- `api.co2.duration`: API call duration

#### Accessing Metrics

Metrics are exposed via Prometheus at `/q/metrics`:

```
# HELP api_co2_emissions_total Total CO2 emissions in grams
# TYPE api_co2_emissions_total counter
api_co2_emissions_total{operation="co2.api.users.list",status="success"} 45.5

# HELP api_co2_requests_total Number of requests per operation
# TYPE api_co2_requests_total counter
api_co2_requests_total{operation="co2.api.users.list",status="success"} 182
```

### Understanding CO2 Estimates

The CO2 estimation is based on typical data center energy consumption:

| Operation Type | Base Impact | Notes |
|----------------|-------------|-------|
| GET            | 0.15g       | Lightweight reads |
| POST/PUT       | 0.30g       | Write operations with processing |
| DELETE         | 0.25g       | Delete with validation |
| Per Parameter  | +0.01g      | Additional processing per param |
| Request Body   | +0.10g      | Payload processing overhead |

**Example Calculations:**

```
GET /users (no params)
= 0.1 (base) + 0.05 (GET) = 0.15g

POST /users (5 params + body)
= 0.1 (base) + 0.2 (POST) + 0.05 (5 params) + 0.1 (body) = 0.45g
```

### Monitoring Dashboard

Use Grafana with Prometheus to visualize CO2 metrics:

1. **Total Emissions**: Track cumulative carbon footprint
2. **Per-Endpoint Impact**: Identify high-emission endpoints
3. **Trends**: Monitor emission patterns over time
4. **Efficiency**: Compare emissions vs request volume

### Best Practices

1. **Optimize High-Impact Endpoints**: Focus on endpoints with high emission estimates
2. **Cache Aggressively**: Reduce redundant API calls
3. **Batch Operations**: Combine multiple operations into single requests
4. **Monitor Trends**: Set up alerts for unusual emission spikes
5. **Report Sustainability**: Include CO2 metrics in your API SLOs

## 🎯 Complete Workflow Example

### Scenario: Create a Unified Gateway with CO2 Tracking

1. **Upload Three Microservice APIs**
   ```
   - users-service-api.yaml
   - products-service-api.yaml
   - orders-service-api.yaml
   ```

2. **Configure Aggregation**
   - Name: "gateway-api"
   - Enable CO2 tracking: ✓
   - Download spec: ✓
   - Generate SDKs: ✓

3. **Generate**
   - Result 1: `gateway-api-aggregated.yaml` (downloadable spec)
   - Result 2: Quarkus backend with CO2 tracking
   - Result 3: React SDK for the gateway

4. **Deploy and Monitor**
   - Deploy Quarkus gateway
   - Configure Prometheus scraping
   - View CO2 metrics in Grafana

## 📊 Benefits

### Spec Aggregator
- ✅ Unified API documentation
- ✅ Consistent header handling across services
- ✅ Reduced duplication
- ✅ Better API governance
- ✅ Simplified client integration

### CO2 Tracking
- ✅ Sustainability awareness
- ✅ Carbon footprint reporting
- ✅ Performance optimization insights
- ✅ ESG (Environmental, Social, Governance) compliance
- ✅ Cost optimization (energy = cost)

## 🔧 Configuration Options

### Aggregator Settings

```javascript
{
  name: 'unified-api',              // Name for aggregated spec
  enableCO2Tracking: true,          // Add CO2 annotations
}
```

### OpenAPI Extension

```yaml
x-co2-impact:
  estimatedGramsPerRequest: 0.25    # Estimated CO2 in grams
  trackingEnabled: true              # Enable tracking
  monitoringMetric: "co2.api.users"  # Metric name
```

## 📚 Additional Resources

- [Multi-Spec Guide](./MULTI-SPEC-GUIDE.md) - Using multiple specs with $ref
- [Quarkus Metrics](https://quarkus.io/guides/micrometer) - Micrometer integration
- [Green Software Foundation](https://greensoftware.foundation/) - Carbon-aware computing
- [Prometheus Monitoring](https://prometheus.io/docs/) - Metrics collection

## 🤝 Support

For issues or questions:
- Check console logs for detailed information
- Verify specs are valid OpenAPI 3.0
- Ensure all referenced files are uploaded
- Review aggregated spec preview for conflicts

## 🎉 Summary

The Spec Aggregator and CO2 Tracking features enable:

1. **Better API Management**: Combine multiple specs intelligently
2. **Sustainability**: Track and reduce carbon footprint
3. **Decision Making**: Aggregate data for informed choices
4. **Compliance**: Meet ESG reporting requirements
5. **Optimization**: Identify high-impact operations

**Start creating sustainable, unified APIs today!**
