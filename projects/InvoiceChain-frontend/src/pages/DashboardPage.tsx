import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { useSnackbar } from 'notistack'
import { useNavigate } from 'react-router-dom'
import { useInvoice } from '../context/InvoiceContext'
import { getRiskColor } from '../lib/trustScore'
import { loraBase } from '../utils/lora'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { InvoiceClient } from '../contracts/Invoice'

// ── Thin arc gauge ───────────────────────────────────────────────
const R = 38
const CIRC = 2 * Math.PI * R

function ArcGauge({ score, color }: { score: number; color: string }) {
  const offset = CIRC * (1 - score / 100)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={R} fill="none" stroke="var(--ic-border)" strokeWidth="3" />
        <motion.circle
          cx="48" cy="48" r={R}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="square"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={CIRC}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div
          className="num"
          style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1, letterSpacing: '-0.02em' }}
        >
          {score}
        </div>
        <div style={{ fontSize: 9, color: 'var(--ic-text-muted)', letterSpacing: '0.08em', marginTop: 2 }}>
          /100
        </div>
      </div>
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, delay = 0,
}: {
  label: string; value: string; sub?: string; color?: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      style={{
        background: 'var(--ic-surface)',
        border: '1px solid var(--ic-border)',
        padding: '20px 20px 18px',
      }}
    >
      <div className="label-caps" style={{ marginBottom: 12 }}>{label}</div>
      <div
        className="num"
        style={{
          fontSize: 26,
          fontWeight: 600,
          color: color ?? 'var(--ic-accent)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="num" style={{ fontSize: 10, color: 'var(--ic-text-muted)', marginTop: 6, letterSpacing: '0.04em' }}>
          {sub}
        </div>
      )}
    </motion.div>
  )
}

