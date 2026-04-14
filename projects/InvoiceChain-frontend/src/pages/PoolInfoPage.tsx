import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { useSnackbar } from 'notistack'
import { useInvoice } from '../context/InvoiceContext'
import { loraBase } from '../utils/lora'
import { getRiskColor } from '../lib/trustScore'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { InvoiceClient } from '../contracts/Invoice'

export default function PoolInfoPage() {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const lora = loraBase()

  const [seeding, setSeeding] = useState(false)
  const [seedAmount, setSeedAmount] = useState(1)
  const [refreshing, setRefreshing] = useState(false)

  // Pool values are ICC units (integer, decimals=2)
  const poolIcc = Number(ctx.poolBalance)
  const borrowedIcc = Number(ctx.borrowedAmount)
  const totalIcc = poolIcc + borrowedIcc
  const utilisation = totalIcc > 0 ? Math.round((borrowedIcc / totalIcc) * 100) : 0

  const utilisationColor =
    utilisation > 80 ? 'var(--status-high)' : utilisation > 50 ? 'var(--status-medium)' : 'var(--status-low)'

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
      enqueueSnackbar(`Seed failed: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' })
    } finally {
      setSeeding(false)
    }
  }

  const loans = ctx.isBorrowed && ctx.borrowedAmount > 0n
    ? [
        {
          borrower: activeAddress ? `${activeAddress.slice(0, 8)}…${activeAddress.slice(-4)}` : '—',
          amount: `${Number(ctx.borrowedAmount).toLocaleString()} ICC`,
          risk: ctx.riskLevel || '—',
          status: ctx.invoiceStatus || 'ACTIVE',
          txnId: ctx.mintTxnId,
        },
      ]
    : []

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
          {
            label: 'ICC Pool',
            value: poolIcc.toLocaleString(),
            unit: 'ICC available',
            color: 'var(--accent-gold)',
          },
          {
            label: 'Total Borrowed',
            value: borrowedIcc.toLocaleString(),
            unit: 'ICC out on loan',
            color: ctx.isBorrowed ? 'var(--status-medium)' : 'var(--text-muted)',
          },
          {
            label: 'Utilisation',
            value: `${utilisation}%`,
            unit: `${100 - utilisation}% free`,
            color: utilisationColor,
          },
          {
            label: 'Active Loans',
            value: ctx.isBorrowed ? '1' : '0',
            unit: 'positions',
            color: ctx.isBorrowed ? 'var(--status-medium)' : 'var(--text-muted)',
          },
        ].map(({ label, value, unit, color }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', padding: '18px 20px 16px' }}>
            <div className="label-caps" style={{ marginBottom: 10 }}>{label}</div>
            <div
              className="mono"
              style={{ fontSize: 22, fontWeight: 600, color, letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              {value}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.04em' }}>
              {unit}
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Utilisation bar (3px) ── */}
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

      {/* ── Seed Pool (deployer only) ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: '16px 18px', marginBottom: 24 }}
      >
        <div className="label-caps" style={{ marginBottom: 4 }}>Seed Liquidity Pool (ALGO)</div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Send ALGO to the contract to cover inner transaction fees. Only the deployer address can seed.
          ICC tokens are already held by the contract after setup.
        </p>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL}>Amount (ALGO)</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={seedAmount}
              onChange={e => setSeedAmount(Number(e.target.value))}
              className="ic-input"
              style={{ width: '100%' }}
            />
          </div>
          <button
            onClick={handleSeedPool}
            disabled={seeding || !ctx.appClient || !activeAddress}
            className="btn-primary"
            style={{ whiteSpace: 'nowrap' }}
          >
            {seeding ? 'Seeding…' : 'Seed Pool →'}
          </button>
          <button
            onClick={refreshPool}
            disabled={refreshing || !ctx.appClient}
            className="btn-secondary"
            style={{ whiteSpace: 'nowrap', fontSize: 10, padding: '9px 12px' }}
          >
            {refreshing ? '…' : 'Refresh'}
          </button>
        </div>
      </motion.div>

      {/* ── Loading bar ── */}
      {refreshing && <div className="loading-bar" style={{ marginBottom: 2 }} />}

      {/* ── Active loans table ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className="label-caps">Active Loans</span>
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              border: '1px solid var(--border-default)',
              padding: '1px 6px',
              letterSpacing: '0.06em',
            }}
          >
            {loans.length}
          </span>
        </div>

        <div style={{ border: '1px solid var(--border-default)', overflow: 'hidden' }}>
          <table className="ic-table">
            <thead>
              <tr>
                {['Borrower', 'ICC Amount', 'Risk', 'Status', 'Transaction'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
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
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: loan.status === 'LIQUIDATED' ? 'var(--status-liquidated)' : 'var(--status-medium)',
                          letterSpacing: '0.08em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: loan.status === 'LIQUIDATED' ? 'var(--status-liquidated)' : 'var(--status-medium)',
                          display: 'inline-block',
                        }} />
                        {loan.status}
                      </span>
                    </td>
                    <td>
                      {loan.txnId ? (
                        <a
                          href={`${lora}/transaction/${loan.txnId}`}
                          target="_blank" rel="noreferrer"
                          className="mono"
                          style={{ fontSize: 11, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em' }}
                        >
                          {loan.txnId.slice(0, 12)}… ↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-muted)', fontSize: 12 }}
                  >
                    No active loans. ICC pool is fully available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
