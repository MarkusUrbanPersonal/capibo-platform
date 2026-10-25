<script setup>
import { computed, reactive, ref } from 'vue'
import { toast } from '@/components/ui/toast'
import { Plus, Wallet, CalendarClock, CreditCard, Building2, Pencil, Zap, TicketPercent, Check } from '@lucide/vue'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import MonthlySpendChart from '@/components/charts/MonthlySpendChart.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api } from '@convex/_generated/api'
import { convex, errorMessage, useQuery } from '@/lib/convex'
import { can } from '@/stores/session'
import { formatCurrency, formatCurrencyRound, formatDate, formatNumber, isoToday } from '@/lib/format'

const topUpOpen = ref(false)
const detailsOpen = ref(false)
const rechargeOpen = ref(false)

const { data: overview } = useQuery(api.billing.overview)
const account = computed(() => {
  const o = overview.value
  if (!o) return null
  return {
    balance: o.balance,
    monthlyBudget: o.monthlyBudget,
    autoRecharge: o.autoRecharge.enabled,
    threshold: String(o.autoRecharge.threshold),
    rechargeAmount: String(o.autoRecharge.amount),
    details: o.billingDetails,
  }
})
// Only join the address parts that are filled in, so a new account doesn't show a stray comma.
const addressLines = computed(() => {
  const { address, city, country } = account.value?.details ?? {}
  return [address, [city, country].filter(Boolean).join(', ')].filter(Boolean)
})
const transactions = computed(() => overview.value?.transactions ?? [])
const redeemedPromos = computed(() => transactions.value.filter((t) => t.kind === 'promo'))

/** Runs a Convex call, toasting the server's message if it fails. Returns undefined on failure. */
async function run(call) {
  try {
    return (await call()) ?? true
  } catch (e) {
    toast.add({ title: errorMessage(e), type: 'error' })
  }
}

const today = isoToday()
const month = today.slice(0, 7)
const { data: monthly } = useQuery(api.usage.monthly, { today, months: 9 })
const chartMonths = computed(() => monthly.value ?? [])
const mtdSpend = computed(() => chartMonths.value.at(-1)?.cost ?? 0)


// Add credits: buy with a card at checkout, or redeem a promo code.
const PRESETS = ['20', '100', '500']
const topUp = reactive({ mode: 'card', preset: '100', custom: '' })
const topUpAmount = computed(() => Number(topUp.custom || topUp.preset) || 0)

function openTopUp(mode = 'card') {
  topUp.mode = mode
  promo.code = ''
  promo.error = ''
  topUpOpen.value = true
}

const submitting = ref(false)

async function confirmTopUp() {
  const amount = topUpAmount.value
  if (amount < 20) return toast.add({ title: 'Minimum top-up is $20', type: 'error' })
  submitting.value = true
  const ok = await run(() => convex.mutation(api.billing.topUp, { amount }))
  submitting.value = false
  if (!ok) return
  topUpOpen.value = false
  topUp.custom = ''
  toast.add({ title: `${formatCurrency(amount)} added to your balance`, type: 'success', description: 'Demo checkout — no card was charged.' })
}

const promo = reactive({ code: '', error: '' })
const promoKey = computed(() => promo.code.trim().toUpperCase())
// Live preview of the code's value; null when unknown or already used on this account.
const { data: promoMatch } = useQuery(api.billing.lookupPromo, () =>
  topUpOpen.value && topUp.mode === 'promo' && promoKey.value ? { code: promoKey.value } : 'skip',
)
async function redeemPromo() {
  if (!promoKey.value) return (promo.error = 'Enter a promo code')
  submitting.value = true
  try {
    const { amount, label, code } = await convex.mutation(api.billing.redeemPromo, { code: promoKey.value })
    topUpOpen.value = false
    toast.add({ title: `${formatCurrency(amount)} in credits added`, type: 'success', description: `${label} · ${code}` })
  } catch (e) {
    promo.error = errorMessage(e)
  } finally {
    submitting.value = false
  }
}