// ── Risk pill ────────────────────────────────────────────────────
function RiskDot({ risk }: { risk: string }) {
  const color = getRiskColor(risk)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      <span className="num" style={{ fontSize: 11, color, letterSpacing: '0.06em' }}>{risk}</span>
    </span>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const [refreshing, setRefreshing] = useState(false)
  const [repaying, setRepaying] = useState(false)
  const lora = loraBase()

  const riskColor = getRiskColor(ctx.riskLevel || 'HIGH')
  const poolAlgo = (Number(ctx.poolBalance) / 1_000_000).toFixed(3)
  const utilisation = ctx.borrowLimit > 0
    ? Math.min(100, Math.round((Number(ctx.borrowedAmount) / ctx.borrowLimit) * 100))
    : 0

  const refreshState = async () => {
    if (!ctx.appClient) return
    setRefreshing(true)
    try {
      const [info, poolResult] = await Promise.all([
        ctx.appClient.getInvoiceInfo(),
        (ctx.appClient as InvoiceClient).send.getPoolBalance({ args: [] }),
      ])
      const [, , , riskLevel, borrowLimit, isBorrowed, borrowedAmount, nftAssetId] = info
      ctx.setRiskLevel(riskLevel)
      ctx.setBorrowLimit(Number(borrowLimit))
      ctx.setIsBorrowed(Boolean(isBorrowed))
      ctx.setBorrowedAmount(borrowedAmount)
      ctx.setNftAssetId(nftAssetId)
      ctx.setPoolBalance(poolResult.return ?? 0n)
    } catch { /* not yet initialised */ }
    finally { setRefreshing(false) }
  }

  useEffect(() => {
    if (ctx.appClient && activeAddress) void refreshState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.appClient, activeAddress])

  const handleRepay = async () => {
    if (!activeAddress || !ctx.appClient || !ctx.appAddress) {
      enqueueSnackbar('Wallet or contract not ready', { variant: 'warning' })
      return
    }
    setRepaying(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      await ctx.appClient.send.repay({
        args: {
          payment: algorand.createTransaction.payment({
            sender: activeAddress,
            receiver: ctx.appAddress,
            amount: microAlgos(Number(ctx.borrowedAmount)),
          }),
        },
        sender: activeAddress,
      })

      ctx.setIsBorrowed(false)
      ctx.setBorrowedAmount(0n)
      enqueueSnackbar('Loan repaid successfully!', { variant: 'success' })
      void refreshState()
    } catch (err: unknown) {
      enqueueSnackbar(`Repay failed: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' })
    } finally {
      setRepaying(false)
    }
  }

  // Invoice row data (single invoice per wallet in current design)
  const hasInvoice = ctx.nftAssetId !== null
  const invoiceRow = hasInvoice
    ? {
        id: ctx.nftAssetId !== null ? String(ctx.nftAssetId) : '—',
        amount: ctx.amount ? `₹${ctx.amount.toLocaleString('en-IN')}` : '—',
        dueDate: ctx.dueDate || '—',
        score: ctx.trustScore,
        risk: ctx.riskLevel || '—',
        status: ctx.isBorrowed ? 'BORROWED' : 'COLLATERAL',
        txnId: ctx.mintTxnId,
      }
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Gold accent line */}
      <div style={{ height: 2, background: 'var(--ic-accent)', marginBottom: 28 }} />

      {/* App ID link */}
      {ctx.appId !== null && (
        <div style={{ marginBottom: 20 }}>
          <a
            href={`${lora}/application/${ctx.appId}`}
            target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: 'var(--ic-text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ic-accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ic-text-muted)')}
          >
            APP / {String(ctx.appId)} ↗
          </a>
        </div>
      )}

      {/* ── 4 stat cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--ic-border)',
          border: '1px solid var(--ic-border)',
          marginBottom: 28,
        }}
      >
        {/* Trust Score — arc card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0, duration: 0.3 }}
          style={{
            background: 'var(--ic-surface)',
            padding: '20px 20px 18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <div className="label-caps" style={{ marginBottom: 12 }}>Trust Score</div>
          <div style={{ alignSelf: 'center', marginTop: 4 }}>
            <ArcGauge score={ctx.trustScore} color={riskColor} />
          </div>
          {ctx.riskLevel && (
            <div style={{ marginTop: 10, alignSelf: 'center' }}>
              <RiskDot risk={ctx.riskLevel} />
            </div>
          )}
        </motion.div>

        <StatCard
          delay={0.05}
          label="Borrow Limit"
          value={`₹${ctx.borrowLimit.toLocaleString('en-IN')}`}
          sub={`${utilisation}% utilised`}
        />
        <StatCard
          delay={0.1}
          label="Pool Balance"
          value={`${poolAlgo}`}
          sub="ALGO available"
          color="var(--ic-positive)"
        />
        <StatCard
          delay={0.15}
          label="Active Loans"
          value={ctx.isBorrowed ? '1' : '0'}
          sub={ctx.isBorrowed ? `₹${Number(ctx.borrowedAmount).toLocaleString('en-IN')} outstanding` : 'No open positions'}
          color={ctx.isBorrowed ? 'var(--ic-warning)' : 'var(--ic-text-muted)'}
        />
      </div>

      {/* ── Refresh button ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button
          onClick={() => void refreshState()}
          disabled={refreshing || !ctx.appClient}
          className="btn-ghost"
          style={{ fontSize: 10, padding: '5px 14px', opacity: refreshing ? 0.5 : 1 }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Invoice table ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        style={{ marginBottom: 28 }}
      >
        <div style={{ marginBottom: 10 }}>
          <span className="label-caps">Invoice Positions</span>
        </div>

        {/* Loading bar when refreshing */}
        {refreshing && <div className="ic-loading-bar" style={{ marginBottom: 2 }} />}

        <div style={{ border: '1px solid var(--ic-border)', overflow: 'hidden' }}>
          <table className="ic-table">
            <thead>
              <tr>
                {['Invoice ID', 'Amount', 'Due Date', 'Score', 'Risk', 'Status', 'Action'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoiceRow ? (
                <tr>
                  <td>
                    <a
                      href={`${lora}/asset/${invoiceRow.id}`}
                      target="_blank" rel="noreferrer"
                      className="num"
                      style={{ fontSize: 12, color: 'var(--ic-accent)', textDecoration: 'none', letterSpacing: '0.04em' }}
                    >
                      {invoiceRow.id} ↗
                    </a>
                  </td>
                  <td>
                    <span className="num" style={{ color: 'var(--ic-text)' }}>{invoiceRow.amount}</span>
                  </td>
                  <td>
                    <span className="num" style={{ fontSize: 12 }}>{invoiceRow.dueDate}</span>
                  </td>
                  <td>
                    <span className="num" style={{ fontSize: 13, color: riskColor, fontWeight: 600 }}>
                      {invoiceRow.score}
                    </span>
                  </td>
                  <td>
                    <RiskDot risk={invoiceRow.risk} />
                  </td>
                  <td>
                    <span
                      className="num"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        color: invoiceRow.status === 'BORROWED' ? 'var(--ic-warning)' : 'var(--ic-positive)',
                      }}
                    >
                      {invoiceRow.status}
                    </span>
                  </td>
                  <td>
                    {ctx.isBorrowed ? (
                      <button
                        onClick={handleRepay}
                        disabled={repaying}
                        className="btn-ghost"
                        style={{ fontSize: 10, padding: '4px 10px', color: 'var(--ic-warning)', borderColor: 'var(--ic-warning)' }}
                      >
                        {repaying ? 'Repaying…' : 'Repay'}
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/app/borrow')}
                        className="btn-ghost"
                        style={{ fontSize: 10, padding: '4px 10px' }}
                      >
                        Borrow
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--ic-text-muted)', fontSize: 12 }}
                  >
                    No invoice positions.{' '}
                    <button
                      onClick={() => navigate('/app/upload')}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--ic-accent)',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        textDecoration: 'underline',
                      }}
                    >
                      Upload your first invoice →
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Mint txn link ── */}
      {ctx.mintTxnId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ borderTop: '1px solid var(--ic-border-subtle)', paddingTop: 14 }}
        >
          <span className="label-caps" style={{ marginRight: 10 }}>Mint Transaction</span>
          <a
            href={`${lora}/transaction/${ctx.mintTxnId}`}
            target="_blank" rel="noreferrer"
            className="num"
            style={{ fontSize: 11, color: 'var(--ic-text-muted)', textDecoration: 'none', letterSpacing: '0.04em' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ic-accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ic-text-muted)')}
          >
            {ctx.mintTxnId.slice(0, 20)}… ↗
          </a>
        </motion.div>
      )}
    </div>
  )
}
