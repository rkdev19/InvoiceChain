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

// ── Arc gauge ────────────────────────────────────────────────────
const R = 36
const CIRC = 2 * Math.PI * R

function ArcGauge({ score, color }: { score: number; color: string }) {
  const offset = CIRC * (1 - score / 100)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={R} fill="none" stroke="var(--border-default)" strokeWidth="2.5" />
        <motion.circle
          cx="44" cy="44" r={R}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="square"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={CIRC}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
          transform="rotate(-90 44 44)"
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div className="mono" style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {score}
        </div>
        <div className="mono" style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: 2 }}>
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        padding: '18px 20px 16px',
      }}
    >
      <div className="label-caps" style={{ marginBottom: 10 }}>{label}</div>
      <div
        className="mono"
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: color ?? 'var(--accent-gold)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.04em' }}>
          {sub}
        </div>
      )}
    </motion.div>
  )
}

// ── Risk dot ─────────────────────────────────────────────────────
function RiskDot({ risk }: { risk: string }) {
  const color = getRiskColor(risk)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      <span className="mono" style={{ fontSize: 10, color, letterSpacing: '0.06em' }}>{risk}</span>
    </span>
  )
}

// ── Status pill ──────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const color =
    status === 'ACTIVE'     ? 'var(--status-low)' :
    status === 'LIQUIDATED' ? 'var(--status-liquidated)' :
    'var(--status-medium)'
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        letterSpacing: '0.08em',
        color,
        border: `1px solid ${color}`,
        padding: '2px 6px',
        borderRadius: 2,
      }}
    >
      {status}
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
  const iccPool = Number(ctx.poolBalance)
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
      // 11-tuple: amount, due_date, trust_score, risk_level, borrow_limit,
      //           is_borrowed, borrowed_amount, nft_asset_id, collateral_locked, status, icc_asset_id
      const [, , , riskLevel, borrowLimit, isBorrowed, borrowedAmount, nftAssetId, collateralLocked, status, iccAssetId] = info
      ctx.setRiskLevel(riskLevel)
      ctx.setBorrowLimit(Number(borrowLimit))
      ctx.setIsBorrowed(Boolean(isBorrowed))
      ctx.setBorrowedAmount(borrowedAmount)
      ctx.setNftAssetId(nftAssetId)
      ctx.setCollateralLocked(Boolean(collateralLocked))
      ctx.setInvoiceStatus(status)
      ctx.setIccAssetId(iccAssetId)
      ctx.setPoolBalance(poolResult.return ?? 0n)
    } catch { /* contract not yet initialised */ }
    finally { setRefreshing(false) }
  }

  useEffect(() => {
    if (ctx.appClient && activeAddress) void refreshState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.appClient, activeAddress])

  const handleRepay = async () => {
    if (!activeAddress || !ctx.appClient || !ctx.appAddress || !ctx.iccAssetId) {
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
          iccTransfer: algorand.createTransaction.assetTransfer({
            sender: activeAddress,
            receiver: ctx.appAddress,
            assetId: ctx.iccAssetId,
            amount: ctx.borrowedAmount,
          }),
        },
        sender: activeAddress,
      })

      ctx.setIsBorrowed(false)
      ctx.setBorrowedAmount(0n)
      ctx.setCollateralLocked(false)
      enqueueSnackbar('Loan repaid successfully!', { variant: 'success' })
      void refreshState()
    } catch (err: unknown) {
      enqueueSnackbar(`Repay failed: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' })
    } finally {
      setRepaying(false)
    }
  }

  const hasInvoice = ctx.nftAssetId !== null
  const invoiceRow = hasInvoice
    ? {
        id: String(ctx.nftAssetId),
        amount: ctx.amount ? `₹${ctx.amount.toLocaleString('en-IN')}` : '—',
        dueDate: ctx.dueDate || '—',
        score: ctx.trustScore,
        risk: ctx.riskLevel || '—',
        status: ctx.invoiceStatus || 'ACTIVE',
        txnId: ctx.mintTxnId,
      }
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Gold accent rule */}
      <div style={{ height: 3, background: 'var(--accent-gold)', marginBottom: 24 }} />

      {/* App ID link */}
      {ctx.appId !== null && (
        <div style={{ marginBottom: 18 }}>
          <a
            href={`${lora}/application/${ctx.appId}`}
            target="_blank" rel="noreferrer"
            className="mono"
            style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-gold)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            APP / {String(ctx.appId)} ↗
          </a>
        </div>
      )}

      {/* ── 4 metric cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--border-default)',
          border: '1px solid var(--border-default)',
          marginBottom: 24,
        }}
      >
        {/* Trust Score — arc card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0, duration: 0.25 }}
          style={{
            background: 'var(--bg-surface)',
            padding: '18px 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <div className="label-caps" style={{ marginBottom: 10 }}>Trust Score</div>
          <div style={{ alignSelf: 'center', marginTop: 4 }}>
            <ArcGauge score={ctx.trustScore} color={riskColor} />
          </div>
          {ctx.riskLevel && (
            <div style={{ marginTop: 8, alignSelf: 'center' }}>
              <RiskDot risk={ctx.riskLevel} />
            </div>
          )}
        </motion.div>

        <StatCard
          delay={0.04}
          label="Borrow Limit"
          value={`₹${ctx.borrowLimit.toLocaleString('en-IN')}`}
          sub={`${utilisation}% utilised`}
        />
        <StatCard
          delay={0.08}
          label="ICC Pool"
          value={`${iccPool.toLocaleString()}`}
          sub="ICC available"
          color="var(--status-low)"
        />
        <StatCard
          delay={0.12}
          label="Active Loans"
          value={ctx.isBorrowed ? '1' : '0'}
          sub={ctx.isBorrowed ? `${Number(ctx.borrowedAmount).toLocaleString()} ICC outstanding` : 'No open positions'}
          color={ctx.isBorrowed ? 'var(--status-medium)' : 'var(--text-muted)'}
        />
      </div>

      {/* ── Refresh ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <button
          onClick={() => void refreshState()}
          disabled={refreshing || !ctx.appClient}
          className="btn-secondary"
          style={{ fontSize: 10, padding: '4px 12px' }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Loading bar */}
      {refreshing && <div className="loading-bar" style={{ marginBottom: 2 }} />}

      {/* ── Invoice table ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.25 }}
        style={{ marginBottom: 24 }}
      >
        <div style={{ marginBottom: 8 }}>
          <span className="label-caps">Invoice Positions</span>
        </div>

        <div style={{ border: '1px solid var(--border-default)', overflow: 'hidden' }}>
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
                <>
                <tr>
                  <td>
                    <a
                      href={`${lora}/asset/${invoiceRow.id}`}
                      target="_blank" rel="noreferrer"
                      className="mono"
                      style={{ fontSize: 11, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em' }}
                    >
                      {invoiceRow.id} ↗
                    </a>
                  </td>
                  <td>
                    <span className="mono" style={{ color: 'var(--text-primary)' }}>{invoiceRow.amount}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 11 }}>{invoiceRow.dueDate}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 13, color: riskColor, fontWeight: 600 }}>
                      {invoiceRow.score}
                    </span>
                  </td>
                  <td>
                    <RiskDot risk={invoiceRow.risk} />
                  </td>
                  <td>
                    <StatusPill status={invoiceRow.status} />
                  </td>
                  <td>
                    {ctx.isBorrowed ? (
                      <button
                        onClick={handleRepay}
                        disabled={repaying}
                        className="btn-secondary"
                        style={{ fontSize: 10, padding: '4px 10px', color: 'var(--status-medium)', borderColor: 'var(--status-medium)' }}
                      >
                        {repaying ? 'Repaying…' : 'Repay'}
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/app/borrow')}
                        className="btn-secondary"
                        style={{ fontSize: 10, padding: '4px 10px' }}
                      >
                        Borrow
                      </button>
                    )}
                  </td>
                </tr>
                {/* GST verified row */}
                {ctx.gstVerified && ctx.gstData && (
                  <tr>
                    <td colSpan={7} style={{ paddingTop: 8, paddingBottom: 8 }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--status-low)',
                          letterSpacing: '0.06em',
                        }}
                      >
                        GST VERIFIED · {ctx.gstData.state} · {ctx.gstData.taxpayer_type} Taxpayer · Since {ctx.gstData.registration_date.slice(-4)}
                      </span>
                    </td>
                  </tr>
                )}
                </>
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-muted)', fontSize: 12 }}
                  >
                    No invoice positions.{' '}
                    <button
                      onClick={() => navigate('/app/upload')}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--accent-gold)',
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

      {/* ── ICC asset info ── */}
      {ctx.iccAssetId !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22 }}
          style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}
        >
          <span className="label-caps" style={{ marginRight: 10 }}>ICC Asset</span>
          <a
            href={`${lora}/asset/${ctx.iccAssetId}`}
            target="_blank" rel="noreferrer"
            className="mono"
            style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.04em' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-gold)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {String(ctx.iccAssetId)} ↗
          </a>
        </motion.div>
      )}

      {/* ── Mint txn link ── */}
      {ctx.mintTxnId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.26 }}
          style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 8 }}
        >
          <span className="label-caps" style={{ marginRight: 10 }}>Mint Transaction</span>
          <a
            href={`${lora}/transaction/${ctx.mintTxnId}`}
            target="_blank" rel="noreferrer"
            className="mono"
            style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.04em' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-gold)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {ctx.mintTxnId.slice(0, 20)}… ↗
          </a>
        </motion.div>
      )}
    </div>
  )
}
