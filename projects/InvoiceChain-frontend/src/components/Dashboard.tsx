import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import React, { useEffect, useState } from 'react'
import { InvoiceClient } from '../contracts/Invoice'
import { useInvoice } from '../context/InvoiceContext'
import { getRiskColor } from '../lib/trustScore'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { loraBase } from '../utils/lora'

const StatCard: React.FC<{ title: string; value: string; sub?: string; accent?: string }> = ({
  title, value, sub, accent,
}) => (
  <div className="stat bg-base-100 rounded-box border border-base-200 shadow-sm">
    <div className="stat-title text-xs">{title}</div>
    <div className="stat-value text-xl" style={accent ? { color: accent } : undefined}>{value}</div>
    {sub && <div className="stat-desc">{sub}</div>}
  </div>
)

const Dashboard: React.FC = () => {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [repaying, setRepaying] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (ctx.appClient && activeAddress) void refreshState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.appClient, activeAddress])

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
      const [, , , riskLevel, borrowLimit, isBorrowed, borrowedAmount, nftAssetId] = info
      ctx.setRiskLevel(riskLevel)
      ctx.setBorrowLimit(Number(borrowLimit))
      ctx.setIsBorrowed(Boolean(isBorrowed))
      ctx.setBorrowedAmount(borrowedAmount)
      ctx.setNftAssetId(nftAssetId)
      ctx.setPoolBalance(poolResult.return ?? 0n)
    } catch {
      // state may not be initialised yet
    } finally {
      setRefreshing(false)
    }
  }

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

      // repay(axfer) takes a grouped ICC asset-transfer
      if (!ctx.iccAssetId) throw new Error('ICC asset not initialised')
      const result = await ctx.appClient.send.repay({
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

      const txnId = result.transaction.txID()
      ctx.setIsBorrowed(false)
      ctx.setBorrowedAmount(0n)

      enqueueSnackbar(`Repaid ₹${Number(ctx.borrowedAmount).toLocaleString('en-IN')} — txn: ${txnId.slice(0, 12)}…`, {
        variant: 'success',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      enqueueSnackbar(`Repay failed: ${msg}`, { variant: 'error' })
    } finally {
      setRepaying(false)
    }
  }

  const riskColor = getRiskColor(ctx.riskLevel || 'HIGH')
  const appIdStr = ctx.appId !== null ? String(ctx.appId) : '—'
  const lora = loraBase()

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">{ctx.businessName || 'Invoice Dashboard'}</h2>
          {ctx.appId !== null && (
            <a
              href={`${lora}/application/${appIdStr}`}
              target="_blank" rel="noreferrer"
              className="link link-primary text-xs font-mono"
            >
              App ID: {appIdStr}
            </a>
          )}
        </div>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => void refreshState()}
          disabled={refreshing}
        >
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : '↻ Refresh'}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Invoice Amount"
          value={`₹${ctx.amount.toLocaleString('en-IN')}`}
          sub={ctx.dueDate ? `Due ${ctx.dueDate}` : undefined}
        />
        <StatCard title="Trust Score" value={String(ctx.trustScore)} sub="/ 100" accent={riskColor} />
        <StatCard title="Risk Level" value={ctx.riskLevel || '—'} accent={riskColor} />
        <StatCard title="Borrow Limit" value={`₹${ctx.borrowLimit.toLocaleString('en-IN')}`} />
        <StatCard
          title="Borrowed"
          value={`₹${Number(ctx.borrowedAmount).toLocaleString('en-IN')}`}
          sub={ctx.isBorrowed ? 'Active' : 'None'}
          accent={ctx.isBorrowed ? '#f59e0b' : undefined}
        />
        <StatCard
          title="Status"
          value={ctx.isBorrowed ? 'Borrowed' : ctx.nftAssetId !== null ? 'Minted' : 'New'}
          accent={ctx.isBorrowed ? '#f59e0b' : '#22c55e'}
        />
        <StatCard
          title="Pool Balance"
          value={`${(Number(ctx.poolBalance) / 1_000_000).toFixed(3)} ALGO`}
          sub="Available in pool"
          accent="#6366f1"
        />
        <StatCard
          title="Available to Borrow"
          value={`₹${Math.max(0, ctx.borrowLimit - Number(ctx.borrowedAmount)).toLocaleString('en-IN')}`}
          sub="Remaining credit"
        />
      </div>

      {/* NFT asset link */}
      {ctx.nftAssetId !== null && (
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body py-3 flex-row flex-wrap items-center gap-3">
            <span className="text-sm font-medium">NFT Asset:</span>
            <a
              href={`${lora}/asset/${ctx.nftAssetId}`}
              target="_blank" rel="noreferrer"
              className="link link-primary font-mono text-sm"
            >
              {String(ctx.nftAssetId)}
            </a>
          </div>
        </div>
      )}

      {/* Repay section */}
      {ctx.isBorrowed && (
        <div className="card bg-warning/10 border border-warning shadow-md">
          <div className="card-body space-y-3">
            <h3 className="font-semibold text-warning">Outstanding Borrow</h3>
            <p className="text-sm">
              You owe <strong>₹{Number(ctx.borrowedAmount).toLocaleString('en-IN')}</strong> — repay to restore your limit.
            </p>
            <button
              className="btn btn-warning w-full"
              onClick={handleRepay}
              disabled={repaying}
            >
              {repaying
                ? <span className="loading loading-spinner" />
                : `Repay ₹${Number(ctx.borrowedAmount).toLocaleString('en-IN')}`}
            </button>
          </div>
        </div>
      )}

      {/* No contract yet */}
      {!ctx.appClient && (
        <div className="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Complete Upload → Mint → Borrow first to see live contract data.
        </div>
      )}
    </div>
  )
}

export default Dashboard
