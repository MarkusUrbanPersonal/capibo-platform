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

To deploy, connect this folder to Mintlify (dashboard → Git settings, monorepo path `/docs`). Every push to `main` deploys.
