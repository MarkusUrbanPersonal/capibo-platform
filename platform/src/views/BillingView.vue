<script setup>
import { computed, reactive, ref } from 'vue'
import { toast } from '@/components/ui/toast'
import { Plus, Wallet, CalendarClock, Download, CreditCard, Building2, Pencil, Zap, TicketPercent, Check } from '@lucide/vue'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import MonthlySpendChart from '@/components/charts/MonthlySpendChart.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { billing as seed, dailyUsage, monthlySpend, promoCodes, transactions as seedTx, TODAY } from '@/data/mock'
import { formatCurrency, formatCurrencyRound, formatDate, formatNumber } from '@/lib/format'

const topUpOpen = ref(false)
const detailsOpen = ref(false)
const rechargeOpen = ref(false)

const account = reactive({
  balance: seed.balance,
  autoRecharge: seed.autoRecharge.enabled,
  threshold: String(seed.autoRecharge.threshold),
  rechargeAmount: String(seed.autoRecharge.amount),
  details: { ...seed.billingDetails },
})
const transactions = ref(seedTx.map((t) => ({ ...t })))

const month = TODAY.toISOString().slice(0, 7)
const mtdRows = dailyUsage.filter((r) => r.date.startsWith(month))
const mtdSpend = mtdRows.reduce((s, r) => s + r.cost, 0)

const chartMonths = monthlySpend.slice(-9)


// Add credits: buy with a card at checkout, or redeem a promo code.
const PRESETS = ['10000', '25000', '50000']
const topUp = reactive({ mode: 'card', preset: '25000', custom: '' })
const topUpAmount = computed(() => Number(topUp.custom || topUp.preset) || 0)

function addTransaction(description, amount, kind) {
  account.balance += amount
  transactions.value.unshift({
    id: `TXN-${Math.floor(89000 + Math.random() * 900)}`,
    date: TODAY.toISOString().slice(0, 10),
    description,
    amount,
    status: 'succeeded',
    kind,
  })
}

function openTopUp(mode = 'card') {
  topUp.mode = mode
  promo.code = ''
  promo.error = ''
  topUpOpen.value = true
}

function confirmTopUp() {
  const amount = topUpAmount.value
  if (amount < 500) return toast.add({ title: 'Minimum top-up is $500', type: 'error' })
  addTransaction('Credit top-up · card checkout', amount, 'credit')
  topUpOpen.value = false
  topUp.custom = ''
  toast.add({ title: `${formatCurrency(amount)} added to your balance`, type: 'success', description: 'Demo checkout — no card was charged.' })
}

const redeemed = reactive(new Set([seed.promo.code]))
const promo = reactive({ code: '', error: '' })
const promoKey = computed(() => promo.code.trim().toUpperCase())
const promoMatch = computed(() => (redeemed.has(promoKey.value) ? null : promoCodes[promoKey.value] ?? null))
function redeemPromo() {
  const code = promoKey.value
  if (!code) return (promo.error = 'Enter a promo code')
  if (!promoCodes[code]) return (promo.error = `“${code}” isn’t a valid promo code`)
  if (redeemed.has(code)) return (promo.error = `${code} has already been redeemed on this account`)
  const { amount, label } = promoCodes[code]
  redeemed.add(code)
  addTransaction(`Promo code ${code} redeemed`, amount, 'promo')
  topUpOpen.value = false
  toast.add({ title: `${formatCurrency(amount)} in credits added`, type: 'success', description: `${label} · ${code}` })
}

// Billing details
const draft = reactive({ ...seed.billingDetails })
function openDetails() {
  Object.assign(draft, account.details)
  detailsOpen.value = true
}
function saveDetails() {
  Object.assign(account.details, draft)
  detailsOpen.value = false
  toast.add({ title: 'Billing details updated', type: 'success', description: 'Changes appear on your next invoice.' })
}

function toggleAutoRecharge(v) {
  account.autoRecharge = v
  toast.add({ title: v ? 'Auto-recharge enabled' : 'Auto-recharge disabled' })
}

// Auto-recharge: threshold/amount presets and a balance gauge with the trigger point.
const THRESHOLDS = ['2500', '5000', '10000']
const RECHARGE_AMOUNTS = ['10000', '25000', '50000']
const dailyBurn = mtdSpend / mtdRows.length
const gaugeMax = computed(() => Math.max(account.balance, Number(account.threshold) + Number(account.rechargeAmount)) * 1.1)
const balancePct = computed(() => Math.min(100, (account.balance / gaugeMax.value) * 100))
const thresholdPct = computed(() => (Number(account.threshold) / gaugeMax.value) * 100)
const daysToRecharge = computed(() => Math.max(0, Math.floor((account.balance - Number(account.threshold)) / dailyBurn)))
function setRecharge(key, value, label) {
  if (!value || account[key] === value) return
  account[key] = value
  toast.add({ title: 'Auto-recharge updated', type: 'success', description: `${label} ${formatCurrencyRound(Number(value))}` })
}

