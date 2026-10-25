# Capibo Platform

Enterprise dashboard for Capibo: plan robot-training data missions with an AI agent, track video collection, browse datasets, and manage usage and billing.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static output in dist/
npm run preview   # serve dist/ at http://localhost:4173
```

### Backend (Convex)

All data lives in [Convex](https://convex.dev) (`convex/`): auth, organizations, team, API keys, billing, missions, videos, datasets, exports, usage and webhooks.

The app (`npm run dev` via `.env.local`, and `npm run build` via `.env.production`) talks to the **production** deployment (`combative-partridge-288`, HTTP actions at `https://api.capibo.work`). Backend changes go straight there.

First time only (production):

```bash
npx convex login
npm run setup:auth -- --prod                      # session signing keys + SITE_URL
npx convex env set --prod GEMINI_API_KEY <key>    # mission planner model (convex/planner.js)
npx convex deploy                                 # push convex/ (functions + schema)
npx convex run --prod seed:promoCodes             # promo codes (CAL_HACKS, CAPIBO_PILOT, ROBOTICS_LAB)
```

After a change in `convex/`, run `npx convex deploy` and refresh the app. `npx convex dev` still targets the separate dev deployment in `.env.local`'s `CONVEX_DEPLOYMENT`, which the app no longer reads.

- **Auth:** Convex Auth with the email + password provider (`convex/auth.js`). There's no Vue client for Convex Auth, so `src/stores/auth.js` ports the React client's token handling. Every route except `/login` and `/signup` requires a session.
- **Organizations:** signing up creates an organization named after the company field, with you as Owner. If the email has a pending team invite, the new account joins that organization instead. Roles gate writes server-side (`CAN` in `convex/lib/orgs.js`).
- **Mission planner:** `convex/planner.js` asks Gemini to split a goal into 4–6 filmable tasks, each with an icon and tone from `convex/lib/visuals.js`. It falls back across models when one is overloaded, and returns the call's real token usage and cost, which the composer's usage meter shows. The key stays on the deployment.
- **Reading data:** `useQuery(api.module.fn, args)` from `src/lib/convex.js` returns live refs. `src/stores/session.js` holds the current user, organization and permissions.

### REST API

The public API from `docs/openapi.yaml` is served by Convex HTTP actions at `<VITE_CONVEX_SITE_URL>/v1/…`. Routing, auth, scopes and validation are in `convex/lib/rest.js`; data access is in `convex/v1.js`. To serve it at `https://api.capibo.work/v1`, add `api.capibo.work` as a custom domain for the deployment's HTTP actions in the Convex dashboard.

- **Videos** come from the collector app through `/collector/v1/*` on the Convex site URL (`convex/lib/collectorRest.js`, authenticated with the `COLLECTOR_API_SECRET` env var). It calls the internal mutations in `convex/collection.js` (`submitVideo`, then `reviewVideo` with the app's accept/reject verdict), which update counters, charge credits, create the dataset, fire webhooks and complete missions.
- **Exports** produce a JSON manifest (metadata, QA checks and file links) in Convex file storage. Only the `link` destination works; S3, GCS and Hugging Face integrations don't exist yet.

The project's `.npmrc` sets `legacy-peer-deps=true`. Without it, npm tries to resolve Vite 8's optional peer chain (`@vitejs/devtools` → vitest → playwright), which can take a very long time on slow connections.

## Stack

- **Vue 3.5** (Composition API, SFCs, JavaScript) and **Vite 8**
- **Tailwind CSS 4** via `@tailwindcss/vite`
- **shadcn-vue** (`new-york-v4` style, reka-ui), installed with the CLI into `src/components/ui`
- **sidebar-08** block: `src/components/AppSidebar.vue`, `NavMain`, `NavProjects`, `NavSecondary`, `NavUser`
- **shadcn-vue charts** (Unovis): `src/components/ui/chart`, used by `src/components/charts/*`
- **assistant-ui Vue** (`@assistant-ui/vue`, `@assistant-ui/core`): the styled registry `thread` lives in `src/components/assistant-ui`. Slash commands follow assistant-ui's slash-command API, ported to Vue in `src/components/assistant/slash` until the Vue binding ships trigger popovers.
- **Toasts**: shadcn/ui Toast (Base UI-style manager) on reka-ui's `createToastManager`. Call `toast.add({ title, description, type })` from `@/components/ui/toast`.
- **vue-router** with HTML5 history (clean URLs). The static host must fall back to `index.html` for unknown paths; `public/_redirects` does this on Netlify/Cloudflare Pages

## Structure

```
src/
  data/mock.js                 centralized, seeded demo data (all charts/tables derive from it)
  stores/                      missions (incl. planner draft) and UI state
  services/assistant/          mock agent runtime + mission planner and analytics agents
  components/assistant/        provider, thread, composer (slash commands), usage meter, tool UIs
  components/assistant-ui/     assistant-ui registry components (message, markdown, reasoning…)
  components/ui/               shadcn-vue components (CLI-generated)
  views/                       Home, Missions (new/active/completed/detail), Datasets, Usage, Billing
```

## Connecting real APIs later

- **Data:** replace the exports of `src/data/mock.js` with fetches. Every page reads only from that module and `src/stores`.
- **Agents:** `src/services/assistant/index.js` creates a runtime per feature using assistant-ui's documented ExternalStore runtime. To go live, replace it with `AISDKChat({ transport: new AssistantChatTransport({ api }) })` from `@assistant-ui/ai-sdk`, or call your API inside the agent functions. Tool UIs (`propose_tasks`, `estimate_cost`, `dispatch_mission`, …) render whatever tool calls the backend streams.
- **Secrets:** never put API keys in this app. Model and provider credentials belong on the server that the transport calls.

## Notes on generated components

- The shadcn-vue CLI (v2.8.2) can't convert `sidebar`'s `defineProps<SidebarProps>()` to JavaScript, because the type is imported from `index.ts`. So `.registry/sidebar.json` and `.registry/sidebar-08.json` are the official registry items with that one type inlined. They were installed through the CLI with `npx shadcn-vue add ./.registry/<item>.json`.
- The CLI's JavaScript output dropped the imports in `ui/chart/ChartContainer.vue`'s non-setup `<script>`. They were restored to match the registry source.
- The Vue binding of assistant-ui has no built-in slash commands yet. `AssistantComposer.vue` adds a command menu that drives the composer through `aui.composer.setText()` and `send()`.
