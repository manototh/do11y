---
title: Guide
description: The guide page for do11y integration testing with Docsy.
weight: 10
---

This is the guide page for testing internal navigation tracking with do11y on
the Docsy theme.

## Configuration

Configure the SDK with the following options:

```yaml
apiKey: your-api-key
environment: production
features:
  logging: true
  metrics: true
  tracing: false
```

Or using environment variables:

```bash
export DO11Y_API_KEY="your-api-key"
export DO11Y_ENVIRONMENT="production"
```

## Back to Home

Return to the [homepage]({{< relref "/docs/" >}}).