// Billing details
const draft = reactive({ company: '', email: '', address: '', city: '', country: '', taxId: '' })
function openDetails() {
  Object.assign(draft, account.value.details)
  detailsOpen.value = true
}
async function saveDetails() {
  if (!(await run(() => convex.mutation(api.billing.updateDetails, { ...draft })))) return
  detailsOpen.value = false
  toast.add({ title: 'Billing details updated', type: 'success', description: 'Changes appear on your next invoice.' })
}

async function toggleAutoRecharge(v) {
  if (await run(() => convex.mutation(api.billing.setAutoRecharge, { enabled: v }))) {
    toast.add({ title: v ? 'Auto-recharge enabled' : 'Auto-recharge disabled' })
  }
}

// Auto-recharge: threshold/amount presets and a balance gauge with the trigger point.
const THRESHOLDS = ['10', '20', '50']
const RECHARGE_AMOUNTS = ['50', '100', '250']
const dailyBurn = computed(() => mtdSpend.value / Number(today.slice(8, 10)))
const gaugeMax = computed(() => Math.max(account.value.balance, Number(account.value.threshold) + Number(account.value.rechargeAmount)) * 1.1)
const balancePct = computed(() => Math.min(100, (account.value.balance / gaugeMax.value) * 100))
const thresholdPct = computed(() => (Number(account.value.threshold) / gaugeMax.value) * 100)
const daysToRecharge = computed(() =>
  dailyBurn.value ? Math.max(0, Math.floor((account.value.balance - Number(account.value.threshold)) / dailyBurn.value)) : null,
)
async function setRecharge(key, value, label) {
  if (!value || account.value[key] === value) return
  const field = key === 'threshold' ? 'threshold' : 'amount'
  if (await run(() => convex.mutation(api.billing.setAutoRecharge, { [field]: Number(value) }))) {
    toast.add({ title: 'Auto-recharge updated', type: 'success', description: `${label} ${formatCurrencyRound(Number(value))}` })
  }
}

