<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { toast } from '@/components/ui/toast'
import { Building2, Users, KeyRound, Archive, Copy, Plus, MoreHorizontal, Trash2 } from '@lucide/vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@convex/_generated/api'
import { ui } from '@/stores/ui'
import { can, organization } from '@/stores/session'
import { convex, errorMessage, useQuery } from '@/lib/convex'
import { formatDate, relativeTime } from '@/lib/format'

const SECTIONS = [
  { id: 'organization', label: 'Organization', icon: Building2, description: 'Name, identifiers and plan.' },
  { id: 'team', label: 'Team members', icon: Users, description: 'Invite people and manage their roles.' },
  { id: 'api-keys', label: 'API keys', icon: KeyRound, description: 'Keys for the Capibo REST API. Keys are shown once at creation.' },
  { id: 'retention', label: 'Data retention', icon: Archive, description: 'How long Capibo keeps raw and derived data.' },
]
const ROLES = ['Owner', 'Admin', 'Data engineer', 'Developer', 'Billing', 'Viewer']
// API key scopes, narrowest first (docs/authentication.mdx#scopes).
const KEY_SCOPES = ['Read datasets', 'Read only', 'Full access']

const current = computed(() => SECTIONS.find((s) => s.id === ui.settingsSection) ?? SECTIONS[0])

// Organization and retention are edited as drafts, refreshed from the server each time the dialog opens.
const org = reactive({ name: '', website: '', contact: '' })
const retention = reactive({ raw: '365', rejected: '30', derived: 'forever', autoDelete: true })
watch(
  () => ui.settingsOpen && organization.value,
  (o) => {
    if (!o) return
    Object.assign(org, { name: o.name, website: o.website, contact: o.contact })
    const { raw, rejected, derived, autoDelete } = o.retention
    Object.assign(retention, { raw, rejected, derived, autoDelete })
  },
  { immediate: true },
)

const live = () => (ui.settingsOpen ? {} : 'skip')
const { data: team } = useQuery(api.team.list, live)
const { data: keys } = useQuery(api.apiKeys.list, live)

const invite = reactive({ email: '', role: 'Developer' })
const newKeyName = ref('')
const newKeyScope = ref('Read datasets')
const createdSecret = ref(null) // { name, secret }, shown once after creating a key
const busy = ref('')

/** Runs a Convex call, toasting the server's message if it fails. Returns undefined on failure. */
async function run(key, call) {
  busy.value = key
  try {
    return (await call()) ?? true
  } catch (e) {
    toast.add({ title: errorMessage(e), type: 'error' })
  } finally {
    busy.value = ''
  }
}

async function saveOrganization() {
  if (await run('org', () => convex.mutation(api.account.updateOrganization, { ...org }))) {
    toast.add({ title: 'Organization details saved', type: 'success', description: 'Changes apply to your whole organization.' })
  }
}

async function saveRetention() {
  if (await run('retention', () => convex.mutation(api.account.updateRetention, { ...retention }))) {
    toast.add({ title: 'Retention policy saved', type: 'success', description: 'Changes apply to your whole organization.' })
  }
}

function copy(text, label) {
  navigator.clipboard?.writeText(text).catch(() => {})
  toast.add({ title: `${label} copied to clipboard` })
}

async function sendInvite() {
  const email = invite.email.trim()
  if (await run('invite', () => convex.mutation(api.team.invite, { email, role: invite.role }))) {
    toast.add({ title: 'Invitation saved', type: 'success', description: `${email} joins as ${invite.role} when they sign up with this email.` })
    invite.email = ''
  }
}

async function setRole(m, role) {
  if (await run(`role:${m.id}`, () => convex.mutation(api.team.setRole, { memberId: m.id, role }))) {
    toast.add({ title: `${m.name} is now ${role}` })
  }
}

async function removeMember(m) {
  if (await run(`remove:${m.id}`, () => convex.mutation(api.team.remove, { memberId: m.id }))) {
    toast.add({ title: `${m.name} removed from ${org.name}` })
  }
}

