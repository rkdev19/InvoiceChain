import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { useSnackbar } from 'notistack'
import { useNavigate } from 'react-router-dom'
import { useInvoice } from '../context/InvoiceContext'
import { getRiskColor } from '../lib/trustScore'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { loraBase } from '../utils/lora'

export default function BorrowPage() {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const lora = loraBase()

  const max = ctx.borrowLimit
  const [sliderVal, setSliderVal] = useState(Math.max(1, Math.floor(max / 2)))
  const [loading, setLoading] = useState(false)
  const [successTxn, setSuccessTxn] = useState<string | null>(null)

  const pct = max > 0 ? Math.round((sliderVal / max) * 100) : 0
  const riskColor = getRiskColor(ctx.riskLevel || 'HIGH')

  const handleBorrow = async () => {
    if (!activeAddress || !ctx.appClient) {
      enqueueSnackbar('Wallet or contract not ready', { variant: 'warning' })
      return
    }
    if (sliderVal <= 0) { enqueueSnackbar('Select an amount > 0', { variant: 'warning' }); return }

    setLoading(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      const result = await ctx.appClient.send.borrow({
        args: { borrowAmount: BigInt(sliderVal) },
        extraFee: microAlgos(1000),
        sender: activeAddress,
      })

      const txnId = result.transaction.txID()
      ctx.setIsBorrowed(true)
      ctx.setBorrowedAmount(BigInt(sliderVal))
      setSuccessTxn(txnId)
      enqueueSnackbar(`Borrowed ₹${sliderVal.toLocaleString('en-IN')} successfully!`, { variant: 'success' })
    } catch (err: unknown) {
      enqueueSnackbar(`Borrow failed: ${err instanceof Error ? err.message : String(err)}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // ── Already borrowed ──
  if (ctx.isBorrowed && !successTxn) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ height: 2, background: 'var(--ic-warning)', marginBottom: 28 }} />
        <div style={{ border: '1px solid var(--ic-border)', background: 'var(--ic-surface)', padding: 28 }}>
          <div className="label-caps" style={{ marginBottom: 16 }}>Active Position</div>
          <div
            className="num"
            style={{ fontSize: 36, fontWeight: 600, color: 'var(--ic-warning)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}
          >
            ₹{Number(ctx.borrowedAmount).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ic-text-muted)', marginBottom: 20 }}>
            Outstanding loan. Repay before opening a new position.
          </div>
          <button
            onClick={() => navigate('/app')}
            className="btn-ghost"
          >
            Go to Dashboard → Repay
          </button>
        </div>
      </div>
    )
  }

  // ── No invoice minted ──
  if (!ctx.nftAssetId) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ height: 2, background: 'var(--ic-border)', marginBottom: 28 }} />
        <div style={{ border: '1px solid var(--ic-border)', background: 'var(--ic-surface)', padding: 28 }}>
          <div className="label-caps" style={{ marginBottom: 12 }}>No Invoice NFT</div>
          <p style={{ fontSize: 13, color: 'var(--ic-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Mint an invoice NFT first to unlock borrowing against it.
          </p>
          <button className="btn-primary" onClick={() => navigate('/app/upload')}>
            Upload Invoice →
          </button>
        </div>
      </div>
    )
  }

  // ── Success state ──
  if (successTxn) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 560, margin: '0 auto' }}
      >
        <div style={{ height: 2, background: 'var(--ic-positive)', marginBottom: 28 }} />
        <div style={{ border: '1px solid var(--ic-border)', background: 'var(--ic-surface)', padding: 28 }}>
          <div className="label-caps" style={{ marginBottom: 16 }}>Funds Disbursed</div>

          <div
            className="num"
            style={{ fontSize: 40, fontWeight: 600, color: 'var(--ic-positive)', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}
          >
            ₹{sliderVal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ic-text-muted)', marginBottom: 20 }}>
            landed in your wallet
          </div>

          <div style={{ borderTop: '1px solid var(--ic-border-subtle)', paddingTop: 16, marginBottom: 20 }}>
            <div className="label-caps" style={{ marginBottom: 6 }}>Transaction</div>
            <a
              href={`${lora}/transaction/${successTxn}`}
              target="_blank" rel="noreferrer"
              className="num"
              style={{ fontSize: 11, color: 'var(--ic-accent)', textDecoration: 'none', letterSpacing: '0.04em', wordBreak: 'break-all' }}
            >
              {successTxn} ↗
            </a>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={() => navigate('/app')}>Dashboard</button>
            <button className="btn-primary" onClick={() => { setSuccessTxn(null); ctx.setIsBorrowed(false) }}>
              New Borrow
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Gold accent line */}
      <div style={{ height: 2, background: 'var(--ic-accent)', marginBottom: 28 }} />

      {/* ── Invoice summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ border: '1px solid var(--ic-border)', background: 'var(--ic-surface)', padding: '16px 20px', marginBottom: 2 }}
      >
        <div className="label-caps" style={{ marginBottom: 12 }}>Invoice Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Business', value: ctx.businessName || '—', mono: false },
            { label: 'Amount', value: `₹${ctx.amount.toLocaleString('en-IN')}`, mono: true },
            { label: 'Risk', value: ctx.riskLevel || '—', color: riskColor },
            { label: 'Limit', value: `₹${max.toLocaleString('en-IN')}`, mono: true },
          ].map(({ label, value, mono, color }) => (
            <div key={label}>
              <div className="label-caps" style={{ marginBottom: 4 }}>{label}</div>
              <div
                className={mono ? 'num' : undefined}
                style={{ fontSize: 13, color: color ?? 'var(--ic-text)', fontWeight: 500 }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Borrow card ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{ border: '1px solid var(--ic-border)', background: 'var(--ic-surface)', padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}
      >
        <div className="label-caps">Select Borrow Amount</div>

        {/* Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="num" style={{ fontSize: 10, color: 'var(--ic-text-muted)' }}>₹0</span>
            <span className="num" style={{ fontSize: 10, color: 'var(--ic-text-muted)' }}>
              ₹{max.toLocaleString('en-IN')}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={sliderVal}
            onChange={e => setSliderVal(Number(e.target.value))}
            className="ic-range"
            style={{
              width: '100%',
              background: `linear-gradient(to right, var(--ic-accent) ${pct}%, var(--ic-border) ${pct}%)`,
            }}
          />
        </div>

        {/* Live calculation */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--ic-border)' }}>
          <div style={{ background: 'var(--ic-surface-raised)', padding: '16px 18px' }}>
            <div className="label-caps" style={{ marginBottom: 6 }}>You Receive</div>
            <div
              className="num"
              style={{ fontSize: 28, fontWeight: 600, color: 'var(--ic-accent)', letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              ₹{sliderVal.toLocaleString('en-IN')}
            </div>
            <div className="num" style={{ fontSize: 10, color: 'var(--ic-text-muted)', marginTop: 4 }}>
              {pct}% of limit
            </div>
          </div>
          <div style={{ background: 'var(--ic-surface-raised)', padding: '16px 18px' }}>
            <div className="label-caps" style={{ marginBottom: 6 }}>Remaining Limit</div>
            <div
              className="num"
              style={{ fontSize: 28, fontWeight: 600, color: 'var(--ic-text)', letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              ₹{(max - sliderVal).toLocaleString('en-IN')}
            </div>
            <div className="num" style={{ fontSize: 10, color: 'var(--ic-text-muted)', marginTop: 4 }}>
              after this draw
            </div>
          </div>
        </div>

        {/* Fee info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ic-text-muted)' }}>
          <span className="label-caps" style={{ fontSize: 9 }}>Protocol fee</span>
          <span className="num" style={{ fontSize: 11, color: 'var(--ic-positive)' }}>0% — MVP</span>
        </div>

        {/* Loading bar */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ic-loading-bar"
            />
          )}
        </AnimatePresence>

        {/* CTA */}
        <button
          onClick={handleBorrow}
          disabled={loading || sliderVal <= 0}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '12px 20px' }}
        >
          {loading ? 'Processing…' : `Borrow ₹${sliderVal.toLocaleString('en-IN')} →`}
        </button>

        <div
          className="num"
          style={{ textAlign: 'center', fontSize: 10, color: 'var(--ic-text-muted)', letterSpacing: '0.06em' }}
        >
          Algorand smart contract · Instant settlement · No intermediaries
        </div>
      </motion.div>
    </div>
  )
}
