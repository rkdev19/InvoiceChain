import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { useSnackbar } from 'notistack'
import { useNavigate } from 'react-router-dom'
import { useInvoice } from '../context/InvoiceContext'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { loraBase } from '../utils/lora'
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

export default function RepayPage() {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const lora = loraBase()

  const [repaying, setRepaying] = useState(false)
  const [successTxn, setSuccessTxn] = useState<string | null>(null)

  // ── Guard: no active borrow ───────────────────────────────────
  if (!ctx.isBorrowed || !ctx.nftAssetId) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ height: 3, background: 'var(--border-default)', marginBottom: 28 }} />
        <div style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: 28 }}>
          <div className="label-caps" style={{ marginBottom: 12 }}>No Active Loan</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            You have no outstanding borrow position to repay.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={() => navigate('/app')}>Dashboard</button>
            <button className="btn-primary" onClick={() => navigate('/app/borrow')}>Borrow</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Success state ─────────────────────────────────────────────
  if (successTxn) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 520, margin: '0 auto' }}
      >
        <div style={{ height: 3, background: 'var(--status-low)', marginBottom: 28 }} />
        <div style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: 28 }}>
          <div className="label-caps" style={{ marginBottom: 16 }}>Loan Repaid</div>
          <div
            className="display"
            style={{ fontSize: 40, color: 'var(--status-low)', lineHeight: 1, marginBottom: 8 }}
          >
            {Number(ctx.borrowedAmount).toLocaleString()} ICC
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            NFT returned to your wallet. Collateral released.
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, marginBottom: 8 }}>
            <label style={LABEL}>NFT Asset</label>
            <a
              href={`${lora}/asset/${ctx.nftAssetId}`}
              target="_blank" rel="noreferrer"
              className="mono"
              style={{ fontSize: 11, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em' }}
            >
              {String(ctx.nftAssetId)} ↗
            </a>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={LABEL}>Transaction</label>
            <a
              href={`${lora}/transaction/${successTxn}`}
              target="_blank" rel="noreferrer"
              className="mono"
              style={{ fontSize: 11, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em', wordBreak: 'break-all' }}
            >
              {successTxn} ↗
            </a>
          </div>

          <button className="btn-primary" onClick={() => navigate('/app')}>Back to Dashboard</button>
        </div>
      </motion.div>
    )
  }

  const handleRepay = async () => {
    if (!activeAddress || !ctx.appClient || !ctx.appAddress || !ctx.iccAssetId || !ctx.nftAssetId) {
      enqueueSnackbar('Wallet or contract not ready', { variant: 'warning' })
      return
    }
    setRepaying(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      // ── Step 1: Opt into NFT if needed ────────────────────────
      // The NFT was minted directly to the contract — user has never
      // held it, so they need to opt in before the contract can return it.
      const acctInfo = await algorand.account.getInformation(activeAddress)
      type AssetEntry = { assetId?: bigint | number; 'asset-id'?: bigint | number }
      const assets = acctInfo.assets as AssetEntry[] | undefined
      const isOptedIntoNft = assets?.some(a => {
        const id = a.assetId ?? a['asset-id']
        return id !== undefined && BigInt(id) === ctx.nftAssetId
      })

      if (!isOptedIntoNft) {
        // Signature 1: opt into NFT ASA so the contract can send it back
        await algorand.send.assetOptIn({
          sender: activeAddress,
          assetId: ctx.nftAssetId,
        })
        enqueueSnackbar('Opted into Invoice NFT', { variant: 'info' })
      }

      // ── Step 2: Atomic group — ICC transfer + repay() ─────────
      // AlgoKit groups the axfer arg + app call into one atomic group.
      // Signature 2 (or 1 if already opted in).
      const result = await ctx.appClient.send.repay({
        args: {
          iccTransfer: algorand.createTransaction.assetTransfer({
            sender: activeAddress,
            receiver: ctx.appAddress,
            assetId: ctx.iccAssetId,
            amount: ctx.borrowedAmount,
          }),
        },
        extraFee: microAlgos(2000), // inner txn: NFT transfer back to user
        sender: activeAddress,
      })

      const txnId = result.transaction.txID()

      ctx.setIsBorrowed(false)
      ctx.setBorrowedAmount(0n)
      ctx.setCollateralLocked(false)
      setSuccessTxn(txnId)
    } catch (err: unknown) {
      const msg = parseError(err)
      if (msg) enqueueSnackbar(msg, { variant: 'error', autoHideDuration: 5000 })
    } finally {
      setRepaying(false)
    }
  }

  const borrowedIcc = Number(ctx.borrowedAmount)

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ height: 3, background: 'var(--status-medium)', marginBottom: 28 }} />

      {/* ── Outstanding position summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          padding: '18px 20px',
          marginBottom: 2,
        }}
      >
        <div className="label-caps" style={{ marginBottom: 14 }}>Outstanding Position</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <label style={LABEL}>ICC Owed</label>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--status-medium)', lineHeight: 1 }}>
              {borrowedIcc.toLocaleString()}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.04em' }}>ICC tokens</div>
          </div>
          <div>
            <label style={LABEL}>Invoice NFT</label>
            <a
              href={`${lora}/asset/${ctx.nftAssetId}`}
              target="_blank" rel="noreferrer"
              className="mono"
              style={{ fontSize: 13, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em' }}
            >
              {String(ctx.nftAssetId)} ↗
            </a>
          </div>
          <div>
            <label style={LABEL}>Status</label>
            <div className="mono" style={{ fontSize: 13, color: 'var(--status-medium)', letterSpacing: '0.06em' }}>
              COLLATERAL LOCKED
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── ICC asset row ── */}
      {ctx.iccAssetId !== null && (
        <div style={{
          border: '1px solid var(--border-default)',
          borderTop: 'none',
          background: 'var(--bg-surface)',
          padding: '10px 20px',
          marginBottom: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span className="label-caps">ICC Asset ID</span>
          <a
            href={`${lora}/asset/${ctx.iccAssetId}`}
            target="_blank" rel="noreferrer"
            className="mono"
            style={{ fontSize: 11, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em' }}
          >
            {String(ctx.iccAssetId)} ↗
          </a>
        </div>
      )}

      {/* ── Repay card ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        style={{
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div className="label-caps">Repay Loan</div>

        {/* What happens on repay */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-default)' }}>
          <div style={{ background: 'var(--bg-elevated)', padding: '14px 16px' }}>
            <div className="label-caps" style={{ marginBottom: 6 }}>You Send</div>
            <div className="display" style={{ fontSize: 26, color: 'var(--status-medium)', lineHeight: 1 }}>
              {borrowedIcc.toLocaleString()}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>ICC tokens</div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: '14px 16px' }}>
            <div className="label-caps" style={{ marginBottom: 6 }}>You Receive</div>
            <div className="display" style={{ fontSize: 26, color: 'var(--status-low)', lineHeight: 1 }}>
              NFT
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
              Invoice #{String(ctx.nftAssetId)}
            </div>
          </div>
        </div>

        {/* Repay info note */}
        <div
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            borderLeft: '2px solid var(--border-default)',
            paddingLeft: 12,
          }}
        >
          Repaying will transfer {borrowedIcc.toLocaleString()} ICC from your wallet to the contract.
          The Invoice NFT collateral is returned to your wallet upon confirmation.
          {!ctx.nftAssetId ? '' : ' A wallet opt-in to the NFT is sent first if needed (1 extra prompt).'}
        </div>

        <button
          onClick={handleRepay}
          disabled={repaying || !activeAddress}
          className="btn-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            fontSize: 13,
            padding: '11px 20px',
            background: repaying ? undefined : 'transparent',
            border: '1px solid var(--status-medium)',
            color: repaying ? undefined : 'var(--status-medium)',
          }}
        >
          {repaying
            ? 'Processing…'
            : `Repay ${borrowedIcc.toLocaleString()} ICC → Unlock NFT`}
        </button>

        <div
          className="mono"
          style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}
        >
          Algorand smart contract · Atomic settlement · No intermediaries
        </div>
      </motion.div>
    </div>
  )
}
