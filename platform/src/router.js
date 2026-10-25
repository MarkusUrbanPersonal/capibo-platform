import { createRouter, createWebHistory } from 'vue-router'
import { allMissions } from '@/stores/missions'
import { authReady } from '@/stores/auth'

// HTML5 history for clean URLs. The host must serve index.html for unknown paths (wrangler.jsonc: not_found_handling).
const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: 'Home' } },
  {
    path: '/missions',
    component: () => import('@/views/missions/MissionsLayout.vue'),
    meta: { title: 'Missions' },
    children: [
      { path: '', redirect: { name: 'missions-active' } },
      { path: 'new', name: 'missions-new', component: () => import('@/views/missions/NewMissionView.vue'), meta: { title: 'New mission' } },
      { path: 'active', name: 'missions-active', component: () => import('@/views/missions/MissionListView.vue'), props: { scope: 'active' }, meta: { title: 'Active' } },
      { path: 'completed', name: 'missions-completed', component: () => import('@/views/missions/MissionListView.vue'), props: { scope: 'completed' }, meta: { title: 'Completed' } },
    ],
  },
  {
    path: '/missions/:id',
    name: 'mission-detail',
    component: () => import('@/views/missions/MissionDetailView.vue'),
    meta: { title: 'Mission', parent: { title: 'Missions', to: '/missions' }, crumb: (r) => String(r.params.id) },
  },
  { path: '/datasets', name: 'datasets', component: () => import('@/views/DatasetsView.vue'), meta: { title: 'Datasets' } },
  {
    path: '/datasets/:id',
    name: 'dataset-detail',
    component: () => import('@/views/DatasetDetailView.vue'),
    meta: {
      title: 'Dataset',
      parent: { title: 'Datasets', to: '/datasets' },
      crumb: (r) => allMissions.value.find((m) => m.datasetId === r.params.id)?.name ?? String(r.params.id),
    },
  },
  { path: '/usage', name: 'usage', component: () => import('@/views/UsageView.vue'), meta: { title: 'Usage' } },
  { path: '/billing', name: 'billing', component: () => import('@/views/BillingView.vue'), meta: { title: 'Billing' } },
  // Auth pages render outside the app shell (see App.vue) and are the only public routes.
  { path: '/login', name: 'login', component: () => import('@/views/auth/LoginView.vue'), meta: { title: 'Log in', layout: 'auth', public: true } },
  { path: '/signup', name: 'signup', component: () => import('@/views/auth/SignupView.vue'), meta: { title: 'Sign up', layout: 'auth', public: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

/** Route to a mission's dataset page, or the datasets index if it has no accepted videos yet. */
export function datasetRoute(mission) {
  return mission.datasetId ? { name: 'dataset-detail', params: { id: mission.datasetId } } : { name: 'datasets' }
}

// Old hash-style links (/#/signup) still land on the right page.
if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1))

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// Signed-out visitors land on login and come back afterwards; signed-in ones skip the auth pages.
router.beforeEach(async (to) => {
  const signedIn = await authReady()
  if (!to.meta.public && !signedIn) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
  if (to.meta.public && signedIn) return safeRedirect(to.query.redirect)
})

/** Only same-app paths, so ?redirect= can't send people to another site. */
export function safeRedirect(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/'
}

router.afterEach((to) => {
  document.title = to.meta.title && to.name !== 'home' ? `${to.meta.title} · Capibo` : 'Capibo Platform'
})

export default router
