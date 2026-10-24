<script setup>
import { computed, reactive, ref } from 'vue'
import { toast } from '@/components/ui/toast'
import { Building2, Users, KeyRound, Archive, Copy, Plus, MoreHorizontal, Trash2, Mail } from '@lucide/vue'
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
import { ui } from '@/stores/ui'
import { organization, members as seedMembers, apiKeys as seedKeys } from '@/data/mock'
import { formatDate } from '@/lib/format'

const SECTIONS = [
  { id: 'organization', label: 'Organization', icon: Building2, description: 'Name, identifiers and data region.' },
  { id: 'team', label: 'Team members', icon: Users, description: 'Invite people and manage their roles.' },
  { id: 'api-keys', label: 'API keys', icon: KeyRound, description: 'Keys for the Capibo REST API. Keys are shown once at creation.' },
  { id: 'retention', label: 'Data retention', icon: Archive, description: 'How long Capibo keeps raw and derived data.' },
]
const ROLES = ['Owner', 'Admin', 'Data engineer', 'Developer', 'Billing', 'Viewer']

const current = computed(() => SECTIONS.find((s) => s.id === ui.settingsSection) ?? SECTIONS[0])

// Local working copies; saving is simulated until the API exists.
const org = reactive({ ...organization, website: 'https://timefactories.com', contact: 'ops@timefactories.com' })
const team = ref(seedMembers.map((m) => ({ ...m })))
const keys = ref(seedKeys.map((k) => ({ ...k })))
const retention = reactive({ raw: '365', rejected: '30', derived: 'forever', blurFaces: true, autoDelete: true, exportLogs: false })
const invite = reactive({ email: '', role: 'Developer' })
const newKeyName = ref('')

function save(what) {
  toast.add({ title: `${what} saved`, type: 'success', description: 'Changes apply to your whole organization.' })
}

function copy(text, label) {
  navigator.clipboard?.writeText(text).catch(() => {})
  toast.add({ title: `${label} copied to clipboard` })
}

function sendInvite() {
  const email = invite.email.trim()
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast.add({ title: 'Enter a valid email address', type: 'error' })
  const name = email.split('@')[0].replace(/[._]/g, ' ')
  team.value.push({
    name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    email,
    role: invite.role,
    initials: name.slice(0, 2).toUpperCase(),
    lastActive: 'Invited',
    pending: true,
  })
  toast.add({ title: 'Invitation sent', type: 'success', description: `${email} was invited as ${invite.role}.` })
  invite.email = ''
}

function removeMember(m) {
  team.value = team.value.filter((x) => x.email !== m.email)
  toast.add({ title: `${m.name} removed from ${org.name}` })
}

function createKey() {
  const name = newKeyName.value.trim() || 'Untitled key'
  const suffix = Math.random().toString(16).slice(2, 6)
  keys.value.unshift({
    id: `key_${Date.now()}`,
    name,
    prefix: `cpb_live_••••••••••••${suffix}`,
    created: '2026-10-23',
    lastUsed: 'Never',
    scope: 'Read datasets',
  })
  newKeyName.value = ''
  toast.add({ title: 'API key created', type: 'success', description: 'In production the full secret is shown once. This demo only stores a masked placeholder.' })
}

function revokeKey(k) {
  keys.value = keys.value.filter((x) => x.id !== k.id)
  toast.add({ title: `Key “${k.name}” revoked` })
}

</script>

