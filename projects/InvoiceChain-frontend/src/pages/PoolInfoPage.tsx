import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { useSnackbar } from 'notistack'
import { useNavigate } from 'react-router-dom'
import { useInvoice } from '../context/InvoiceContext'
import { loraBase } from '../utils/lora'
import { getRiskColor } from '../lib/trustScore'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { InvoiceClient } from '../contracts/Invoice'
import { parseError } from '../utils/parseError'

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

function ellipse(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

export default function PoolInfoPage() {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const lora = loraBase()

  const [seeding, setSeeding] = useState(false)
  const [seedAmount, setSeedAmount] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  const [liquidating, setLiquidating] = useState(false)
  const [isDeployer, setIsDeployer] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Pool values are ICC units (integer, decimals=2)
  const poolIcc = Number(ctx.poolBalance)
  const borrowedIcc = Number(ctx.borrowedAmount)
  const totalIcc = poolIcc + borrowedIcc
  const utilisation = totalIcc > 0 ? Math.round((borrowedIcc / totalIcc) * 100) : 0

  const utilisationColor =
    utilisation > 80 ? 'var(--status-high)' : utilisation > 50 ? 'var(--status-medium)' : 'var(--status-low)'

  // Countdown / overdue
  const dueUnix = ctx.dueDate ? new Date(ctx.dueDate).getTime() / 1000 : 0
  const nowUnix = Date.now() / 1000
  const daysOverdue = dueUnix > 0 ? Math.floor((nowUnix - dueUnix) / 86400) : 0
  const isOverdue = daysOverdue > 0 && ctx.isBorrowed

  // ── Check if connected wallet is the app creator ──────────────
  useEffect(() => {
    if (!ctx.appId || !activeAddress) { setIsDeployer(false); return }
    const algodConfig = getAlgodConfigFromViteEnvironment()
    const indexerConfig = getIndexerConfigFromViteEnvironment()
    const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
    algorand.client.algod
      .getApplicationByID(Number(ctx.appId))
      .do()
      .then((info) => {
        const creator = info.params?.creator
        const creatorStr = creator ? String(creator) : ''
        setIsDeployer(creatorStr === activeAddress)
      })
      .catch(() => setIsDeployer(false))
  }, [ctx.appId, activeAddress])

  const refreshPool = async () => {
    if (!ctx.appClient) return
    setRefreshing(true)
    try {
      const result = await (ctx.appClient as InvoiceClient).send.getPoolBalance({ args: [] })
      ctx.setPoolBalance(result.return ?? 0n)
    } catch { /* ignore */ }
    finally { setRefreshing(false) }
  }

  const handleSeedPool = async () => {
    if (!activeAddress || !ctx.appClient || !ctx.appAddress) {
      enqueueSnackbar('Connect wallet and mint an invoice first', { variant: 'warning' })
      return
    }
    setSeeding(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      await ctx.appClient.send.seedPool({
        args: {
          payment: algorand.createTransaction.payment({
            sender: activeAddress,
            receiver: ctx.appAddress,
            amount: microAlgos(seedAmount * 1_000_000),
          }),
        },
        sender: activeAddress,
      })

      enqueueSnackbar(`Seeded ${seedAmount} ALGO to pool`, { variant: 'success' })
      await refreshPool()
    } catch (err: unknown) {
      const msg = parseError(err)
      if (msg) enqueueSnackbar(msg, { variant: 'error', autoHideDuration: 5000 })
    } finally {
      setSeeding(false)
    }
  }

  const handleLiquidate = async () => {
    if (!activeAddress || !ctx.appClient) {
      enqueueSnackbar('Wallet or contract not ready', { variant: 'warning' })
      return
    }
    setLiquidating(true)
    try {
      await ctx.appClient.send.liquidate({
        args: [],
        extraFee: microAlgos(1000),
        sender: activeAddress,
      })
      ctx.setIsBorrowed(false)
      ctx.setBorrowedAmount(0n)
      ctx.setCollateralLocked(false)
      ctx.setInvoiceStatus('LIQUIDATED')
      enqueueSnackbar(
        'Invoice NFT permanently retained by protocol. Borrower defaulted.',
        { variant: 'error', autoHideDuration: 6000 }
      )
    } catch (err: unknown) {
      const msg = parseError(err)
      if (msg) enqueueSnackbar(msg, { variant: 'error', autoHideDuration: 5000 })
    } finally {
      setLiquidating(false)
    }
  }

  const handleReset = () => {
    localStorage.removeItem('ic_state_v1')
    window.location.href = '/app/upload'
  }

  const loans = ctx.isBorrowed && ctx.borrowedAmount > 0n
    ? [{
        borrower: activeAddress ? ellipse(activeAddress) : '—',
        amount: `${Number(ctx.borrowedAmount).toLocaleString()} ICC`,
        risk: ctx.riskLevel || '—',
        status: ctx.invoiceStatus || 'ACTIVE',
        txnId: ctx.mintTxnId,
      }]
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Gold accent rule */}
      <div style={{ height: 3, background: 'var(--accent-gold)', marginBottom: 24 }} />

      {/* ── ICC asset header ── */}
      {ctx.iccAssetId !== null && (
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 5, height: 5, background: 'var(--accent-gold)', flexShrink: 0 }} />
          <span className="label-caps">InvoiceChain Credit (ICC)</span>
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
        </div>
      )}

      {/* ── 4 ICC stat cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--border-default)',
          border: '1px solid var(--border-default)',
          marginBottom: 24,
        }}
      >
        {[
          { label: 'ICC Pool',      value: poolIcc.toLocaleString(),    unit: 'ICC available',   color: 'var(--accent-gold)' },
          { label: 'Total Borrowed',value: borrowedIcc.toLocaleString(),unit: 'ICC out on loan',  color: ctx.isBorrowed ? 'var(--status-medium)' : 'var(--text-muted)' },
          { label: 'Utilisation',   value: `${utilisation}%`,           unit: `${100-utilisation}% free`, color: utilisationColor },
          { label: 'Active Loans',  value: ctx.isBorrowed ? '1' : '0', unit: 'positions',         color: ctx.isBorrowed ? 'var(--status-medium)' : 'var(--text-muted)' },
        ].map(({ label, value, unit, color }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', padding: '18px 20px 16px' }}>
            <div className="label-caps" style={{ marginBottom: 10 }}>{label}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, color, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {value}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.04em' }}>
              {unit}
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Utilisation bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: '16px 18px', marginBottom: 2 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="label-caps">Pool Utilisation</span>
          <span className="mono" style={{ fontSize: 11, color: utilisationColor, letterSpacing: '0.04em' }}>
            {utilisation}% · {utilisation <= 50 ? 'Healthy' : utilisation <= 80 ? 'Moderate' : 'High'}
          </span>
        </div>
        <div className="util-bar-track">
          <motion.div
            className="util-bar-fill"
            style={{ background: utilisationColor }}
            initial={{ width: 0 }}
            animate={{ width: `${utilisation}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Borrowed: {borrowedIcc.toLocaleString()} ICC
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Available: {poolIcc.toLocaleString()} ICC
          </span>
        </div>
      </motion.div>

      {/* ── Seed Pool ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: '16px 18px', marginBottom: 24 }}
      >
        <div className="label-caps" style={{ marginBottom: 4 }}>Seed Liquidity Pool (ALGO)</div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Send ALGO to the contract to cover inner transaction fees. ICC tokens are already held by the contract after setup.
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL}>Amount (ALGO)</label>
            <input
              type="number" min={0.1} step={0.1} value={seedAmount}
              onChange={e => setSeedAmount(Number(e.target.value))}
              className="ic-input" style={{ width: '100%' }}
            />
          </div>
          <button onClick={handleSeedPool} disabled={seeding || !ctx.appClient || !activeAddress} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
            {seeding ? 'Seeding…' : 'Seed Pool →'}
          </button>
          <button onClick={refreshPool} disabled={refreshing || !ctx.appClient} className="btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: 10, padding: '9px 12px' }}>
            {refreshing ? '…' : 'Refresh'}
          </button>
        </div>
      </motion.div>

      {refreshing && <div className="loading-bar" style={{ marginBottom: 2 }} />}

      {/* ── Active loans table ── */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className="label-caps">Active Loans</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--border-default)', padding: '1px 6px', letterSpacing: '0.06em' }}>
            {loans.length}
          </span>
        </div>
        <div style={{ border: '1px solid var(--border-default)', overflow: 'hidden' }}>
          <table className="ic-table">
            <thead>
              <tr>{['Borrower', 'ICC Amount', 'Risk', 'Status', 'Transaction'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {loans.length > 0 ? loans.map((loan, i) => {
                const rc = getRiskColor(loan.risk)
                return (
                  <tr key={i}>
                    <td><span className="mono" style={{ fontSize: 11 }}>{loan.borrower}</span></td>
                    <td><span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{loan.amount}</span></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: rc, display: 'inline-block' }} />
                        <span className="mono" style={{ fontSize: 10, color: rc, letterSpacing: '0.06em' }}>{loan.risk}</span>
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: 10, color: loan.status === 'LIQUIDATED' ? 'var(--status-liquidated)' : 'var(--status-medium)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: loan.status === 'LIQUIDATED' ? 'var(--status-liquidated)' : 'var(--status-medium)', display: 'inline-block' }} />
                        {loan.status}
                      </span>
                    </td>
                    <td>
                      {loan.txnId ? (
                        <a href={`${lora}/transaction/${loan.txnId}`} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 11, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em' }}>
                          {loan.txnId.slice(0, 12)}… ↗
                        </a>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                    No active loans. ICC pool is fully available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Deployer-only: Liquidation Controls ── */}
      <AnimatePresence>
        {isDeployer && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.24 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {/* Liquidation card */}
            <div
              style={{
                border: '1px solid var(--status-high)',
                background: 'rgba(239,68,68,0.04)',
                padding: '18px 20px',
              }}
            >
              <div
                className="mono"
                style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}
              >
                Liquidation Controls
              </div>

              {ctx.isBorrowed && ctx.borrowedAmount > 0n ? (
                <>
                  {/* Loan details */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                    <div>
                      <label style={LABEL}>Borrower</label>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {activeAddress ? ellipse(activeAddress) : '—'}
                      </div>
                    </div>
                    <div>
                      <label style={LABEL}>Due Date</label>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {ctx.dueDate || '—'}
                      </div>
                    </div>
                    <div>
                      <label style={LABEL}>{isOverdue ? 'Days Overdue' : 'Days Remaining'}</label>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: isOverdue ? 'var(--status-high)' : 'var(--status-low)', lineHeight: 1 }}>
                        {isOverdue ? daysOverdue : Math.max(0, Math.ceil((dueUnix - nowUnix) / 86400))}
                      </div>
                    </div>
                    <div>
                      <label style={LABEL}>Borrowed</label>
                      <div className="mono" style={{ fontSize: 14, color: 'var(--status-medium)', fontWeight: 600 }}>
                        {Number(ctx.borrowedAmount).toLocaleString()} ICC
                      </div>
                    </div>
                  </div>

                  {/* Liquidate button */}
                  {isOverdue ? (
                    <button
                      onClick={handleLiquidate}
                      disabled={liquidating}
                      style={{
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid var(--status-high)',
                        color: 'var(--status-high)',
                        borderRadius: 2,
                        padding: '9px 20px',
                        fontFamily: "'IBM Plex Sans', sans-serif",
                        fontSize: 13,
                        cursor: liquidating ? 'not-allowed' : 'pointer',
                        opacity: liquidating ? 0.6 : 1,
                        transition: 'opacity 120ms',
                      }}
                    >
                      {liquidating ? 'Liquidating…' : 'Liquidate Invoice →'}
                    </button>
                  ) : (
                    <div>
                      <button
                        disabled
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-muted)',
                          borderRadius: 2,
                          padding: '9px 20px',
                          fontFamily: "'IBM Plex Sans', sans-serif",
                          fontSize: 13,
                          cursor: 'not-allowed',
                          opacity: 0.5,
                        }}
                      >
                        Liquidate Invoice
                      </button>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, letterSpacing: '0.04em' }}>
                        Available after {ctx.dueDate || '—'}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {ctx.invoiceStatus === 'LIQUIDATED'
                    ? <span style={{ color: 'var(--status-high)' }}>Invoice NFT permanently retained by protocol. Borrower defaulted.</span>
                    : 'No active borrow position. Liquidation not available.'}
                </div>
              )}
            </div>

            {/* Demo Reset */}
            <div
              style={{
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <div className="label-caps" style={{ marginBottom: 4 }}>Demo Reset</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Clear local state for a fresh demo run. On-chain contract is not affected.
                </div>
              </div>
              <button
                onClick={() => setShowResetConfirm(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  borderRadius: 2,
                  padding: '6px 14px',
                  color: 'var(--text-muted)',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'border-color 120ms, color 120ms',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
              >
                Reset Demo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reset confirmation modal ── */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            key="reset-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9000,
              background: 'rgba(8,8,8,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                padding: 28,
                maxWidth: 380,
                width: '100%',
                margin: '0 20px',
              }}
            >
              <div className="label-caps" style={{ marginBottom: 12 }}>Confirm Reset</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>
                This will clear all local state and allow a fresh demo run.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                The smart contract on-chain is <strong style={{ color: 'var(--text-secondary)' }}>not affected</strong>. Only browser storage is cleared.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleReset}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--status-high)',
                    borderRadius: 2,
                    padding: '8px 18px',
                    color: 'var(--status-high)',
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
