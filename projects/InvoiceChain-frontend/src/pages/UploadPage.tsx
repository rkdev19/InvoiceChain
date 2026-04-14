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

// ── Arc gauge ────────────────────────────────────────────────────
const R = 48
const CIRC = 2 * Math.PI * R

function ScoreArc({ score, color }: { score: number; color: string }) {
  const offset = CIRC * (1 - score / 100)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--border-default)" strokeWidth="2" />
        <motion.circle
          cx="60" cy="60" r={R}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="square"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={CIRC}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <motion.div
          className="display"
          style={{ fontSize: 30, color, lineHeight: 1 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {score}
        </motion.div>
        <div className="mono" style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.10em', marginTop: 3 }}>/ 100</div>
      </div>
    </div>
  )
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontFamily: "'IBM Plex Sans', sans-serif",
  marginBottom: 6,
}

// ── Main Page ─────────────────────────────────────────────────────
export default function UploadPage() {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const lora = loraBase()

  const [invoiceNo, setInvoiceNo] = useState('')
  const [client, setClient] = useState(ctx.businessName)
  const [amount, setAmount] = useState(ctx.amount ? String(ctx.amount) : '')
  const [dueDate, setDueDate] = useState(ctx.dueDate)

  const [scored, setScored] = useState(ctx.trustScore > 0)
  const [score, setScore] = useState<number | null>(ctx.trustScore > 0 ? ctx.trustScore : null)
  const [riskLevel, setRiskLevel] = useState(ctx.riskLevel)
  const [borrowLimit, setBorrowLimit] = useState(ctx.borrowLimit)
  const [minting, setMinting] = useState(false)
  const scoreRef = useRef<HTMLDivElement>(null)

  const riskColor = score !== null ? getRiskColor(riskLevel || 'HIGH') : 'var(--text-muted)'

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

      // Deploy contract
      const factory = new InvoiceFactory({ defaultSender: activeAddress, algorand })
      const { appClient } = await factory.deploy({ onSchemaBreak: 'append', onUpdate: 'append' })
      const appAddress = String(appClient.appClient.appAddress)

      // Fund contract with 2 ALGO (MBR + inner txn fees for ICC creation)
      await algorand.send.payment({
        sender: activeAddress,
        receiver: appAddress,
        amount: microAlgos(2_000_000),
      })

      // Create the ICC ASA (inner txn — needs extra fee)
      const iccResult = await appClient.send.setupIcc({
        args: [],
        extraFee: microAlgos(1000),
        sender: activeAddress,
      })
      const iccAssetId = iccResult.return as bigint

      // Seed the pool with 1 ALGO for inner txn fees
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

      // Mint Invoice NFT (inner txn — extra fee)
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
      ctx.setIccAssetId(iccAssetId)
      ctx.setInvoiceStatus('ACTIVE')
      ctx.setCollateralLocked(false)
      ctx.setAppClient(appClient)

      enqueueSnackbar(`NFT minted. Asset ID: ${assetId}`, { variant: 'success' })
    } catch (err: unknown) {
      enqueueSnackbar(`Mint failed: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' })
    } finally {
      setMinting(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Gold accent rule */}
      <div style={{ height: 3, background: 'var(--accent-gold)', marginBottom: 28 }} />

      {/* ── Invoice form ── */}
      <form onSubmit={handleScore} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={LABEL}>Invoice Number</label>
            <input
              type="text"
              placeholder="INV-2024-001"
              value={invoiceNo}
              onChange={e => setInvoiceNo(e.target.value)}
              className="ic-input"
            />
          </div>
          <div>
            <label style={LABEL}>Client / Business Name</label>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={LABEL}>Invoice Amount (₹)</label>
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
            <label style={LABEL}>Due Date</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 2,
                color: 'var(--text-primary)',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13,
                padding: '8px 12px',
                width: '100%',
                outline: 'none',
                colorScheme: 'dark',
                transition: 'border-color 120ms',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>
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
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                padding: 28,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <span className="label-caps">Trust Score Analysis</span>
                <span
                  className="pill"
                  style={{ color: riskColor, borderColor: riskColor }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: riskColor, display: 'inline-block', marginRight: 5 }} />
                  {riskLevel} RISK
                </span>
              </div>

              {/* Arc + stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <ScoreArc score={score} color={riskColor} />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
                    <div className="label-caps" style={{ marginBottom: 6 }}>Maximum Borrow Limit</div>
                    <div
                      className="display"
                      style={{ fontSize: 34, color: 'var(--accent-gold)', lineHeight: 1 }}
                    >
                      ₹{borrowLimit.toLocaleString('en-IN')}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      = ₹{Number(amount).toLocaleString('en-IN')} × {score}%
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Based on SME repayment history: 6/7 invoices paid on time.
                    Reliability 40% + Frequency 30% + Consistency 30%.
                  </div>
                </div>
              </div>

              {/* Mint section */}
              <div style={{ marginTop: 24, borderTop: '1px solid var(--border-default)', paddingTop: 20 }}>
                {ctx.nftAssetId !== null ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div className="label-caps" style={{ marginBottom: 4 }}>Invoice NFT Minted</div>
                      <a
                        href={`${lora}/asset/${ctx.nftAssetId}`}
                        target="_blank" rel="noreferrer"
                        className="mono"
                        style={{ fontSize: 11, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em' }}
                      >
                        Asset {String(ctx.nftAssetId)} ↗
                      </a>
                      {ctx.iccAssetId !== null && (
                        <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.04em' }}>
                          ICC: {String(ctx.iccAssetId)}
                        </div>
                      )}
                    </div>
                    <button className="btn-primary" onClick={() => navigate('/app/borrow')}>
                      Borrow ICC →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 260 }}>
                      Mint your invoice as an ARC-3 NFT. This also creates the ICC token and seeds the lending pool.
                    </div>
                    <button
                      onClick={handleMint}
                      disabled={minting || !activeAddress}
                      className="btn-primary"
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {minting ? (
                        <>
                          <span className="loading-bar" style={{ width: 40, display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                          Deploying…
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
          <div className="label-caps" style={{ marginBottom: 8 }}>Invoice Preview</div>
          <div style={{ border: '1px solid var(--border-default)', overflow: 'hidden' }}>
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
                  <td><span className="mono" style={{ fontSize: 11 }}>{invoiceNo || '—'}</span></td>
                  <td><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{client || '—'}</span></td>
                  <td>
                    <span className="mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      {amount ? Number(amount).toLocaleString('en-IN') : '—'}
                    </span>
                  </td>
                  <td><span className="mono" style={{ fontSize: 11 }}>{dueDate || '—'}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
