---
title: Get started
description: Set up an Axiom account, dataset, and API token before installing Do11y.
head:
  - - meta
    - property: og:title
      content: Get started — Do11y
  - - meta
    - property: og:description
      content: Set up an Axiom account, dataset, and API token before installing Do11y.
---

# Get started

Set up Do11y by following these steps in Axiom and your documentation site:

1. Get Axiom credentials
    - [Create Axiom account](#create-axiom-account)
    - [Create dataset](#create-dataset)
    - [Create API token](#create-api-token)
1. [Add Do11y to your documentation site](#add-do11y-to-your-documentation-site)

## Create Axiom account

[Register a free Axiom account](https://app.axiom.co/register). The free tier is sufficient for the biggest documentation sites.

## Create dataset

Datasets are collections of related events. Do11y sends all behavioral events to the dataset you create in Axiom.

1. In Axiom, click ⚙️ **Settings > Datasets and views**.
1. Click **New dataset**.
1. Name the dataset, and leave the default settings for the other fields.
1. Note the dataset name and the **Edge deployment** field.
1. Click **Save dataset**.

## Determine Axiom domain

Your Axiom domain is where Do11y sends events. It depends on the edge deployment of the dataset you have just created.

| Edge deployment | Axiom domain |
|---|---|
| US East 1 (AWS) | `us-east-1.aws.edge.axiom.co` |
| EU Central 1 (AWS) | `eu-central-1.aws.edge.axiom.co` |

## Create API token

Create an ingest-only token scoped to the dataset you have just created.

1. In Axiom, click ⚙️ **Settings > API Tokens**.
1. Click **New API token**.
1. Name your API token.
1. In the **Dataset Access** section, select **Allow ingest access to specific datasets only** and select the dataset you have created for Do11y. Don't select any other datasets.
1. Click **Create**.
1. Copy the API token that appears and store it securely. It won’t be displayed again.

<details>
<summary>Are ingest-only tokens safe to embed in client-side scripts?</summary>

Ingest-only tokens can write data but cannot read it, which makes them safe to embed in client-side scripts. If someone finds your token in the page source, they can write events to your Do11y dataset but cannot read your data, access other datasets, or do anything else in your Axiom account. The worst-case outcome is noise in a single analytics dataset.
</details>

## Axiom credentials

You now have the three values from Axiom that Do11y needs:

| Value | Example | Config option |
|---|---|---|
| Axiom domain | `us-east-1.aws.edge.axiom.co` | `axiomHost` |
| Dataset name | `my-docs` | `axiomDataset` |
| API token | `xaat-...` | `axiomToken` |

## Add Do11y to your documentation site

You're now ready to add Do11y to your documentation site. Follow the install guide for your documentation framework:

- [Mintlify](/install/mintlify)
- [Docusaurus](/install/docusaurus)
- [Nextra](/install/nextra)
- [VitePress](/install/vitepress)
- [MkDocs Material](/install/mkdocs-material)
- [Other frameworks](/install/manual)

## Further reading

To learn more about Axiom, see these pages in the Axiom documentation:

- [Datasets](https://axiom.co/docs/reference/datasets)
- [Edge deployments](https://axiom.co/docs/reference/edge-deployments)
- [API tokens](https://axiom.co/docs/reference/tokens)