</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
    <PageHeader title="Billing">
      <template #actions>
        <Button @click="openTopUp()"><Plus class="size-4" /> Add credits</Button>
      </template>
    </PageHeader>

    <div class="grid gap-4 md:grid-cols-3">
      <Card class="gap-0 py-0 shadow-none">
        <CardContent class="p-4">
          <div class="flex items-center justify-between text-sm text-muted-foreground">Credit balance <Wallet class="size-4" /></div>
          <div class="mt-2 text-2xl font-semibold tracking-tight">{{ formatCurrency(account.balance) }}</div>
          <p class="mt-1 text-xs text-muted-foreground">Prepaid · {{ seed.plan }} plan</p>
        </CardContent>
      </Card>
      <Card class="gap-0 py-0 shadow-none">
        <CardContent class="p-4">
          <div class="flex items-center justify-between text-sm text-muted-foreground">Spend this month <CalendarClock class="size-4" /></div>
          <div class="mt-2 text-2xl font-semibold tracking-tight">{{ formatCurrencyRound(mtdSpend) }}</div>
          <Progress :model-value="(mtdSpend / seed.monthlyBudget) * 100" class="mt-2 h-1.5" aria-label="Budget used" />
          <p class="mt-1.5 text-xs text-muted-foreground">{{ Math.round((mtdSpend / seed.monthlyBudget) * 100) }}% of {{ formatCurrencyRound(seed.monthlyBudget) }} budget</p>
        </CardContent>
      </Card>
      <Card class="gap-0 py-0 shadow-none">
        <CardContent class="p-4">
          <div class="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            Auto-recharge
            <Switch :model-value="account.autoRecharge" aria-label="Auto-recharge" @update:model-value="toggleAutoRecharge" />
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
            +{{ formatCurrencyRound(Number(account.rechargeAmount)) }} below {{ formatCurrencyRound(Number(account.threshold)) }}<template v-if="account.autoRecharge"> · next in ~{{ daysToRecharge }} days</template> ·
            <button type="button" class="font-medium text-foreground underline-offset-4 hover:underline" @click="rechargeOpen = true">Edit</button>
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
              <TableHead>Status</TableHead>
              <TableHead class="w-12 pr-6"><span class="sr-only">Download</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
              <TableCell><StatusBadge :status="t.status" /></TableCell>
              <TableCell class="pr-6">
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  :aria-label="`Download ${t.id}`"
                  @click="toast.add({ title: `${t.id}.pdf downloaded`, type: 'success', description: 'Demo file — PDF generation is not connected.' })"
                >
                  <Download class="size-4" />
                </Button>
              </TableCell>
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
          <div class="flex items-center gap-4 rounded-lg border p-4">
            <div class="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-status-good/12 text-status-good-text">
              <TicketPercent class="size-5" aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-medium">Promo code <span class="font-mono text-sm">{{ seed.promo.code }}</span></div>
              <div class="text-sm text-muted-foreground">{{ formatCurrencyRound(seed.promo.amount) }} in credits · redeemed {{ formatDate(seed.promo.redeemedAt) }}</div>
            </div>
            <Badge variant="secondary"><Check class="size-3" /> Redeemed</Badge>
          </div>
          <p class="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            <CreditCard class="size-4 shrink-0" /> No card on file. Add one to buy credits or use auto-recharge.
          </p>
        </CardContent>
        <CardFooter class="flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="toast.add({ title: 'Card setup opens the secure payment form', description: 'Payment processing is not connected in this version.' })">
            <CreditCard class="size-4" /> Add card
          </Button>
          <Button variant="outline" size="sm" @click="openTopUp('promo')"><TicketPercent class="size-4" /> Redeem code</Button>
          <Button variant="ghost" size="sm" @click="toast.add({ title: 'Wire transfer details sent to finance@timefactories.com' })">Pay by wire transfer</Button>
        </CardFooter>
      </Card>

      <Card class="shadow-none">
        <CardHeader>
          <CardTitle>Billing details</CardTitle>
          <CardDescription>Shown on invoices</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" @click="openDetails"><Pencil class="size-4" /> Edit</Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl class="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
            <dt class="text-muted-foreground">Company</dt><dd class="flex items-center gap-2"><Building2 class="size-3.5 text-muted-foreground" /> {{ account.details.company }}</dd>
            <dt class="text-muted-foreground">Billing email</dt><dd>{{ account.details.email }}</dd>
            <dt class="text-muted-foreground">Address</dt><dd>{{ account.details.address }}<br />{{ account.details.city }}, {{ account.details.country }}</dd>
            <dt class="text-muted-foreground">Tax ID</dt><dd class="font-mono text-xs leading-5">{{ account.details.taxId }}</dd>
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
                <Input id="topup-custom" v-model="topUp.custom" type="number" min="500" step="100" placeholder="e.g. 15000" />
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
          <Button v-if="topUp.mode === 'card'" type="submit" form="topup-form">Add {{ formatCurrencyRound(topUpAmount) }}</Button>
          <Button v-else type="submit" form="promo-form"><TicketPercent class="size-4" /> Redeem</Button>
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
          <div class="grid gap-1.5"><Label for="bd-tax">Tax ID</Label><Input id="bd-tax" v-model="draft.taxId" /></div>
        </form>
        <DialogFooter>
          <Button variant="outline" @click="detailsOpen = false">Cancel</Button>
          <Button type="submit" form="details-form">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>
