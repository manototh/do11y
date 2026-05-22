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

The [**Analyze Do11y data** skill](https://github.com/axiomhq/do11y/blob/main/.cursor/skills/analyze-do11y-data/SKILL.md) turns your Do11y dataset into a prioritized list of documentation improvements. It runs in an AI agent and queries your Axiom dataset directly, checks for instrumentation gaps, and produces a structured audit report.

## Prerequisites

Before running the skill, get these credentials from Axiom using [Get started](/get-started):

- **Dataset:** Axiom dataset where Do11y sends events
- **Domain:** Edge deployment domain

## Create API token with query access

Create an API token with query access to the dataset. This is required to run the audit and it's different from the ingest token you created in [Get started](/get-started).

1. In Axiom, click ⚙️ **Settings > API Tokens**.
1. Click **New API token**.
1. Name your API token.
1. In the **Token permissions** section, click **Advanced**.
1. Uncheck all options selected by default.
1. In the **Individual datasets** section, select the dataset you have created for Do11y. Don't select any other datasets.
1. In the **Query** row of the Do11y dataset, check **Read**.
1. Click **Create**.
1. Copy the API token that appears and store it securely. It won't be displayed again.

## Run the audit

Copy the [**Analyze Do11y data** skill](https://github.com/axiomhq/do11y/blob/main/.cursor/skills/analyze-do11y-data/SKILL.md) into the AI agent and ask it to analyze your docs:

> Analyze my Do11y data. Dataset: `DATASET_NAME`, token: `API_TOKEN`, domain: `DOMAIN`.

Additionally, define the time range for the audit. This is the period of time you want to analyze.

The agent picks up the skill automatically. It queries your dataset, checks for common instrumentation gaps, and returns a report.

## What the report covers

The agent organizes output into seven sections:

1. **Instrumentation gaps:** Flags any tracking issues before interpreting content metrics. This helps you know which findings to trust.
1. **Traffic overview:** Top entry points, section volumes, and traffic source breakdown.
1. **Engagement problems:** High-traffic pages with low scroll depth or active time.
1. **Confusion signals:** Pages where users frequently open search or rely heavily on the TOC.
1. **High-performing content:** Pages with strong completion rates to use as rewrite templates.
1. **Routing issues:** Paths outside the expected URL structure and suspected 404s.
1. **Prioritized actions:** Immediate content changes, short-term redirects, and instrumentation fixes.

For individual APL queries to explore your data on your own, see [Example queries](/queries).
