import React, { useState } from 'react'
import { calculateTrustScore, getBorrowLimit, getMockSMEData, getRiskColor, getRiskLevel } from '../lib/trustScore'
import { useInvoice } from '../context/InvoiceContext'

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS // ≈ 339.29

interface ScoreGaugeProps {
  score: number
  color: string
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, color }) => {
  const offset = CIRCUMFERENCE * (1 - score / 100)
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="160" height="160" viewBox="0 0 120 120">
        {/* Track */}
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        {/* Arc */}
        <circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center pointer-events-none">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-base-content/50">/ 100</span>
      </div>
    </div>
  )
}

const UploadInvoice: React.FC = () => {
  const ctx = useInvoice()

  const [localName, setLocalName] = useState(ctx.businessName)
  const [localAmount, setLocalAmount] = useState(ctx.amount || '')
  const [localDueDate, setLocalDueDate] = useState(ctx.dueDate)
  const [submitted, setSubmitted] = useState(ctx.trustScore > 0)
  const [score, setScore] = useState(ctx.trustScore)
  const [risk, setRisk] = useState(ctx.riskLevel)
  const [limit, setLimit] = useState(ctx.borrowLimit)
  const [color, setColor] = useState(getRiskColor(ctx.riskLevel || 'HIGH'))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(localAmount)
    if (!localName || !amt || !localDueDate) return

    const sme = getMockSMEData()
    const computed = calculateTrustScore(sme)
    const riskLvl = getRiskLevel(computed)
    const riskClr = getRiskColor(riskLvl)
    const bLimit = getBorrowLimit(amt, computed)

    setScore(computed)
    setRisk(riskLvl)
    setColor(riskClr)
    setLimit(bLimit)
    setSubmitted(true)

    ctx.setBusinessName(localName)
    ctx.setAmount(amt)
    ctx.setDueDate(localDueDate)
    ctx.setTrustScore(computed)
    ctx.setRiskLevel(riskLvl)
    ctx.setBorrowLimit(bLimit)
  }

  const riskBadgeClass =
    risk === 'LOW' ? 'badge badge-success' :
    risk === 'MEDIUM' ? 'badge badge-warning' :
    'badge badge-error'

  return (
    <div className="space-y-6">
      {/* Form card */}
      <div className="card bg-base-100 shadow-md border border-base-200">
        <div className="card-body">
          <h2 className="card-title text-lg">Invoice Details</h2>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Business Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="e.g. Sharma Traders Pvt Ltd"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Invoice Amount (₹)</span>
              </label>
              <input
                type="number"
                className="input input-bordered w-full"
                placeholder="e.g. 10000"
                min={1}
                value={localAmount}
                onChange={(e) => setLocalAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Due Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={localDueDate}
                onChange={(e) => setLocalDueDate(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full">
              Analyse Invoice
            </button>
          </form>
        </div>
      </div>

      {/* Score result card */}
      {submitted && (
        <div className="card bg-base-100 shadow-md border border-base-200">
          <div className="card-body items-center text-center space-y-4">
            <h2 className="card-title">Trust Score Analysis</h2>

            <ScoreGauge score={score} color={color} />

            <div className="flex items-center gap-3">
              <span className="text-sm text-base-content/60">Risk Level</span>
              <span className={riskBadgeClass}>{risk}</span>
            </div>

            <div className="stats shadow w-full">
              <div className="stat place-items-center">
                <div className="stat-title">Invoice Amount</div>
                <div className="stat-value text-2xl">₹{Number(localAmount).toLocaleString('en-IN')}</div>
              </div>
              <div className="stat place-items-center">
                <div className="stat-title">Available to Borrow</div>
                <div className="stat-value text-2xl" style={{ color }}>
                  ₹{limit.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="alert alert-info text-sm w-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Score based on SME repayment history: 6/7 invoices paid on time
            </div>

            <button
              className="btn btn-primary w-full"
              onClick={() => ctx.setStep(2)}
            >
              Continue to Mint NFT →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UploadInvoice
