import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import React, { useState } from 'react'
import { InvoiceFactory } from '../contracts/Invoice'
import { useInvoice } from '../context/InvoiceContext'
import { getRiskColor } from '../lib/trustScore'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { loraBase } from '../utils/lora'

const MintInvoice: React.FC = () => {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [loading, setLoading] = useState(false)

  const riskColor = getRiskColor(ctx.riskLevel || 'HIGH')

  const handleMint = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Connect your wallet first', { variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      const factory = new InvoiceFactory({ defaultSender: activeAddress, algorand })
      const { appClient } = await factory.deploy({ onSchemaBreak: 'append', onUpdate: 'append' })

      const appAddress = String(appClient.appClient.appAddress)

      // Seed pool with 1 ALGO via seed_pool() — covers MBR (0.1) + lending liquidity
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

      const dueDateUnix = ctx.dueDate
        ? BigInt(Math.floor(new Date(ctx.dueDate).getTime() / 1000))
        : 2_000_000_000n

      // create_invoice fires 1 inner AssetConfig txn → needs +1 fee
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
      ctx.setAppClient(appClient)

      enqueueSnackbar(`NFT minted! Asset ID: ${assetId}`, { variant: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      enqueueSnackbar(`Mint failed: ${msg}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const lora = loraBase()

  return (
    <div className="space-y-6">
      {/* Invoice summary */}
      <div className="card bg-base-100 shadow-md border border-base-200">
        <div className="card-body">
          <h2 className="card-title">Invoice Summary</h2>
          <div className="stats stats-vertical sm:stats-horizontal shadow w-full">
            <div className="stat">
              <div className="stat-title">Business</div>
              <div className="stat-value text-lg truncate">{ctx.businessName || '—'}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Amount</div>
              <div className="stat-value text-lg">₹{ctx.amount.toLocaleString('en-IN')}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Trust Score</div>
              <div className="stat-value text-lg" style={{ color: riskColor }}>{ctx.trustScore}</div>
              <div className="stat-desc">
                <span
                  className={
                    ctx.riskLevel === 'LOW' ? 'badge badge-success badge-sm' :
                    ctx.riskLevel === 'MEDIUM' ? 'badge badge-warning badge-sm' :
                    'badge badge-error badge-sm'
                  }
                >
                  {ctx.riskLevel}
                </span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-title">Borrow Limit</div>
              <div className="stat-value text-lg">₹{ctx.borrowLimit.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Formula card */}
      <div className="card bg-base-200 border border-base-300">
        <div className="card-body py-4">
          <p className="text-sm font-semibold text-base-content/70 uppercase tracking-wide">Formula</p>
          <p className="font-mono text-base">Borrow Limit = Amount × (Score ÷ 100)</p>
          <p className="font-mono text-sm text-base-content/60">
            = ₹{ctx.amount.toLocaleString('en-IN')} × ({ctx.trustScore} ÷ 100)
            {' = '}<strong>₹{ctx.borrowLimit.toLocaleString('en-IN')}</strong>
          </p>
        </div>
      </div>

      {/* Mint button / success */}
      {ctx.nftAssetId !== null ? (
        <div className="card bg-success/10 border border-success shadow-md">
          <div className="card-body space-y-3">
            <div className="flex items-center gap-2 text-success font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Invoice NFT Minted Successfully
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">NFT Asset ID:</span>
                <a
                  href={`${lora}/asset/${ctx.nftAssetId}`}
                  target="_blank" rel="noreferrer"
                  className="link link-primary font-mono"
                >
                  {String(ctx.nftAssetId)}
                </a>
              </div>
              {ctx.mintTxnId && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">Txn ID:</span>
                  <a
                    href={`${lora}/transaction/${ctx.mintTxnId}`}
                    target="_blank" rel="noreferrer"
                    className="link link-primary font-mono truncate max-w-xs"
                  >
                    {ctx.mintTxnId}
                  </a>
                </div>
              )}
            </div>

            <button className="btn btn-primary w-full" onClick={() => ctx.setStep(3)}>
              Continue to Borrow →
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-primary w-full"
          onClick={handleMint}
          disabled={loading || !ctx.trustScore}
        >
          {loading ? <span className="loading loading-spinner" /> : '🪙 Mint Invoice NFT'}
        </button>
      )}
    </div>
  )
}

export default MintInvoice
