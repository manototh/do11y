---
title: Insights
description: Get AI-powered recommendations about what to fix in your documentation based on Do11y analytics data.
head:
  - - meta
    - property: og:title
      content: Insights — Do11y
  - - meta
    - property: og:description
      content: Get AI-powered recommendations about what to fix in your documentation based on Do11y analytics data.
---

# Insights

Do11y includes an insights script that analyzes your documentation analytics and produces actionable recommendations about what to fix. It queries your Tinybird data and feeds the aggregated metrics to an LLM that generates a prioritized report.

## Quick start

```bash
TINYBIRD_TOKEN=your-read-token \
OPENAI_API_KEY=sk-... \
npx tsx scripts/insights.ts
```

The script outputs a markdown report with:

- **Top 5 pages to fix** — highest-impact changes based on traffic volume and engagement problems
- **Confusion signals** — pages where users frequently search after landing (suggesting the page doesn't answer their question)
- **Structure problems** — pages with heavy TOC usage (too long or poorly organized)
- **Templates** — high-performing pages to use as models when rewriting underperformers

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TINYBIRD_TOKEN` | Yes | — | Tinybird token with read access |
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `TINYBIRD_HOST` | No | `api.tinybird.co` | Tinybird API host |
| `TINYBIRD_DATASOURCE` | No | `do11y` | Datasource name |
| `OPENAI_MODEL` | No | `gpt-4o` | Model for generating recommendations |
| `DAYS_BACK` | No | `30` | Number of days of data to analyze |

## Running on a schedule

Add to your CI as a weekly GitHub Action:

```yaml
name: Do11y Insights
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am
  workflow_dispatch: {}

jobs:
  insights:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx tsx scripts/insights.ts
        env:
          TINYBIRD_TOKEN: ${{ secrets.TINYBIRD_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Promptless integration

[Promptless](https://promptless.ai) watches triggers and generates documentation update PRs. You can pipe Do11y insights into Promptless to get automatic fix-it PRs:

1. Set up Promptless with your docs repo as the documentation platform
2. Configure an HTTP trigger in your Promptless project
3. Set up a scheduled job (GitHub Action or Tinybird Copy Pipe) that queries the key metrics and sends them to the Promptless HTTP trigger URL
4. Promptless combines the analytics context with its index of your docs to generate targeted improvement PRs

This works well for teams that want documentation fixes to happen automatically without manual triage of the insights report.

## Interpreting metrics

| Metric | Good | Warning |
|---|---|---|
| Avg scroll depth | > 60% | < 25% |
| Avg active time | 30–120s | < 10s |
| Scroll completion (90%+) | > 40% | < 15% |
| Search rate after landing | Low | > 5% (confusion signal) |
| TOC click rate | < 5% | > 15% (page too long or poorly organized) |
| Pages per session | > 3 | 1 (bounce) |
