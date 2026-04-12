import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { useSnackbar } from 'notistack'
import { useNavigate } from 'react-router-dom'
import { useInvoice } from '../context/InvoiceContext'
import { calculateTrustScore, getBorrowLimit, getMockSMEData, getRiskColor, getRiskLevel } from '../lib/trustScore'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { InvoiceFactory } from '../contracts/Invoice'
import { loraBase } from '../utils/lora'

// ── Thin arc gauge (score reveal) ───────────────────────────────
const R = 48
const CIRC = 2 * Math.PI * R

function ScoreArc({ score, color }: { score: number; color: string }) {
  const offset = CIRC * (1 - score / 100)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--ic-border)" strokeWidth="2.5" />
        <motion.circle
          cx="60" cy="60" r={R}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="square"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={CIRC}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.3, ease: 'easeOut', delay: 0.1 }}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <motion.div
          className="num"
          style={{ fontSize: 28, fontWeight: 600, color, lineHeight: 1, letterSpacing: '-0.02em' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {score}
        </motion.div>
        <div style={{ fontSize: 9, color: 'var(--ic-text-muted)', letterSpacing: '0.1em', marginTop: 3 }}>/ 100</div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function UploadPage() {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const lora = loraBase()

  // Form fields
  const [invoiceNo, setInvoiceNo] = useState('')
  const [client, setClient] = useState(ctx.businessName)
  const [amount, setAmount] = useState(ctx.amount ? String(ctx.amount) : '')
  const [dueDate, setDueDate] = useState(ctx.dueDate)

  // Score state
  const [scored, setScored] = useState(ctx.trustScore > 0)
  const [score, setScore] = useState<number | null>(ctx.trustScore > 0 ? ctx.trustScore : null)
  const [riskLevel, setRiskLevel] = useState(ctx.riskLevel)
  const [borrowLimit, setBorrowLimit] = useState(ctx.borrowLimit)

  // Mint state
  const [minting, setMinting] = useState(false)
  const scoreRef = useRef<HTMLDivElement>(null)

  const riskColor = score !== null ? getRiskColor(riskLevel || 'HIGH') : 'var(--ic-text-muted)'

  const handleScore = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!client || !amt || !dueDate) {
      enqueueSnackbar('Fill in all fields first', { variant: 'warning' })
      return
    }
    const sme = getMockSMEData()
    const computed = calculateTrustScore(sme)
    const risk = getRiskLevel(computed)
    const limit = getBorrowLimit(amt, computed)

    setScore(computed)
    setRiskLevel(risk)
    setBorrowLimit(limit)
    setScored(true)

    ctx.setBusinessName(client)
    ctx.setAmount(amt)
    ctx.setDueDate(dueDate)
    ctx.setTrustScore(computed)
    ctx.setRiskLevel(risk)
    ctx.setBorrowLimit(limit)

    setTimeout(() => scoreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }

  const handleMint = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Connect your wallet first', { variant: 'warning' })
      return
    }
    setMinting(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      const factory = new InvoiceFactory({ defaultSender: activeAddress, algorand })
      const { appClient } = await factory.deploy({ onSchemaBreak: 'append', onUpdate: 'append' })
      const appAddress = String(appClient.appClient.appAddress)

      await appClient.send.seedPool({
        args: {
          payment: algorand.createTransaction.payment({
            sender: activeAddress,
            receiver: appAddress,
            amount: microAlgos(1_000_000),
          }),
        },
        sender: activeAddress,
      })

      const dueDateUnix = dueDate
        ? BigInt(Math.floor(new Date(dueDate).getTime() / 1000))
        : 2_000_000_000n

      const result = await appClient.send.createInvoice({
        args: {
          amount: BigInt(ctx.amount),
          dueDate: dueDateUnix,
          trustScore: BigInt(ctx.trustScore),
        },
        extraFee: microAlgos(1000),
      })

      const assetId = result.return as bigint
      const txnId = result.transaction.txID()

      ctx.setAppId(BigInt(appClient.appClient.appId))
      ctx.setAppAddress(appAddress)
      ctx.setNftAssetId(assetId)
      ctx.setMintTxnId(txnId)
      ctx.setAppClient(appClient)

      enqueueSnackbar(`NFT minted. Asset ID: ${assetId}`, { variant: 'success' })
    } catch (err: unknown) {
      enqueueSnackbar(`Mint failed: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' })
    } finally {
      setMinting(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--ic-text-muted)',
    fontFamily: "'IBM Plex Sans', sans-serif",
    marginBottom: 6,
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Gold accent line */}
      <div style={{ height: 2, background: 'var(--ic-accent)', marginBottom: 28 }} />

      {/* ── Invoice form ── */}
      <form onSubmit={handleScore} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Invoice No + Client */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Invoice Number</label>
            <input
              type="text"
              placeholder="INV-2024-001"
              value={invoiceNo}
              onChange={e => setInvoiceNo(e.target.value)}
              className="ic-input"
            />
          </div>
          <div>
            <label style={labelStyle}>Client / Business Name</label>
            <input
              type="text"
              required
              placeholder="Sharma Traders Pvt Ltd"
              value={client}
              onChange={e => setClient(e.target.value)}
              className="ic-input-text"
            />
          </div>
        </div>

        {/* Amount + Due Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Invoice Amount (₹)</label>
            <input
              type="number"
              min={1}
              required
              placeholder="50000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="ic-input"
            />
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="ic-input"
              style={{
                background: 'var(--ic-surface)',
                border: '1px solid var(--ic-border)',
                borderRadius: 2,
                color: 'var(--ic-text)',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13,
                padding: '8px 12px',
                width: '100%',
                outline: 'none',
                colorScheme: 'dark',
              }}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', letterSpacing: '0.1em' }}>
          Calculate Trust Score →
        </button>
      </form>

      {/* ── Score reveal ── */}
      <AnimatePresence>
        {scored && score !== null && (
          <motion.div
            ref={scoreRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginTop: 28,
                border: '1px solid var(--ic-border)',
                background: 'var(--ic-surface)',
                padding: 28,
              }}
            >
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <span className="label-caps">Trust Score Analysis</span>
                <span
                  className="risk-pill"
                  style={{
                    color: riskColor,
                    borderColor: riskColor,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: riskColor, display: 'inline-block' }} />
                  {riskLevel} RISK
                </span>
              </div>

              {/* Arc + stats row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <ScoreArc score={score} color={riskColor} />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Borrow limit */}
                  <div style={{ borderBottom: '1px solid var(--ic-border-subtle)', paddingBottom: 14 }}>
                    <div className="label-caps" style={{ marginBottom: 6 }}>Maximum Borrow Limit</div>
                    <div
                      className="num"
                      style={{ fontSize: 32, fontWeight: 600, color: 'var(--ic-accent)', letterSpacing: '-0.02em', lineHeight: 1 }}
                    >
                      ₹{borrowLimit.toLocaleString('en-IN')}
                    </div>
                    <div
                      className="num"
                      style={{ fontSize: 10, color: 'var(--ic-text-muted)', marginTop: 4, letterSpacing: '0.04em' }}
                    >
                      = ₹{Number(amount).toLocaleString('en-IN')} × {score}%
                    </div>
                  </div>

                  {/* Score breakdown note */}
                  <div style={{ fontSize: 11, color: 'var(--ic-text-muted)', lineHeight: 1.6 }}>
                    Based on SME repayment history: 6/7 invoices paid on time.
                    Reliability 40% + Frequency 30% + Consistency 30%.
                  </div>
                </div>
              </div>

              {/* Mint section */}
              <div style={{ marginTop: 24, borderTop: '1px solid var(--ic-border)', paddingTop: 20 }}>
                {ctx.nftAssetId !== null ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div className="label-caps" style={{ marginBottom: 4 }}>Invoice NFT Minted</div>
                      <a
                        href={`${lora}/asset/${ctx.nftAssetId}`}
                        target="_blank" rel="noreferrer"
                        className="num"
                        style={{ fontSize: 12, color: 'var(--ic-accent)', textDecoration: 'none', letterSpacing: '0.04em' }}
                      >
                        Asset {String(ctx.nftAssetId)} ↗
                      </a>
                    </div>
                    <button className="btn-primary" onClick={() => navigate('/app/borrow')}>
                      Borrow Funds →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--ic-text-muted)' }}>
                      Mint your invoice as an ARC-3 NFT on Algorand to use it as collateral.
                    </div>
                    <button
                      onClick={handleMint}
                      disabled={minting || !activeAddress}
                      className="btn-primary"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {minting ? (
                        <>
                          <span className="ic-loading-bar" style={{ width: 50, display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                          Minting…
                        </>
                      ) : (
                        'Mint Invoice NFT →'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoice preview table */}
      {(client || amount || dueDate) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{ marginTop: 28 }}
        >
          <div className="label-caps" style={{ marginBottom: 10 }}>Invoice Preview</div>
          <div style={{ border: '1px solid var(--ic-border)', overflow: 'hidden' }}>
            <table className="ic-table">
              <thead>
                <tr>
                  {['Invoice No.', 'Client', 'Amount (₹)', 'Due Date'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="num" style={{ fontSize: 12 }}>{invoiceNo || '—'}</span></td>
                  <td><span style={{ fontSize: 13, color: 'var(--ic-text)' }}>{client || '—'}</span></td>
                  <td>
                    <span className="num" style={{ fontSize: 13, color: 'var(--ic-text)' }}>
                      {amount ? Number(amount).toLocaleString('en-IN') : '—'}
                    </span>
                  </td>
                  <td><span className="num" style={{ fontSize: 12 }}>{dueDate || '—'}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
