---
title: Audit docs with AI agent
description: How to use an AI agent to audit documentation usage, find underperforming pages, and get prioritized improvement recommendations.
head:
  - - meta
    - property: og:title
      content: Audit docs with AI agent — Do11y
  - - meta
    - property: og:description
      content: How to use an AI agent to audit documentation usage, find underperforming pages, and get prioritized improvement recommendations.
---

# Audit docs with AI agent

The [**Analyze Do11y data** skill](https://github.com/manototh/docservable/blob/main/.cursor/skills/analyze-do11y-data/SKILL.md) turns your Do11y datasource into a prioritized list of documentation improvements. It runs in an AI agent and queries your Tinybird datasource directly, checks for instrumentation gaps, and produces a structured audit report.

## Prerequisites

Before running the skill, get these credentials from Tinybird using [Get started](/get-started):

- **Datasource:** Tinybird datasource where Do11y sends events
- **Host:** Tinybird API host (e.g. `api.tinybird.co`)

## Create a read token

Create a Tinybird token with read access to the datasource. This is different from the append-only token used for ingestion.

1. In Tinybird, go to **Tokens**.
2. Click **Create Token**.
3. Give it a name like `do11y-read`.
4. Under scopes, select **DATASOURCE:READ** and choose your datasource.
5. Copy the token.

## Run the audit

Copy the [**Analyze Do11y data** skill](https://github.com/manototh/docservable/blob/main/.cursor/skills/analyze-do11y-data/SKILL.md) into the AI agent and ask it to analyze your docs:

> Analyze my Do11y data. Datasource: `do11y`, token: `TOKEN`, host: `api.tinybird.co`.

Additionally, define the time range for the audit.

The agent picks up the skill automatically. It queries your datasource, checks for common instrumentation gaps, and returns a report.

## What the report covers

The agent organizes output into seven sections:

1. **Instrumentation gaps:** Flags any tracking issues before interpreting content metrics. This helps you know which findings to trust.
1. **Traffic overview:** Top entry points, section volumes, and traffic source breakdown.
1. **Engagement problems:** High-traffic pages with low scroll depth or active time.
1. **Confusion signals:** Pages where users frequently open search or rely heavily on the TOC.
1. **High-performing content:** Pages with strong completion rates to use as rewrite templates.
1. **Routing issues:** Paths outside the expected URL structure and suspected 404s.
1. **Prioritized actions:** Immediate content changes, short-term redirects, and instrumentation fixes.

For individual SQL queries to explore your data on your own, see [Example queries](/queries).

## Alternative: Insights script

For a quick automated report without needing to run an agent interactively, use the [insights script](/insights). It queries the same metrics and generates recommendations using an LLM.
