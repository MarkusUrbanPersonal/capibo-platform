// Documents → the REST API's JSON shapes (docs/openapi.yaml), in snake_case.

const round2 = (n) => Math.round(n * 100) / 100

/** ISO 8601 in UTC without milliseconds, or null. */
export const iso = (ms) => (ms == null ? null : new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z'))

export const progressOf = (m) => Math.min(100, Math.round((m.accepted / Math.max(1, m.target)) * 100))

export function missionJson(m) {
  return {
    id: m.ref,
    name: m.name,
    description: m.description,
    status: m.status,
    regions: m.regions,
    target: m.target,
    accepted: m.accepted,
    progress: progressOf(m),
    cost: round2(m.cost),
    tasks: m.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      instructions: t.instructions,
      videos: t.videos,
      duration: t.duration,
      labels: t.labels,
      price: t.price,
      accepted: t.accepted,
    })),
    guidelines: m.guidelines,
    dataset_id: m.datasetRef ?? null,
    created_at: iso(m._creationTime),
    started_at: iso(m.startedAt),
    completed_at: iso(m.completedAt),
  }
}

/** A mission's dataset. Only call for missions with a `datasetRef`. */
export function datasetJson(m) {
  const version = m.datasetVersion ?? 'v1.0'
  return {
    id: m.datasetRef,
    name: `${m.name} · ${version}`,
    mission_id: m.ref,
    version,
    videos: m.accepted,
    hours: Math.round((m.acceptedSeconds / 3600) * 10) / 10,
    avg_quality: m.accepted ? Math.round(m.qualitySum / m.accepted) : null,
    updated_at: iso(m.lastAcceptedAt),
  }
}

export async function videoJson(ctx, v, m) {
  const task = m.tasks.find((t) => t.id === v.taskId)
  return {
    id: v.ref,
    mission_id: m.ref,
    dataset_id: m.datasetRef ?? null,
    task_id: v.taskId,
    task: task?.name ?? v.taskId,
    status: v.status,
    quality: v.quality,
    rejection_reason: v.rejectionReason,
    duration: v.duration,
    resolution: v.resolution,
    fps: v.fps,
    size_mb: v.sizeMb,
    device: v.device,
    collector_id: v.collectorId,
    region: v.region,
    labels: v.labels,
    checks: v.checks && {
      hands_in_frame: v.checks.handsInFrame,
      lighting: v.checks.lighting,
      blur: v.checks.blur,
      task_complete: v.checks.taskComplete,
      privacy: v.checks.privacy,
    },
    download_url: v.status === 'accepted' && v.fileId ? await ctx.storage.getUrl(v.fileId) : null,
    annotations_url: v.annotationsFileId ? await ctx.storage.getUrl(v.annotationsFileId) : null,
    created_at: iso(v._creationTime),
  }
}

export function exportJson(e, m) {
  return {
    id: e.ref,
    dataset_id: m.datasetRef ?? null,
    status: e.status,
    format: e.format,
    destination: e.destination,
    videos: e.videos,
    url: e.url ?? null,
    error: e.error ?? null,
    created_at: iso(e._creationTime),
    completed_at: iso(e.completedAt),
  }
}

export function transactionJson(t) {
  return {
    id: t.ref,
    kind: t.kind,
    description: t.description,
    amount: t.amount,
    status: t.status,
    created_at: iso(t._creationTime),
  }
}

export function balanceJson(org) {
  return { balance: round2(org.balance), currency: 'USD', auto_recharge: org.autoRecharge }
}

export function webhookJson(w) {
  return { id: w.ref, url: w.url, events: w.events, created_at: iso(w._creationTime) }
}