<template>
  <Dialog v-model:open="ui.settingsOpen">
    <DialogContent class="overflow-hidden p-0 sm:max-w-[920px] md:max-h-[640px]">
      <DialogTitle class="sr-only">Settings</DialogTitle>
      <DialogDescription class="sr-only">Organization settings for {{ org.name }}</DialogDescription>
      <div class="flex h-[min(640px,85vh)] min-w-0 flex-col md:flex-row">
        <!-- Section navigation -->
        <nav aria-label="Settings sections" class="min-w-0 shrink-0 border-b bg-sidebar p-2 pr-12 md:w-56 md:border-r md:border-b-0 md:p-3">
          <div class="hidden px-2 pb-3 pt-1 md:block">
            <div class="text-sm font-semibold">Settings</div>
            <div class="truncate text-xs text-muted-foreground">{{ org.name }}</div>
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
            <form v-if="current.id === 'organization'" class="grid max-w-xl gap-5" @submit.prevent="save('Organization details')">
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
                  <Input id="org-id" :model-value="org.id" readonly class="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" aria-label="Copy organization ID" @click="copy(org.id, 'Organization ID')">
                    <Copy class="size-4" />
                  </Button>
                </div>
                <p class="text-xs text-muted-foreground">Used in API requests as the <code class="font-mono">Capibo-Organization</code> header.</p>
              </div>
              <div class="grid gap-2 sm:grid-cols-2 sm:gap-4">
                <div class="grid gap-2">
                  <Label>Data region</Label>
                  <Select v-model="org.region">
                    <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US (us-west-2)">US (us-west-2)</SelectItem>
                      <SelectItem value="EU (eu-central-1)">EU (eu-central-1)</SelectItem>
                      <SelectItem value="APAC (ap-southeast-1)">APAC (ap-southeast-1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="grid gap-2">
                  <Label>Plan</Label>
                  <div class="flex h-9 items-center gap-2 text-sm">
                    <Badge variant="secondary">{{ org.plan }}</Badge>
                    <span class="text-muted-foreground">since {{ formatDate(org.createdAt) }}</span>
                  </div>
                </div>
              </div>
              <div class="flex justify-end">
                <Button type="submit">Save changes</Button>
              </div>
            </form>

            <!-- Team -->
            <div v-else-if="current.id === 'team'" class="grid gap-5 *:min-w-0">
              <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="sendInvite">
                <Input v-model="invite.email" type="email" placeholder="name@company.com" aria-label="Email to invite" class="flex-1" />
                <Select v-model="invite.role">
                  <SelectTrigger class="sm:w-40" aria-label="Role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="r in ROLES.slice(1)" :key="r" :value="r">{{ r }}</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit"><Mail class="size-4" /> Invite</Button>
              </form>
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
                    <TableRow v-for="m in team" :key="m.email">
                      <TableCell>
                        <div class="flex items-center gap-3">
                          <Avatar class="size-8"><AvatarFallback class="text-xs">{{ m.initials }}</AvatarFallback></Avatar>
                          <div class="min-w-0">
                            <div class="flex items-center gap-2 truncate text-sm font-medium">
                              {{ m.name }} <Badge v-if="m.pending" variant="outline" class="h-5 text-[10px]">Pending</Badge>
                            </div>
                            <div class="truncate text-xs text-muted-foreground">{{ m.email }}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span v-if="m.role === 'Owner'" class="text-sm">Owner</span>
                        <Select v-else v-model="m.role" @update:model-value="(r) => toast.add({ title: `${m.name} is now ${r}` })">
                          <SelectTrigger size="sm" class="h-8 w-full" :aria-label="`Role for ${m.name}`"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="r in ROLES.slice(1)" :key="r" :value="r">{{ r }}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell class="hidden text-sm text-muted-foreground sm:table-cell">{{ m.lastActive }}</TableCell>
                      <TableCell>
                        <DropdownMenu v-if="m.role !== 'Owner'">
                          <DropdownMenuTrigger as-child>
                            <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions for ${m.name}`"><MoreHorizontal class="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem @click="toast.add({ title: `Password reset sent to ${m.email}` })">Send password reset</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" @click="removeMember(m)"><Trash2 class="size-4" /> Remove</DropdownMenuItem>
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
              <div class="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                Secret keys are never stored in or sent to this dashboard's client code. Values below are masked placeholders.
              </div>
              <form class="flex gap-2" @submit.prevent="createKey">
                <Input v-model="newKeyName" placeholder="Key name, e.g. Training cluster" aria-label="New key name" />
                <Button type="submit"><Plus class="size-4" /> Create key</Button>
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
                    <TableRow v-for="k in keys" :key="k.id">
                      <TableCell>
                        <div class="text-sm font-medium">{{ k.name }}</div>
                        <div class="text-xs text-muted-foreground">Created {{ formatDate(k.created) }}</div>
                      </TableCell>
                      <TableCell class="font-mono text-xs">{{ k.prefix }}</TableCell>
                      <TableCell class="hidden md:table-cell"><Badge variant="secondary" class="font-normal">{{ k.scope }}</Badge></TableCell>
                      <TableCell class="hidden text-sm text-muted-foreground sm:table-cell">{{ k.lastUsed }}</TableCell>
                      <TableCell>
                        <DropdownMenu>
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
            <form v-else class="grid max-w-xl gap-5" @submit.prevent="save('Retention policy')">
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
                  <Label for="ret-blur">Blur faces and screens</Label>
                  <p class="text-xs text-muted-foreground">Apply privacy blurring before videos enter datasets.</p>
                </div>
                <Switch id="ret-blur" v-model="retention.blurFaces" />
              </div>
              <div class="flex items-center justify-between gap-4">
                <div>
                  <Label for="ret-auto">Automatic deletion</Label>
                  <p class="text-xs text-muted-foreground">Delete data automatically when the period ends.</p>
                </div>
                <Switch id="ret-auto" v-model="retention.autoDelete" />
              </div>
              <div class="flex items-center justify-between gap-4">
                <div>
                  <Label for="ret-logs">Export audit logs</Label>
                  <p class="text-xs text-muted-foreground">Email deletion receipts to organization owners.</p>
                </div>
                <Switch id="ret-logs" v-model="retention.exportLogs" />
              </div>
              <div class="flex justify-end">
                <Button type="submit">Save policy</Button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
