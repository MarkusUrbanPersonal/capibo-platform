import { defineSchema, defineTable } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'
import { v } from 'convex/values'

export const roles = v.union(
  v.literal('Owner'),
  v.literal('Admin'),
  v.literal('Data engineer'),
  v.literal('Developer'),
  v.literal('Billing'),
  v.literal('Viewer'),
)

export const missionStatus = v.union(
  v.literal('draft'),
  v.literal('dispatching'),
  v.literal('active'),
  v.literal('paused'),
  v.literal('completed'),
)

export const videoStatus = v.union(v.literal('processing'), v.literal('accepted'), v.literal('rejected'))

export const exportStatus = v.union(v.literal('queued'), v.literal('packaging'), v.literal('ready'), v.literal('failed'))

export const EVENT_TYPES = ['video.accepted', 'video.rejected', 'mission.completed', 'export.ready', 'balance.low']

export default defineSchema({
  ...authTables,

  // Convex Auth's users table, plus the company typed at sign-up (used once to name the new organization).
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    company: v.optional(v.string()),
  })
    .index('email', ['email'])
    .index('phone', ['phone']),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    publicId: v.string(), // org_xxxxxxxxxx, sent as the Capibo-Organization header
    website: v.string(),
    contact: v.string(),
    region: v.optional(v.string()), // legacy, no longer set or shown
    plan: v.string(),
    balance: v.number(),
    monthlyBudget: v.number(),
    autoRecharge: v.object({ enabled: v.boolean(), threshold: v.number(), amount: v.number() }),
    billingDetails: v.object({
      company: v.string(),
      email: v.string(),
      address: v.string(),
      city: v.string(),
      country: v.string(),
      taxId: v.string(),
    }),
    retention: v.object({
      raw: v.string(),
      rejected: v.string(),
      derived: v.string(),
      autoDelete: v.boolean(),
      // Legacy, no longer set or shown. Optional so organizations created earlier still validate.
      blurFaces: v.optional(v.boolean()),
      exportLogs: v.optional(v.boolean()),
    }),
    // Last number handed out for MSN-/DS- references. Unset until the first mission.
    seq: v.optional(v.object({ mission: v.number(), dataset: v.number() })),
  }).index('by_publicId', ['publicId']),

  // One row per person in an organization. Invites are rows without a userId until that email signs up.
  members: defineTable({
    orgId: v.id('organizations'),
    userId: v.optional(v.id('users')),
    email: v.string(),
    name: v.string(),
    role: roles,
    pending: v.boolean(),
    lastActiveAt: v.optional(v.number()),
  })
    .index('by_org', ['orgId'])
    .index('by_user', ['userId'])
    .index('by_email', ['email']),

  transactions: defineTable({
    orgId: v.id('organizations'),
    ref: v.string(), // TXN-xxxxx, shown as the reference
    description: v.string(),
    amount: v.number(),
    status: v.union(v.literal('succeeded'), v.literal('pending'), v.literal('failed')),
    kind: v.union(v.literal('credit'), v.literal('promo'), v.literal('invoice')),
    promoCode: v.optional(v.string()),
    userId: v.optional(v.id('users')),
  })
    .index('by_org', ['orgId'])
    .index('by_org_promo', ['orgId', 'promoCode']),

  promoCodes: defineTable({
    code: v.string(),
    amount: v.number(),
    label: v.string(),
    active: v.boolean(),
  }).index('by_code', ['code']),

  // Only a SHA-256 hash of each secret is stored; the full key is returned once at creation.
  apiKeys: defineTable({
    orgId: v.id('organizations'),
    name: v.string(),
    prefix: v.string(),
    hash: v.string(),
    scope: v.string(),
    createdBy: v.id('users'),
    lastUsedAt: v.optional(v.number()),
  })
    .index('by_org', ['orgId'])
    .index('by_hash', ['hash']),

  // A data-collection project. Its dataset is the mission's accepted videos, so
  // dataset fields live here too and `datasetRef` is set at the first acceptance.
  missions: defineTable({
    orgId: v.id('organizations'),
    ref: v.string(), // MSN-1001
    name: v.string(),
    description: v.string(),
    status: missionStatus,
    regions: v.array(v.string()),
    guidelines: v.array(v.string()),
    icon: v.optional(v.string()), // lib/visuals.js; picked by the planner
    tone: v.optional(v.string()),
    tasks: v.array(
      v.object({
        id: v.string(), // T-1
        name: v.string(),
        instructions: v.string(),
        videos: v.number(),
        duration: v.array(v.number()), // [min, max] seconds
        labels: v.array(v.string()),
        icon: v.optional(v.string()), // lib/visuals.js; picked by the planner
        tone: v.optional(v.string()),
        price: v.number(),
        submitted: v.number(),
        accepted: v.number(),
        rejected: v.number(),
        acceptedSeconds: v.number(),
      }),
    ),
    target: v.number(),
    submitted: v.number(),
    accepted: v.number(),
    rejected: v.number(),
    cost: v.number(),
    acceptedSeconds: v.number(),
    qualitySum: v.number(), // sum of accepted videos' quality scores
    datasetRef: v.optional(v.string()), // DS-301
    datasetVersion: v.optional(v.string()),
    lastAcceptedAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    source: v.union(v.literal('platform'), v.literal('api')),
    createdBy: v.optional(v.id('users')),
    // Deleted from the platform: hidden from mission lists, its dataset stays.
    deletedAt: v.optional(v.number()),
  })
    .index('by_org', ['orgId'])
    .index('by_org_and_status', ['orgId', 'status'])
    .index('by_org_and_ref', ['orgId', 'ref'])
    .index('by_org_and_datasetRef', ['orgId', 'datasetRef'])
    .index('by_status', ['status']), // open missions across organizations, for the collector app

  videos: defineTable({
    orgId: v.id('organizations'),
    missionId: v.id('missions'),
    ref: v.string(), // VID-12345678
    taskId: v.string(),
    status: videoStatus,
    quality: v.union(v.number(), v.null()),
    rejectionReason: v.union(v.string(), v.null()),
    duration: v.number(),
    resolution: v.string(),
    fps: v.number(),
    sizeMb: v.number(),
    device: v.string(),
    collectorId: v.string(),
    region: v.string(),
    labels: v.array(v.string()),
    checks: v.union(
      v.object({
        handsInFrame: v.boolean(),
        lighting: v.number(),
        blur: v.number(),
        taskComplete: v.boolean(),
        privacy: v.boolean(),
      }),
      v.null(),
    ),
    fileId: v.optional(v.id('_storage')),
    annotationsFileId: v.optional(v.id('_storage')),
    submittedOn: v.string(), // YYYY-MM-DD, the usage row it counts towards
    reviewedAt: v.optional(v.number()),
  })
    .index('by_mission_and_status', ['missionId', 'status'])
    .index('by_org_and_ref', ['orgId', 'ref'])
    .index('by_fileId', ['fileId']),

  // Daily counters per mission, written as videos are submitted and reviewed.
  usageDaily: defineTable({
    orgId: v.id('organizations'),
    missionId: v.id('missions'),
    date: v.string(), // YYYY-MM-DD
    submitted: v.number(),
    accepted: v.number(),
    rejected: v.number(),
    cost: v.number(),
  })
    .index('by_org_and_date', ['orgId', 'date'])
    .index('by_mission_and_date', ['missionId', 'date']),

  exports: defineTable({
    orgId: v.id('organizations'),
    missionId: v.id('missions'),
    ref: v.string(), // EXP-20931
    status: exportStatus,
    format: v.string(),
    destination: v.string(),
    taskIds: v.union(v.array(v.string()), v.null()),
    createdAfter: v.union(v.number(), v.null()),
    includeRejected: v.boolean(),
    blurFaces: v.boolean(),
    videos: v.number(),
    fileId: v.optional(v.id('_storage')),
    url: v.optional(v.string()),
    error: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index('by_org_and_ref', ['orgId', 'ref'])
    .index('by_mission', ['missionId']),

  webhooks: defineTable({
    orgId: v.id('organizations'),
    ref: v.string(), // wh_3kd92m
    url: v.string(),
    events: v.array(v.string()),
    secret: v.string(), // whsec_…, needed to sign deliveries
  })
    .index('by_org', ['orgId'])
    .index('by_org_and_ref', ['orgId', 'ref']),

  // One row per event per endpoint, retried with backoff until delivered or 3 days old.
  webhookDeliveries: defineTable({
    webhookId: v.id('webhooks'),
    eventId: v.string(),
    type: v.string(),
    payload: v.string(), // the exact JSON body that gets signed
    attempts: v.number(),
    status: v.union(v.literal('pending'), v.literal('succeeded'), v.literal('failed')),
    lastError: v.optional(v.string()),
  }).index('by_webhook', ['webhookId']),

  // Responses replayed for a repeated Idempotency-Key, kept 24 hours.
  idempotencyKeys: defineTable({
    orgId: v.id('organizations'),
    key: v.string(),
    route: v.string(),
    status: v.number(),
    body: v.string(),
    expiresAt: v.number(),
  })
    .index('by_org_and_key', ['orgId', 'key'])
    .index('by_expiresAt', ['expiresAt']),
})
