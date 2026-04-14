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
    if (!ctx.iccAssetId) {
      enqueueSnackbar('ICC token not initialised — mint invoice first', { variant: 'warning' })
      return
    }
    if (sliderVal <= 0) { enqueueSnackbar('Select an amount > 0', { variant: 'warning' }); return }

    setLoading(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      // Ensure caller is opted into ICC before borrowing
      const acctInfo = await algorand.account.getInformation(activeAddress)
      const assetsList = acctInfo.assets as Array<{ 'asset-id': bigint | number }> | undefined
      const isOptedIn = assetsList?.some(a => BigInt(a['asset-id']) === ctx.iccAssetId)
      if (!isOptedIn) {
        await algorand.send.assetOptIn({
          sender: activeAddress,
          assetId: ctx.iccAssetId!,
        })
        enqueueSnackbar('Opted into ICC ASA', { variant: 'info' })
      }

      const result = await ctx.appClient.send.borrow({
        args: { borrowAmount: BigInt(sliderVal) },
        extraFee: microAlgos(1000),
        sender: activeAddress,
      })

      const txnId = result.transaction.txID()
      ctx.setIsBorrowed(true)
      ctx.setBorrowedAmount(BigInt(sliderVal))
      ctx.setCollateralLocked(true)
      setSuccessTxn(txnId)
      enqueueSnackbar(`Borrowed ${sliderVal.toLocaleString()} ICC successfully!`, { variant: 'success' })
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
        <div style={{ height: 3, background: 'var(--status-medium)', marginBottom: 28 }} />
        <div style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: 28 }}>
          <div className="label-caps" style={{ marginBottom: 16 }}>Active Position</div>
          <div
            className="display"
            style={{ fontSize: 40, color: 'var(--status-medium)', lineHeight: 1, marginBottom: 8 }}
          >
            {Number(ctx.borrowedAmount).toLocaleString()} ICC
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Outstanding loan. Repay before opening a new position.
          </div>
          <button onClick={() => navigate('/app')} className="btn-secondary">
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
        <div style={{ height: 3, background: 'var(--border-default)', marginBottom: 28 }} />
        <div style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: 28 }}>
          <div className="label-caps" style={{ marginBottom: 12 }}>No Invoice NFT</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
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
        <div style={{ height: 3, background: 'var(--status-low)', marginBottom: 28 }} />
        <div style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: 28 }}>
          <div className="label-caps" style={{ marginBottom: 16 }}>Funds Disbursed</div>
          <div
            className="display"
            style={{ fontSize: 44, color: 'var(--status-low)', lineHeight: 1, marginBottom: 4 }}
          >
            {sliderVal.toLocaleString()} ICC
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            landed in your wallet
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, marginBottom: 20 }}>
            <div className="label-caps" style={{ marginBottom: 6 }}>Transaction</div>
            <a
              href={`${lora}/transaction/${successTxn}`}
              target="_blank" rel="noreferrer"
              className="mono"
              style={{ fontSize: 11, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em', wordBreak: 'break-all' }}
            >
              {successTxn} ↗
            </a>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={() => navigate('/app')}>Dashboard</button>
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
      {/* Gold accent rule */}
      <div style={{ height: 3, background: 'var(--accent-gold)', marginBottom: 24 }} />

      {/* ── Collateral warning banner ── */}
      <div className="collateral-warning" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M12 2L2 19h20L12 2zM12 9v5M12 17h.01"/>
          </svg>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent-gold)', marginBottom: 3 }}>
              Collateral locked on borrow
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Your Invoice NFT will be locked as collateral in the contract. You receive ICC tokens
              proportional to your trust score. Repay ICC to release the collateral.
            </div>
          </div>
        </div>
      </div>

      {/* ── Invoice summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: '14px 18px', marginBottom: 2 }}
      >
        <div className="label-caps" style={{ marginBottom: 10 }}>Invoice Summary</div>
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
                className={mono ? 'mono' : undefined}
                style={{ fontSize: 13, color: color ?? 'var(--text-primary)', fontWeight: 500 }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ICC token row */}
      {ctx.iccAssetId !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            border: '1px solid var(--border-default)',
            borderTop: 'none',
            background: 'var(--bg-surface)',
            padding: '10px 18px',
            marginBottom: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="label-caps">ICC Asset ID</div>
          <a
            href={`${lora}/asset/${ctx.iccAssetId}`}
            target="_blank" rel="noreferrer"
            className="mono"
            style={{ fontSize: 11, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em' }}
          >
            {String(ctx.iccAssetId)} ↗
          </a>
        </motion.div>
      )}

      {/* ── Borrow card ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div className="label-caps">Select Borrow Amount</div>

        {/* Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>0</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {max.toLocaleString()} ICC
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
              background: `linear-gradient(to right, var(--accent-gold) ${pct}%, var(--border-default) ${pct}%)`,
            }}
          />
        </div>

        {/* Live calculation */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-default)' }}>
          <div style={{ background: 'var(--bg-elevated)', padding: '14px 16px' }}>
            <div className="label-caps" style={{ marginBottom: 6 }}>You Receive</div>
            <div
              className="display"
              style={{ fontSize: 28, color: 'var(--accent-gold)', lineHeight: 1 }}
            >
              {sliderVal.toLocaleString()}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
              ICC · {pct}% of limit
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: '14px 16px' }}>
            <div className="label-caps" style={{ marginBottom: 6 }}>Remaining Limit</div>
            <div
              className="display"
              style={{ fontSize: 28, color: 'var(--text-primary)', lineHeight: 1 }}
            >
              {(max - sliderVal).toLocaleString()}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
              ICC after draw
            </div>
          </div>
        </div>

        {/* Fee info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span className="label-caps" style={{ fontSize: 9 }}>Protocol fee</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--status-low)' }}>0% — MVP</span>
        </div>

        {/* Loading bar */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="loading-bar"
            />
          )}
        </AnimatePresence>

        {/* CTA */}
        <button
          onClick={handleBorrow}
          disabled={loading || sliderVal <= 0}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '11px 20px' }}
        >
          {loading ? 'Processing…' : `Borrow ${sliderVal.toLocaleString()} ICC →`}
        </button>

        <div
          className="mono"
          style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}
        >
          Algorand smart contract · Instant settlement · No intermediaries
        </div>
      </motion.div>
    </div>
  )
}
