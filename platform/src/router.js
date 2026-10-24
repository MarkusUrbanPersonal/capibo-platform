import { createRouter, createWebHashHistory } from 'vue-router'
import { datasetById, datasetByMission, missionById } from '@/data/mock'

// Hash history keeps the static dist/ build deployable on any file host.
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
      crumb: (r) => missionById[datasetById[r.params.id]?.missionId]?.name ?? String(r.params.id),
    },
  },
  { path: '/usage', name: 'usage', component: () => import('@/views/UsageView.vue'), meta: { title: 'Usage' } },
  { path: '/billing', name: 'billing', component: () => import('@/views/BillingView.vue'), meta: { title: 'Billing' } },
  // Auth pages render outside the app shell (see App.vue).
  { path: '/login', name: 'login', component: () => import('@/views/auth/LoginView.vue'), meta: { title: 'Log in', layout: 'auth' } },
  { path: '/signup', name: 'signup', component: () => import('@/views/auth/SignupView.vue'), meta: { title: 'Sign up', layout: 'auth' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

/** Route to a mission's dataset page, or the datasets index if it has no accepted videos yet. */
export function datasetRoute(missionId) {
  const ds = datasetByMission[missionId]
  return ds ? { name: 'dataset-detail', params: { id: ds.id } } : { name: 'datasets' }
}

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  document.title = to.meta.title && to.name !== 'home' ? `${to.meta.title} · Capibo` : 'Capibo Platform'
})

export default router
