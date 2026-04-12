export interface SMEData {
  past_invoices: number
  paid_on_time: number
  avg_invoice_amount: number
  std_deviation: number
}

export function calculateTrustScore(data: SMEData): number {
  const { past_invoices, paid_on_time, avg_invoice_amount, std_deviation } = data

  const reliability =
    past_invoices === 0
      ? 24
      : (paid_on_time / past_invoices) * 100 * 0.4

  const frequency = Math.min(past_invoices / 10, 1) * 100 * 0.3

  const consistency =
    avg_invoice_amount === 0
      ? 0
      : Math.max(0, 100 - (std_deviation / avg_invoice_amount) * 100) * 0.3

  return Math.floor(reliability + frequency + consistency)
}

export function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score >= 80) return 'LOW'
  if (score >= 60) return 'MEDIUM'
  return 'HIGH'
}

export function getRiskColor(risk: string): '#22c55e' | '#f59e0b' | '#ef4444' {
  if (risk === 'LOW') return '#22c55e'
  if (risk === 'MEDIUM') return '#f59e0b'
  return '#ef4444'
}

export function getBorrowLimit(amount: number, score: number): number {
  return Math.floor((amount * score) / 100)
}

export function getMockSMEData(): SMEData {
  return {
    past_invoices: 7,
    paid_on_time: 6,
    avg_invoice_amount: 8000,
    std_deviation: 1200,
  }
}
