# Capibo docs

Developer documentation and API reference for [docs.capibo.work](https://docs.capibo.work), built with [Mintlify](https://mintlify.com).

```bash
npm i -g mint
mint dev            # preview at http://localhost:3000
mint broken-links   # check internal links
```

- `docs.json`: site config and navigation
- `openapi.yaml`: the Capibo API spec. The **API reference** tab and its playground are generated from it.
- `*.mdx`: guide pages. Webhook event pages in `api-reference/events/` are generated from the spec's `webhooks` section.

## Deploying

This folder lives in the main `calhacks` repo and is published, on its own, to [capibo-docs](https://github.com/MarkusUrbanPersonal/capibo-docs), which Mintlify deploys from. After committing changes in `calhacks`, run this from the `calhacks` root:

```bash
git subtree push --prefix docs docs main
```

Edit the docs in `calhacks`, not in `capibo-docs`, or the next push will be rejected.
