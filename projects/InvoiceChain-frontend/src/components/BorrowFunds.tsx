import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import React, { useState } from 'react'
import { useInvoice } from '../context/InvoiceContext'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

const LORA_TXN = 'https://lora.algokit.io/localnet/transaction'

const BorrowFunds: React.FC = () => {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  const max = ctx.borrowLimit
  const [sliderVal, setSliderVal] = useState(Math.floor(max / 2))
  const [loading, setLoading] = useState(false)

  const percentage = max > 0 ? Math.round((sliderVal / max) * 100) : 0

  const handleBorrow = async () => {
    if (!activeAddress || !ctx.appClient) {
      enqueueSnackbar('Wallet or contract not ready', { variant: 'warning' })
      return
    }
    if (sliderVal <= 0) {
      enqueueSnackbar('Select an amount greater than 0', { variant: 'warning' })
      return
    }

    setLoading(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      const appClient = ctx.appClient

      // borrow needs 1 extra fee for inner Payment txn
      const result = await appClient.send.borrow({
        args: { borrowAmount: BigInt(sliderVal) },
        extraFee: microAlgos(1000),
        sender: activeAddress,
      })

      const txnId = result.transaction.txID()
      ctx.setIsBorrowed(true)
      ctx.setBorrowedAmount(BigInt(sliderVal))

      enqueueSnackbar(
        <span>
          Borrowed ₹{sliderVal.toLocaleString('en-IN')}!{' '}
          <a href={`${LORA_TXN}/${txnId}`} target="_blank" rel="noreferrer" className="underline">
            View txn
          </a>
        </span>,
        { variant: 'success', autoHideDuration: 6000 },
      )

      ctx.setStep(4)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      enqueueSnackbar(`Borrow failed: ${msg}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (ctx.isBorrowed) {
    return (
      <div className="card bg-warning/10 border border-warning shadow-md">
        <div className="card-body items-center text-center space-y-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-warning" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="font-semibold">You already have an active borrow of ₹{Number(ctx.borrowedAmount).toLocaleString('en-IN')}</p>
          <button className="btn btn-sm btn-outline" onClick={() => ctx.setStep(4)}>
            Go to Dashboard →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow-md border border-base-200">
        <div className="card-body space-y-6">
          <h2 className="card-title">Borrow Against Your Invoice</h2>

          {/* Slider */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-base-content/60">
              <span>₹0</span>
              <span>₹{max.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={sliderVal}
              onChange={(e) => setSliderVal(Number(e.target.value))}
              className="range range-primary w-full"
            />
          </div>

          {/* Live calculation */}
          <div className="stats shadow w-full">
            <div className="stat place-items-center">
              <div className="stat-title">Borrowing</div>
              <div className="stat-value text-primary">₹{sliderVal.toLocaleString('en-IN')}</div>
              <div className="stat-desc">{percentage}% of limit</div>
            </div>
            <div className="stat place-items-center">
              <div className="stat-title">Remaining Limit</div>
              <div className="stat-value text-base-content/70">₹{(max - sliderVal).toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-base-content/50">
              <span>Utilisation</span>
              <span>{percentage}%</span>
            </div>
            <progress
              className={`progress w-full ${percentage > 80 ? 'progress-error' : percentage > 50 ? 'progress-warning' : 'progress-primary'}`}
              value={sliderVal}
              max={max}
            />
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={handleBorrow}
            disabled={loading || sliderVal <= 0}
          >
            {loading ? <span className="loading loading-spinner" /> : `Borrow ₹${sliderVal.toLocaleString('en-IN')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BorrowFunds