async function createKey() {
  const name = newKeyName.value.trim() || 'Untitled key'
  const result = await run('key', () => convex.action(api.apiKeys.create, { name, scope: newKeyScope.value }))
  if (result) {
    createdSecret.value = { name, secret: result.secret }
    newKeyName.value = ''
  }
}

async function revokeKey(k) {
  if (await run(`revoke:${k.id}`, () => convex.mutation(api.apiKeys.revoke, { keyId: k.id }))) {
    toast.add({ title: `Key “${k.name}” revoked` })
  }
}

function initials(name) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : parts[0]?.[1] ?? '')).toUpperCase()
}

function lastActive(m) {
  if (m.isYou) return 'Now'
  if (m.pending) return 'Invited'
  return m.lastActiveAt ? relativeTime(m.lastActiveAt, new Date()) : '—'
}

</script>

<template>
  <Dialog v-model:open="ui.settingsOpen">
    <DialogContent class="overflow-hidden p-0 sm:max-w-[920px] md:max-h-[640px]">
      <DialogTitle class="sr-only">Settings</DialogTitle>
      <DialogDescription class="sr-only">Organization settings for {{ organization?.name }}</DialogDescription>
      <div class="flex h-[min(640px,85vh)] min-w-0 flex-col md:flex-row">
        <!-- Section navigation -->
        <nav aria-label="Settings sections" class="min-w-0 shrink-0 border-b bg-sidebar p-2 pr-12 md:w-56 md:border-r md:border-b-0 md:p-3">
          <div class="hidden px-2 pb-3 pt-1 md:block">
            <div class="text-sm font-semibold">Settings</div>
            <div class="truncate text-xs text-muted-foreground">{{ organization?.name }}</div>
          </div>
          <ul class="flex gap-1 overflow-x-auto md:flex-col">
            <li v-for="s in SECTIONS" :key="s.id">
              <button
                type="button"
                class="flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                :class="ui.settingsSection === s.id ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-muted-foreground'"
                :aria-current="ui.settingsSection === s.id ? 'page' : undefined"
                @click="ui.settingsSection = s.id"
              >
                <component :is="s.icon" class="size-4" aria-hidden="true" />
                {{ s.label }}
              </button>
            </li>
          </ul>
        </nav>

        <!-- Section content -->
        <section class="flex min-h-0 min-w-0 flex-1 flex-col">
          <header class="border-b px-6 py-4 pr-12">
            <h2 class="text-base font-semibold">{{ current.label }}</h2>
            <p class="text-sm text-muted-foreground">{{ current.description }}</p>
          </header>

          <div class="flex-1 overflow-y-auto px-6 py-5">
            <!-- Organization -->
            <form v-if="current.id === 'organization'" class="grid max-w-xl gap-5" @submit.prevent="saveOrganization">
              <p v-if="!can.manageOrg" class="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">Only owners and admins can change organization details.</p>
              <fieldset :disabled="!can.manageOrg" class="contents">
              <div class="grid gap-2">
                <Label for="org-name">Organization name</Label>
                <Input id="org-name" v-model="org.name" />
              </div>
              <div class="grid gap-2 sm:grid-cols-2 sm:gap-4">
                <div class="grid gap-2">
                  <Label for="org-website">Website</Label>
                  <Input id="org-website" v-model="org.website" type="url" />
                </div>
                <div class="grid gap-2">
                  <Label for="org-contact">Technical contact</Label>
                  <Input id="org-contact" v-model="org.contact" type="email" />
                </div>
              </div>
              <div class="grid gap-2">
                <Label for="org-id">Organization ID</Label>
                <div class="flex gap-2">
                  <Input id="org-id" :model-value="organization?.id" readonly class="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" aria-label="Copy organization ID" @click="copy(organization?.id, 'Organization ID')">
                    <Copy class="size-4" />
                  </Button>
                </div>
                <p class="text-xs text-muted-foreground">Used in API requests as the <code class="font-mono">Capibo-Organization</code> header.</p>
              </div>
              <div class="grid gap-2">
                <Label>Plan</Label>
                <div class="flex h-9 items-center gap-2 text-sm">
                  <Badge variant="secondary">{{ organization?.plan }}</Badge>
                  <span class="text-muted-foreground">since {{ formatDate(organization?.createdAt) }}</span>
                </div>
              </div>
              <div class="flex justify-end">
                <Button type="submit" :disabled="busy === 'org'">Save changes</Button>
              </div>
              </fieldset>
            </form>

            <!-- Team -->
            <div v-else-if="current.id === 'team'" class="grid gap-5 *:min-w-0">
              <form v-if="can.manageTeam" class="flex flex-col gap-2 sm:flex-row" @submit.prevent="sendInvite">
                <Input v-model="invite.email" type="email" placeholder="name@company.com" aria-label="Email to invite" class="flex-1" required />
                <Select v-model="invite.role">
                  <SelectTrigger class="sm:w-40" aria-label="Role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="r in ROLES.slice(1)" :key="r" :value="r">{{ r }}</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" :disabled="busy === 'invite'">Invite</Button>
              </form>
              <p v-else class="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">Only owners and admins can invite people or change roles.</p>
              <div class="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead class="w-44">Role</TableHead>
                      <TableHead class="hidden sm:table-cell">Last active</TableHead>
                      <TableHead class="w-10"><span class="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-if="!team">
                      <TableCell colspan="4" class="py-6 text-center text-sm text-muted-foreground">Loading team…</TableCell>
                    </TableRow>
                    <TableRow v-for="m in team" :key="m.id">
                      <TableCell>
                        <div class="flex items-center gap-3">
                          <Avatar class="size-8"><AvatarFallback class="text-xs">{{ initials(m.name) }}</AvatarFallback></Avatar>
                          <div class="min-w-0">
                            <div class="flex items-center gap-2 truncate text-sm font-medium">
                              {{ m.name }}
                              <span v-if="m.isYou" class="text-xs font-normal text-muted-foreground">(you)</span>
                              <Badge v-if="m.pending" variant="outline" class="h-5 text-[10px]">Pending</Badge>
                            </div>
                            <div class="truncate text-xs text-muted-foreground">{{ m.email }}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span v-if="m.role === 'Owner' || m.isYou || !can.manageTeam" class="text-sm">{{ m.role }}</span>
                        <Select v-else :model-value="m.role" :disabled="busy === `role:${m.id}`" @update:model-value="(r) => setRole(m, r)">
                          <SelectTrigger size="sm" class="h-8 w-full" :aria-label="`Role for ${m.name}`"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="r in ROLES.slice(1)" :key="r" :value="r">{{ r }}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell class="hidden text-sm text-muted-foreground sm:table-cell">{{ lastActive(m) }}</TableCell>
                      <TableCell>
                        <DropdownMenu v-if="m.role !== 'Owner' && !m.isYou && can.manageTeam">
                          <DropdownMenuTrigger as-child>
                            <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions for ${m.name}`"><MoreHorizontal class="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem @click="copy(m.email, 'Email')"><Copy class="size-4" /> Copy email</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" @click="removeMember(m)"><Trash2 class="size-4" /> {{ m.pending ? 'Cancel invite' : 'Remove' }}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <!-- API keys -->
            <div v-else-if="current.id === 'api-keys'" class="grid gap-5 *:min-w-0">
              <div v-if="createdSecret" class="grid gap-2 rounded-lg border border-status-good/40 bg-status-good/10 p-3" role="status">
                <div class="text-sm font-medium">“{{ createdSecret.name }}” created. Copy the secret now; it won't be shown again.</div>
                <div class="flex gap-2">
                  <Input :model-value="createdSecret.secret" readonly class="bg-background font-mono text-xs" aria-label="New API key secret" @focus="(e) => e.target.select()" />
                  <Button type="button" variant="outline" size="icon" aria-label="Copy API key" @click="copy(createdSecret.secret, 'API key')"><Copy class="size-4" /></Button>
                </div>
                <div class="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" @click="createdSecret = null">I've saved it</Button>
                </div>
              </div>
              <div v-else class="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                Capibo stores only a hash of each key. The full secret is shown once, right after you create it.
              </div>
              <form v-if="can.manageKeys" class="flex flex-col gap-2 sm:flex-row" @submit.prevent="createKey">
                <Input v-model="newKeyName" placeholder="Key name" aria-label="New key name" class="flex-1" />
                <Select v-model="newKeyScope">
                  <SelectTrigger class="sm:w-40" aria-label="Key scope"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="s in KEY_SCOPES" :key="s" :value="s">{{ s }}</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" :disabled="busy === 'key'"><Plus class="size-4" /> Create key</Button>
              </form>
              <div class="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead class="hidden md:table-cell">Permissions</TableHead>
                      <TableHead class="hidden sm:table-cell">Last used</TableHead>
                      <TableHead class="w-10"><span class="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-if="!keys?.length">
                      <TableCell colspan="5" class="py-6 text-center text-sm text-muted-foreground">{{ keys ? 'No API keys yet' : 'Loading keys…' }}</TableCell>
                    </TableRow>
                    <TableRow v-for="k in keys" :key="k.id">
                      <TableCell>
                        <div class="text-sm font-medium">{{ k.name }}</div>
                        <div class="text-xs text-muted-foreground">Created {{ formatDate(k.created) }}</div>
                      </TableCell>
                      <TableCell class="font-mono text-xs">{{ k.prefix }}</TableCell>
                      <TableCell class="hidden md:table-cell"><Badge variant="secondary" class="font-normal">{{ k.scope }}</Badge></TableCell>
                      <TableCell class="hidden text-sm text-muted-foreground sm:table-cell">{{ k.lastUsedAt ? relativeTime(k.lastUsedAt, new Date()) : 'Never' }}</TableCell>
                      <TableCell>
                        <DropdownMenu v-if="can.manageKeys">
                          <DropdownMenuTrigger as-child>
                            <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions for ${k.name}`"><MoreHorizontal class="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem @click="copy(k.prefix, 'Key ID')"><Copy class="size-4" /> Copy key ID</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" @click="revokeKey(k)"><Trash2 class="size-4" /> Revoke</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <!-- Retention -->
            <form v-else class="grid max-w-xl gap-5" @submit.prevent="saveRetention">
              <p v-if="!can.manageOrg" class="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">Only owners and admins can change the retention policy.</p>
              <fieldset :disabled="!can.manageOrg" class="contents">
              <div class="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
                <div>
                  <Label>Raw accepted videos</Label>
                  <p class="text-xs text-muted-foreground">Original uploads that passed QA.</p>
                </div>
                <Select v-model="retention.raw">
                  <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="730">2 years</SelectItem>
                    <SelectItem value="forever">Indefinitely</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div class="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
                <div>
                  <Label>Rejected videos</Label>
                  <p class="text-xs text-muted-foreground">Kept for appeals and QA audits, then deleted.</p>
                </div>
                <Select v-model="retention.rejected">
                  <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div class="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
                <div>
                  <Label>Labels &amp; derived data</Label>
                  <p class="text-xs text-muted-foreground">Annotations, poses and QA reports.</p>
                </div>
                <Select v-model="retention.derived">
                  <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="forever">Indefinitely</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div class="flex items-center justify-between gap-4">
                <div>
                  <Label for="ret-auto">Automatic deletion</Label>
                  <p class="text-xs text-muted-foreground">Delete data automatically when the period ends.</p>
                </div>
                <Switch id="ret-auto" v-model="retention.autoDelete" />
              </div>
              <div class="flex justify-end">
                <Button type="submit" :disabled="busy === 'retention'">Save policy</Button>
              </div>
              </fieldset>
            </form>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