</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
    <PageHeader title="Billing">
      <template #actions>
        <Button :disabled="!can.manageBilling" @click="openTopUp()"><Plus class="size-4" /> Add credits</Button>
      </template>
    </PageHeader>

    <div v-if="!account" class="py-16 text-center text-sm text-muted-foreground" role="status">Loading billing…</div>
    <template v-else>
    <div class="grid gap-4 md:grid-cols-3">
      <Card class="gap-0 py-0 shadow-none">
        <CardContent class="p-4">
          <div class="flex items-center justify-between text-sm text-muted-foreground">Credit balance <Wallet class="size-4" /></div>
          <div class="mt-2 text-2xl font-semibold tracking-tight">{{ formatCurrency(account.balance) }}</div>
          <p class="mt-1 text-xs text-muted-foreground">Pay as you go</p>
        </CardContent>
      </Card>
      <Card class="gap-0 py-0 shadow-none">
        <CardContent class="p-4">
          <div class="flex items-center justify-between text-sm text-muted-foreground">Spend this month <CalendarClock class="size-4" /></div>
          <div class="mt-2 text-2xl font-semibold tracking-tight">{{ formatCurrencyRound(mtdSpend) }}</div>
          <Progress :model-value="(mtdSpend / account.monthlyBudget) * 100" class="mt-2 h-1.5" aria-label="Budget used" />
          <p class="mt-1.5 text-xs text-muted-foreground">{{ Math.round((mtdSpend / account.monthlyBudget) * 100) }}% of {{ formatCurrencyRound(account.monthlyBudget) }} budget</p>
        </CardContent>
      </Card>
      <Card class="gap-0 py-0 shadow-none">
        <CardContent class="p-4">
          <div class="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            Auto-recharge
            <Switch :model-value="account.autoRecharge" :disabled="!can.manageBilling" aria-label="Auto-recharge" @update:model-value="toggleAutoRecharge" />
          </div>
          <div class="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <span
              class="size-2.5 rounded-full transition-colors"
              :class="account.autoRecharge ? 'bg-status-good' : 'bg-muted-foreground/40'"
              aria-hidden="true"
            />
            <span :class="account.autoRecharge ? '' : 'text-muted-foreground'">{{ account.autoRecharge ? 'On' : 'Off' }}</span>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            +{{ formatCurrencyRound(Number(account.rechargeAmount)) }} below {{ formatCurrencyRound(Number(account.threshold)) }}<template v-if="account.autoRecharge && daysToRecharge !== null"> · next in ~{{ daysToRecharge }} days</template> ·
            <button v-if="can.manageBilling" type="button" class="font-medium text-foreground underline-offset-4 hover:underline" @click="rechargeOpen = true">Edit</button>
          </p>
        </CardContent>
      </Card>
    </div>

    <Card class="shadow-none">
      <CardHeader>
        <CardTitle>Monthly spend</CardTitle>
        <CardDescription>Video collection and QA processing charges per month</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-6 px-2 *:min-w-0 sm:px-6 lg:grid-cols-[1fr_280px]">
        <MonthlySpendChart :data="chartMonths" />
        <Table class="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead class="h-8">Month</TableHead>
              <TableHead class="h-8 text-right">Videos</TableHead>
              <TableHead class="h-8 text-right">Spend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="m in chartMonths.slice(-6).reverse()" :key="m.month">
              <TableCell class="py-1.5">{{ formatDate(m.month + '-15', { month: 'short', year: 'numeric' }) }}<span v-if="m.month === month" class="ml-1 text-xs text-muted-foreground">(MTD)</span></TableCell>
              <TableCell class="py-1.5 text-right tabular-nums">{{ formatNumber(m.accepted) }}</TableCell>
              <TableCell class="py-1.5 text-right tabular-nums">{{ formatCurrencyRound(m.cost) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card class="shadow-none">
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardDescription>Credits added to your account</CardDescription>
      </CardHeader>
      <CardContent class="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="pl-6">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead class="hidden md:table-cell">Reference</TableHead>
              <TableHead class="text-right">Amount</TableHead>
              <TableHead class="pr-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="!transactions.length">
              <TableCell colspan="5" class="py-8 text-center text-sm text-muted-foreground">No transactions yet</TableCell>
            </TableRow>
            <TableRow v-for="t in transactions" :key="t.id">
              <TableCell class="pl-6 whitespace-nowrap text-muted-foreground">{{ formatDate(t.date) }}</TableCell>
              <TableCell>
                <div class="flex items-center gap-2">
                  <Badge variant="outline" class="h-5 px-1.5 text-[10px] font-normal text-muted-foreground">{{ { invoice: 'Invoice', promo: 'Promo', credit: 'Credit' }[t.kind] }}</Badge>
                  <span class="truncate">{{ t.description }}</span>
                </div>
              </TableCell>
              <TableCell class="hidden font-mono text-xs text-muted-foreground md:table-cell">{{ t.id }}</TableCell>
              <TableCell class="text-right tabular-nums" :class="t.kind !== 'invoice' && t.status === 'succeeded' ? 'text-status-good-text' : ''">
                {{ t.kind !== 'invoice' ? '+' : '' }}{{ formatCurrency(t.amount) }}
              </TableCell>
              <TableCell class="pr-6"><StatusBadge :status="t.status" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <div class="grid gap-4 *:min-w-0 md:grid-cols-2">
      <Card class="shadow-none">
        <CardHeader>
          <CardTitle>Payment method</CardTitle>
          <CardDescription>How this account is funded</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-3">
          <div v-for="p in redeemedPromos" :key="p.id" class="flex items-center gap-4 rounded-lg border p-4">
            <div class="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-status-good/12 text-status-good-text">
              <TicketPercent class="size-5" aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-medium">Promo code <span class="font-mono text-sm">{{ p.promoCode }}</span></div>
              <div class="text-sm text-muted-foreground">{{ formatCurrencyRound(p.amount) }} in credits · redeemed {{ formatDate(p.date) }}</div>
            </div>
            <Badge variant="secondary"><Check class="size-3" /> Redeemed</Badge>
          </div>
          <div v-if="!redeemedPromos.length" class="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4">
            <p class="text-sm text-muted-foreground">No credits yet. Buy credits or redeem a promo code to start a mission.</p>
            <Button v-if="can.manageBilling" variant="outline" size="sm" @click="openTopUp('promo')"><TicketPercent class="size-4" /> Redeem a promo code</Button>
          </div>
        </CardContent>
      </Card>

      <Card class="shadow-none">
        <CardHeader>
          <CardTitle>Billing details</CardTitle>
          <CardDescription>Shown on invoices</CardDescription>
          <CardAction>
            <Button v-if="can.manageBilling" variant="ghost" size="sm" @click="openDetails"><Pencil class="size-4" /> Edit</Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl class="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
            <dt class="text-muted-foreground">Company</dt><dd class="flex items-center gap-2"><Building2 class="size-3.5 text-muted-foreground" /> {{ account.details.company }}</dd>
            <dt class="text-muted-foreground">Billing email</dt><dd>{{ account.details.email }}</dd>
            <dt class="text-muted-foreground">Address</dt><dd>
              <template v-if="addressLines.length">
                <template v-for="(line, i) in addressLines" :key="i"><br v-if="i" />{{ line }}</template>
              </template>
              <span v-else class="text-muted-foreground">Not set</span>
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>

    <!-- Auto-recharge settings -->
    <Dialog v-model:open="rechargeOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auto-recharge</DialogTitle>
          <DialogDescription>Top up automatically so missions never pause for lack of credits.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-5">
          <div class="grid gap-2">
            <Label class="text-xs font-normal text-muted-foreground">When balance falls below</Label>
            <ToggleGroup :model-value="account.threshold" type="single" variant="outline" class="w-full" @update:model-value="(v) => setRecharge('threshold', v, 'Recharges below')">
              <ToggleGroupItem v-for="t in THRESHOLDS" :key="t" :value="t" class="flex-1 tabular-nums">{{ formatCurrencyRound(Number(t)) }}</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div class="grid gap-2">
            <Label class="text-xs font-normal text-muted-foreground">Add this amount</Label>
            <ToggleGroup :model-value="account.rechargeAmount" type="single" variant="outline" class="w-full" @update:model-value="(v) => setRecharge('rechargeAmount', v, 'Adds')">
              <ToggleGroupItem v-for="a in RECHARGE_AMOUNTS" :key="a" :value="a" class="flex-1 tabular-nums">{{ formatCurrencyRound(Number(a)) }}</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div class="grid gap-2">
            <div class="flex items-baseline justify-between gap-2 text-xs">
              <span class="text-muted-foreground">Balance</span>
              <span class="tabular-nums">
                <span class="font-medium">{{ formatCurrencyRound(account.balance) }}</span>
                <span class="text-muted-foreground"> · next recharge in ~{{ daysToRecharge }} days</span>
              </span>
            </div>
            <div
              class="relative mt-1 h-2.5 rounded-full bg-muted"
              role="img"
              :aria-label="`Balance ${formatCurrencyRound(account.balance)}, recharges below ${formatCurrencyRound(Number(account.threshold))}`"
            >
              <div class="h-full rounded-full bg-emerald-500 transition-[width] duration-500" :style="{ width: balancePct + '%' }" />
              <div class="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground transition-[left] duration-500" :style="{ left: thresholdPct + '%' }" />
            </div>
            <div class="relative h-4 text-[11px] text-muted-foreground">
              <span class="absolute -translate-x-1/2 whitespace-nowrap tabular-nums transition-[left] duration-500" :style="{ left: Math.max(thresholdPct, 6) + '%' }">
                <Zap class="inline size-3 align-[-2px]" /> {{ formatCurrencyRound(Number(account.threshold)) }}
              </span>
            </div>
          </div>
          <p class="flex items-center text-xs text-muted-foreground">
            <CreditCard class="mr-1.5 size-3.5" />
            Charged to your card on file · at most one recharge per day
          </p>
        </div>
        <DialogFooter>
          <Button @click="rechargeOpen = false">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Add credits -->
    <Dialog v-model:open="topUpOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add credits</DialogTitle>
          <DialogDescription>Credits are used for accepted videos and QA processing. They never expire.</DialogDescription>
        </DialogHeader>
        <Tabs v-model="topUp.mode" class="gap-4">
          <TabsList class="w-full">
            <TabsTrigger value="card"><CreditCard class="size-4" /> Buy credits</TabsTrigger>
            <TabsTrigger value="promo"><TicketPercent class="size-4" /> Promo code</TabsTrigger>
          </TabsList>
          <TabsContent value="card">
            <form id="topup-form" class="grid gap-4" @submit.prevent="confirmTopUp">
              <ToggleGroup :model-value="topUp.preset" type="single" variant="outline" class="w-full" @update:model-value="(v) => { if (v) { topUp.preset = v; topUp.custom = '' } }">
                <ToggleGroupItem v-for="p in PRESETS" :key="p" :value="p" class="flex-1">{{ formatCurrencyRound(Number(p)) }}</ToggleGroupItem>
              </ToggleGroup>
              <div class="grid gap-2">
                <Label for="topup-custom">Custom amount (USD)</Label>
                <Input id="topup-custom" v-model="topUp.custom" type="number" min="20" step="1" placeholder="e.g. 250" />
              </div>
              <div class="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span class="text-muted-foreground">Pay by card at checkout</span>
                <span class="font-semibold tabular-nums">{{ formatCurrency(topUpAmount) }}</span>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="promo">
            <form id="promo-form" class="grid gap-3" @submit.prevent="redeemPromo">
              <div class="grid gap-2">
                <Label for="promo-code">Promo code</Label>
                <Input
                  id="promo-code"
                  v-model="promo.code"
                  placeholder="Enter code"
                  class="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                  autocomplete="off"
                  :aria-invalid="!!promo.error"
                  @input="promo.error = ''"
                />
                <p v-if="promo.error" class="text-xs text-destructive">{{ promo.error }}</p>
              </div>
              <div
                class="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors"
                :class="promoMatch ? 'bg-status-good/10' : 'bg-muted/50'"
              >
                <span class="text-muted-foreground">{{ promoMatch ? promoMatch.label : 'Credits are added instantly' }}</span>
                <span class="font-semibold tabular-nums" :class="promoMatch ? 'text-status-good-text' : 'text-muted-foreground'">{{ promoMatch ? '+' + formatCurrency(promoMatch.amount) : '—' }}</span>
              </div>
            </form>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" @click="topUpOpen = false">Cancel</Button>
          <Button v-if="topUp.mode === 'card'" type="submit" form="topup-form" :disabled="submitting">Add {{ formatCurrencyRound(topUpAmount) }}</Button>
          <Button v-else type="submit" form="promo-form" :disabled="submitting"><TicketPercent class="size-4" /> Redeem</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Billing details -->
    <Dialog v-model:open="detailsOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit billing details</DialogTitle>
          <DialogDescription>Updates apply to future invoices.</DialogDescription>
        </DialogHeader>
        <form id="details-form" class="grid gap-3" @submit.prevent="saveDetails">
          <div class="grid gap-1.5"><Label for="bd-company">Company</Label><Input id="bd-company" v-model="draft.company" required /></div>
          <div class="grid gap-1.5"><Label for="bd-email">Billing email</Label><Input id="bd-email" v-model="draft.email" type="email" required /></div>
          <div class="grid gap-1.5"><Label for="bd-address">Address</Label><Input id="bd-address" v-model="draft.address" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-1.5"><Label for="bd-city">City</Label><Input id="bd-city" v-model="draft.city" /></div>
            <div class="grid gap-1.5"><Label for="bd-country">Country</Label><Input id="bd-country" v-model="draft.country" /></div>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" @click="detailsOpen = false">Cancel</Button>
          <Button type="submit" form="details-form">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </template>

  </div>
</template>
