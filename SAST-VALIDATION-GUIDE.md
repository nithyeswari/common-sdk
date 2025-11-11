# OpenAPI SAST Validation Guide

## Overview

This guide explains how to use Static Application Security Testing (SAST) to validate CO2 emission tracking and API call tracking in your OpenAPI specifications.

## Why SAST for API Specs?

SAST tools analyze your OpenAPI specifications at build time to ensure:

1. **CO2 Emission Tracking**: All endpoints have carbon footprint estimates
2. **API Call Tracking**: Proper logging and monitoring is configured
3. **Compliance**: Thresholds and required extensions are enforced
4. **Quality**: Consistent standards across all API specs

## Tools Used

### 1. Spectral (OpenAPI Linting)
Spectral is an open-source OpenAPI linter that validates specs against custom rules.

### 2. JSON Schema Validation
Custom JSON schemas validate the structure of OpenAPI extensions.

### 3. Custom Validators
Standalone scripts for threshold checking and coverage analysis.

## Quick Start

### Installation

```bash
# Install Spectral globally
npm install -g @stoplight/spectral-cli

# Install validation dependencies
npm install js-yaml glob ajv-cli ajv-formats
```

### Validate a Single Spec

```bash
# Using Spectral
spectral lint your-api-spec.yaml --ruleset .spectral.yaml

# Using custom validator
node sast-validators/validate-openapi.js your-api-spec.yaml
```

### Validate All Specs

```bash
# Find and validate all OpenAPI specs
find . -name "*.yaml" -not -path "*/node_modules/*" | while read spec; do
  spectral lint "$spec" --ruleset .spectral.yaml
done
```

## Validation Rules

### CO2 Emission Tracking Rules

#### 1. **co2-impact-required** (Warning)
All endpoints should have `x-co2-impact` extension for carbon monitoring.

```yaml
paths:
  /api/users:
    get:
      x-co2-impact:
        enabled: true
        estimatedGramsPerRequest: 25
        calculationMethod: cloud-carbon-coefficients
```

#### 2. **co2-impact-threshold** (Error)
CO2 impact must not exceed 50g per request.

```yaml
# ❌ FAILS - exceeds threshold
x-co2-impact:
  estimatedGramsPerRequest: 75

# ✅ PASSES
x-co2-impact:
  estimatedGramsPerRequest: 30
```

#### 3. **co2-tracking-enabled** (Error)
CO2 tracking must be explicitly enabled.

```yaml
x-co2-impact:
  enabled: true  # Required
```

#### 4. **co2-method-specified** (Warning)
Calculation method must be one of:
- `cloud-carbon-coefficients`
- `green-web-foundation`
- `custom`

#### 5. **Mitigation Strategies** (Error for high CO2)
Endpoints with CO2 > 30g must specify mitigation strategies:

```yaml
x-co2-impact:
  estimatedGramsPerRequest: 40
  mitigationStrategies:
    - caching
    - compression
    - cdn
```

### API Call Tracking Rules

#### 1. **api-call-tracking-required** (Error)
All consolidated endpoints MUST have `x-api-call-tracking`.

```yaml
paths:
  /api/aggregated:
    post:
      x-consolidation:
        type: 2-to-1
      x-api-call-tracking:  # Required for consolidated endpoints
        enabled: true
```

#### 2. **api-tracking-correlation-id** (Error)
API tracking must group by `correlationId`.

```yaml
x-api-call-tracking:
  groupBy: ['correlationId', 'apiName']  # Must include correlationId
```

#### 3. **api-tracking-method** (Error)
Implementation method must be `logging` or `metrics`.

```yaml
x-api-call-tracking:
  implementation:
    method: logging  # or 'metrics'
```

#### 4. **api-tracking-log-format** (Error)
Logging method requires log format template.

```yaml
x-api-call-tracking:
  implementation:
    method: logging
    logFormat:
      template: 'API_CALL | correlation_id={correlationId} | api_name={apiName}'
```

#### 5. **correlation-id-header** (Error)
Must specify correlation ID header (typically `X-Correlation-ID`).

```yaml
x-api-call-tracking:
  implementation:
    correlationIdHeader: X-Correlation-ID
```

#### 6. **prometheus-metrics-enabled** (Warning)
Prometheus metrics should be enabled for production.

```yaml
x-api-call-tracking:
  implementation:
    metrics:
      enabled: true
      endpoint: /metrics
```

### Combined Rules

#### **consolidation-tracking** (Warning)
Consolidated endpoints should have BOTH CO2 and API tracking.

```yaml
paths:
  /api/consolidated:
    post:
      x-consolidation:
        type: 2-to-1
      x-co2-impact:       # Both required
        enabled: true
      x-api-call-tracking:
        enabled: true
```

## Configuration Thresholds

Edit `.spectral.yaml` to customize thresholds:

```yaml
rules:
  co2-impact-threshold:
    given: $.paths.*[get,post,put,patch,delete].x-co2-impact.estimatedGramsPerRequest
    then:
      function: pattern
      functionOptions:
        match: "^([0-9]|[1-4][0-9]|50)$"  # Change 50 to your threshold
```

Environment variables for custom validator:

```bash
export CO2_THRESHOLD=50
export CO2_WARNING_THRESHOLD=30
export MINIMUM_TRACKING_COVERAGE=80
export FAIL_ON_WARNINGS=false
```

## CI/CD Integration

### GitHub Actions

The `.github/workflows/openapi-sast.yml` workflow runs automatically on:
- Push to `master`, `main`, `develop`
- Pull requests
- Manual trigger

