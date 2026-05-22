---
title: Analyzing your data
description: How to query and analyze Do11y event data stored in Tinybird.
head:
  - - meta
    - property: og:title
      content: Analyzing your data — Do11y
  - - meta
    - property: og:description
      content: How to query and analyze Do11y event data stored in Tinybird.
---

# Analyzing your data

Once Do11y is sending events to Tinybird, you can query your data using SQL through the Tinybird UI, API, or the Do11y [insights script](/insights).

## Tinybird UI

Open the Tinybird dashboard and navigate to your datasource. You can run SQL queries directly in the UI to explore your data.

## Tinybird API Endpoints (Pipes)

For recurring analysis, create Tinybird Pipes that turn SQL queries into REST API endpoints. This is useful for building custom dashboards or feeding data into other tools.

## AI-powered insights

The fastest way to get actionable recommendations is the [insights script](/insights). It queries your data and produces a prioritized report of what to fix.

## What the data tells you

Each section of your analytics answers a different question about how users experience your docs.

### Traffic and discovery

Where does your audience come from, and what do they find first? The data breaks down traffic by source: search engines, direct visits, social networks, community sites, code hosts, and AI platforms. On the AI-specific queries, you can see which AI platforms are sending users to your docs, which pages they land on, and whether those visitors engage differently from users who arrive through other channels.

### Engagement and page performance

Which pages are actually working? Engagement is measured by three signals: how long users are actively reading, how far down the page they scroll, and a composite engagement score that combines both. Pages with high traffic but low engagement are the clearest candidates for improvement.

### Where users get stuck

Exit pages show where multi-page journeys end. A page that appears often as the last stop before a user leaves may be missing a next step, an explanation, or a link to related content. High search rates are another strong signal. When users search immediately after landing on a page, it usually means the page answers a different question than the one they had in mind.

### Navigation patterns

The page-to-page transition data shows the actual paths users take, which often reveals that certain pages act as hubs or that users jump between sections you would not have expected to be related.

### Code block engagement

Copy events are one of the clearest signals that a user intends to act on what they have read. A page with high views but few code copies may benefit from clearer, more practical examples.

### Reading depth and content structure

Section reading patterns, table of contents usage, and expand/collapse data together paint a picture of how users navigate within a page. Sections that users skip consistently may need to be cut or moved. Pages with heavy table of contents usage suggest users are hunting for something specific and the page structure is not guiding them there.

### User feedback

Pages with the lowest helpful percentage and the most responses are the highest-priority candidates for revision.

## Next steps

- [Run the insights script for automated recommendations](/insights)
- [Example SQL queries](/queries)
