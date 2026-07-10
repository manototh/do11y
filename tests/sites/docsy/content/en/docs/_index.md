---
title: Documentation
linkTitle: Docs
menu: { main: { weight: 20 } }
---

This is the documentation section for the do11y Docsy test site.

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

## Code Examples

### JavaScript

```javascript
import { init } from '@example/sdk';

init({
  apiKey: 'your-api-key',
  environment: 'production',
});
```

### Bash

```bash
npm install @example/sdk
```

### Python

```python
from example_sdk import init

init(
    api_key="your-api-key",
    environment="production",
)
```

## Table

| Feature       | Status | Version |
|---------------|--------|---------|
| Page views    | ✅     | 1.0.0   |
| Link clicks   | ✅     | 1.0.0   |
| Scroll depth  | ✅     | 1.0.0   |
| Search usage  | ✅     | 1.1.0   |
| Code copy     | ✅     | 1.2.0   |

## Navigation

- [Homepage]({{< relref "/" >}}) — internal link for click tracking
- [Docsy website](https://docsy.dev) — external link for outbound tracking
- [Supabase](https://supabase.com) — another external link

## FAQ

<details>
<summary>How do I install the SDK?</summary>

Run `npm install @example/sdk` in your project directory.

</details>

<details>
<summary>What environments are supported?</summary>

The SDK supports Node.js 18+ and all modern browsers.

</details>

<details>
<summary>Is this production ready?</summary>

Yes, the SDK is used in production by thousands of teams worldwide. See our
documentation for best practices.

</details>

## Longer Content for Scroll Depth

This section provides additional content so the page is long enough to trigger
scroll depth tracking at 25%, 50%, 75%, and 90% thresholds.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore
veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed
quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque
porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias
excepturi sint occaecati cupiditate non provident.

Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum
soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime
placeat facere possimus, omnis voluptas assumenda est.

Omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut
rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et
molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias
excepturi sint occaecati cupiditate non provident.
