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

  const poolAlgo = Number(ctx.poolBalance) / 1_000_000
  const borrowedAlgo = Number(ctx.borrowedAmount) / 1_000_000
  const totalAlgo = poolAlgo + borrowedAlgo
  const utilisation = totalAlgo > 0 ? Math.round((borrowedAlgo / totalAlgo) * 100) : 0

  const utilisationColor =
    utilisation > 80 ? 'var(--ic-danger)' : utilisation > 50 ? 'var(--ic-warning)' : 'var(--ic-positive)'

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
          amount: `₹${Number(ctx.borrowedAmount).toLocaleString('en-IN')}`,
          risk: ctx.riskLevel || '—',
          status: 'ACTIVE',
          txnId: ctx.mintTxnId,
        },
      ]
    : []

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Gold accent line */}
      <div style={{ height: 2, background: 'var(--ic-accent)', marginBottom: 28 }} />

      {/* ── 4 pool stat cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--ic-border)',
          border: '1px solid var(--ic-border)',
          marginBottom: 28,
        }}
      >
        {[
          {
            label: 'Pool Balance',
            value: poolAlgo.toFixed(3),
            unit: 'ALGO',
            color: 'var(--ic-accent)',
          },
          {
            label: 'Total Borrowed',
            value: borrowedAlgo.toFixed(3),
            unit: 'ALGO',
            color: ctx.isBorrowed ? 'var(--ic-warning)' : 'var(--ic-text-muted)',
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
            color: ctx.isBorrowed ? 'var(--ic-warning)' : 'var(--ic-text-muted)',
          },
        ].map(({ label, value, unit, color }) => (
          <div key={label} style={{ background: 'var(--ic-surface)', padding: '20px 20px 18px' }}>
            <div className="label-caps" style={{ marginBottom: 12 }}>{label}</div>
            <div
              className="num"
              style={{ fontSize: 24, fontWeight: 600, color, letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              {value}
            </div>
            <div className="num" style={{ fontSize: 10, color: 'var(--ic-text-muted)', marginTop: 6, letterSpacing: '0.04em' }}>
              {unit}
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Utilisation bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        style={{ border: '1px solid var(--ic-border)', background: 'var(--ic-surface)', padding: '18px 20px', marginBottom: 2 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="label-caps">Pool Utilisation</span>
          <span className="num" style={{ fontSize: 11, color: utilisationColor, letterSpacing: '0.04em' }}>
            {utilisation}% · {utilisation <= 50 ? 'Healthy' : utilisation <= 80 ? 'Moderate' : 'High'}
          </span>
        </div>
        <div style={{ height: 2, background: 'var(--ic-border)', position: 'relative', overflow: 'hidden' }}>
          <motion.div
            style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: utilisationColor }}
            initial={{ width: 0 }}
            animate={{ width: `${utilisation}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span className="num" style={{ fontSize: 10, color: 'var(--ic-text-muted)' }}>
            Borrowed: {borrowedAlgo.toFixed(3)} ALGO
          </span>
          <span className="num" style={{ fontSize: 10, color: 'var(--ic-text-muted)' }}>
            Available: {poolAlgo.toFixed(3)} ALGO
          </span>
        </div>
      </motion.div>

      {/* ── Seed Pool ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        style={{ border: '1px solid var(--ic-border)', background: 'var(--ic-surface)', padding: '18px 20px', marginBottom: 28 }}
      >
        <div className="label-caps" style={{ marginBottom: 4 }}>Seed Liquidity Pool</div>
        <p style={{ fontSize: 12, color: 'var(--ic-text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          As the contract creator, you can add ALGO to the lending pool.
          Only the deployer address can seed.
        </p>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Amount (ALGO)</label>
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
            className="btn-ghost"
            style={{ whiteSpace: 'nowrap', fontSize: 10 }}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </motion.div>

      {/* ── Active loans table ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span className="label-caps">Active Loans</span>
          <span
            className="num"
            style={{
              fontSize: 10,
              color: 'var(--ic-text-muted)',
              border: '1px solid var(--ic-border)',
              padding: '1px 6px',
              letterSpacing: '0.06em',
            }}
          >
            {loans.length}
          </span>
        </div>

        {/* Loading bar */}
        {refreshing && <div className="ic-loading-bar" style={{ marginBottom: 2 }} />}

        <div style={{ border: '1px solid var(--ic-border)', overflow: 'hidden' }}>
          <table className="ic-table">
            <thead>
              <tr>
                {['Borrower', 'Amount', 'Risk', 'Status', 'Transaction'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loans.length > 0 ? loans.map((loan, i) => {
                const rc = getRiskColor(loan.risk)
                return (
                  <tr key={i}>
                    <td>
                      <span className="num" style={{ fontSize: 12 }}>{loan.borrower}</span>
                    </td>
                    <td>
                      <span className="num" style={{ color: 'var(--ic-text)', fontWeight: 600 }}>{loan.amount}</span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: rc, display: 'inline-block' }} />
                        <span className="num" style={{ fontSize: 11, color: rc, letterSpacing: '0.06em' }}>{loan.risk}</span>
                      </span>
                    </td>
                    <td>
                      <span
                        className="num"
                        style={{ fontSize: 10, color: 'var(--ic-warning)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ic-warning)', display: 'inline-block' }} />
                        {loan.status}
                      </span>
                    </td>
                    <td>
                      {loan.txnId ? (
                        <a
                          href={`${lora}/transaction/${loan.txnId}`}
                          target="_blank" rel="noreferrer"
                          className="num"
                          style={{ fontSize: 11, color: 'var(--ic-accent)', textDecoration: 'none', letterSpacing: '0.04em' }}
                        >
                          {loan.txnId.slice(0, 12)}… ↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--ic-text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--ic-text-muted)', fontSize: 12 }}
                  >
                    No active loans. Pool is fully available.
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
