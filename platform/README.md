# Capibo Platform

Enterprise dashboard for Capibo: plan robot-training data missions with an AI agent, track video collection, browse datasets, and manage usage and billing.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static output in dist/
npm run preview   # serve dist/ at http://localhost:4173
```

The project's `.npmrc` sets `legacy-peer-deps=true`. Without it, npm tries to resolve Vite 8's optional peer chain (`@vitejs/devtools` → vitest → playwright), which can take a very long time on slow connections.

## Stack

- **Vue 3.5** (Composition API, SFCs, JavaScript) and **Vite 8**
- **Tailwind CSS 4** via `@tailwindcss/vite`
- **shadcn-vue** (`new-york-v4` style, reka-ui), installed with the CLI into `src/components/ui`
- **sidebar-08** block: `src/components/AppSidebar.vue`, `NavMain`, `NavProjects`, `NavSecondary`, `NavUser`
- **shadcn-vue charts** (Unovis): `src/components/ui/chart`, used by `src/components/charts/*`
- **assistant-ui Vue** (`@assistant-ui/vue`, `@assistant-ui/core`): the styled registry `thread` lives in `src/components/assistant-ui`. Slash commands follow assistant-ui's slash-command API, ported to Vue in `src/components/assistant/slash` until the Vue binding ships trigger popovers.
- **Toasts**: shadcn/ui Toast (Base UI-style manager) on reka-ui's `createToastManager`. Call `toast.add({ title, description, type })` from `@/components/ui/toast`.
- **vue-router** with hash history, so `dist/` deploys to any static host

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
