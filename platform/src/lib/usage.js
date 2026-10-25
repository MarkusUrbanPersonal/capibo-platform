/** Totals of daily usage rows (submitted, processing, processed, accepted, rejected, cost). */
export function sumRows(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.submitted += r.submitted
      acc.processing += r.processing
      acc.processed += r.processed
      acc.accepted += r.accepted
      acc.rejected += r.rejected
      acc.cost += r.cost
      return acc
    },
    { submitted: 0, processing: 0, processed: 0, accepted: 0, rejected: 0, cost: 0 },
  )
}