**Jobs:**
1. **spectral-lint**: Validates OpenAPI structure and extensions
2. **schema-validation**: JSON Schema validation of extensions
3. **co2-threshold-check**: Enforces CO2 limits
4. **api-tracking-coverage**: Checks tracking coverage

**Usage:**
```bash
# Workflow runs automatically
# Or trigger manually from Actions tab
```

### GitLab CI

The `.gitlab-ci.yml` pipeline includes:

**Stages:**
1. **validate**: Spectral and schema validation
2. **test**: CO2 and tracking checks
3. **report**: Generate combined report

**Usage:**
```bash
# Runs automatically on push
# View reports in Pipeline > Artifacts
```

### Local Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "Running OpenAPI SAST validation..."

# Find modified YAML files
SPECS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(yaml|yml)$')

if [ -z "$SPECS" ]; then
  echo "No OpenAPI specs modified"
  exit 0
fi

# Validate each spec
for spec in $SPECS; do
  echo "Validating $spec..."
  spectral lint "$spec" --ruleset .spectral.yaml || exit 1
done

echo "✅ All specs passed validation"
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Validation Reports

### Spectral Report Format

```bash
# Generate JSON report
spectral lint api-spec.yaml --ruleset .spectral.yaml --format json > report.json

# Generate HTML report
spectral lint api-spec.yaml --ruleset .spectral.yaml --format html > report.html

# Generate JUnit report (for CI)
spectral lint api-spec.yaml --ruleset .spectral.yaml --format junit > report.xml
```

### Custom Report

```bash
# CO2 emissions report
node sast-validators/validate-openapi.js api-spec.yaml > co2-report.txt

# Export as JSON
CO2_THRESHOLD=40 node sast-validators/validate-openapi.js api-spec.yaml --json > report.json
```

## Best Practices

### 1. Run Validation Early
```bash
# In package.json
{
  "scripts": {
    "validate": "spectral lint **/*.yaml --ruleset .spectral.yaml",
    "precommit": "npm run validate",
    "prebuild": "npm run validate"
  }
}
```

### 2. Set Appropriate Thresholds

- **Development**: Warnings only, no hard failures
- **Staging**: Enforce consolidated endpoint tracking
- **Production**: Full enforcement, fail on errors

### 3. Track Coverage Over Time

```bash
# Generate coverage report
node sast-validators/validate-openapi.js --all --coverage > coverage.json

# Track in CI metrics
```

### 4. Document Exceptions

For endpoints that genuinely can't meet thresholds:

```yaml
paths:
  /api/heavy-operation:
    post:
      x-co2-impact:
        estimatedGramsPerRequest: 80  # Exceeds threshold
        exception:
          reason: "Large batch processing required for business logic"
          approvedBy: "Architecture Review Board"
          date: "2025-01-15"
        mitigationStrategies:
          - batch-processing
          - async-execution
```

## Troubleshooting

### "Module not found" Errors

```bash
npm install js-yaml glob
```

### Spectral Not Found

```bash
npm install -g @stoplight/spectral-cli
```

### Custom Rules Not Working

Check `.spectral.yaml` syntax:
```bash
spectral lint --ruleset .spectral.yaml --print-ruleset
```

### False Positives

Disable specific rules per-file using comments:

```yaml
# spectral:disable co2-impact-required
paths:
  /health:
    get:
      summary: Health check endpoint (no CO2 tracking needed)
```

## Integration with Code Generators

The SAST validation ensures metadata is present in specs. Code generators (Java/Quarkus) should:

1. **Read Extensions**: Parse `x-co2-impact` and `x-api-call-tracking`
2. **Generate Logging**: Create log statements based on `logFormat.template`
3. **Add Metrics**: Generate Prometheus metrics counters
4. **Propagate Headers**: Ensure `X-Correlation-ID` is forwarded

**Example Generated Java Code:**

```java
@Path("/api/aggregated")
public class AggregatedResource {

    private static final Logger log = LoggerFactory.getLogger(AggregatedResource.class);

    @POST
    @Timed(name = "api_call_duration")
    public Response aggregate(@HeaderParam("X-Correlation-ID") String correlationId) {
        // Log API call with structured format
        log.info("API_CALL | correlation_id={} | api_name={} | method={} | path={}",
                 correlationId, "AggregatedAPI", "POST", "/api/aggregated");

        // Business logic...

        return Response.ok().build();
    }
}
```

## FAQ

### Q: Do I need annotations for CO2 calculations?
**A:** No. CO2 emission calculations happen at runtime through monitoring tools. The OpenAPI extension just provides estimated metadata.

### Q: Can I use this with Swagger/OpenAPI 2.0?
**A:** The extensions work with both OpenAPI 3.x and Swagger 2.0, but Spectral rules are optimized for OpenAPI 3.x.

### Q: What if my spec doesn't have consolidated endpoints?
**A:** The validation is flexible. Only endpoints with `x-consolidation` require tracking. Regular endpoints get warnings, not errors.

### Q: Can I run this offline?
**A:** Yes. Spectral and all validators work offline once dependencies are installed.

## Resources

- [Spectral Documentation](https://stoplight.io/open-source/spectral)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [JSON Schema](https://json-schema.org/)
- [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
- [Cloud Carbon Footprint](https://www.cloudcarbonfootprint.org/)

## Support

For issues or questions:
1. Check [troubleshooting](#troubleshooting) section
2. Review CI/CD logs for detailed error messages
3. Validate JSON Schema syntax at [jsonschemavalidator.net](https://www.jsonschemavalidator.net/)
